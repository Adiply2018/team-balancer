import asyncio
import logging
import os
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Dict, List

import aiohttp
import pulp
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from logger import log

load_dotenv()


app = FastAPI(title="LoL Team Balancer API")

# CORSの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 環境変数
RIOT_API_KEY = os.getenv("RIOT_API_KEY")
if not RIOT_API_KEY:
    raise ValueError("RIOT_API_KEY environment variable is not set")

# 基本設定
REGION = "jp1"
BASE_URL = f"https://{REGION}.api.riotgames.com/lol"
ASIA_URL = "https://asia.api.riotgames.com/lol"

# レート制限用キャッシュ
request_cache = {}


# Pydanticモデル
class RoleProficiency(BaseModel):
    TOP: int
    JUNGLE: int
    MID: int
    BOT: int
    SUPPORT: int


class Rank(BaseModel):
    combined: str
    tier: str
    division: str


class Summoner(BaseModel):
    id: str
    name: str
    rank: Rank
    roleProficiency: RoleProficiency
    isSelected: bool = True


class SummonerRequest(BaseModel):
    summonerNames: List[str]


class TeamBalanceRequest(BaseModel):
    summoners: List[Summoner]


class ChampionStats(BaseModel):
    championName: str
    iconUrl: str
    count: int


class TeamStats(BaseModel):
    avgRank: str
    avgRankScore: float
    topRoles: Dict[str, int]
    commonChampions: List[ChampionStats]


class TeamBalanceResponse(BaseModel):
    teamA: List[Summoner]
    teamB: List[Summoner]
    teamAStats: TeamStats
    teamBStats: TeamStats


# Riot APIリクエスト用のユーティリティ関数
async def make_riot_request(url: str) -> dict:
    """レート制限を考慮したRiot APIリクエスト"""
    current_time = datetime.now()

    # 古いキャッシュのクリーンアップ
    for cached_url in list(request_cache.keys()):
        if (current_time - request_cache[cached_url]) > timedelta(minutes=2):
            del request_cache[cached_url]

    # レート制限チェック
    if len(request_cache) >= 100:  # 2分間で100リクエスト制限
        oldest_request = min(request_cache.values())
        wait_time = 120 - (current_time - oldest_request).total_seconds()
        if wait_time > 0:
            await asyncio.sleep(wait_time)

    headers = {"X-Riot-Token": RIOT_API_KEY}
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as response:
            if response.status == 429:
                retry_after = int(response.headers.get("Retry-After", 1))
                await asyncio.sleep(retry_after)
                return await make_riot_request(url)

            request_cache[url] = current_time
            return await response.json()


@lru_cache(maxsize=1000)
def get_rank_score(rank: str) -> float:
    """ランクを数値スコアに変換"""
    rank_values = {
        "IRON": 0,
        "BRONZE": 4,
        "SILVER": 8,
        "GOLD": 12,
        "PLATINUM": 16,
        "EMERALD": 20,
        "DIAMOND": 24,
        "MASTER_LOW": 28,
        "MASTER_HIGH": 29,
        "GRANDMASTER": 30,
        "CHALLENGER": 31,
    }

    if rank == "UNRANKED":
        return 0

    tier = rank.split("_")[0]
    division = rank.split("_")[1] if "_" in rank else "0"

    base_score = rank_values.get(tier, 0)
    if division.isdigit():
        division_score = 4 - int(division)
        return base_score + division_score
    return base_score


async def get_summoner_data(name: str) -> dict:
    """サモナーの基本情報を取得"""
    url = f"{BASE_URL}/summoner/v4/summoners/by-name/{name}"
    return await make_riot_request(url)


async def get_ranked_stats(summoner_id: str) -> Rank:
    """ランク情報を取得"""
    url = f"{BASE_URL}/league/v4/entries/by-summoner/{summoner_id}"
    ranked_data = await make_riot_request(url)

    # ソロキューデータを検索
    solo_queue = next(
        (queue for queue in ranked_data if queue["queueType"] == "RANKED_SOLO_5x5"),
        None,
    )

    if not solo_queue:
        return Rank(tier="UNRANKED", division="", combined="UNRANKED")

    tier = solo_queue["tier"]
    rank = solo_queue.get("rank", "")

    # 高ランク帯の特殊処理
    if tier == "MASTER":
        lp = solo_queue.get("leaguePoints", 0)
        combined = f"MASTER_{'HIGH' if lp >= 200 else 'LOW'}"
    else:
        combined = (
            f"{tier}_{rank.replace('IV', '4').replace('III', '3').replace('II', '2').replace('I', '1')}"
            if rank
            else tier
        )

    return Rank(tier=tier, division=rank, combined=combined)


async def get_role_proficiency(summoner_puuid: str) -> RoleProficiency:
    """ロール習熟度を計算"""
    matches_url = (
        f"{ASIA_URL}/match/v5/matches/by-puuid/{summoner_puuid}/ids?start=0&count=50"
    )
    matches = await make_riot_request(matches_url)

    role_counts = {"TOP": 0, "JUNGLE": 0, "MID": 0, "BOT": 0, "SUPPORT": 0}

    # 直近20試合を分析
    for match_id in matches[:20]:
        match_url = f"{ASIA_URL}/match/v5/matches/{match_id}"
        match_data = await make_riot_request(match_url)

        for participant in match_data["info"]["participants"]:
            if participant["puuid"] == summoner_puuid:
                role = participant["teamPosition"]
                if role in role_counts:
                    role_counts[role] += 1

    # 習熟度を0-5スケールに変換
    proficiency = {}
    for role, count in role_counts.items():
        if count == 0:
            proficiency[role] = 0
        else:
            proficiency[role] = min(5, max(1, int((count / 20) * 6)))

    return RoleProficiency(**proficiency)


def balance_teams(summoners: List[Summoner]) -> tuple[List[Summoner], List[Summoner]]:
    """チーム分け最適化"""
    if len(summoners) != 10:
        raise ValueError("Need exactly 10 summoners")

    # 線形計画問題の設定
    prob = pulp.LpProblem("TeamBalancer", pulp.LpMinimize)

    # チーム割り当て変数（バイナリ）
    x = pulp.LpVariable.dicts(
        "team_assignment", ((i, j) for i in range(10) for j in range(2)), cat="Binary"
    )

    # 制約条件1: 各プレイヤーは1つのチームのみに所属
    for i in range(10):
        prob += pulp.lpSum(x[i, j] for j in range(2)) == 1

    # 制約条件2: 各チーム5人
    for j in range(2):
        prob += pulp.lpSum(x[i, j] for i in range(10)) == 5

    # チーム強さの計算
    rank_scores = [get_rank_score(s.rank.combined) for s in summoners]
    role_scores = [sum(s.roleProficiency.dict().values()) for s in summoners]

    # 制約条件3: チーム間のランク差を制限
    rank_diff = pulp.lpSum(rank_scores[i] * x[i, 0] for i in range(10)) - pulp.lpSum(
        rank_scores[i] * x[i, 1] for i in range(10)
    )
    prob += rank_diff <= 20
    prob += rank_diff >= -20

    # 制約条件4: チーム間のロール習熟度差を制限
    role_diff = pulp.lpSum(role_scores[i] * x[i, 0] for i in range(10)) - pulp.lpSum(
        role_scores[i] * x[i, 1] for i in range(10)
    )
    prob += role_diff <= 10
    prob += role_diff >= -10

    # 最適化問題を解く
    prob.solve()

    # チームの振り分け
    team_a = []
    team_b = []
    for i in range(10):
        if pulp.value(x[i, 0]) == 1:
            team_a.append(summoners[i])
        else:
            team_b.append(summoners[i])

    return team_a, team_b


# APIエンドポイント
@app.post("/api/summoners")
async def get_summoners_data(request: SummonerRequest):
    """サモナー情報を取得するエンドポイント"""
    try:
        summoners_data = []
        for name in request.summonerNames:
            # 基本情報の取得
            summoner = await get_summoner_data(name)

            # ランク情報の取得
            rank_data = await get_ranked_stats(summoner["id"])

            # ロール習熟度の取得
            role_data = await get_role_proficiency(summoner["puuid"])

            summoners_data.append(
                {"name": name, "rank": rank_data, "roleProficiency": role_data}
            )

        return summoners_data
    except Exception as e:
        logging.error(f"Error in get_summoners_data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/balance-teams", response_model=TeamBalanceResponse)
async def balance_teams_endpoint(request: TeamBalanceRequest):
    """チーム分けを行うエンドポイント"""
    log.info(f"Request: {request}")
    try:
        team_a, team_b = balance_teams(request.summoners)
        return {"teamA": team_a, "teamB": team_b}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error in balance_teams_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

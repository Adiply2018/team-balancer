import random
import traceback
from functools import lru_cache
from typing import Dict, List

import pulp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from logger import log
from riot_api import get_summoners_data

app = FastAPI(title="LoL Team Balancer API")

# CORSの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切なオリジンに制限すること
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    randomness: float = 0.0  # 0が最適化、100がランダム


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


def calculate_team_stats(team: List[Summoner]) -> TeamStats:
    """チームの統計情報を計算"""
    if not team:
        return TeamStats(
            avgRank="UNRANKED", avgRankScore=0, topRoles={}, commonChampions=[]
        )

    # 1. 平均ランクスコアの計算
    rank_scores = [get_rank_score(s.rank.combined) for s in team]
    avg_rank_score = sum(rank_scores) / len(rank_scores)

    # 2. 平均ランクの決定
    # ベースとなるランク値
    rank_boundaries = {
        31: ("CHALLENGER", None),
        30: ("GRANDMASTER", None),
        29: ("MASTER_HIGH", None),
        28: ("MASTER_LOW", None),
        24: ("DIAMOND", True),
        20: ("EMERALD", True),
        16: ("PLATINUM", True),
        12: ("GOLD", True),
        8: ("SILVER", True),
        4: ("BRONZE", True),
        0: ("IRON", True),
    }

    tier = "UNRANKED"
    division = None

    for base_score, (rank_name, has_division) in rank_boundaries.items():
        if avg_rank_score >= base_score:
            tier = rank_name
            if has_division:
                remainder = avg_rank_score - base_score
                division = 4 - min(3, int(remainder))
            break

    avg_rank = f"{tier}_{division}" if division else tier

    # 3. 得意ロールの集計
    top_roles = {"MID": 0, "TOP": 0, "JUNGLE": 0, "BOT": 0, "SUPPORT": 0}
    for member in team:
        for role, level in member.roleProficiency.dict().items():
            if level > 2:  # レベル3以上を得意とみなす
                top_roles[role] = top_roles.get(role, 0) + 1

    # 4. 共通チャンピオンの集計
    champion_counts = {}
    for member in team:
        if hasattr(member, "top3Champs") and member.top3Champs:
            for [[icon, name], count] in member.top3Champs:
                if name not in champion_counts:
                    champion_counts[name] = {"count": 0, "iconUrl": icon}
                champion_counts[name]["count"] += count

    common_champions = [
        ChampionStats(championName=name, iconUrl=data["iconUrl"], count=data["count"])
        for name, data in sorted(
            champion_counts.items(), key=lambda x: x[1]["count"], reverse=True
        )[:5]  # 上位5チャンピオンのみ
    ]

    return TeamStats(
        avgRank=avg_rank,
        avgRankScore=avg_rank_score,
        topRoles=top_roles,
        commonChampions=common_champions,
    )


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

    tier = rank.split(" ")[0]
    division = rank.split(" ")[1] if " " in rank else "0"
    division = (
        division.replace("IV", "4")
        .replace("III", "3")
        .replace("II", "2")
        .replace("I", "1")
    )

    base_score = rank_values.get(tier, 0)
    if division.isdigit():
        division_score = 4 - int(division)
        log.info(f"Rank: {rank}, Base: {base_score}, Division: {division_score}")
        return base_score + division_score
    return base_score


def balance_teams(
    summoners: List[Summoner], randomness: float = 50.0
) -> tuple[List[Summoner], List[Summoner]]:
    """
    チーム分け最適化（ランダム性付き）

    Args:
        summoners: プレイヤーのリスト
        randomness: ランダム性の強さ（0-100）。0は完全な最適化、100は制約内でのランダムな振り分け
    """
    if len(summoners) != 10:
        raise ValueError("Need exactly 10 summoners")
    if not 0 <= randomness <= 100:
        raise ValueError("Randomness must be between 0 and 100")

    # ランダム性に基づいてスコアにノイズを追加
    noise_scale = randomness / 100.0
    rank_scores = [
        get_rank_score(s.rank.combined) + random.gauss(0, noise_scale * 10)
        for s in summoners
    ]
    role_scores = [
        sum(s.roleProficiency.dict().values()) + random.gauss(0, noise_scale * 5)
        for s in summoners
    ]

    log.info(
        f"Original rank scores: {[get_rank_score(s.rank.combined) for s in summoners]}"
    )
    log.info(f"Noised rank scores: {rank_scores}")
    log.info(
        f"Original role scores: {[sum(s.roleProficiency.dict().values()) for s in summoners]}"
    )
    log.info(f"Noised role scores: {role_scores}")

    # 線形計画問題の設定
    prob = pulp.LpProblem("TeamBalancer", pulp.LpMinimize)
    x = pulp.LpVariable.dicts(
        "team_assignment", ((i, j) for i in range(10) for j in range(2)), cat="Binary"
    )

    # 制約条件1: 各プレイヤーは1つのチームのみに所属
    for i in range(10):
        prob += pulp.lpSum(x[i, j] for j in range(2)) == 1

    # 制約条件2: 各チーム5人
    for j in range(2):
        prob += pulp.lpSum(x[i, j] for i in range(10)) == 5

    # チーム間の差分計算
    rank_diff = pulp.lpSum(rank_scores[i] * x[i, 0] for i in range(10)) - pulp.lpSum(
        rank_scores[i] * x[i, 1] for i in range(10)
    )
    role_diff = pulp.lpSum(role_scores[i] * x[i, 0] for i in range(10)) - pulp.lpSum(
        role_scores[i] * x[i, 1] for i in range(10)
    )

    # 制約条件3: チーム間のランク差を制限
    # ランダム性が高いほど制約を緩める
    rank_limit = 20 * (1 + noise_scale)
    prob += rank_diff <= rank_limit
    prob += rank_diff >= -rank_limit

    # 制約条件4: チーム間のロール習熟度差を制限
    role_limit = 10 * (1 + noise_scale)
    prob += role_diff <= role_limit
    prob += role_diff >= -role_limit

    # 目的関数: チーム間の差を最小化しつつ、ランダム性を導入
    # 絶対値を線形計算で表現するための補助変数
    rank_diff_pos = pulp.LpVariable("rank_diff_pos", 0)
    rank_diff_neg = pulp.LpVariable("rank_diff_neg", 0)
    role_diff_pos = pulp.LpVariable("role_diff_pos", 0)
    role_diff_neg = pulp.LpVariable("role_diff_neg", 0)

    # rank_diff = rank_diff_pos - rank_diff_neg
    prob += rank_diff == rank_diff_pos - rank_diff_neg
    # role_diff = role_diff_pos - role_diff_neg
    prob += role_diff == role_diff_pos - role_diff_neg

    # 目的関数
    prob += (
        rank_diff_pos
        + rank_diff_neg
        + role_diff_pos
        + role_diff_neg
        + pulp.lpSum(
            random.gauss(0, noise_scale) * x[i, j] for i in range(10) for j in range(2)
        )
    )

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


def normalize_rank_format(summoners: List[Summoner]) -> List[Summoner]:
    """ランク形式を標準化"""
    for summoner in summoners:
        if summoner.rank.tier == "UNRANKED":
            continue

        # SILVER II -> SILVER, II に分割
        parts = summoner.rank.tier.split()
        if len(parts) == 2:
            # ティアとディビジョンを適切に設定
            tier = parts[0]
            division = parts[1]

            # combinedを標準形式に変換 (SILVER II -> SILVER_2)
            combined = f"{tier} {division}"  # .replace('IV', '4').replace('III', '3').replace('II', '2').replace('I', '1')}"

            summoner.rank.tier = tier
            summoner.rank.division = division
            summoner.rank.combined = combined

    return summoners


# APIエンドポイント
@app.post("/api/summoners")
async def fetch_summoners_data(request: SummonerRequest):
    """サモナー情報を取得するエンドポイント"""
    try:
        summoners_data = get_summoners_data(request.summonerNames)
        print(summoners_data)
        return summoners_data
    except Exception as e:
        log.error(f"Error in fetch_summoners_data: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/balance-teams", response_model=TeamBalanceResponse)
async def balance_teams_endpoint(request: TeamBalanceRequest):
    """チーム分けを行うエンドポイント"""
    log.info(f"Request: {request}")
    try:
        # ランク形式を標準化
        normalized_summoners = normalize_rank_format(request.summoners)

        team_a, team_b = balance_teams(normalized_summoners, request.randomness)

        # 各チームの統計を計算
        team_a_stats = calculate_team_stats(team_a)
        team_b_stats = calculate_team_stats(team_b)

        return {
            "teamA": team_a,
            "teamB": team_b,
            "teamAStats": team_a_stats,
            "teamBStats": team_b_stats,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error(f"Error in balance_teams_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import boto3
import requests
from ddragon import ChampionIconGenerator


class RiotAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {"X-Riot-Token": self.api_key}
        self.region = "jp1"
        self.routing = "asia"

        # DynamoDBクライアントの初期化
        self.dynamodb = boto3.resource("dynamodb")
        self.cache_table = self.dynamodb.Table(
            os.environ.get("DYNAMODB_CACHE_TABLE", "riot-api-cache")
        )
        self.cache_duration = timedelta(hours=24 * 3)  # キャッシュの有効期限

        self.ddragon_version = self.get_ddragon_version()
        self.ddragon = ChampionIconGenerator()

    def _get_cache_key(self, summoner_name: str) -> str:
        """サモナー名からキャッシュキーを生成"""
        return f"summoner:{summoner_name}"

    def _read_cache(self, summoner_name: str) -> Optional[Dict]:
        """DynamoDBからキャッシュを読み込む"""
        try:
            response = self.cache_table.get_item(
                Key={"cache_key": self._get_cache_key(summoner_name)}
            )

            if "Item" not in response:
                return None

            cached_data = response["Item"]
            cached_time = datetime.fromisoformat(cached_data["cached_at"])

            # キャッシュの有効期限をチェック
            if datetime.now() - cached_time > self.cache_duration:
                return None

            return json.loads(cached_data["data"])
        except Exception as e:
            print(f"キャッシュの読み込みに失敗: {e}")
            return None

    def _write_cache(self, summoner_name: str, data: Dict) -> None:
        """DynamoDBにキャッシュを書き込む"""
        try:
            cache_item = {
                "cache_key": self._get_cache_key(summoner_name),
                "data": json.dumps(data),
                "cached_at": datetime.now().isoformat(),
                "ttl": int((datetime.now() + self.cache_duration).timestamp()),
            }
            self.cache_table.put_item(Item=cache_item)
        except Exception as e:
            print(f"キャッシュの書き込みに失敗: {e}")

    def request(
        self, url: str, headers: Dict, params: Dict = {}, retry: int = 0
    ) -> requests.Response:
        """レート制限対応のリクエストラッパー"""
        try:
            response = requests.get(url, headers=headers, params=params, timeout=5)
            if response.status_code == 429:
                if retry >= 3:  # 最大リトライ回数
                    raise Exception("Rate limit exceeded after maximum retries")
                time.sleep(1 * 2**retry)
                return self.request(url, headers, params, retry + 1)
            response.raise_for_status()
            return response
        except requests.exceptions.Timeout:
            raise Exception("Request timeout")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {str(e)}")

    def get_ddragon_version(self) -> str:
        """DDragonのバージョンを取得"""
        url = "https://ddragon.leagueoflegends.com/api/versions.json"
        response = self.request(url, headers={})
        return response.json()[0]

    def get_account(self, summoner_name: str, tagline: str) -> Dict:
        """サモナー名とタグラインからアカウント情報を取得"""
        url = f"https://{self.routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{summoner_name}/{tagline}"
        response = self.request(url, headers=self.headers)
        return response.json()

    def get_summoner_info(self, puuid: str) -> Dict:
        """PUUIDからサモナー情報を取得"""
        url = f"https://{self.region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}"
        response = self.request(url, headers=self.headers)
        return response.json()

    def get_rank_info(self, puuid: str) -> List[Dict]:
        """PUUIDからランク情報を取得"""
        url = f"https://{self.region}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}"
        response = self.request(url, headers=self.headers)
        return response.json()

    def get_match_history(
        self, puuid: str, count: int = 20, match_type: Optional[str] = None
    ) -> List[str]:
        """マッチ履歴を取得"""
        url = f"https://{self.routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids"
        params: Dict = {"count": count}
        if match_type:
            params["type"] = str(match_type)
        response = self.request(url, headers=self.headers, params=params)
        return response.json()

    def get_match_detail(self, match_id: str) -> Dict:
        """マッチ詳細を取得"""
        url = (
            f"https://{self.routing}.api.riotgames.com/lol/match/v5/matches/{match_id}"
        )
        response = self.request(url, headers=self.headers)
        return response.json()

    def get_player_match_detail(self, match_id: str, puuid: str) -> Optional[Dict]:
        """特定プレイヤーのマッチ詳細を取得"""
        try:
            match_detail = self.get_match_detail(match_id)
            for participant in match_detail["info"]["participants"]:
                if participant["puuid"] == puuid:
                    return {
                        "champion_id": participant["championId"],
                        "champion": participant["championName"],
                        "role": participant["teamPosition"],
                    }
        except Exception as e:
            print(f"Error processing match {match_id}: {e}")
        return None

    def calculate_role_proficiency(
        self, champ_roles: List[Dict]
    ) -> Tuple[Dict[str, int], List[Tuple[tuple, int]]]:
        """役割ごとの使用率を計算"""
        role_counts = {"TOP": 0, "JUNGLE": 0, "MIDDLE": 0, "BOTTOM": 0, "UTILITY": 0}
        for champ_role in champ_roles:
            role_counts[champ_role["role"]] += 1

        max_count = max(role_counts.values()) if role_counts.values() else 1
        role_proficiency = {
            role: round(count / max_count * 5) for role, count in role_counts.items()
        }

        champion_counts: Dict[tuple, int] = {}
        for champ_role in champ_roles:
            icon_url = self.ddragon.get_champion_icon_url(champ_role["champion_id"])
            champion = (icon_url, champ_role["champion"])
            champion_counts[champion] = champion_counts.get(champion, 0) + 1

        top_champs = sorted(champion_counts.items(), key=lambda x: x[1], reverse=True)[
            :3
        ]

        return role_proficiency, top_champs

    def get_summoner_data(self, summoner_name: str) -> Dict:
        """サモナーの総合データを取得"""
        try:
            # キャッシュをチェック
            cached_data = self._read_cache(summoner_name)
            if cached_data:
                print(f"Cache hit for: {summoner_name}")
                return cached_data

            # サモナー名とタグラインを分割
            sn, tagline = summoner_name.split("#")
            print("sn:", sn, "tagline:", tagline)

            # アカウント情報を取得
            account_info = self.get_account(sn, tagline)
            print("account_info:", account_info)
            puuid = account_info["puuid"]

            # サモナー情報を取得
            raw_summoner_info = self.get_summoner_info(puuid)
            print("raw_summoner_info:", raw_summoner_info)

            # プロフィールアイコン情報
            icon_num = raw_summoner_info["profileIconId"]
            summoner_info = {
                "name": summoner_name,
                "icon": f"https://ddragon.leagueoflegends.com/cdn/{self.ddragon_version}/img/profileicon/{icon_num}.png",
                "level": raw_summoner_info["summonerLevel"],
            }

            # ランク情報を取得（PUUIDを使用）
            raw_rank_info = self.get_rank_info(puuid)
            rank_info = {"SOLO": "UNRANKED", "FLEX": "UNRANKED"}
            for rank_data in raw_rank_info:
                if rank_data["queueType"] == "RANKED_SOLO_5x5":
                    rank_info["SOLO"] = rank_data["tier"] + " " + rank_data["rank"]
                elif rank_data["queueType"] == "RANKED_FLEX_SR":
                    rank_info["FLEX"] = rank_data["tier"] + " " + rank_data["rank"]

            # マッチヒストリーを取得
            match_count = 3
            match_history = self.get_match_history(
                puuid, match_type="ranked", count=match_count
            )
            if len(match_history) < match_count:
                match_history = self.get_match_history(puuid, count=match_count)

            # マッチ詳細を並列で取得
            with ThreadPoolExecutor(max_workers=3) as executor:
                results = list(
                    executor.map(
                        lambda match_id: self.get_player_match_detail(match_id, puuid),
                        match_history,
                    )
                )

            # 役割の使用率とチャンピオンの使用率を計算
            results = list(filter(None, results))
            role_proficiency, top_champs = self.calculate_role_proficiency(results)

            data = {
                "summoner_info": summoner_info,
                "rank_info": rank_info,
                "role_proficiency": role_proficiency,
                "top3_champs": top_champs,
            }

            # キャッシュに保存
            self._write_cache(summoner_name, data)
            return data

        except Exception:
            import traceback
            print(f"Error fetching data for {summoner_name}: {traceback.format_exc()}")
            return {}


def get_summoners_data(summoner_names: List[str]) -> List[Dict]:
    """複数のサモナーのデータを取得"""
    api_key = os.environ.get("RIOT_API_KEY")
    if not api_key:
        raise ValueError("RIOT_API_KEY environment variable is not set")

    riot_api = RiotAPI(api_key)
    summoners_data = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_name = {
            executor.submit(riot_api.get_summoner_data, name): name
            for name in summoner_names
        }

        for future in future_to_name:
            name = future_to_name[future]
            print(f"Fetching data for: {name}")
            try:
                result = future.result()
                if result:
                    print(f"Successfully fetched data for: {name}")
                    summoners_data.append(result)
                else:
                    print(f"No data found for: {name}")
            except Exception as e:
                print(f"Error fetching data for {name}: {str(e)}")

    return summoners_data

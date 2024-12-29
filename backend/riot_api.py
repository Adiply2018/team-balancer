import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

from ddragon import ChampionIconGenerator

load_dotenv()

RIOT_API_KEY = os.getenv("RIOT_API_KEY")


class RiotAPI:
    def __init__(self, api_key: str, cache_dir: Optional[str] = None):
        self.api_key = api_key
        self.headers = {"X-Riot-Token": self.api_key}
        self.region = "jp1"
        self.routing = "asia"

        # キャッシュの設定
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".riot_cache"
        self.cache_duration = timedelta(hours=24 * 7)  # キャッシュの有効期限
        self._init_cache_dir()

        self.ddragon_version = self.get_ddragon_version()
        self.ddragon = ChampionIconGenerator()

    def _init_cache_dir(self) -> None:
        """キャッシュディレクトリを初期化"""
        if not self.cache_dir.exists():
            self.cache_dir.mkdir(parents=True)

    def _get_cache_path(self, summoner_name: str) -> Path:
        """サモナー名からキャッシュファイルのパスを取得"""
        # サモナー名をファイル名として使用可能な形式に変換
        safe_name = summoner_name.replace("#", "_")
        return self.cache_dir / f"{safe_name}.json"

    def _read_cache(self, summoner_name: str) -> Optional[Dict]:
        """キャッシュからデータを読み込む"""
        cache_path = self._get_cache_path(summoner_name)
        if not cache_path.exists():
            return None

        try:
            with cache_path.open("r", encoding="utf-8") as f:
                cached_data = json.load(f)

            # キャッシュの有効期限をチェック
            cached_time = datetime.fromisoformat(cached_data["cached_at"])
            if datetime.now() - cached_time > self.cache_duration:
                return None

            return cached_data["data"]
        except (json.JSONDecodeError, KeyError, ValueError):
            return None

    def _write_cache(self, summoner_name: str, data: Dict) -> None:
        """データをキャッシュに書き込む"""
        cache_path = self._get_cache_path(summoner_name)
        cache_data = {"data": data, "cached_at": datetime.now().isoformat()}

        try:
            with cache_path.open("w", encoding="utf-8") as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"キャッシュの書き込みに失敗しました: {e}")

    def request(
        self, url: str, headers: Dict, params: Dict = {}, retry: int = 0
    ) -> requests.Response:
        """
        ratelimitなら待機してからリクエストを送信するラッパー関数
        """
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 429:
            print("Rate limit exceeded", retry)
            time.sleep(1 * 2**retry)
            return self.request(url, headers, params, retry + 1)
        return response

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

    def get_rank_info(self, encrypted_summoner_id: str) -> List[Dict]:
        """暗号化されたサモナーIDからランク情報を取得"""
        url = f"https://{self.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/{encrypted_summoner_id}"
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
        match_detail = self.get_match_detail(match_id)

        try:
            for participant in match_detail["info"]["participants"]:
                if participant["puuid"] == puuid:
                    return {
                        "champion_id": participant["championId"],
                        "champion": participant["championName"],
                        "role": participant["teamPosition"],
                    }
        except KeyError:
            print(f"Error processing match {match_id}")
            print(match_detail.keys())
        return None

    def calculate_role_proficiency(
        self, champ_roles: List[Dict]
    ) -> Tuple[Dict[str, int], List[Tuple[tuple, int]]]:
        """
        役割ごとの使用率を計算して0~5の整数で返す
        使用率が高いチャンピオンTOP３も返す
        """
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
        """
        サモナー名から各種データを取得してまとめて返す
        キャッシュがある場合はキャッシュから返す
        """
        # キャッシュをチェック
        try:
            cached_data = self._read_cache(summoner_name)
            if cached_data:
                print(f"キャッシュからデータを読み込みました: {summoner_name}")
                return cached_data

            # サモナー名とタグラインを分割
            sn, tagline = summoner_name.split("#")

            # アカウント情報を取得
            account_info = self.get_account(sn, tagline)
            puuid = account_info["puuid"]

            # サモナー情報を取得
            raw_summoner_info = self.get_summoner_info(puuid)
            encrypted_summoner_id = raw_summoner_info["id"]

            icon_num = raw_summoner_info["profileIconId"]
            summoner_info = {
                "name": summoner_name,
                "icon": f"https://ddragon.leagueoflegends.com/cdn/{self.ddragon_version}/img/profileicon/{icon_num}.png",
                "level": raw_summoner_info["summonerLevel"],
            }

            # ランク情報を取得
            raw_rank_info = self.get_rank_info(encrypted_summoner_id)
            rank_info = {"SOLO": "UNRANKED", "FLEX": "UNRANKED"}
            for rank_data in raw_rank_info:
                if rank_data["queueType"] == "RANKED_SOLO_5x5":
                    rank_info["SOLO"] = rank_data["tier"] + " " + rank_data["rank"]
                elif rank_data["queueType"] == "RANKED_FLEX_SR":
                    rank_info["FLEX"] = rank_data["tier"] + " " + rank_data["rank"]

            # マッチヒストリーを取得
            match_count = 15
            match_history = self.get_match_history(
                puuid, match_type="ranked", count=match_count
            )
            if len(match_history) < match_count:
                print("ランクマッチが足りません。通常マッチも含めて取得します。")
                match_history = self.get_match_history(puuid, count=match_count)

            # マッチ詳細を並列で取得
            with ThreadPoolExecutor() as executor:
                results = executor.map(
                    lambda match_id: self.get_player_match_detail(match_id, puuid),
                    match_history,
                )

            # Noneを除外して役割の使用率とチャンピオンの使用率を計算
            results = list(filter(None, results))
            role_proficiency, top_champs = self.calculate_role_proficiency(results)

            data = {
                "summoner_info": summoner_info,
                "rank_info": rank_info,
                "role_proficiency": role_proficiency,
                "top3_champs": top_champs,
            }

            # データをキャッシュに保存
            self._write_cache(summoner_name, data)
        except Exception as e:
            print(f"データ取得中にエラーが発生しました: {e}")
            return {}

        return data


def get_summoners_data(summoner_names: List[str]) -> List[Dict]:
    """複数のサモナーのデータを取得"""
    if not RIOT_API_KEY:
        raise ValueError("RIOT_API_KEYが設定されていません。")

    riot_api = RiotAPI(RIOT_API_KEY)

    summoners_data = []
    for summoner_name in summoner_names:
        result = riot_api.get_summoner_data(summoner_name)
        if result:
            print(f"データ取得成功!: {summoner_name}")
            summoners_data.append(result)
        else:
            print(f"データ取得失敗: {summoner_name}")
    return summoners_data


def main():
    # サモナーデータを取得
    summoner_names = [
    ]
    summoners_data = get_summoners_data(summoner_names)
    from pprint import pprint

    pprint(summoners_data)


# def main():
#    # APIキーを設定
#    riot_api = RiotAPI(RIOT_API_KEY)
#
#    # サモナーデータを取得

#    summoner_data = riot_api.get_summoner_data(summoner_name)
#    print(summoner_data)


if __name__ == "__main__":
    main()

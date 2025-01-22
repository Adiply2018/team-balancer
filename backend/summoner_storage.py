import random
import string
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import boto3


class SummonerStorage:
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table("summoner-storage")
        self.expiration_days = 14  # 2週間

    def _generate_passphrase(self, length: int = 6) -> str:
        """ランダムな合言葉を生成"""
        # 紛らわしい文字を除外
        characters = string.ascii_uppercase.replace("O", "").replace(
            "I", ""
        ) + string.digits.replace("0", "").replace("1", "")
        return "".join(random.choices(characters, k=length))

    def save_summoners(self, summoners: List[Dict]) -> Dict[str, str]:
        """サモナー情報を保存し、合言葉を返す"""
        # 合言葉を生成（既存の合言葉と重複しないようにチェック）
        while True:
            passphrase = self._generate_passphrase()
            try:
                self.table.get_item(Key={"passphrase": passphrase}, ConsistentRead=True)
            except self.dynamodb.meta.client.exceptions.ResourceNotFoundException:
                break

        # TTLを計算（2週間後）
        expiration_time = int(
            (datetime.now() + timedelta(days=self.expiration_days)).timestamp()
        )

        # データを保存
        self.table.put_item(
            Item={
                "passphrase": passphrase,
                "summoners": summoners,
                "created_at": int(time.time()),
                "ttl": expiration_time,
            }
        )

        return {"passphrase": passphrase, "expiresAt": expiration_time}

    def load_summoners(self, passphrase: str) -> Optional[List[Dict]]:
        """合言葉を使ってサモナー情報を読み込む"""
        try:
            response = self.table.get_item(
                Key={"passphrase": passphrase}, ConsistentRead=True
            )

            if "Item" not in response:
                return None

            item = response["Item"]

            # TTLチェック
            if item["ttl"] < int(time.time()):
                return None

            return item["summoners"]

        except Exception as e:
            print(f"Error loading summoners: {str(e)}")
            return None

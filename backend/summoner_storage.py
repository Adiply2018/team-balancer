import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import boto3
from logger import log


class SummonerStorage:
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table("summoner-storage")
        self.expiration_days = 14  # 2週間

    def save_summoners(self, summoners: List[Dict], passphrase: str) -> Dict[str, str]:
        """サモナー情報を保存し、合言葉を返す"""
        expiration_time = int(
            (datetime.now() + timedelta(days=self.expiration_days)).timestamp()
        )

        # データを保存
        result = self.table.put_item(
            Item={
                "passphrase": passphrase,
                "summoners": summoners,
                "created_at": int(time.time()),
                "ttl": expiration_time,
            }
        )
        log.info(f"Saved summoners data: {result}")

        return {"passphrase": passphrase, "expiresAt": expiration_time}

    def load_summoners(self, passphrase: str) -> Optional[List[Dict]]:
        """合言葉を使ってサモナー情報を読み込む"""
        log.info(f"Loading summoners data with passphrase: {passphrase}")
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
            log.error(f"Error loading summoners: {str(e)}")
            return None

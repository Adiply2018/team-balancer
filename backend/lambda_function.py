import json
import traceback
from typing import Any, Dict

from pydantic import ValidationError

from balance_logic import (
    Rank,
    RoleProficiency,
    Summoner,
    balance_teams,
    calculate_team_stats,
    normalize_rank_format,
)
from riot_api import get_summoners_data


def create_response(status_code: int, body: Any) -> Dict[str, Any]:
    """APIGatewayのレスポンス形式を作成"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def clean_control_chars(text: str) -> str:
    """制御文字をフィルタリング"""
    return "".join(char for char in text if char.isprintable())


def handle_summoners_request(body: Dict) -> Dict:
    """サモナー情報を取得するハンドラー"""
    try:
        summoner_names = body.get("summonerNames", [])
        cleaned_sn_list = [clean_control_chars(sn).strip() for sn in summoner_names]
        summoners_data = get_summoners_data(cleaned_sn_list)
        return create_response(200, summoners_data)
    except Exception as e:
        return create_response(500, {"error": str(e), "detail": traceback.format_exc()})


def handle_balance_teams_request(body: Dict) -> Dict:
    """チーム分けを行うハンドラー"""
    try:
        # 入力データのバリデーション
        summoners = []
        for s in body.get("summoners", []):
            rank_data = s.get("rank", {})
            role_data = s.get("roleProficiency", {})

            summoner = Summoner(
                id=s.get("id", ""),
                name=s.get("name", ""),
                rank=Rank(
                    combined=rank_data.get("combined", "UNRANKED"),
                    tier=rank_data.get("tier", "UNRANKED"),
                    division=rank_data.get("division", ""),
                ),
                roleProficiency=RoleProficiency(
                    TOP=role_data.get("TOP", 0),
                    JUNGLE=role_data.get("JUNGLE", 0),
                    MID=role_data.get("MID", 0),
                    BOT=role_data.get("BOT", 0),
                    SUPPORT=role_data.get("SUPPORT", 0),
                ),
                isSelected=s.get("isSelected", True),
            )
            summoners.append(summoner)

        randomness = float(body.get("randomness", 0.0))

        # ランク形式を標準化
        normalized_summoners = normalize_rank_format(summoners)

        # チーム分け実行
        team_a, team_b = balance_teams(normalized_summoners, randomness)

        # 各チームの統計を計算
        team_a_stats = calculate_team_stats(team_a)
        team_b_stats = calculate_team_stats(team_b)

        response_data = {
            "teamA": [s.dict() for s in team_a],
            "teamB": [s.dict() for s in team_b],
            "teamAStats": team_a_stats.dict(),
            "teamBStats": team_b_stats.dict(),
        }

        return create_response(200, response_data)

    except ValidationError as e:
        return create_response(400, {"error": "Invalid request data", "detail": str(e)})
    except ValueError as e:
        return create_response(400, {"error": str(e)})
    except Exception as e:
        return create_response(500, {"error": str(e), "detail": traceback.format_exc()})


def lambda_handler(event: Dict, context: Any) -> Dict:
    """Lambda関数のメインハンドラー"""
    # プリフライトリクエストの処理
    if event.get("httpMethod") == "OPTIONS":
        return create_response(200, {"message": "OK"})

    try:
        # リクエストボディの解析
        body = json.loads(event.get("body", "{}"))
        path = event.get("path", "")

        # パスに応じたハンドラーの呼び出し
        if path == "/api/summoners":
            return handle_summoners_request(body)
        elif path == "/api/balance-teams":
            return handle_balance_teams_request(body)
        else:
            return create_response(404, {"error": "Not Found"})

    except json.JSONDecodeError:
        return create_response(400, {"error": "Invalid JSON"})
    except Exception as e:
        return create_response(500, {"error": str(e), "detail": traceback.format_exc()})

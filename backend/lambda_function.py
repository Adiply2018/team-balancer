import decimal
import json
import traceback
from typing import Any, Dict, Union

from balance_logic import (
    Rank,
    RoleProficiency,
    Summoner,
    balance_teams,
    calculate_team_stats,
    normalize_rank_format,
    assign_roles_to_team,
)
from logger import log
from pydantic import ValidationError
from riot_api import get_summoners_data
from summoner_storage import SummonerStorage

# dotenv is only needed for local development
# In Lambda, environment variables are already loaded by AWS
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available in Lambda, which is fine


def handle_save_summoners(body: Dict) -> Dict:
    """サモナー情報を保存するハンドラー"""
    try:
        storage = SummonerStorage()
        summoners = body.get("summoners", [])

        log.info(f"Received summoners data: {json.dumps(summoners)}")

        if not summoners:
            return create_response(400, {"error": "No summoner data provided"})

        # 不要なフィールドの削除とデータの整形
        cleaned_summoners = []
        for summoner in summoners:
            cleaned_summoner = {
                "id": summoner.get("id"),
                "name": summoner.get("name"),
                "icon": summoner.get("icon"),
                "level": summoner.get("level"),
                "rank": summoner.get("rank"),
                "roleProficiency": summoner.get("roleProficiency"),
                "top3Champs": summoner.get("top3Champs", []),
                "isSelected": summoner.get("isSelected", True),
                "preferredRoles": summoner.get("preferredRoles", []),
            }
            cleaned_summoners.append(cleaned_summoner)

        result = storage.save_summoners(
            cleaned_summoners, passphrase=body.get("passphrase")
        )
        log.info(f"Saved summoners data: {json.dumps(result)}")
        return create_response(200, result)

    except Exception as e:
        log.error(f"Error in handle_save_summoners: {str(e)}")
        log.error(traceback.format_exc())  # スタックトレースを出力
        return create_response(500, {"error": str(e)})


def handle_load_summoners(body: Dict) -> Dict:
    """サモナー情報を読み込むハンドラー"""
    try:
        storage = SummonerStorage()
        passphrase = body.get("passphrase")
        if not passphrase:
            return create_response(400, {"error": "No passphrase provided"})

        log.debug(f"Loading summoners data with passphrase: {passphrase}")

        summoners = storage.load_summoners(passphrase)
        if summoners is None:
            return create_response(404, {"error": "Invalid or expired passphrase"})

        # Decimalを含むデータを通常の数値型に変換してからレスポンスを作成
        converted_data = {"summoners": summoners}
        return create_response(200, converted_data)

    except Exception as e:
        log.error(f"Error in handle_load_summoners: {traceback.format_exc()}")
        return create_response(500, {"error": str(e)})


def decimal_default(obj: Any) -> Union[float, str]:
    """JSONシリアライズ時のDecimal型の処理"""
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    raise TypeError


def create_response(status_code: int, body: Any) -> Dict[str, Any]:
    """APIGatewayのレスポンス形式を作成（CORS対応）"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        },
        "body": json.dumps(body, default=decimal_default),
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
                preferredRoles=s.get("preferredRoles", []),
            )
            summoners.append(summoner)

        randomness = float(body.get("randomness", 0.0))
        auto_assign_roles = body.get("autoAssignRoles", True)
        team_constraint_groups = body.get("teamConstraintGroups", [])

        # ランク形式を標準化
        normalized_summoners = normalize_rank_format(summoners)

        # チーム分け実行（チーム制約付き）
        team_a, team_b = balance_teams(
            normalized_summoners,
            randomness,
            team_constraint_groups
        )

        # ロール割り当て実行（トグルがONの場合のみ）
        if auto_assign_roles:
            team_a = assign_roles_to_team(team_a)
            team_b = assign_roles_to_team(team_b)

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
    if event.get("httpMethod") == "OPTIONS":
        return create_response(200, {"message": "OK"})

    try:
        try:
            body = json.loads(event.get("body", "{}"))
        # except json.JSONDecodeError:
        #    body = {}
        # except TypeError:
        #    body = {}
        except Exception:
            body = event.get("body")

        path = event.get("path", "")

        if path == "/api/summoners":
            return handle_summoners_request(body)
        elif path == "/api/balance-teams":
            return handle_balance_teams_request(body)
        elif path == "/api/save-summoners":
            return handle_save_summoners(body)
        elif path == "/api/load-summoners":
            return handle_load_summoners(body)
        elif path == "/api/health":
            return create_response(200, {"status": "ok"})
        else:
            return create_response(404, {"error": "Not Found"})

    except json.JSONDecodeError:
        return create_response(400, {"error": "Invalid JSON"})
    except Exception as e:
        return create_response(500, {"error": str(e)})

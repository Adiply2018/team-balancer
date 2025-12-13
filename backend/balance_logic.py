import random
from typing import Dict, List, Tuple
from pydantic import BaseModel
import pulp

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
    preferredRoles: List[str] = []  # 希望ロール
    assignedRole: str = None  # 割り当てられたロール

class ChampionStats(BaseModel):
    championName: str
    iconUrl: str
    count: int

class TeamStats(BaseModel):
    avgRank: str
    avgRankScore: float
    topRoles: Dict[str, int]
    commonChampions: List[ChampionStats]

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
        "MASTER": 28,
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
        return base_score + division_score
    return base_score

def calculate_team_stats(team: List[Summoner]) -> TeamStats:
    """チームの統計情報を計算"""
    if not team:
        return TeamStats(
            avgRank="UNRANKED",
            avgRankScore=0,
            topRoles={},
            commonChampions=[]
        )

    # 平均ランクスコアの計算
    rank_scores = [get_rank_score(s.rank.combined) for s in team]
    avg_rank_score = sum(rank_scores) / len(rank_scores)

    # 平均ランクの決定
    rank_boundaries = {
        31: ("CHALLENGER", None),
        30: ("GRANDMASTER", None),
        28: ("MASTER", None),
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

    # 得意ロールの集計
    top_roles = {"MID": 0, "TOP": 0, "JUNGLE": 0, "BOT": 0, "SUPPORT": 0}
    for member in team:
        for role, level in member.roleProficiency.dict().items():
            if level > 2:  # レベル3以上を得意とみなす
                top_roles[role] = top_roles.get(role, 0) + 1

    return TeamStats(
        avgRank=avg_rank,
        avgRankScore=avg_rank_score,
        topRoles=top_roles,
        commonChampions=[]  # チャンピオンデータは移行後の実装で追加予定
    )

def balance_teams(
    summoners: List[Summoner],
    randomness: float = 0.0
) -> Tuple[List[Summoner], List[Summoner]]:
    """チーム分け最適化（ランダム性付き）"""
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

    # 線形計画問題の設定
    prob = pulp.LpProblem("TeamBalancer", pulp.LpMinimize)
    x = pulp.LpVariable.dicts(
        "team_assignment",
        ((i, j) for i in range(10) for j in range(2)),
        cat="Binary"
    )

    # 制約条件1: 各プレイヤーは1つのチームのみに所属
    for i in range(10):
        prob += pulp.lpSum(x[i, j] for j in range(2)) == 1

    # 制約条件2: 各チーム5人
    for j in range(2):
        prob += pulp.lpSum(x[i, j] for i in range(10)) == 5

    # チーム間の差分計算
    rank_diff = pulp.lpSum(
        rank_scores[i] * x[i, 0] for i in range(10)
    ) - pulp.lpSum(rank_scores[i] * x[i, 1] for i in range(10))
    
    role_diff = pulp.lpSum(
        role_scores[i] * x[i, 0] for i in range(10)
    ) - pulp.lpSum(role_scores[i] * x[i, 1] for i in range(10))

    # 制約条件3: チーム間のランク差を制限
    rank_limit = 20 * (1 + noise_scale)
    prob += rank_diff <= rank_limit
    prob += rank_diff >= -rank_limit

    # 制約条件4: チーム間のロール習熟度差を制限
    role_limit = 10 * (1 + noise_scale)
    prob += role_diff <= role_limit
    prob += role_diff >= -role_limit

    # 目的関数のための補助変数
    rank_diff_pos = pulp.LpVariable("rank_diff_pos", 0)
    rank_diff_neg = pulp.LpVariable("rank_diff_neg", 0)
    role_diff_pos = pulp.LpVariable("role_diff_pos", 0)
    role_diff_neg = pulp.LpVariable("role_diff_neg", 0)

    prob += rank_diff == rank_diff_pos - rank_diff_neg
    prob += role_diff == role_diff_pos - role_diff_neg

    # 目的関数
    prob += (
        rank_diff_pos
        + rank_diff_neg
        + role_diff_pos
        + role_diff_neg
        + pulp.lpSum(
            random.gauss(0, noise_scale) * x[i, j]
            for i in range(10) for j in range(2)
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

        parts = summoner.rank.tier.split()
        if len(parts) == 2:
            tier = parts[0]
            division = parts[1]
            combined = f"{tier} {division}"

            summoner.rank.tier = tier
            summoner.rank.division = division
            summoner.rank.combined = combined

    return summoners

def assign_roles_to_team(team: List[Summoner]) -> List[Summoner]:
    """チームメンバーにロールを割り当て（線形計画法）"""
    if len(team) != 5:
        raise ValueError("Team must have exactly 5 members")

    roles = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"]
    n_players = len(team)

    # 線形計画問題の設定
    prob = pulp.LpProblem("RoleAssignment", pulp.LpMaximize)

    # 変数定義: x[i, j] = プレイヤーiがロールjに割り当てられるか（0 or 1）
    x = pulp.LpVariable.dicts(
        "assignment",
        ((i, j) for i in range(n_players) for j in range(5)),
        cat="Binary"
    )

    # スコア計算関数
    def get_assignment_score(player_idx: int, role_idx: int) -> float:
        """プレイヤーとロールの組み合わせのスコアを計算"""
        player = team[player_idx]
        role = roles[role_idx]

        # ベーススコア: ロール熟練度
        base_score = getattr(player.roleProficiency, role)

        # 希望ロールボーナス
        preference_bonus = 0
        if player.preferredRoles and role in player.preferredRoles:
            # 希望ロールの場合、大きなボーナス
            preference_bonus = 10
        elif player.preferredRoles and len(player.preferredRoles) > 0:
            # 希望ロールがあるが該当しない場合、ペナルティ
            preference_bonus = -5

        return base_score + preference_bonus

    # 制約条件1: 各プレイヤーは1つのロールのみ
    for i in range(n_players):
        prob += pulp.lpSum(x[i, j] for j in range(5)) == 1

    # 制約条件2: 各ロールに1人のみ
    for j in range(5):
        prob += pulp.lpSum(x[i, j] for i in range(n_players)) == 1

    # 目的関数: 総スコアを最大化
    prob += pulp.lpSum(
        get_assignment_score(i, j) * x[i, j]
        for i in range(n_players)
        for j in range(5)
    )

    # 最適化問題を解く
    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    # 結果を適用
    assigned_team = []
    for i in range(n_players):
        player = team[i]
        for j in range(5):
            if pulp.value(x[i, j]) == 1:
                player.assignedRole = roles[j]
                break
        assigned_team.append(player)

    return assigned_team

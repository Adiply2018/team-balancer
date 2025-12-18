export type Rank = {
  combined: string;
  tier: string;
  division: string;
};

export type Role = "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT";

export type RoleProficiency = {
  [key in Role]: number;
};

export type ChampInfo = [[string, string], number]; // [[champIcon, champName], count]

export type Summoner = {
  id: string;
  name: string;
  tag?: string;
  icon?: string;
  level?: number;
  rank: Rank;
  roleProficiency: RoleProficiency;
  top3Champs?: ChampInfo[];
  isSelected: boolean;
  preferredRoles?: Role[]; // 希望ロール（複数選択可能）
  assignedRole?: Role; // 割り当てられたロール
};

export interface ChampionStats {
  championName: string;
  iconUrl: string;
  count: number;
}

export interface TeamStats {
  avgRank: string;
  avgRankScore: number;
  topRoles: Record<string, number>;
  commonChampions: ChampionStats[];
}

export type SameTeamGroup = {
  id: string;
  summonerIds: string[];
};

export const RANKS = [
  { value: "CHALLENGER I", label: "Challenger", color: "text-yellow-700" },
  { value: "GRANDMASTER I", label: "Grandmaster", color: "text-red-500" },
  { value: "MASTER I", label: "Master", color: "text-purple-500" },
  { value: "DIAMOND I", label: "Diamond I", color: "text-blue-400" },
  { value: "DIAMOND II", label: "Diamond II", color: "text-blue-400" },
  { value: "DIAMOND III", label: "Diamond III", color: "text-blue-400" },
  { value: "DIAMOND IV", label: "Diamond IV", color: "text-blue-400" },
  { value: "EMERALD I", label: "Emerald I", color: "text-emerald-500" },
  { value: "EMERALD II", label: "Emerald II", color: "text-emerald-500" },
  { value: "EMERALD III", label: "Emerald III", color: "text-emerald-500" },
  { value: "EMERALD IV", label: "Emerald IV", color: "text-emerald-500" },
  { value: "PLATINUM I", label: "Platinum I", color: "text-cyan-400" },
  { value: "PLATINUM II", label: "Platinum II", color: "text-cyan-400" },
  { value: "PLATINUM III", label: "Platinum III", color: "text-cyan-400" },
  { value: "PLATINUM IV", label: "Platinum IV", color: "text-cyan-400" },
  { value: "GOLD I", label: "Gold I", color: "text-yellow-500" },
  { value: "GOLD II", label: "Gold II", color: "text-yellow-500" },
  { value: "GOLD III", label: "Gold III", color: "text-yellow-500" },
  { value: "GOLD IV", label: "Gold IV", color: "text-yellow-500" },
  {
    value: "SILVER I",
    label: "Silver I",
    color: "text-gray-700 dark:text-gray-300",
  },
  {
    value: "SILVER II",
    label: "Silver II",
    color: "text-gray-700 dark:text-gray-300",
  },
  {
    value: "SILVER III",
    label: "Silver III",
    color: "text-gray-700 dark:text-gray-300",
  },
  {
    value: "SILVER IV",
    label: "Silver IV",
    color: "text-gray-700 dark:text-gray-300",
  },
  { value: "BRONZE I", label: "Bronze I", color: "text-orange-800" },
  { value: "BRONZE II", label: "Bronze II", color: "text-orange-800" },
  { value: "BRONZE III", label: "Bronze III", color: "text-orange-800" },
  { value: "BRONZE IV", label: "Bronze IV", color: "text-orange-800" },
  {
    value: "IRON I",
    label: "Iron I",
    color: "text-gray-900 dark:text-gray-100",
  },
  {
    value: "IRON II",
    label: "Iron II",
    color: "text-gray-900 dark:text-gray-100",
  },
  {
    value: "IRON III",
    label: "Iron III",
    color: "text-gray-900 dark:text-gray-100",
  },
  {
    value: "IRON IV",
    label: "Iron IV",
    color: "text-gray-900 dark:text-gray-100",
  },
].reverse();

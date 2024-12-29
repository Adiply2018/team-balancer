import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Flag, Swords } from "lucide-react";
import { toast } from "sonner";
import { RANKS, type Summoner, type TeamStats } from "./types";
import TOP_ICON from "@/assets/Top_icon.webp";
import JUNGLE_ICON from "@/assets/Jungle_icon.webp";
import MID_ICON from "@/assets/Middle_icon.webp";
import BOT_ICON from "@/assets/Bottom_icon.webp";
import SUPPORT_ICON from "@/assets/Support_icon.webp";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

type TeamResultsProps = {
  teamA: Summoner[];
  teamB: Summoner[];
  teamAStats: TeamStats;
  teamBStats: TeamStats;
};

const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];

const laneIcons = {
  TOP: TOP_ICON,
  JUNGLE: JUNGLE_ICON,
  MID: MID_ICON,
  BOT: BOT_ICON,
  SUPPORT: SUPPORT_ICON,
};

const TeamResults = ({
  teamA,
  teamB,
  teamAStats,
  teamBStats,
}: TeamResultsProps) => {
  if (teamA.length === 0 && teamB.length === 0) return null;

  const formatDiscordText = () => {
    const formatTeam = (team: Summoner[], stats: TeamStats) => {
      const lines = team.map((s) => {
        const rankInfo = RANKS.find((r) => r.value === s.rank.combined);
        const roles = Object.entries(s.roleProficiency)
          .filter(([_, value]) => value > 2)
          .map(([role]) => role)
          .join("/");
        return `${s.name} (${rankInfo?.label || "Unranked"}${roles ? ` - ${roles}` : ""})`;
      });

      const statsLine = `平均ランク: ${stats.avgRank}`;
      const championsLine =
        stats.commonChampions.length > 0
          ? `よく使うチャンプ: ${stats.commonChampions.map((c) => c.championName).join(", ")}`
          : "";

      return [...lines, statsLine, championsLine].filter(Boolean).join("\n");
    };

    return `\`\`\`
チームA
${formatTeam(teamA, teamAStats)}

チームB
${formatTeam(teamB, teamBStats)}
\`\`\``;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formatDiscordText());
    toast.success("クリップボードにコピーしました！");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4" />
          <label className="text-sm font-medium">チーム分け結果</label>
        </div>
        <Button onClick={copyToClipboard} variant="outline" size="sm">
          <Copy className="h-4 w-4 mr-2" />
          Discord用にコピー
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { title: "A", team: teamA, stats: teamAStats },
          { title: "B", team: teamB, stats: teamBStats },
        ].map(({ title, team, stats }) => (
          <Card key={title} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle
                  className={`text-md flex ${title === "A" ? "text-red-500" : "text-blue-500"}`}
                >
                  <Flag className="h-5 w-5 mr-2" />
                  {title}
                </CardTitle>

                <HoverCard>
                  <HoverCardTrigger>
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={
                          RANKS.find((r) => r.value === stats.avgRank)?.color ||
                          "text-muted-foreground"
                        }
                      >
                        平均:{" "}
                        {RANKS.find((r) => r.value === stats.avgRank)?.label ||
                          stats.avgRank}
                      </span>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="font-medium">チーム統計</h4>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            RANKS.find((r) => r.value === stats.avgRank)
                              ?.color || "text-muted-foreground"
                          }
                        >
                          平均:{" "}
                          {RANKS.find((r) => r.value === stats.avgRank)
                            ?.label || stats.avgRank}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {ROLE_ORDER.map((role) => (
                          <div key={role} className="flex items-center gap-2">
                            <span className="text-muted-foreground w-6">
                              <img
                                src={laneIcons[role]}
                                alt={role}
                                className="w-6 h-6"
                              />
                            </span>
                            {role}
                            <span
                              className={
                                stats.topRoles[role]
                                  ? "text-primary"
                                  : "text-red-500"
                              }
                            >
                              ×{stats.topRoles[role] || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {team.map((summoner) => (
                  <div key={summoner.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {summoner.icon && (
                        <img
                          src={summoner.icon}
                          alt={`${summoner.name}'s icon`}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {summoner.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              RANKS.find(
                                (r) => r.value === summoner.rank.combined,
                              )?.color
                            }
                          >
                            {RANKS.find(
                              (r) => r.value === summoner.rank.combined,
                            )?.label || summoner.rank.combined}
                          </Badge>
                          <div className="flex gap-2 text-sm text-muted-foreground">
                            {Object.entries(summoner.roleProficiency)
                              .filter(([_, value]) => value > 2)
                              .map(([role, value]) => (
                                <img
                                  src={laneIcons[role]}
                                  alt={role}
                                  className="w-4 h-4"
                                />
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {summoner.top3Champs && summoner.top3Champs.length > 0 && (
                      <div className="flex gap-1 ml-10">
                        {summoner.top3Champs.map(
                          ([[champIcon, champName], count], index) => (
                            <TooltipProvider key={index}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-1">
                                    <img
                                      src={champIcon}
                                      alt={champName}
                                      className="w-6 h-6 rounded-full"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      ×{count}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{champName}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const roleLevelColors: Record<number, string> = {
  3: "text-green-500",
  4: "text-green-700",
  5: "text-blue-500",
};

export default TeamResults;

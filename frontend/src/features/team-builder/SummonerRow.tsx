import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Trash2, Star } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RANKS, type Summoner, type Role } from "./types";
import opggIcon from "../../assets/opgg-icon.png";
import deeplolIcon from "../../assets/deeplol-icon.png";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import TOP_ICON from "@/assets/Top_icon.webp";
import JUNGLE_ICON from "@/assets/Jungle_icon.webp";
import MID_ICON from "@/assets/Middle_icon.webp";
import BOT_ICON from "@/assets/Bottom_icon.webp";
import SUPPORT_ICON from "@/assets/Support_icon.webp";

type SummonerRowProps = {
  idx: number;
  summoner: Summoner;
  onInputChange: (summonerId: string, field: string, value: any) => void;
  onToggleSelection: (id: string) => void;
  onDelete: (id: string) => void;
};

const roleLevelColors: Record<number, string> = {
  0: "text-gray-500",
  1: "text-red-500",
  2: "text-yellow-500",
  3: "text-green-500",
  4: "text-green-700",
  5: "text-blue-500",
};

const laneIcons = {
  TOP: TOP_ICON,
  JUNGLE: JUNGLE_ICON,
  MID: MID_ICON,
  BOT: BOT_ICON,
  SUPPORT: SUPPORT_ICON,
};

export const SummonerRow = React.memo(
  ({
    idx,
    summoner,
    onInputChange,
    onToggleSelection,
    onDelete,
  }: SummonerRowProps) => {
    const [isPreferredRolesOpen, setIsPreferredRolesOpen] = useState(false);

    // サモナー名から name#tag を分離
    const [summonerName, summonerTag] = summoner.name.includes('#')
      ? summoner.name.split('#')
      : [summoner.name, summoner.tag || ''];

    const roles: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];

    const togglePreferredRole = (role: Role) => {
      const currentPreferred = summoner.preferredRoles || [];
      const newPreferred = currentPreferred.includes(role)
        ? currentPreferred.filter((r) => r !== role)
        : [...currentPreferred, role];
      onInputChange(summoner.id, "preferredRoles", newPreferred);
    };

    return (
      <TableRow
        className={`${!summoner.isSelected ? "line-through text-gray-500" : ""}`}
      >
        <TableCell>{idx}</TableCell>
        <TableCell>
          <Checkbox
            checked={summoner.isSelected}
            onCheckedChange={() => onToggleSelection(summoner.id)}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {summoner.icon && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <img
                      src={summoner.icon}
                      alt={`${summoner.name}'s icon`}
                      className="w-10 h-10 rounded-full mr-2"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Level {summoner.level}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div>
              <div className="flex gap-1 items-center">
                <span className="text-sm">
                  {summoner.level != 0 && `Lv.${summoner.level} `}
                </span>
                <span className="font-bold">{summoner.name}</span>
                <div className="flex gap-1 ml-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://www.op.gg/summoners/jp/${encodeURIComponent(summonerName)}${summonerTag ? `-${encodeURIComponent(summonerTag)}` : ""}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={opggIcon}
                            alt="OP.GG"
                            className="h-4 w-4 rounded-full"
                          />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>OP.GGで確認</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://www.deeplol.gg/summoner/jp/${encodeURIComponent(summonerName)}${summonerTag ? `-${encodeURIComponent(summonerTag)}` : ""}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={deeplolIcon}
                            alt="DeepLol.gg"
                            className="h-4 w-4 rounded-full"
                          />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>DeepLol.ggで確認</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              {summoner.top3Champs && summoner.top3Champs.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {summoner.top3Champs.map(
                    ([[champIcon, champName], count], index) => (
                      <TooltipProvider key={`${champName}-${index}`}>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-1">
                              <img
                                src={champIcon}
                                alt={champName}
                                className="w-6 h-6 rounded-full"
                              />
                              <span>×{count}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{champName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Select
            value={summoner.rank.combined}
            onValueChange={(value) => onInputChange(summoner.id, "rank", value)}
          >
            <SelectTrigger
              className={
                RANKS.find((r) => r.value === summoner.rank.combined)?.color ||
                ""
              }
            >
              <SelectValue placeholder="ソロランク" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNRANKED">Unranked</SelectItem>
              {RANKS.map((rank) => (
                <SelectItem
                  key={`${rank.value}-combined`}
                  value={rank.value}
                  className={rank.color}
                >
                  {rank.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        {(Object.keys(summoner.roleProficiency) as Role[]).map((role) => (
          <TableCell key={`${summoner.id}-${role}`}>
            <Select
              value={String(summoner.roleProficiency[role])}
              onValueChange={(value) =>
                onInputChange(summoner.id, `role_${role}`, value)
              }
            >
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <SelectItem
                    key={`${summoner.id}-${role}-${level}`}
                    value={String(level)}
                  >
                    <span className={roleLevelColors[level]}>
                      {String(level)}
                    </span>
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1 pointer-events-none">
                  0:ほぼやらない ～ 5:よくやる
                  <br />
                  ※サモナー情報を取得で、
                  <br />
                  直近10試合から自動判定
                </div>
              </SelectContent>
            </Select>
          </TableCell>
        ))}
        <TableCell>
          <Dialog open={isPreferredRolesOpen} onOpenChange={setIsPreferredRolesOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Star className={`h-4 w-4 ${summoner.preferredRoles && summoner.preferredRoles.length > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                {summoner.preferredRoles && summoner.preferredRoles.length > 0 && (
                  <span className="ml-1 text-xs">{summoner.preferredRoles.length}</span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>希望ロール選択</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  希望するロールを選択してください（複数選択可）
                </p>
                {roles.map((role) => {
                  const isSelected = summoner.preferredRoles?.includes(role) || false;
                  return (
                    <div
                      key={role}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary cursor-pointer"
                      onClick={() => togglePreferredRole(role)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePreferredRole(role)}
                      />
                      <img
                        src={laneIcons[role]}
                        alt={role}
                        className="w-8 h-8"
                      />
                      <span className="font-medium">{role}</span>
                      <Badge variant="outline" className="ml-auto">
                        Lv.{summoner.roleProficiency[role]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(summoner.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  },
);

SummonerRow.displayName = "SummonerRow";

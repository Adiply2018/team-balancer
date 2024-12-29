import React from "react";
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
import { Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RANKS, type Summoner, type Role } from "./types";

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

export const SummonerRow = React.memo(
  ({
    idx,
    summoner,
    onInputChange,
    onToggleSelection,
    onDelete,
  }: SummonerRowProps) => {
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
              <div className="flex gap-1">
                <span className="text-sm">
                  {summoner.level != 0 && `Lv.${summoner.level} `}
                </span>
                <span className="font-bold">{summoner.name}</span>
              </div>
              {summoner.top3Champs && summoner.top3Champs.length > 0 && (
                <div className="flex gap-1 mt-1">
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
                  key={rank.value}
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
          <TableCell key={role}>
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
                  <SelectItem key={level} value={String(level)}>
                    <span className={roleLevelColors[level]}>
                      {String(level)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
        ))}
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

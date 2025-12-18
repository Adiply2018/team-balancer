import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X, Plus, Users, UserX } from "lucide-react";
import type { Summoner, TeamConstraintGroup, TeamConstraintType } from "@/features/team-builder/types";

interface DevModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summoners: Summoner[];
  teamConstraintGroups: TeamConstraintGroup[];
  onTeamConstraintGroupsChange: (groups: TeamConstraintGroup[]) => void;
}

export function DevModal({
  open,
  onOpenChange,
  summoners,
  teamConstraintGroups,
  onTeamConstraintGroupsChange,
}: DevModalProps) {
  const [selectedSummoners, setSelectedSummoners] = useState<string[]>([]);
  const [constraintType, setConstraintType] = useState<TeamConstraintType>("same");

  const handleToggleSummoner = (summonerId: string) => {
    setSelectedSummoners((prev) =>
      prev.includes(summonerId)
        ? prev.filter((id) => id !== summonerId)
        : [...prev, summonerId]
    );
  };

  const handleAddGroup = () => {
    if (selectedSummoners.length < 2) {
      alert("少なくとも2人のサモナーを選択してください");
      return;
    }

    if (constraintType === "opposite" && selectedSummoners.length !== 2) {
      alert("違うチーム制約は2人の場合のみ有効です");
      return;
    }

    const newGroup: TeamConstraintGroup = {
      id: `group_${Date.now()}`,
      summonerIds: [...selectedSummoners],
      type: constraintType,
    };

    onTeamConstraintGroupsChange([...teamConstraintGroups, newGroup]);
    setSelectedSummoners([]);
    setConstraintType("same");
  };

  const handleRemoveGroup = (groupId: string) => {
    onTeamConstraintGroupsChange(teamConstraintGroups.filter((g) => g.id !== groupId));
  };

  const getSummonerName = (summonerId: string) => {
    return summoners.find((s) => s.id === summonerId)?.name || summonerId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🔧 開発者メニュー</DialogTitle>
          <DialogDescription>
            サモナーのチーム制約を設定
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* サモナー選択セクション */}
          <div>
            <h3 className="text-sm font-medium mb-3">
              サモナーを選択
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded p-3">
              {summoners.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  サモナーが登録されていません
                </p>
              ) : (
                summoners.map((summoner) => (
                  <div key={summoner.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={summoner.id}
                      checked={selectedSummoners.includes(summoner.id)}
                      onCheckedChange={() => handleToggleSummoner(summoner.id)}
                    />
                    <label
                      htmlFor={summoner.id}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {summoner.name || `サモナー ${summoner.id}`}
                    </label>
                  </div>
                ))
              )}
            </div>

            {/* 制約タイプ選択 */}
            <div className="mt-4 space-y-3 border rounded p-3 bg-secondary/20">
              <Label className="text-sm font-medium">制約タイプを選択</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="same"
                    name="constraintType"
                    value="same"
                    checked={constraintType === "same"}
                    onChange={(e) => setConstraintType(e.target.value as TeamConstraintType)}
                    className="cursor-pointer"
                  />
                  <Label htmlFor="same" className="cursor-pointer flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    同じチームにする（2人以上）
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="opposite"
                    name="constraintType"
                    value="opposite"
                    checked={constraintType === "opposite"}
                    onChange={(e) => setConstraintType(e.target.value as TeamConstraintType)}
                    disabled={selectedSummoners.length !== 2}
                    className="cursor-pointer"
                  />
                  <Label
                    htmlFor="opposite"
                    className={`cursor-pointer flex items-center gap-2 ${
                      selectedSummoners.length !== 2 ? "opacity-50" : ""
                    }`}
                  >
                    <UserX className="h-4 w-4" />
                    違うチームにする（2人のみ）
                  </Label>
                </div>
              </div>
            </div>

            <Button
              onClick={handleAddGroup}
              disabled={
                selectedSummoners.length < 2 ||
                (constraintType === "opposite" && selectedSummoners.length !== 2)
              }
              className="mt-3 w-full"
              variant="secondary"
            >
              <Plus className="mr-2 h-4 w-4" />
              制約を追加 ({selectedSummoners.length}人選択中)
            </Button>
          </div>

          {/* 制約リストセクション */}
          <div>
            <h3 className="text-sm font-medium mb-3">登録済み制約</h3>
            {teamConstraintGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded p-3">
                制約が登録されていません
              </p>
            ) : (
              <div className="space-y-2">
                {teamConstraintGroups.map((group, index) => (
                  <div
                    key={group.id}
                    className="flex items-start justify-between border rounded p-3 bg-secondary/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {group.type === "same" ? (
                          <Users className="h-4 w-4 text-blue-500" />
                        ) : (
                          <UserX className="h-4 w-4 text-orange-500" />
                        )}
                        <p className="text-sm font-medium">
                          {group.type === "same" ? "同じチーム" : "違うチーム"} #{index + 1}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {group.summonerIds
                          .map((id) => getSummonerName(id))
                          .join(", ")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveGroup(group.id)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

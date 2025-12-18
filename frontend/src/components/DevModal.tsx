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
import { X, Plus } from "lucide-react";
import type { Summoner, SameTeamGroup } from "@/features/team-builder/types";

interface DevModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summoners: Summoner[];
  sameTeamGroups: SameTeamGroup[];
  onSameTeamGroupsChange: (groups: SameTeamGroup[]) => void;
}

export function DevModal({
  open,
  onOpenChange,
  summoners,
  sameTeamGroups,
  onSameTeamGroupsChange,
}: DevModalProps) {
  const [selectedSummoners, setSelectedSummoners] = useState<string[]>([]);

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

    const newGroup: SameTeamGroup = {
      id: `group_${Date.now()}`,
      summonerIds: [...selectedSummoners],
    };

    onSameTeamGroupsChange([...sameTeamGroups, newGroup]);
    setSelectedSummoners([]);
  };

  const handleRemoveGroup = (groupId: string) => {
    onSameTeamGroupsChange(sameTeamGroups.filter((g) => g.id !== groupId));
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
            特定のサモナーを同じチームにする設定
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* サモナー選択セクション */}
          <div>
            <h3 className="text-sm font-medium mb-3">
              同じチームにするサモナーを選択
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
            <Button
              onClick={handleAddGroup}
              disabled={selectedSummoners.length < 2}
              className="mt-3 w-full"
              variant="secondary"
            >
              <Plus className="mr-2 h-4 w-4" />
              グループを追加 ({selectedSummoners.length}人選択中)
            </Button>
          </div>

          {/* グループリストセクション */}
          <div>
            <h3 className="text-sm font-medium mb-3">登録済みグループ</h3>
            {sameTeamGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded p-3">
                グループが登録されていません
              </p>
            ) : (
              <div className="space-y-2">
                {sameTeamGroups.map((group, index) => (
                  <div
                    key={group.id}
                    className="flex items-start justify-between border rounded p-3 bg-secondary/50"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">
                        グループ {index + 1}
                      </p>
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

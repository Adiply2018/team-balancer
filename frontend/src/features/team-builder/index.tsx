import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import MOMONGA_ICON from "@/assets/momonga.png";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swords, Users, Plus } from "lucide-react";
import { toast } from "sonner";
import { SummonerRow } from "./SummonerRow";
import { type Summoner, type Role, RANKS } from "./types";
import TeamResults from "./TeamResults";
import RandomnessSlider from "@/components/ui/randomness-slider";
import { Slider } from "@/components/ui/slider";
import { FireworksDisplay } from "@/components/ui/fireworks";

let idCounter = 1;
const generateId = () => `id_${String(idCounter++).padStart(2, "0")}`;

const createEmptySummoner = (id: string): Summoner => ({
  id,
  name: "",
  icon: "",
  level: 0,
  rank: { combined: "UNRANKED", tier: "UNRANKED", division: "" },
  roleProficiency: {
    TOP: 0,
    JUNGLE: 0,
    MID: 0,
    BOT: 0,
    SUPPORT: 0,
  },
  top3Champs: [],
  isSelected: false,
});

const TeamBalancer = () => {
  const [summoners, setSummoners] = useState<Summoner[]>([]);
  const [lobbyInput, setLobbyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [newSummonerName, setNewSummonerName] = useState("");
  const [teamA, setTeamA] = useState<Summoner[]>([]);
  const [teamB, setTeamB] = useState<Summoner[]>([]);
  const [teamAStats, setTeamAStats] = useState(null);
  const [teamBStats, setTeamBStats] = useState(null);
  const [randomness, setRandomness] = useState([0]);
  const [showFireworks, setShowFireworks] = useState(false);

  const selectedCount = useMemo(
    () => summoners.filter((s) => s.isSelected).length,
    [summoners],
  );

  const lobbySample =
    "ふぇいかー#JP1がロビーに参加しました\nしょうめいかー#JP1がロビーに参加しました\nたーざん#JP1がロビーに参加しました";

  // Unicode制御文字を削除する関数
  const cleanControlChars = (str: string) => {
    str = str.trim();
    const charsToRemove = [
      "\u2066", // LEFT-TO-RIGHT ISOLATE
      "\u2067", // RIGHT-TO-LEFT ISOLATE
      "\u2068", // FIRST STRONG ISOLATE
      "\u2069", // POP DIRECTIONAL ISOLATE
    ];
    return charsToRemove.reduce(
      (acc, char) => acc.replace(new RegExp(char, "g"), ""),
      str,
    );
  };

  const handleLobbyPaste = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = event.target.value;
      setLobbyInput(text);
      const joinMessage = "がロビーに参加しました";

      const names = text
        .split("\n")
        .filter((line) => line.includes(joinMessage))
        .map((line) => line.split(joinMessage)[0])
        .map(cleanControlChars) // ここでUnicode制御文字を削除
        .filter((name, index, self) => self.indexOf(name) === index);

      const existingNames = new Set(summoners.map((s) => s.name));
      const newNames = names.filter((name) => !existingNames.has(name));

      if (newNames.length > 0) {
        setSummoners((prev) => [
          ...prev,
          ...newNames.map((name) => ({
            ...createEmptySummoner(generateId()),
            name,
            isSelected: selectedCount < 10,
          })),
        ]);
      }
    },
    [summoners, selectedCount],
  );

  const toggleSummonerSelection = useCallback((id: string) => {
    setSummoners((prev) => {
      const currentSelected = prev.filter((s) => s.isSelected).length;
      const summoner = prev.find((s) => s.id === id);

      if (summoner?.isSelected === false && currentSelected >= 10) {
        toast.warning("チーム分けのためには10人までしか選択できません。");
        return prev;
      }

      return prev.map((s) =>
        s.id === id ? { ...s, isSelected: !s.isSelected } : s,
      );
    });
  }, []);

  const handleAddNewSummoner = useCallback(() => {
    if (!newSummonerName.trim()) return;
    const clean_new_sn = cleanControlChars(newSummonerName);

    setSummoners((prev) => {
      if (prev.some((s) => s.name === clean_new_sn)) {
        toast.warning("既に同じサモナー名が存在します。");
        return prev;
      }

      return [
        ...prev,
        {
          ...createEmptySummoner(generateId()),
          name: clean_new_sn,
          isSelected: selectedCount < 10,
        },
      ];
    });

    setNewSummonerName("");
  }, [newSummonerName, selectedCount]);

  const handleInputChange = useCallback(
    (summonerId: string, field: string, value: any) => {
      setSummoners((prev) =>
        prev.map((summoner) => {
          if (summoner.id !== summonerId) return summoner;

          if (field === "rank") {
            const [tier, division] = value.split("_");
            return {
              ...summoner,
              rank: {
                combined: value,
                tier,
                division: division || "",
              },
            };
          } else {
            const role = field.split("_")[1] as Role;
            return {
              ...summoner,
              roleProficiency: {
                ...summoner.roleProficiency,
                [role]: Number(value),
              },
            };
          }
        }),
      );
    },
    [],
  );

  const deleteSummoner = useCallback((id: string) => {
    setSummoners((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const fetchSummonersData = useCallback(async () => {
    const selectedSummoners = summoners.filter((s) => s.isSelected);
    if (selectedSummoners.length === 0) {
      toast.error("少なくとも1人のサモナーを選択してください。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        "https://2hkuubvqk5.execute-api.ap-northeast-1.amazonaws.com/prod/api/summoners",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summonerNames: selectedSummoners.map((s) => s.name),
          }),
        },
      );

      if (!response.ok) throw new Error("APIリクエストに失敗しました");

      const data = await response.json();
      setSummoners((prev) =>
        prev.map((summoner) => {
          const updatedData = data.find(
            (d) => d.summoner_info.name === summoner.name,
          );
          if (!updatedData) return summoner;

          const highestRank =
            updatedData.rank_info.SOLO !== "UNRANKED"
              ? updatedData.rank_info.SOLO
              : updatedData.rank_info.FLEX;

          return {
            ...summoner,
            icon: updatedData.summoner_info.icon,
            level: updatedData.summoner_info.level,
            rank: {
              combined: highestRank,
              tier: highestRank.split("_")[0] || "UNRANKED",
              division: highestRank.split("_")[1] || "",
            },
            roleProficiency: {
              TOP: updatedData.role_proficiency.TOP || 0,
              JUNGLE: updatedData.role_proficiency.JUNGLE || 0,
              MID: updatedData.role_proficiency.MIDDLE || 0,
              BOT: updatedData.role_proficiency.BOTTOM || 0,
              SUPPORT: updatedData.role_proficiency.UTILITY || 0,
            },
            top3Champs: updatedData.top3_champs,
          };
        }),
      );

      toast.success("サモナー情報を更新しました。");
    } catch (error) {
      console.error("Error fetching summoner data:", error);
      toast.error("サモナー情報の取得に失敗しました。");
    }
    setLoading(false);
  }, [summoners]);

  const balanceTeams = useCallback(async () => {
    const selectedSummoners = summoners.filter((s) => s.isSelected);
    if (selectedSummoners.length !== 10) {
      toast.error("チーム分けには10人のサモナーを選択する必要があります。");
      return;
    }

    // すでにsummonersのデータが最新なので、selectedSummonersをそのまま使用
    const updatedSummoners = selectedSummoners;

    setLoading(true);
    try {
      const response = await fetch(
        "https://2hkuubvqk5.execute-api.ap-northeast-1.amazonaws.com/prod/api/balance-teams",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summoners: updatedSummoners,
            randomness: randomness[0],
          }),
        },
      );

      if (!response.ok) throw new Error("チーム分けに失敗しました");

      const {
        teamA: newTeamA,
        teamB: newTeamB,
        teamAStats: newTeamAStats,
        teamBStats: newTeamBStats,
      } = await response.json();
      console.log(newTeamAStats);
      console.log(newTeamBStats);
      setTeamA(newTeamA);
      setTeamB(newTeamB);
      setTeamAStats(newTeamAStats);
      setTeamBStats(newTeamBStats);
      setSummoners((prev) =>
        prev.map((s) => {
          const updated = updatedSummoners.find((us) => us.id === s.id);
          return updated || s;
        }),
      );

      toast.success("チーム分けが完了しました。");

      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 100);
    } catch (error) {
      console.error("Error balancing teams:", error);
      toast.error("チーム分けに失敗しました。");
    }
    setLoading(false);
  }, [summoners]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img
            src={MOMONGA_ICON}
            alt="MOMONGA"
            className="w-10 h-10 rounded-full"
          />
          LoL Team Balancer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              カスタムロビーメッセージ
            </label>
            <Textarea
              placeholder={lobbySample}
              value={lobbyInput}
              onChange={handleLobbyPaste}
              className="h-32"
            />
          </div>

          <TeamResults
            teamA={teamA}
            teamB={teamB}
            teamAStats={teamAStats}
            teamBStats={teamBStats}
          />

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                onClick={fetchSummonersData}
                disabled={loading || selectedCount === 0}
              >
                <Users className="mr-2 h-4 w-4" />
                サモナー情報を取得
              </Button>
              <Button
                onClick={balanceTeams}
                disabled={loading || selectedCount !== 10}
                variant="secondary"
              >
                <Swords className="mr-2 h-4 w-4" />
                チーム分け実行 ({
                  selectedCount
                }/10)
              </Button>

              <div>
                <label className="block text-xs font-medium mb-2">
                  チーム分けのランダム性 ({randomness}%)
                </label>
                <Slider
                  max={100}
                  min={0}
                  step={1}
                  value={randomness}
                  onValueChange={setRandomness}
                  className="w-48"
                />
              </div>
            </div>

            <FireworksDisplay trigger={showFireworks} />
            <div className="flex gap-2">
              <Input
                value={newSummonerName}
                onChange={(e) => setNewSummonerName(e.target.value)}
                placeholder="サモナー名を入力(Enterで追加)"
                className="w-48"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddNewSummoner();
                }}
              />
              <Button onClick={handleAddNewSummoner}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No.</TableHead>
                <TableHead className="w-12">選択</TableHead>
                <TableHead>サモナー名</TableHead>
                <TableHead className="w-48">ランク</TableHead>
                <TableHead>TOP</TableHead>
                <TableHead>JG</TableHead>
                <TableHead>MID</TableHead>
                <TableHead>BOT</TableHead>
                <TableHead>SUP</TableHead>
                <TableHead className="w-12">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summoners.map((summoner) => (
                <SummonerRow
                  idx={summoners.indexOf(summoner) + 1}
                  key={summoner.id}
                  summoner={summoner}
                  onInputChange={handleInputChange}
                  onToggleSelection={toggleSummonerSelection}
                  onDelete={deleteSummoner}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamBalancer;

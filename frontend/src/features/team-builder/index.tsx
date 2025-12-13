import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import MOMONGA_ICON from "@/assets/momonga.png";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swords, Users, Plus, Settings, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SummonerRow } from "./SummonerRow";
import { type Summoner, type Role, RANKS } from "./types";
import TeamResults from "./TeamResults";
import { Slider } from "@/components/ui/slider";
import { FireworksDisplay } from "@/components/ui/fireworks";
import ThemeSwitcher from "@/components/theme-toggle";
import { SummonerStorage } from "./SummonerStorage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

let idCounter = 1;
const generateId = () => `sid_${String(idCounter++).padStart(2, "0")}`;

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
  preferredRoles: [],
  assignedRole: undefined,
});

const TeamBalancer = () => {
  const [summoners, setSummoners] = useState<Summoner[]>([]);
  const [lobbyInput, setLobbyInput] = useState("");
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isBalancingTeams, setIsBalancingTeams] = useState(false);
  const [newSummonerName, setNewSummonerName] = useState("");
  const [teamA, setTeamA] = useState<Summoner[]>([]);
  const [teamB, setTeamB] = useState<Summoner[]>([]);
  const [teamAStats, setTeamAStats] = useState(null);
  const [teamBStats, setTeamBStats] = useState(null);
  const [randomness, setRandomness] = useState([0]);
  const [showFireworks, setShowFireworks] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [currentFetchingPlayer, setCurrentFetchingPlayer] = useState("");

  const selectedCount = useMemo(
    () => summoners.filter((s) => s.isSelected).length,
    [summoners],
  );

  const lobbySample =
    "ふぇいかー#JP1がロビーに参加しました\nしょうめいかー#JP1がロビーに参加しました\nたーざん#JP1がロビーに参加しました";

  const cleanControlChars = (str: string) => {
    str = str.trim();
    const charsToRemove = ["\u2066", "\u2067", "\u2068", "\u2069"];
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
        .map(cleanControlChars)
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
          } else if (field === "preferredRoles") {
            return {
              ...summoner,
              preferredRoles: value,
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

    setIsFetchingData(true);
    setFetchProgress(0);
    setCurrentFetchingPlayer("");

    try {
      const totalPlayers = selectedSummoners.length;
      const fetchedData: any[] = [];

      // 各サモナーを個別に取得
      for (let i = 0; i < selectedSummoners.length; i++) {
        const summoner = selectedSummoners[i];
        setCurrentFetchingPlayer(summoner.name);
        setFetchProgress(Math.round((i / totalPlayers) * 100));

        try {
          const response = await fetch(
            "https://2hkuubvqk5.execute-api.ap-northeast-1.amazonaws.com/prod/api/summoners",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                summonerNames: [summoner.name],
              }),
            },
          );

          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              fetchedData.push(data[0]);
            }
          }
        } catch (error) {
          console.error(`Error fetching ${summoner.name}:`, error);
        }
      }

      // 完了
      setFetchProgress(100);
      setCurrentFetchingPlayer("");

      // データを更新
      setSummoners((prev) =>
        prev.map((summoner) => {
          const updatedData = fetchedData.find(
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
    } finally {
      setIsFetchingData(false);
      setFetchProgress(0);
      setCurrentFetchingPlayer("");
    }
  }, [summoners]);

  const balanceTeams = useCallback(async () => {
    console.log("summoners", summoners);
    const selectedSummoners = summoners.filter((s) => s.isSelected);
    if (selectedSummoners.length !== 10) {
      toast.error("チーム分けには10人のサモナーを選択する必要があります。");
      return;
    }

    const updatedSummoners = selectedSummoners;

    setIsBalancingTeams(true);
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
    setIsBalancingTeams(false);
  }, [summoners, randomness]);

  const handleLoadSummoners = useCallback((loadedSummoners: Summoner[]) => {
    setSummoners(loadedSummoners);
  }, []);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <img
            src={MOMONGA_ICON}
            alt="MOMONGA"
            className="w-10 h-10 rounded-full"
          />
          <h1 className="text-2xl font-bold">LoLカスタムチーム分けツール</h1>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsInfoOpen(true)}
          >
            <Info className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="h-5 w-5" />
          </Button>
          <ThemeSwitcher />
        </div>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>設定</DialogTitle>
          </DialogHeader>
          <p className="mb-1">サモナー情報の保存/読み込み</p>
          <ul className="ml-6 list-disc mb-1">
            <li className="text-muted-foreground text-sm">
              6文字の合言葉を入力して保存/読み込みを行います
            </li>
            <li className="text-muted-foreground text-sm">
              保存してから2週間で期限切れになります
            </li>
          </ul>

          <SummonerStorage
            summoners={summoners}
            onLoadSummoners={handleLoadSummoners}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>使い方</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold mb-2">サモナーの追加方法</h3>
              <p>1. カスタムロビーメッセージを貼り付け</p>
              <p className="text-sm text-muted-foreground ml-4">
                -
                ロビーのチャットメッセージを入力欄に貼り付けると自動的にサモナーが追加されます
              </p>
              <p>2. 手動での追加</p>
              <p className="text-sm text-muted-foreground ml-4">
                - 画面右上の入力欄にサモナー名を入力し、Enterキーで追加できます
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">チーム分けの手順</h3>
              <p>1. サモナーの選択（10名必要）</p>
              <p className="text-sm text-muted-foreground ml-4">
                - 追加したサモナーから10名を選択します -
                「サモナー情報を取得」ボタンで選択したサモナーの情報を更新します
              </p>
              <p>2. チーム分けの実行</p>
              <p className="text-sm text-muted-foreground ml-4">
                - 10名選択後、「チーム分け実行」ボタンをクリックします -
                ランダム性スライダーでチーム分けのランダム性を0-100%で調整できます
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">その他の機能</h3>
              <ul className="text-sm text-muted-foreground ml-4 space-y-1">
                <li>- サモナー情報の保存/読み込みが可能です</li>
                <li>- 各サモナーのランクやロール熟練度を手動で調整できます</li>
                <li>
                  -
                  チーム分け結果は自動的に表示され、両チームの統計も確認できます
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            カスタムロビーメッセージ
          </label>
          <Textarea
            placeholder={lobbySample}
            value={lobbyInput}
            onChange={handleLobbyPaste}
            className="h-32 min-w-[300px]"
          />
        </div>

        <TeamResults
          teamA={teamA}
          teamB={teamB}
          teamAStats={teamAStats}
          teamBStats={teamBStats}
        />

        {isFetchingData && fetchProgress > 0 && (
          <div className="mb-4 p-4 border rounded-lg bg-secondary/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                サモナー情報取得中...
              </span>
              <span className="text-sm text-muted-foreground">
                {fetchProgress}%
              </span>
            </div>
            <Progress value={fetchProgress} className="h-2 mb-2" />
            {currentFetchingPlayer && (
              <p className="text-xs text-muted-foreground">
                取得中: {currentFetchingPlayer}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-2">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
              <Button
                onClick={fetchSummonersData}
                disabled={isFetchingData || isBalancingTeams || selectedCount === 0}
                variant="secondary"
              >
                {isFetchingData ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                サモナー情報を取得
              </Button>
              <Button
                onClick={balanceTeams}
                disabled={isFetchingData || isBalancingTeams || selectedCount !== 10}
                variant="secondary"
              >
                {isBalancingTeams ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Swords className="mr-2 h-4 w-4" />
                )}
                チームを分ける ({
                  selectedCount
                }/10)
              </Button>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-2">
                チーム分けのランダム性 ({randomness}%)
              </label>
              <Slider
                max={100}
                min={0}
                step={1}
                value={randomness}
                onValueChange={setRandomness}
                className="w-full sm:w-48"
              />
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <Input
              value={newSummonerName}
              onChange={(e) => setNewSummonerName(e.target.value)}
              placeholder="サモナー追加(Enterで追加)"
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddNewSummoner();
              }}
            />
          </div>
        </div>

        <FireworksDisplay trigger={showFireworks} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No.</TableHead>
              <TableHead className="w-12">選択</TableHead>
              <TableHead className="min-w-48">サモナー名</TableHead>
              <TableHead className="w-32">ランク</TableHead>
              <TableHead>TOP</TableHead>
              <TableHead>JG</TableHead>
              <TableHead>MID</TableHead>
              <TableHead>BOT</TableHead>
              <TableHead>SUP</TableHead>
              <TableHead className="w-16">希望</TableHead>
              <TableHead className="w-12">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summoners.map((summoner, index) => (
              <SummonerRow
                idx={index + 1}
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
    </div>
  );
};

export default TeamBalancer;

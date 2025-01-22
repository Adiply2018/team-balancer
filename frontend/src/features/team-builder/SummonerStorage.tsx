import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, Save, Upload } from "lucide-react";

interface StorageProps {
  summoners: any[];
  onLoadSummoners: (summoners: any[]) => void;
}

export const SummonerStorage: React.FC<StorageProps> = ({
  summoners,
  onLoadSummoners,
}) => {
  const [passphrase, setPassphrase] = useState(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newPassphrase = [...passphrase];
    newPassphrase[index] = value.toUpperCase();
    setPassphrase(newPassphrase);

    // 次の入力欄にフォーカス
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };
  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !passphrase[index] && index > 0) {
      // 空欄でBackspaceが押された場合、前の入力欄にフォーカス
      inputRefs.current[index - 1]?.focus();
    }
  };
  const handleSave = async () => {
    if (summoners.length === 0) {
      toast.error("保存するサモナー情報がありません。");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        passphrase: passphrase.join(""),
        summoners: summoners.map((s) => ({
          id: s.id,
          name: s.name,
          icon: s.icon,
          level: s.level,
          rank: s.rank,
          roleProficiency: s.roleProficiency,
          top3Champs: s.top3Champs,
          isSelected: s.isSelected,
        })),
      };
      console.log("payload", payload);

      const response = await fetch(
        "https://2hkuubvqk5.execute-api.ap-northeast-1.amazonaws.com/prod/api/save-summoners",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error("保存に失敗しました");

      const data = await response.json();
      const expires = new Date(data.expiresAt * 1000).toLocaleDateString();

      toast.success(
        <div className="space-y-2">
          <p>サモナー情報を保存しました！</p>
          <p className="text-sm">
            合言葉:{" "}
            <span className="font-mono font-bold">{data.passphrase}</span>
          </p>
          <p className="text-xs text-muted-foreground">有効期限: {expires}</p>
        </div>,
      );
    } catch (error) {
      toast.error("保存に失敗しました。");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async () => {
    if (!passphrase.join("")) {
      toast.error("合言葉を入力してください。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        "https://2hkuubvqk5.execute-api.ap-northeast-1.amazonaws.com/prod/api/load-summoners",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passphrase: passphrase.join("") }),
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          toast.error("無効または期限切れの合言葉です。");
          return;
        }
        throw new Error("読み込みに失敗しました");
      }

      const { summoners: loadedSummoners } = await response.json();
      onLoadSummoners(loadedSummoners);
      toast.success("サモナー情報を読み込みました！");
      setPassphrase(Array(6).fill(""));
    } catch (error) {
      toast.error("読み込みに失敗しました。");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="">
      <div className="flex gap-1 mb-2">
        {Array(6)
          .fill(0)
          .map((_, index) => (
            <Input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              value={passphrase[index]}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-10 h-10 text-center uppercase text-lg"
              maxLength={1}
            />
          ))}
      </div>
      <div className="flex gap-1 justify-end">
        <Button
          onClick={handleLoad}
          disabled={passphrase.join("").length !== 6 || loading}
          variant="secondary"
        >
          <Download className="mr-2 h-4 w-4 text-blue-400" />
          ロード
        </Button>
        <Button
          onClick={handleSave}
          disabled={
            summoners.length === 0 || passphrase.join("").length < 6 || loading
          }
          variant="secondary"
        >
          <Save className="mr-2 h-4 w-4 text-green-400" />
          セーブ
        </Button>
      </div>
    </div>
  );
};

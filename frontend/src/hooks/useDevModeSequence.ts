import { useRef, useCallback } from "react";

interface UseDevModeSequenceOptions {
  onSequenceComplete: () => void;
  timeout?: number; // デフォルト3秒
}

export function useDevModeSequence({
  onSequenceComplete,
  timeout = 3000,
}: UseDevModeSequenceOptions) {
  const iconClickCountRef = useRef(0);
  const themeClickCountRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const phaseRef = useRef<"icon" | "theme">("icon");

  // フェーズ1: アイコン4回クリック、フェーズ2: テーマ切替2回クリック
  const requiredIconClicks = 4;
  const requiredThemeClicks = 2;

  const resetSequence = useCallback(() => {
    iconClickCountRef.current = 0;
    themeClickCountRef.current = 0;
    phaseRef.current = "icon";
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      console.debug("開発者モードシーケンスタイムアウト");
      resetSequence();
    }, timeout);
  }, [timeout, resetSequence]);

  // タイトル横アイコンクリックハンドラ
  const handleIconClick = useCallback(() => {
    if (phaseRef.current !== "icon") {
      // フェーズが違う場合はリセットしてやり直し
      resetSequence();
    }

    iconClickCountRef.current += 1;
    startTimer();
    console.debug(
      `アイコンクリック: ${iconClickCountRef.current}/${requiredIconClicks}`
    );

    if (iconClickCountRef.current >= requiredIconClicks) {
      phaseRef.current = "theme";
      themeClickCountRef.current = 0;
      console.debug(
        "フェーズ2開始 - テーマ切替を2回クリックしてください"
      );
    }
  }, [resetSequence, startTimer]);

  // テーマ切替クリックハンドラ
  const handleThemeClick = useCallback(() => {
    if (phaseRef.current !== "theme") return;

    themeClickCountRef.current += 1;
    startTimer();
    console.debug(
      `テーマクリック: ${themeClickCountRef.current}/${requiredThemeClicks}`
    );

    if (themeClickCountRef.current >= requiredThemeClicks) {
      console.debug("開発者モードシーケンス完了！");
      onSequenceComplete();
      resetSequence();
    }
  }, [onSequenceComplete, resetSequence, startTimer]);

  return {
    handleIconClick,
    handleThemeClick,
  };
}

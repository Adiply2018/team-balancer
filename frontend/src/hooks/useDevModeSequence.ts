import { useEffect, useRef, useCallback } from "react";

interface UseDevModeSequenceOptions {
  onSequenceComplete: () => void;
  timeout?: number; // デフォルト3秒
}

export function useDevModeSequence({
  onSequenceComplete,
  timeout = 3000,
}: UseDevModeSequenceOptions) {
  const clickCountRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  // 必要なクリック回数: テーマ切替を4回
  const requiredClicks = 4;

  const resetSequence = useCallback(() => {
    clickCountRef.current = 0;
    isActiveRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const checkSequence = useCallback(() => {
    if (clickCountRef.current === requiredClicks) {
      console.debug("開発者モードシーケンス完了！");
      onSequenceComplete();
      resetSequence();
    }
  }, [onSequenceComplete, resetSequence]);

  // Ctrl+Shift+F のキーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        isActiveRef.current = true;
        clickCountRef.current = 0;

        // 3秒のタイムアウトを設定
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          console.debug("開発者モードシーケンスタイムアウト");
          resetSequence();
        }, timeout);

        console.debug("開発者モードシーケンス開始 - テーマ切替を4回クリックしてください");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeout, resetSequence]);

  // テーマ切替クリックハンドラ
  const handleThemeClick = useCallback(() => {
    if (!isActiveRef.current) return;

    clickCountRef.current += 1;
    console.debug(
      `テーマクリック: ${clickCountRef.current}/${requiredClicks}`
    );

    checkSequence();
  }, [checkSequence]);

  return {
    handleThemeClick,
  };
}

import { useEffect } from "react";

interface HttpRedirectProps {
  httpUrl?: string;
  children: React.ReactNode;
}

export const HttpRedirect: React.FC<HttpRedirectProps> = ({
  httpUrl,
  children,
}) => {
  useEffect(() => {
    // ブラウザ環境でのみ実行
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";

      if (isHttps) {
        const currentUrl = window.location.href;
        // HTTPSからHTTPへの変換
        const httpRedirectUrl =
          httpUrl || currentUrl.replace("https:", "http:");

        // リダイレクト実行
        window.location.href = httpRedirectUrl;
      }
    }
  }, [httpUrl]);

  return <>{children}</>;
};

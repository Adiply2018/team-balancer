import { useEffect } from "react";

interface HttpsRedirectProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export const HttpRedirect: React.FC<HttpsRedirectProps> = ({
  children,
  enabled = true,
}) => {
  useEffect(() => {
    if (typeof window !== "undefined" && enabled) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      const search = window.location.search;

      // HTTPSからHTTPへのリダイレクト
      if (protocol === "https:") {
        const httpUrl = `http://${hostname}${pathname}${search}`;
        window.location.replace(httpUrl);
      }
    }
  }, [enabled]);

  return <>{children}</>;
};

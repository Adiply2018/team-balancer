import { Toaster } from "sonner";
import TeamBalancer from "./features/team-builder";
import { Root } from "@radix-ui/react-slot";
import RootLayout from "./components/layouts/root";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function App() {
  return (
    <>
      <RootLayout>
        <div className="p-4 space-y-4">
          <TeamBalancer />

          {window.location.protocol === "http:" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                httpsでも動くようになったのでなんでもおっけ〜！
              </AlertTitle>
              <AlertDescription>
                <a
                  href="https://momongapp.site"
                  className="underline hover:text-blue-500"
                >
                  https://momongapp.site
                </a>
              </AlertDescription>
            </Alert>
          )}
          <Toaster position="bottom-right" />
        </div>
      </RootLayout>
    </>
  );
}

export default App;

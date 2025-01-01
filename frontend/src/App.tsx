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
        <div className="container mx-auto p-4 space-y-4">
          <TeamBalancer />

          {window.location.protocol === "https:" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                大人の理由(怠惰)によりhttpsだと動かないので、httpでアクセスしてください。
              </AlertTitle>
              <AlertDescription>
                <a
                  href="http://momongapp.site"
                  className="underline hover:text-blue-500"
                >
                  http://momongapp.site
                </a>
              </AlertDescription>
            </Alert>
          )}
          <Toaster position="top-right" />
        </div>
      </RootLayout>
    </>
  );
}

export default App;

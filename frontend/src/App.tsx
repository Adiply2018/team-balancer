import { Toaster } from "sonner";
import TeamBalancer from "./features/team-builder";
import { Root } from "@radix-ui/react-slot";
import RootLayout from "./components/layouts/root";

function App() {
  return (
    <>
      <RootLayout>
        <div className="container mx-auto p-4 space-y-4">
          <TeamBalancer />
          <Toaster position="top-right" />
        </div>
      </RootLayout>
    </>
  );
}

export default App;

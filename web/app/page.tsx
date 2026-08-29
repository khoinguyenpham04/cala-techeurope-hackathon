import { AppShell } from "@/components/chat/app-shell";
import { NewChat } from "@/components/chat/new-chat";
import { SkyConsole } from "@/components/sky/sky-console";

export default function HomePage() {
  return (
    <AppShell>
      <SkyConsole>
        <NewChat density="pane" />
      </SkyConsole>
    </AppShell>
  );
}

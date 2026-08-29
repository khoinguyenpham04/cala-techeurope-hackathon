import { AppShell } from "@/components/chat/app-shell";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { SkyConsole } from "@/components/sky/sky-console";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <SkyConsole>
        <ChatWorkspace density="pane" sessionId={id} />
      </SkyConsole>
    </AppShell>
  );
}

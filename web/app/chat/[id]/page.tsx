import { AppShell } from "@/components/chat/app-shell";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <ChatWorkspace sessionId={id} />
    </AppShell>
  );
}

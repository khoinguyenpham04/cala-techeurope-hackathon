import { SiteHeader } from "@/components/site-header";
import { AppShell } from "@/components/chat/app-shell";
import { NewChat } from "@/components/chat/new-chat";

export default function HomePage() {
  return (
    <AppShell>
      <SiteHeader title="New chat" />
      <NewChat />
    </AppShell>
  );
}

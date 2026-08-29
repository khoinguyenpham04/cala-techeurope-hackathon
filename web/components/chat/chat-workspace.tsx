"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { ChatComposer } from "@/components/chat/composer";
import { ModelChip } from "@/components/chat/model-picker";
import { Transcript } from "@/components/chat/transcript";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toDeliveredImages } from "@/lib/attachments";
import { chatTitle, saveSession, useChatSessions } from "@/lib/sessions";
import { cn } from "@/lib/utils";
import { useFlueAgent } from "@flue/react";
import { useEffect } from "react";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

const statusToChat: Record<string, ChatStatus> = {
  connecting: "submitted",
  submitted: "submitted",
  streaming: "streaming",
  idle: "ready",
  error: "error",
};

export function ChatWorkspace({ sessionId }: { sessionId: string }) {
  const agent = useFlueAgent({ url: `/api/agents/assistant/${sessionId}` });

  // The sidebar entry for this conversation, read reactively from the session
  // store; recovered from the first user message when the chat was started on
  // another device (saveSession notifies the store, which re-renders us).
  const sessions = useChatSessions();
  const session = sessions.find((entry) => entry.id === sessionId);
  useEffect(() => {
    if (session || !agent.historyReady) return;
    const first = agent.messages.find((message) => message.role === "user");
    const text = first?.parts.find((part) => part.type === "text")?.text;
    if (!text) return;
    saveSession({ id: sessionId, title: chatTitle(text), createdAt: Date.now() });
  }, [session, agent.historyReady, agent.messages, sessionId]);

  const chatStatus = statusToChat[agent.status] ?? "ready";
  const working = chatStatus === "submitted" || chatStatus === "streaming";

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text?.trim() ?? "";
    const images = toDeliveredImages(message.files);
    if ((!text && images.length === 0) || working) return;
    void agent.sendMessage(
      text || "See the attached image.",
      images.length ? { images } : undefined,
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          className="h-4 data-vertical:self-auto"
          orientation="vertical"
        />
        <h1 className="min-w-0 flex-1 truncate font-semibold text-sm">
          {session?.title ?? "New chat"}
        </h1>
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "size-2 rounded-full",
              working && "animate-pulse bg-amber-500",
              chatStatus === "ready" && "bg-emerald-500",
              chatStatus === "error" && "bg-red-500",
            )}
          />
          <span className="text-muted-foreground">
            {working ? "Thinking" : chatStatus === "error" ? "Error" : "Ready"}
          </span>
        </span>
      </header>

      {agent.error && (
        <div className="border-b bg-destructive/10 px-6 py-2 text-destructive text-sm">
          {agent.error.message}
        </div>
      )}

      <Transcript messages={agent.messages} status={agent.status} />

      <div className="border-t px-6 py-4">
        <ChatComposer
          className="mx-auto max-w-3xl"
          onSubmit={handleSubmit}
          status={chatStatus}
          textareaProps={{
            disabled: !agent.historyReady,
            placeholder: "Message the assistant...",
          }}
          tools={session?.model ? <ModelChip modelId={session.model} /> : undefined}
        />
      </div>
    </div>
  );
}

"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { ChatComposer } from "@/components/chat/composer";
import { EffortChip } from "@/components/chat/effort-picker";
import { ModelChip } from "@/components/chat/model-picker";
import { Transcript } from "@/components/chat/transcript";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSkySelection } from "@/components/sky/sky-context";
import { toDeliveredImages } from "@/lib/attachments";
import { agentUrlForSession } from "@/lib/cala";
import { cityFromSession } from "@/lib/geo/cities";
import {
  chatTitle,
  saveSession,
  sessionKindFromId,
  useChatSessions,
} from "@/lib/sessions";
import { cn } from "@/lib/utils";
import { useFlueAgent } from "@flue/react";
import { useEffect, useLayoutEffect, useRef } from "react";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

const statusToChat: Record<string, ChatStatus> = {
  connecting: "submitted",
  submitted: "submitted",
  streaming: "streaming",
  idle: "ready",
  error: "error",
};

export function ChatWorkspace({
  sessionId,
  compact = false,
  density = "page",
}: {
  sessionId: string;
  compact?: boolean;
  density?: "page" | "pane";
}) {
  const kind = sessionKindFromId(sessionId);
  const agent = useFlueAgent({ url: agentUrlForSession(sessionId, kind) });

  // The sidebar entry for this conversation, read reactively from the session
  // store; recovered from the first user message when the chat was started on
  // another device (saveSession notifies the store, which re-renders us).
  const sessions = useChatSessions();
  const session = sessions.find((entry) => entry.id === sessionId);
  const satellite = kind === "satellite" || session?.kind === "satellite";
  const sky = useSkySelection();
  const restoredSession = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!sky || !session || !satellite) return;
    if (restoredSession.current === session.id) return;
    restoredSession.current = session.id;
    const city = cityFromSession(session.city);
    if (city) sky.setCityId(city.id);
    if (session.noradId) sky.setNoradId(session.noradId);
  }, [session, satellite, sky]);

  useEffect(() => {
    if (session || !agent.historyReady) return;
    const first = agent.messages.find((message) => message.role === "user");
    const text = first?.parts.find((part) => part.type === "text")?.text;
    if (!text) return;
    saveSession({
      id: sessionId,
      title: chatTitle(text),
      createdAt: Date.now(),
      kind,
    });
  }, [session, agent.historyReady, agent.messages, sessionId, kind]);

  const chatStatus = statusToChat[agent.status] ?? "ready";
  const working = chatStatus === "submitted" || chatStatus === "streaming";
  const pane = compact || density === "pane";

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
      <header
        className={cn(
          "flex items-center gap-3 border-b py-3",
          pane ? "px-3" : "px-4 lg:px-6",
        )}
      >
        {!pane && <SidebarTrigger className="-ml-1" />}
        {!pane && (
          <Separator
            className="h-4 data-vertical:self-auto"
            orientation="vertical"
          />
        )}
        <h1 className="min-w-0 flex-1 truncate font-semibold text-sm">
          {session?.title ?? (satellite ? "Satellite" : "New chat")}
        </h1>
        {session?.noradId && (
          <Badge variant="outline" className="font-mono text-[10px]">
            NORAD {session.noradId}
          </Badge>
        )}
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
        <div className="border-b bg-destructive/10 px-4 py-2 text-destructive text-sm">
          {agent.error.message}
        </div>
      )}

      <Transcript
        density={pane ? "pane" : "page"}
        emptyDescription={
          satellite
            ? "Answers come only from cited Cala evidence."
            : "Send a message to begin."
        }
        emptyTitle={satellite ? "Ask this satellite" : "Start the conversation"}
        messages={agent.messages}
        status={agent.status}
      />

      <div className={cn("border-t py-4", pane ? "px-3" : "px-6")}>
        <ChatComposer
          className={pane ? "w-full" : "mx-auto max-w-3xl"}
          onSubmit={handleSubmit}
          status={chatStatus}
          textareaProps={{
            disabled: !agent.historyReady,
            placeholder: satellite
              ? "Ask who owns this satellite..."
              : "Message the assistant...",
          }}
          tools={
            session?.model || session?.thinking ? (
              <>
                {session.model ? <ModelChip modelId={session.model} /> : null}
                {session.thinking ? (
                  <EffortChip thinking={session.thinking} />
                ) : null}
              </>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}

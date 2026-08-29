"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { ChatComposer } from "@/components/chat/composer";
import { Transcript } from "@/components/chat/transcript";
import { SkyStoryCanvas } from "@/components/sky/sky-story-canvas-lazy";
import { useSkySelection } from "@/components/sky/sky-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toDeliveredImages } from "@/lib/attachments";
import { agentUrlForSession, dossierFromMessage } from "@/lib/cala";
import { cityFromSession } from "@/lib/geo/cities";
import {
  chatTitle,
  saveSession,
  sessionKindFromId,
  useChatSessions,
} from "@/lib/sessions";
import type { StoryObjectIdentity } from "@/lib/sky/story-page";
import { cn } from "@/lib/utils";
import { useFlueAgent, type FlueConversationMessage } from "@flue/react";
import { createFlueClient } from "@flue/sdk";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

function latestByRole(
  messages: FlueConversationMessage[],
  role: FlueConversationMessage["role"],
): FlueConversationMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === role) return message;
  }
  return undefined;
}

function textOf(message: FlueConversationMessage | undefined): string | null {
  if (!message) return null;
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
  return text || null;
}

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
  const url = agentUrlForSession(sessionId, kind);
  const agent = useFlueAgent({ url });

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
  const [showLog, setShowLog] = useState(false);

  const objectIdentity = useMemo((): StoryObjectIdentity | null => {
    if (sky?.satellite) {
      return { noradId: sky.satellite.noradId, name: sky.satellite.name };
    }
    if (session?.noradId) {
      return {
        noradId: session.noradId,
        name: session.satelliteName ?? `NORAD ${session.noradId}`,
      };
    }
    return null;
  }, [session?.noradId, session?.satelliteName, sky?.satellite?.name, sky?.satellite?.noradId]);

  const dossier = useMemo(() => {
    for (let index = agent.messages.length - 1; index >= 0; index -= 1) {
      const found = dossierFromMessage(agent.messages[index]!);
      if (found) return found;
    }
    return null;
  }, [agent.messages]);

  const { userPrompt, lessonText, lessonStreaming } = useMemo(() => {
    const user = latestByRole(agent.messages, "user");
    const assistant = latestByRole(agent.messages, "assistant");
    return {
      userPrompt: textOf(user),
      lessonText: textOf(assistant),
      lessonStreaming:
        working ||
        Boolean(
          assistant?.parts.some(
            (part) =>
              (part.type === "text" || part.type === "reasoning") &&
              part.state === "streaming",
          ),
        ),
    };
  }, [agent.messages, working]);

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text?.trim() ?? "";
    const images = toDeliveredImages(message.files);
    if (working) {
      // PromptInput clears the draft on a sync return; throw so Enter during
      // a reply keeps what the user typed for the next turn.
      throw new Error("Reply still in progress.");
    }
    if (!text && images.length === 0) return;
    void agent.sendMessage(
      text || "See the attached image.",
      images.length ? { images } : undefined,
    );
  }

  const handleStop = useCallback(() => {
    // Relative URLs resolve in the browser; creating the client at render
    // would throw during SSR ("relative url requires a browser").
    void createFlueClient({ url }).abort();
  }, [url]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header
        className={cn(
          "flex shrink-0 items-center gap-3 border-b py-3",
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
          {session?.title ?? (satellite ? "Evidence brief" : "Investigation")}
        </h1>
        {session?.noradId && (
          <Badge variant="outline" className="font-mono text-[10px]">
            NORAD {session.noradId}
          </Badge>
        )}
        {pane ? (
          <Button
            aria-pressed={showLog}
            className="shrink-0"
            onClick={() => setShowLog((open) => !open)}
            size="xs"
            variant={showLog ? "secondary" : "ghost"}
          >
            Log
          </Button>
        ) : null}
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
            {working ? "Verifying" : chatStatus === "error" ? "Unavailable" : "Grounded"}
          </span>
        </span>
      </header>

      {agent.error && (
        <div className="shrink-0 border-b bg-destructive/10 px-4 py-2 text-destructive text-sm">
          {agent.error.message}
        </div>
      )}

      {pane && !showLog ? (
        <SkyStoryCanvas
          dossier={dossier}
          lessonStreaming={lessonStreaming}
          lessonText={lessonText}
          noradId={session?.noradId ?? sky?.noradId}
          overlay={sky?.overlay}
          satellite={objectIdentity}
          userPrompt={userPrompt}
        />
      ) : (
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
      )}

      <div
        className={cn(
          "shrink-0 border-t bg-background py-3",
          pane ? "px-3" : "px-6 py-4",
        )}
      >
        <ChatComposer
          className="w-full"
          onStop={working ? handleStop : undefined}
          onSubmit={handleSubmit}
          status={chatStatus}
          textareaProps={{
            disabled: !agent.historyReady,
            placeholder: satellite
              ? "Ask what Cala can verify about this object..."
              : "Ask a sourced question...",
          }}
        />
      </div>
    </div>
  );
}

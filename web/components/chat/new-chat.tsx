"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatComposer } from "@/components/chat/composer";
import { EffortPicker } from "@/components/chat/effort-picker";
import { ModelPicker } from "@/components/chat/model-picker";
import { Badge } from "@/components/ui/badge";
import { toDeliveredImages } from "@/lib/attachments";
import { useSkySelection } from "@/components/sky/sky-context";
import {
  agentUrlForSession,
  type SatelliteChatContext,
} from "@/lib/cala";
import { DEFAULT_MODEL, DEFAULT_THINKING } from "@/lib/models";
import {
  chatTitle,
  newSessionId,
  satelliteChatTitle,
  saveSession,
  type ChatKind,
} from "@/lib/sessions";
import { cn } from "@/lib/utils";
import { createFlueClient } from "@flue/sdk";
import { OrbitIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Explain how React Server Components work",
  "Draft a friendly out-of-office email",
  "Plan a weekend itinerary for Lisbon",
  "Compare SQLite and Postgres for a side project",
  "Write a regex that matches ISO 8601 dates",
];

const SATELLITE_SUGGESTIONS = [
  "Who operates this satellite?",
  "What is the ultimate parent company?",
  "Which country is it associated with?",
  "What is it used for?",
  "Has the operator raised funding recently?",
];

export function NewChat({
  satellite: satelliteProp,
  compact = false,
  density,
  onStarted,
}: {
  satellite?: SatelliteChatContext;
  /** Right-pane density. Preferred by Sky Console. */
  compact?: boolean;
  density?: "page" | "pane";
  /** If set, the starter stays in-pane instead of routing to `/chat/[id]`. */
  onStarted?: (sessionId: string) => void;
}) {
  const router = useRouter();
  const sky = useSkySelection();
  const pane = compact || density === "pane";
  const satellite =
    satelliteProp ??
    (sky?.satellite
      ? {
          noradId: sky.satellite.noradId,
          name: sky.satellite.name,
          city: sky.city.name,
        }
      : undefined);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [thinking, setThinking] = useState(DEFAULT_THINKING);
  const [sending, setSending] = useState(false);
  const satelliteMode = Boolean(satellite?.noradId);
  const waitingForSelection = pane && Boolean(sky) && !satelliteMode;
  const suggestions = satelliteMode ? SATELLITE_SUGGESTIONS : pane ? [] : SUGGESTIONS;

  async function startChat(message: PromptInputMessage) {
    const body = message.text?.trim() ?? "";
    const images = toDeliveredImages(message.files);
    if ((!body && images.length === 0) || sending) return;
    if (satelliteMode && !satellite?.noradId) return;
    setSending(true);
    const kind: ChatKind = satelliteMode ? "satellite" : "assistant";
    const session = {
      id: newSessionId(kind),
      title: satelliteMode
        ? satelliteChatTitle({ name: satellite?.name, noradId: satellite!.noradId })
        : chatTitle(body || "Image"),
      model,
      thinking,
      createdAt: Date.now(),
      kind,
      noradId: satellite?.noradId,
      satelliteName: satellite?.name,
      constellation: satellite?.constellation,
      city: satellite?.city,
    };
    try {
      const client = createFlueClient({
        url: agentUrlForSession(session.id, kind),
      });
      await client.send({
        message: {
          kind: "user",
          body: body || "See the attached image.",
          ...(images.length ? { attachments: images } : {}),
        },
        initialData: satelliteMode
          ? {
              noradId: satellite!.noradId,
              name: satellite?.name,
              constellation: satellite?.constellation,
              city: satellite?.city,
              model,
              thinking,
            }
          : { model, thinking },
      });
      saveSession(session);
      if (onStarted) onStarted(session.id);
      else router.push(`/chat/${session.id}`);
      if (!onStarted) {
        // Stay in `sending` until navigation unmounts this screen.
      } else {
        setSending(false);
      }
    } catch (cause) {
      setSending(false);
      toast.error((cause as Error).message || "Could not start the chat.");
      throw cause; // keeps the draft and attachments for a retry
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        pane ? "px-3 py-3" : "items-center justify-center gap-6 px-6",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-col gap-2",
          pane
            ? "flex-1 items-start justify-center text-left"
            : "items-center text-center",
        )}
      >
        {!pane && (
          <div className="flex size-12 items-center justify-center rounded-xl border bg-muted">
            {satelliteMode ? (
              <OrbitIcon className="size-6 text-primary" />
            ) : (
              <SparklesIcon className="size-6 text-primary" />
            )}
          </div>
        )}
        <h1
          className={cn(
            "font-semibold tracking-tight",
            pane ? "text-base" : "text-2xl",
          )}
        >
          {waitingForSelection
            ? "Select a satellite"
            : satelliteMode
            ? satellite?.name
              ? `Ask about ${satellite.name}`
              : `Ask about NORAD ${satellite?.noradId}`
            : "How can I help you today?"}
        </h1>
        {satelliteMode && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono">
              NORAD {satellite?.noradId}
            </Badge>
            {satellite?.constellation ? (
              <Badge variant="secondary">{satellite.constellation}</Badge>
            ) : null}
            {satellite?.city ? (
              <Badge variant="outline">{satellite.city}</Badge>
            ) : null}
          </div>
        )}
        <p className="max-w-md text-muted-foreground text-sm">
          {waitingForSelection
            ? "Click a payload on the globe, or send a message to start a chat."
            : satelliteMode
              ? "Answers come only from cited Cala evidence. Unknown stays unknown."
              : "Ask anything. Conversations are saved in the sidebar and replay when you come back."}
        </p>
      </div>
      <div
        className={cn(
          "flex w-full shrink-0 flex-col gap-3",
          pane ? "max-w-none pt-3" : "max-w-2xl",
        )}
      >
        <ChatComposer
          onSubmit={startChat}
          status={sending ? "submitted" : "ready"}
          textareaProps={{
            autoFocus: !pane,
            placeholder: satelliteMode
              ? "Ask who owns this satellite..."
              : waitingForSelection
                ? "Message the assistant, or select a satellite..."
                : "Ask anything...",
          }}
          tools={
            <>
              <ModelPicker onChange={setModel} value={model} />
              <EffortPicker onChange={setThinking} value={thinking} />
            </>
          }
        />
        {suggestions.length > 0 && (
          <Suggestions className={pane ? undefined : "mx-auto"}>
            {suggestions.map((suggestion) => (
              <Suggestion
                disabled={sending}
                key={suggestion}
                onClick={(value) => {
                  void startChat({ text: value, files: [] }).catch(() => {
                    // already surfaced as a toast
                  });
                }}
                suggestion={suggestion}
              />
            ))}
          </Suggestions>
        )}
      </div>
    </div>
  );
}

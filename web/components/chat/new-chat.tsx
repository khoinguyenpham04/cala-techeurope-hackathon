"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatComposer } from "@/components/chat/composer";
import { SkyStoryCanvas } from "@/components/sky/sky-story-canvas-lazy";
import { useSkySelection } from "@/components/sky/sky-context";
import { Badge } from "@/components/ui/badge";
import { toDeliveredImages } from "@/lib/attachments";
import {
  agentUrlForSession,
  type SatelliteChatContext,
} from "@/lib/cala";
import { overlayFor } from "@/lib/orbit/overlay";
import { DEFAULT_MODEL, DEFAULT_THINKING } from "@/lib/models";
import { packForSatellite } from "@/lib/sky/sat-pack";
import {
  chatTitle,
  newSessionId,
  satelliteChatTitle,
  saveSession,
  type ChatKind,
} from "@/lib/sessions";
import { cn } from "@/lib/utils";
import { createFlueClient } from "@flue/sdk";
import { OrbitIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const SATELLITE_SUGGESTIONS = [
  "Why was this built?",
  "When was this built? What’s the history?",
  "What is it used for?",
];

export function NewChat({
  satellite: satelliteProp,
  compact = false,
  density,
  onStarted,
}: {
  satellite?: SatelliteChatContext;
  /** Right-pane density. Preferred by Skyla. */
  compact?: boolean;
  density?: "page" | "pane";
  /** If set, the starter stays in-pane instead of routing to `/chat/[id]`. */
  onStarted?: (sessionId: string) => void;
}) {
  const router = useRouter();
  const sky = useSkySelection();
  const pane = compact || density === "pane";
  const satellite = (() => {
    const base =
      satelliteProp ??
      (sky?.satellite
        ? {
            noradId: sky.satellite.noradId,
            name: sky.satellite.name,
            city: sky.city.name,
          }
        : undefined);
    if (!base) return undefined;
    if (base.pack) {
      return {
        ...base,
        pack: {
          ...base.pack,
          city: base.pack.city ?? base.city,
          constellation: base.pack.constellation ?? base.constellation,
        },
      };
    }
    const pack = packForSatellite(
      base.noradId,
      base.name ?? `NORAD ${base.noradId}`,
      overlayFor(sky?.overlay, base.noradId),
    );
    return {
      ...base,
      constellation: base.constellation ?? pack.constellation,
      pack: {
        ...pack,
        city: base.city,
        constellation: base.constellation ?? pack.constellation,
      },
    };
  })();
  const [sending, setSending] = useState(false);
  const satelliteMode = Boolean(satellite?.noradId);
  const waitingForSelection = pane && Boolean(sky) && !satelliteMode;
  const suggestions = satelliteMode ? SATELLITE_SUGGESTIONS : [];

  async function startChat(message: PromptInputMessage) {
    const body = message.text?.trim() ?? "";
    const images = toDeliveredImages(message.files);
    if ((!body && images.length === 0) || sending) return;
    if (waitingForSelection) return;
    if (satelliteMode && !satellite?.noradId) return;
    setSending(true);
    const model = DEFAULT_MODEL;
    const thinking = DEFAULT_THINKING;
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
              pack: satellite?.pack,
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
        pane ? undefined : "items-center justify-center gap-6 px-6",
      )}
    >
      {pane ? (
        <SkyStoryCanvas
          noradId={satellite?.noradId ?? sky?.noradId}
          onAsk={(question) => {
            void startChat({ text: question, files: [] }).catch(() => {
              // already surfaced as a toast
            });
          }}
          overlay={sky?.overlay}
          satellite={
            satelliteMode && satellite?.noradId
              ? { noradId: satellite.noradId, name: satellite.name ?? `NORAD ${satellite.noradId}` }
              : sky?.satellite
                ? { noradId: sky.satellite.noradId, name: sky.satellite.name }
                : null
          }
        />
      ) : (
      <div
        className={cn(
          "flex min-h-0 flex-col gap-2",
          "items-center text-center",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-xl border bg-muted">
          <OrbitIcon className="size-6 text-primary" />
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">
          {waitingForSelection
            ? "Select a satellite"
            : satelliteMode
            ? satellite?.name
              ? `Ask about ${satellite.name}`
              : `Ask about NORAD ${satellite?.noradId}`
            : "Skyla"}
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
            ? "Choose an object on the globe to open a sourced accountability brief."
            : satelliteMode
              ? "Each question opens a new sourced card. Catalog rows stay on the first two cards."
              : "Explore the organizations behind the infrastructure orbiting Earth."}
        </p>
      </div>
      )}
      <div
        className={cn(
          "flex w-full shrink-0 flex-col gap-3",
          pane ? "border-t px-3 py-3" : "max-w-2xl",
        )}
      >
        <ChatComposer
          onSubmit={startChat}
          status={sending ? "submitted" : "ready"}
          textareaProps={{
            autoFocus: !pane,
            disabled: waitingForSelection,
            placeholder: satelliteMode
              ? "Ask a question — a new card will open..."
              : waitingForSelection
                ? "Select an object to ask a sourced question..."
                : "Select an object to begin...",
          }}
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

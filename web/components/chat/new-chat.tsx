"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatComposer } from "@/components/chat/composer";
import { ModelPicker } from "@/components/chat/model-picker";
import { toDeliveredImages } from "@/lib/attachments";
import { DEFAULT_MODEL } from "@/lib/models";
import { chatTitle, newSessionId, saveSession } from "@/lib/sessions";
import { createFlueClient } from "@flue/sdk";
import { SparklesIcon } from "lucide-react";
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

export function NewChat() {
  const router = useRouter();
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [sending, setSending] = useState(false);

  // Creates the conversation before navigating: the creating send carries
  // initialData:{model}, which is the only point Flue lets us choose one. The
  // workspace then only ever observes an existing conversation.
  async function startChat(message: PromptInputMessage) {
    const body = message.text?.trim() ?? "";
    const images = toDeliveredImages(message.files);
    if ((!body && images.length === 0) || sending) return;
    setSending(true);
    const session = {
      id: newSessionId(),
      title: chatTitle(body || "Image"),
      model,
      createdAt: Date.now(),
    };
    try {
      const client = createFlueClient({
        url: `/api/agents/assistant/${session.id}`,
      });
      await client.send({
        message: {
          kind: "user",
          body: body || "See the attached image.",
          ...(images.length ? { attachments: images } : {}),
        },
        initialData: { model },
      });
      saveSession(session);
      router.push(`/chat/${session.id}`);
      // Stay in `sending` until navigation unmounts this screen.
    } catch (cause) {
      setSending(false);
      toast.error((cause as Error).message || "Could not start the chat.");
      throw cause; // keeps the draft and attachments for a retry
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border bg-muted">
          <SparklesIcon className="size-6 text-primary" />
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">
          How can I help you today?
        </h1>
        <p className="max-w-md text-muted-foreground text-sm">
          Ask anything. Conversations are saved in the sidebar and replay when
          you come back.
        </p>
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <ChatComposer
          onSubmit={startChat}
          status={sending ? "submitted" : "ready"}
          textareaProps={{ autoFocus: true, placeholder: "Ask anything..." }}
          tools={<ModelPicker onChange={setModel} value={model} />}
        />
        <Suggestions className="mx-auto">
          {SUGGESTIONS.map((suggestion) => (
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
      </div>
    </div>
  );
}

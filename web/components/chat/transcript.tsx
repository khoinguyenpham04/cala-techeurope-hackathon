"use client";

import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { CalaEvidence } from "@/components/chat/cala-evidence";
import { searchSources, WEB_SEARCH_TOOL } from "@/lib/search";
import {
  CALA_KNOWLEDGE_SEARCH,
  LOOKUP_SATELLITE_DOSSIER,
  calaSources,
  dossierFromMessage,
  type CalaCitation,
} from "@/lib/cala";
import { cn } from "@/lib/utils";
import type {
  AgentStatus,
  FlueConversationMessage,
  FlueConversationPart,
} from "@flue/react";
import type { UIMessage } from "ai";
import { CheckIcon, CopyIcon, MessageSquareIcon, BookIcon } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";

function TextPart({ part }: { part: Extract<FlueConversationPart, { type: "text" }> }) {
  return <MessageResponse isAnimating={part.state === "streaming"}>{part.text}</MessageResponse>;
}

function ReasoningPart({
  part,
}: {
  part: Extract<FlueConversationPart, { type: "reasoning" }>;
}) {
  return (
    <Reasoning defaultOpen={false} isStreaming={part.state === "streaming"}>
      <ReasoningTrigger />
      <ReasoningContent>{part.text}</ReasoningContent>
    </Reasoning>
  );
}

function ToolPart({
  part,
}: {
  part: Extract<FlueConversationPart, { type: "dynamic-tool" }>;
}) {
  // Finished search/Cala tools are shown as Sources / evidence above the
  // answer, so the raw call is only worth rendering while it runs or fails.
  if (part.toolName === WEB_SEARCH_TOOL && part.state !== "output-error") {
    if (part.state === "input-available") {
      return (
        <div className="py-1 text-sm">
          <Shimmer duration={1.5}>Searching the web...</Shimmer>
        </div>
      );
    }
    return null;
  }
  if (part.toolName === LOOKUP_SATELLITE_DOSSIER && part.state !== "output-error") {
    if (part.state === "input-available") {
      return (
        <div className="py-1 text-sm">
          <Shimmer duration={1.5}>Checking Cala...</Shimmer>
        </div>
      );
    }
    return null;
  }
  if (part.toolName === CALA_KNOWLEDGE_SEARCH && part.state !== "output-error") {
    if (part.state === "input-available") {
      return (
        <div className="py-1 text-sm">
          <Shimmer duration={1.5}>Searching Cala...</Shimmer>
        </div>
      );
    }
    return null;
  }
  return (
    <Tool>
      <ToolHeader state={part.state} toolName={part.toolName} type="dynamic-tool" />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput
          errorText={part.state === "output-error" ? part.errorText : undefined}
          output={part.state === "output-available" ? part.output : undefined}
        />
      </ToolContent>
    </Tool>
  );
}

function mergeCitations(message: FlueConversationMessage): CalaCitation[] {
  const byUrl = new Map<string, CalaCitation>();
  for (const result of searchSources(message)) {
    if (!byUrl.has(result.url)) {
      byUrl.set(result.url, {
        title: result.title,
        url: result.url,
        snippet: result.snippet,
      });
    }
  }
  for (const citation of calaSources(message)) {
    if (!byUrl.has(citation.url)) byUrl.set(citation.url, citation);
  }
  return [...byUrl.values()];
}

function AssistantParts({ message }: { message: FlueConversationMessage }) {
  const sources = mergeCitations(message);
  const dossier = dossierFromMessage(message);
  return (
    <>
      {sources.length > 0 && (
        <Sources>
          <SourcesTrigger count={sources.length} />
          <SourcesContent>
            {sources.map((source) => (
              <Source href={source.url} key={source.url} title={source.title}>
                <BookIcon className="size-4 shrink-0" />
                <span className="flex min-w-0 flex-col">
                  <span className="block font-medium">{source.title}</span>
                  {(source.publisher || source.date) && (
                    <span className="text-muted-foreground">
                      {[source.publisher, source.date].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </Source>
            ))}
          </SourcesContent>
        </Sources>
      )}
      {dossier ? <CalaEvidence dossier={dossier} /> : null}
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        switch (part.type) {
          case "text":
            return <TextPart key={key} part={part} />;
          case "reasoning":
            return <ReasoningPart key={key} part={part} />;
          case "dynamic-tool":
            return <ToolPart key={key} part={part} />;
          default:
            return null;
        }
      })}
    </>
  );
}

// User messages carry plain text plus optional image attachments (file parts:
// data: URLs on the optimistic echo, attachment URLs from durable history).
function UserParts({ message }: { message: FlueConversationMessage }) {
  const images = message.parts.filter(
    (part) => part.type === "file" && part.mediaType.startsWith("image/") && part.url,
  );
  return (
    <>
      {images.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {images.map((part, index) =>
            part.type === "file" ? (
              // eslint-disable-next-line @next/next/no-img-element -- data:/attachment URLs
              <img
                alt={part.filename ?? "attached image"}
                className="max-h-48 max-w-full rounded-lg border object-contain"
                key={`${message.id}-image-${index}`}
                src={part.url}
              />
            ) : null,
          )}
        </div>
      )}
      {message.parts
        .filter((part) => part.type === "text")
        .map((part, index) =>
          part.type === "text" && part.text ? (
            <p className="whitespace-pre-wrap" key={`${message.id}-text-${index}`}>
              {part.text}
            </p>
          ) : null,
        )}
    </>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <MessageAction
      label="Copy message"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          toast.error("Could not copy to the clipboard.");
        }
      }}
      tooltip={copied ? "Copied" : "Copy"}
    >
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
    </MessageAction>
  );
}

function messageText(message: FlueConversationMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");
}

function isStreaming(message: FlueConversationMessage): boolean {
  return message.parts.some(
    (part) =>
      (part.type === "text" || part.type === "reasoning") && part.state === "streaming",
  );
}

export function Transcript({
  messages,
  status,
  density = "page",
  emptyTitle = "Start the conversation",
  emptyDescription = "Send a message to begin.",
}: {
  messages: FlueConversationMessage[];
  status: AgentStatus;
  density?: "page" | "pane";
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const visible = messages.filter(
    (message) => message.display === "visible" && message.parts.length > 0,
  );
  const working = status === "submitted" || status === "streaming";
  const last = visible.at(-1);
  // Show the shimmer until the assistant starts producing output.
  const waiting = working && (!last || last.role !== "assistant");

  // ConversationDownload formats AI SDK messages; Flue parts map onto the
  // text-part shape its markdown formatter reads.
  const downloadable = visible.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: messageText(message) }],
  })) as unknown as UIMessage[];

  return (
    <Conversation className="min-h-0 flex-1">
      {visible.length > 0 && density === "page" && (
        <ConversationDownload
          aria-label="Download transcript"
          messages={downloadable}
        />
      )}
      <ConversationContent
        className={cn(
          "mx-auto w-full",
          density === "pane" ? "max-w-none px-3 py-4" : "max-w-3xl px-6 py-6",
        )}
      >
        {visible.length === 0 && !working && (
          <ConversationEmptyState
            description={emptyDescription}
            icon={<MessageSquareIcon className="size-8" />}
            title={emptyTitle}
          />
        )}
        {visible.map((message) => (
          <Fragment key={message.id}>
            {message.role === "user" ? (
              <Message from="user">
                <MessageContent>
                  <UserParts message={message} />
                </MessageContent>
              </Message>
            ) : (
              <Message from="assistant">
                <MessageContent className="w-full gap-3">
                  <AssistantParts message={message} />
                  {message.settlement && (
                    <p className="text-destructive text-sm">
                      This turn {message.settlement.outcome}. Send a message to retry.
                    </p>
                  )}
                  {!isStreaming(message) && messageText(message) && (
                    <MessageActions>
                      <CopyAction text={messageText(message)} />
                    </MessageActions>
                  )}
                </MessageContent>
              </Message>
            )}
          </Fragment>
        ))}
        {waiting && (
          <div className="py-2 text-sm">
            <Shimmer duration={1.5}>Thinking...</Shimmer>
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

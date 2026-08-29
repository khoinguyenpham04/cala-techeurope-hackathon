"use client";

import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
  useStickToBottomContext,
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
import { Fragment, useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";

const LOOKUP_SHIMMER: Record<string, string> = {
  [WEB_SEARCH_TOOL]: "Searching the web...",
  [LOOKUP_SATELLITE_DOSSIER]: "Checking Cala...",
  [CALA_KNOWLEDGE_SEARCH]: "Searching Cala...",
};

function isWorking(status: AgentStatus): boolean {
  return (
    status === "connecting" ||
    status === "submitted" ||
    status === "streaming"
  );
}

function TextPart({ part }: { part: Extract<FlueConversationPart, { type: "text" }> }) {
  if (!part.text && part.state === "streaming") return null;
  if (!part.text) return null;
  return <MessageResponse isAnimating={part.state === "streaming"}>{part.text}</MessageResponse>;
}

function ReasoningPart({
  part,
}: {
  part: Extract<FlueConversationPart, { type: "reasoning" }>;
}) {
  if (!part.text && part.state !== "streaming") return null;
  return (
    <Reasoning isStreaming={part.state === "streaming"}>
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
  // Finished search/Cala tools are shown as Sources / evidence after the
  // answer, so the raw call is only worth rendering while it runs or fails.
  const label = LOOKUP_SHIMMER[part.toolName];
  if (label && part.state !== "output-error") {
    if (part.state === "input-available") {
      return (
        <div className="py-1 text-sm">
          <Shimmer duration={1}>{label}</Shimmer>
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

function hasVisibleAssistantOutput(message: FlueConversationMessage): boolean {
  if (dossierFromMessage(message)) return true;
  if (mergeCitations(message).length > 0) return true;
  return message.parts.some((part) => {
    if (part.type === "text") return part.text.trim().length > 0;
    if (part.type === "reasoning") {
      return part.state === "streaming" || part.text.trim().length > 0;
    }
    if (part.type === "dynamic-tool") {
      if (part.state === "output-error") return true;
      if (LOOKUP_SHIMMER[part.toolName]) return part.state === "input-available";
      return true;
    }
    return false;
  });
}

function AssistantParts({
  message,
  pending,
}: {
  message: FlueConversationMessage;
  pending?: boolean;
}) {
  const sources = mergeCitations(message);
  const dossier = dossierFromMessage(message);
  const showThinking = Boolean(pending) && !hasVisibleAssistantOutput(message);

  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        switch (part.type) {
          case "reasoning":
            return <ReasoningPart key={key} part={part} />;
          case "dynamic-tool":
            return <ToolPart key={key} part={part} />;
          case "text":
            return <TextPart key={key} part={part} />;
          default:
            return null;
        }
      })}
      {showThinking ? (
        <div className="py-1 text-sm">
          <Shimmer duration={1}>Thinking...</Shimmer>
        </div>
      ) : null}
      {dossier ? <CalaEvidence dossier={dossier} /> : null}
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

function StickOnUserTurn({ messageId }: { messageId: string | undefined }) {
  const { scrollToBottom } = useStickToBottomContext();
  useLayoutEffect(() => {
    if (!messageId) return;
    void scrollToBottom();
  }, [messageId, scrollToBottom]);
  return null;
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
  const working = isWorking(status);
  const last = visible.at(-1);
  const lastUser = [...visible].reverse().find((message) => message.role === "user");
  const awaitingAssistant = working && last?.role !== "assistant";
  const pane = density === "pane";

  // ConversationDownload formats AI SDK messages; Flue parts map onto the
  // text-part shape its markdown formatter reads.
  const downloadable = visible.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: messageText(message) }],
  })) as unknown as UIMessage[];

  return (
    <Conversation className="min-h-0 flex-1">
      {visible.length > 0 && !pane && (
        <ConversationDownload
          aria-label="Download transcript"
          messages={downloadable}
        />
      )}
      <StickOnUserTurn messageId={lastUser?.id} />
      <ConversationContent
        className={cn(
          "w-full",
          pane ? "max-w-none gap-4 px-3 py-3" : "mx-auto max-w-3xl gap-6 px-6 py-6",
        )}
      >
        {visible.length === 0 && !working && (
          <ConversationEmptyState
            className={pane ? "min-h-48 p-4" : undefined}
            description={emptyDescription}
            icon={<MessageSquareIcon className="size-8" />}
            title={emptyTitle}
          />
        )}
        {visible.map((message) => (
          <Fragment key={message.id}>
            {message.role === "user" ? (
              <Message className={pane ? "max-w-full" : undefined} from="user">
                <MessageContent>
                  <UserParts message={message} />
                </MessageContent>
              </Message>
            ) : (
              <Message className={pane ? "max-w-full" : undefined} from="assistant">
                <MessageContent className="w-full gap-3">
                  <AssistantParts
                    message={message}
                    pending={working && last?.id === message.id}
                  />
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
        {awaitingAssistant && (
          <Message className={pane ? "max-w-full" : undefined} from="assistant">
            <MessageContent className="w-full">
              <div className="py-1 text-sm">
                <Shimmer duration={1}>Thinking...</Shimmer>
              </div>
            </MessageContent>
          </Message>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

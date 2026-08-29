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
import { searchSources, WEB_SEARCH_TOOL } from "@/lib/search";
import type {
  AgentStatus,
  FlueConversationMessage,
  FlueConversationPart,
} from "@flue/react";
import type { UIMessage } from "ai";
import { CheckIcon, CopyIcon, MessageSquareIcon } from "lucide-react";
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
  // A finished search is shown as the Sources block above the answer, so the
  // raw call is only worth rendering while it runs or when it fails.
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

function AssistantParts({ message }: { message: FlueConversationMessage }) {
  const sources = searchSources(message);
  return (
    <>
      {sources.length > 0 && (
        <Sources>
          <SourcesTrigger count={sources.length} />
          <SourcesContent>
            {sources.map((source) => (
              <Source href={source.url} key={source.url} title={source.title} />
            ))}
          </SourcesContent>
        </Sources>
      )}
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
}: {
  messages: FlueConversationMessage[];
  status: AgentStatus;
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
      {visible.length > 0 && (
        <ConversationDownload
          aria-label="Download transcript"
          messages={downloadable}
        />
      )}
      <ConversationContent className="mx-auto w-full max-w-3xl px-6 py-6">
        {visible.length === 0 && !working && (
          <ConversationEmptyState
            description="Send a message to begin."
            icon={<MessageSquareIcon className="size-8" />}
            title="Start the conversation"
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

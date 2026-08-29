"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CalloutTone, StorySource } from "@/lib/sky/story-page";
import { cn } from "@/lib/utils";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";

export type SerializedCalloutNode = Spread<
  {
    tone: CalloutTone;
    title: string;
    body: string;
    sources: StorySource[];
    streaming: boolean;
  },
  SerializedLexicalNode
>;

export type CalloutPayload = {
  tone: CalloutTone;
  title: string;
  body: string;
  sources?: StorySource[];
  streaming?: boolean;
};

const TONE_LABEL: Record<CalloutTone, string> = {
  verified: "Verified",
  unverified: "Unverified",
  catalog: "Catalog",
};

function CalloutBlock({
  tone,
  title,
  body,
  sources,
  streaming,
}: CalloutPayload) {
  const links = sources?.filter((source) => source.url) ?? [];

  return (
    <Alert
      className={cn(
        "border-0 bg-card/80 py-3 ring-1 ring-foreground/10",
        tone === "verified" && "border-l-2 border-l-emerald-500/75",
        tone === "unverified" && "border-l-2 border-l-muted-foreground/25 bg-muted/25",
        tone === "catalog" && "border-l-2 border-l-sky-500/55",
      )}
    >
      <AlertTitle className="flex flex-wrap items-center gap-2 text-sm">
        <span>{title}</span>
        <Badge
          className="capitalize"
          variant={tone === "verified" ? "default" : "outline"}
        >
          {TONE_LABEL[tone]}
        </Badge>
      </AlertTitle>
      <AlertDescription className="text-pretty">
        {streaming ? (
          <span className="flex flex-col gap-1.5">
            {body ? <span className="text-foreground/90">{body}</span> : null}
            <Shimmer className="text-xs" duration={1.4}>
              Writing…
            </Shimmer>
          </span>
        ) : (
          <span
            className={cn(
              "text-sm",
              tone === "unverified" ? "text-muted-foreground" : "text-foreground/90",
            )}
          >
            {body}
          </span>
        )}
        {tone !== "unverified" && links.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {links.map((source) => (
              <li key={source.url}>
                <a
                  className="text-xs text-primary underline-offset-4 hover:underline"
                  href={source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {source.name}
                  {source.date ? ` · ${source.date}` : ""}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export class CalloutNode extends DecoratorNode<JSX.Element> {
  __tone: CalloutTone;
  __title: string;
  __body: string;
  __sources: StorySource[];
  __streaming: boolean;

  static getType(): string {
    return "callout";
  }

  $config() {
    return this.config("callout", {
      extends: DecoratorNode,
    });
  }

  static clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(
      {
        tone: node.__tone,
        title: node.__title,
        body: node.__body,
        sources: node.__sources,
        streaming: node.__streaming,
      },
      node.__key,
    );
  }

  constructor(payload: CalloutPayload, key?: NodeKey) {
    super(key);
    this.__tone = payload.tone;
    this.__title = payload.title;
    this.__body = payload.body;
    this.__sources = payload.sources ?? [];
    this.__streaming = payload.streaming === true;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("div");
    dom.className = "my-3";
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return false;
  }

  isIsolated(): boolean {
    return true;
  }

  exportJSON(): SerializedCalloutNode {
    return {
      ...super.exportJSON(),
      tone: this.__tone,
      title: this.__title,
      body: this.__body,
      sources: this.__sources,
      streaming: this.__streaming,
    };
  }

  static importJSON(serialized: SerializedCalloutNode): CalloutNode {
    return $createCalloutNode({
      tone: serialized.tone,
      title: serialized.title,
      body: serialized.body,
      sources: serialized.sources,
      streaming: serialized.streaming,
    });
  }

  decorate(): JSX.Element {
    return (
      <CalloutBlock
        body={this.__body}
        sources={this.__sources}
        streaming={this.__streaming}
        title={this.__title}
        tone={this.__tone}
      />
    );
  }
}

export function $createCalloutNode(payload: CalloutPayload): CalloutNode {
  return $applyNodeReplacement(new CalloutNode(payload));
}

export function $isCalloutNode(
  node: LexicalNode | null | undefined,
): node is CalloutNode {
  return node instanceof CalloutNode;
}

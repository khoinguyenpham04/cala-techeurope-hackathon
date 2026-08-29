"use client";

import { CalloutNode } from "@/components/sky/nodes/callout-node";
import { $setStoryPage } from "@/components/sky/page-to-lexical";
import type { StoryPage } from "@/lib/sky/story-page";
import { cn } from "@/lib/utils";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { SKIP_DOM_SELECTION_TAG, type EditorThemeClasses } from "lexical";
import { useLayoutEffect, useMemo } from "react";

const theme: EditorThemeClasses = {
  paragraph: "mb-3 text-sm leading-relaxed text-foreground/90",
  heading: {
    h1: "mb-3 font-heading text-2xl font-semibold tracking-tight text-foreground",
    h2: "mb-2 mt-8 font-heading text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground",
    h3: "mb-2 mt-6 text-sm font-medium text-foreground",
  },
  quote:
    "mb-3 border-l-2 border-foreground/15 pl-4 text-sm leading-relaxed text-muted-foreground",
  list: {
    ul: "mb-3 list-disc pl-5 text-sm leading-relaxed text-foreground/90",
    ol: "mb-3 list-decimal pl-5 text-sm leading-relaxed text-foreground/90",
    listitem: "mb-1",
    nested: {
      listitem: "list-none",
    },
  },
  link: "text-primary underline-offset-4 hover:underline",
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "rounded-md bg-muted px-1 py-0.5 font-mono text-[0.85em]",
  },
};

const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CalloutNode,
];

function PageSyncPlugin({ page }: { page: StoryPage }) {
  const [editor] = useLexicalComposerContext();
  const signature = useMemo(() => JSON.stringify(page), [page]);

  useLayoutEffect(() => {
    editor.update(
      () => {
        $setStoryPage(page);
      },
      { tag: SKIP_DOM_SELECTION_TAG },
    );
  }, [editor, page, signature]);

  return null;
}

export function StoryPageEditor({
  className,
  page,
}: {
  className?: string;
  page: StoryPage;
}) {
  const initialConfig = useMemo(
    () => ({
      editable: false,
      editorState: () => {
        $setStoryPage(page);
      },
      namespace: "SkyStoryPage",
      nodes: EDITOR_NODES,
      onError(error: Error) {
        console.error(error);
      },
      theme,
    }),
    // Seed once per editor mount (keyed by NORAD in the parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- page updates go through PageSyncPlugin
    [],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={cn("relative", className)}>
        <RichTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={
            <ContentEditable
              aria-label="Satellite page"
              className="min-h-[12rem] outline-none"
            />
          }
        />
        <ListPlugin />
        <LinkPlugin attributes={{ rel: "noreferrer noopener", target: "_blank" }} />
        <PageSyncPlugin page={page} />
      </div>
    </LexicalComposer>
  );
}

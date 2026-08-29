import { $createCalloutNode } from "@/components/sky/nodes/callout-node";
import type { StoryBlock, StoryPage } from "@/lib/sky/story-page";
import { $createLinkNode } from "@lexical/link";
import { $createListItemNode, $createListNode } from "@lexical/list";
import {
  $generateNodesFromMarkdownString,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
  type Transformer,
} from "@lexical/markdown";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $setSelection,
  type LexicalNode,
} from "lexical";

export const STORY_MARKDOWN_TRANSFORMERS: Transformer[] = [
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  INLINE_CODE,
  LINK,
];

function $textOrLinks(text: string): LexicalNode[] {
  const nodes: LexicalNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    if (match.index > last) {
      nodes.push($createTextNode(text.slice(last, match.index)));
    }
    const link = $createLinkNode(match[2]!);
    link.append($createTextNode(match[1]!));
    nodes.push(link);
    last = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (last < text.length) {
    nodes.push($createTextNode(text.slice(last)));
  }
  if (nodes.length === 0) {
    nodes.push($createTextNode(text));
  }
  return nodes;
}

function $nodeFromBlock(block: StoryBlock): LexicalNode {
  switch (block.type) {
    case "heading": {
      const heading = $createHeadingNode(`h${block.level}`);
      heading.append($createTextNode(block.text));
      return heading;
    }
    case "paragraph": {
      const paragraph = $createParagraphNode();
      paragraph.append(...$textOrLinks(block.text));
      return paragraph;
    }
    case "quote": {
      const quote = $createQuoteNode();
      quote.append(...$textOrLinks(block.text));
      return quote;
    }
    case "list": {
      const list = $createListNode(block.ordered ? "number" : "bullet");
      for (const item of block.items) {
        const listItem = $createListItemNode();
        listItem.append($createTextNode(item));
        list.append(listItem);
      }
      return list;
    }
    case "callout":
      return $createCalloutNode({
        body: block.body,
        sources: block.sources,
        streaming: block.streaming,
        title: block.title,
        tone: block.tone,
      });
  }
}

export function $setStoryPage(page: StoryPage): void {
  const root = $getRoot();
  root.clear();
  for (const block of page.blocks) {
    root.append($nodeFromBlock(block));
  }

  const markdown = page.lessonMarkdown?.trim();
  if (markdown) {
    const nodes = $generateNodesFromMarkdownString(
      markdown,
      STORY_MARKDOWN_TRANSFORMERS,
      true,
    );
    if (nodes.length > 0) {
      root.append(...nodes);
    } else {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(markdown));
      root.append(paragraph);
    }
  } else if (page.lessonStreaming) {
    root.append(
      $createCalloutNode({
        body: "",
        streaming: true,
        title: "Lesson",
        tone: "unverified",
      }),
    );
  }

  if (root.getFirstChild() === null) {
    root.append($createParagraphNode());
  }
  $setSelection(null);
}

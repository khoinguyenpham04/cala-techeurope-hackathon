"use client";

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { getThinkingLevel, THINKING_LEVELS } from "@/lib/models";
import { CheckIcon, BrainIcon } from "lucide-react";
import { useState } from "react";

// Picks the reasoning effort a NEW conversation is created with. Like the
// model, Flue fixes it at creation (initialData), so existing chats show
// EffortChip instead.
export function EffortPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = getThinkingLevel(value);

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger render={<PromptInputButton />}>
        <BrainIcon className="size-3" />
        <ModelSelectorName>{selected?.name ?? value}</ModelSelectorName>
      </ModelSelectorTrigger>
      <ModelSelectorContent title="Select reasoning effort">
        <ModelSelectorInput placeholder="Search effort levels..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No effort levels found.</ModelSelectorEmpty>
          <ModelSelectorGroup heading="Reasoning effort">
            {THINKING_LEVELS.map((level) => (
              <ModelSelectorItem
                key={level.id}
                onSelect={() => {
                  onChange(level.id);
                  setOpen(false);
                }}
                value={`${level.id} ${level.name} ${level.hint}`}
              >
                <div className="flex flex-col">
                  <ModelSelectorName>{level.name}</ModelSelectorName>
                  <span className="text-muted-foreground text-xs">
                    {level.hint}
                  </span>
                </div>
                {level.id === value ? (
                  <CheckIcon className="ml-auto size-4" />
                ) : (
                  <div className="ml-auto size-4" />
                )}
              </ModelSelectorItem>
            ))}
          </ModelSelectorGroup>
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

// Read-only marker of the effort an existing conversation is pinned to.
export function EffortChip({ thinking }: { thinking: string }) {
  const level = getThinkingLevel(thinking);
  return (
    <PromptInputButton
      className="pointer-events-none opacity-70"
      tabIndex={-1}
      title="Reasoning effort is set when a conversation starts"
    >
      <BrainIcon className="size-3" />
      <ModelSelectorName>{level?.name ?? thinking}</ModelSelectorName>
    </PromptInputButton>
  );
}

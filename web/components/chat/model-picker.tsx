"use client";

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { getModel, MODELS, PROVIDERS } from "@/lib/models";
import { CheckIcon } from "lucide-react";
import { useState } from "react";

// Picks the model a NEW conversation is created with. Flue locks the model
// at creation (initialData), so existing chats show ModelChip instead.
export function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = getModel(value);

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger render={<PromptInputButton />}>
        {selected && <ModelSelectorLogo provider={selected.provider} />}
        <ModelSelectorName>{selected?.name ?? value}</ModelSelectorName>
      </ModelSelectorTrigger>
      <ModelSelectorContent title="Select model">
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {PROVIDERS.map((provider) => (
            <ModelSelectorGroup heading={provider.name} key={provider.slug}>
              {MODELS.filter((model) => model.provider === provider.slug).map(
                (model) => (
                  <ModelSelectorItem
                    key={model.id}
                    onSelect={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                    value={model.id}
                  >
                    <ModelSelectorLogo provider={model.provider} />
                    <ModelSelectorName>{model.name}</ModelSelectorName>
                    {model.id === value ? (
                      <CheckIcon className="ml-auto size-4" />
                    ) : (
                      <div className="ml-auto size-4" />
                    )}
                  </ModelSelectorItem>
                ),
              )}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

// Read-only marker of the model an existing conversation is pinned to.
export function ModelChip({ modelId }: { modelId: string }) {
  const model = getModel(modelId);
  return (
    <PromptInputButton
      className="pointer-events-none opacity-70"
      tabIndex={-1}
      title="The model is set when a conversation starts"
    >
      {model && <ModelSelectorLogo provider={model.provider} />}
      <ModelSelectorName>{model?.name ?? modelId}</ModelSelectorName>
    </PromptInputButton>
  );
}

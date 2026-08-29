"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import type { ChatStatus } from "ai";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 4;

function ComposerAttachments() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <Attachments variant="inline">
      {attachments.files.map((file) => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

function ComposerSpeech() {
  const controller = usePromptInputController();
  return (
    <SpeechInput
      // SpeechInput is primary-filled by default; keep the submit button the
      // only accented control in the composer.
      className="shrink-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      onTranscriptionChange={(transcript) => {
        const current = controller.textInput.value;
        controller.textInput.setInput(
          current ? `${current} ${transcript}` : transcript,
        );
      }}
      size="icon-sm"
      variant="ghost"
    />
  );
}

function ComposerForm({
  onSubmit,
  status,
  tools,
  className,
  textareaProps,
}: ChatComposerProps) {
  return (
    <PromptInput
      accept="image/*"
      className={className}
      globalDrop
      maxFileSize={MAX_IMAGE_BYTES}
      maxFiles={MAX_IMAGES}
      multiple
      onError={(error) => toast.error(error.message)}
      onSubmit={onSubmit}
    >
      <PromptInputHeader>
        <ComposerAttachments />
      </PromptInputHeader>
      <PromptInputBody>
        <PromptInputTextarea {...textareaProps} />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments label="Add images" />
              <PromptInputActionAddScreenshot label="Attach a screenshot" />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <ComposerSpeech />
          {tools}
        </PromptInputTools>
        {/* Submitting while a reply is in flight would be dropped by the
            caller's guard, and the composer would still clear the draft. */}
        <PromptInputSubmit
          disabled={status === "submitted" || status === "streaming"}
          status={status}
        />
      </PromptInputFooter>
    </PromptInput>
  );
}

export interface ChatComposerProps {
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
  status: ChatStatus;
  /** Extra controls beside the attachment menu, e.g. the model picker. */
  tools?: ReactNode;
  className?: string;
  textareaProps?: ComponentProps<typeof PromptInputTextarea>;
}

// The one composer used on the new-chat screen and inside a chat: text plus
// image attachments (menu, screenshot, drag/drop, paste) and dictation. The
// provider owns the draft so a failed send keeps what the user typed.
export function ChatComposer(props: ChatComposerProps) {
  return (
    <PromptInputProvider>
      <ComposerForm {...props} />
    </PromptInputProvider>
  );
}

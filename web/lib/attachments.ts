import type { DeliveredAttachment } from "@flue/react";
import type { FileUIPart } from "ai";

const DATA_URL = /^data:([^;,]+);base64,(.+)$/;

// The composer resolves attachments to data URLs on submit; Flue's wire
// format wants bare base64 image attachments. Non-images and anything that
// isn't a base64 data URL are dropped.
export function toDeliveredImages(files: FileUIPart[]): DeliveredAttachment[] {
  const images: DeliveredAttachment[] = [];
  for (const file of files) {
    if (!file.url) continue;
    const match = DATA_URL.exec(file.url);
    if (!match) continue;
    const mimeType = file.mediaType || match[1];
    if (!mimeType.startsWith("image/")) continue;
    images.push({
      type: "image",
      data: match[2],
      mimeType,
      ...(file.filename ? { filename: file.filename } : {}),
    });
  }
  return images;
}

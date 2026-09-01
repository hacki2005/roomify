import puter from "@heyputer/puter.js";
import { ROOMIFY_RENDER_PROMPT } from "./constants";

/**
 * Converts an image URL to a data URL.
 *
 * @param url - The image URL to fetch.
 * @returns The fetched image encoded as a data URL.
 */
export async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`,
    );
  }

  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read image as data URL."));
    };

    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read image as data URL."));
    reader.readAsDataURL(blob);
  });
}

export const generate3DView = async ({ sourceImage }: Generate3DViewParams) => {
  const dataUrl = sourceImage.startsWith("data:")
    ? sourceImage
    : await fetchAsDataUrl(sourceImage);

  const base64Data = dataUrl.split(",")[1];
  const mimeType = dataUrl.split(";")[0].split(":")[1];

  if (!mimeType || !base64Data) throw new Error("Invalid source image payload");

  const response = await puter.ai.txt2img(ROOMIFY_RENDER_PROMPT, {
    provider: "Gemini",
    model: "Gemini-2.5-flash-image-preview",
    input_image: base64Data,
    input_image_mime_type: mimeType,
    ratio: { w: 1024, h: 1024 },
  });
  const rawImageUrl =
    typeof response === "string"
      ? response
      : response && typeof response === "object" && "src" in response
        ? typeof response.src === "string"
          ? response.src
          : null
        : null;

  if (!rawImageUrl) return { renderedImage: null, renderedPath: undefined };

  const renderedImage = rawImageUrl.startsWith("data:")
    ? rawImageUrl
    : await fetchAsDataUrl(rawImageUrl);

  return { renderedImage, renderedPath: undefined };
};

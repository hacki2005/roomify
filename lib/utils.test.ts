import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createHostingSlug,
  dataUrlToBlob,
  fetchBlobFromUrl,
  getHostedUrl,
  getImageExtension,
  imageUrlToPngBlob,
  isHostedUrl,
} from "./utils";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("hosting URL helpers", () => {
  it("recognizes Puter-hosted URLs and rejects unrelated values", () => {
    expect(isHostedUrl("https://roomify-demo.puter.site/project/1/source.png")).toBe(true);
    expect(isHostedUrl("https://example.com/source.png")).toBe(false);
    expect(isHostedUrl(null)).toBe(false);
    expect(isHostedUrl({ url: "https://roomify-demo.puter.site" })).toBe(false);
  });

  it("creates a deterministic, namespaced slug from the current time and randomness", () => {
    vi.spyOn(Date, "now").mockReturnValue(123_456_789);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(createHostingSlug()).toBe(
      `roomify-${(123_456_789).toString(36)}-${(0.5).toString(36).slice(2, 8)}`,
    );
  });

  it.each([
    ["roomify-demo", "project/1/source.png", "https://roomify-demo.puter.site/project/1/source.png"],
    ["roomify-demo.puter.site", "project/1/source.png", "https://roomify-demo.puter.site/project/1/source.png"],
  ])("builds a hosted URL without duplicating the domain suffix", (subdomain, path, expected) => {
    expect(getHostedUrl({ subdomain }, path)).toBe(expected);
  });

  it("returns null when no hosting subdomain is available", () => {
    expect(getHostedUrl({ subdomain: "" }, "source.png")).toBeNull();
  });
});

describe("getImageExtension", () => {
  it.each([
    ["image/png", "ignored.jpg", "png"],
    ["IMAGE/JPEG; charset=binary", "ignored.png", "jpg"],
    ["image/svg+xml", "ignored.png", "svg"],
    ["", "data:image/jpeg;base64,AA==", "jpg"],
    ["", "https://example.com/image.WEBP?download=1", "webp"],
    ["application/octet-stream", "https://example.com/no-extension", "png"],
  ])("resolves %s and %s to %s", (contentType, url, expected) => {
    expect(getImageExtension(contentType, url)).toBe(expected);
  });

  it("prefers a recognized content type over a conflicting URL extension", () => {
    expect(getImageExtension("image/gif", "https://example.com/image.png")).toBe("gif");
  });
});

describe("dataUrlToBlob", () => {
  it("decodes base64 data, including embedded whitespace", async () => {
    const result = dataUrlToBlob("data:text/plain;base64,SGVs\nbG8=");

    expect(result?.contentType).toBe("text/plain");
    expect(result?.blob.type).toBe("text/plain");
    await expect(result?.blob.text()).resolves.toBe("Hello");
  });

  it("decodes percent-encoded data URLs", async () => {
    const result = dataUrlToBlob("data:text/plain,hello%20roomify");

    await expect(result?.blob.text()).resolves.toBe("hello roomify");
  });

  it.each(["not-a-data-url", "data:text/plain,%E0%A4%A"])(
    "returns null for malformed input: %s",
    (value) => {
      expect(dataUrlToBlob(value)).toBeNull();
    },
  );
});

describe("fetchBlobFromUrl", () => {
  it("decodes data URLs without making a network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBlobFromUrl("data:text/plain,local");

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(result?.blob.text()).resolves.toBe("local");
  });

  it("returns the fetched blob and response content type", async () => {
    const response = new Response(new Blob(["pixels"]), {
      headers: { "content-type": "image/webp" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetchBlobFromUrl("https://example.com/image");

    expect(result?.contentType).toBe("image/webp");
    await expect(result?.blob.text()).resolves.toBe("pixels");
  });

  it.each([
    ["an unsuccessful response", vi.fn().mockResolvedValue(new Response(null, { status: 404 }))],
    ["a network error", vi.fn().mockRejectedValue(new Error("offline"))],
  ])("returns null for %s", async (_case, fetchMock) => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBlobFromUrl("https://example.com/image")).resolves.toBeNull();
  });
});

describe("imageUrlToPngBlob", () => {
  it("returns null during server-side rendering", async () => {
    expect(typeof window).toBe("undefined");
    await expect(imageUrlToPngBlob("https://example.com/image.jpg")).resolves.toBeNull();
  });

  it("loads an image, draws its natural dimensions, and exports a PNG", async () => {
    const drawImage = vi.fn();
    const png = new Blob(["png"], { type: "image/png" });
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage }),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(png)),
    };

    class SuccessfulImage {
      crossOrigin = "";
      naturalWidth = 640;
      naturalHeight = 480;
      width = 0;
      height = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("window", {});
    vi.stubGlobal("Image", SuccessfulImage);
    vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(canvas) });

    await expect(imageUrlToPngBlob("https://example.com/image.jpg")).resolves.toBe(png);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    expect(drawImage).toHaveBeenCalledWith(expect.any(SuccessfulImage), 0, 0, 640, 480);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
  });

  it("returns null when the browser cannot load the source image", async () => {
    class FailingImage {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }

    vi.stubGlobal("window", {});
    vi.stubGlobal("Image", FailingImage);

    await expect(imageUrlToPngBlob("https://example.com/broken.jpg")).resolves.toBeNull();
  });

  it("returns null for a zero-sized image before creating a canvas", async () => {
    class EmptyImage {
      crossOrigin = "";
      naturalWidth = 0;
      naturalHeight = 0;
      width = 0;
      height = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    const createElement = vi.fn();

    vi.stubGlobal("window", {});
    vi.stubGlobal("Image", EmptyImage);
    vi.stubGlobal("document", { createElement });

    await expect(imageUrlToPngBlob("https://example.com/empty.jpg")).resolves.toBeNull();
    expect(createElement).not.toHaveBeenCalled();
  });
});

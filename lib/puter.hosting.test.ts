import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOSTING_CONFIG_KEY } from "./utils";

const puterMocks = vi.hoisted(() => ({
  kvGet: vi.fn(),
  hostingCreate: vi.fn(),
  mkdir: vi.fn(),
  write: vi.fn(),
}));

const utilityMocks = vi.hoisted(() => ({
  createHostingSlug: vi.fn(),
  fetchBlobFromUrl: vi.fn(),
  imageUrlToPngBlob: vi.fn(),
}));

vi.mock("@heyputer/puter.js", () => ({
  default: {
    kv: { get: puterMocks.kvGet },
    hosting: { create: puterMocks.hostingCreate },
    fs: { mkdir: puterMocks.mkdir, write: puterMocks.write },
  },
}));

vi.mock("./utils", async () => {
  const actual = await vi.importActual<typeof import("./utils")>("./utils");
  return {
    ...actual,
    createHostingSlug: utilityMocks.createHostingSlug,
    fetchBlobFromUrl: utilityMocks.fetchBlobFromUrl,
    imageUrlToPngBlob: utilityMocks.imageUrlToPngBlob,
  };
});

import { getOrCreateHostingConfig, uploadImageToHosting } from "./puter.hosting";

beforeEach(() => {
  vi.clearAllMocks();
  utilityMocks.createHostingSlug.mockReturnValue("roomify-generated");
  puterMocks.mkdir.mockResolvedValue(undefined);
  puterMocks.write.mockResolvedValue(undefined);
});

describe("getOrCreateHostingConfig", () => {
  it("reuses a stored hosting subdomain", async () => {
    puterMocks.kvGet.mockResolvedValue({ subdomain: "roomify-existing", ignored: true });

    await expect(getOrCreateHostingConfig()).resolves.toEqual({ subdomain: "roomify-existing" });
    expect(puterMocks.kvGet).toHaveBeenCalledWith(HOSTING_CONFIG_KEY);
    expect(utilityMocks.createHostingSlug).not.toHaveBeenCalled();
    expect(puterMocks.hostingCreate).not.toHaveBeenCalled();
  });

  it("creates hosting when no stored subdomain exists", async () => {
    puterMocks.kvGet.mockResolvedValue(null);
    puterMocks.hostingCreate.mockResolvedValue({ subdomain: "roomify-created" });

    await expect(getOrCreateHostingConfig()).resolves.toEqual({ subdomain: "roomify-created" });
    expect(puterMocks.hostingCreate).toHaveBeenCalledWith("roomify-generated", ".");
  });

  it("returns null and warns when hosting creation fails", async () => {
    puterMocks.kvGet.mockResolvedValue(null);
    puterMocks.hostingCreate.mockRejectedValue(new Error("unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(getOrCreateHostingConfig()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unavailable"));
  });
});

describe("uploadImageToHosting", () => {
  const hosting = { subdomain: "roomify-test" };

  it.each([
    [null, "https://example.com/source.png"],
    [hosting, ""],
  ])("does no work when required input is missing", async (hostingValue, url) => {
    await expect(
      uploadImageToHosting({ hosting: hostingValue, url, projectId: "42", label: "source" }),
    ).resolves.toBeNull();
    expect(puterMocks.mkdir).not.toHaveBeenCalled();
    expect(puterMocks.write).not.toHaveBeenCalled();
  });

  it("returns an already-hosted URL without fetching or writing it again", async () => {
    const url = "https://roomify-existing.puter.site/project/42/source.png";

    await expect(
      uploadImageToHosting({ hosting, url, projectId: "42", label: "source" }),
    ).resolves.toEqual({ url });
    expect(utilityMocks.fetchBlobFromUrl).not.toHaveBeenCalled();
    expect(puterMocks.mkdir).not.toHaveBeenCalled();
  });

  it("fetches and uploads a source image with the detected extension", async () => {
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    utilityMocks.fetchBlobFromUrl.mockResolvedValue({ blob, contentType: "image/jpeg" });

    await expect(
      uploadImageToHosting({
        hosting,
        url: "https://example.com/source",
        projectId: "42",
        label: "source",
      }),
    ).resolves.toEqual({ url: "https://roomify-test.puter.site/project/42/source.jpg" });

    expect(utilityMocks.fetchBlobFromUrl).toHaveBeenCalledWith("https://example.com/source");
    expect(utilityMocks.imageUrlToPngBlob).not.toHaveBeenCalled();
    expect(puterMocks.mkdir).toHaveBeenCalledWith("project/42", { createMissingParents: true });
    expect(puterMocks.write).toHaveBeenCalledWith("project/42/source.jpg", expect.any(File));
    const uploadedFile = puterMocks.write.mock.calls[0][1] as File;
    expect(uploadedFile.name).toBe("source.jpg");
    expect(uploadedFile.type).toBe("image/jpeg");
  });

  it("normalizes rendered images to PNG before uploading", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    utilityMocks.imageUrlToPngBlob.mockResolvedValue(png);

    await expect(
      uploadImageToHosting({
        hosting,
        url: "data:image/jpeg;base64,AA==",
        projectId: "render-id",
        label: "rendered",
      }),
    ).resolves.toEqual({
      url: "https://roomify-test.puter.site/project/render-id/rendered.png",
    });

    expect(utilityMocks.imageUrlToPngBlob).toHaveBeenCalledWith("data:image/jpeg;base64,AA==");
    expect(utilityMocks.fetchBlobFromUrl).not.toHaveBeenCalled();
    expect(puterMocks.write).toHaveBeenCalledWith(
      "project/render-id/rendered.png",
      expect.any(File),
    );
  });

  it("returns null without touching storage when image resolution fails", async () => {
    utilityMocks.fetchBlobFromUrl.mockResolvedValue(null);

    await expect(
      uploadImageToHosting({
        hosting,
        url: "https://example.com/missing.png",
        projectId: "42",
        label: "source",
      }),
    ).resolves.toBeNull();
    expect(puterMocks.mkdir).not.toHaveBeenCalled();
    expect(puterMocks.write).not.toHaveBeenCalled();
  });

  it("returns null and logs a storage failure", async () => {
    utilityMocks.fetchBlobFromUrl.mockResolvedValue({
      blob: new Blob(["png"], { type: "image/png" }),
      contentType: "image/png",
    });
    puterMocks.write.mockRejectedValue(new Error("quota exceeded"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      uploadImageToHosting({
        hosting,
        url: "https://example.com/source.png",
        projectId: "42",
        label: "source",
      }),
    ).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("quota exceeded"));
  });
});

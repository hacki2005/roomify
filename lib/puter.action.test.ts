import { beforeEach, describe, expect, it, vi } from "vitest";

const puterMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
}));

const hostingMocks = vi.hoisted(() => ({
  getOrCreateHostingConfig: vi.fn(),
  uploadImageToHosting: vi.fn(),
}));

vi.mock("@heyputer/puter.js", () => ({
  default: {
    auth: {
      signIn: puterMocks.signIn,
      signOut: puterMocks.signOut,
      getUser: puterMocks.getUser,
    },
  },
}));

vi.mock("./puter.hosting", () => hostingMocks);

import { createProject, getCurrentUser, signIn, signOut } from "./puter.action";

beforeEach(() => {
  vi.clearAllMocks();
  hostingMocks.getOrCreateHostingConfig.mockResolvedValue({ subdomain: "roomify-test" });
});

describe("authentication actions", () => {
  it("delegates sign-in and sign-out to Puter", async () => {
    puterMocks.signIn.mockResolvedValue({ username: "hari" });
    puterMocks.signOut.mockReturnValue("signed-out");

    await expect(signIn()).resolves.toEqual({ username: "hari" });
    expect(signOut()).toBe("signed-out");
  });

  it("returns the current user or null when Puter rejects", async () => {
    const user = { username: "hari" };
    puterMocks.getUser.mockResolvedValueOnce(user).mockRejectedValueOnce(new Error("offline"));

    await expect(getCurrentUser()).resolves.toBe(user);
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("createProject", () => {
  const item: DesignItem = {
    id: "project-1",
    name: "Loft",
    sourceImage: "data:image/png;base64,c291cmNl",
    sourcePath: "/tmp/source.png",
    renderedImage: "data:image/png;base64,cmVuZGVy",
    renderedPath: "/tmp/rendered.png",
    publicPath: "/tmp/public.json",
    timestamp: 123,
    isPublic: false,
  };

  it("uploads both images and returns only hosted URLs in the payload", async () => {
    hostingMocks.uploadImageToHosting
      .mockResolvedValueOnce({ url: "https://roomify-test.puter.site/project/project-1/source.png" })
      .mockResolvedValueOnce({ url: "https://roomify-test.puter.site/project/project-1/rendered.png" });

    await expect(createProject({ item, visibility: "private" })).resolves.toEqual({
      id: "project-1",
      name: "Loft",
      sourceImage: "https://roomify-test.puter.site/project/project-1/source.png",
      renderedImage: "https://roomify-test.puter.site/project/project-1/rendered.png",
      timestamp: 123,
      isPublic: false,
    });

    expect(hostingMocks.getOrCreateHostingConfig).toHaveBeenCalledOnce();
    expect(hostingMocks.uploadImageToHosting).toHaveBeenNthCalledWith(1, {
      hosting: { subdomain: "roomify-test" },
      url: item.sourceImage,
      projectId: "project-1",
      label: "source",
    });
    expect(hostingMocks.uploadImageToHosting).toHaveBeenNthCalledWith(2, {
      hosting: { subdomain: "roomify-test" },
      url: item.renderedImage,
      projectId: "project-1",
      label: "rendered",
    });
  });

  it("does not attempt a rendered upload when the project has no render", async () => {
    hostingMocks.uploadImageToHosting.mockResolvedValue({
      url: "https://roomify-test.puter.site/project/project-1/source.png",
    });
    const sourceOnly = { ...item, renderedImage: undefined, renderedPath: undefined };

    const result = await createProject({ item: sourceOnly });

    expect(hostingMocks.uploadImageToHosting).toHaveBeenCalledOnce();
    expect(result?.renderedImage).toBeUndefined();
  });

  it("keeps already-hosted source and render URLs when uploads return null", async () => {
    hostingMocks.uploadImageToHosting.mockResolvedValue(null);
    const hostedItem = {
      ...item,
      sourceImage: "https://roomify-existing.puter.site/project/1/source.png",
      renderedImage: "https://roomify-existing.puter.site/project/1/rendered.png",
    };

    await expect(createProject({ item: hostedItem })).resolves.toMatchObject({
      sourceImage: hostedItem.sourceImage,
      renderedImage: hostedItem.renderedImage,
    });
  });

  it("drops an unhosted render when render upload fails but preserves the project", async () => {
    hostingMocks.uploadImageToHosting
      .mockResolvedValueOnce({ url: "https://roomify-test.puter.site/project/project-1/source.png" })
      .mockResolvedValueOnce(null);

    await expect(createProject({ item })).resolves.toMatchObject({
      sourceImage: "https://roomify-test.puter.site/project/project-1/source.png",
      renderedImage: undefined,
    });
  });

  it("returns null and warns when an unhosted source cannot be uploaded", async () => {
    hostingMocks.uploadImageToHosting.mockResolvedValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(createProject({ item })).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith("Failed to host source image, skipping save.");
  });

  it("does not attempt uploads for an empty project id", async () => {
    const hostedSource = "https://roomify-existing.puter.site/project/1/source.png";

    await expect(
      createProject({ item: { ...item, id: "", sourceImage: hostedSource, renderedImage: undefined } }),
    ).resolves.toMatchObject({ id: "", sourceImage: hostedSource });
    expect(hostingMocks.uploadImageToHosting).not.toHaveBeenCalled();
  });
});

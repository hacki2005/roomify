// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("../../components/Navbar", () => ({ default: () => <nav>Navbar</nav> }));
vi.mock("../../components/ui/Button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));
vi.mock("../../components/Upload", () => ({
  default: ({ onComplete }: UploadProps) => (
    <button type="button" onClick={() => void onComplete("data:image/png;base64,c291cmNl")}>
      Complete upload
    </button>
  ),
}));
vi.mock("../../lib/puter.action", () => ({ createProject: mocks.createProject }));

import Home, { meta } from "./home";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("home route", () => {
  it("provides the route metadata", () => {
    expect(meta({} as never)).toEqual([
      { title: "New React Router App" },
      { name: "description", content: "Welcome to React Router!" },
    ]);
  });

  it("creates a private project, lists it, and navigates with hosted images", async () => {
    mocks.createProject.mockResolvedValue({
      id: "1700000000000",
      name: "Residence 1700000000000",
      sourceImage: "https://roomify-test.puter.site/project/1700000000000/source.png",
      renderedImage: "https://roomify-test.puter.site/project/1700000000000/rendered.png",
      timestamp: 1_700_000_000_000,
    });

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Complete upload" }));

    await waitFor(() => expect(mocks.createProject).toHaveBeenCalledOnce());
    expect(mocks.createProject).toHaveBeenCalledWith({
      item: {
        id: "1700000000000",
        name: "Residence 1700000000000",
        sourceImage: "data:image/png;base64,c291cmNl",
        renderedImage: undefined,
        timestamp: 1_700_000_000_000,
      },
      visibility: "private",
    });
    expect(await screen.findByText("Residence 1700000000000")).toBeTruthy();
    expect(mocks.navigate).toHaveBeenCalledWith("/visualizer/1700000000000", {
      state: {
        initialImage: "https://roomify-test.puter.site/project/1700000000000/source.png",
        initialRendered: "https://roomify-test.puter.site/project/1700000000000/rendered.png",
      },
    });
  });

  it("does not list or navigate to a project when persistence fails", async () => {
    mocks.createProject.mockResolvedValue(null);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Complete upload" }));

    await waitFor(() => expect(error).toHaveBeenCalledWith("Failed to create project"));
    expect(screen.queryByText("Residence 1700000000000")).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

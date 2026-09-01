// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";

import VisualizerId from "./visualizer.$id";

afterEach(cleanup);

describe("visualizer route", () => {
  it("renders the project name and source image from navigation state", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/visualizer/42",
            state: { name: "Kitchen", initialImage: "https://example.com/source.png" },
          },
        ]}
      >
        <VisualizerId />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Kitchen" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "source" }).getAttribute("src")).toBe(
      "https://example.com/source.png",
    );
  });

  it("uses the untitled fallback when navigation state is absent", () => {
    render(
      <MemoryRouter initialEntries={["/visualizer/42"]}>
        <VisualizerId />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Untitled project" })).toBeTruthy();
  });
});

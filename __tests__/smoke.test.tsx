import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage smoke test", () => {
  it("renders the app heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: /CaloriesPro/i })).toBeInTheDocument();
  });
});

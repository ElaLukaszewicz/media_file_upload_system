import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";

describe("App", () => {
  it("renders heading and button", () => {
    render(<App />);
    expect(screen.getByText(/Vite \+ React/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /count is/i }),
    ).toBeInTheDocument();
  });
});

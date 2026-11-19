// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
expect.extend(matchers);

import { PurifierPhotoReader } from "@/components/PurifierPhotoReader";

// Mock downscaleImage so it does not depend on canvas in jsdom
vi.mock("@/lib/image-downscale", () => ({
  downscaleImage: vi.fn().mockResolvedValue({
    base64: "fakebase64",
    mimeType: "image/jpeg",
  }),
}));

beforeEach(() => {
  global.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost:3000/fake-preview");
  global.URL.revokeObjectURL = vi.fn();
});

describe("PurifierPhotoReader Accessible Confirmation Dialog", () => {
  it("renders trigger button and passes initial axe audit", async () => {
    const handleApply = vi.fn();
    const { container } = render(<PurifierPhotoReader language="en" onApplyCadr={handleApply} />);

    const button = screen.getByRole("button", { name: /Scan label photo/i });
    expect(button).toBeDefined();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("opens modal dialog on successful label scan, announces CADR, and allows Escape to close", async () => {
    const handleApply = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve({
            data: {
              cadrM3h: 380,
              brand: "Philips",
              model: "Series 2000i",
              confidence: "high",
              unit: "m3h",
            },
          }),
      }),
    );

    const { container } = render(<PurifierPhotoReader language="en" onApplyCadr={handleApply} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test-image-content"], "label.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Dialog appears with accessible attributes
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    // Preview image has meaningful alt text
    const previewImg = screen.getByRole("img", {
      name: /Photograph of air purifier technical specification label/i,
    });
    expect(previewImg).toBeDefined();

    // Detected CADR announced (in polite live region and dialog body)
    expect(screen.getAllByText(/380 m³\/h/i).length).toBeGreaterThanOrEqual(1);

    // Axe audit on dialog view
    const results = await axe(container);
    expect(results.violations).toEqual([]);

    // Closes on Escape
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("applies CADR and restores focus on confirmation", async () => {
    const handleApply = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve({
            data: {
              cadrM3h: 450,
              brand: "Coway",
              model: "Airmega 150",
              confidence: "high",
              unit: "m3h",
            },
          }),
      }),
    );

    const { container } = render(<PurifierPhotoReader language="en" onApplyCadr={handleApply} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test-image-content"], "label.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const applyButton = screen.getByRole("button", { name: /Use this CADR/i });
    fireEvent.click(applyButton);

    expect(handleApply).toHaveBeenCalledWith(450);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

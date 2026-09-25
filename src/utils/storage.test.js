import { describe, expect, it, vi } from "vitest";
import { safeGet, safeRemove, safeSet } from "./storage";

describe("storage helpers", () => {
  it("round-trips JSON", () => {
    expect(safeSet("k", { a: 1 })).toBe(true);
    expect(safeGet("k")).toEqual({ a: 1 });
    safeRemove("k");
    expect(safeGet("k", "fallback")).toBe("fallback");
  });

  it("returns the fallback for corrupt JSON", () => {
    window.localStorage.setItem("k", "{not json");
    expect(safeGet("k", [])).toEqual([]);
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(safeSet("k", 1)).toBe(false);
    expect(safeGet("k", "fallback")).toBe("fallback");
  });
});

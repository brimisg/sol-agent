import { describe, it, expect } from "vitest";
import { getSurvivalTier, formatCredits } from "../../agent-client/credits.js";
import { SURVIVAL_THRESHOLDS } from "../../types.js";

describe("SURVIVAL_THRESHOLDS constants", () => {
  it("has expected values", () => {
    expect(SURVIVAL_THRESHOLDS.normal).toBe(50);
    expect(SURVIVAL_THRESHOLDS.low_compute).toBe(10);
    expect(SURVIVAL_THRESHOLDS.dead).toBe(0);
  });
});

describe("getSurvivalTier – boundary values", () => {
  it("51 → normal (> 50)", () => {
    expect(getSurvivalTier(51)).toBe("normal");
  });

  it("100 → normal", () => {
    expect(getSurvivalTier(100)).toBe("normal");
  });

  it("50 → low_compute (not > 50, but > 10)", () => {
    expect(getSurvivalTier(50)).toBe("low_compute");
  });

  it("11 → low_compute (> 10)", () => {
    expect(getSurvivalTier(11)).toBe("low_compute");
  });

  it("10 → critical (not > 10, but > 0)", () => {
    expect(getSurvivalTier(10)).toBe("critical");
  });

  it("5 → critical", () => {
    expect(getSurvivalTier(5)).toBe("critical");
  });

  it("1 → critical (> 0)", () => {
    expect(getSurvivalTier(1)).toBe("critical");
  });

  it("0 → dead", () => {
    expect(getSurvivalTier(0)).toBe("dead");
  });

  it("negative → dead", () => {
    expect(getSurvivalTier(-1)).toBe("dead");
  });
});

describe("formatCredits", () => {
  it("0 cents → '$0.00'", () => {
    expect(formatCredits(0)).toBe("$0.00");
  });

  it("500 cents → '$5.00'", () => {
    expect(formatCredits(500)).toBe("$5.00");
  });

  it("1 cent → '$0.01'", () => {
    expect(formatCredits(1)).toBe("$0.01");
  });

  it("100 cents → '$1.00'", () => {
    expect(formatCredits(100)).toBe("$1.00");
  });

  it("1234 cents → '$12.34'", () => {
    expect(formatCredits(1234)).toBe("$12.34");
  });

  it("10 cents → '$0.10'", () => {
    expect(formatCredits(10)).toBe("$0.10");
  });
});

import { describe, expect, it } from "vitest";
import { BASES, DEFAULT_PARAMS, type Params } from "../src/model";
import { bagPatch, qualified, readParams } from "../src/params";
import { PRESETS } from "../src/presets";

describe("the bag", () => {
  it("round-trips every param under the stage's keys", () => {
    const p: Params = { ...DEFAULT_PARAMS, red: [0.5, 0.3, 0.2], normalizeGrey: false, basis: BASES.cat16, gamut: 2 };
    expect(readParams(bagPatch(p))).toEqual(p);
    expect(bagPatch(p)[qualified("red")]).toEqual([0.5, 0.3, 0.2]);
  });

  it("reads missing and malformed values as the defaults", () => {
    const bag = { [qualified("red")]: [1, 2], [qualified("clip")]: 1, [qualified("gamut")]: Number.NaN };
    expect(readParams(bag)).toEqual(DEFAULT_PARAMS);
  });
});

describe("presets", () => {
  it("make the film B&W rows in XYZ with negatives clipped", () => {
    for (const p of PRESETS.filter((pr) => pr.id.startsWith("bw-"))) {
      expect(p.params.basis).toBe(BASES.xyz);
      expect(p.params.clip).toBe(true);
      expect(p.params.normalizeGrey).toBe(true);
      expect(p.params.grey.some((v) => v !== 0)).toBe(true);
    }
  });

  it("swap two outputs in the working RGB, B&W normalization off", () => {
    const swap = PRESETS.find((p) => p.id === "swap-rb")!.params;
    expect([swap.red, swap.green, swap.blue]).toEqual([
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ]);
    expect(swap.basis).toBe(BASES.rgb);
    expect(swap.normalizeGrey).toBe(false);
  });
});

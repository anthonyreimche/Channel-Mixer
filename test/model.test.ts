import { describe, expect, it } from "vitest";
import {
  BASES,
  DEFAULT_PARAMS,
  REC2020_TO_XYZ_D50,
  REC709_TO_REC2020,
  REC2020_TO_REC709,
  apply3,
  derive,
  effectiveMatrix,
  gamutMapping,
  isIdle,
  lumaChroma,
  mixPixel,
  mixWorking,
  type Params,
  type Vec3,
} from "../src/model";

const close = (a: readonly number[], b: readonly number[], tol: number) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(tol);
};

const withParams = (patch: Partial<Params>): Params => ({ ...DEFAULT_PARAMS, ...patch });
const SAMPLES: Vec3[] = [
  [0.18, 0.18, 0.18],
  [0.6, 0.3, 0.1],
  [0.05, 0.4, 0.2],
  [0.1, 0.15, 0.7],
  [0.9, 0.85, 0.8],
];

describe("defaults", () => {
  it("are the identity mixer with normalized rows, nothing else on", () => {
    expect(DEFAULT_PARAMS.red).toEqual([1, 0, 0]);
    expect(DEFAULT_PARAMS.green).toEqual([0, 1, 0]);
    expect(DEFAULT_PARAMS.blue).toEqual([0, 0, 1]);
    expect([DEFAULT_PARAMS.normalizeRed, DEFAULT_PARAMS.normalizeGreen, DEFAULT_PARAMS.normalizeBlue]).toEqual([
      true,
      true,
      true,
    ]);
    expect(DEFAULT_PARAMS.normalizeGrey).toBe(true);
    expect(DEFAULT_PARAMS.normalizeColourfulness).toBe(false);
    expect(DEFAULT_PARAMS.normalizeBrightness).toBe(false);
    expect(DEFAULT_PARAMS.basis).toBe(BASES.rgb);
    expect(DEFAULT_PARAMS.gamut).toBe(0);
    expect(DEFAULT_PARAMS.clip).toBe(false);
  });

  it("are idle, and so is any matrix that normalizes to the identity", () => {
    expect(isIdle(DEFAULT_PARAMS)).toBe(true);
    expect(isIdle(withParams({ red: [2, 0, 0], basis: BASES.cat16 }))).toBe(true);
  });

  it("stop being idle as soon as anything takes effect", () => {
    expect(isIdle(withParams({ red: [0.9, 0.1, 0] }))).toBe(false);
    expect(isIdle(withParams({ red: [2, 0, 0], normalizeRed: false }))).toBe(false);
    expect(isIdle(withParams({ colourfulness: [0, 0.1, 0] }))).toBe(false);
    expect(isIdle(withParams({ brightness: [0.1, 0, 0] }))).toBe(false);
    expect(isIdle(withParams({ grey: [0, 1, 0] }))).toBe(false);
    expect(isIdle(withParams({ gamut: 1 }))).toBe(false);
    expect(isIdle(withParams({ clip: true }))).toBe(false);
  });

  it("leave a pixel untouched when idle", () => {
    for (const s of SAMPLES) expect(mixPixel(s, DEFAULT_PARAMS)).toEqual(s);
  });
});

describe("the mixer matrix (commit_params)", () => {
  it("divides each normalized row by its sum", () => {
    const m = effectiveMatrix(withParams({ red: [2, 1, 1], green: [0, 3, 1], blue: [1, 1, 2], normalizeGreen: false }));
    close(m, [0.5, 0.25, 0.25, 0, 3, 1, 0.25, 0.25, 0.5], 1e-12);
  });

  it("leaves a row whose sum is zero as it is rather than dividing by zero", () => {
    const m = effectiveMatrix(withParams({ red: [1, -1, 0] }));
    close(m.slice(0, 3), [1, -1, 0], 0);
  });

  it("derives darktable's working coefficients for the outputs", () => {
    const d = derive(
      withParams({
        colourfulness: [0.3, 0.6, 0.9],
        normalizeColourfulness: true,
        brightness: [0.2, 0.4, 0.6],
        normalizeBrightness: true,
        grey: [1, 2, 1],
      }),
    );
    // saturation = -p + mean when normalized; lightness = p - mean.
    close(d.saturation, [0.3, 0, -0.3], 1e-12);
    close(d.lightness, [-0.2, 0, 0.2], 1e-12);
    close(d.grey, [0.25, 0.5, 0.25], 1e-12);
    expect(d.applyGrey).toBe(true);
  });

  it("turns the gamut slider into the compression exponent 1 / gamut, 0 off", () => {
    expect(derive(withParams({ gamut: 0 })).compression).toBe(0);
    expect(derive(withParams({ gamut: 4 })).compression).toBe(0.25);
  });
});

describe("the working-space mix", () => {
  const active = (patch: Partial<Params>) => withParams({ clip: true, ...patch });

  it("swaps red and blue in the working RGB basis", () => {
    const p = active({ red: [0, 0, 1], blue: [1, 0, 0] });
    for (const s of SAMPLES) close(mixWorking(s, p), [s[2], s[1], s[0]], 1e-6);
  });

  it("keeps in-gamut colours through the identity mix in every basis", () => {
    for (const s of SAMPLES) close(mixWorking(s, active({ basis: BASES.rgb })), s, 2e-6);
    // The other bases adapt by the D50 constant over the pipeline illuminant,
    // which differ in the fourth digit, and the 4-digit Bradford pair is not an
    // exact inverse: Ansel's own identity drifts by this much.
    for (const basis of [BASES.xyz, BASES.bradford, BASES.cat16]) {
      for (const s of SAMPLES) close(mixWorking(s, active({ basis })), s, 5e-4);
    }
  });

  it("clips negative working RGB when asked, and lets it through when not", () => {
    const s: Vec3 = [0.3, -0.02, 0.2];
    expect(Math.min(...mixWorking(s, active({ red: [1, 0, 0.0001] })))).toBeGreaterThanOrEqual(0);
    expect(mixWorking(s, withParams({ red: [1, 0, 0.0001] }))[1]).toBeLessThan(0);
  });

  it("makes a pixel black where its luminance Y is not positive", () => {
    expect(mixWorking([0.0, -0.1, 0.0], withParams({ red: [0.9, 0.1, 0] }))).toEqual([0, 0, 0]);
  });

  it("renders B&W from the grey row: every channel the row's mix, normalized", () => {
    const p = active({ grey: [0, 2, 0], basis: BASES.xyz });
    for (const s of SAMPLES) {
      const Y = apply3(REC2020_TO_XYZ_D50, s)[1];
      close(mixWorking(s, p), [Y, Y, Y], 1e-6);
    }
  });
});

describe("colourfulness and brightness (luma_chroma, version 3)", () => {
  const zero: Vec3 = [0, 0, 0];

  it("is the identity at zero", () => {
    for (const s of SAMPLES) close(lumaChroma(s, zero, zero), s, 1e-12);
  });

  it("leaves greys alone and spreads colours apart with more colourfulness", () => {
    const grey: Vec3 = [0.3, 0.3, 0.3];
    close(lumaChroma(grey, [-0.5, -0.5, -0.5], zero), grey, 1e-12);
    const c: Vec3 = [0.6, 0.3, 0.1];
    const out = lumaChroma(c, [-0.5, -0.5, -0.5], zero);
    expect(out[0] - out[2]).toBeGreaterThan(c[0] - c[2]);
  });

  it("scales the pixel by 1 + (pixel · lightness) / mean", () => {
    const c: Vec3 = [0.6, 0.3, 0.1];
    const L: Vec3 = [0.1, 0.2, 0];
    const gain = 1 + (0.6 * 0.1 + 0.3 * 0.2) / ((0.6 + 0.3 + 0.1) / 3);
    close(lumaChroma(c, zero, L), c.map((v) => v * gain), 1e-12);
  });
});

describe("gamut compression (gamut_mapping)", () => {
  it("is an xyY round trip at compression 0", () => {
    const xyz: Vec3 = [0.3, 0.25, 0.1];
    close(gamutMapping(xyz, 0, false), xyz, 1e-12);
  });

  it("pulls saturated colours toward D50 and leaves the white point alone", () => {
    const d50: Vec3 = [0.9642119944211994 * 0.5, 0.5, 0.8251882845188288 * 0.5];
    close(gamutMapping(d50, 1, false), d50, 1e-6);
    const xyz = apply3(REC2020_TO_XYZ_D50, [0.8, 0.05, 0.05]);
    const out = gamutMapping(xyz, 1, false);
    expect(out[1]).toBeCloseTo(xyz[1], 12);
    const x = (v: readonly number[]) => v[0] / (v[0] + v[1] + v[2]);
    expect(Math.abs(x(out) - 0.3457)).toBeLessThan(Math.abs(x(xyz) - 0.3457));
  });

  it("rescales a chromaticity past the spectrum line so Z is not negative", () => {
    const out = gamutMapping([0.8, 0.5, -0.1], 0, false);
    expect(out[2]).toBeCloseTo(0, 12);
  });
});

describe("the stage's frame of reference", () => {
  it("round-trips linear Rec.709 through the Rec.2020 working space", () => {
    for (const s of SAMPLES) close(apply3(REC2020_TO_REC709, apply3(REC709_TO_REC2020, s)), s, 1e-12);
  });

  it("mixes in Rec.2020: mixPixel is mixWorking between the two conversions", () => {
    const p = withParams({ red: [0.8, 0.2, 0], clip: true });
    for (const s of SAMPLES) {
      close(mixPixel(s, p), apply3(REC2020_TO_REC709, mixWorking(apply3(REC709_TO_REC2020, s), p)), 1e-12);
    }
  });
});

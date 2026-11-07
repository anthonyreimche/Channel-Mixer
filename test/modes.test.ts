import { describe, expect, it } from "vitest";
import { BASES, IDENTITY, type Mat3 } from "../src/model";
import {
  basisWhite,
  decodeCoupling,
  decodeStretch,
  encodeCoupling,
  encodeStretch,
  primariesFromMatrix,
  primariesToMatrix,
  readMode,
  simpleFromMatrix,
  simpleToMatrix,
  whitePreservingFromMatrix,
  whitePreservingToMatrix,
  type Primaries,
  type Simple,
  type WhitePreserving,
} from "../src/modes";

const ALL_BASES = [BASES.rgb, BASES.xyz, BASES.bradford, BASES.cat16];
const maxDiff = (a: Mat3, b: Mat3) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const mulVec = (m: Mat3, v: readonly number[]) => [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);
const rowSums = (m: Mat3) => [0, 1, 2].map((r) => m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2]);

const IDENTITY_SIMPLE: Simple = { theta: 0, psi: 0, stretch1: 1, stretch2: 1, couplingAmount: 0, couplingHue: 0 };
const IDENTITY_PRIMARIES: Primaries = {
  whiteHue: 0,
  whitePurity: 0,
  redHue: 0,
  redPurity: 1,
  greenHue: 0,
  greenPurity: 1,
  blueHue: 0,
  bluePurity: 1,
  gain: 1,
};
const IDENTITY_WHITE: WhitePreserving = {
  redRotation: 0,
  redSaturation: 0,
  greenRotation: 0,
  greenSaturation: 0,
  blueRotation: 0,
  blueSaturation: 0,
};

describe("simple mode", () => {
  it("reads the identity as no rotation, unit stretches and no coupling", () => {
    const s = simpleFromMatrix(IDENTITY);
    expect(s.theta).toBeCloseTo(0, 6);
    expect(s.stretch1).toBeCloseTo(1, 6);
    expect(s.stretch2).toBeCloseTo(1, 6);
    expect(s.couplingAmount).toBeCloseTo(0, 6);
    expect(maxDiff(simpleToMatrix(IDENTITY_SIMPLE), IDENTITY)).toBeLessThan(1e-7);
  });

  it("builds matrices whose rows sum to 1, so normalized rows keep them", () => {
    const m = simpleToMatrix({ theta: 0.7, psi: -0.4, stretch1: 1.3, stretch2: 0.6, couplingAmount: 0.4, couplingHue: 2 });
    for (const s of rowSums(m)) expect(s).toBeCloseTo(1, 6);
  });

  it("reads back the parameters it was built from", () => {
    const cases: Simple[] = [
      { theta: 0.7, psi: -0.4, stretch1: 1.3, stretch2: 0.6, couplingAmount: 0.4, couplingHue: 2 },
      { theta: -2.5, psi: 0.9, stretch1: 0.4, stretch2: -0.8, couplingAmount: 1.1, couplingHue: -1 },
    ];
    for (const c of cases) {
      const m = simpleToMatrix(c);
      expect(maxDiff(simpleToMatrix(simpleFromMatrix(m)), m)).toBeLessThan(5e-5);
    }
  });

  it("only takes normalized rows", () => {
    const rows = { red: [1, 0, 0], green: [0, 1, 0], blue: [0, 0, 1] } as const;
    expect(readMode("simple", { ...rows, normalize: [true, true, true] }, BASES.rgb).ok).toBe(true);
    expect(readMode("simple", { ...rows, normalize: [true, false, true] }, BASES.rgb).ok).toBe(false);
  });

  it("represents any normalized matrix: a reflection, a shear, a general mix", () => {
    // Normalized rows fix the achromatic column of the chroma-basis matrix, and
    // every 2×2 chroma block is a rotation times a symmetric stretch.
    const normalize = [true, true, true] as const;
    const swap = { red: [0, 1, 0], green: [1, 0, 0], blue: [0, 0, 1], normalize };
    const shear = { red: [1, 0.5, -0.5], green: [0, 1, 0], blue: [0, 0, 1], normalize };
    const mix = { red: [0.2, 0.9, -0.1], green: [0.4, 0.4, 0.2], blue: [0.1, 0.1, 0.8], normalize };
    for (const rows of [swap, shear, mix]) expect(readMode("simple", rows, BASES.rgb).ok).toBe(true);
  });

  it("maps its slider encodings both ways", () => {
    for (const v of [-2, -1.2, -0.4, 0, 0.6, 1, 1.8]) expect(decodeStretch(encodeStretch(v))).toBeCloseTo(v, 6);
    expect(encodeStretch(5)).toBe(1.5);
    expect(decodeStretch(1.5)).toBe(2);
    for (const v of [0, 0.3, 1, 4]) expect(decodeCoupling(encodeCoupling(v))).toBeCloseTo(v, 5);
  });
});

describe("primaries mode", () => {
  it("is the identity at its defaults in the RGB basis, and reads it back so", () => {
    expect(maxDiff(primariesToMatrix(BASES.rgb, IDENTITY_PRIMARIES)!, IDENTITY)).toBeLessThan(1e-6);
    const p = primariesFromMatrix(BASES.rgb, IDENTITY)!;
    expect(p.gain).toBeCloseTo(1, 6);
    expect(p.whitePurity).toBeCloseTo(0, 5);
    expect(p.redPurity).toBeCloseTo(1, 5);
    expect(p.redHue).toBeCloseTo(0, 5);
  });

  it("puts the basis white where the defaults' columns add up, in the other bases", () => {
    // Its white is M · (1, 1, 1) against D50 in the basis, so the identity
    // reads as a tinted white there, and the defaults map (1, 1, 1) to D50.
    for (const b of [BASES.xyz, BASES.bradford, BASES.cat16]) {
      const out = mulVec(primariesToMatrix(b, IDENTITY_PRIMARIES)!, [1, 1, 1]);
      const w = basisWhite(b);
      for (let i = 0; i < 3; i++) expect(out[i]).toBeCloseTo(w[i], 6);
      expect(maxDiff(primariesToMatrix(b, primariesFromMatrix(b, IDENTITY)!)!, IDENTITY)).toBeLessThan(5e-5);
    }
  });

  it("round-trips an edited state", () => {
    const edit: Primaries = { ...IDENTITY_PRIMARIES, whiteHue: 0.4, whitePurity: 0.1, redHue: 0.2, greenPurity: 0.8, gain: 1.2 };
    for (const b of ALL_BASES) {
      const m = primariesToMatrix(b, edit)!;
      expect(maxDiff(primariesToMatrix(b, primariesFromMatrix(b, m)!)!, m)).toBeLessThan(5e-5);
    }
  });

  it("scales the basis white by the gain", () => {
    const m = primariesToMatrix(BASES.rgb, { ...IDENTITY_PRIMARIES, gain: 2 })!;
    for (const v of mulVec(m, [1, 1, 1])) expect(v).toBeCloseTo(2, 6);
  });
});

describe("white-preserving mode", () => {
  it("is the identity at zero", () => {
    for (const b of ALL_BASES) expect(maxDiff(whitePreservingToMatrix(b, IDENTITY_WHITE)!, IDENTITY)).toBeLessThan(1e-6);
  });

  it("keeps the basis white where it is, whatever the primaries do", () => {
    const edit: WhitePreserving = { ...IDENTITY_WHITE, redRotation: 0.3, greenSaturation: 0.5, blueRotation: -0.6, blueSaturation: -0.3 };
    for (const b of ALL_BASES) {
      const w = basisWhite(b);
      const m = whitePreservingToMatrix(b, edit)!;
      const out = mulVec(m, w);
      for (let i = 0; i < 3; i++) expect(out[i]).toBeCloseTo(w[i], 5);
    }
  });

  it("is the classic saturation matrix for a uniform saturation in RGB", () => {
    const s = 0.4;
    const m = whitePreservingToMatrix(BASES.rgb, { ...IDENTITY_WHITE, redSaturation: s, greenSaturation: s, blueSaturation: s })!;
    const expected = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (r === c ? 1 + s : 0) - s / 3));
    expect(maxDiff(m, expected)).toBeLessThan(1e-6);
  });

  it("refuses primaries that collapse onto the white", () => {
    const flat = { ...IDENTITY_WHITE, redSaturation: -1, greenSaturation: -1, blueSaturation: -1 };
    expect(whitePreservingToMatrix(BASES.rgb, flat)).toBeNull();
  });

  it("only takes matrices that keep the white", () => {
    const keeps = whitePreservingToMatrix(BASES.rgb, { ...IDENTITY_WHITE, redRotation: 0.2 })!;
    const rows = (m: Mat3) => ({ red: m.slice(0, 3), green: m.slice(3, 6), blue: m.slice(6, 9), normalize: [false, false, false] });
    expect(readMode("white-preserving", rows(keeps), BASES.rgb).ok).toBe(true);
    const moves = [1.2, 0, 0, 0, 1, 0, 0, 0, 1];
    expect(readMode("white-preserving", rows(moves), BASES.rgb).ok).toBe(false);
    const read = whitePreservingFromMatrix(BASES.rgb, keeps)!;
    expect(read.redRotation).toBeCloseTo(0.2, 5);
  });
});

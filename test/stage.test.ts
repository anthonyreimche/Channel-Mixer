// A stage runs on every photo, so at its defaults it must leave the image as
// it was. Unit tests can't run GLSL (the reference rig renders it against
// Ansel); these hold the parts that make the idle stage a no-op and keep the
// shader's constants the model's.

import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, REC709_TO_REC2020 } from "../src/model";
import { PARAM_KEYS } from "../src/params";
import { glslLiteral, mixerStage } from "../src/stage";

const stage = mixerStage();

describe("mixerStage", () => {
  it("declares one uniform per param, defaulting to the model's defaults", () => {
    expect(new Set(stage.uniforms.map((u) => u.key))).toEqual(new Set(PARAM_KEYS));
    for (const u of stage.uniforms) {
      const d = DEFAULT_PARAMS[u.key as keyof typeof DEFAULT_PARAMS];
      expect(u.default).toEqual(Array.isArray(d) ? [...d] : d);
    }
  });

  it("only touches the pixel inside the branch the idle test guards", () => {
    const body = stage.glsl;
    const branch = body.indexOf("if (!cmIdle) {");
    expect(branch).toBeGreaterThan(0);
    expect(body.match(/\blin\s*=/g)).toHaveLength(1);
    expect(body.indexOf("lin =")).toBeGreaterThan(branch);
    for (const term of ["cmMix == mat3(1.0)", "cmSat == vec3(0.0)", "cmLight == vec3(0.0)", "!cmMono", "cmCompression == 0.0", "!clip"]) {
      expect(body).toContain(term);
    }
  });

  it("takes linear Rec.709 as the core hands it, converting inside the branch", () => {
    expect(stage.space).toBeUndefined();
    expect(stage.phase).toBe("scene-linear");
    expect(stage.helpers).toContain(glslLiteral(REC709_TO_REC2020[0]));
  });

  it("is maskable, so a mask can carry its own mixer", () => {
    expect(stage.mask).toEqual({ maskable: true });
  });

  it("writes float literals GLSL accepts", () => {
    expect(glslLiteral(1)).toBe("1.000000000");
    expect(glslLiteral(-2)).toBe("-2.000000000");
    expect(glslLiteral(0.25)).toBe("0.2500000000");
    expect(glslLiteral(1.52587890625e-5)).toBe("0.00001525878906");
  });
});

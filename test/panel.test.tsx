// The panel over the photo's mixer: drags write the bag live and commit on
// release; the mode menu refuses a mode that can't show the matrix, and the
// reduced modes rebuild the rows from their own values.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { activate } from "../src/index";
import { DEFAULT_PARAMS, effectiveMatrix, type Params } from "../src/model";
import { simpleToMatrix, IDENTITY_SIMPLE } from "../src/modes";
import { ChannelMixerPanel } from "../src/Panel";
import { bagPatch, readParams } from "../src/params";
import { PRESETS } from "../src/presets";
import { React } from "../src/rt";
import { fakeApi } from "./support/fake-api";

function setup(params: Partial<Params> = {}) {
  const rig = fakeApi(bagPatch({ ...DEFAULT_PARAMS, ...params }));
  activate(rig.api);
  const view = render(<ChannelMixerPanel />);
  const sliders = () => rig.sliders(view.container);
  const slider = (label: string, section?: string) => {
    const root = section ? screen.getByRole("region", { name: section }) : view.container;
    const found = rig.sliders(root).filter((s) => s.label === label);
    if (found.length !== 1) throw new Error(`${found.length} sliders labelled ${label}`);
    return found[0];
  };
  const mixer = () => readParams(rig.params());
  const chooseMode = (label: string) =>
    act(() => {
      fireEvent.change(screen.getByLabelText("Mixer mode"), { target: { value: label } });
    });
  return { rig, view, sliders, slider, mixer, chooseMode };
}

afterEach(cleanup);

describe("Complete mode", () => {
  it("shows each output row's inputs and its normalize switch", () => {
    const { slider } = setup({ red: [0.8, 0.3, -0.1] });
    expect(slider("Input R", "Output red")).toMatchObject({ value: 0.8, min: -2, max: 2, defaultValue: 1 });
    expect(slider("Input B", "Output red").value).toBe(-0.1);
    expect(slider("Input G", "Output green").defaultValue).toBe(1);
    expect((screen.getByLabelText("Normalize output red") as HTMLInputElement).checked).toBe(true);
  });

  it("writes a coefficient live and commits it on release", () => {
    const { rig, slider, mixer } = setup();
    act(() => slider("Input G", "Output red").onChange(0.25));
    expect(mixer().red).toEqual([1, 0.25, 0]);
    expect(rig.commits).toEqual([]);
    act(() => slider("Input G", "Output red").onCommit?.());
    expect(rig.commits).toEqual(["Channel Mixer output red input g"]);
  });

  it("toggles a row's normalization as one step", () => {
    const { rig, mixer } = setup();
    act(() => {
      fireEvent.click(screen.getByLabelText("Normalize output blue"));
    });
    expect(mixer().normalizeBlue).toBe(false);
    expect(rig.commits).toEqual(["Channel Mixer normalize output blue"]);
  });
});

describe("the mode menu", () => {
  it("refuses Simple while a row isn't normalized, and says why", () => {
    const { chooseMode, mixer } = setup({ normalizeGreen: false });
    chooseMode("simple");
    expect((screen.getByLabelText("Mixer mode") as HTMLSelectElement).value).toBe("complete");
    expect(screen.getByRole("status").textContent).toMatch(/normalized/);
    expect(mixer().normalizeGreen).toBe(false);
  });

  it("shows Simple's controls for a normalized mixer, writing nothing", () => {
    const { rig, chooseMode, slider } = setup();
    chooseMode("simple");
    expect(slider("Hue rotation").value).toBeCloseTo(0, 6);
    expect(slider("u stretch").value).toBeCloseTo(1, 6);
    expect(rig.commits).toEqual([]);
  });

  it("rotates the hue from Simple, keeping the rows normalized", () => {
    const { rig, chooseMode, slider, mixer } = setup();
    chooseMode("simple");
    act(() => slider("Hue rotation").onChange(40));
    act(() => slider("Hue rotation").onCommit?.());
    const expected = simpleToMatrix({ ...IDENTITY_SIMPLE, theta: (40 * Math.PI) / 180 });
    effectiveMatrix(mixer()).forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6));
    expect([mixer().normalizeRed, mixer().normalizeGreen, mixer().normalizeBlue]).toEqual([true, true, true]);
    expect(rig.commits).toEqual(["Channel Mixer hue rotation"]);
  });

  it("keeps the stretch the user drags, even past the other one", () => {
    const { chooseMode, slider } = setup();
    chooseMode("simple");
    act(() => slider("u stretch").onChange(0.4));
    // Read back from the matrix the larger stretch would come first.
    expect(slider("u stretch").value).toBeCloseTo(0.4, 6);
    expect(slider("v stretch").value).toBeCloseTo(1, 6);
  });

  it("writes the applied matrix with normalization off on entering Primaries", () => {
    const { rig, chooseMode, mixer } = setup({ red: [2, 1, 1] });
    chooseMode("primaries");
    expect(mixer().red).toEqual([0.5, 0.25, 0.25]);
    expect([mixer().normalizeRed, mixer().normalizeGreen, mixer().normalizeBlue]).toEqual([false, false, false]);
    expect(rig.commits).toEqual(["Channel Mixer primaries mode"]);
  });

  it("refuses White-preserving for a mixer that moves the white", () => {
    const { chooseMode } = setup({ red: [1.2, 0, 0], normalizeRed: false });
    chooseMode("white-preserving");
    expect((screen.getByLabelText("Mixer mode") as HTMLSelectElement).value).toBe("complete");
    expect(screen.getByRole("status").textContent).toMatch(/white/);
  });

  it("falls back to the coefficients when an undo leaves a mixer the mode can't show", () => {
    const { rig, chooseMode, slider } = setup();
    chooseMode("simple");
    act(() => slider("Hue rotation").onChange(30));
    act(() => rig.replace(bagPatch({ ...DEFAULT_PARAMS, green: [0, 2, 0], normalizeGreen: false })));
    expect((screen.getByLabelText("Mixer mode") as HTMLSelectElement).value).toBe("complete");
    expect(slider("Input G", "Output green").value).toBe(2);
  });

  it("reads the mode's values afresh when the matrix changes from outside", () => {
    const { rig, chooseMode, slider } = setup();
    chooseMode("simple");
    act(() => slider("Hue rotation").onChange(30));
    act(() => rig.replace(bagPatch(DEFAULT_PARAMS)));
    expect(slider("Hue rotation").value).toBeCloseTo(0, 6);
  });
});

describe("outputs and space", () => {
  it("edits the colourfulness row on the Outputs tab", () => {
    const { slider, mixer } = setup();
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: "Outputs" }));
    });
    act(() => slider("Input B", "Colourfulness").onChange(0.3));
    expect(mixer().colourfulness).toEqual([0, 0, 0.3]);
    expect(slider("Input R", "B&W")).toMatchObject({ min: -2, max: 2, defaultValue: 0 });
  });

  it("sets the mixing space, gamut compression and clipping on the Space tab", () => {
    const { rig, slider, mixer } = setup();
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: "Space" }));
    });
    act(() => {
      fireEvent.change(screen.getByLabelText("Mixing space"), { target: { value: "3" } });
    });
    expect(mixer().basis).toBe(3);
    act(() => slider("Gamut compression").onChange(1.5));
    expect(mixer().gamut).toBe(1.5);
    act(() => {
      fireEvent.click(screen.getByLabelText("Clip negative RGB"));
    });
    expect(mixer().clip).toBe(true);
    expect(rig.commits).toEqual(["Channel Mixer mixing space", "Channel Mixer clip negative RGB"]);
  });
});

describe("presets", () => {
  it("sets every mixer value from the preset, as one step", () => {
    const { rig, mixer } = setup({ red: [0.7, 0.2, 0.1], colourfulness: [0.4, 0, 0] });
    act(() => {
      fireEvent.change(screen.getByLabelText("Channel Mixer preset"), { target: { value: "bw-hp5" } });
    });
    const hp5 = PRESETS.find((p) => p.id === "bw-hp5")!;
    expect(mixer()).toEqual(hp5.params);
    expect(rig.commits).toEqual(["Channel Mixer preset: B&W: ILFORD HP5+"]);
  });
});

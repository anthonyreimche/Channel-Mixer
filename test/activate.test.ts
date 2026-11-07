// What activate() registers: the mixer stage and the panel (with its mask
// sub-panel), all named under the manifest's id; deactivate() takes the stage
// back out.

import { describe, expect, it } from "vitest";
import manifest from "../safelight.json";
import { PANEL_ID, activate, deactivate } from "../src/index";
import { ChannelMixerPanel } from "../src/Panel";
import { EXT_ID, PARAM_KEYS, STAGE_ID, qualified } from "../src/params";
import { fakeApi } from "./support/fake-api";

describe("activate", () => {
  it("registers the mixer stage", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.stages.map((s) => s.id)).toEqual([STAGE_ID]);
  });

  it("registers the panel in Develop, and for masks over every mixer value", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.panels).toHaveLength(1);
    expect(rig.panels[0]).toMatchObject({
      id: PANEL_ID,
      title: "Channel Mixer",
      component: ChannelMixerPanel,
      defaultDock: { module: "develop", direction: "right" },
      mask: { component: ChannelMixerPanel, owns: PARAM_KEYS.map(qualified) },
    });
  });

  it("names its contributions under the manifest's id", () => {
    expect(EXT_ID).toBe(manifest.id);
    expect(PANEL_ID.startsWith(`${manifest.id}.`)).toBe(true);
    expect(STAGE_ID.startsWith(`${manifest.id}.`)).toBe(true);
  });

  it("unregisters the stage on deactivate, once", () => {
    const rig = fakeApi();
    activate(rig.api);
    deactivate();
    deactivate();
    expect(rig.unregistered).toEqual([STAGE_ID]);
  });
});

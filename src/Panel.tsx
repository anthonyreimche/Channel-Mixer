// The Channel Mixer panel: a preset menu, then three tabs. Mixer edits the
// 3×3 matrix in one of four modes (Complete shows the nine coefficients and
// each row's normalization; Simple, Primaries and White-preserving are other
// coordinates for the same matrix). Outputs holds the colourfulness,
// brightness and B&W rows, Space the mixing space, gamut compression and
// clipping. Labels and ranges follow the module this ports.
//
// It edits whatever useParamScope hands it: the photo's bag in the dock, a
// mask's in the Masking panel. A drag writes the scope live and commits on
// release, so one gesture is one undo step; each change starts from the bag
// the scope holds now, as drags outrun renders.

import { editMode, shownValues, switchMode } from "./controller";
import { BASES, asBasis, type Params, type Vec3 } from "./model";
import {
  MIXER_MODES,
  decodeCoupling,
  decodeStretch,
  encodeCoupling,
  encodeStretch,
  wrapPi,
  type MixerMode,
} from "./modes";
import { bagPatch, readParams } from "./params";
import { PRESETS } from "./presets";
import { React, api } from "./rt";
import { store, type Held, type Tab } from "./store";

const MODE_LABELS: Record<MixerMode, string> = {
  complete: "Complete",
  simple: "Simple",
  primaries: "Primaries",
  "white-preserving": "White-preserving",
};

const TABS: { value: Tab; label: string }[] = [
  { value: "mixer", label: "Mixer" },
  { value: "outputs", label: "Outputs" },
  { value: "space", label: "Space" },
];

const SPACES = [
  { value: String(BASES.rgb), label: "Working RGB (Rec. 2020)" },
  { value: String(BASES.xyz), label: "XYZ" },
  { value: String(BASES.bradford), label: "Bradford LMS" },
  { value: String(BASES.cat16), label: "CAT16 LMS" },
];

const DEG = Math.PI / 180;

/** One reduced-mode slider: its label and range in display units, and the
 *  conversion between those and the mode's value. */
interface ModeSlider {
  field: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  show(value: number): number;
  read(shown: number): number;
}

const degrees = (field: string, label: string, limit: number, wrap = false): ModeSlider => ({
  field,
  label,
  min: -limit,
  max: limit,
  step: 0.1,
  defaultValue: 0,
  show: (v) => (wrap ? wrapPi(v) : v) / DEG,
  read: (s) => s * DEG,
});

const plain = (field: string, label: string, min: number, max: number, defaultValue: number): ModeSlider => ({
  field,
  label,
  min,
  max,
  step: 0.001,
  defaultValue,
  show: (v) => v,
  read: (s) => s,
});

const SIMPLE: { title?: string; sliders: ModeSlider[] }[] = [
  { sliders: [degrees("theta", "Hue rotation", 180, true)] },
  {
    title: "Chroma",
    sliders: [
      degrees("psi", "Axes orientation", 90),
      { ...plain("stretch1", "u stretch", -1.5, 1.5, 1), show: encodeStretch, read: decodeStretch },
      { ...plain("stretch2", "v stretch", -1.5, 1.5, 1), show: encodeStretch, read: decodeStretch },
    ],
  },
  {
    title: "Achromatic coupling",
    sliders: [
      degrees("couplingHue", "Coupling hue", 180, true),
      { ...plain("couplingAmount", "Coupling amount", 0, 1, 0), show: encodeCoupling, read: decodeCoupling },
    ],
  },
];

const PRIMARIES: { title?: string; sliders: ModeSlider[] }[] = [
  { title: "Achromatic axis", sliders: [degrees("whiteHue", "White hue", 180), plain("whitePurity", "White purity", 0, 2, 0)] },
  { title: "Red primary", sliders: [degrees("redHue", "Red hue", 90), plain("redPurity", "Red purity", 0, 2, 1)] },
  { title: "Green primary", sliders: [degrees("greenHue", "Green hue", 90), plain("greenPurity", "Green purity", 0, 2, 1)] },
  { title: "Blue primary", sliders: [degrees("blueHue", "Blue hue", 90), plain("bluePurity", "Blue purity", 0, 2, 1)] },
  { title: "Gain correction", sliders: [plain("gain", "Gain", -8, 8, 1)] },
];

const percent = (field: string, label: string): ModeSlider => ({
  field,
  label,
  min: -100,
  max: 100,
  step: 0.1,
  defaultValue: 0,
  show: (v) => v * 100,
  read: (s) => s / 100,
});

const WHITE_PRESERVING: { title?: string; sliders: ModeSlider[] }[] = (["red", "green", "blue"] as const).map((c) => {
  const name = c[0].toUpperCase() + c.slice(1);
  return { title: `${name} primary`, sliders: [degrees(`${c}Rotation`, `${name} rotation`, 90), percent(`${c}Saturation`, `${name} saturation`)] };
});

const LAYOUTS = { simple: SIMPLE, primaries: PRIMARIES, "white-preserving": WHITE_PRESERVING } as const;

type RowKey = "red" | "green" | "blue" | "colourfulness" | "brightness" | "grey";
type FlagKey = "normalizeRed" | "normalizeGreen" | "normalizeBlue" | "normalizeColourfulness" | "normalizeBrightness" | "normalizeGrey";

const INPUTS = ["Input R", "Input G", "Input B"];

export function ChannelMixerPanel() {
  const { Slider } = api.components;
  const { Select, SegmentedControl, Section, Stack, Toggle } = api.ui;
  const scope = api.develop.useParamScope();
  const tab = store()((s) => s.tab);
  const mode = store()((s) => s.mode);
  const notice = store()((s) => s.notice);
  const held = store()((s) => s.held);

  const p = readParams(scope.getParams());
  const live = (): Params => readParams(scope.getParams());
  const apply = (patch: Partial<Params>) => scope.setParams(bagPatch({ ...live(), ...patch }));
  const commit = (what: string) => scope.commit(`Channel Mixer ${what}`);

  const rowSection = (title: string, key: RowKey, flag: FlagKey, min: number, max: number, identity: Vec3) => (
    <Section key={key} title={title}>
      <Stack gap={2}>
        {INPUTS.map((label, i) => (
          <Slider
            key={label}
            label={label}
            value={p[key][i]}
            min={min}
            max={max}
            step={0.001}
            defaultValue={identity[i]}
            onChange={(v) => {
              const row = [...live()[key]] as [number, number, number];
              row[i] = v;
              apply({ [key]: row });
            }}
            onCommit={() => commit(`${title.toLowerCase()} ${label.toLowerCase()}`)}
          />
        ))}
        <Toggle
          label="Normalize"
          ariaLabel={`Normalize ${title.toLowerCase()}`}
          checked={p[flag]}
          onChange={(checked) => {
            apply({ [flag]: checked });
            commit(`normalize ${title.toLowerCase()}`);
          }}
        />
      </Stack>
    </Section>
  );

  const shown: Held | null = shownValues(p, mode, held);
  const showMode: MixerMode = shown ? mode : "complete";

  const modeSliders = (h: Held) => {
    const values = h.values.values as unknown as Record<string, number>;
    const layout = LAYOUTS[h.values.mode];
    return layout.map((group, gi) => {
      const sliders = group.sliders.map((s) => (
        <Slider
          key={s.field}
          label={s.label}
          value={s.show(values[s.field])}
          min={s.min}
          max={s.max}
          step={s.step}
          defaultValue={s.defaultValue}
          onChange={(v) => {
            const current = shownValues(live(), h.values.mode, store().getState().held) ?? h;
            const result = editMode(live(), current, s.field, s.read(v));
            if (!result.ok) {
              store().getState().setNotice(result.notice);
              return;
            }
            store().getState().hold(result.held);
            apply(result.patch);
          }}
          onCommit={() => commit(s.label.toLowerCase())}
        />
      ));
      return group.title ? (
        <Section key={gi} title={group.title}>
          <Stack gap={2}>{sliders}</Stack>
        </Section>
      ) : (
        <Stack key={gi} gap={2}>
          {sliders}
        </Stack>
      );
    });
  };

  const onMode = (value: string) => {
    const next = value as MixerMode;
    const result = switchMode(live(), next);
    if (!result.ok) {
      store().getState().setMode("complete", null);
      store().getState().setNotice(result.notice);
      return;
    }
    store().getState().setMode(next, result.held);
    if (result.patch) {
      apply(result.patch);
      commit(`${MODE_LABELS[next].toLowerCase()} mode`);
    }
  };

  const mixer = (
    <Stack gap={4}>
      <Select
        ariaLabel="Mixer mode"
        value={showMode}
        options={MIXER_MODES.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
        onChange={onMode}
      />
      {notice ? <div role="status" style={{ color: api.ui.tokens.textSecondary, fontSize: 11 }}>{notice}</div> : null}
      {shown
        ? modeSliders(shown)
        : [
            rowSection("Output red", "red", "normalizeRed", -2, 2, [1, 0, 0]),
            rowSection("Output green", "green", "normalizeGreen", -2, 2, [0, 1, 0]),
            rowSection("Output blue", "blue", "normalizeBlue", -2, 2, [0, 0, 1]),
          ]}
    </Stack>
  );

  const outputs = (
    <Stack gap={4}>
      {rowSection("Colourfulness", "colourfulness", "normalizeColourfulness", -1, 1, [0, 0, 0])}
      {rowSection("Brightness", "brightness", "normalizeBrightness", -1, 1, [0, 0, 0])}
      {rowSection("B&W", "grey", "normalizeGrey", -2, 2, [0, 0, 0])}
    </Stack>
  );

  const space = (
    <Stack gap={4}>
      <Select
        ariaLabel="Mixing space"
        value={String(asBasis(p.basis))}
        options={SPACES}
        onChange={(v) => {
          apply({ basis: Number(v) });
          commit("mixing space");
        }}
      />
      <Slider
        label="Gamut compression"
        value={p.gamut}
        min={0}
        max={4}
        step={0.01}
        defaultValue={0}
        onChange={(v) => apply({ gamut: v })}
        onCommit={() => commit("gamut compression")}
      />
      <Toggle
        label="Clip negative RGB"
        checked={p.clip}
        onChange={(checked) => {
          apply({ clip: checked });
          commit("clip negative RGB");
        }}
      />
    </Stack>
  );

  return (
    <Stack gap={6} style={{ padding: 8 }}>
      <Select
        ariaLabel="Channel Mixer preset"
        value=""
        placeholder="Presets"
        options={PRESETS.map((pr) => ({ value: pr.id, label: pr.label }))}
        onChange={(id) => {
          const preset = PRESETS.find((pr) => pr.id === id);
          if (!preset) return;
          scope.setParams(bagPatch(preset.params));
          commit(`preset: ${preset.label}`);
        }}
      />
      <SegmentedControl size="sm" value={tab} options={TABS} onChange={(v) => store().getState().setTab(v as Tab)} />
      {tab === "mixer" ? mixer : tab === "outputs" ? outputs : space}
    </Stack>
  );
}


# Channel Mixer for Safelight

A [Safelight](https://github.com/anthonyreimche/SafeLight) extension that ports
the channel mixer of [**Ansel**](https://ansel.photos/)'s *colour calibration*
module: a 3×3 matrix that rebuilds each output channel from the input red,
green and blue, worked in the space of your choice, then colourfulness,
brightness and B&W rows on top. Ansel edits that one matrix four ways, and so
does this panel: the nine coefficients, or a hue rotation with chroma
stretches, or the matrix's primaries and white, or primaries turned around a
white that stays put.

## What it does

### The Mixer tab

Choose a **mode**. Every mode edits the same matrix, and the edit stores only
the matrix, so you can switch freely; a mode that can't show the current
matrix says why and stays on Complete.

- **Complete**: the nine coefficients, as *Output red / green / blue* rows of
  *Input R, G, B* (−2 to 2). Each row's **Normalize** divides it by its sum,
  so the row keeps a neutral grey neutral and only moves colour. All three are
  on by default.
- **Simple** (needs all three rows normalized): *Hue rotation* turns the whole
  chroma plane; *Axes orientation*, *u stretch* and *v stretch* scale chroma
  along two perpendicular axes (1 keeps it, 0 removes it, −1 reverses it,
  beyond ±1 adds contrast); *Coupling hue* and *Coupling amount* let one chroma
  direction brighten or darken the image.
- **Primaries**: where each output primary sits, by *hue* (a turn around the
  white) and *purity* (1 is the space's own primary, 0 the white), plus the
  *White hue*, *White purity* and *Gain* of the white the three columns add up
  to. Entering this mode writes the matrix as applied and turns the rows'
  normalization off, since the mode describes the matrix as it is applied.
- **White-preserving**: each primary's *rotation* around the white and
  *saturation* (its distance to the white, −100 % to +100 %); the column
  strengths are solved so the white maps to itself. A uniform saturation is
  the classic saturation matrix.

### The Outputs tab

- **Colourfulness**: per input channel, pushes colours away from grey (or,
  negative, toward it) without changing greys.
- **Brightness**: per input channel, brightens or darkens the pixel by how
  much of that channel it holds.
- **B&W**: any weight other than 0 turns the output monochrome, the grey being
  the weighted sum of the channels (normalized to a sum of 1 by default).

Each row has its own **Normalize**: colourfulness and brightness subtract the
row's mean, so only the differences between channels act.

### The Space tab

- **Mixing space**: *Working RGB (Rec. 2020)*, *XYZ*, *Bradford LMS* or
  *CAT16 LMS*. The matrix, the outputs and the primaries modes all work in it.
- **Gamut compression** (0 to 4): pulls the most saturated, brightest colours
  toward the white so they don't clip; 0 is off.
- **Clip negative RGB**: clamps negative values at each step.

### Presets

The menu at the top sets every mixer value at once: Ansel's film B&W
conversions (ILFORD HP5+, DELTA 100, DELTA 400 – 3200, FP4+, Fuji Acros 100,
weights from the makers' spectral sensitivities), a luminance B&W, a basic
channel mixer, and the three channel swaps.

**In masks:** add Channel Mixer to a mask from the Masking panel's Adjust tab
to mix inside that mask only.

**Defaults:** an untouched mixer renders the photo bit for bit unchanged, and
the dock header's *Reset to defaults* gives that back. Unlike Ansel, gamut
compression and clipping start off: Ansel applies them as soon as the module is
switched on, and a Safelight stage has no switch, so the first nudge of any
slider would also compress the gamut. Ansel's own *basic channel mixer* preset
has them off too; turn them on in the Space tab.

## The math

Faithful to `src/iop/channelmixerrgb.c` (params version 3, saturation
algorithm version 3) and `channelmixerrgb_shared.c` in Ansel: commit_params'
row normalization and output offsets, `loop_switch` for the four bases with
the illuminant at *same as pipeline (D50)*, `gamut_mapping` in CIE 1976 u'v'
around D50, `luma_chroma`, and the shared file's simple, primaries and
white-preserving parametrizations with their round-trip gates. The LMS
matrices are `chromatic_adaptation.h`'s, including the four-digit Bradford
pair; the Rec.709 and Rec.2020 matrices are the Bradford-adapted D50 ones lcms
builds for Ansel's profiles.

### How it maps onto Safelight

Ansel runs colour calibration early in its scene-referred pipe, in its working
space, linear Rec.2020. The extension's stage runs early in Safelight's
scene-linear phase (priority 20), after the core's linear edits and before the
tone and colour tools. It takes Safelight's linear Rec.709 and converts to
Rec.2020 and back inside its own branch, so an idle mixer costs nothing and
changes no bit. White balance is the core's, so Ansel's CAT tab isn't here;
its "adaptation" choice survives as the mixing space.

Differences from Ansel to be aware of:

- No non-linear Bradford: with the illuminant fixed at D50 it is the linear
  Bradford basis.
- Saturation algorithm versions 1 and 2 (legacy edits in Ansel) aren't ported.
- A normalized row that sums to exactly 0 is applied un-normalized; Ansel
  divides by zero there.
- The mode menu remembers the mode for the session, not across restarts.

### Tests

```bash
npm install
npm run check    # typecheck, build, then test
```

The unit tests pin the CPU model (`src/model.ts`, the pixel path) and the
modes (`src/modes.ts`) against Ansel's own formulas, and the panel's
behaviour. The shader was checked on Safelight's real renderer against
`ansel-cli` renders of a synthetic chart (22 cases: every basis, every output
row, gamut compression, clipping and all three reduced modes): largest
difference 3.2·10⁻⁶ in linear values, ΔE2000 0.000.

## Licence

GPL-3.0-or-later, as the Ansel code it ports.

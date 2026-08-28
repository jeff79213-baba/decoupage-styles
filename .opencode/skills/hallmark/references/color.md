# Colour

Most AI-generated UI fails on colour. It picks blue. It uses pure black. It draws a gradient from purple to cyan.

## Principles

- **OKLCH only.** Perceptually uniform; predictable lightness; consistent hue across tints.
- **One accent.** Maximum two. Everything else is neutral. The accent should occupy **3% or less** of any given viewport.
- **No pure extremes.** No `#000`, no `#fff`. Always tint with a trace of chroma toward the palette's anchor hue.
- **Tint the greys.** If your anchor hue is orange, your neutrals lean warm. If it's blue, they lean cool.

## Palette construction

A complete Hallmark palette has four layers.

1. **Paper** — the base surface. `oklch(96–98% 0.005–0.015 <anchor hue>)` for light mode.
2. **Ink** — the primary text. `oklch(16–22% 0.005–0.015 <anchor hue>)` for light mode.
3. **Neutrals** — 5 to 9 steps between Paper and Ink, each with the anchor's chroma tint.
4. **Accent** — one saturated colour with meaningful chroma (0.12–0.22).

Example (warm-oat anchor, hue 80):

```css
:root {
  --color-paper:    oklch(96%  0.012 80);
  --color-paper-2:  oklch(93%  0.014 80);
  --color-rule:     oklch(82%  0.010 80);
  --color-neutral:  oklch(56%  0.008 80);
  --color-muted:    oklch(40%  0.008 70);
  --color-ink:      oklch(18%  0.010 60);
  --color-accent:   #FC4C02;
  --color-focus:    oklch(55%  0.19  55);
}
```

## Contrast

| Content | Minimum | Target |
| --- | --- | --- |
| Body text | 4.5:1 | 7:1 |
| Large text (≥ 18.66px bold or 24px) | 3:1 | 4.5:1 |
| UI component boundaries | 3:1 | 4.5:1 |

## Dark mode recipe

- Paper: lightness 12–18% (not `#000`).
- Ink: lightness 92–96% (not `#fff`).
- Body font-weight: reduce by 50 units.
- Accent: reduce chroma by 0.02–0.04; increase lightness by 5–10%.
- Elevation: higher surfaces are *lighter*, not darker.
- Never switch the hue between modes.

## Bans

- **Pure `#000000`** anywhere.
- **Pure `#ffffff`** as a base surface.
- **Flat grey** (`oklch(L 0 H)` with zero chroma).
- **Purple-to-cyan gradients, purple-to-blue gradients, orange-to-pink gradients.**
- **Accent as background fill** covering more than ~5% of any view.
- **Grey text on coloured background.**
- **Three-colour gradients.** Two-stop gradients only.

## Use of the accent

The accent is a highlighter, not a colour block. Reach for it to:

- Mark an active nav item.
- Draw a focus ring.
- Underline a link on hover.
- Indicate a primary CTA's border or text.
- Place a small square beside a heading as a visual anchor.

Do not fill giant buttons with it. Do not set whole sections on it.

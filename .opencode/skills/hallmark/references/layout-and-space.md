# Layout and space

Layout is where "AI-generated" gets caught. Equal columns, everything centred, every card identical — these are the tells.

## Principles

- A layout has a **primary axis**. Left-biased, right-biased, top-heavy, or bottom-weighted. Centre-biased is a default, not a choice.
- **Asymmetry reads as intentional.** Symmetry reads as generated.
- **Spacing is a scale, not a value.** Pick one scale. Use it everywhere.
- **Varied spacing.** If every gap is 24px, the page is a template.
- **Break the grid on purpose.**

## The spacing scale

4pt base. Nine steps.

```css
:root {
  --space-3xs: 0.125rem;  /*  2px */
  --space-2xs: 0.25rem;   /*  4px */
  --space-xs:  0.5rem;    /*  8px */
  --space-sm:  0.75rem;   /* 12px */
  --space-md:  1rem;      /* 16px */
  --space-lg:  1.5rem;    /* 24px */
  --space-xl:  2.5rem;    /* 40px */
  --space-2xl: 4rem;      /* 64px */
  --space-3xl: 6rem;      /* 96px */
  --space-4xl: 9rem;      /* 144px */
}
```

- Use `gap` for sibling spacing. It's cleaner than stacked margins.
- Use `margin` only for optical adjustments or breaking out of the flow.

## Grids

- **Prefer CSS Grid** for page layout, **Flexbox** for component internals.
- `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` for fluid responsive grids.
- **Don't default to 3 columns of equal cards.** Break it: vary column widths.

## Asymmetry techniques

- **Wide left margin.** Treat the left as a permanent negative space.
- **Offset grids.** Odd columns wider than even. Or the other way.
- **Grid-breaks.** One element that deliberately extends past a column boundary.
- **Generous top, tight bottom** (or vice-versa).

## Depth

- Depth is **weight and scale**, not shadow.
- If you use shadow, use one:
  - **Whisper** — `0 1px 2px oklch(20% 0.01 <hue> / 0.05)` for hovering cards.
  - **Hairline** — `0 0 0 1px oklch(30% 0.01 <hue> / 0.06)` as an alternative to a 1px border.
- Z-index has **six levels, named.**

```css
:root {
  --z-base:     1;
  --z-raised:   10;
  --z-dropdown: 100;
  --z-sticky:   200;
  --z-modal:    400;
  --z-toast:    500;
  --z-tooltip:  600;
}
```

## Bans

- **Centre-aligned everything.**
- **`min-height: 100vh` hero with one centred sentence.**
- **Card-in-card.**
- **Identical feature grid.**
- **Equal padding on everything.**
- **`z-index: 9999`** and other ad-hoc z values.

## Page-edge clipping

Always pair clipped-edge with a global clip:

```css
html { overflow-x: clip; }
body { overflow-x: clip; }
```

Use `overflow-x: clip` rather than `overflow-x: hidden` — `clip` preserves `position: sticky` and `position: fixed` on descendants.

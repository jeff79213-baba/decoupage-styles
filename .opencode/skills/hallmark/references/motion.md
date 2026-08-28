# Motion

Most AI-generated motion is scattered — hover lifts on every card, fade-in on every scroll, bouncing icons. Quiet it. One orchestrated moment beats ten small ones.

## Principles

- **Animate only `transform` and `opacity`.** These are GPU-composited; they don't trigger layout.
- **Duration is three buckets.** Micro (100–150ms), minor (200–300ms), major (300–500ms). Exits are ~75% of the enter.
- **Easing is exponential ease-out.** Elements coming in slow down into place. Elements leaving accelerate away.
- **Motion serves perception.** If you can't explain what a transition communicates, cut it.
- **Reduced motion is non-optional.** `@media (prefers-reduced-motion: reduce)` collapses all spatial motion to opacity crossfade.

## Easings

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:  cubic-bezier(0.7,  0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

## Durations

```css
:root {
  --dur-micro: 120ms;
  --dur-short: 220ms;
  --dur-long:  420ms;
}
```

## Page-load orchestration

One sequence on page load. Stagger by DOM index using a CSS custom property.

```css
.reveal {
  opacity: 0;
  transform: translateY(8px);
  animation: reveal var(--dur-long) var(--ease-out) forwards;
  animation-delay: calc(var(--i, 0) * 60ms);
}
@keyframes reveal {
  to { opacity: 1; transform: none; }
}
```

Cap total stagger at ~500ms.

## State transitions

- Button hover / active: micro duration, `--ease-out`, `transform: translateY(-1px)` on hover, `translateY(0)` on active.
- Menu / tooltip / dropdown: short duration, `--ease-out` on open, `--ease-in` on close.
- Modal: long duration, scale-in (0.96 → 1) + opacity crossfade.
- Accordion: animate `grid-template-rows: 0fr` → `grid-template-rows: 1fr` (not `height`).

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 150ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
  }
  .reveal { animation: reveal-reduced 150ms linear forwards; }
  @keyframes reveal-reduced { to { opacity: 1; transform: none; } }
}
```

## Bans

- `ease` (browser default, mediocre).
- `linear` on anything except progress bars and ticking loaders.
- Bounce / elastic / overshoot on UI elements.
- Animating `width`, `height`, `top`, `left`, `margin`, `padding`.
- `will-change` set preemptively across a whole class.
- Parallax.
- Custom cursors.
- Scroll-driven animations without a reduced-motion fallback.
- Infinite loops (other than functional loaders).

# Slop test — 58 gates + pre-emit self-critique

Run this list before handing back any output. Every answer must be **no**.

---

## Pre-emit self-critique (six axes)

| # | Axis | What you're scoring |
|---|------|---------------------|
| **A** | **Philosophy** | Is there a clear *why* — a position the page is taking? |
| **B** | **Hierarchy** | Can a reader tell, in 2 seconds, what's primary, secondary, tertiary? |
| **C** | **Execution** | Are the details all in spec, or is there sloppiness? |
| **D** | **Specificity** | Does this look like *this brief* — or does it look like a generic "page that could be anyone"? |
| **E** | **Restraint** | Have you removed everything that isn't earning its place? |
| **F** | **Variety** | Does this output share a structural fingerprint with a previous Hallmark output? |

Record the six scores: `/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */`

---

## Visual

1. Is the display font Inter, Roboto, Open Sans, Poppins, Lato, or a system default?
2. Is there a purple-to-blue (or cyan-to-magenta) gradient anywhere — including a `background-clip: text` gradient headline?
3. Is there a 3-equal-column card grid with icon-above-heading tiles?
4. Is any card nested inside another card?
5. Is any card using a thick coloured left/right side-stripe border?
6. **Hero shape — centred-everything.** Is the hero `min-height: 100vh` with everything centred, OR are the eyebrow, title, lede, AND CTA all stacked on the same centred vertical axis?
7. Is pure `#000` or pure `#fff` used as a base colour anywhere?

## Structural

8. Does the page reuse a structure it shouldn't — either the generic AI template (Hero → 3 features → CTA → footer), or the same structural fingerprint as a previous Hallmark output?
9. Are sections separated only by equal whitespace, with no rule, no ornament, no colour shift?

## Microinteractions

10. Is `transition-all` (or `transition: all`) used anywhere?
11. Is `hover:scale-105` (or any uniform hover-scale) applied across multiple unrelated elements?
12. Are bouncy / overshoot easings used on UI state changes?
13. Does any element have *more than one* hover effect at the same time?
14. Are you animating `width`, `height`, `top`, `left`, `margin`, or `padding` anywhere?
15. Does the focus ring transition into existence (fade in)?
16. Is there a celebratory success toast for an action whose effect the user can already see?
17. Are tooltip hover-delay and focus-delay equal?
18. Is auto-rotating content (carousel, banner, stats) lacking pause-on-hover-and-focus?
19. Is there a placeholder name "Jane Doe / John Smith" or a startup cliché?

## Variety

20. Is the `/* Hallmark · macrostructure: <name> · ... */` stamp missing from the top of the CSS?
21. Did I default to the Specimen macrostructure when the brief did not explicitly call for editorial / foundry / specimen energy?

## Implementation gates

22. Does any neutral / surface colour have zero chroma? Pure greys read as flat.
23. Does the accent colour cover more than ~5% of any single viewport?
24. Is any padding / gap / margin a value that isn't on the named spacing scale?
25. Does any prose container's `max-width` fall outside the 45–75 ch range?
26. Does any interactive element lack `:focus-visible`, `:active`, OR `:disabled` styling?
27. Is there any `transform` / `animation` keyframe that is NOT covered by a `@media (prefers-reduced-motion: reduce)` fallback?

## Hero enrichment gates

28. If the page has a demo video, does it autoplay with sound, lack a `poster`, lack `fetchpriority="high"`, or use `loading="lazy"` on the LCP element?
29. If the page has an abstract background, is it more than one accent colour, more than ~5% footprint, or animating mesh-gradient on the whole page?
30. **Icon tells.** Does the page mix two or more icon libraries, OR use an emoji glyph as a feature-card icon?
31. If the page has illustration, did I default to a Lottie library when a hand-built SVG or pure-CSS shape would have worked?

## Diversification gates

32. If I used the same archetype as a previous Hallmark output, did I pick at least one different variation knob?
33. Does any visual-only `<svg>`, custom-art `<div>`, `<canvas>`, or decorative figure lack `aria-label` or `aria-hidden="true"`?

## Layout-safety gates

34. Does the page horizontally scroll on any viewport between 320px and 1920px?
35. For every decorative effect on text, did I visually confirm the position and size?
36. Are interactive bars (nav, toolbar, command bar, hero CTA row, footer link strip) explicitly vertically centered?

## Typography discipline gates

37. Does the page use **more than three** distinct `font-family` families?
38. Is the outlier face used in more than two slots on the page?
38a. Is any **heading or display type italic**?

## Input-state gate

39. Do input / textarea / select fields handle every state correctly? (Border-width shifts, focus ring, height, helper-text, disabled)

## Contrast & readability

40. **Contrast thresholds.** Does any text, icon, or `:focus-visible` ring fail its threshold against its *computed* background?
41. **The contrast failures that ship most often.** Button text ≈ button fill; dark-section ink-on-ink.

## Nav · footer · hero structural slop

42. **Nav fingerprint.** Is the page's `<nav>` the AI default?
43. **Footer fingerprint.** Is the `<footer>` the AI default?
44. **Hero fit — sits into the page and fits the fold.**
45. **Decorative-without-purpose.** Does the hero contain a decorative element that has no semantic anchor?

## Honest copy · no fabricated content

46. **Invented metric.** Does the page contain any quantitative claim the user did not supply?

## Re-drawn UI chrome

47. **Re-drawn chrome.** Did Hallmark hand-build a fake browser bar, fake phone frame, fake code-block frame, or fake IDE chrome?

## Token discipline

48. **Mid-render token improvisation.** Did Hallmark introduce any colour value or `font-family` declaration *outside* the design tokens defined in `:root`?

## Responsive — clickable affordances

49. **Two-line clickable text.** Does any button label, primary nav link, footer link, tab label, breadcrumb, or CTA text wrap to two or more lines?

## Mobile-responsiveness — the non-negotiables

50. **Image-bearing grid track without `minmax(0, 1fr)`.**
51. **Display headers without long-word wrap.**
52. **Per-theme section-head override without mobile collapse.**
53. **CSS-only radio tab pattern that scroll-jumps.**
54. **Section eyebrow / tag beside the heading (tag-left, header-right).**
55. **All-caps display heads with line-height < 1.0.**
56. **Sticky element at `top: 0` below a sticky page-level nav → bleed.**
57. **Studied DNA discarded for a catalog theme.**

---

If any answer is **yes**, fix it. Do not ship slop.

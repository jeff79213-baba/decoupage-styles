# Anti-patterns — the named tells

The `hallmark audit` verb flags these by name. Every one of these is a signature of AI-generated UI. Seeing one is a problem; seeing two in the same view is a confirmation.

---

## Critical (ships as slop)

### The purple-gradient hero
A hero section with a background gradient from purple to blue or purple to pink, often with white centred text. This is the single most-recognised AI aesthetic.
**Fix.** Pick a single anchor hue. One accent. No gradient backgrounds on heroes.

### Inter-everywhere
Inter (or Roboto, or Open Sans) used as both display and body, with no pairing face. A one-font page is a template page.
**Fix.** Pair a distinctive display face with a refined body face.

### The 3-column feature grid
Three equal columns, each with an icon above a two-line heading above a three-line body. Usually spanned full-width with 24px gap. Every LLM emits this.
**Fix.** Break the grid. Vary column widths. Mix card heights. Remove one card and use negative space.

### Card-in-card
A bordered container with cards inside it. Or: a card containing another card containing a small "micro-card". Visual nesting with no semantic reason.
**Fix.** Pick one containment layer.

### The gradient headline
A headline with `background-clip: text` fill set to a linear gradient. Signals "AI generated" faster than almost anything else.
**Fix.** Solid ink.

### The side-stripe card
A card with a thick coloured border on one edge (usually left, 4–6px, purple or green).
**Fix.** Use a hairline border all around, or no border.

### Full-viewport centred hero
`min-height: 100vh` (or `100dvh`), everything centred, one short sentence, one big CTA. The default LLM landing page.
**Fix.** Let the hero be the height of its content. Bias left or right.

### Pure black, pure white
`#000000` background or `#ffffff` surface. Both read as flat and synthetic.
**Fix.** Tint toward your anchor hue.

### Default-attractor sameness
Two consecutive Hallmark outputs in the same project use the same macrostructure.
**Fix.** Before writing code, look for an existing `/* Hallmark · macrostructure: <name> · ... */` stamp. If one exists, your pick must be a different macrostructure.

### Specimen fall-through
Producing the Specimen macrostructure when the brief did not explicitly request editorial / foundry / specimen energy.
**Fix.** The Specimen macrostructure is one of twenty-one in macrostructures.md, not a default.

### The AI nav
Wordmark hard-left, 4–5 inline text links centred or right-grouped, a CTA button hard-right, full viewport width, sticky on scroll, white background, 1 px hairline border-bottom.
**Fix.** Pick from the routing table in component-cookbook.md.

### The AI footer
4 columns of links, social-icon row beneath, copyright line at the very bottom, faint 1 px top-border, neutral grey background.
**Fix.** Pick from the routing table in component-cookbook.md.

### Aurora-blob background
Flowing organic mesh blobs in purple-to-pink-to-cyan, layered behind hero text.
**Fix.** Solid surface. Or a subtle two-stop CSS gradient.

### Floating-orb decoration
Ambient generic 3D spheres or blurred coloured circles drifting behind the hero.
**Fix.** Cut them.

### Sound-on autoplay
A hero video that auto-plays with audio.
**Fix.** `<video autoplay muted loop playsinline>` — always all four.

### Lazy-loaded LCP
`loading="lazy"` on the hero image or hero video — the LCP element.
**Fix.** `fetchpriority="high"` and `preload="metadata"` on the LCP element.

---

## Major (looks AI-generated)

### Bounce and elastic easing
Buttons that bounce in, icons that wobble on hover.
**Fix.** Exponential ease-out.

### Centred everything
Headline centred, body centred, button centred, section after section of centred columns.
**Fix.** Bias the layout.

### Italic headers
A roman headline with one word flipped to italic. The italicised emphasis-word-in-a-header is among the most reliable AI tells.
**Fix.** Headers are roman (`font-style: normal`). Carry emphasis with weight, an accent colour, or a drawn underline.

### Eyebrow on every section
Every section starts with an uppercase mono-cap eyebrow. Eyebrows are **default OFF**.
**Fix.** Ship the page with **zero eyebrows** unless the user explicitly asked for chapter / step / section numbering.

### Shadow-glow on dark
A card on a dark background with a `box-shadow` that leaves a soft coloured halo.
**Fix.** On dark surfaces, use elevation via *lightness*, not shadow.

### Icon-tile feature card
Rounded rectangle, icon in a coloured square at the top-left, heading below it, two lines of copy, optional "Learn more →" link.
**Fix.** Let them be asymmetric — vary sizes, vary alignments.

### Glassmorphism without purpose
Frosted-glass panels everywhere.
**Fix.** Glassmorphism can work when it communicates depth. It cannot work as decoration.

### Hover-only affordances
Hover reveals a menu; hover shows a delete button; hover triggers a tooltip with crucial information. Touch users get nothing.
**Fix.** Every hover affordance has a focus state and is accessible via tap/click.

### Tabular data without tabular-nums
A list of prices, dates, or metrics where the numbers don't align vertically.
**Fix.** `font-variant-numeric: tabular-nums;` on any container displaying columns of numbers.

### Animate-on-scroll on everything
Every section fades in when it enters the viewport. The page never settles.
**Fix.** Pick one orchestrated entrance. Let the rest just *be there*.

### Mismatched icon sets
Material Icons in the navbar, Heroicons in the feature cards, Lucide in the footer.
**Fix.** Pick one library per project.

### AI-illustration look
Smooth-mesh-blob characters with no joint articulation, unmistakably-Midjourney compositions.
**Fix.** Hand-build the illustration in pure CSS or SVG.

### Invented metrics
A stat-led layout carrying numbers the user never supplied — "10× faster", "saves 5 hours per week".
**Fix.** Replace the number with `—` and a labelled grey block, or ask the user for the real number.

### Generic emoji as feature icon
A feature card with ✨ 🚀 ⚡ 🔥 🎯 ✅ rendered as the primary icon.
**Fix.** Pick a single icon library and ship it, or build a custom SVG mark.

### Re-drawn UI chrome
A fake browser bar wrapping a screenshot. A fake phone frame around a mobile mockup. A fake code-block window wrapping a `<pre>`.
**Fix.** Use a real screenshot wrapped in `<figure>`.

### Mid-render token improvisation
The artifact contains inline colour values or `font-family` declarations that aren't drawn from the token block.
**Fix.** Every colour and every font in the artifact must reference a named token.

### Wrap-to-two-lines clickable text
A button label or nav link reads on two lines because the viewport got narrow.
**Fix.** Shorten the label, set `white-space: nowrap`, or collapse the nav.

### Lottie shortcut
Reaching for a LottieFiles community animation when pure CSS would have produced it stronger and lighter.
**Fix.** Build it custom.

### Three.js for a still object
A WebGL hero where the 3D doesn't earn its place by being interactive.
**Fix.** If the user can't manipulate it, it doesn't justify Three.js.

---

## Microinteraction tells

### `transition-all`
Every property animating, including ones that should be instant.
**Fix.** Specify the properties.

### Universal `hover:scale-105`
Every card lifts on hover, with no shadow change, no easing specified, no purpose.
**Fix.** Pick one signal per element.

### Bouncy overshoot easings on UI
`cubic-bezier(0.34, 1.56, 0.64, 1)` and friends on buttons, modals, tooltips.
**Fix.** Reserve overshoots for genuine physical interactions.

### Animated hover gradients
Background gradient slides through colour space on hover.
**Fix.** Cut. Or pick one colour shift, instant.

### Cursor follower dots
A trailing dot that lags behind the pointer.
**Fix.** Cut.

### Auto-rotating carousels with no pause
WCAG 2.2.2 failure.
**Fix.** Manual advance only, or pause-on-hover-and-focus.

### Celebratory success toasts
"Done!" when the user just saved a thing they can see was saved.
**Fix.** Silent success.

### Confirmation dialogs for reversible actions
"Are you sure you want to delete this?" before a one-row delete.
**Fix.** Optimistic delete + 5–10s Undo toast.

### Tooltips with the same delay on hover and focus
Both delay 800ms.
**Fix.** Hover delay 800–1000ms. Focus delay 0ms.

### Focus rings that animate in
The ring fades in over 200ms.
**Fix.** Focus rings appear instantly. Always.

### Toasts that shift layout
New toast pushes content down; dismissed toast lets it spring back.
**Fix.** Stack at a viewport corner, fixed positioning.

### Universal scroll-triggered fade-up
Every section fades in on intersection. The page never settles.
**Fix.** One orchestrated entrance on first load.

### Spinners that flash
A spinner appears for 50ms while a fast action completes.
**Fix.** Either delay-show the spinner or enforce a minimum visible duration.

---

## Minor (small taste issues)

### Straight quotes
`"Hello"` and `'word'` in rendered text.
**Fix.** Curly quotes: `"Hello"`, `'word'`.

### Double-hyphen dashes
`--` in body copy where an em-dash belongs.
**Fix.** `—` (U+2014).

### Three periods instead of ellipsis
`...` in body copy.
**Fix.** `…` (U+2026).

### Placeholder names
"Jane Doe", "John Smith", "Example User".
**Fix.** Plausible placeholder names reflecting the audience.

### Startup-cliché product names
"Acme", "Nexus", "Pulse", "Unleash", "Seamless", "Supercharge".
**Fix.** Name the thing concretely.

### `z-index: 9999`
Arbitrary large z-values.
**Fix.** Use the six-level named scale.

### Every section padded the same
Top padding, bottom padding, horizontal padding — all equal across every section.
**Fix.** Vary.

### 100vw widths
`width: 100vw` on anything. Breaks on scrollbar-visible desktops.
**Fix.** `width: 100%` with container padding.

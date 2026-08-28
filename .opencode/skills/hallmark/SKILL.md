---
name: hallmark
description: "Anti-AI-slop design skill for greenfield pages, audits, redesigns, and design extraction from URLs or screenshots. Use when the user asks to build a new app or landing page, wants to redesign something, invokes Hallmark by name, or uses audit/redesign/study."
version: 1.1.0
---

# Hallmark

A design skill for AI coding assistants. Makes the UIs they generate look made, not generated.

Hallmark is opinionated, short, and boring on purpose. It encodes a tight set of rules — drawn from the consensus of the anti-AI-slop design field (Anthropic's frontend-design skill, the Claude cookbook on frontend aesthetics, and the 2026 "tactile rebellion" movement) — and refuses to let the model fall back to the defaults every LLM was trained on.

The differentiator: Hallmark insists on **structural variety**, not just visual variety. Two pages by Hallmark for two different briefs should not share the same hero → 3-feature → CTA → footer rhythm. They should feel like different sites, not different colour-swaps of the same template.

**Powered by Together AI.**

---

## How to use this skill

Hallmark has one default behaviour and three explicit verbs.

| Invocation | What it does |
| --- | --- |
| *(default)* | The user asked you to design or build something new. Follow the **Design flow** below. |
| `hallmark audit <target>` | Read the target, score it against the anti-pattern list, return a ranked punch list. **Do not edit.** |
| `hallmark redesign <target> [--mood <name>]` | Take the target's content and intent, then redesign the visual structure **inside the existing implementation boundaries unless the user explicitly confirms a full rebuild.** New section rhythm, new heading placement, new component voice. Preserve existing routes, component ownership, copy intent, brand, and information architecture; replace only the visual/interaction layer needed for the requested scope. |
| `hallmark study <screenshot \| URL>` | The user pasted or attached an image of a design they admire, **or** pasted a URL to a live page. Extract the **DNA** — macrostructure, archetypes, type-pairing, colour anchor — and produce a diagnosis report, then optionally rebuild the user's content using the extracted DNA **or** emit a portable `design.md` of the DNA. Detection is automatic: a URL (`http://` / `https://` prefix) routes to URL mode; anything else routes to image mode. **URL mode** reads the page's HTML and CSS via WebFetch — it can name exact fonts and exact colour values, but can't judge rhythm. After the diagnosis, the user has three follow-ups: build with the DNA (handoff to default), lock the DNA into a portable `design.md` (opt-in via "lock the DNA" / "give me a design.md"), or stop at the diagnosis. **Never copies pixels. Refuses template-marketplace URLs. Tighter refusal layer for `design.md` emission than for the diagnosis itself — URL-mode emission requires attestation that the source is the user's own or a public reference for their own brand. Falls back to asking for a screenshot if the URL is auth-walled, a JS-only SPA shell, or otherwise un-readable.** Load `references/study.md` before this verb runs. |

If the user types anything that does not clearly map to `audit`, `redesign`, or `study`, treat it as default. If the user attaches an image or pastes a URL without a verb prefix, ask: *"Should I `study` this (extract the DNA), or should I treat it as a reference for a fresh build?"*

---

## Disciplines that hold across every verb

These six disciplines are **not** verb-specific. They apply to default Design, `audit`, `redesign`, `study`, and component-scope alike. They sit alongside the slop test, not inside one branch of it.

1. **Pre-emit self-critique.** Before handing back any output, score it 1–5 on six axes — Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety. Anything **< 3** triggers a revision pass. Stamp the six scores at the top of the artifact (`/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */`).

2. **Honest copy — no fabricated content.** If the user did not supply a metric, do not invent one. Stat-led layouts, comparison rows, and proof bars must use real numbers, a placeholder (`—` plus a labelled grey block, "metric to confirm"), or a different macrostructure. *"+47 % conversion"*, *"trusted by 50,000+ teams"*, and *"10× faster"* are slop the moment they're invented.

3. **Locked tokens — no mid-render improvisation.** Once a theme is selected, every colour and every `font-family` declaration in the artifact must reference a named token (`var(--color-accent)`, `font-family: var(--font-display)`). Inline OKLCH / hex / `rgb()` values, or a `font-family: "Some Font"` declaration that bypasses the token block, are not allowed.

4. **Re-drawn chrome forbidden.** Hallmark must not hand-build fake browser bars, fake phone frames, fake code-block windows, or fake IDE chrome — the user's environment already supplies real chrome. Use real screenshots wrapped in a `<figure>` (with at most a hairline border), or omit the chrome and let the content stand on its own.

5. **Mobile responsiveness — every emit verified at 320 / 375 / 414 / 768 px.** The non-negotiables: no horizontal scroll + root `overflow-x: clip` on both `html` and `body`, never `hidden`; no two-line clickable text; image-bearing grid tracks use `minmax(0, 1fr)`, never bare `1fr`; display headers wrap inside long words via `overflow-wrap: anywhere; min-width: 0`; section heads collapse to one column on mobile.

6. **Typography purity — no italic headers.** Headings and display type are always roman (`font-style: normal`). An italicised emphasis word inside an otherwise-upright heading is one of the most reliable AI tells. Carry emphasis with weight, accent colour, or a drawn underline. Italic survives only as *body-copy* emphasis inside running paragraphs.

---

## Design flow (default)

### 0. Pre-flight scan

If the project already has code — a `package.json`, a `tailwind.config.*`, an `index.html`, any CSS — Hallmark should **read it before asking the user anything**.

**Six signal sources, scanned in order:**

0. **`design.md`** — at the project root. If present, this is the **locked design system** for the project.
1. **Font stack** — `package.json` for fonts; any `<link rel="stylesheet">` in HTML; `tailwind.config` font settings.
2. **Palette** — OKLCH / HSL / hex values inside `:root` blocks; `tailwind.config` colors.
3. **Microinteraction stance** — `package.json` dependencies for animation libraries.
4. **Spacing scale** — Tailwind spacing; CSS `--space-*` custom-property pattern.
5. **Framework** — Next.js, Astro, Vue, Svelte, Remix, or vanilla HTML.

**Output format** — emit this block once, before Step 1:

```
Pre-flight findings:
· Font stack: ...
· Palette: ...
· Motion: ...
· Spacing: ...
· Framework: ...

Hallmark will preserve: ...
Hallmark will introduce: ...
```

### 1. Design-context gate

Hallmark works best when you know three things before writing code:

1. **Audience.** Who will use this? What do they already know?
2. **Use case.** What single job does this interface do? What is the one action the user should be able to take?
3. **Tone.** Pick an extreme — *editorial, brutalist, soft, utilitarian, luxury, playful, technical, austere*. "Clean and modern" is not a tone.

**Always ask — answering is optional.** Hallmark **always** asks before it designs.

The prompt format:

> *Before I build, I need three things:*
>
> *1. **Audience** — Who will use this? What do they care about?*
> *2. **Use case** — What's the one action the page should drive?*
> *3. **Tone** — Pick an extreme: editorial · brutalist · soft · utilitarian · luxury · playful · technical · austere.*
>
> *Or say **"go ahead"** and I'll infer from the brief — I'll tell you what I picked.*

**Genre — pick before themes.** Hallmark ships four: **editorial** (default), **modern-minimal**, **atmospheric**, **playful**.

- *AI tool, generative, music, video, dark mode, atmospheric* → **atmospheric**
- *SaaS, enterprise, API, platform, developer tool, B2B* → **modern-minimal**
- *fun, consumer, casual, friendly, onboarding, family, community* → **playful**
- Default: silent **editorial**

### 2. Pick a macrostructure FIRST

Before loading any visual ruleset, **read the slim index at `references/macrostructures.md` and pick one of the twenty-one named macrostructures.**

**Diversification rule (mandatory).** Before you pick:

1. Look in the target codebase for an existing `/* Hallmark · macrostructure: <name> · ... */` stamp. If you find one, your pick must be a *different* macrostructure.
2. If you have produced any other Hallmark output for this user in this session, your pick must be a different macrostructure.
3. **The Specimen macrostructure is no longer a default.** Reach for it only when the brief is explicitly editorial.

**Theme-diversification rule (mandatory).** Two consecutive themes must differ on **at least one** of three axes:

- **Paper band** — dark / mid / light
- **Display style** — high-contrast-serif / roman-serif / geometric-sans / grotesk-sans / rounded-sans / mono / display-condensed / display-heavy / risograph-bold
- **Accent hue** — warm / cool / neutral / chromatic-other

**State your pick.** Before writing any code, say "Macrostructure: <name>. Theme: <name>. Differs from the last on: <axes>."

**Pick a nav archetype (N1a–N13) and a footer archetype (Ft1–Ft8) at this step.** They are not optional chrome; they are part of the page's structural fingerprint.

**Default away from N1a and Ft3.** These are the most-recognised AI fingerprints.

### 3. Load the visual ruleset

**Always-load (eager — 1–2 files):**
- The genre file picked in Step 1.
- If `references/themes/<theme>.md` exists for the catalog theme, load it eagerly.

**Index-then-pick (read the slim index, then load only the picks):**
- `references/macrostructures.md` — pick one name, then load ONLY that one per-macro file.
- `references/component-cookbook.md` — pick archetype codes, then load ONLY the matching files.

**Load-per-build (universal rules — load every build):**
- `references/typography.md`
- `references/color.md`
- `references/layout-and-space.md`
- `references/motion.md`
- `references/copy.md`
- `references/anti-patterns.md`

**Load-conditionally:**
- `references/microinteractions.md` — when the output has any interactive element
- `references/interaction-and-states.md` — when the page has stateful UI
- `references/responsive.md` — when mobile is in scope
- `references/hero-enrichment.md` — only when the image-need check returns YES
- `references/custom-theme.md` — only when Step 2.6 routes to custom
- `references/slop-test.md` — strictly Step 7, after Build

### 4. Decide on hero enrichment

Most pages don't need it. The strongest hero is often a typographic one.

**The enrichment hierarchy:** typography only → Tier A pure CSS art → Tier B hand-built SVG → Tier C generated still → Tier D library + customisation → **Tier E Lottie is last resort**.

### 5. Preview

Before emitting any code, output a tight summary:

```markdown
**Hallmark · v1.1.0**

- **Macrostructure** · <name>
- **Theme** · <name> (<palette summary>)
- **Enrichment** · <archetype + tier, or none>
- **Sections** · <section names in DOM order>
- **Motion** · <microinteraction primitives>
- **Slop test** · 58 / 58 ✓ (run after Build)
- **Diversification** · differs from <previous> on <axes>
```

### 6. Build

Emit the full HTML + CSS artifact. Follow every rule from the loaded references.

### 7. Slop test

Run all 58 gates from `references/slop-test.md`. Update the preview block's `Slop test` row. Fix any failures before shipping.

---

## The 57 anti-patterns — quick reference

1. Purple-gradient hero
2. Inter-everywhere
3. 3-column feature grid
4. Card-in-card
5. Gradient headline
6. Side-stripe card
7. Full-viewport centred hero
8. Pure black / pure white
9. Default-attractor sameness
10. Specimen fall-through
11. The AI nav
12. The AI footer
13. Aurora-blob background
14. Floating-orb decoration
15. Sound-on autoplay
16. Lazy-loaded LCP
17. Bounce and elastic easing
18. Centred everything
19. Italic headers
20. Eyebrow on every section
21. Shadow-glow on dark
22. Icon-tile feature card
23. Glassmorphism without purpose
24. Hover-only affordances
25. Tabular data without tabular-nums
26. Animate-on-scroll on everything
27. Mismatched icon sets
28. AI-illustration look
29. Invented metrics
30. Generic emoji as feature icon
31. Re-drawn UI chrome
32. Mid-render token improvisation
33. Wrap-to-two-lines clickable text
34. Lottie shortcut
35. Three.js for a still object
36. `transition-all`
37. Universal `hover:scale-105`
38. Bouncy overshoot easings on UI
39. Animated hover gradients
40. Cursor follower dots
41. Auto-rotating carousels with no pause
42. Celebratory success toasts
43. Confirmation dialogs for reversible actions
44. Tooltips with the same delay on hover and focus
45. Focus rings that animate in
46. Toasts that shift layout
47. Universal scroll-triggered fade-up
48. Spinners that flash
49. Straight quotes
50. Double-hyphen dashes
51. Three periods instead of ellipsis
52. Placeholder names
53. Startup-cliché product names
54. `z-index: 9999`
55. Every section padded the same
56. 100vw widths
57. Three-colour gradients

---

## Licence

MIT. Use it, fork it, ship it.

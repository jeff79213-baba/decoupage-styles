# Typography

Type carries the design. If the type is wrong, nothing else matters.

## Principles

- A page is a pairing, not a single font. Display face + body face, minimum.
- Commit to extremes. Weight 200 next to weight 800 reads as intentional.
- Size steps should be ratios, not increments. Major third (1.25), perfect fourth (1.333), perfect fifth (1.5), or golden (1.618).
- Line-height changes with size. Tight for display (1.05–1.2), comfortable for body (1.5–1.65).
- Measure — line length — lives between 45 and 75 characters. Use `max-width: 65ch` as the default.

## The 2+1 rule — three faces is the ceiling

**A page may use at most three distinct font families.** One **display**, one **body**, and an optional **outlier** for a single typographic moment. Four families is slop. Two is canonical. Three is the ceiling, used sparingly.

The pattern:

```css
:root {
  --font-display:  "Fraunces", ui-serif, Georgia, serif;
  --font-body:     "Geist", ui-sans-serif, system-ui, sans;
  --font-outlier:  "Geist Mono", ui-monospace, monospace;
}
```

## Banned defaults

These fonts are on-distribution for every LLM:

- **Sans-serif:** Inter, Roboto, Open Sans, Lato, Poppins, Source Sans, Nunito, Montserrat, Raleway, Work Sans, DM Sans, system-ui, Arial, Helvetica.
- **Serif:** Merriweather, Playfair Display (as body), Lora, Source Serif, Georgia-as-default.
- **Mono:** Courier New, Consolas-as-default, system mono.

## The font catalog

### Free display faces

| Family | Source | Voice | Best for |
| --- | --- | --- | --- |
| **Fraunces** | Google | Variable serif, deeply expressive | Editorial, Atelier, brand-heavy |
| **Newsreader** | Google | Roman serif with optical-size | Editorial, magazine, long-form |
| **Instrument Serif** | Google | Tight contrast, italic available | Brand, atelier, intimate editorial |
| **Cormorant Garamond** | Google | Classical, high contrast, luxury | Luxury, fashion, fine arts |
| **DM Serif Display** | Google | Bracketed serif, high-contrast | Headlines that need to feel printed |
| **Geist** | Google | Modern grotesque, geometric, 7 weights | Modern minimal, SaaS, dev tools |
| **Bricolage Grotesque** | Google | Variable display sans, bold | Brutal, playful, riso-bold |
| **Space Grotesk** | Google | Geometric grotesque, slightly quirky | Brutalist, technical |
| **Anton** | Google | Heavy condensed grotesque | Posters, manifestos |
| **Big Shoulders Display** | Google | Industrial condensed | Sports, manifestos |
| **Tomorrow** | Google | Variable optical condensed | Tech, atmospheric |
| **Cabinet Grotesk** | Fontshare | Display grotesque, 9 weights | Editorial display, magazine |
| **Clash Display** | Fontshare | Ultra-condensed display | Posters, brand moments |
| **Satoshi** | Fontshare | Playful geometric sans | Playful, consumer |
| **Sentient** | Fontshare | Variable serif, soft contrast | Soft editorial, atmospheric |
| **Erode** | Fontshare | Distressed serif, hand-set feel | Riso, tactile-rebellion |
| **Tanker** | Fontshare | Heavy condensed grotesque | One-word posters, mastheads |

### Free body faces

| Family | Source | Voice | Best for |
| --- | --- | --- | --- |
| **Geist** | Google | The default modern body sans | Modern minimal, SaaS, atmospheric |
| **Newsreader** | Google | Reading serif, optical-size aware | Editorial body, longform |
| **Source Serif 4** | Google | Body-grade serif | Editorial mid-weight |
| **EB Garamond** | Google | Classical body | Editorial slow reading |
| **IBM Plex Sans** | Google | Engineering sans, broad family | Technical body |
| **Switzer** | Fontshare | Neutral sans body | SaaS body, restrained |
| **General Sans** | Fontshare | Geist-adjacent body | Modern minimal body |

### Free mono / outlier faces

| Family | Source | Voice | Best for |
| --- | --- | --- | --- |
| **Geist Mono** | Google | Geist's mono companion | Default Hallmark mono, code, captions |
| **JetBrains Mono** | Google | Engineering mono, ligatures | Code, terminal, technical |
| **Commit Mono** | Google | Tighter mono, modern | Code, modern terminal |
| **Space Mono** | Google | Quirky, slightly retro | Playful tech, riso |

### Tone-based pairing patterns

| Tone | Display | Body | Outlier |
| --- | --- | --- | --- |
| **Editorial** | Fraunces · Newsreader · EB Garamond · Instrument Serif · Cabinet Grotesk | IBM Plex Sans · Switzer · Source Serif 4 | JetBrains Mono · Geist Mono |
| **Technical** | JetBrains Mono · Geist Mono · Geist (700) · Commit Mono | Geist · IBM Plex Sans · Switzer | Tomorrow · Cabinet Grotesk |
| **Brutalist** | Bricolage Grotesque (800) · Anton · Tanker · Big Shoulders Display | Geist · Switzer | Space Grotesk · Geist Mono |
| **Soft** | Geist · Bricolage Grotesque (500) · Sentient · Newsreader | Geist · Crimson Pro · Switzer | Geist Mono · Satoshi |
| **Luxury** | Cormorant Garamond · Fraunces · Cardo · DM Serif Display · Bodoni Moda | EB Garamond · Crimson Pro · Source Serif 4 | (rare) |
| **Playful** | Bricolage Grotesque · Fraunces (italic) · Satoshi · Sentient | Geist · Newsreader · Satoshi | Geist Mono · Space Mono |
| **Atmospheric** | Geist (600) · Sentient · Tomorrow · Bricolage Grotesque | Geist (400) · Switzer | Geist Mono · JetBrains Mono |

## Scale

Pick a ratio. The default for Hallmark work is **1.25** (major third). Build the scale from a 16px body, then clamp display sizes for responsive.

```css
:root {
  --text-xs:   0.64rem;
  --text-sm:   0.8rem;
  --text-base: 1rem;
  --text-md:   1.25rem;
  --text-lg:   1.5625rem;
  --text-xl:   1.9531rem;
  --text-2xl:  2.4414rem;
  --text-3xl:  3.0518rem;
  --text-4xl:  3.8147rem;
  --text-display: clamp(2.75rem, 5vw + 1rem, 5.25rem);
}
```

**Display max — keep it ≤ 5.5rem (88 px).**

### Hero headline sizing — match size to copy length

| Headline length | Size cap |
| --- | --- |
| **≤ 20 chars** | full `--text-display` |
| **21–50 chars** | `--text-display` |
| **51–90 chars** | cap at `--text-display-s` |
| **> 90 chars** | rewrite shorter, or cap at `--text-4xl` |

## Weights

- Body: one weight (typically 400 or 350). Bold for emphasis only.
- Headings: a weight that contrasts the body by at least 300 units.

## Required features

- `font-display: swap` on every web font.
- Tabular numbers on any data display: `font-variant-numeric: tabular-nums;`.
- Oldstyle figures for body copy where the face supports them.
- Proper typographic punctuation: `" " — … ' '`. Never straight quotes.

## Body text rules

- Minimum 16px. Below 14px is accessibility-hostile.
- Line-height 1.5–1.65 on body copy, tighter (1.1–1.3) on display.
- Measure 45–75 characters (`max-width: 65ch`).
- Never all-caps body copy. Never justified text without hyphenation.

## Headings rules

- Tight tracking on display sizes (`letter-spacing: -0.02em` to `-0.04em`).
- Loose tracking on small caps / labels (`letter-spacing: 0.08em` to `0.14em`).
- Skip no levels. `h1` → `h2` → `h3`.

## Bans

- No Inter, no Roboto, no Open Sans. No system stack as the *only* stack.
- No gradient text on headings (`background-clip: text` with a gradient fill).
- No single-font pages.
- No all-caps paragraphs.
- No font-size below 14px for body copy, below 10px anywhere.
- **No more than three font families on a single page.**

# Copy

Words are part of the design. A great layout with stock copy looks generic. Tight copy in an average layout reads as considered.

## Principles

- **Specific verbs.** "Save changes" beats "OK" beats "Submit".
- **Labels describe.** "Email address" beats "Email".
- **Link text stands alone.** "View pricing plans" beats "Click here".
- **Errors are instructions.** Describe what broke, why, how to fix — in that order.
- **Active voice.** "We couldn't find your account" beats "Your account could not be found".
- **Consistency.** Pick one of "Delete" or "Remove". Use it everywhere.

## Buttons

Use the verb for the action the button performs.

Good: `Save changes`, `Create account`, `Send invitation`, `Copy link`, `Open file`.
Bad: `OK`, `Submit`, `Click here`, `Continue` (only as the secondary button of a multi-step flow).

## Error messages

1. **What happened.** Past tense, factual. "That card was declined."
2. **Why, if known.** "Your bank flagged the charge."
3. **What to do.** Imperative. "Try another card, or contact your bank."

## Empty states

1. One line naming what's empty. "No projects yet."
2. One line on why this matters. "Projects group your tasks and team."
3. One button. "Create a project".

## Loading

- Short wait: spinner with no text.
- Medium wait (>2s): spinner + "Loading…".
- Long wait (>10s): spinner + progress indication + an honest label.

## Microcopy bans

- "Click here." Link text must stand alone.
- "Oops!", "Uh oh!", "Something went wrong." Name the thing that broke.
- "Enter your email below." If the input is below, you don't need to say so.
- Exclamation marks in error states.
- Humour in frustration paths.
- Stock placeholder names: Jane Doe, John Smith, Lorem Ipsum.
- Startup clichés: Acme, Nexus, Unleash, Seamless, Supercharge, Transform, Elevate, Empower.
- Marketing copy that promises a feeling without naming a feature.

## Proper typography

- Curly quotes: `"Hello"`, `'word'`.
- Em-dash for interruption: `—` (U+2014). En-dash for ranges: `10–20` (U+2013). Never `--`.
- Ellipsis: `…` (U+2026). Never `...`.
- Apostrophe: `'`. Never the prime `'`.
- Non-breaking space before units: `10 kg`, `5 min`.

## Banned opening lines

| Phrase | Why it fails |
| --- | --- |
| "Built for the modern team" | Vague; assumes no specifics |
| "Unleash your [X]" | Hyperbolic; software can't unleash anything |
| "Where X meets Y" | False synthesis; creative laziness |
| "Empower your..." | Missionary language; avoids concrete benefit |
| "Reimagine the way you..." | Suggests dissatisfaction before explaining need |
| "Supercharge your workflow" | Energy metaphor without mechanics |
| "Innovative solutions" | Meaningless; every product claims innovation |
| "Seamless integration" | "Seamless" has no antonym; signals non-specificity |
| "In today's digital landscape" | Temporal hand-wave; assumes the reader needs orientation |
| "Next-generation" | Implies predecessor inadequacy; offers no differentiation |

If the brief gives you nothing to work with for an opening line, *say so to the user* and ask one question that elicits a specific noun, verb, or place.

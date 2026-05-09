# Art Deco Refresh — Classic Era Typography & Decoration

**Supersedes:** §1.2, §13 (typography + decorative motifs) of `DESIGN.md` for the **Classic** era only.
**Scope:** Classic Light + Classic Dark. Modern era is untouched.
**Constraint:** CSS / token refresh only — no layout changes, no new dependencies, no commercial fonts.

---

## 1. Atmosphere — Pivot from Late-Victorian to Art Deco

The previous Classic stack (Cinzel / Playfair Display / EB Garamond / IM Fell English) reads as Renaissance-revival academic. We are pushing into **1925 Jazz-Age investigator's casefile** — gold leaf on black lacquer, theatre-marquee capitals, stepped ziggurats, geometric chevrons, sunbursts. Pearl & onyx. Smoky reading-room.

**Atmosphere keywords (use verbatim in any future Stitch prompt):**
> Art Deco, 1925, theatre marquee, gold leaf on onyx, stepped pyramid, ziggurat, chevron, sunburst, jazz-age private detective, Algonquin round table, casefile, brass nameplate, lacquered black walnut

**Forbidden (additions to existing Classic forbidden list):**
- Engraved-Roman caps (Cinzel) — too Renaissance
- Italic blackletter or English-revival serifs (IM Fell English) — too gothic
- Florid scripts with curlicues — Pompiere is the *only* sanctioned script

---

## 2. Type Scale (locked)

All Google Fonts. Loaded in `src/app.html`.

| Token | Family | Role | Tracking | Weight |
|---|---|---|---|---|
| `--font-display` | **Limelight** | h1, nameplate, hero — capitals only | 0.08em | 400 |
| `--font-heading` | **Federo** | h2/h3, section titles | 0.04em | 400 |
| `--font-body` | **Cormorant Garamond** | paragraph copy, labels, inputs | 0 | 400 / 500 |
| `--font-flavor` | **Pompiere** | margin notes, atmospheric italic, footers | 0 | 400 |
| `--font-deco-alt` | **Amarante** | drop-cap, pull-quote, big derived stat | 0 | 400 |
| `--font-typed` | **Special Elite** | typewritten values on form | 0.01em | 400 |

**Scale (rem, base = 1rem = 16px):**

| Element | Size | Family | Notes |
|---|---|---|---|
| h1 (page nameplate) | 2.25rem (mobile) → 3rem (md+) | Limelight | All-caps, gold double-rule beneath |
| h2 (section) | 1.5rem | Federo | Sentence case OK; thin gold underline |
| h3 (subsection) | 1.125rem | Federo | No underline |
| body | 1rem | Cormorant Garamond | line-height 1.55 |
| flavor | 0.95rem | Pompiere | italic feel without being italicized |
| typed | 1rem | Special Elite | numerals & form values |
| drop-cap | 4.25rem | Amarante | float-left first letter, opening prose |

**Why Cormorant Garamond for body:** Limelight's strong vertical strokes and tight geometry need a body face that is narrow and clean rather than warm-and-rounded. EB Garamond's wider proportions fight Limelight; Cormorant Garamond's tighter horizontal rhythm sits underneath it without visual collision.

---

## 3. Decorative Motifs

### 3.1 Heading double-rule (replaces single gold border-bottom)

`h1` and `h2[data-heading]` get paired thin/thick gold rules beneath. CSS:

```css
h1, h2[data-heading] {
  position: relative;
  padding-bottom: 0.5rem;
  border-bottom: none; /* kill old single rule */
  background-image:
    linear-gradient(to right, transparent, var(--color-gold) 15%, var(--color-gold) 85%, transparent),
    linear-gradient(to right, transparent, var(--color-gold) 25%, var(--color-gold) 75%, transparent);
  background-position: bottom left, bottom 4px left;
  background-size: 100% 1px, 100% 1px;
  background-repeat: no-repeat;
}
```

The two stacked rules read as a deco frame edge — thin under thicker.

### 3.2 `<hr>` ornament — stepped chevron (replaces ◆ diamond)

```css
hr {
  border: 0;
  height: 1.5rem;
  background: none;
  position: relative;
  overflow: visible;
  margin: 1.5rem auto;
}
hr::before {
  content: '';
  position: absolute;
  inset: 50% 0 auto 0;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--color-gold) 18%,
    var(--color-gold) 38%,
    transparent 45%,
    transparent 55%,
    var(--color-gold) 62%,
    var(--color-gold) 82%,
    transparent
  );
  transform: translateY(-0.5px);
}
hr::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1.5rem;
  height: 1.5rem;
  transform: translate(-50%, -50%) rotate(45deg);
  background:
    linear-gradient(to bottom right, transparent 49%, var(--color-gold) 49%, var(--color-gold) 51%, transparent 51%),
    linear-gradient(to bottom left, transparent 49%, var(--color-gold) 49%, var(--color-gold) 51%, transparent 51%);
  /* Renders a small stepped diamond — two diagonals forming a deco lozenge */
}
```

Reads as a centered deco lozenge with broken side rules — the "marquee break" between sections.

### 3.3 Drop-cap — `[data-dropcap]`

For the first paragraph of a prose block (homepage intro, licensing intro, character backstory display):

```css
[data-dropcap]::first-letter {
  font-family: var(--font-deco-alt); /* Amarante */
  font-size: 4.25rem;
  line-height: 1;
  float: left;
  padding: 0.25rem 0.5rem 0 0;
  color: var(--color-gold);
  text-shadow: 1px 1px 0 oklch(0 0 0 / 0.25);
}
```

Authors opt-in: `<p data-dropcap>It was an evening like any other...</p>`

### 3.4 Card corner ornaments — RECOMMENDATION

**Recommendation: SVG Svelte component (`DecoCorner.svelte`), not CSS pseudo-elements.**

**Why SVG wins here:**
1. **Crisp at all DPRs.** A geometric deco bracket has thin diagonal strokes that pseudo-element approaches must build from `border` + `clip-path` or stacked `linear-gradient` triangles. Both render fuzzily on retina + zoom-out, and the latter exhausts the only two pseudo-elements available on `Card.svelte` (already partially used).
2. **`currentColor` inheritance.** SVG `stroke="currentColor"` lets the card's `color` style cascade through — so a destructive variant of the card naturally tints the corner red without needing per-variant overrides.
3. **Reusable across non-card surfaces.** The wizard step indicator, the alpha banner, and the Drop-cap section all benefit from the same bracket vocabulary; a component is reused, a pseudo-element pattern is copy-pasted.
4. **Animation surface.** Era-transition (sepia fade-in) can target a single component via `:global(.deco-corner)` rather than chasing pseudo-elements across selectors.
5. **Accessibility.** Component takes `aria-hidden="true"` once; pseudo-elements are unaddressable for AT.

**Implementation sketch (single component, four orientations via prop):**

```svelte
<!-- src/lib/components/decoration/DecoCorner.svelte -->
<script lang="ts">
  type Position = 'tl' | 'tr' | 'bl' | 'br';
  let { position = 'tl' as Position, size = 16 } = $props();
  const rotations: Record<Position, number> = { tl: 0, tr: 90, br: 180, bl: 270 };
</script>
<svg
  class="deco-corner"
  width={size}
  height={size}
  viewBox="0 0 16 16"
  aria-hidden="true"
  style:transform={`rotate(${rotations[position]}deg)`}
>
  <!-- Stepped bracket: two right-angle steps forming a chevron -->
  <path
    d="M0 8 L0 2 L2 2 L2 0 L8 0"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="square"
  />
  <!-- Inner ziggurat tick -->
  <path d="M3 3 L5 3 L5 5" fill="none" stroke="currentColor" stroke-width="1" opacity="0.7" />
</svg>
```

**Card.svelte usage (opt-in via `decorated` prop):**

```svelte
<div class="card relative" style:color="var(--color-gold)">
  {#if decorated}
    <DecoCorner position="tl" />
    <DecoCorner position="tr" />
    <DecoCorner position="bl" />
    <DecoCorner position="br" />
  {/if}
  <!-- card content -->
</div>
```

With CSS:

```css
.deco-corner {
  position: absolute;
  pointer-events: none;
}
.card > .deco-corner:nth-of-type(1) { top: 0.5rem; left: 0.5rem; }
.card > .deco-corner:nth-of-type(2) { top: 0.5rem; right: 0.5rem; }
.card > .deco-corner:nth-of-type(3) { bottom: 0.5rem; left: 0.5rem; }
.card > .deco-corner:nth-of-type(4) { bottom: 0.5rem; right: 0.5rem; }
```

---

## 4. Per-Surface Application

| Surface | Treatment |
|---|---|
| **Top nameplate header** | `<span class="text-base font-semibold tracking-[0.08em]" data-display>MISKATONIC UNIVERSITY REGISTRAR</span>` — Limelight, all-caps, double-rule on hover/focus is over-the-top; keep border absent on the inline header span and reserve double-rule for h1 on page bodies. |
| **Wizard step indicator** | Federo (heading face) for step labels, gold tick mark for completed step; `gap-[clamp(0.25rem,1.5vw,0.75rem)]` keeps steps clustered at any viewport. Optional: `<DecoCorner>` brackets on the active step's pill. |
| **Character sheet card frame** | `Card.svelte` accepts `decorated` prop → four `<DecoCorner>` instances. Apply on /sheet/[id], /s/[shareId], /create/coc7e/draft sheets only (not on every utility card — it would become noise). |
| **Primary CTA button** | Federo, uppercase, letter-spacing 0.08em, gold border-bottom 2px instead of full border, no rounding (override `--radius` locally to `0` on `.btn-deco`). Hover: shift border to top + bottom (double-rule reveal). |
| **`<hr>`** | Stepped chevron lozenge per §3.2. |
| **Drop-cap** | `[data-dropcap]` opt-in per §3.3. Apply to home page intro, licensing intro, occupation-page suggestion intros. |
| **Card corner ornaments** | SVG `DecoCorner` component per §3.4. Opt-in via `decorated` prop on `Card.svelte`. |

---

## 5. Palette Adjustments

Existing oklch palette stands. **Two recommended micro-tweaks** (only if the redesign feels too muted after fonts land):

1. **`--color-gold` saturation +5%** in Classic Dark for stronger marquee glow:
   `oklch(0.65 0.12 75)` → `oklch(0.68 0.14 78)`
2. **`--color-card` hue shift toward ivory** in Classic Light (currently slightly green-tinted) for cleaner pearl reading:
   verify after font swap; only adjust if needed.

Defer both until visually evaluating the font swap. If the deco fonts on the existing palette feel right, leave the colors alone.

---

## 6. Concrete Diff for `base.css`

Replace lines 43–47 (font tokens) and the `h1, h2` border treatment:

```css
/* Replace */
--font-display: 'Limelight', serif;
--font-heading: 'Federo', serif;
--font-flavor: 'Pompiere', cursive;
--font-body: 'Cormorant Garamond', Georgia, serif;
--font-typed: 'Special Elite', 'Courier New', monospace;
--font-deco-alt: 'Amarante', serif;
```

Replace `app.html` Google Fonts link with:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Limelight&family=Federo&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Pompiere&family=Amarante&family=Special+Elite&display=swap"
  rel="stylesheet"
/>
```

Add to `effects.css` (or `base.css` decoration section): the rules from §3.1 (double-rule), §3.2 (stepped chevron hr), §3.3 (drop-cap).

Add new component file: `src/lib/components/decoration/DecoCorner.svelte` per §3.4.

---

## 7. Verification Atmosphere Sentence

When this lands, looking at the home page in Classic Dark should evoke:

> *"You're standing in the lobby of the Algonquin in 1925, holding a brass key marked 'Miskatonic Reading Room — 3rd Floor', and the case-file in your hand has gold-leaf borders and a stepped chevron under the title."*

If it feels Victorian, gothic, or Renaissance, the refresh has failed.

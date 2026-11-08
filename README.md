# NOCTARA — The Midnight Experience

A fictional midnight-elixir brand site built as a **portfolio demo**: a scroll-driven,
comic-book WebGL-style experience rebuilt from a reverse-engineering study of
Santioni Spirits' "Notturno Experience" (see `REVERSE_ENGINEERING.md` for the full map).

> **NOCTARA is fictional.** All artwork, copy and code in this repo are
> original — the scene paintings are AI-generated for this project and embedded
> in `assets-data.js`. No assets, fonts, text or code from the studied site are
> used — only its scene order, palette, header layout and interaction model,
> rebuilt from scratch.

**Tagline:** Elixirs to taste now, dream later.

## Run it

No build step, no dependencies. Just serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `index.html` directly in a desktop browser (Google Fonts need internet).

## Scenes (same order as the studied experience)

1. **Intro** — "THE MIDNIGHT EXPERIENCE" title card + mantra: *Sip / Shake / Pour your night*
2. **Eyes opening** — original SVG manga eyes that open on scroll
3. **Approach** — hooded figure, circular portal, parallax layers
4. **Hand** — *HOLD & MOVE*: an illustrated hand follows your pointer; holding and
   dragging leaves fading paint smears on red wood (canvas)
5. **Drink selection** — three bottles on plinths; your choice recolours the pour and taste scenes
6. **Pour** — hold the button to fill the glass (progress %); release pauses
7. **Taste + antigravity** — the guest drinks; rocks and orbs drift upward in the chosen colour
8. **Cathedral** — white columns on red; two pillars crack and crumble on scroll
9. **Collection** — "MIDNIGHT COLLECTION", an ode to your night, three product cards
10. **Footer** — NOCTARA wordmark and credits

## The three elixirs

| N° | Name | Colour |
|----|------|--------|
| 1 | Ember Orange, Cacao & Cream | Amber `#FBEB7F` |
| 2 | Midnight Mint, Cacao & Cream | Green `#97F3AD` |
| 3 | Moon Marshmallow, Coffee & Cream | Blue `#72C5F6` |

## Palette & type

- Red `#C82924` · dark red-brown `#592223` · cream `#F3F1E9` · ink `#121212`
- Display: Pirata One / Cinzel Decorative · Labels: Archivo Black · Body: Inter
  (Google Fonts approximations of the studied site's typography)

## Files

- `index.html` — all scenes, inline SVG artwork
- `styles.css` — palette, layouts, animations (crumble, float, reveal)
- `script.js` — vanilla JS: IntersectionObserver triggers, parallax, hand canvas,
  selection + pour logic
- `REVERSE_ENGINEERING.md` — the study this demo was rebuilt from

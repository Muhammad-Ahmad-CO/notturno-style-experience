# Santioni Spirits (santionispirits.com) — Reverse Engineering Map

Source of evidence (all public, checked 2026-11-08):
- Live HTML of santionispirits.com (HTTP 200, 32,519 bytes)
- Public UIL data file `assets/data/uil.1782836328290.json` (270,255 bytes, 3,612 parameters)
- Public JS bundle `assets/js/app.1782836328290.js` (2,086,814 bytes) — static string/class analysis + REA analysis
- Abduzeedo article on Active Theory's Notturno Experience; Awwwards record; Instagram reel De1njZtRl4t frame check

## Tech stack found
- Engine: HydraX 1.1.20 (Active Theory's WebGL framework), window.CREATED_WITH_HYDRAX = "1.1.20"
- Single-page WebGL experience. No server-rendered copy in HTML ("Please enable javascript").
- CMS copy via Sanity (ssgCopy JSON embedded in HTML; retailers list empty at check time)
- Analytics: Google Tag Manager / GA G-L7LC5PPCFS
- Unsupported-browser fallback page: unsupported.html (needs desktop WebGL)

## Typography (from live CSS)
- Display headings: "Charles Rosie Regular" — heading1 up to 217px at >=768px, uppercase, line-height 1.2
- Bold body/labels: "PPNikkeiMaru-Ultrabold" (12-15px, uppercase)
- Light body: "GT-Era-Text-Light"

## Palette (from UIL parameters)
- Bright red #C82924 (primary), red variants #BE261E / #C1271F / #BC251C
- Dark red-brown #592223
- Cream #F3F1E9, white #FFFFFF, ink #121212 / #000000
- Drink colours: blue #72C5F6 / #2FB5F9 / deep blue #00378F; green #97F3AD / #14C251; yellow #FBEB7F

## Header (from bundle layout code)
- Script logo top-left (Santioni Spirits wordmark)
- Menu pill top-right: link "EXPERIENCE" (active state), a small red SVG ornament (42x12), link "COLLECTION"
- Note: the reddish middle element seen blurred in the reel is this ornament, not a word.

## Scenes (classes confirmed in bundle + parameter counts in UIL)
Order as experienced (reel + scene system):
1. IntroScene — title card "THE NOTTURNO EXPERIENCE" (geometry: intro/title)
2. EyesOpenScene (13 params) — manga eyes opening
3. ApproachScene (195) — saint approaches a circular portal/monolith door (landscape, moon, portal, steps geometry)
4. NearScene (182)
5. WanderScene (40) / TargetScene (80)
6. HandScene (117) + HandFXScene (37) — illustrated hand on red wood, "HOLD & MOVE" drag interaction, caption "HESITANTLY, HIS HAND DRAWS FORWARD" (caption confirmed via article/reel, not bundle text)
7. DrinkSelectionScene (409) — saint before three bottles on plinths
8. DrinkPourScene (135) — pour into martini glass; pouring audio volume follows pour progress (code: updatePouringAudio, blend .24-.28)
9. TasteScene (32) — character drinks, transformation
10. AntiGravityScene (510 — largest) — floating / vortex after the sip
11. ColosseumScene (244) — classical structure, floating rocks
12. CathedralScene (177) — white cathedral colonnade, table, bottles
13. PillarCrumbleScene (61) — pillars fracture/crumble
14. CollectionScene (273) — text: "NOTTURNO COLLECTION", "AN ODE TO THE NIGHT, YOUR NIGHT", "SANTIONI / SPIRITS"
15. ProductsScene (393) — the three products (below)
16. ProfileScene (26), RetailScene (20), FooterScene (14), TransitionScene (6)

## Products (text3d in UIL, ProductsScene)
1. ORANGE CHOCOLATE & CREAM — yellow/amber (#FBEB7F family)
2. MINT CHOCOLATE & CREAM — green (#97F3AD / #14C251)
3. MARSHMALLOW COFFEE & CREAM — blue (#72C5F6 family; name spelled "marshmellow" in asset filenames)
Taglines found as textures/geometry: "CHILL YOUR SPIRIT / SHAKE YOUR SPIRIT / POUR YOUR SPIRIT", "INDULGE NOW, ATONE LATER"

## Interaction model
- Desktop-first, scroll + hold-and-drag ("HOLD & MOVE") drive a fixed WebGL stage; panels are comic frames
- Cursor-following illustrated hand leaves red smears in HandScene
- Branching by drink choice in DrinkSelectionScene changes Taste/AntiGravity outcome colour

## Rebuild rule for our project
Same scene order, palette, interaction model, header layout and pacing — with a fictional brand, our own copy, and our own original artwork/code. No Santioni assets, geometry, textures, fonts or code are reused.

# DrawGeo: Decision log

## Changes on 2026-09-26

| # | Decision | Why |
|---|---|---|
| N1 | **Scoring removed completely** (you chose option b): no L/E counter, no per-tool costs, no per-step costs, no goals or stars. Problems are now simply solved / not solved. The engine no longer carries costs at all (`costs.ts`, `Step.cost`, `Step.tier` deleted). §5 and C3 below are superseded. | You found it complicating and visually overwhelming. Removing it from the engine too avoids dead code (the bloat lesson). |
| N2 | Macro tests kept: each shortcut tool must equal its ruler-and-compass recipe (now a correctness check, not a cost check). | Still proves the composites are geometrically right. |
| N3 | **Icon style rules**: 24×24 grid, content inside 3–21, **one color**, thin stroke = what you pick, bold stroke = what the tool creates, hollow dots = points, **no text**. Main-bar icons are Euclidea blue on white; white on blue when active. | Euclidea's clarity without copying its assets (copyrighted). |
| N4 | Icons are **drawn in-house**, except the Move hand, taken from **Lucide (ISC license)**; see THIRD_PARTY_NOTICES.md. Icon review page: open the app with `?icons` (or `?icons&group=main`). | No geometry-tool icon set exists to download; a hand is hard to draw well. |
| N5 | Compass icon is the **drawing instrument** (hinge + two legs), not a circle with an "R". | Readable at 16px, and doesn't compete with the Circle icon. |
| N7 | Construct and Circles icons redrawn in the new style. **Line family**: Line runs past both points, Ray starts at a point, Segment stops at both, Vector ends in an arrow. **Filled dot = a point the tool creates** (Midpoint). Polygons, Transform, Measure, Edit and Typed-number icons are still the old style. | Trial on two groups before committing to the style (your call: keep, revert or change). |
| N10 | Icon strokes thinned back toward the first version's weight (thin 1.3 / bold 1.8), keeping the thin-vs-bold distinction; More-drawer icons are blue like the main bar. | Your feedback: earlier thickness looked better. |
| N11 | **Polygons and Transform icons follow GeoGebra Geometry's ideas** (your reference): filled shapes with vertex points; each transform shows the original (thin) and its image (bold, light fill) with the thing that defines it (mirror line, center point, vector arrow, turning arrow, rays from the center). Redrawn in our style, not copied (GeoGebra's icons are licensed). | Your request. |
| N12 | **Problems, About and "given objects" removed from the code** (2026-09-27): the 14 built-in problems, the answer checker, progress storage, the problem banner, the About dialog, and the `given` flag (only built-in problems ever set it). The test-only scratch builder moved to `tests/`. | Not needed: DrawGeo is for solving external problems (olympiad, books); removing dead code avoids bloat. A "mark as given" action for your own problems can be added later if wanted. |
| N13 | **More drawer can be closed without choosing**: ✕ button, tap anywhere outside (that tap does *not* act on the canvas), ⋯ again, or Esc. | Hard to get out of on mobile. |
| N14 | **Pinning is an explicit pin button** on each More tool (filled when pinned) with a short confirmation. Long-press removed; right-click still pins on desktop. | Long-press pinned *and* then selected the tool on release ("half selecting"). |
| N15 | Regular polygon icon: even hexagon, the two corners you pick hollow, the corners the tool creates filled (candidate C of A/B/C). | Previous pentagon and "circle + hexagon" versions read poorly. |
| N16 | **Restore after moving.** Every point dragged with Move since the last construction remembers where it started; a restore button puts them all back in one step (no count: it isn't needed). It shows only while something is away from its start; constructing, deleting or opening another file ends the session; undo of a restore brings the button back. In memory only: gone on reload. | Explore a figure freely (especially on phones, where drags happen by accident) without losing the original. |
| N17 | **Viewers of a shared link can drag points and restore them** (still no editing, nothing saved). | Lets someone test a shared solution by moving it, then snap it back. |
| N18 | Restore icon (your choice, like Euclidea's mobile reset): a center dot with two arrows circling it, rotationally symmetric. Desktop: next to the book, bottom left. Phone: opposite the book, bottom right, above the hint and tools. | Simple and familiar from Euclidea; it only appears after a drag, which keeps it from reading as "reload page". |
| N8 | **Light/dark switch** in the top-right corner, left of undo/redo: one tap flips light ↔ dark; the icon shows the mode you'd switch to (moon in light, sun in dark). It follows the device until you tap it; Settings still has "System". | Your request. |
| N9 | The Steps button (bottom left) is now an **open book**. | So it isn't confused with the ☰ menu. |
| N6 | Testing added: per-tool geometry checks over random inputs (`tests/tools.test.ts`), random action sequences checking consistency after every action + undo-all/redo-all + drag = full re-evaluation (`tests/fuzz.test.ts`), save round-trips for every tool (`tests/roundtrip.test.ts`), every input style through the UI (`e2e/inputs.spec.ts`), seeded monkey runs (`e2e/monkey.spec.ts`), a pixel check that constructions are really drawn (`e2e/render.spec.ts`), and a **dev-server** test project (the blank-canvas bug only showed there). | Your request for rigorous testing. |

---

Every assumption and decision made while building v1, with the reason. Where a
decision departs from [PLAN.md](PLAN.md), it says so. Guiding rule when unsure:
**do what the Euclidea web app does.**

Status legend: ✅ built · ⏸ deferred · ⚠️ built but not verified end-to-end

---

## 1. Platform & devices

| # | Decision | Why |
|---|---|---|
| P1 | A **web app** that is also an installable **PWA** (works offline after the first visit). | Runs on phone, iPad and desktop from one codebase; no app store. |
| P2 | One input path: **Pointer Events** for mouse, trackpad, touch and pen. | The same code handles every device, including Apple Pencil and stylus. |
| P3 | Layout breakpoints: **phone < 600px**, **tablet 600–1023px**, **desktop ≥ 1024px**. | Matches PLAN §4.3. |
| P4 | Respect iPhone/iPad **safe areas** (notch, home bar) and disable browser gestures on the canvas (`touch-action: none`). | Otherwise iOS steals pinches and swipes and buttons hide under the home bar. |

## 2. Input (mouse, touch, pen): assumptions

You said you hadn't decided on mouse vs pencil, so all of them are supported. These are the assumptions:

| # | Decision | Why |
|---|---|---|
| I1 | **Tap/click = do the tool action. Drag on the canvas = pan, in every tool.** Only the **Move** tool drags points. | Euclidea's behavior. It removes the "did I just move a point by accident?" problem on touch. |
| I2 | A press becomes a pan after moving **5px (mouse), 6px (pen), 10px (finger)**. | Fingers wobble; a precise tap must not become a pan. |
| I3 | Hit tolerance in **screen pixels**: mouse/pen **11px** for points, **8px** for lines/circles; finger **22px / 16px**. | The same feel at every zoom. Fingers cover more area than a cursor. |
| I4 | **Apple Pencil / stylus is treated like a mouse** (precise tolerances), and pencil hover (iPad Pro) shows previews. | A pen is as precise as a mouse, and hover comes for free with Pointer Events. |
| I5 | **Two fingers = pinch-zoom + pan, never a construction.** A second finger cancels whatever the first finger started (including a point drag). | Prevents accidental points while zooming on phones and iPads. |
| I6 | **Mouse wheel zooms** at the cursor (continuous, ≈ ×1.1 per notch). **Ctrl/⌘ + wheel** and **trackpad pinch** zoom. Trackpad two-finger scroll with a sideways part **pans**. Shift+wheel pans sideways. Safari's trackpad `gesture*` events are handled too. | Euclidea and GeoGebra zoom on the wheel; trackpad users still get panning. |
| I7 | **Space+drag** or **middle mouse** pans. **Right-click** cancels the current tool input. | Desktop conventions (Figma, Excalidraw). |
| I8 | Touch devices get **slightly larger points** (5px vs 4.2px radius) and 48px tool buttons (46px on desktop). | Easier to see and hit under a finger. |
| I9 | On touch, the More drawer's search box is **not auto-focused**. | Otherwise the phone keyboard pops up and covers the drawer. |
| I10 | **Long-press** on a More tool (touch) pins it; right-click does the same with a mouse. | There's no right-click on touch. |
| I11 | Previews (ghost of the result) show on **hover** (mouse, pen). On touch there is no hover, so a tap acts immediately. | Touch has no hover; showing a preview under the finger would be hidden anyway. |
| ⏸ I12 | Long-press context menu on the canvas; box-select on touch. | Not needed for v1. Select on touch = tap; delete via the popover. |

## 3. Look & feel (Euclidea first)

| # | Decision | Why |
|---|---|---|
| L1 | Tool buttons are **separate white rounded squares** at the bottom; the active tool is **solid blue with a white icon**. Tool order is Euclidea's: Move, Point, Line, Circle, Perpendicular bisector, Perpendicular, Angle bisector, Parallel, Compass, Intersect, then **⋯ More**. | Mirrors the Euclidea screenshot. |
| L2 | Big grey **score** (`4L 4E`) at the top center; **undo/redo** as round buttons top right; **menu** top left with the construction name. | Euclidea's layout. |
| L3 | A **hint line** above the tools tells you what to pick next ("Circle: pick the center"). | Euclidea does this, and it replaces a manual. |
| L4 | **No grid and no grid snapping.** | Pure construction; the old GeoDraw snapped to a 20px grid, which let non-Euclidean points sneak in (§13 of the plan). |
| L5 | **Filled point = draggable, hollow ring = constructed** (intersection, midpoint…). Givens are drawn bolder. | Tells you what you can move without reading anything. |
| L6 | **Point labels on by default** (A, B, C…, then A₁…). Toggle in Settings. *Departs from Euclidea, which has no labels.* | The Steps list and measurements need names ("Circle (A, B)"), and naming things was part of the brief. |
| L7 | Fonts: **Nunito** for the UI, **STIX Two Text italic** for point labels, both **self-hosted** (no Google Fonts request). | Clean rounded UI like Euclidea; textbook-style math labels; works offline. |
| L8 | **Zoom 10%–2000%**, continuous; pan limited to **~2 screens** beyond the construction. | Bounded like Euclidea (you asked for a limit); you can't get lost. |
| L9 | New problems are framed as a **square region 1.8× the size of the givens**, inside the area not covered by the UI. | Leaves room to construct around the givens. Found by an e2e test: the old framing put the triangle's apex under the problem banner. |
| L10 | Zoom controls sit **bottom-right**; hidden on phones (pinch instead). *Plan said bottom-left.* | The Steps button took bottom-left; on phones the space goes to the toolbar. |
| L11 | Toasts appear **just above the toolbar**. | Top toasts covered the problem banner on phones (seen in a screenshot). |
| L12 | Light and dark themes with **one token table** for the canvas and UI; a unit test enforces **≥ 3:1 contrast** for every object color and **≥ 4.5:1** for text in both themes. Theme: System / Light / Dark. | Your requirement: every object clearly visible in both modes. |

## 4. Tools

| # | Decision | Why |
|---|---|---|
| T1 | **Intersect** works two ways: pick two objects → **all** their intersection points; or tap directly on a crossing → **just that point**. | Your main request, plus Euclidea's direct tap. |
| T2 | **Virtual intersections (plan D1, hybrid)**: while picking a point in any tool, nearby crossings show as small rings and snap; tapping one creates it. | Euclidea speed without auto-creating every point. |
| T3 | Snap priority: **existing point → crossing → line/circle (creates a point that slides on it) → free point.** | PLAN §4.2. |
| T4 | **Segments, rays and arcs intersect only within what's drawn** (plan D3). | Euclidea behavior: you can only intersect what you can see. |
| T5 | Intersect **never duplicates** a point that already exists. Hidden points don't block new ones. | Clean constructions; the "Center of a circle" problem has a hidden center that must not block the answer. |
| T6 | Picking the **same point twice** in one tool is refused. | A line through A and A is meaningless. |
| T7 | Points created while picking (e.g. a new point for a circle) are **committed with the step**; one undo removes the circle and its new points. **Esc** or undo during picking cancels the half-finished tool. | One undo per construction (a GeoDraw lesson). |
| T8 | **Angle bisector** takes 3 points (side, vertex, side). **Compass** takes 2 points + center, **or** a circle + center. **Perpendicular/Parallel/Tangents** accept their inputs in either order. | Euclidea's tool inputs. |
| T9 | **Rotate** uses an angle given by **3 existing points**; **Dilate** uses the ratio **|C→B| / |C→A|** of existing points. Typed angles/factors are the Tier D versions. | Keeps Tier B tools pure ruler-and-compass. |
| T10 | **Transforms apply to points, lines/segments/rays and circles/arcs**, not to polygons as a whole. | Polygons are regions (for fill/area), not curves. Transform their sides instead. |
| T11 | **Regular polygon is Tier D (starred) for every n.** *Departs from the plan (Tier B for constructible n).* | Its E cost isn't derived yet, and a made-up number would make the score dishonest. The Gauss–Wantzel constructibility check is in the engine (`isConstructibleNgon`) for when the cost is derived. |
| T12 | Tier D typed lengths use **units where 1 unit = 100 world units** (≈100px at 100% zoom). Measurements use the same unit. | "Length 2" gives a sensible size instead of a 2-pixel segment. |
| T13 | **Measure** tools: distance (2 points or a segment), angle (3 points, 0–180°), area (polygon or circle/sector). Measures appear in the Measures tab and, optionally, on the figure; they update live while dragging. | "Move it and get new information." |
| T14 | **Label** tool opens the name editor; **Show/Hide** shows hidden objects faintly while active; **Delete** cascades with a confirmation that states how many objects go. | GeoGebra's Edit group. |
| T15 | Only **2 pins** on the main bar; the **last-used More tool** gets a temporary slot next to ⋯. | PLAN §3.4 (max 12 buttons). |
| T16 | **Strict mode** (Settings) = Point, Line, Circle, Intersect only. | Pure Euclid, PLAN D4. |

## 5. Scoring (L/E)

| # | Decision | Why |
|---|---|---|
| S1 | **L = number of tool uses; E = elementary lines/circles.** Points, intersections, measuring and editing cost 0. A tool that draws two lines at once (Tangents) is **1L**. | Euclidea's convention. |
| S2 | Tier A costs are **Euclidea's table** exactly. Perpendicular bisector (3E), Perpendicular (3E), Parallel (4E) and Angle bisector (4E) are **re-derived by rebuilding them from circles and lines** in tests. Compass (5E) is taken from Euclidea's table and not re-derived. | "Calculated, not typed in," where practical. |
| S3 | Tier B costs are **our own explicit constructions** (upper bounds, not proven minimal): Segment/Ray/Vector 1E; Midpoint **3E** if line AB exists, **4E** if not, **6E** for a circle's center; Tangents **7E** (point outside), **4E** (point on circle); Polygon **n L n E**; Semicircle midpoint + 1; Sector 3E; per transformed point: reflect in line **2E**, reflect in point **2E**, translate **10E**, rotate **15E**, dilate **8E**; a transformed line or circle costs 2P+1 and an arc 3P+1. Reflections and midpoint are macro-tested. | Honest numbers that can be lowered later if cheaper constructions are found. |
| S4 | Tier D tools count as drawn but mark the score with **`*`**, and problem mode disallows them. | Plan D11. |
| S5 | A **Show score** toggle hides the counter. | Your request. |

## 6. Geometry engine & accuracy

| # | Decision | Why |
|---|---|---|
| G1 | World coordinates are **y-up, float64**; the renderer flips y. | Standard math orientation: angles and measures read normally. |
| G2 | **Only free points store coordinates**; everything else is recomputed from its definition in creation order. | No drift, and dragging just works (a GeoDraw lesson). |
| G3 | The engine has exactly **two curve types (line, circle)**. Segments/rays are clipped lines; arcs are clipped circles; polygons are regions that never intersect. | Keeps intersection code at 3 functions instead of GeoDraw's 15. |
| G4 | Intersection roots are **ordered by the parents' orientation** (along the line; left/right of center→center); tangency returns a **double root**. A test drags a circle through half a turn and checks for no swaps. | Stable point identity while dragging. Explicit nearest-previous tracking wasn't needed; left as a fallback idea. |
| G5 | **Relative tolerances** in one module; none depend on zoom. | PLAN §6.1 and a GeoDraw lesson. |
| G6 | Objects that become impossible while dragging are **undefined (hidden), not deleted**, and return when possible. | PLAN §4.2. |
| G7 | Undo/redo stores **patches (before/after) with structural sharing**; unlimited; a whole drag is one entry. | Small memory, fast; GeoDraw was capped at 50. |
| G8 | Measured performance: **1,000-object drag re-evaluation < 2 ms/frame** (enforced by `tests/perf.test.ts`). The React UI doesn't re-render on pointer moves; the Measures panel refreshes at ~30 Hz while dragging. | PLAN §7. |

## 7. Problems & checking

| # | Decision | Why |
|---|---|---|
| C1 | **14 original problems** from Euclid's *Elements* (public domain), grouped Basics / Circles / Figures. **No Euclidea levels copied.** | IP (plan §3.3). |
| C2 | Checking is **automatic after every step** (Euclidea behavior): the construction is re-run **20 times with all free points moved randomly by up to 6%** of the figure size (seeded), and the goal must hold every time (at least 10 valid trials). | "Looks right" isn't "is right"; tests prove an eyeballed answer is rejected for every problem. |
| C3 | **Stars**: ★ solved, ★ L ≤ goal, ★ E ≤ goal. *Euclidea's third star is "V" (find all solutions): not implemented.* | Keeps the scoring feel; V needs multi-solution goals. |
| C4 | Givens are **locked** in a problem (can't be dragged, deleted, hidden or renamed). | Euclidea behavior. |
| C5 | Each problem lists its **allowed tools**. Some basics (perpendicular bisector, angle bisector, parallel) allow only Point, Line, Circle and Intersect, since the tool would make them trivial. | Like Euclidea's per-level tool unlocking. |
| C6 | Reopening a problem **resumes your last attempt**; **Restart** starts clean; best L/E is remembered. | Expected behavior. |

## 8. Saving & sharing

| # | Decision | Why |
|---|---|---|
| D1 | **Local-first**: autosave to IndexedDB 0.5 s after each change; the last open construction reopens on the next visit. | Works offline and without an account. |
| D2 | **Share link** puts the whole construction, compressed, in the URL fragment (`#share=…`). It opens **read-only** with replay and a **Make my copy** button. *Departs from the plan (server-side share id).* | No server is needed. The fragment never reaches a server, so it's private by default. Long constructions make long links; acceptable for now. |
| D3 | Exports: `.drawgeo.json`, **PNG** (2×) and **SVG** (white background), both with the **construction embedded** (Excalidraw's trick), plus **steps as text**. Opening an exported PNG/SVG restores the construction. | Share a picture that is still editable. |
| ⚠️ D4 | **Cloud accounts (Supabase)**: Google + email magic link, per-user rows with row-level security (`supabase/schema.sql`), autosync 2 s after changes, last-write-wins. **Only enabled when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set**, and the library loads lazily. **Not tested against a live Supabase project** (no credentials here); it typechecks, but treat it as unverified until you connect a project. | Plan M6. Without the env vars the app is fully local and the Account menu is hidden. |
| ⏸ D5 | A "newer version exists" prompt for sync conflicts. | Last-write-wins is enough for one person on a few devices; revisit if it bites. |
| D6 | Settings, pins and "current construction" live in `localStorage`. | Per-device conveniences. |

## 9. Tech choices

| # | Decision | Why |
|---|---|---|
| X1 | **React 19 + Zustand + Vite 8 + TypeScript 7 (strict)**, Canvas 2D with **two layers** (scene + overlay). | PLAN §5.5 and Excalidraw's pattern. |
| X2 | **No Tailwind, no Dexie.** CSS variables generated from the theme tokens; a 40-line IndexedDB wrapper. | Fewer dependencies (a bloat lesson); tokens must be shared with the canvas anyway. |
| X3 | No `Path2D` shape cache (an Excalidraw technique we *didn't* borrow). | Lines and circles are single draw calls; caching would add code without measurable gain. |
| X4 | **Main bundle ≈ 108 KB gzipped** (target < 250 KB); Supabase (55 KB) loads only when configured. | PLAN §7. |
| X5 | Tests: **Vitest + fast-check** (engine, costs, problems, theme, camera, perf), **Playwright on installed Chrome** with desktop, phone (Pixel 7) and tablet profiles, including real multi-touch via the DevTools protocol. A test hook is exposed only with `?e2e` in the URL. | No browser download needed; real touch coverage. |

## 10. Deferred (explicitly not built)

- Custom macros ("save your construction as a tool"), the sketch layer (plan D6), the hand-drawn skin (D7).
- Euclidea's "V" star (all solutions).
- Long-press context menu and touch box-select.
- Sync conflict prompt (D5), live verification of cloud sync (D4).
- CI pipeline (there's no git remote yet), full accessibility audit (keyboard + ARIA labels are in; screen-reader canvas description isn't), translations.

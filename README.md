# DrawGeo

Ruler-and-compass geometry in the browser: **Euclidea's look and scoring**, **GeoGebra Geometry's tools** behind a *More* drawer, and a **recorded list of steps** for every construction. Works on phone, iPad and desktop, with mouse, trackpad, touch or pencil, and installs as an offline app (PWA).

- [PLAN.md](PLAN.md): product & technical plan (scope, architecture, roadmap)
- [DECISIONS.md](DECISIONS.md): every assumption and decision made while building, with reasons

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/ (static; host anywhere)
npm run preview    # serve the build
```

## Test it

```bash
npm test           # engine, costs, problems, theme contrast, camera, performance (Vitest)
npm run e2e        # real Chrome: desktop, phone and tablet profiles, incl. multi-touch (Playwright)
npm run typecheck
```

`npm run e2e` uses your installed Google Chrome (`channel: 'chrome'`), so no browser download is needed.

## Optional: accounts & cloud sync

Everything works locally without an account. To enable Google / email sign-in and sync:

1. Create a Supabase project, enable the **Google** and **Email** auth providers.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
3. Create `.env.local`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
4. Rebuild. *Account & sync* appears in the menu.

## Code map

```
src/engine/    pure TypeScript geometry: no DOM, no React
  types.ts       data model (the document is the list of steps)
  intersect.ts   line/line, line/circle, circle/circle + clips
  evaluate.ts    definitions → geometry, transforms, dependency order
  build.ts       what each tool creates + its L/E cost
  costs.ts       cost table and tiers
  macros.ts      composite tools rebuilt from primitives (cost proofs)
  doc.ts         patches, undo/redo, cascade delete, scoring
  checker.ts     randomized solution checking
  problems.ts    14 problems from Euclid's Elements
src/render/    canvas renderer, camera, hit-testing, theme tokens, export
src/app/       React chrome, input controller, store, persistence
tests/         Vitest suites          e2e/  Playwright suites
```

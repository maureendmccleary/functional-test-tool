# functional-test-tool

Functional Accessibility Testing Tool — author functional tests, perform them
against a given assistive technology and operating system, record and score
issues, and export an evaluation report.

## Development

Requires Node 20 LTS (18.13+ works; the CI runs 20).

```bash
npm install
npm run dev         # Vite dev server
npm test            # Vitest
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # type-check, then build to dist/
npm run preview     # serve the built output
```

`npm run build` is what CI deploys to GitHub Pages. It sets `base: './'` so
assets resolve from a project sub-path — see `vite.config.ts` for why.

Evaluation files are read and written with the File System Access API, so
**loading and saving only work in Chromium** (Chrome, Edge). Other browsers are
told so rather than failing silently; everything else works anywhere.

## Layout

```
src/
  main.ts          entry point and top-level wiring
  types.ts         the evaluation data model
  config/          score lists and AT/OS catalogues
  state/           the single owner of mutable app state
  domain/          pure logic: migration, scoring, summary text. No DOM.
  io/              file pickers and .docx report generation
  ui/              one module per view or dialog, plus DOM primitives
```

Dependencies run one way: `ui/` → `domain/`, `state/`, `io/`, `config/`, and
never the reverse. `domain/` imports nothing but `types.ts`.

## Testing

`npm test` covers the pure logic and includes golden load/save round trips that
fail if the on-disk shape of an evaluation file changes.

`tests/SMOKE.md` is a manual checklist for the dialog and focus behavior the
automated tests do not reach. Run it before releasing.

## Deployment

Pushing to `main` runs lint, type check, and tests, then builds and publishes
`dist/` to GitHub Pages — see `.github/workflows/deploy.yml`.

## License

Not licensed for redistribution. `package.json` declares `UNLICENSED` and no
licence is granted; ask before reusing this code.

## Architecture

[ARCHITECTURE.md](ARCHITECTURE.md) covers the module layout and the dependency
rule, the data model, how failures and the build are handled, and what is worth
doing next.

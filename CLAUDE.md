# SVGR Lib

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it. Stay on the current branch; do not create
> feature branches for code changes.

Shared, platform-agnostic business logic for the SVGR web and React Native apps.

**npm**: `@sudobility/svgr_lib` (private, BUSL-1.1). Published to **GitHub Packages**, not public npm.

## Tech stack

- TypeScript (strict, JSX), ESM output only.
- Runtime & package manager: **Bun** (never npm/yarn/pnpm to install).
- Build: `tsc -p tsconfig.build.json` → `dist/` (JS + `.d.ts`).
- Test: **Vitest**.

## Commands (verified against package.json)

```bash
bun install
bun run build         # tsc -p tsconfig.build.json → dist/
bun run build:watch
bun run clean         # rm -rf dist
bun run test:unit     # vitest run  (there is NO `test` script)
bun run test:watch
bun run typecheck     # tsc --noEmit
bun run lint          # eslint src --ext .ts,.tsx
bun run lint:fix
bun run format        # prettier --write
```

- **Do not run `bun test`** — it invokes Bun's built-in test runner, not Vitest. Use `bun run test:unit`.
- Tests are colocated as `*.test.ts` next to sources and excluded from the build.

## Layout

```
src/
├── index.ts            # all public exports
├── config/             # constants.ts (APP_*, QUALITY_*, SUPPORTED_IMAGE_TYPES, MAX_PIXELS),
│                       # presets.ts (CONVERSION_PRESETS), types.ts (SvgrAppConfig/Firebase/RevenueCat)
├── hooks/              # useImageConverter.ts, useCommunities.ts
├── i18n/               # config.ts (SUPPORTED_LANGUAGES, namespaces, hreflang map)
└── utils/              # validation.ts, svg.ts, scale-image.ts (scaleImageWeb)
```

## Architecture

```
svgr_types + svgr_client  →  svgr_lib (this)  →  svgr_app (web) + svgr_app_rn (RN)
```

- `useImageConverter(client, scaleImage?)` is the central abstraction. It takes an
  `SvgrClient` and delegates all API/network work to `@sudobility/svgr_client` hooks
  (`useUploadImage`, `useCreateJob`, `useJobStatus`, etc.) + React Query. It owns the
  UI state machine: upload → convert → poll job → fetch preview/SVG; exposes
  `upload/convert/cancel/reset/selectJob/fetchSvg` plus option setters.
- `useCommunities(client, language, enabled?)` fetches + groups communities by platform.
- Result is NOT held as an SVG string: completion yields `previewUrl` (JPEG object URL)
  and `svgFilename`; call `fetchSvg()` to get the SVG `Blob` on demand.

## Key conventions & gotchas

- **Platform-agnostic core.** Hooks/utils must not import browser- or Node-only APIs.
  The browser-specific scaling impl lives in `scale-image.ts` as `scaleImageWeb`
  (Canvas/`Image`/`document`) and is **injected** into `useImageConverter` via the
  `ScaleImageFn` param — the RN app passes its own. Keep platform code at the edges.
- **Quality is a 1–10 integer scale**: `QUALITY_MIN=1`, `QUALITY_MAX=10`, `QUALITY_DEFAULT=5`.
  Never 0–100 or 0–1. These constants are the ecosystem's source of truth.
- **Exactly 5 image input types** in `SUPPORTED_IMAGE_TYPES`: PNG, JPEG, WebP, BMP, GIF.
  Adding one means updating that array AND the extension map in `getAcceptedFileExtensions`.
  (Note: the `ImageType` values like `logo`/`auto` used by `supportsOcrOption` are a
  *different* axis — conversion categories from svgr_types, not input MIME types.)
- **File size cap is 15 MB** (`MAX_FILE_SIZE_MB` / `MAX_FILE_SIZE_BYTES`). `MAX_PIXELS` =
  1,000,000 is the separate server pixel cap used by `scaleImageWeb`.
- **15 supported languages** in `SUPPORTED_LANGUAGES`; namespaces are `['svgr','auth']`.
  `LANGUAGE_HREFLANG_MAP` maps internal codes (`zh-hant`) → hreflang (`zh-Hant`) — critical
  for web SEO; keep internal codes and hreflang values distinct where they differ.
- **ESM-only**: imports use explicit `.js` extensions (source is `.ts`); keep this.

## Peer dependencies (consumers must provide)

`@sudobility/svgr_client ^1.0.67`, `@sudobility/svgr_types ^1.0.39`,
`@sudobility/types ^1.9.78`, `@tanstack/react-query >=5`, `react >=18`.

## Publishing / CI

- `.npmrc` scopes `@sudobility` to `https://npm.pkg.github.com`; auth needs
  `GH_PACKAGES_READ_TOKEN` (GitHub Packages read token).
- `.github/workflows/ci-cd.yml` delegates to `johnqh/workflows` unified CI/CD with
  `publish-target: github`. `prepublishOnly` runs `clean` + `build`.

## Related projects (siblings under the same parent dir)

`svgr_types` (types), `svgr_client` (API SDK), `svgr_api` (backend), `svgr_app` (web),
`svgr_app_rn` (React Native). This package sits between the client/types and the apps.

# @sudobility/svgr_lib

Shared, platform-agnostic business logic for the SVGR web (`svgr_app`) and React Native (`svgr_app_rn`) apps: React hooks, constants, conversion presets, i18n config, and validation/SVG utilities. Ships as ESM + TypeScript declarations.

- **License**: BUSL-1.1
- **Registry**: GitHub Packages (`@sudobility` scope → `https://npm.pkg.github.com`), not the public npm registry.

## Installation

Because this is a private package published to GitHub Packages, the consuming project needs an `.npmrc` that points the `@sudobility` scope at GitHub Packages and provides an auth token:

```
@sudobility:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_PACKAGES_READ_TOKEN}
```

Then install:

```bash
bun add @sudobility/svgr_lib
```

This package declares peer dependencies the consumer must also provide (see [Peer dependencies](#peer-dependencies)).

## Usage

```typescript
import {
  useImageConverter,
  useCommunities,
  validateImageFile,
  getPresetById,
  SUPPORTED_IMAGE_TYPES,
} from '@sudobility/svgr_lib';

// The conversion hook takes an SvgrClient instance (from @sudobility/svgr_client)
// and an optional scale-image function for the current platform.
const converter = useImageConverter(client);

await converter.upload(file); // sets converter.imageId
converter.setQuality(8);
converter.setImageType('logo');
converter.convert(); // polls job status; sets previewUrl / svgFilename when done
const svgBlob = await converter.fetchSvg();

// Validate a file before upload (MIME type + size, max 15 MB).
const result = validateImageFile('image/png', file.size);
if (!result.valid) console.error(result.error);
```

## API

### Hooks

- `useImageConverter(client, scaleImage?)` — the central conversion workflow hook. Manages `quality`, `transparentBg`, `ocr`, `mergePaths`, `imageType`, upload/job state (`imageId`, `currentJob`, `jobs`, `isUploading`, `isConverting`), `previewUrl`/`svgFilename`, and `error`. Exposes `upload`, `convert`, `cancel`, `reset`, `selectJob`, `fetchSvg` and the setters. Delegates all API calls to `@sudobility/svgr_client`.
- `useCommunities(client, language, enabled?)` — fetches communities and groups them by platform (`communitiesByPlatform`).
- `supportsOcrOption(imageType)` / `supportsTransparentBgOption(imageType)` — whether an image type supports OCR / transparent background, backed by `OCR_SUPPORTED_IMAGE_TYPES` and `TRANSPARENT_BG_SUPPORTED_IMAGE_TYPES`.

### Config & constants

- `APP_NAME` (`'SVGR'`), `APP_DOMAIN` (`'svgr.app'`), `COMPANY_NAME` (`'Sudobility Inc.'`)
- `QUALITY_MIN` (1), `QUALITY_MAX` (10), `QUALITY_DEFAULT` (5)
- `SUPPORTED_IMAGE_TYPES` — PNG, JPEG, WebP, BMP, GIF (and the `SupportedImageType` union)
- `MAX_PIXELS` (1,000,000) — server-side pixel cap used by image scaling
- `CONVERSION_PRESETS`, `DEFAULT_PRESET_ID`, `getPresetById(id)`, `getDefaultPreset()` — four presets: Fast, Balanced, Quality, Transparent
- Types: `SvgrAppConfig`, `FirebaseConfig`, `RevenueCatConfig`, `ConversionPreset`

### Utils

- `isValidImageType(mimeType)` — validate a MIME type against `SUPPORTED_IMAGE_TYPES`
- `validateImageFile(mimeType, fileSize)` — full validation (type + size), returns `{ valid, error }`; size cap is `MAX_FILE_SIZE_MB` (15 MB) / `MAX_FILE_SIZE_BYTES`
- `getBaseName(filename?)`, `getImageTypeDisplayName(mimeType)`, `getSupportedFormatsDisplay()`, `getAcceptedFileExtensions()`
- `getSvgDimensions(svg)`, `getSvgFileSize(svg)`, `getSvgFileSizeKB(svg)` — parse SVG strings for dimensions / byte size
- `scaleImageWeb(base64, maxPixels?)` — **web-only** (Canvas API) implementation of the `ScaleImageFn` contract; pass it into `useImageConverter` from the web app

### i18n

- `SUPPORTED_LANGUAGES` (15 languages), `SUPPORTED_LANGUAGE_CODES`, `DEFAULT_LANGUAGE` (`'en'`)
- `I18N_NAMESPACES` (`['svgr', 'auth']`), `DEFAULT_NAMESPACE` (`'svgr'`)
- `LANGUAGE_HREFLANG_MAP` — maps internal codes (e.g. `zh-hant`) to hreflang values (e.g. `zh-Hant`) for SEO

### Re-exports (convenience)

`ImageType`, `Community`, `CommunityPlatform`, `IMAGE_TYPES`, `COMMUNITY_PLATFORMS` are re-exported from `@sudobility/svgr_types`.

## Development

Runtime and package manager is **Bun** (do not use npm/yarn/pnpm to install).

```bash
bun install           # install dependencies
bun run build         # compile ESM + .d.ts to dist/ (tsconfig.build.json)
bun run build:watch   # build in watch mode
bun run clean         # remove dist/
bun run test:unit     # run the Vitest suite once
bun run test:watch    # Vitest in watch mode
bun run typecheck     # tsc --noEmit
bun run lint          # ESLint over src
bun run lint:fix      # ESLint --fix
bun run format        # Prettier write
```

Note: use `bun run test:unit`, not `bun test` — the latter invokes Bun's built-in test runner, while the suite is written for Vitest.

## Peer dependencies

Consumers must provide:

- `@sudobility/svgr_client` `^1.0.67`
- `@sudobility/svgr_types` `^1.0.39`
- `@sudobility/types` `^1.9.78`
- `@tanstack/react-query` `>=5.0.0`
- `react` `>=18.0.0`

## Architecture

```
svgr_types + svgr_client
        ^
        |
    svgr_lib (this package)
        ^
        |
  svgr_app (web) + svgr_app_rn (React Native)
```

## Related packages

- `svgr_types` — shared type definitions (peer dependency)
- `svgr_client` — API client SDK (peer dependency; `useImageConverter`/`useCommunities` delegate to it)
- `svgr_api` — backend API server (indirect, via `svgr_client`)
- `svgr_app` — web app consumer
- `svgr_app_rn` — React Native app consumer

## License

BUSL-1.1

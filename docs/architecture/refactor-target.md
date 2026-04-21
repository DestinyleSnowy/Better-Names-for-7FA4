# Refactor Target

## Goals

- Move the extension to `MV3 + TypeScript`.
- Use a single repo with multiple build entries, while keeping the content runtime on one unified app entry.
- Keep the service worker restricted to platform capabilities.
- Register features independently and compose them by page route.
- Isolate config, schema, migration, and adapters so feature migration does not leak platform details.
- Keep the legacy release folder `Better-Names-for-7FA4/` as migration reference only.

## Target Layout

```text
src/
  app/
    content/
      composition/
      routes/
    popup/
    worker/
  features/
  adapters/
  platform/
  config/
    defaults/
    feature-flags/
    migration/
    schema/
  shared/
assets/
manifests/
scripts/
tests/
docs/
```

## Runtime Boundaries

### `src/app`

Runtime entry layer:

- `content/`: the only content runtime bootstrap, responsible for route resolution and feature assembly
- `popup/`: popup shell and interaction entry
- `worker/`: service worker entry limited to browser runtime, messaging, and storage bootstrap

### `src/features`

Business features register independently, expose their own `FeatureId`, and opt into page routes.

### `src/platform`

Platform-only capabilities:

- browser runtime state
- messaging
- storage service
- network service

### `src/adapters`

Thin environment adapters:

- DOM adapter
- browser API adapter
- storage adapter

### `src/config`

Configuration and persistence contracts:

- defaults
- feature-flag resolution
- schema
- migration

### `src/shared`

Cross-runtime shared contracts:

- storage keys
- message names
- feature flags
- shared utilities

## Migration Strategy

1. Freeze the legacy folder as reference only.
2. Keep the new build pipeline and manifest generation centered on `src/app/*` and `manifests/`.
3. Stabilize message contracts, feature flags, and storage schema before migrating behavior.
4. Move each page capability into an independent module under `src/features`.
5. Delete the transitional legacy source trees (`src/content`, `src/background`, `src/panel`, `src/popup`) after their responsibilities are fully absorbed by the new app/feature layout.

# Refactor Target

## Goals

- Keep the existing release folder `Better-Names-for-7FA4/` intact during the first refactor stage.
- Move future development to a source-first layout under `src/`.
- Split the extension into clear runtime domains: background, content, panel, popup, shared, data.
- Separate static assets, manifests, scripts, tests, and architecture documents from feature code.

## Target Layout

```text
src/
  app/
    content/
    popup/
    worker/
  features/
  platform/
  adapters/
  config/
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

- `content/`: the single content-app bootstrap
- `popup/`: popup entry and shell
- `worker/`: service worker entry limited to platform capabilities

### `src/features`

Business features register independently and opt into routes.

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
2. Land the new build pipeline and manifest generation first.
3. Stabilize message contracts and storage schema before moving features.
4. Migrate features into independent modules under `src/features`.
5. Keep the worker limited to platform capabilities throughout the migration.

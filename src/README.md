# Source Layout

This directory is the source of truth for the new TypeScript refactor.

## Current Architecture

- `app/`: runtime entrypoints and composition
- `features/`: independently registered product features
- `platform/`: browser-platform capability services
- `adapters/`: DOM, API, and storage adapters
- `config/`: defaults, schema, and migrations
- `shared/`: contracts, types, and utilities

Older `src/background`, `src/content`, `src/panel`, and `src/popup` placeholders remain in the tree as earlier scaffolding, but the active design baseline is the `src/app + src/features + src/platform + src/adapters + src/config + src/shared` split.

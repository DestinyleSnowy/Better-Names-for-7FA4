# Scripts

Project automation is organized by responsibility.

## Current Focus

- `build/`: manifest generation and future bundle assembly
- `release/`: reserved for packaging and publishing helpers
- `sync/`: reserved for one-off migration utilities
- `data/`: reserved for dataset tooling migrated from `database/`

The active build helper today is [manifest.mjs](E:/Better-Names-for-7FA4-Refactoring/scripts/build/manifest.mjs), which writes the final MV3 manifest into `dist/`.

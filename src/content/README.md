# Content Domain

This domain owns all page-injected logic. The refactor splits the current monolith by route and feature.

## Planned layers

- `bootstraps/`: route-specific entry files
- `core/`: shared DOM/runtime infrastructure
- `features/`: isolated feature modules

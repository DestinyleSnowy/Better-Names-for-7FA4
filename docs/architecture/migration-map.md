# Migration Map

This document records the intended destination for the current legacy files.

| Legacy path | Target module |
| --- | --- |
| `Better-Names-for-7FA4/background.js` | `src/app/worker/` plus `src/platform/` |
| `Better-Names-for-7FA4/content/main.js` | `src/app/content/main.ts` plus route-composed feature modules |
| `Better-Names-for-7FA4/content/render_logic.js` | `src/features/tags/` and `src/features/panel/` |
| `Better-Names-for-7FA4/content/intercept_information.js` | `src/features/profile/` |
| `Better-Names-for-7FA4/content/gm-shim.js` | `src/shared/adapters/greasemonkey-shim.js` |
| `Better-Names-for-7FA4/content/panel/panel.js` | `src/features/panel/` |
| `Better-Names-for-7FA4/content/panel/panel.css` | `src/features/panel/` or `assets/` depending on bundling strategy |
| `Better-Names-for-7FA4/content/panel/panel.html` | `src/features/panel/` or `assets/` depending on bundling strategy |
| `Better-Names-for-7FA4/content/panel/avatar-blocker.js` | `src/features/panel/` |
| `Better-Names-for-7FA4/data/users.json` | `src/data/source/` or future generated assets |
| `Better-Names-for-7FA4/data/special_users.json` | `src/data/source/` or future generated assets |
| `Better-Names-for-7FA4/submitter/submitter/*` | `src/app/popup/` plus `src/platform/` |
| `database/*.py` | `scripts/data/` or a future standalone tooling package |

## Notes

- Vendor files should no longer live beside business logic. They move under `assets/vendor/`.
- Manifests should be generated from `manifests/` into `dist/`.
- Transitional trees currently still present under `src/background`, `src/content`, `src/panel`, and `src/popup` are legacy refactor residue and should be removed once replacement modules are verified.

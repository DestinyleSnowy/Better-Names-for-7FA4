# Migration Map

This document records the intended destination for the current legacy files.

| Legacy path | Target module |
| --- | --- |
| `Better-Names-for-7FA4/background.js` | `src/background/` |
| `Better-Names-for-7FA4/content/main.js` | `src/content/bootstraps/main-entry.js` plus feature modules |
| `Better-Names-for-7FA4/content/render_logic.js` | `src/content/features/tag-view/` and `src/panel/` |
| `Better-Names-for-7FA4/content/intercept_information.js` | `src/content/features/profile-interceptor/` |
| `Better-Names-for-7FA4/content/gm-shim.js` | `src/shared/adapters/greasemonkey-shim.js` |
| `Better-Names-for-7FA4/content/panel/panel.js` | `src/panel/` |
| `Better-Names-for-7FA4/content/panel/panel.css` | `src/panel/styles/` |
| `Better-Names-for-7FA4/content/panel/panel.html` | `src/panel/templates/` |
| `Better-Names-for-7FA4/content/panel/avatar-blocker.js` | `src/content/features/panel/avatar-blocking.js` |
| `Better-Names-for-7FA4/data/users.json` | `src/data/source/users.json` |
| `Better-Names-for-7FA4/data/special_users.json` | `src/data/source/special-users.json` |
| `Better-Names-for-7FA4/submitter/submitter/*` | `src/popup/` |
| `database/*.py` | `scripts/data/` or a future standalone tooling package |

## Notes

- Vendor files should no longer live beside business logic. They move under `assets/vendor/`.
- Future manifests should be generated from `manifests/` instead of edited in-place inside the release folder.
- The legacy release folder remains the assembly target until the new pipeline is wired in.

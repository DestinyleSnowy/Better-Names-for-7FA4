# AGENTS.md

## Project

Better Names for 7FA4 is a Manifest V3 browser extension for the 7FA4 online judge system. It injects content scripts into 7FA4 pages and provides username/color mapping, UI enhancements, Markdown/LaTeX rendering, chat features, paper-editor/export tools, external submitter integration, update checks, and feedback helpers.

## Hard rules

- Do not expand extension permissions unless explicitly requested.
- Do not add new host permissions unless explicitly requested.
- Do not use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with untrusted data.
- Prefer `textContent`, `createTextNode`, safe DOM APIs, DOMPurify, or the existing sanitizer helpers for user-controlled content.
- Do not weaken Markdown / LaTeX / KaTeX / Prism sanitization.
- Do not remove or bypass existing XSS, URL-scheme, or HTML sanitization logic.
- Do not rewrite the user database format unless explicitly requested.
- Do not change release packaging behavior without calling it out in the PR.
- Do not remove compatibility with 7FA4 pages on ports 8888 and 5283.
- Do not make large unrelated refactors inside bug-fix PRs.
- Do not commit secrets, cookies, test accounts, local paths, or debug logs.

## Review guidelines

When reviewing PRs, focus on:

- XSS and DOM injection risks.
- Unsafe URL schemes such as `javascript:`, `vbscript:`, and unsafe `data:` payloads.
- Unsafe use of `localStorage`, `chrome.storage`, clipboard, notifications, `activeTab`, `scripting`, `webRequest`, and `declarativeNetRequest`.
- Changes to `manifest.json`, permissions, host permissions, and `web_accessible_resources`.
- Content script `run_at` timing and page compatibility.
- MutationObserver performance and duplicate initialization issues.
- GitHub Actions command injection and unsafe handling of untrusted issue / PR text.
- Submitter dependency build changes and release package structure.
- Changes to `render_logic.js`, `panel.js`, `background.js`, `gm-shim.js`, `editor.js`, and `manifest.json`.

## Manual testing expectations

For feature or bug-fix PRs, ask for tests relevant to the changed area:

- Problem list, problem detail, personal plan, review book, contest pages.
- Better Names panel open/close, save/cancel, theme, colors, avatar hiding, update prompt.
- Chat login state, session list, send message, preview, history, new-message prompt.
- Paper editor screenshot/export, fonts, KaTeX, long content, browser differences.
- Submitter login info, external submission import, error messages.
- Release-related commands: `python build.py test` and `python build.py build` when relevant.

## Output style for automated review

Use concise Chinese. Give maintainers a practical decision report, not a generic explanation. Always end with one of:

- `建议：Merge`
- `建议：Request changes`
- `建议：Close`

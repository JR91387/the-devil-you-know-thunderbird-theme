# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The Devil You Know is a light and dark theme for Thunderbird 140 ESR and newer, and Betterbird. It is a pure theme package (no add-on code, no Experiment API). MIT licensed.

## Commands

| Task | Command |
|---|---|
| Build both packages | `npm run build` → `dist/the-devil-you-know-<version>.xpi` (self-hosted) and `dist/the-devil-you-know-<version>-atn.xpi` (addons.thunderbird.net) |
| Tests (builds first) | `npm test` |
| One test | `node --test --test-name-pattern="contrast" tests/theme.test.js` (run `npm run build` first; package tests read `dist/`) |
| Lint CSS | `npm install` once, then `npm run lint` (stylelint pinned in `package-lock.json`, rules in `.stylelintrc.json`) |

Needs Node and Python 3 (`scripts/build.sh` zips with Python and the tests read packages with Python's `zipfile`; no `zip` binary).

## How the theme is built

- `theme/manifest.json`: MV2 theme. `theme.colors` (light) and `dark_theme.colors` (dark) paint the frame, tabs, toolbars, menus and sidebar; Thunderbird picks one from the system setting. `theme_experiment.stylesheet` loads `theme/theme.css`.
- `theme/theme.css` loads into the main window and into the inner documents about:3pane (folder pane, message list) and about:message (message view). It has three sections, in this order:
  1. **Design values**: every color, size and font as a `--dyk-*` variable, light and dark via `light-dark(light, dark)`. Change colors here only.
  2. **Thunderbird variables** (`--layout-*`, `--tree-card-*`, `--sidebar-*`, etc.) pointed at the `--dyk-*` values. Prefer this over selectors; it survives Thunderbird markup changes.
  3. **Targeted rules**, only where no variable reaches, each with a comment. Anything not set falls back to Thunderbird's default.
- Thunderbird 140 sets message-card colors per row state (`.selected`, `.current`, `:hover`) in its own stylesheet, so card states are set directly in section 3; variables on `:root` alone are not enough there.
- A theme cannot load font files or remote resources (relative URLs resolve to `chrome://messenger/skin/`; use `data:` URLs), cannot cross shadow DOM except through inherited variables, and cannot style the message body or compose editor text.
- When changing a value, change the matching manifest color too. Tests require shared manifest colors (frame, tab_line, focus border, icons_attention, popup, sidebar) to equal their `--dyk-*` values, and every other manifest color to be in the palette or in the test's `MANIFEST_ONLY` list. Light and dark manifests must keep the same keys.
- Before adding a rule, check Thunderbird's default look: it already styles unread mail (bold, accent subject) through `--new-subject-color`/`--unread-color`.

## Constraints the tests enforce

`tests/theme.test.js` (node:test, no dependencies):
- `theme.css` must open with the author header (copyright line with `https://jerryreinitz.com`, MIT, and the four links). Keep it first when editing.
- Every `var(--dyk-*)` must be defined; no `url()` except `data:`.
- No "Outlook", "Microsoft" or "Office 365" in the theme or manifest. The look is inspired by an office mail app but never branded; keep product names out of all public text.
- Text/background pairs from the values block (including placeholder `ink-3`) must reach 4.5:1 contrast in light and dark.
- `updates.json` must have an entry for the manifest version whose link is `/releases/download/v<version>/the-devil-you-know-<version>.xpi`.
- The ATN package has no `update_url` and has `strict_max_version` (from `store/max-version`); the self-hosted one keeps `update_url`.

## Releases

- Bump `version` in `theme/manifest.json`, add an entry to `updates.json` (self-hosted update feed, served from `main` via raw.githubusercontent.com) pointing at the GitHub release asset, run `npm test`, then publish a GitHub release `v<version>` with both `.xpi` files.
- Raise `store/max-version` when a new Thunderbird major is verified; the ATN package blocks installs on newer majors (Thunderbird ships monthly).
- `store/listing-en.md` is the addons.thunderbird.net listing text.
- `assets/` holds the banner and social preview (SVG sources and PNGs) and the Selawik font used only to render them (see `THIRD_PARTY_NOTICES.md`). `docs/screenshots/` are captured from real Thunderbird with made-up demo mail.

The project wiki (how it works, design values, walkthrough, build and test, lessons) is the GitHub Wiki of this repository.

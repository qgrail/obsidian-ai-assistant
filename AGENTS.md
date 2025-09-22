# Repository Guidelines

## Project Structure & Module Organization
Source code for the Obsidian plugin lives in `src/`, with `src/main.ts` bootstrapping the plugin, UI logic in `src/modal.ts`, and API adapters in `src/openai_api.ts`. Bundled output is emitted to `main.js` and companion styles to `styles.css`; animated demos sit under `gifs/`. Configuration helpers such as `esbuild.config.mjs`, `tsconfig.json`, and `versions.json` control the build pipeline and release metadata.

## Build, Test, and Development Commands
Run `npm install` once to pull dependencies. Use `npm run dev` to start the esbuild watcher for rapid TypeScript reloads while working inside Obsidian. Execute `npm run build` before publishing; it runs `tsc -noEmit` for type checks and produces the production bundle. `npm run version` bumps `manifest.json` and `versions.json` and stages them for release.

## Coding Style & Naming Conventions
Follow the existing TypeScript style: tab-indented blocks, double-quoted imports, and descriptive camelCase identifiers, with PascalCase reserved for classes and modals. Keep UI strings and command IDs synchronized with Obsidian command names. Format changes with Prettier (`npx prettier --write src/**/*.ts styles.css`) before submitting.

## Testing Guidelines
There is no automated test suite yet. After building or running the watcher, load the plugin in a sandbox vault and verify chat, prompt, image, and speech commands in the command palette. Exercise modal flows that touch remote requests, especially any `{LoadContent}` scenarios, and confirm errors are surfaced via `Notice`.

## Commit & Pull Request Guidelines
Recent commits stay concise and imperative (e.g., `feat: add support for pre-selected options`). Group related work per commit, update docs or media when behavior changes, and avoid committing generated bundles alone. Pull requests should describe the user-facing impact, link relevant issues, and include screenshots or GIFs when UI flows change.

## Security & Configuration Tips
API credentials are read from `data.json`; replace real keys with placeholders before committing. Prefer vault-level secrets management and confirm fetched content sanitisation when touching the `{LoadContent}` pipeline.

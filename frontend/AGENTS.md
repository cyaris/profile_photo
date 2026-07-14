# Frontend Guidance

## Code Formatting

- Do not use non-functional trailing commas in multiline syntax. Prefer single-line object, call, command, and Svelte markup attribute definitions when they fit under the repository's effective formatter width.
- Prefer single-line formatting for simple parenthesized expressions and arrow callback bodies when they fit within the repository's formatter rules, such as `onMount(() => (mounted = true))`.
- For repository-wide formatting passes, format non-Python files with Prettier using `trailingComma: "none"` and a wide print width so objects/calls are not wrapped solely for style.

## Shared Svelte Infrastructure

- Inherit shared config from `svelte-lib` where available: `svelte.config.js`, `tailwind.config.cjs`, `postcss.config.cjs`, `.prettierrc.cjs`, `eslint.config.js`, and `rollup.config.js`.
- Keep `eslint.config.js` managed by `svelte-lib`; do not replace the re-export with a project-local ESLint configuration. The shared ESLint config assumes ESLint 9 from `svelte-lib`, so refresh `package-lock.json` when shared lint dependencies change.
- Follow the shared `no-use-before-define` convention for JS/CJS files. The shared config intentionally disables this rule for `.svelte` files until `svelte-lib` has a Svelte-aware solution; do not add project-local overrides for it.
- Declare packages imported directly by the frontend in `package.json`; do not rely on `svelte-lib` to provide transitive runtime dependencies for frontend-owned imports.
- When frontend code imports D3 directly, import only the specific `d3-*` subpackages used and declare those subpackages in `package.json`; do not add or import the umbrella `d3` package for app-owned code.
- Keep `rollup.config.js` as a thin call to `createRollupConfig({ scopeClass: "profile-photo" })`; do not reintroduce project-local Rollup plugin setup or scoped-class PostCSS plugins.
- Keep `linklocal` and local `file:` dependencies in `package.json`; sibling workspace packages such as `svelte-lib` and `fireworks` should use `file:../../...` paths.
- Keep `vite.config.js` as a thin local wrapper around `createViteConfig()` from the package export `svelte-lib/vite.config.js`. Do not import `sveltekit` locally or reach into `../../svelte-lib/src/lib/vite.config.js`; the shared helper owns SvelteKit plugin wiring.

## Embedded Bundle

- `src/main.js` is the Rollup entry for the embedded bundle. It creates the `.profile-photo` wrapper and mounts `ProfilePhoto`.
- Import shared CSS in Rollup entry files through `svelte-lib` package exports, such as `svelte-lib/styles/app.css` and `svelte-lib/styles/root.css`. Do not import from `../node_modules/svelte-lib/src/...` source paths.
- Avoid `$lib` aliases in code that must be bundled directly by Rollup unless the shared Rollup config explicitly supports that alias. Prefer relative imports for library/internal code that is not SvelteKit-route-only.

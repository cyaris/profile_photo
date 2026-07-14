# Frontend Guidance

## Shared Svelte Conventions

- Use `../../svelte-lib/AGENTS.md` as the source of truth for shared Svelte formatting, config, lint, dependency, D3, Vite, Rollup, CSS import, and scoped embedded styling conventions.
- Keep local guidance focused on `profile_photo`-specific sibling workspace paths.
- Keep `linklocal` and local `file:` dependencies in `package.json`; sibling workspace packages such as `svelte-lib` and `fireworks` should use `file:../../...` paths.

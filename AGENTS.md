# Repository Guidance

## Repository Layout

- Keep the repository split into `backend/` and `frontend/`, matching the structure used by `us_gun_violence_forecasting`.
- Put Python scripts and helpers under `backend/src`, with Python project metadata in `backend/pyproject.toml`.
- Put the Svelte app, npm package files, build config, `src`, `dist`, and local `node_modules` under `frontend/`.

## Documentation

- For README links that intentionally open a new tab, use an HTML anchor with `target="_blank"` and `rel="noopener noreferrer"`.

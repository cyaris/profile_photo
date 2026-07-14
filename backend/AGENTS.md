# Backend Guidance

## Backend Python

- Use `src/utils.py` for backend logging. Backend scripts should initialize loggers with `initialize_logger`.
- Keep the pixel-data generation script named `src/generate_pixel_data.py`; it reads from and writes to `../frontend/src/lib/static`.
- Declare backend runtime dependencies in `pyproject.toml`.
- Run `isort` from `backend` so it uses the repository's `[tool.isort]` settings.

## Code Formatting

- Do not use non-functional trailing commas in multiline Python syntax. Prefer single-line calls, literals, and expressions when they fit under the repository's effective formatter width.
- Format Python files with Black using a wide line length and `--skip-magic-trailing-comma` so calls and literals are not kept multiline solely because of trailing commas.

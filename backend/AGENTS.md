# Backend Guidance

## Backend Python

- Use `src/utils.py` for backend logging. Backend scripts should initialize loggers with `initialize_logger`.
- Format Python from `backend` with the repository's Black and isort settings. Avoid non-functional trailing commas that make Black preserve unnecessary multiline layouts, while keeping commas that are semantically required or improve readability.
- When backend code directly imports a runtime package, declare that package explicitly in `backend/pyproject.toml` rather than relying on transitive dependencies.

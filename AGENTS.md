# Repository Guidance

## Documentation

- Keep README link behavior intentional and consistent. Use standard Markdown links by default, and use HTML anchors with `target="_blank"` and `rel="noopener noreferrer"` only when links should explicitly open in a new tab.

## GitHub Actions

- Keep the root `Rollup upload` workflow as a thin caller of the `svelte-lib` rollup upload composite action. Project
  specifics belong in action inputs, including the S3 prefix, bundle file list, `SVELTE_LIB_REF`, and `FIREWORKS_REF`
  branch selections for automatic production uploads.
- Preserve automatic production uploads on pushes to `main` or `master`; manual dispatch should keep staged uploads as
  the default unless `production` is explicitly selected.

# Repository Guidance

## Documentation

- Keep README link behavior intentional and consistent. Use standard Markdown links by default, and use HTML anchors with `target="_blank"` and `rel="noopener noreferrer"` only when links should explicitly open in a new tab.

## GitHub Actions

- Use `../shared-automation/AGENTS.md` as the source of truth for shared GitHub Actions, reusable workflow wrapper,
  release-policy, dispatch, and automation documentation conventions.
- Project-specific rollup upload inputs include the S3 prefix, bundle file list, `SVELTE_LIB_REF`, and `FIREWORKS_REF`
  branch selections for automatic production uploads.
- Project release naming and milestone overrides belong in `.github/release-policy.yml`.

## Release Management

- While working in this repository, evaluate whether the accumulated changes represent a meaningful release milestone.
- A release may be appropriate when the work includes a substantial user-facing feature, a major redesign or workflow change, a meaningful new integration, an important architecture change, a backward-incompatible change, a stable initial public version, a significant performance, reliability, security, accessibility, or compatibility improvement, or a coherent group of changes that materially changes how the project is used.
- Do not recommend a release for routine maintenance, formatting, minor refactoring, isolated dependency updates, or small bug fixes unless their combined impact is significant.
- When the current work appears to justify a release, state that a release may be warranted, explain the milestone in plain language, suggest a release title, suggest a tag consistent with this repository's existing convention, summarize release-note content, identify breaking changes or migration concerns, and recommend full release, prerelease, or draft status.
- Prefer app-style tags such as `v1`, `v1.1`, and `v2` with release titles in the form `vX.Y - Plain-English Milestone`; do not rename historical tags solely for cosmetic consistency.
- Treat work on PR or development branches as a release candidate. The final tag should normally point to the merge commit on `main` or `master`, unless the user explicitly approves releasing from another branch.
- Do not create, rename, move, or delete tags or publish a GitHub release unless the user explicitly requests it.

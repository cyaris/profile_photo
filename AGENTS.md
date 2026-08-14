# Repository Guidance

## Documentation

- Keep README link behavior intentional and consistent. Use standard Markdown links by default, and use HTML anchors with `target="_blank"` and `rel="noopener noreferrer"` only when links should explicitly open in a new tab.
- Keep README and AGENTS guidance focused on current behavior, active requirements, and durable project decisions. Remove
  migration-era notes, deprecated-option explanations, old fallback paths, and historical caveats once they no longer
  affect how someone uses, maintains, deploys, or releases the project. When a state change makes a requirement obsolete,
  update the affected docs and configuration in that same change.

## Auto Transition Timing

- Keep the full-set completion duration and the delay between sets independently configurable for both the Frames and
  Diagonal Auto Transition modes. A Frames set completes one full perimeter, while a Diagonal set completes the full
  photo; do not replace either timing control with a hard-coded or transition-lifecycle-derived cadence. Keep the
  effective gap constant across completed sets. Treat the configured delay as a minimum and resolve a constant safety
  floor when necessary so a new set never reaches pixels that are still transitioning. For the built-in Diagonal delay,
  keep the fully visible rest interval after a pixel is restored equal to its fully hidden interval. Do not change the
  pixel movement or fade durations to achieve that timing; treat those transition speeds as fixed.

## GitHub Actions

- Use `../shared-automation/AGENTS.md` as the source of truth for shared GitHub Actions, reusable workflow wrapper,
  release-policy, dispatch, and automation documentation conventions.
- Before merging any pull request, explicitly inspect CodeRabbit comments and reviews and assess every still-applicable
  finding; do not merge solely because checks are green.
- Workflows must fail clearly when a requested feature requires credentials, secrets, repository variables, external
  permissions, or paid services that are not configured. Apply this to dry-run modes too unless the feature is
  explicitly documented as credential-optional.
- Project-specific Rollup inputs include the S3 prefix, bundle file list, and the `fireworks` local dependency
  spec. The shared Rollup workflow uses the latest `svelte-lib` and `fireworks` `main` commits by default and resolves
  those branches to exact commit SHAs during each run.
- Project release naming and milestone overrides belong in `.github/release-policy.yml`.

## Release Management

- While working in this repository, evaluate whether the accumulated changes represent a meaningful release milestone.
- A release may be appropriate when the work includes a substantial user-facing feature, a major redesign or workflow change, a meaningful new integration, an important architecture change, a backward-incompatible change, a stable initial public version, a significant performance, reliability, security, accessibility, or compatibility improvement, or a coherent group of changes that materially changes how the project is used.
- Do not recommend a release for routine maintenance, formatting, minor refactoring, isolated dependency updates, or small bug fixes unless their combined impact is significant.
- Write clear, specific commit subjects that describe the actual change. Prefer plain language over release-tool syntax,
  and do not exaggerate routine maintenance as user-facing work.
- Treat upstream automation, shared workflow reference, dependency-pin, Renovate, release-policy, and local dependency ref
  maintenance as non-release work unless it changes user-facing behavior, runtime behavior, or a published API.
- When the current work appears to justify a release, state that a release may be warranted, explain the milestone in plain language, suggest a release title, suggest a tag consistent with this repository's existing convention, summarize release-note content, identify breaking changes or migration concerns, and recommend full release, prerelease, or draft status.
- Prefer app-style tags such as `v1`, `v1.1`, and `v2` with release titles in the form `vX.Y - Plain-English Milestone`; do not rename historical tags solely for cosmetic consistency.
- Treat work on PR or development branches as a release candidate. The final tag should normally point to the merge commit on `main` or `master`, unless the user explicitly approves releasing from another branch.
- Do not create, rename, move, or delete tags or publish a GitHub release unless the user explicitly requests it.

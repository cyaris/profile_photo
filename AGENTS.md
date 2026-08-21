# Repository Guidance

## Shared Conventions

- Inherit README and Markdown style, GitHub Actions, reusable workflow, pull-request review, workflow failure, commit,
  and release-management rules from `../shared-automation/AGENTS.md`.

## Auto Transition Timing

- Keep every Auto Transition mode's full-set completion duration and inter-set delay independently configurable. Define
  what completes a set per mode—for example, one perimeter for Frames and the full photo for Diagonal—without deriving
  cadence from transition lifecycle. Keep the effective gap constant across completed sets, treat the configured delay
  as a minimum, and add a constant safety floor when needed so a new set cannot reach pixels still transitioning.
- Keep mode-specific timing invariants local. The built-in Diagonal delay keeps a restored pixel fully visible for as
  long as it remains fully hidden. Do not change pixel movement or fade durations to create the gap.

## Pixel Grid Rendering

- Draw each pixel-grid boundary once in `drawPixelSeparators`, not as a per-pixel `strokeRect`. Derive its alpha from
  the more-visible neighboring cell and its position from device-pixel-snapped `columnPositions`/`rowPositions` lookup
  tables built once per geometry in `getSeparatorBuffers`. Do not reintroduce per-pixel strokes in pixel display
  functions; they double interior line weight and rasterize unevenly on Safari.
- Keep `separatorAlpha` at `0.31` unless deliberately changing the cross-device design. It reproduces the original
  `0.075` CSS-pixel SVG hairline at 2x density and must remain the same on desktop and mobile.
- Laser-eye circles intentionally begin as solid dots and open into rings as they grow. Keep `strokeOrFillCircle` for
  radii below half the stroke width; a plain `stroke()` creates an incorrect hollow ring.

## Rollup Delivery

- Project-specific Rollup inputs include the S3 prefix, bundle file list, and `fireworks` local dependency. The shared
  workflow resolves the latest `svelte-lib` and `fireworks` `main` refs to exact commit SHAs during each run.

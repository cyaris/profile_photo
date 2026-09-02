# pixel_portrait

Interactive Svelte profile-photo experiment with a small Python backend utility for generating pixel data from the
source image. The frontend lets users:

- reveal a pixel overlay on hover
- switch between reveal modes
- trigger the laser-eye animation
- run an automated transition mode
- track reveal progress with a gauge
- launch fireworks after uncovering enough pixels

View the live tool at <a href="https://charlieyaris.com/" target="_blank" rel="noopener noreferrer">charlieyaris.com</a>.

## Project layout

```text
frontend/                 Svelte/Vite app
frontend/src/lib/         ProfilePhoto component and static assets
frontend/src/lib/static/  favicon.png and generated pixels.json
backend/                  Python utility project
backend/src/              Pixel-data generator and logging utilities
```

## Frontend development

Install dependencies from `frontend`:

```sh
cd frontend
npm install
```

Start the local Vite dev server:

```sh
npm run dev
```

Build and preview:

```sh
npm run build
npm run preview
```

Run validation:

```sh
npm run check
npm run lint
npm run format:check
```

## Auto Transition configuration

`ProfilePhoto` accepts these Auto Transition props. Timing values are expressed in milliseconds and keyed by mode:

| Prop | Behavior |
| --- | --- |
| `autoTransitionDiagonalCorner` | Corner where each Diagonal set begins. Defaults to `top-left`; an unsupported value also falls back to `top-left`. |
| `autoTransitionSetDuration` | Time for one set to complete. `frames` controls traversal of the longest full perimeter; smaller concentric perimeters use the same pixel-step speed. `diagonal` controls traversal across the full photo. |
| `autoTransitionSetDelay` | Pause after a completed set before that path starts its next set. The scheduler may extend a configured delay when necessary to prevent a new set from reusing pixels that are still transitioning. |

Accepted `autoTransitionDiagonalCorner` values:

- `top-left` (default)
- `top-right`
- `bottom-right`
- `bottom-left`

Pass either complete or partial mode values; an omitted mode retains its built-in timing:

```svelte
<ProfilePhoto
  autoTransitionDiagonalCorner="bottom-right"
  autoTransitionSetDuration={{ frames: 5700, diagonal: 3133.333 }}
  autoTransitionSetDelay={{ frames: 0, diagonal: 733.333 }}
/>
```

The built-in durations derive from the current pixel grid and traverse approximately 30 pixel slices per second. The
Diagonal delay remains independent of pixel movement and fade durations. The example above shows the approximate
defaults for the committed 48 by 48 grid.

## Pixel data generation

The backend utility reads `frontend/src/lib/static/favicon.png` and writes
`frontend/src/lib/static/pixels.json`. The repository commits that JSON so clean GitHub Actions checkouts can build the
Rollup bundle.

From `backend`, install the Python project in editable mode if needed:

```sh
cd backend
python3 -m pip install -e ".[dev]"
```

Generate the default 48 by 48 pixel data:

```sh
python3 src/generate_pixel_data.py
```

Generate a custom resolution:

```sh
python3 src/generate_pixel_data.py --x-max 64 --y-max 64
```

## Local dependencies

The frontend uses local packages from this workspace:

```json
"fireworks": "file:../../fireworks",
"svelte-lib": "file:../../svelte-lib"
```

If either local package changes, rebuild that package before refreshing this app.

## Credits

The laser vision feature's animation builds on the concentric-circles technique from
<a href="http://bl.ocks.org/mrtriangle/11222485" target="_blank" rel="noopener noreferrer">mrtriangle's block</a>.

## GitHub Actions Workflows

These local wrappers inherit their reusable implementations from `cyaris/shared-automation`. The
[shared-automation workflow reference](https://github.com/cyaris/shared-automation#workflows) documents shared
behavior, inputs, and secrets.

### `.github/workflows/auto-create-dev-pr.yml`

Runs on pushes to `dev`, then calls the
[shared auto-create-dev-pr workflow](https://github.com/cyaris/shared-automation#githubworkflowsauto-create-dev-pryml)
to open a pull request from `dev` to `main` when one doesn't already exist. It passes the repository's `RELEASE_TOKEN`
secret so trusted user or agent-authored pushes to `dev` can open the pull request.

### `.github/workflows/auto-release.yml`

Runs from manual dispatch only and calls the
[shared auto-release workflow](https://github.com/cyaris/shared-automation#githubworkflowsauto-releaseyml). This
repository contributes `.github/release-policy.yml` overrides. Release creation or existing-release updates require
reviewing the generated plan and explicitly enabling publication for an approved run.

### `.github/workflows/rollup.yml`

Calls the [shared rollup workflow](https://github.com/cyaris/shared-automation#githubworkflowsrollupyml) with these
local details:

- triggers: pushes to `dev` and `main`, plus manual dispatch
- working directory: `frontend`
- destination: `s3://cyaris.github.io/pixel_portrait/`
- production naming: unprefixed bundles from `main`
- staged naming: `dev_`-prefixed bundles from `dev`
- bundle sets: full interactive `bundle.*` and auto-transition-only `bundle2.*`
- local dependencies: `dev` refs for staged runs and `main` refs for production runs for both `svelte-lib` and
  `fireworks`, resolved to exact SHAs

### `.github/workflows/upstream-watch.yml`

Runs daily at 12:53 UTC, 30 minutes after `fireworks`'s own upstream watch and 30 minutes before the GitHub Pages build
for `cyaris.github.io`, and on manual dispatch, then calls the
[shared upstream-watch workflow](https://github.com/cyaris/shared-automation#githubworkflowsupstream-watchyml). It
watches `svelte-lib`'s and `fireworks`'s `dev` and `main` branch commits independently. When a watched branch moves, it
dispatches this repository's `Rollup` workflow on the matching branch so staged and production bundles pick up the
corresponding upstream code without waiting for a push here.

### `.github/workflows/workflow-validation.yml`

Runs on `dev` and `main` pushes that change `.github/release-policy.yml`, `.github/workflows/**`, or `renovate.json`,
and on manual dispatch, then calls the
[shared workflow-validation workflow](https://github.com/cyaris/shared-automation#githubworkflowsworkflow-validationyml)
to validate rollup upload wrapper logic, release-policy configuration, and Renovate configuration.

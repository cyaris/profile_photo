# profile_photo

Interactive Svelte profile-photo experiment with a small Python backend utility for generating pixel data from the source image. The frontend lets users reveal a pixel overlay on hover, switch between reveal modes, trigger laser-eye animation, track reveal progress with a gauge, and launch fireworks after enough pixels are uncovered.

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

## Pixel data generation

The backend utility reads `frontend/src/lib/static/favicon.png` and writes `frontend/src/lib/static/pixels.json`.

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

## GitHub Actions Workflows

### `.github/workflows/ci.yml`

The `CI` workflow runs on pushes, pull requests, and manual dispatch. It calls the shared
`cyaris/svelte-lib/.github/workflows/node-package-ci.yml` workflow with `working-directory: frontend` to install
frontend dependencies and run the default format, lint, Svelte check, and build commands.

The workflow can be dispatched from the GitHub Actions UI with **Actions > CI > Run workflow**. Manual dispatch exposes
`svelte-lib-ref` and `fireworks-ref` inputs for choosing the sibling `svelte-lib` and `fireworks` refs checked out for
local `file:` dependencies. Automatic push and pull-request runs use `SVELTE_LIB_REF` and `FIREWORKS_REF` repository
variables when present, falling back to `main` and `dev`.

### `.github/workflows/rollup-upload.yml`

The `Rollup upload` GitHub Actions workflow builds the frontend rollup bundle and uploads it to
`s3://cyaris.github.io/profile_photo/`.

The workflow runs automatically on pushes to `main` or `master`, including merges into those branches, and can be
dispatched from the GitHub Actions UI with **Actions > Rollup upload > Run workflow**. Manual dispatch uploads staged
`test_bundle.*` files by default. Set `production` during manual dispatch to upload live `bundle.*` files instead; set
`dry-run` to print S3 operations without writing objects. Automatic push runs always use production upload names and
disable `dry-run`.

Set the repository variable `SVELTE_LIB_REF` to control which `svelte-lib` branch, tag, or SHA the automatic production
workflow checks out for both the local file dependency and the shared rollup upload action. Set `FIREWORKS_REF` to
control the same behavior for the local `fireworks` dependency. Manual dispatch exposes both values as inputs.

The workflow checks out the private `svelte-lib` repository and runs `.github/actions/rollup-upload` from that checkout.
Provide `CHECKOUT_TOKEN` with read access to `svelte-lib` and any private local dependency repositories. AWS
authentication uses `AWS_ROLLUP_UPLOAD_ROLE_ARN` when present, otherwise it expects AWS access-key secrets.

### `.github/workflows/auto-release.yml`

The `Auto release` workflow runs after a pull request is closed and delegates to the shared
`cyaris/svelte-lib/.github/workflows/auto-release.yml` workflow only when that pull request was merged. It evaluates the
merge commit against the repository release policy, asks the configured OpenAI model whether the merge warrants a
release, publishes a GitHub release when warranted, and comments the outcome on the pull request.

The workflow can also be dispatched from the GitHub Actions UI with **Actions > Auto release > Run workflow**. Manual
dispatch accepts optional `release-sha`, `pr-number`, and `svelte-lib-ref` inputs; when `release-sha` is blank, it
evaluates the workflow SHA. Release runs require `OPENAI_API_KEY`; `RELEASE_TOKEN` and `CHECKOUT_TOKEN` can be provided
when the default token cannot create releases or read private repositories.

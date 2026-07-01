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

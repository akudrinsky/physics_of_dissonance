# Physics of Dissonance

Interactive visualizations, audio demos, and explanatory notes exploring the psychoacoustics of consonance, roughness, and tuning. This repository now hosts the full application source (the previous `dissonance` submodule has been absorbed) built with Next.js, Tailwind CSS, Plotly, and Tone.js for real-time sound synthesis.

## Contents
- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Environment & Assets](#environment--assets)
- [Development Notes](#development-notes)

## Features
- **Dyadic Explorer** – sweep frequency ratios across partial structures, visualize roughness valleys, and hear the resulting beating patterns.
- **Triad Explorer** – navigate a 3D consonance surface for three-note chords, highlighting consonant regions and enabling instant audio playback.
- **Theory Notes** – Markdown-rendered essays with KaTeX support for mathematical notation explaining the physical basis for consonance.
- **Responsive UI** – Tailwind-driven design optimized for both desktop and mobile devices.
- **Interactive Audio** – Built on Tone.js for low-latency Web Audio playback with customizable waveforms.

## Requirements
- Node.js **18.18.0** or newer (Next.js 15 requires Node 18 LTS or Node 20+).
- npm **10+** (bundled with recent Node releases).
- macOS, Linux, or Windows with a web browser that supports the Web Audio API (Chrome, Firefox, Safari, Edge).

If you prefer other package managers, scripts also work with `pnpm`, `yarn`, or `bun`, but npm is the default for this project.

## Quick Start
Clone the repository and install dependencies:

```bash
git clone https://github.com/akudrinsky/physics_of_dissonance.git
cd physics_of_dissonance
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser. Hot reloading keeps the app in sync with source edits.

### Production Build
To verify a production build (including Turbopack-accelerated compilation):

```bash
npm run build
npm start
```

`npm start` serves the optimized build at http://localhost:3000.

## Available Scripts
- `npm run dev` – Start Next.js in development mode with Turbopack and fast refresh.
- `npm run build` – Create an optimized production build.
- `npm start` – Serve the production build locally.
- `npm run lint` – Run ESLint across the project (ensures Next.js + TypeScript best practices).

## Project Structure
Key directories and files:

```
.
├─ public/                     # Static assets, icons, and SVG illustrations
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx            # Root layout and global providers
│  │  ├─ globals.css           # Tailwind layers and global styles
│  │  ├─ page.tsx              # Landing page with quick links
│  │  ├─ theory/               # Theory note pages rendered via Markdown + KaTeX
│  │  └─ visualizations/
│  │     ├─ dyadic-explorer/   # Dyadic consonance explorer UI + logic
│  │     └─ triad-explorer/    # Triadic consonance explorer with 3D Plotly charts
│  ├─ components/              # Shared UI (navigation, footer)
│  ├─ lib/dissonance/          # Audio & math utilities (roughness, partials, Tone.js hooks)
│  └─ types/                   # TypeScript shims (e.g., Plotly type definitions)
├─ tailwind.config.ts          # Tailwind CSS configuration
├─ next.config.ts              # Next.js configuration
└─ tsconfig.json               # TypeScript compiler options
```

## Environment & Assets
- No secrets are required for local development; environment files are optional.
- Audio relies on the Web Audio API. Ensure your OS/browser allows autoplay with sound or interact once (click/tap) to unlock audio contexts.
- Heavy production builds write to `.next/` (ignored via `.gitignore`). Delete this folder if you need a clean rebuild.

## Development Notes
- The app depends on browser audio features; automated tests are minimal. When adding features, validate both audio rendering and visualization interactivity manually.
- Linting is configured via `eslint.config.mjs`. Run `npm run lint` before committing to catch common issues.
- Tailwind CSS v4 (pre-release) is enabled via the new `@tailwindcss/postcss` plugin chain; if you run into build issues, ensure your IDE uses the workspace `postcss.config.mjs`.
- Accessible color contrast and keyboard focus states are a priority. Please test new UI components with keyboard navigation and screen reader tooling where possible.

Have ideas or improvements? Feel free to open an issue or submit a pull request.

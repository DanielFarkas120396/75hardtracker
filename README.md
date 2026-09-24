# 75 Hard Companion

A mobile-first, installable, local-first PWA for tracking the 75 Hard challenge — workouts, diet, water, reading and progress photos — with a Duolingo-style Journey map, XP, streaks and badges.

No backend: all data (including photos) lives in the browser via IndexedDB (Dexie), and can be exported/imported as a single JSON file.

## Stack

React + Vite + TypeScript, Tailwind CSS v4, Framer Motion, canvas-confetti, Dexie, vite-plugin-pwa, Vitest.

## Development

```bash
npm install
npm run dev
```

## Testing

```bash
npm run test
```

## Building

```bash
npm run build
```

## Project structure

- `src/logic/` — pure challenge-rules module (day completion, streak, XP, badges, restart). No UI or persistence dependencies; fully unit tested.
- `src/db/` — Dexie schema, types and repositories (the only place persistence lives).
- `src/hooks/` — bridges Dexie live queries and the logic module into React.
- `src/screens/`, `src/components/` — UI.

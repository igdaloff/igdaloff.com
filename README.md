## To start 'er up

`npm run dev`

`npm run build` compiles `dist/index.css` (Tailwind) and `dist/compiled.js` (browserify). Netlify serves the repo root as is, so commit `dist/` after building.

Site scripts live in `src/site/`, one module per system: `track` (sections, timing, scroll mapping), `signal` (waveform amplitude), `rail`, `type` (word splitting, ink, breath), `zap`, `pulse`, `power`, `playback`, `audio`, `palette`, and `scheduler` (the single rAF loop).

More info on google-spreadsheet wrapper used to get latest music: https://theoephraim.github.io/node-google-spreadsheet/#/classes/google-spreadsheet

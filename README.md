# igdaloff.com

Personal site and portfolio of Nathan Igdaloff, live at [igdaloff.com](https://igdaloff.com).

It's a single static page with a small "last track saved" player in the corner. The track comes from a Google Sheet that logs songs I save on Spotify, read by a Netlify Function.

## Stack

- **HTML + Tailwind CSS** (v3), compiled to `dist/index.css`
- **Vanilla JavaScript** loaded as a native ES module (`src/index.js`), with no bundler
- **Netlify** for hosting and the serverless function
- **Google Sheets API** via [`google-spreadsheet`](https://theoephraim.github.io/node-google-spreadsheet/) for the track data
- **Google Analytics 4**

## Project structure

```
index.html                       the whole page
src/index.js                     track player and favicon swap
src/index.css                    Tailwind entry point and custom animations
dist/index.css                   compiled CSS (committed, served as-is)
netlify/functions/fetch-sheet.mjs  returns the latest saved track as JSON
src/images/favicon/              icons, manifest, and the "off" favicon shown in background tabs
```

## Local development

Requires Node 20+.

```sh
npm install
cp .env.example .env   # then add the Google service account credentials
npm run dev            # http://localhost:8888
```

`npm run dev` runs the Tailwind watcher alongside `netlify dev`, which serves the site and the function together.

### Environment variables

| Name           | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `CLIENT_EMAIL` | Google service account email with read access to the sheet        |
| `PRIVATE_KEY`  | That service account's private key (`\n` escapes are supported)  |

Set the same variables in the Netlify site settings for production. If they're missing or the sheet can't be read, the function logs the error and returns a fallback track, so the player never breaks.

## Deploying

Pushing to `main` deploys through Netlify. There's no build step on Netlify's side, so run `npm run build` and commit `dist/index.css` after changing styles.

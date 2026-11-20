// Returns the most recently saved Spotify track, read from the last row of a Google Sheet.
// Docs: https://theoephraim.github.io/node-google-spreadsheet/
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const SPREADSHEET_ID = '1xBjImwNyfIwpyTS9_scCFO3dWXdn5xeyPYOIDTN8UKs';

// Shown if the sheet can't be read, so the player never renders empty.
const FALLBACK_TRACK = {
  artistName: 'Stereolab',
  trackName: 'French Disko',
  trackUrl: 'https://open.spotify.com/artist/5nKf4B6Z4Zg8Bzjw8Q1S0z',
  artistImage: 'https://i.scdn.co/image/ab67616d0000b273b02d569b9ba46f11c6f1496c',
  dateAdded: '2021-07-01T00:00:00.000Z'
};

async function fetchLatestTrack() {
  const { CLIENT_EMAIL, PRIVATE_KEY } = process.env;
  if (!CLIENT_EMAIL || !PRIVATE_KEY) throw new Error('Missing CLIENT_EMAIL or PRIVATE_KEY');

  const auth = new JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();
  const rows = await doc.sheetsByIndex[0].getRows();
  const row = rows.at(-1);
  if (!row) throw new Error('Sheet has no rows');

  return {
    artistName: row.get('Artist'),
    trackName: row.get('TrackName'),
    trackUrl: row.get('SpotifyUrl'),
    // The sheet stores several image sizes, comma-separated; the first is the largest.
    artistImage: row.get('ArtistImage')?.split(',')[0],
    dateAdded: row.get('DateAdded')
  };
}

export default async () => {
  let track;
  try {
    track = await fetchLatestTrack();
  } catch (error) {
    console.error('fetch-sheet failed, serving fallback track:', error);
    track = FALLBACK_TRACK;
  }

  return Response.json(track, {
    headers: {
      // Cache at Netlify's edge for 5 minutes so every visit doesn't hit the Sheets API.
      'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
    }
  });
};

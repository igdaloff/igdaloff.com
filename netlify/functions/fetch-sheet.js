require('dotenv').config();

const { GoogleSpreadsheet } = require('google-spreadsheet'); // More info https://theoephraim.github.io/node-google-spreadsheet/#/classes/google-spreadsheet

const client_email = process.env.CLIENT_EMAIL;
const private_key = process.env.PRIVATE_KEY.replace(/\\n/gm, '\n');

let artistName = 'Stereolab';
let trackUrl = 'https://open.spotify.com/artist/5nKf4B6Z4Zg8Bzjw8Q1S0z';
let trackName = 'French Disko';
let dateAdded = '2021-07-01T00:00:00.000Z';
let artistImage = 'https://i.scdn.co/image/ab67616d0000b273b02d569b9ba46f11c6f1496c';

exports.handler = async (event, context) => {
  const doc = new GoogleSpreadsheet('1xBjImwNyfIwpyTS9_scCFO3dWXdn5xeyPYOIDTN8UKs');

  async function accessSpreadsheet() {
    await doc.useServiceAccountAuth({
      client_email: client_email,
      private_key: private_key
    });

    await doc.loadInfo(); //Loads document properties and worksheets
    const sheet = doc.sheetsByIndex[0];

    const rows = await sheet.getRows();
    const rowsArray = Object.entries(rows);

    artistName = rowsArray[rowsArray.length - 1][1].Artist;
    trackUrl = rowsArray[rowsArray.length - 1][1].SpotifyUrl;
    trackName = rowsArray[rowsArray.length - 1][1].TrackName;
    dateAdded = rowsArray[rowsArray.length - 1][1].DateAdded;
    artistImage = rowsArray[rowsArray.length - 1][1].ArtistImage;
  }

  await accessSpreadsheet();

  return {
    statusCode: 200,
    body: JSON.stringify({
      artistName: artistName,
      trackUrl: trackUrl,
      trackName: trackName,
      dateAdded: dateAdded,
      artistImage: artistImage
    })
  };
};

const { GoogleSpreadsheet } = require('google-spreadsheet'); // More info https://theoephraim.github.io/node-google-spreadsheet/#/classes/google-spreadsheet

const creds = require('../client_secret.json');
const doc = new GoogleSpreadsheet('1xBjImwNyfIwpyTS9_scCFO3dWXdn5xeyPYOIDTN8UKs');

async function accessSpreadsheet(){
  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });

  await doc.loadInfo(); //Loads document properties and worksheets
	const sheet = doc.sheetsByIndex[0];
	
  const rows = await sheet.getRows();
  const rowsArray = Object.entries(rows);  

  const latestArtistName = rowsArray[rowsArray.length - 1][1].Artist;
  const latestArtistUrl = rowsArray[rowsArray.length - 1][1].SpotifyUrl;

  //Add spreadsheet data to HTML
  document.querySelector('.listening-to').innerHTML = latestArtistName;
  document.querySelector('.listening-to').href = latestArtistUrl;
}

accessSpreadsheet();
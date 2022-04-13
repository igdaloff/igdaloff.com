require('dotenv').config();

const { GoogleSpreadsheet } = require('google-spreadsheet'); // More info https://theoephraim.github.io/node-google-spreadsheet/#/classes/google-spreadsheet

const client_email = process.env.CLIENT_EMAIL;
const private_key = new Buffer(process.env.PRIVATE_KEY, 'base64').toString('utf-8');
let latestArtistName = "Bonobo";
let latestArtistURL = "https://open.spotify.com/artist/0cmWgDlu9CwTgxPhf403hb?si=j08QcnXbRYWOfAZIzlUD7w";

exports.handler = async (event, context) => {

  const doc = new GoogleSpreadsheet('1xBjImwNyfIwpyTS9_scCFO3dWXdn5xeyPYOIDTN8UKs');

  async function accessSpreadsheet(){
    await doc.useServiceAccountAuth({    
      client_email: client_email,
      private_key: private_key
    });

    await doc.loadInfo(); //Loads document properties and worksheets
    const sheet = doc.sheetsByIndex[0];
    
    const rows = await sheet.getRows();
    const rowsArray = Object.entries(rows); 
        
    latestArtistName = rowsArray[rowsArray.length - 1][1].Artist;
    latestArtistUrl = rowsArray[rowsArray.length - 1][1].SpotifyUrl;    
  };

  await accessSpreadsheet();

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: "It worked",
      artistName: latestArtistName,
      artistUrl: latestArtistUrl
    })
  }
}
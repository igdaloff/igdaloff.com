require('dotenv').config();
  const { GoogleSpreadsheet } = require('google-spreadsheet'); // More info https://theoephraim.github.io/node-google-spreadsheet/#/classes/google-spreadsheet

const client_email = process.env.CLIENT_EMAIL;
const private_key = process.env.PRIVATE_KEY;

exports.handler = async (event, context) => {

  // const creds = require('../client_secret.json');
  const doc = new GoogleSpreadsheet('1xBjImwNyfIwpyTS9_scCFO3dWXdn5xeyPYOIDTN8UKs');

  async function accessSpreadsheet(){
    await doc.useServiceAccountAuth({
      
      // client_email: creds.client_email,
      // private_key: creds.private_key,

      client_email: client_email,
      private_key: private_key
    });

    await doc.loadInfo(); //Loads document properties and worksheets
    const sheet = doc.sheetsByIndex[0];
    
    const rows = await sheet.getRows();
    const rowsArray = Object.entries(rows); 

    let latestArtistName;
    let latestArtistUrl;

    //Add spreadsheet data to HTML
    latestArtistName = rowsArray[rowsArray.length - 1][1].Artist;
    latestArtistUrl = rowsArray[rowsArray.length - 1][1].SpotifyUrl;   

    // if(sheet){
    //   latestArtistName = rowsArray[rowsArray.length - 1][1].Artist;
    //   latestArtistUrl = rowsArray[rowsArray.length - 1][1].SpotifyUrl;    
    // } else {
    //   latestArtistName = "Pulp";
    //   latestArtistUrl = "https://open.spotify.com/artist/36E7oYfz3LLRto6l2WmDcD?si=ZIl-fSHBQ_yChwsvEoHvkA";
    // }

    document.querySelector('.listening-to').innerHTML = latestArtistName;
    document.querySelector('.listening-to').href = latestArtistUrl;    
  }

  accessSpreadsheet();

}


const axios = require('axios');

//Get recent Spotify liked artists from spreadsheet
axios.get('/.netlify/functions/fetch-sheet')
  .then(function (response) {
    // handle success    
    document.querySelector('.listening-to').innerHTML = response.data.artistName;
    document.querySelector('.listening-to').href = response.data.artistUrl;  
  })
  .catch(function (error) {
    // handle error
    console.log(error);
  });

//Set 'off' rotation based on cursor Y position
const pos = { y : 0 };

const saveCursorPosition = function(y) {
  pos.y = (y / window.innerHeight).toFixed(2) * 90 + "deg";
  document.documentElement.style.setProperty('--y', pos.y);
}

document.addEventListener('mousemove', 
  e => { saveCursorPosition(e.clientY); }
)
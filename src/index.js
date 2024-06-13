const axios = require('axios');

//Get recent Spotify liked artists from spreadsheet
axios
  .get('/.netlify/functions/fetch-sheet')
  .then(function (response) {
    document.querySelector('.listening-to').innerHTML = response.data.artistName;
    document.querySelector('.listening-to').href = response.data.artistUrl;
  })
  .catch(function (error) {
    console.log(error);
  });

window.onload = function () {
  //Detect if tab is active to change favicon accordingly
  document.addEventListener('visibilitychange', function () {
    const isPageActive = !document.hidden;
    const favicon = document.querySelector('[rel=icon]');

    if (!isPageActive) {
      favicon.href = './src/images/favicon/off/favicon-32x32.png';
    } else {
      favicon.href = './src/images/favicon/favicon-32x32.png';
    }
  });
};

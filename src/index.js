const axios = require('axios');

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
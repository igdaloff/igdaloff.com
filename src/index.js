const axios = require('axios');

//Get recent Spotify liked artists from spreadsheet
axios
  .get('/.netlify/functions/fetch-sheet')
  .then(function (response) {
    const artistName = response.data.artistName;
    const trackUrl = response.data.trackUrl;
    const artistImage = response.data.artistImage.split(',')[0];
    const trackName = response.data.trackName;
    const dateAdded = response.data.dateAdded;
    const dateAddedFormatted = new Date(dateAdded).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZoneName: 'short'
    });

    const html = String.raw;
    const playerTemplate = html`
      <div class="player text-sm w-[300px] bg-gray-100 p-2 pb-1 rounded-md">
        <div class="player-inner bg-white p-2 rounded-sm flex gap-2 items-center justify-start shadow-sm">
          <a href="${trackUrl}" class="size-12">
            <img class="block w-full rounded-sm" src="${artistImage}" alt="Image of ${artistName} album art" />
          </a>
          <a href="${trackUrl}" class="flex no-underline flex-col max-w-[60%]">
            <span class="text-gray-600 font-bold text-nowrap text-ellipsis overflow-hidden">${artistName}</span>
            <span class="text-gray-600 text-nowrap text-ellipsis overflow-hidden">${trackName}</span>
          </a>
          <a
            href="${trackUrl}"
            class="ml-auto text-white bg-gray-300 rounded-full size-8 flex justify-center items-center">
            <span class="play-triangle relative right-[-2px]"></span>
          </a>
        </div>
        <div class="pt-1 text-xs flex gap-1 items-center">
          <i class="fa-solid fa-heart text-gray-300"></i>
          <p class="text-gray-400">Saved on ${dateAddedFormatted}</p>
        </div>
      </div>
    `;

    const playerContainer = document.querySelector('.track-player');
    playerContainer.innerHTML = playerTemplate;
    playerContainer.classList.add('animate-slide-in');
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

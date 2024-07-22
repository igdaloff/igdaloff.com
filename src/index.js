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
    let dateAddedFormatted = new Date(dateAdded).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      timeZoneName: 'short'
    });

    // If date is today, return "Today" instead of the date. If date is yesterday, return "Yesterday" instead of the date.
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let isToday = false;
    let isYesterday = false;

    if (new Date(dateAdded).toDateString() === today.toDateString()) {
      isToday = true;
    } else if (new Date(dateAdded).toDateString() === yesterday.toDateString()) {
      isYesterday = true;
    }

    const html = String.raw;
    const playerTemplate = html`
      <div class="player text-sm sm:w-[300px] border border-black border-solid shadow-[4px_4px_5px_rgba(0,0,0,0.25)]">
        <div class="player-inner p-1 bg-white flex gap-2 items-center justify-start">
          <a href="${trackUrl}" class="size-12">
            <img class="block w-full rounded-sm" src="${artistImage}" alt="Image of ${artistName} album art" />
          </a>
          <a href="${trackUrl}" class="flex no-underline flex-col max-w-[60%]">
            <span class="font-bold text-nowrap text-ellipsis overflow-hidden sm:hover:underline">${artistName}</span>
            <span class="text-nowrap text-ellipsis overflow-hidden sm:hover:underline">${trackName}</span>
          </a>
          <a
            href="${trackUrl}"
            class="ml-auto text-black sm:hover:text-white sm:hover:bg-black mr-1 border border-black rounded-full size-8 flex justify-center items-center">
            <span class="play-triangle relative right-[-2px]"></span>
          </a>
        </div>
        <div class="p-1 text-xs flex gap-1 items-center border-t-black border-t">
          <span class=" italic before:content-['>'] before:not-italic">
            Last track saved ${!!isToday ? 'today' : ''} ${!!isYesterday ? 'yesterday' : ''}
            ${!isToday & !isYesterday ? dateAddedFormatted : ''}
          </span>
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

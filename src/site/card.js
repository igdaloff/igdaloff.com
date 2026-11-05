// "Last track saved": the most recent Spotify like, read from a Google Sheet by a Netlify function.

const html = String.raw;

function dayLabel(dateAdded) {
  const d = new Date(dateAdded);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'today';
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZoneName: 'short'
  });
}

function render({ artistName, trackUrl, artistImage, trackName, dateAdded }) {
  const image = artistImage.split(',')[0];
  return html`
    <div class="player text-sm sm:w-[300px]">
      <div class="player-inner p-1 flex gap-2 items-center justify-start">
        <a href="${trackUrl}" class="size-12">
          <img class="block w-full rounded-sm" src="${image}" alt="Image of ${artistName} album art" />
        </a>
        <a href="${trackUrl}" class="flex no-underline flex-col max-w-[60%]">
          <span class="font-bold text-nowrap text-ellipsis overflow-hidden sm:hover:underline">${artistName}</span>
          <span class="text-nowrap text-ellipsis overflow-hidden sm:hover:underline">${trackName}</span>
        </a>
        <a href="${trackUrl}" class="player-play ml-auto mr-1 rounded-full size-8 flex justify-center items-center">
          <span class="play-triangle relative right-[-2px]"></span>
        </a>
      </div>
      <div class="player-foot p-1 text-xs flex gap-1 items-center">
        <span class="italic before:content-['>'] before:not-italic">Last track saved ${dayLabel(dateAdded)}</span>
      </div>
    </div>
  `;
}

function load() {
  fetch('/.netlify/functions/fetch-sheet')
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(data => {
      const box = document.querySelector('.track-player');
      box.innerHTML = render(data);
      box.classList.add('animate-slide-in');
    })
    .catch(err => console.log(err));
}

module.exports = { load };

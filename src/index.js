// Loaded as a native ES module (deferred), so the DOM is ready when this runs.

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function describeDateAdded(dateAdded) {
  const date = new Date(dateAdded);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'today';
  if (date.toDateString() === yesterday.toDateString()) return 'yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZoneName: 'short'
  });
}

// Show the most recently saved Spotify track (see netlify/functions/fetch-sheet.mjs)
async function renderTrackPlayer() {
  const container = document.querySelector('.track-player');
  if (!container) return;

  try {
    const response = await fetch('/.netlify/functions/fetch-sheet');
    if (!response.ok) throw new Error(`fetch-sheet responded ${response.status}`);
    const track = await response.json();

    const artistName = escapeHtml(track.artistName);
    const trackName = escapeHtml(track.trackName);
    const trackUrl = escapeHtml(track.trackUrl);
    const artistImage = escapeHtml(track.artistImage);
    const dateAdded = escapeHtml(describeDateAdded(track.dateAdded));

    container.innerHTML = `
      <div class="player text-sm sm:w-[300px] border border-black border-solid shadow-[4px_4px_5px_rgba(0,0,0,0.25)]">
        <div class="player-inner p-1 flex gap-2 items-center justify-start">
          <a href="${trackUrl}" class="size-12">
            <img class="block w-full rounded-sm" src="${artistImage}" alt="Album art for ${artistName}" />
          </a>
          <a href="${trackUrl}" class="flex no-underline flex-col max-w-[60%]">
            <span class="font-bold text-nowrap text-ellipsis overflow-hidden sm:hover:underline">${artistName}</span>
            <span class="text-nowrap text-ellipsis overflow-hidden sm:hover:underline">${trackName}</span>
          </a>
          <a
            href="${trackUrl}"
            aria-label="Play ${trackName} on Spotify"
            class="ml-auto text-black sm:hover:text-white sm:hover:bg-black mr-1 border border-black rounded-full size-8 flex justify-center items-center">
            <span class="play-triangle relative right-[-2px]"></span>
          </a>
        </div>
        <div class="p-1 text-xs flex gap-1 items-center border-t-black border-t">
          <span class="italic before:content-['>'] before:not-italic">Last track saved ${dateAdded}</span>
        </div>
      </div>
    `;
  } catch (error) {
    // Leave the player hidden rather than showing a broken card.
    console.error('Could not load latest track:', error);
  }
}

// Swap to the "off" favicon while the tab is in the background
function watchTabVisibility() {
  const favicon = document.querySelector('link[rel=icon]');
  if (!favicon) return;

  document.addEventListener('visibilitychange', () => {
    const folder = document.hidden ? 'src/images/favicon/off' : 'src/images/favicon';
    favicon.href = `${folder}/favicon-32x32.png`;
  });
}

renderTrackPlayer();
watchTabVisibility();

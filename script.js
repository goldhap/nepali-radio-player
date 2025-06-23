const searchInput = document.getElementById("search");
const stationsDiv = document.getElementById("stations");
const player = document.getElementById("player");
const nowPlaying = document.getElementById("nowPlaying");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

let radios = [];
let currentStation = null;
let isSwitching = false;
player.volume = 1.0;

function getSafeStreamUrl(url) {
  if (url.startsWith("https://")) return url;
  return `https://proxy-b9u6.onrender.com/radio-stream?url=${encodeURIComponent(url)}`;
}

fetch("/nepali-radio-player/radios.json")
  .then(res => res.json())
  .then(data => {
    radios = data;
    renderStations();
  })
  .catch(err => {
    console.error("Failed to load stations:", err);
    stationsDiv.innerHTML = `<div class="error">⚠️ Failed to load stations</div>`;
  });

function renderStations(filter = "") {
  stationsDiv.innerHTML = "";
  radios.filter(station => station.name.toLowerCase().includes(filter.toLowerCase())).forEach(station => {
    const div = document.createElement("div");
    div.className = "station";
    if (currentStation === station.name) div.classList.add("active");

    const logo = document.createElement("img");
    logo.className = "station-logo";
    logo.src = `/nepali-radio-player/logo/${station.id}.jpg`;
    logo.alt = `${station.name} logo`;
    logo.onerror = () => { logo.src = `/nepali-radio-player/logo/default.jpg`; };

    const nameSpan = document.createElement("span");
    nameSpan.className = "station-name";
    nameSpan.textContent = station.name;

    div.appendChild(logo);
    div.appendChild(nameSpan);
    div.onclick = () => playStation(station);

    stationsDiv.appendChild(div);
  });
}

function debounce(func, wait) {
  let debounceTimeout;
  return function (...args) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function playStation(station) {
  if (isSwitching || currentStation === station.name) return;
  isSwitching = true;
  currentStation = station.name;

  player.pause();
  player.src = getSafeStreamUrl(station.streamUrl);
  player.load();

  nowPlaying.innerHTML = `<span class="now-playing-name">⏳ Buffering: ${station.name}</span>`;
  renderStations(searchInput.value);
  updateMediaSessionMetadata(station);

  player.play()
    .then(() => {
      nowPlaying.innerHTML = `<span class="now-playing-name">▶️ Now Playing: ${station.name}</span>`;
      updateButtonStates();
    })
    .catch((err) => {
      console.warn("Playback blocked:", err);
      nowPlaying.innerHTML = `<span class="error">⚠️ Tap ▶️ Play to start: ${station.name}</span>`;
      updateButtonStates();
    });

  setTimeout(() => { isSwitching = false; }, 500);
}

function playNextStation() {
  const i = radios.findIndex(r => r.name === currentStation);
  if (i === -1) return;
  playStation(radios[(i + 1) % radios.length]);
}

function playPreviousStation() {
  const i = radios.findIndex(r => r.name === currentStation);
  if (i === -1) return;
  playStation(radios[(i - 1 + radios.length) % radios.length]);
}

function updateButtonStates() {
  playBtn.style.display = player.paused ? "inline-flex" : "none";
  pauseBtn.style.display = player.paused ? "none" : "inline-flex";
}

playBtn.addEventListener("click", () => {
  if (!currentStation && radios.length) playStation(radios[0]);
  else player.play().catch(() => {});
  updateButtonStates();
});

pauseBtn.addEventListener("click", () => {
  player.pause();
  updateButtonStates();
});

function updateMediaSessionMetadata(station) {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: "Nepali Radio",
        album: "Live Streaming",
        artwork: [
          { src: `/nepali-radio-player/logo/${station.id}.jpg`, sizes: "96x96", type: "image/jpeg" },
          { src: `/nepali-radio-player/logo/default.jpg`, sizes: "96x96", type: "image/jpeg" }
        ]
      });
      navigator.mediaSession.setActionHandler("play", () => player.play());
      navigator.mediaSession.setActionHandler("pause", () => player.pause());
      navigator.mediaSession.setActionHandler("previoustrack", playPreviousStation);
      navigator.mediaSession.setActionHandler("nexttrack", playNextStation);
    } catch (e) {
      console.warn("MediaSession error:", e);
    }
  }
}

searchInput.addEventListener("input", () => renderStations(searchInput.value));

const debouncedNext = debounce(playNextStation, 500);
const debouncedPrev = debounce(playPreviousStation, 500);

nextBtn.addEventListener("click", debouncedNext);
prevBtn.addEventListener("click", debouncedPrev);

player.addEventListener("play", updateButtonStates);
player.addEventListener("pause", updateButtonStates);

document.addEventListener("DOMContentLoaded", () => {
  const stickyBar = document.querySelector(".sticky-bar");
  let isScrolling;
  window.addEventListener("scroll", () => {
    stickyBar.classList.add("hidden");
    clearTimeout(isScrolling);
    isScrolling = setTimeout(() => stickyBar.classList.remove("hidden"), 200);
  });
});

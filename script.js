let searchInput, stationsDiv, player, nowPlaying, playPauseBtn, nextBtn, prevBtn;
let radios = [];
let currentStation = null;
let isSwitching = false;

function getSafeStreamUrl(url) {
  return url.startsWith("https://")
    ? url
    : `https://proxy-b9u6.onrender.com/radio-stream?url=${encodeURIComponent(url)}`;
}

function renderStations(filter = "") {
  if (!stationsDiv) return;

  const filteredStations = radios.filter(station =>
    station.name.toLowerCase().includes(filter.toLowerCase())
  );

  stationsDiv.innerHTML = "";

  if (filteredStations.length === 0) {
    stationsDiv.innerHTML = `<div class="error">⚠️ No matching stations</div>`;
    return;
  }

  filteredStations.forEach(station => {
    const div = document.createElement("div");
    div.className = "station";
    if (currentStation === station.name) div.classList.add("active");

    const logo = document.createElement("img");
    logo.className = "station-logo";
    logo.src = `./logo/${station.id}.jpg`;
    logo.alt = `${station.name} logo`;
    logo.onerror = () => {
      logo.src = `./logo/default.jpg`;
    };

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
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function playStation(station) {
  if (currentStation === station.name) return;

  // Always allow switching if a station is currently playing or buffering
  // Reset isSwitching at the start of a new play attempt
  isSwitching = true;
  currentStation = station.name;

  player.pause();
  // Attempt to stop the player if a stop method exists, for more immediate halt
  if (typeof player.stop === 'function') {
    player.stop();
  }
  player.src = getSafeStreamUrl(station.streamUrl);
  player.load();

  nowPlaying.innerHTML = `<span class="now-playing-name">⏳ Buffering: ${station.name}</span>`;
  renderStations(searchInput.value);
  updateMediaSessionMetadata(station);
  setupIOSAudioSession();

  player.play().then(() => {
    // Only set now playing if still the current station and not paused by another action
    if (currentStation === station.name && !player.paused) {
      nowPlaying.innerHTML = `<span class="now-playing-name">▶️ Now Playing: ${station.name}</span>`;
    }
  }).catch(error => {
    console.error("Error playing station:", error);
    if (currentStation === station.name) { // Only update if still on the same station
      nowPlaying.innerHTML = `<span class="error">⚠️ Play failed: ${station.name}. Tap play to retry.</span>`;
    }
  }).finally(() => {
    updateButtonStates();
    isSwitching = false;
  });
}

function playNextStation() {
  const i = radios.findIndex(r => r.name === currentStation);
  if (i !== -1) playStation(radios[(i + 1) % radios.length]);
}

function playPreviousStation() {
  const i = radios.findIndex(r => r.name === currentStation);
  if (i !== -1) playStation(radios[(i - 1 + radios.length) % radios.length]);
}

function updateButtonStates() {
  if (!playPauseBtn || !player) return;
  playPauseBtn.innerHTML = player.paused ? "▶️ Play" : "⏸️ Pause";
}

function updateMediaSessionMetadata(station) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: "Nepali Radio",
      album: "Live Streaming",
      artwork: [
        { src: `./logo/${station.id}.jpg`, sizes: "96x96", type: "image/jpeg" },
        { src: `./logo/default.jpg`, sizes: "96x96", type: "image/jpeg" }
      ]
    });
    navigator.mediaSession.setActionHandler("play", () => player.play());
    navigator.mediaSession.setActionHandler("pause", () => player.pause());
    navigator.mediaSession.setActionHandler("previoustrack", playPreviousStation);
    navigator.mediaSession.setActionHandler("nexttrack", playNextStation);
  }
}

function setupIOSAudioSession() {
  player.setAttribute('playsinline', 'true');
  player.setAttribute('webkit-playsinline', 'true');
  player.setAttribute('x-webkit-airplay', 'allow');

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) {
    const ctx = new AudioContext();
    const unlock = () => {
      if (ctx.state === 'suspended') ctx.resume();
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !player.paused) player.play().catch(() => {});
  });

  window.addEventListener('focus', () => {
    if (currentStation && player.paused) player.play().catch(() => {});
  });
}

document.addEventListener("DOMContentLoaded", () => {
  searchInput = document.getElementById("search");
  stationsDiv = document.getElementById("stations");
  player = document.getElementById("player");
  nowPlaying = document.getElementById("nowPlaying");
  playPauseBtn = document.getElementById("playPauseBtn");
  nextBtn = document.getElementById("nextBtn");
  prevBtn = document.getElementById("prevBtn");

  fetch("./radios.json")
    .then(res => res.json())
    .then(data => {
      radios = data;
      renderStations();
    })
    .catch(err => {
      if (stationsDiv) stationsDiv.innerHTML = `<div class="error">⚠️ Failed to load stations: ${err.message}</div>`;
    });

  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (!currentStation && radios.length > 0) {
        playStation(radios[0]);
      } else {
        if (player.paused) {
          player.play().catch(err => console.error("Play failed:", err));
        } else {
          player.pause();
        }
      }
      updateButtonStates();
    });
  }

  if (nextBtn) nextBtn.addEventListener("click", debounce(playNextStation, 500));
  if (prevBtn) prevBtn.addEventListener("click", debounce(playPreviousStation, 500));

  if (searchInput) {
    searchInput.addEventListener("input", () => renderStations(searchInput.value));
  }

  if (player) {
    player.addEventListener("play", updateButtonStates);
    player.addEventListener("pause", updateButtonStates);
    player.volume = 1.0;
  }

  setupIOSAudioSession();
});

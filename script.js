const searchInput = document.getElementById("search");
const stationsDiv = document.getElementById("stations");
const player = document.getElementById("player");
const playerSource = player.querySelector("source");
const nowPlaying = document.getElementById("nowPlaying");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

let radios = [];
let currentStation = null;
let isSwitching = false;

function getSafeStreamUrl(url) {
  if (url.startsWith("https://")) return url;
  return `https://proxy-b9u6.onrender.com/radio-stream?url=${encodeURIComponent(url)}`;
}

fetch("radios.json")
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
  radios
    .filter(station => station.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(station => {
      const div = document.createElement("div");
      div.className = "station";
      if (currentStation === station.name) div.classList.add("active");

      const logo = document.createElement("img");
      logo.className = "station-logo";
      logo.src = `logo/${station.id}.jpg`;
      logo.alt = `${station.name} logo`;
      logo.onerror = function () {
        this.src = `logo/default.jpg`;
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
  let debounceTimeout;
  return function (...args) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function playStation(station) {
  if (isSwitching || currentStation === station.name) return;
  isSwitching = true;

  player.pause();
  currentStation = station.name;
  playerSource.src = getSafeStreamUrl(station.streamUrl);
  player.load();

  player.play().catch(err => {
    console.error("Audio play error:", err);
    nowPlaying.innerHTML = `<span class="error">⚠️ Unable to play ${station.name}. Retrying...</span>`;
    setTimeout(() => player.play().catch(() => {}), 1000);
  });

  let nowPlayingText = `<span class="now-playing-name">${station.name}</span>`;
  const details = [];
  if (station.address) details.push(station.address);
  if (station.frequency) details.push(station.frequency);
  if (details.length > 0) {
    nowPlayingText += `<span class="now-playing-address">${details.join(" | ")}</span>`;
  }
  nowPlaying.innerHTML = nowPlayingText;

  renderStations(searchInput.value);
  updateMediaSessionMetadata(station);
  updateButtonStates();

  setTimeout(() => {
    isSwitching = false;
  }, 500);
}

function playNextStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const nextIndex = (currentIndex + 1) % radios.length;
  playStation(radios[nextIndex]);
}

function playPreviousStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const prevIndex = (currentIndex - 1 + radios.length) % radios.length;
  playStation(radios[prevIndex]);
}

function updateButtonStates() {
  if (player.paused) {
    playBtn.style.display = "inline-flex";
    pauseBtn.style.display = "none";
  } else {
    playBtn.style.display = "none";
    pauseBtn.style.display = "inline-flex";
  }
}

function updateMediaSessionMetadata(station) {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: "Nepali Radio",
        album: "Live Streaming",
        artwork: [
          { src: `logo/${station.id}.jpg`, sizes: "96x96", type: "image/jpeg" },
          { src: `logo/default.jpg`, sizes: "96x96", type: "image/jpeg" }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => {
        player.play();
        updateButtonStates();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        player.pause();
        updateButtonStates();
      });
      navigator.mediaSession.setActionHandler("previoustrack", playPreviousStation);
      navigator.mediaSession.setActionHandler("nexttrack", playNextStation);
    } catch (e) {
      console.warn("Media session error:", e);
    }
  }
}

player.onerror = () => {
  console.error("Player error:", player.error);
  nowPlaying.innerHTML = `<span class="error">⚠️ Audio error: ${player.error?.message || 'unknown'}</span>`;
};

playBtn.addEventListener("click", () => {
  if (currentStation) {
    player.play();
  } else if (radios.length > 0) {
    playStation(radios[0]);
  }
  updateButtonStates();
});

pauseBtn.addEventListener("click", () => {
  player.pause();
  updateButtonStates();
});

const debouncedNextStation = debounce(playNextStation, 500);
const debouncedPrevStation = debounce(playPreviousStation, 500);

nextBtn.addEventListener("click", debouncedNextStation);
prevBtn.addEventListener("click", debouncedPrevStation);

searchInput.addEventListener("input", () => {
  renderStations(searchInput.value);
});

player.addEventListener("play", updateButtonStates);
player.addEventListener("pause", updateButtonStates);

document.addEventListener("DOMContentLoaded", () => {
  const stickyBar = document.querySelector(".sticky-bar");
  let isScrolling;

  window.addEventListener("scroll", () => {
    stickyBar.classList.add("hidden");
    clearTimeout(isScrolling);
    isScrolling = setTimeout(() => {
      stickyBar.classList.remove("hidden");
    }, 200);
  });
});

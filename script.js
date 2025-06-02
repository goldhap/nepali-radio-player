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

// ✅ Proxy wrapper for HTTP streams
function getSafeStreamUrl(url) {
  if (url.startsWith("https://")) return url;
  return `https://radio-stream-proxy-1.onrender.com/radio-stream?url=${encodeURIComponent(url)}`;
}

// Load stations from radios.json
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

// Render station list
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

// Play selected station
function playStation(station) {
  currentStation = station.name;
  player.src = getSafeStreamUrl(station.streamUrl); // Use proxy only for HTTP streams
  player.play().catch(err => {
    console.error("Audio play error:", err);
    nowPlaying.innerHTML = `<span class="error">⚠️ Unable to play ${station.name}</span>`;
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
}

// Play next station
function playNextStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const nextIndex = (currentIndex + 1) % radios.length;
  playStation(radios[nextIndex]);
}

// Play previous station
function playPreviousStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const prevIndex = (currentIndex - 1 + radios.length) % radios.length;
  playStation(radios[prevIndex]);
}

// Update play/pause button visibility
function updateButtonStates() {
  if (player.paused) {
    playBtn.style.display = "inline-flex";
    pauseBtn.style.display = "none";
  } else {
    playBtn.style.display = "none";
    pauseBtn.style.display = "inline-flex";
  }
}

// Set metadata for media session
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

// Event listeners
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

nextBtn.addEventListener("click", playNextStation);
prevBtn.addEventListener("click", playPreviousStation);

searchInput.addEventListener("input", () => {
  renderStations(searchInput.value);
});

player.addEventListener("play", updateButtonStates);
player.addEventListener("pause", updateButtonStates);

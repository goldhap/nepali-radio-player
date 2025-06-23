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

  currentStation = station.name;

  // Update UI to buffering and reset player
  nowPlaying.innerHTML = `<span class="now-playing-name">⏳ Buffering: ${station.name}</span>`;

  player.pause();
  player.removeAttribute('src');
  player.load();

  renderStations(searchInput.value);
  updateMediaSessionMetadata(station);
  updateButtonStates();

  setTimeout(() => {
    isSwitching = false;
  }, 500);
}

playBtn.addEventListener("click", () => {
  if (!currentStation) {
    if (radios.length > 0) {
      playStation(radios[0]);
    } else {
      alert("No stations available to play.");
      return;
    }
  }

  // Assign stream src only on Play press if not already set
  if (!player.src) {
    const station = radios.find(r => r.name === currentStation);
    if (!station) {
      alert("Selected station not found.");
      return;
    }

    player.src = getSafeStreamUrl(station.streamUrl);
    player.load();

    player.oncanplay = () => {
      player.play().catch(err => {
        console.error("Play error:", err);
        nowPlaying.innerHTML = `<span class="error">⚠️ Unable to play ${station.name}. Retrying...</span>`;
        setTimeout(() => player.play().catch(() => {}), 1000);
      });
      nowPlaying.innerHTML = `<span class="now-playing-name">▶️ Now Playing: ${station.name}</span>`;
      updateButtonStates();
    };

    player.onerror = () => {
      nowPlaying.innerHTML = `<span class="error">⚠️ Audio error loading ${station.name}</span>`;
      updateButtonStates();
    };
  } else {
    player.play();
    updateButtonStates();
  }
});

pauseBtn.addEventListener("click", () => {
  player.pause();
  updateButtonStates();
});

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

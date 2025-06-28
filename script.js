let searchInput, stationsDiv, player, nowPlaying, playPauseBtn, nextBtn, prevBtn;
let radios = [];
let currentStation = null;
let isSwitching = false;

// Setup iOS Audio Session
function setupIOSAudioSession() {
  if (window.webkit?.messageHandlers?.audioSession) {
    window.webkit.messageHandlers.audioSession.postMessage({
      action: 'setCategory',
      category: 'playback',
    });
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => player.play().catch(console.error));
    navigator.mediaSession.setActionHandler('pause', () => player.pause());
    navigator.mediaSession.setActionHandler('previoustrack', playPreviousStation);
    navigator.mediaSession.setActionHandler('nexttrack', playNextStation);
  }

  player.setAttribute('playsinline', 'true');
  player.setAttribute('webkit-playsinline', 'true');
  player.setAttribute('x-webkit-airplay', 'allow');

  let userInteracted = false;

  const trackUserInteraction = () => {
    userInteracted = true;
    document.removeEventListener('touchstart', trackUserInteraction);
    document.removeEventListener('click', trackUserInteraction);
  };

  document.addEventListener('touchstart', trackUserInteraction);
  document.addEventListener('click', trackUserInteraction);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !player.paused && userInteracted) {
      player.play().catch(console.error);
    }
  });

  window.addEventListener('focus', () => {
    if (currentStation && player.paused && userInteracted) {
      player.play().catch(console.error);
    }
  });

  window.addEventListener('blur', () => {
    if (currentStation && !player.paused && userInteracted) {
      player.play().catch(console.error);
    }
  });

  return () => userInteracted;
}

function initIOSAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) {
    const audioContext = new AudioContext();
    const unlockAudio = () => {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('click', unlockAudio);
  }

  setupIOSAudioSession();
}

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
    stationsDiv.innerHTML = `<div class="error">⚠️ No stations found</div>`;
    return;
  }

  filteredStations.forEach((station) => {
    const div = document.createElement("div");
    div.className = "station";
    if (currentStation === station.name) div.classList.add("active");

    const logo = document.createElement("img");
    logo.className = "station-logo";
    logo.src = `logo/${station.id}.jpg`;
    logo.alt = `${station.name} logo`;
    logo.onerror = () => {
      logo.src = `logo/default.jpg`;
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
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
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
  setupIOSAudioSession();

  player.play()
    .then(() => {
      nowPlaying.innerHTML = `<span class="now-playing-name">▶️ Now Playing: ${station.name}</span>`;
      updateButtonStates();
    })
    .catch(err => {
      const msg = err.name === 'NotAllowedError'
        ? `⚠️ Tap to play: ${station.name}`
        : `⚠️ Error playing: ${station.name}`;
      nowPlaying.innerHTML = `<span class="error">${msg}</span>`;
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
  if (!playPauseBtn) return;
  playPauseBtn.innerHTML = player.paused ? "▶️ Play" : "⏸️ Pause";
}

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
    } catch (e) {
      console.warn("MediaSession metadata error:", e);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  searchInput = document.getElementById("search");
  stationsDiv = document.getElementById("stations");
  player = document.getElementById("player");
  nowPlaying = document.getElementById("nowPlaying");
  playPauseBtn = document.getElementById("playPauseBtn");
  nextBtn = document.getElementById("nextBtn");
  prevBtn = document.getElementById("prevBtn");

  if (player) player.volume = 1.0;

  fetch("radios.json")
    .then(res => res.json())
    .then(data => {
      radios = data;
      renderStations();
    })
    .catch(err => {
      stationsDiv.innerHTML = `<div class="error">⚠️ Failed to load stations: ${err.message}</div>`;
    });

  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (player.paused) {
        currentStation ? player.play() : playStation(radios[0]);
      } else {
        player.pause();
      }
      updateButtonStates();
    });
  }

  if (nextBtn) nextBtn.addEventListener("click", debounce(playNextStation, 500));
  if (prevBtn) prevBtn.addEventListener("click", debounce(playPreviousStation, 500));
  if (searchInput) searchInput.addEventListener("input", () => renderStations(searchInput.value));
  if (player) {
    player.addEventListener("play", updateButtonStates);
    player.addEventListener("pause", updateButtonStates);
  }

  initIOSAudio();

  const stickyBar = document.querySelector(".sticky-bar");
  if (stickyBar) {
    let timeout;
    window.addEventListener("scroll", () => {
      stickyBar.classList.add("hidden");
      clearTimeout(timeout);
      timeout = setTimeout(() => stickyBar.classList.remove("hidden"), 200);
    });
  }
});

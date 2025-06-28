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

// iOS Audio Session Handling
function setupIOSAudioSession() {
  // Set audio session category for background playback
  if (window.webkit && window.webkit.messageHandlers) {
    // For WKWebView
    window.webkit.messageHandlers.audioSession.postMessage({
      action: 'setCategory',
      category: 'playback'
    });
  }
  
  // Enable background audio
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      player.play().catch(console.error);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      player.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', playPreviousStation);
    navigator.mediaSession.setActionHandler('nexttrack', playNextStation);
  }
  
  // iOS specific audio settings
  player.setAttribute('playsinline', 'true');
  player.setAttribute('webkit-playsinline', 'true');
  player.setAttribute('x-webkit-airplay', 'allow');
  
  // iOS Safari requires user interaction before playing audio
  let userInteracted = false;
  
  // Track user interaction
  const trackUserInteraction = () => {
    userInteracted = true;
    document.removeEventListener('touchstart', trackUserInteraction);
    document.removeEventListener('click', trackUserInteraction);
  };
  
  document.addEventListener('touchstart', trackUserInteraction);
  document.addEventListener('click', trackUserInteraction);
  
  // Prevent audio from being paused when app goes to background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !player.paused && userInteracted) {
      // Keep audio playing in background
      player.play().catch(console.error);
    }
  });
  
  // Handle page focus/blur events
  window.addEventListener('focus', () => {
    if (currentStation && player.paused && userInteracted) {
      player.play().catch(console.error);
    }
  });
  
  window.addEventListener('blur', () => {
    // Don't pause audio when app loses focus
    if (currentStation && !player.paused && userInteracted) {
      player.play().catch(console.error);
    }
  });
  
  // Return user interaction status
  return () => userInteracted;
}

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
  radios.filter(station => station.name.toLowerCase().includes(filter.toLowerCase())).forEach(station => {
    const div = document.createElement("div");
    div.className = "station";
    if (currentStation === station.name) div.classList.add("active");

    const logo = document.createElement("img");
    logo.className = "station-logo";
    logo.src = `logo/${station.id}.jpg`;
    logo.alt = `${station.name} logo`;
    logo.onerror = () => { logo.src = `logo/default.jpg`; };

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

  // iOS specific: Ensure audio session is set up
  const getUserInteractionStatus = setupIOSAudioSession();

  // iOS Safari requires user interaction before playing audio
  const attemptPlay = () => {
    player.play()
      .then(() => {
        nowPlaying.innerHTML = `<span class="now-playing-name">▶️ Now Playing: ${station.name}</span>`;
        updateButtonStates();
      })
      .catch((err) => {
        console.warn("Playback blocked:", err);
        if (err.name === 'NotAllowedError') {
          nowPlaying.innerHTML = `<span class="error">⚠️ Tap the play button to start: ${station.name}</span>`;
        } else {
          nowPlaying.innerHTML = `<span class="error">⚠️ Error playing: ${station.name}</span>`;
        }
        updateButtonStates();
      });
  };

  // Try to play immediately, but handle iOS restrictions
  attemptPlay();

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

// iOS Audio Initialization
function initIOSAudio() {
  // Create a silent audio context to unlock audio on iOS
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) {
    const audioContext = new AudioContext();
    
    // Unlock audio context on user interaction
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
  
  // Set up iOS audio session
  setupIOSAudioSession();
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize iOS audio
  initIOSAudio();
  
  const stickyBar = document.querySelector(".sticky-bar");
  let isScrolling;
  window.addEventListener("scroll", () => {
    stickyBar.classList.add("hidden");
    clearTimeout(isScrolling);
    isScrolling = setTimeout(() => stickyBar.classList.remove("hidden"), 200);
  });
});
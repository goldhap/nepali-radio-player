/**
 * Nepali Radio Player - Core Logic
 * Includes: Web Audio API Equalizer, Proxy Stream Support, and Media Session API
 */

let searchInput, stationsDiv, player, playPauseBtn, nextBtn, prevBtn;
let nowPlayingName, nowPlayingLocation, mainLogo;
let radios = [];
let currentStation = null;

// --- EQ & WEB AUDIO VARIABLES ---
let audioCtx, source, bassFilter, midFilter, trebleFilter;
let isAudioContextInitialized = false;

/**
 * Initializes the Audio Context and EQ Filter Chain
 * Mandatory to run after a user gesture (click)
 */
function initEqualizer() {
  if (isAudioContextInitialized) return;

  try {
    // 1. Initialize Context
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 2. Create Source from <audio> element
    // Ensure the audio element has crossOrigin set to "anonymous" in HTML or via JS
    player.crossOrigin = "anonymous";
    source = audioCtx.createMediaElementSource(player);

    // 3. Create EQ Filters
    // Bass (Lowshelf: frequencies below 200Hz)
    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 200;

    // Mid (Peaking: frequencies around 1000Hz)
    midFilter = audioCtx.createBiquadFilter();
    midFilter.type = "peaking";
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;

    // Treble (Highshelf: frequencies above 3000Hz)
    trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = "highshelf";
    trebleFilter.frequency.value = 3000;

    // 4. Connect the Chain: Source -> Bass -> Mid -> Treble -> Speakers
    source.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(audioCtx.destination);

    isAudioContextInitialized = true;
    console.log("Audio Pipeline Connected");
  } catch (e) {
    console.warn("Web Audio API blocked or not supported:", e);
  }
}



/**
 * Helper: Routes non-HTTPS streams through a proxy to prevent Mixed Content errors
 */
function getSafeStreamUrl(url) {
  if (!url) return "";
  return url.startsWith("https://")
    ? url
    : `https://proxy-b9u6.onrender.com/radio-stream?url=${encodeURIComponent(url)}`;
}

/**
 * Renders the sidebar station list
 */
function renderStations(filter = "") {
  if (!stationsDiv) return;

  const filtered = radios.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  stationsDiv.innerHTML = "";

  if (filtered.length === 0) {
    stationsDiv.innerHTML = `<div class="error-msg">No stations found</div>`;
    return;
  }

  filtered.forEach(station => {
    const div = document.createElement("div");
    div.className = "station-card";
    if (currentStation && currentStation.id === station.id) div.classList.add("active");

    div.innerHTML = `
      <img src="./logo/${station.id}.jpg" onerror="this.src='./logo/default.jpg'" alt="">
      <div class="station-card-info">
        <span class="name">${station.name}</span>
        <span class="location">${station.location || 'Nepal'}</span>
      </div>
    `;

    div.onclick = () => playStation(station);
    stationsDiv.appendChild(div);
  });
}

/**
 * Core Playback Logic
 */
function playStation(station) {
  // 1. Initialize Audio Context on first play
  initEqualizer();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  if (currentStation && currentStation.id === station.id && !player.paused) return;

  currentStation = station;

  // 2. UI Updates
  mainLogo.src = `./logo/${station.id}.jpg`;
  mainLogo.onerror = () => { mainLogo.src = `./logo/default.jpg`; };
  nowPlayingName.textContent = station.name;
  nowPlayingLocation.textContent = "Connecting...";
  
  const artwork = document.querySelector('.artwork-card');
  artwork.classList.add('loading');
  artwork.classList.remove('playing');

  // 3. Audio Stream Handling
  player.pause();
  player.src = getSafeStreamUrl(station.streamUrl);
  player.load();

  player.play().then(() => {
    nowPlayingLocation.textContent = "Live • " + (station.location || "Nepal");
    artwork.classList.remove('loading');
    artwork.classList.add('playing');
  }).catch(err => {
    console.error("Playback Error:", err);
    nowPlayingLocation.textContent = "⚠️ Stream Offline";
    artwork.classList.remove('loading');
  });

  renderStations(searchInput.value);
  updateMediaSession(station);
}

/**
 * UI & Media Controls
 */
function updateButtonStates() {
  const icon = document.getElementById("playIcon");
  const artwork = document.querySelector('.artwork-card');
  
  if (player.paused) {
    icon.className = "fas fa-play";
    artwork.classList.remove('playing');
  } else {
    icon.className = "fas fa-pause";
    artwork.classList.add('playing');
  }
}

function updateMediaSession(station) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: "Nepali Radio Collection",
      artwork: [{ src: `./logo/${station.id}.jpg`, sizes: "512x512", type: "image/jpeg" }]
    });
    navigator.mediaSession.setActionHandler("play", () => player.play());
    navigator.mediaSession.setActionHandler("pause", () => player.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => {
        let i = radios.findIndex(r => r.id === currentStation?.id);
        playStation(radios[(i - 1 + radios.length) % radios.length]);
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
        let i = radios.findIndex(r => r.id === currentStation?.id);
        playStation(radios[(i + 1) % radios.length]);
    });
  }
}

/**
 * Initialization & Event Listeners
 */
document.addEventListener("DOMContentLoaded", () => {
  searchInput = document.getElementById("search");
  stationsDiv = document.getElementById("stations");
  player = document.getElementById("player");
  playPauseBtn = document.getElementById("playPauseBtn");
  nextBtn = document.getElementById("nextBtn");
  prevBtn = document.getElementById("prevBtn");
  nowPlayingName = document.getElementById("nowPlayingName");
  nowPlayingLocation = document.getElementById("nowPlayingLocation");
  mainLogo = document.getElementById("main-logo");

  // Load Station Data
  fetch("./radios.json")
    .then(res => res.json())
    .then(data => {
      radios = data;
      renderStations();
    });

  // Controls
  playPauseBtn.addEventListener("click", () => {
    initEqualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (!currentStation && radios.length > 0) {
      playStation(radios[0]);
    } else {
      player.paused ? player.play() : player.pause();
    }
  });

  nextBtn.addEventListener("click", () => {
    const i = radios.findIndex(r => r.id === currentStation?.id);
    if (i !== -1) playStation(radios[(i + 1) % radios.length]);
  });

  prevBtn.addEventListener("click", () => {
    const i = radios.findIndex(r => r.id === currentStation?.id);
    if (i !== -1) playStation(radios[(i - 1 + radios.length) % radios.length]);
  });

  // Equalizer Sliders
  document.getElementById("bassSlider").addEventListener("input", e => {
    if (bassFilter) bassFilter.gain.value = e.target.value;
  });
  document.getElementById("midSlider").addEventListener("input", e => {
    if (midFilter) midFilter.gain.value = e.target.value;
  });
  document.getElementById("trebleSlider").addEventListener("input", e => {
    if (trebleFilter) trebleFilter.gain.value = e.target.value;
  });

  // Search & Volume
  searchInput.addEventListener("input", e => renderStations(e.target.value));
  document.getElementById("volumeSlider").addEventListener("input", e => {
    player.volume = e.target.value;
  });

  player.addEventListener("play", updateButtonStates);
  player.addEventListener("pause", updateButtonStates);

  // iOS Background Fix
  document.addEventListener('click', () => {
    initEqualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }, { once: true });
});
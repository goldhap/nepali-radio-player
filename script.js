/**
 * Nepali Radio Player - Core Logic
 * Includes: Web Audio API Equalizer (+ presets), Proxy Stream Support, Media Session API,
 * Favorites, Recently Played, Province Filter, Sleep Timer, Shuffle, Share,
 * Stream error auto-skip and Keyboard Shortcuts.
 * All personal state (favorites / recent / last station) lives in localStorage only.
 */

let searchInput, stationsDiv, player, playPauseBtn, nextBtn, prevBtn;
let nowPlayingName, nowPlayingLocation, mainLogo;
let provinceFilter, favoritesToggle, recentSection, recentDiv;
let shuffleBtn, shareBtn, sleepTimerSelect, sleepTimerStatus;
let stationCountEl;
let miniPlayer, miniLogo, miniName, miniMeta, miniPlayIcon;
let radios = [];
let currentStation = null;

// --- FEATURE STATE ---
const PROVINCE_NAMES = {
  1: "Koshi", 2: "Madhesh", 3: "Bagmati", 4: "Gandaki",
  5: "Lumbini", 6: "Karnali", 7: "Sudurpashchim"
};
const LS_FAVORITES = "nrp-favorites";
const LS_RECENT = "nrp-recent";
const LS_LAST = "nrp-last-station";
const MAX_RECENT = 10;
const MAX_STREAM_FAILURES = 5;

let favorites = new Set(loadJSON(LS_FAVORITES, []));
let recentIds = loadJSON(LS_RECENT, []);
let showFavoritesOnly = false;
// True while search / province / favorites filtering is active. In that
// state the Recently Played section hides and the main list shows every
// match, so a station still appears exactly once on screen.
let listFilterActive = false;

// --- STREAM ERROR / AUTO-SKIP STATE ---
let consecutiveFailures = 0;
let lastFailedKey = "";
let lastFailedAt = 0;

// --- SLEEP TIMER STATE ---
let sleepTimeoutId = null;
let sleepIntervalId = null;
let sleepEndAt = null;

// --- EQ & WEB AUDIO VARIABLES ---
let audioCtx, source, bassFilter, midFilter, trebleFilter, gainNode;
// Volume lives in the Web Audio graph (GainNode), not in player.volume:
// iOS Safari ignores programmatic changes to an <audio> element's volume
// (hardware buttons only), but gain applied inside the graph always works.
// currentVolume is the single source of truth for the slider position.
let currentVolume = 0.8;
let webAudioFailed = false;
let isAudioContextInitialized = false;

const EQ_PRESETS = {
  flat:  { bass: 0,  mid: 0, treble: 0 },
  bass:  { bass: 6,  mid: 0, treble: 2 },
  vocal: { bass: -2, mid: 5, treble: 3 },
  music: { bass: 4,  mid: 2, treble: 5 }
};

// --- SMALL HELPERS ---
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage unavailable (private mode etc.) - feature just won't persist */
  }
}

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Stations the user is allowed to see/play (existing `disabled` flag respected). */
function playableRadios() {
  return radios.filter(s => !s.disabled);
}

function findStation(id) {
  return playableRadios().find(s => s.id === id) || null;
}

/**
 * Human readable station meta from the real radios.json fields.
 * e.g. "96.1 FM • Pulchowk, Lalitpur" (replaces the old non-existent
 * station.location field, which always fell back to "Nepal").
 */
function formatStationMeta(station) {
  if (!station) return "Nepal";
  const parts = [];
  if (station.frequency) parts.push(`${station.frequency} FM`);
  if (station.address) parts.push(station.address);
  else if (station.province && PROVINCE_NAMES[station.province]) {
    parts.push(PROVINCE_NAMES[station.province]);
  }
  return parts.length ? parts.join(" • ") : "Nepal";
}

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

    // 4. Volume GainNode (this is what makes the volume slider work on
    // iPhone, where <audio>.volume is read-only for web pages)
    gainNode = audioCtx.createGain();
    gainNode.gain.value = currentVolume;

    // 5. Connect the Chain: Source -> Bass -> Mid -> Treble -> Gain -> Speakers
    source.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // The graph now owns the volume; keep the element itself at full so
    // the two never multiply on browsers that honor both.
    try { player.volume = 1; } catch (e) { /* iOS: read-only, harmless */ }

    // Apply whatever the sliders currently show (e.g. a preset chosen
    // before the first play), so preset/manual choices are never lost.
    applySliderValuesToFilters();

    isAudioContextInitialized = true;
    console.log("Audio Pipeline Connected");
  } catch (e) {
    webAudioFailed = true;
    console.warn("Web Audio API blocked or not supported:", e);
    // Fallback: drive the element directly (works everywhere except iOS).
    try { player.volume = currentVolume; } catch (err) { /* ignore */ }
  }
}

/**
 * Set playback volume (0..1) from any control. Routes through the
 * GainNode when the Web Audio graph is live; otherwise falls back to
 * the element's own volume. Also wakes the AudioContext — iOS parks it
 * in 'suspended'/'interrupted' and a parked context means a silent EQ.
 */
function setVolume(value) {
  const v = Math.min(1, Math.max(0, Number(value) || 0));
  currentVolume = v;
  if (gainNode) {
    gainNode.gain.value = v;
  } else if (!isAudioContextInitialized || webAudioFailed) {
    try { player.volume = v; } catch (e) { /* iOS read-only */ }
  }
  ensureAudioRunning();
}

/** Create (once) and resume the AudioContext; safe to call on any tap. */
function ensureAudioRunning() {
  initEqualizer();
  if (audioCtx && audioCtx.state !== "running") {
    const p = audioCtx.resume();
    if (p && p.catch) p.catch(() => { /* needs a user gesture; next tap retries */ });
  }
}

function applySliderValuesToFilters() {
  const bass = document.getElementById("bassSlider");
  const mid = document.getElementById("midSlider");
  const treble = document.getElementById("trebleSlider");
  if (bassFilter && bass) bassFilter.gain.value = Number(bass.value);
  if (midFilter && mid) midFilter.gain.value = Number(mid.value);
  if (trebleFilter && treble) trebleFilter.gain.value = Number(treble.value);
}

/** Set the three EQ bands (filters + slider positions) in one go. */
function setEQ(bass, mid, treble) {
  const bassSlider = document.getElementById("bassSlider");
  const midSlider = document.getElementById("midSlider");
  const trebleSlider = document.getElementById("trebleSlider");
  if (bassSlider) bassSlider.value = bass;
  if (midSlider) midSlider.value = mid;
  if (trebleSlider) trebleSlider.value = treble;
  if (bassFilter) bassFilter.gain.value = bass;
  if (midFilter) midFilter.gain.value = mid;
  if (trebleFilter) trebleFilter.gain.value = treble;
}

function applyPreset(name) {
  const preset = EQ_PRESETS[name];
  if (!preset) return;
  setEQ(preset.bass, preset.mid, preset.treble);
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.preset === name);
  });
}

function clearPresetHighlight() {
  document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("active"));
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

// --- FAVORITES / RECENT ---
function toggleFavorite(station, event) {
  if (event) event.stopPropagation();
  if (favorites.has(station.id)) favorites.delete(station.id);
  else favorites.add(station.id);
  saveJSON(LS_FAVORITES, [...favorites]);
  renderStations();
  renderRecent();
}

function rememberStation(station) {
  recentIds = [station.id, ...recentIds.filter(id => id !== station.id)].slice(0, MAX_RECENT);
  saveJSON(LS_RECENT, recentIds);
  try { localStorage.setItem(LS_LAST, station.id); } catch (e) { /* ignore */ }
  renderRecent();
}

/** Build one station card (shared by the main list and Recently Played). */
function buildStationCard(station, extraClass) {
  const div = document.createElement("div");
  div.className = "station-card" + (extraClass ? " " + extraClass : "");
  if (currentStation && currentStation.id === station.id) div.classList.add("active");

  const isFav = favorites.has(station.id);
  div.innerHTML = `
    <img src="./logo/${station.id}.jpg" onerror="this.src='./logo/default.jpg'" alt="" loading="lazy" decoding="async">
    <div class="station-card-info">
      <span class="name">${escapeHtml(station.name)}</span>
      <span class="location">${escapeHtml(formatStationMeta(station))}</span>
    </div>
  `;

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "fav-btn" + (isFav ? " favorited" : "");
  favBtn.innerHTML = `<i class="${isFav ? "fas" : "far"} fa-heart"></i>`;
  favBtn.setAttribute("aria-pressed", isFav ? "true" : "false");
  favBtn.setAttribute("aria-label", isFav
    ? `Remove ${station.name} from favorites`
    : `Add ${station.name} to favorites`);
  favBtn.addEventListener("click", (e) => toggleFavorite(station, e));
  div.appendChild(favBtn);

  div.onclick = () => playStation(station);
  return div;
}

/**
 * Renders the sidebar station list.
 * Filters (all combined): text search (name + address + frequency),
 * province select, favorites-only toggle. Disabled stations never render.
 */
function renderStations(filter) {
  if (!stationsDiv) return;

  const query = (typeof filter === "string" ? filter : (searchInput ? searchInput.value : "") || "")
    .trim().toLowerCase();
  const province = provinceFilter ? provinceFilter.value : "";

  listFilterActive = !!(query || province || showFavoritesOnly);
  renderRecent();

  const filtered = playableRadios().filter(s => {
    // Default (unfiltered) view: stations already shown under
    // "Recently Played" are not repeated in the main list — each
    // station appears exactly once on screen.
    if (!listFilterActive && recentIds.includes(s.id)) return false;
    if (province && String(s.province == null ? "" : s.province) !== province) return false;
    if (showFavoritesOnly && !favorites.has(s.id)) return false;
    if (!query) return true;
    const haystacks = [
      s.name || "",
      s.address || "",
      s.frequency != null ? String(s.frequency) : "",
      s.frequency != null ? `${s.frequency} fm` : ""
    ];
    return haystacks.some(h => h.toLowerCase().includes(query));
  });

  // Visible result count, so a filter change is obvious at a glance.
  if (stationCountEl) {
    const recentShown = listFilterActive ? 0 : recentIds.map(findStation).filter(Boolean).length;
    const total = filtered.length + recentShown;
    let suffix = "";
    if (province && PROVINCE_NAMES[province]) suffix = ` in ${PROVINCE_NAMES[province]}`;
    else if (showFavoritesOnly) suffix = " in Favorites";
    else if (query) suffix = ` for "${query}"`;
    stationCountEl.textContent = `${total} station${total === 1 ? "" : "s"}${suffix}`;
  }

  stationsDiv.innerHTML = "";

  if (filtered.length === 0) {
    stationsDiv.innerHTML = `<div class="error-msg">${
      showFavoritesOnly ? "No favorite stations yet — tap the heart on a station to add one." : "No stations found"
    }</div>`;
    return;
  }

  filtered.forEach(station => {
    stationsDiv.appendChild(buildStationCard(station));
  });
}

/** Renders the "Recently Played" row above the main list (hidden when empty). */
function renderRecent() {
  if (!recentSection || !recentDiv) return;
  // While filtering/searching, the main list carries every match —
  // hide this section so no station is shown twice.
  if (listFilterActive) {
    recentSection.hidden = true;
    return;
  }
  const recentStations = recentIds.map(findStation).filter(Boolean);
  recentDiv.innerHTML = "";
  if (recentStations.length === 0) {
    recentSection.hidden = true;
    return;
  }
  recentSection.hidden = false;
  recentStations.forEach(station => {
    recentDiv.appendChild(buildStationCard(station, "recent-card"));
  });
}

/**
 * Sync the mobile mini-player bar with the current station and the
 * main player's status text. Hidden until a station is selected;
 * CSS only ever displays it below desktop width.
 */
function syncMiniPlayer() {
  if (!miniPlayer) return;
  if (!currentStation) {
    miniPlayer.hidden = true;
    document.body.classList.remove("has-mini-player");
    return;
  }
  miniPlayer.hidden = false;
  document.body.classList.add("has-mini-player");
  if (miniLogo) {
    miniLogo.src = `./logo/${currentStation.id}.jpg`;
    miniLogo.onerror = () => { miniLogo.src = `./logo/default.jpg`; };
  }
  if (miniName) miniName.textContent = currentStation.name;
  if (miniMeta && nowPlayingLocation) miniMeta.textContent = nowPlayingLocation.textContent;
}

/** Mark the province chip matching the <select> value as active. */
function syncProvinceChips() {
  if (!provinceFilter) return;
  document.querySelectorAll(".province-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.value === provinceFilter.value);
  });
}

/**
 * Core Playback Logic
 */
function playStation(station) {
  // 1. Initialize Audio Context on first play
  ensureAudioRunning();

  if (currentStation && currentStation.id === station.id && !player.paused) return;

  currentStation = station;
  rememberStation(station);

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
    nowPlayingLocation.textContent = "Live • " + formatStationMeta(station);
    artwork.classList.remove('loading');
    artwork.classList.add('playing');
    syncMiniPlayer();
  }).catch(err => {
    // AbortError = play() was interrupted by a newer load()/pause()
    // (e.g. the user tapped another station) - not a dead stream.
    if (err && err.name === "AbortError") return;
    console.error("Playback Error:", err);
    handleStreamFailure(station);
  });

  renderStations();
  updateMediaSession(station);
  syncMiniPlayer();
}

/** Play the station `offset` steps away in the playable list (wraps around). */
function playRelative(offset) {
  const list = playableRadios();
  if (list.length === 0) return;
  const i = list.findIndex(r => r.id === currentStation?.id);
  if (i === -1) {
    playStation(list[0]);
    return;
  }
  playStation(list[(i + offset + list.length) % list.length]);
}

/** Shuffle / Surprise Me: random station, never the one already playing. */
function playRandomStation() {
  const list = playableRadios();
  if (list.length === 0) return;
  let pool = list;
  if (list.length > 1 && currentStation) {
    pool = list.filter(s => s.id !== currentStation.id);
  }
  playStation(pool[Math.floor(Math.random() * pool.length)]);
}

/**
 * Stream failure handling with loop protection.
 * Shows "Stream Offline", then auto-skips to the next playable station.
 * After MAX_STREAM_FAILURES consecutive failures it stops for good and
 * leaves the offline message up. The counter resets on a successful
 * 'playing' event (see init below).
 */
function handleStreamFailure(station) {
  if (!station || !currentStation || station.id !== currentStation.id) return; // stale

  // The play() promise rejection and the audio 'error' event can both
  // fire for the same broken stream - count each broken stream once.
  const key = station.id + "|" + (player.currentSrc || player.src || "");
  const now = Date.now();
  if (key === lastFailedKey && now - lastFailedAt < 3000) return;
  lastFailedKey = key;
  lastFailedAt = now;

  consecutiveFailures++;

  const artwork = document.querySelector('.artwork-card');
  if (artwork) artwork.classList.remove('loading');

  if (consecutiveFailures >= MAX_STREAM_FAILURES) {
    consecutiveFailures = 0; // a fresh manual attempt gets a fresh budget
    nowPlayingLocation.textContent = "⚠️ Stream Offline";
    syncMiniPlayer();
    return;
  }

  nowPlayingLocation.textContent = "⚠️ Stream Offline — skipping…";
  syncMiniPlayer();
  const failedId = station.id;
  setTimeout(() => {
    // Only skip if the user hasn't already moved on to something else.
    if (currentStation && currentStation.id === failedId) playRelative(1);
  }, 500);
}

// --- SLEEP TIMER ---
function clearSleepTimer() {
  if (sleepTimeoutId) clearTimeout(sleepTimeoutId);
  if (sleepIntervalId) clearInterval(sleepIntervalId);
  sleepTimeoutId = null;
  sleepIntervalId = null;
  sleepEndAt = null;
  if (sleepTimerStatus) {
    sleepTimerStatus.textContent = "";
    sleepTimerStatus.classList.remove("active");
  }
  if (sleepTimerSelect) sleepTimerSelect.classList.remove("active");
}

function setSleepTimer(minutes) {
  clearSleepTimer();
  if (!minutes || minutes <= 0) return;

  sleepEndAt = Date.now() + minutes * 60 * 1000;
  if (sleepTimerSelect) sleepTimerSelect.classList.add("active");
  if (sleepTimerStatus) sleepTimerStatus.classList.add("active");

  const tick = () => {
    const remaining = Math.max(0, sleepEndAt - Date.now());
    const totalSecs = Math.ceil(remaining / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = String(totalSecs % 60).padStart(2, "0");
    if (sleepTimerStatus) sleepTimerStatus.textContent = `⏱ ${m}:${s}`;
  };
  tick();
  sleepIntervalId = setInterval(tick, 1000);

  sleepTimeoutId = setTimeout(() => {
    player.pause();
    if (sleepTimerSelect) sleepTimerSelect.value = "0";
    clearSleepTimer();
  }, minutes * 60 * 1000);
}

// --- SHARE ---
async function shareStation() {
  const url = window.location.href;
  const shareData = currentStation
    ? {
        title: currentStation.name,
        text: `📻 I'm listening to ${currentStation.name} (${formatStationMeta(currentStation)}) on Nepali Radio`,
        url
      }
    : { title: document.title, text: "📻 Nepali Radio — listen to Nepali stations live", url };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      /* user cancelled the share sheet - nothing to do */
    }
    return;
  }

  // Fallback: copy the link and briefly confirm on the button itself.
  const label = document.getElementById("shareBtnLabel");
  let copied = false;
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e2) { /* clipboard unavailable */ }
  }

  if (label) {
    const original = label.textContent;
    label.textContent = copied ? "Link Copied!" : "Copy Failed";
    setTimeout(() => { label.textContent = original; }, 1600);
  }
  if (!copied) window.prompt("Copy this link:", url);
}

/**
 * UI & Media Controls
 */
function updateButtonStates() {
  const icon = document.getElementById("playIcon");
  const artwork = document.querySelector('.artwork-card');

  if (player.paused) {
    icon.className = "fas fa-play";
    if (miniPlayIcon) miniPlayIcon.className = "fas fa-play";
    artwork.classList.remove('playing');
  } else {
    icon.className = "fas fa-pause";
    if (miniPlayIcon) miniPlayIcon.className = "fas fa-pause";
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
    navigator.mediaSession.setActionHandler("previoustrack", () => playRelative(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => playRelative(1));
  }
}

/**
 * Preselect the last played station on load WITHOUT autoplaying:
 * shows its name/logo/meta with a "Ready" state so one tap resumes it.
 */
function preselectLastStation() {
  let lastId = null;
  try { lastId = localStorage.getItem(LS_LAST); } catch (e) { /* ignore */ }
  if (!lastId) return;
  const station = findStation(lastId);
  if (!station) return;

  currentStation = station;
  mainLogo.src = `./logo/${station.id}.jpg`;
  mainLogo.onerror = () => { mainLogo.src = `./logo/default.jpg`; };
  nowPlayingName.textContent = station.name;
  const meta = formatStationMeta(station);
  nowPlayingLocation.textContent = (meta && meta !== "Nepal" ? meta + " • " : "") + "Ready to play";
  updateMediaSession(station);
  syncMiniPlayer();
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
  provinceFilter = document.getElementById("provinceFilter");
  favoritesToggle = document.getElementById("favoritesToggle");
  recentSection = document.getElementById("recentSection");
  recentDiv = document.getElementById("recentStations");
  shuffleBtn = document.getElementById("shuffleBtn");
  shareBtn = document.getElementById("shareBtn");
  stationCountEl = document.getElementById("stationCount");
  miniPlayer = document.getElementById("miniPlayer");
  miniLogo = document.getElementById("miniLogo");
  miniName = document.getElementById("miniName");
  miniMeta = document.getElementById("miniMeta");
  miniPlayIcon = document.getElementById("miniPlayIcon");
  sleepTimerSelect = document.getElementById("sleepTimerSelect");
  sleepTimerStatus = document.getElementById("sleepTimerStatus");

  const volumeSlider = document.getElementById("volumeSlider");

  // Load Station Data
  fetch("./radios.json")
    .then(res => res.json())
    .then(data => {
      radios = data;
      preselectLastStation();
      renderStations();
      renderRecent();
    });

  // Controls
  playPauseBtn.addEventListener("click", () => {
    ensureAudioRunning();

    if (!currentStation && playableRadios().length > 0) {
      playStation(playableRadios()[0]);
    } else if (currentStation && !player.src) {
      // A station is preselected (last played) but nothing is loaded yet.
      playStation(currentStation);
    } else {
      player.paused ? player.play() : player.pause();
    }
  });

  nextBtn.addEventListener("click", () => playRelative(1));
  prevBtn.addEventListener("click", () => playRelative(-1));

  if (shuffleBtn) shuffleBtn.addEventListener("click", playRandomStation);
  if (shareBtn) shareBtn.addEventListener("click", shareStation);

  // Mini-player (mobile): same behaviour as the main controls.
  const miniPlay = document.getElementById("miniPlay");
  const miniPrev = document.getElementById("miniPrev");
  const miniNext = document.getElementById("miniNext");
  if (miniPlay) miniPlay.addEventListener("click", () => playPauseBtn.click());
  if (miniPrev) miniPrev.addEventListener("click", () => playRelative(-1));
  if (miniNext) miniNext.addEventListener("click", () => playRelative(1));

  // Province chips (mobile): two-way sync with the province <select>.
  document.querySelectorAll(".province-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (provinceFilter) provinceFilter.value = chip.dataset.value;
      syncProvinceChips();
      renderStations();
    });
  });
  syncProvinceChips();

  // EQ collapse toggle (mobile only; CSS keeps EQ always visible on desktop)
  const eqToggle = document.getElementById("eqToggle");
  if (eqToggle) {
    eqToggle.addEventListener("click", () => {
      const open = eqToggle.getAttribute("aria-expanded") !== "true";
      eqToggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.querySelectorAll(".eq-container, .eq-presets").forEach(el => {
        el.classList.toggle("open", open);
      });
    });
  }

  // Sleep Timer
  if (sleepTimerSelect) {
    sleepTimerSelect.addEventListener("change", e => {
      setSleepTimer(Number(e.target.value));
    });
  }

  // Equalizer Sliders (each interaction also wakes the AudioContext —
  // on iOS a suspended context is the usual reason the EQ "does nothing")
  document.getElementById("bassSlider").addEventListener("input", e => {
    clearPresetHighlight();
    ensureAudioRunning();
    if (bassFilter) bassFilter.gain.value = e.target.value;
  });
  document.getElementById("midSlider").addEventListener("input", e => {
    clearPresetHighlight();
    ensureAudioRunning();
    if (midFilter) midFilter.gain.value = e.target.value;
  });
  document.getElementById("trebleSlider").addEventListener("input", e => {
    clearPresetHighlight();
    ensureAudioRunning();
    if (trebleFilter) trebleFilter.gain.value = e.target.value;
  });

  // Equalizer Presets
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => { ensureAudioRunning(); applyPreset(btn.dataset.preset); });
  });

  // Search, Province & Favorites filters
  searchInput.addEventListener("input", e => renderStations(e.target.value));
  if (provinceFilter) {
    // 'input' fires earlier than 'change' on some mobile pickers (iOS
    // wheel); listening to both makes the filter feel instant. Rendering
    // is idempotent, so a double fire is harmless.
    provinceFilter.addEventListener("change", () => { renderStations(); syncProvinceChips(); });
    provinceFilter.addEventListener("input", () => { renderStations(); syncProvinceChips(); });
  }
  if (favoritesToggle) {
    favoritesToggle.addEventListener("click", () => {
      showFavoritesOnly = !showFavoritesOnly;
      favoritesToggle.classList.toggle("active", showFavoritesOnly);
      favoritesToggle.setAttribute("aria-pressed", showFavoritesOnly ? "true" : "false");
      renderStations();
    });
  }

  // Volume
  volumeSlider.addEventListener("input", e => {
    setVolume(Number(e.target.value));
  });

  player.addEventListener("play", updateButtonStates);
  player.addEventListener("pause", updateButtonStates);

  // A stream that actually starts playing clears the failure budget.
  player.addEventListener("playing", () => {
    consecutiveFailures = 0;
    lastFailedKey = "";
  });

  // Dead / unreachable stream: show offline + auto-skip (loop-guarded).
  player.addEventListener("error", () => {
    if (currentStation) handleStreamFailure(currentStation);
  });

  // Keyboard Shortcuts (ignored while typing in a field)
  document.addEventListener("keydown", e => {
    const target = e.target;
    const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "select" || tag === "textarea" || (target && target.isContentEditable)) return;

    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      playPauseBtn.click();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      playRelative(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      playRelative(-1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.key === "ArrowUp" ? 0.05 : -0.05;
      const next = Math.min(1, Math.max(0, currentVolume + step));
      setVolume(next);
      if (volumeSlider) volumeSlider.value = next;
    }
  });

  // iOS Background Fix: every tap is a chance to (re)start the
  // AudioContext — iOS suspends/interrupts it when the tab loses focus,
  // and a parked context silently disables the EQ and gain volume.
  document.addEventListener('click', () => {
    ensureAudioRunning();
  });
});

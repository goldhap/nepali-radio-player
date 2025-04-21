const searchInput = document.getElementById("search");
const stationsDiv = document.getElementById("stations");
const player = document.getElementById("player");
const nowPlaying = document.getElementById("nowPlaying");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");

let currentStation = null;

// Function to render stations list
function renderStations(filter = "") {
  stationsDiv.innerHTML = "";
  radios
    .filter(station => station.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(station => {
      const div = document.createElement("div");
      div.className = "station";
      if (currentStation === station.name) div.classList.add("active");

      const nameSpan = document.createElement("span");
      nameSpan.className = "station-name";
      nameSpan.textContent = station.name;

      const icon = document.createElement("span");
      icon.className = "icon";
      icon.textContent = "🎵";

      div.appendChild(nameSpan);
      div.appendChild(icon);

      div.onclick = () => {
        playStation(station);  // Play the station on click
      };

      stationsDiv.appendChild(div);
    });
}

// Play button functionality
playBtn.addEventListener("click", () => {
  if (player.src) {
    player.play();
  } else if (radios.length > 0) {
    currentStation = radios[0].name;
    player.src = radios[0].streamUrl;
    player.play();
    nowPlaying.textContent = `Now Playing: ${radios[0].name}`;
    renderStations(searchInput.value);
  }
});

// Pause button functionality
pauseBtn.addEventListener("click", () => {
  player.pause();
});

// Next button functionality to switch to the next station
nextBtn.addEventListener("click", () => {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const nextIndex = (currentIndex + 1) % radios.length;
  playStation(radios[nextIndex]);  // Play the next station
});

// Search bar to filter the stations list
searchInput.addEventListener("input", (e) => {
  renderStations(e.target.value);
});

// Function to play a specific station
function playStation(station) {
  currentStation = station.name;
  player.src = station.streamUrl;
  player.play();
  nowPlaying.textContent = `Now Playing: ${station.name}`;
  renderStations(searchInput.value);
  updateMediaSessionMetadata(station);  // Update media session whenever a station is played
}

// Function to update Media Session for background control
function updateMediaSessionMetadata(station) {
  if ('mediaSession' in navigator && station) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: "Nepali Radio",
      album: "Live Streaming",
      artwork: [
        { src: "https://i.ibb.co/MRMhscs/nepaliradio.png", sizes: "96x96", type: "image/png" },
        { src: "https://i.ibb.co/MRMhscs/nepaliradio.png", sizes: "128x128", type: "image/png" }
      ]
    });

    // Set media action handlers for background control
    navigator.mediaSession.setActionHandler("play", () => {
      player.play();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      player.pause();
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      playPreviousStation();  // Go to previous station
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      playNextStation();  // Go to next station
    });
  }
}

// Function to switch to the previous station
function playPreviousStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const prevIndex = (currentIndex - 1 + radios.length) % radios.length;
  playStation(radios[prevIndex]);
}

// Function to switch to the next station
function playNextStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const nextIndex = (currentIndex + 1) % radios.length;
  playStation(radios[nextIndex]);
}

// Initial rendering of stations
renderStations();

const searchInput = document.getElementById("search");
const stationsDiv = document.getElementById("stations");
const player = document.getElementById("player");
const nowPlaying = document.getElementById("nowPlaying");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

let currentStation = null;

const repoName = "nepali-radio-player";
const basePath = repoName ? `/${repoName}` : "";

// Function to render stations list with logos
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
      logo.src = `${basePath}/logo/${station.id}.jpg`;
      logo.alt = `${station.name} logo`;
      logo.onerror = function() {
        this.src = `${basePath}/logo/default.jpg`;
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

// Function to play a specific station
function playStation(station) {
  try {
    currentStation = station.name;
    player.src = station.streamUrl;
    player.play().catch(error => {
      console.error("Error playing audio:", error);
      nowPlaying.textContent = `Error: Unable to play ${station.name}`;
    });
    nowPlaying.textContent = `Now Playing: ${station.name}`;
    renderStations(searchInput.value);
    updateMediaSessionMetadata(station);
    updateButtonStates();
  } catch (error) {
    console.error("Error in playStation:", error);
    nowPlaying.textContent = `Error: Failed to load station`;
  }
}

// Function to play the next station
function playNextStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const nextIndex = (currentIndex + 1) % radios.length;
  playStation(radios[nextIndex]);
}

// Function to play the previous station
function playPreviousStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const prevIndex = (currentIndex - 1 + radios.length) % radios.length;
  playStation(radios[prevIndex]);
}

// Function to update media session metadata
function updateMediaSessionMetadata(station) {
  if ('mediaSession' in navigator && station) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: "Nepali Radio",
        album: "Live Streaming",
        artwork: [
          { 
            src: `${basePath}/logo/${station.id}.jpg`, 
            sizes: "96x96", 
            type: "image/jpeg" 
          },
          { 
            src: `${basePath}/logo/${station.id}.jpg`, 
            sizes: "128x128", 
            type: "image/jpeg" 
          },
          { 
            src: `${basePath}/logo/default.jpg`, 
            sizes: "96x96", 
            type: "image/jpeg" 
          }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => {
        player.play().catch(error => console.error("Media play error:", error));
        updateButtonStates();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        player.pause();
        updateButtonStates();
      });
      navigator.mediaSession.setActionHandler("previoustrack", playPreviousStation);
      navigator.mediaSession.setActionHandler("nexttrack", playNextStation);
    } catch (error) {
      console.error("Error setting media session metadata:", error);
    }
  }
}

// Function to update play/pause button visibility
function updateButtonStates() {
  if (player.paused) {
    playBtn.style.display = "inline-flex";
    pauseBtn.style.display = "none";
  } else {
    playBtn.style.display = "none";
    pauseBtn.style.display = "inline-flex";
  }
}

// Event listeners for buttons
playBtn.addEventListener("click", () => {
  if (currentStation) {
    player.play().catch(error => console.error("Play error:", error));
    updateButtonStates();
  } else if (radios.length > 0) {
    playStation(radios[0]); // Play first station if none selected
  }
});

pauseBtn.addEventListener("click", () => {
  player.pause();
  updateButtonStates();
});

nextBtn.addEventListener("click", playNextStation);
prevBtn.addEventListener("click", playPreviousStation);

// Search input event listener
searchInput.addEventListener("input", () => {
  renderStations(searchInput.value);
});

// Update button states on player events
player.addEventListener("play", updateButtonStates);
player.addEventListener("pause", updateButtonStates);

// Initial rendering of stations
renderStations();

// Optionally play the first station on load
if (radios.length > 0) {
  // playStation(radios[0]); // Uncomment to auto-play first station
}

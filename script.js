const searchInput = document.getElementById("search");
const stationsDiv = document.getElementById("stations");
const player = document.getElementById("player");
const nowPlaying = document.getElementById("nowPlaying");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");

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

      // Create logo element using station's ID
      const logo = document.createElement("img");
      logo.className = "station-logo";
      logo.src = `${basePath}/logo/${station.id}.jpg`; // Using ID and .jpg
      logo.alt = `${station.name} logo`;
      logo.onerror = function() {
        this.src = `${basePath}/logo/default.jpg`; // Fallback if logo missing
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
  } catch (error) {
    console.error("Error in playStation:", error);
    nowPlaying.textContent = `Error: Failed to load station`;
  }
}

// Update media session with station logo
function updateMediaSessionMetadata(station) {
  if ('mediaSession' in navigator && station) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: "Nepali Radio",
        album: "Live Streaming",
        artwork: [
          { 
            src: `${basePath}/logo/${station.id}.jpg`, // Using ID and .jpg
            sizes: "96x96", 
            type: "image/jpeg" // Changed to jpeg
          },
          { 
            src: `${basePath}/logo/${station.id}.jpg`, 
            sizes: "128x128", 
            type: "image/jpeg" 
          }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => player.play().catch(error => console.error("Media play error:", error)));
      navigator.mediaSession.setActionHandler("pause", () => player.pause());
      navigator.mediaSession.setActionHandler("previoustrack", playPreviousStation);
      navigator.mediaSession.setActionHandler("nexttrack", playNextStation);
    } catch (error) {
      console.error("Error setting media session metadata:", error);
    }
  }
}

// Rest of your existing functions remain exactly the same...
// (playNextStation, playPreviousStation, and event listeners)

// Initial rendering of stations
renderStations();

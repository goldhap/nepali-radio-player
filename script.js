const searchInput = document.getElementById("search");
const stationsDiv = document.getElementById("stations");
const player = document.getElementById("player");
const nowPlaying = document.getElementById("nowPlaying");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");

let currentStation = null;

// Replace 'your-repo' with your actual GitHub repository name, or set to "" if using a user site
const repoName = "nepali-radio-player"; // e.g., "nepali-radio-player"
const basePath = repoName ? `/${repoName}` : "";

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

// Function to update Media Session for background control
function updateMediaSessionMetadata(station) {
  if ('mediaSession' in navigator && station) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: "Nepali Radio",
        album: "Live Streaming",
        artwork: [
          { src: `${basePath}/icon/android-chrome-192x192.png`, sizes: "96x96", type: "image/png" },
          { src: `${basePath}/icon/android-chrome-192x192.png`, sizes: "128x128", type: "image/png" }
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

// Event Listeners
playBtn.addEventListener("click", () => {
  if (player.src) {
    player.play().catch(error => {
      console.error("Error playing audio:", error);
      nowPlaying.textContent = "Error: Unable to play";
    });
  } else if (radios.length > 0) {
    playStation(radios[0]);
  }
});

pauseBtn.addEventListener("click", () => player.pause());

nextBtn.addEventListener("click", playNextStation);

searchInput.addEventListener("input", (e) => renderStations(e.target.value));

// Initial rendering of stations
renderStations();

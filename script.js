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

// Function to render stations list with logos and addresses
function renderStations(filter = "") {
  stationsDiv.innerHTML = "";
  radios
    .filter(station => station.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(station => {
      const div = document.createElement("div");
      div.className = "station";
      if (currentStation === station.name) div.classList.add("active");

      // Create logo element
      const logo = document.createElement("img");
      logo.className = "station-logo";
      logo.src = `${basePath}/logo/${station.id}.jpg`;
      logo.alt = `${station.name} logo`;
      logo.onerror = function() {
        this.src = `${basePath}/logo/default.jpg`;
      };

      // Create info container
      const infoDiv = document.createElement("div");
      infoDiv.className = "station-info";

      // Station name
      const nameSpan = document.createElement("span");
      nameSpan.className = "station-name";
      nameSpan.textContent = station.name;

      // Station address (hidden by default)
      const addressSpan = document.createElement("span");
      addressSpan.className = "station-address";
      addressSpan.textContent = station.address || "Address not available";

      infoDiv.appendChild(nameSpan);
      infoDiv.appendChild(addressSpan);

      div.appendChild(logo);
      div.appendChild(infoDiv);
      div.onclick = () => playStation(station);
      stationsDiv.appendChild(div);
    });
}

// Function to play a specific station
function playStation(station) {
  try {
    currentStation = station.name;
    player.src = station.streamUrl;
    player.play()
      .then(() => {
        updateNowPlaying(station);
        renderStations(searchInput.value);
        updateMediaSessionMetadata(station);
      })
      .catch(error => {
        console.error("Error playing audio:", error);
        nowPlaying.innerHTML = `<span class="error">Error: Unable to play ${station.name}</span>`;
      });
  } catch (error) {
    console.error("Error in playStation:", error);
    nowPlaying.innerHTML = `<span class="error">Error: Failed to load station</span>`;
  }
}

// Update now playing display with address
function updateNowPlaying(station) {
  nowPlaying.innerHTML = `
    <span class="now-playing-name">Now Playing: ${station.name}</span>
    ${station.address ? `<span class="now-playing-address">📍 ${station.address}</span>` : ''}
  `;
}

// Function to play next station
function playNextStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const nextIndex = (currentIndex + 1) % radios.length;
  playStation(radios[nextIndex]);
}

// Function to play previous station
function playPreviousStation() {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const prevIndex = (currentIndex - 1 + radios.length) % radios.length;
  playStation(radios[prevIndex]);
}

// Update media session metadata
function updateMediaSessionMetadata(station) {
  if ('mediaSession' in navigator && station) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: "Nepali Radio",
        album: station.address || "Live Streaming",
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
          }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => player.play().catch(console.error));
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
      nowPlaying.innerHTML = '<span class="error">Error: Unable to play</span>';
    });
  } else if (radios.length > 0) {
    playStation(radios[0]);
  }
});

pauseBtn.addEventListener("click", () => player.pause());
nextBtn.addEventListener("click", playNextStation);
searchInput.addEventListener("input", (e) => renderStations(e.target.value));

// Initial rendering
renderStations();

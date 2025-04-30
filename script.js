const searchInput = document.getElementById("search");
const stationsDiv = document.getElementById("stations");
const player = document.getElementById("player");
const nowPlaying = document.getElementById("nowPlaying");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");

let currentStation = null;
let isPlaying = false;

const repoName = "nepali-radio-player";
const basePath = repoName ? `/${repoName}` : "";

// Function to render stations list
function renderStations(filter = "") {
  stationsDiv.innerHTML = "";
  radios.forEach(station => {
    if (!station.name.toLowerCase().includes(filter.toLowerCase())) return;

    const div = document.createElement("div");
    div.className = "station";
    if (currentStation === station.name) div.classList.add("active");

    // Station logo
    const logo = document.createElement("img");
    logo.className = "station-logo";
    logo.src = `${basePath}/logo/${station.id}.jpg`;
    logo.alt = station.name;
    logo.onerror = () => logo.src = `${basePath}/logo/default.jpg`;

    // Station info container
    const infoDiv = document.createElement("div");
    infoDiv.className = "station-info";

    // Station name
    const nameSpan = document.createElement("span");
    nameSpan.className = "station-name";
    nameSpan.textContent = station.name;

    // Station address (always visible)
    const addressSpan = document.createElement("span");
    addressSpan.className = "station-address";
    addressSpan.textContent = station.address || "Address not available";

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(addressSpan);
    div.appendChild(logo);
    div.appendChild(infoDiv);

    div.addEventListener("click", () => playStation(station));
    stationsDiv.appendChild(div);
  });
}

// Function to play station
function playStation(station) {
  currentStation = station.name;
  player.src = station.streamUrl;
  player.play()
    .then(() => {
      isPlaying = true;
      updateNowPlaying(station);
      renderStations();
      updateMediaSession(station);
    })
    .catch(error => {
      console.error("Playback error:", error);
      nowPlaying.innerHTML = `Error: ${error.message}`;
    });
}

// Update now playing display
function updateNowPlaying(station) {
  nowPlaying.innerHTML = `
    <strong>Now Playing:</strong> ${station.name}
    <div class="station-address">${station.address || ""}</div>
  `;
}

// Update media session
function updateMediaSession(station) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: station.address || "Nepali Radio",
      artwork: [
        { src: `${basePath}/logo/${station.id}.jpg`, sizes: "96x96", type: "image/jpeg" }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => player.play());
    navigator.mediaSession.setActionHandler('pause', () => player.pause());
  }
}

// Player event listeners
player.addEventListener('play', () => {
  isPlaying = true;
  playBtn.style.display = 'none';
  pauseBtn.style.display = 'inline-block';
});

player.addEventListener('pause', () => {
  isPlaying = false;
  playBtn.style.display = 'inline-block';
  pauseBtn.style.display = 'none';
});

player.addEventListener('error', () => {
  nowPlaying.innerHTML = "Error: Could not play station";
});

// Button event listeners
playBtn.addEventListener('click', () => {
  if (player.src) {
    player.play();
  } else if (radios.length > 0) {
    playStation(radios[0]);
  }
});

pauseBtn.addEventListener('click', () => player.pause());
nextBtn.addEventListener('click', playNextStation);

// Search functionality
searchInput.addEventListener('input', (e) => renderStations(e.target.value));

// Initial setup
renderStations();
pauseBtn.style.display = 'none'; // Hide pause button initially

const searchInput = document.getElementById("search");
const stationsDiv = document.getElementById("stations");
const player = document.getElementById("player");
const nowPlaying = document.getElementById("nowPlaying");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");

let currentStation = null;

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
        currentStation = station.name;
        player.src = station.streamUrl;
        player.play();
        nowPlaying.textContent = `Now Playing: ${station.name}`;
        renderStations(filter);
      };

      stationsDiv.appendChild(div);
    });
}

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

pauseBtn.addEventListener("click", () => {
  player.pause();
});

nextBtn.addEventListener("click", () => {
  if (!currentStation || !radios.length) return;
  const currentIndex = radios.findIndex(r => r.name === currentStation);
  const nextIndex = (currentIndex + 1) % radios.length;
  currentStation = radios[nextIndex].name;
  player.src = radios[nextIndex].streamUrl;
  player.play();
  nowPlaying.textContent = `Now Playing: ${currentStation}`;
  renderStations(searchInput.value);
});

searchInput.addEventListener("input", (e) => {
  renderStations(e.target.value);
});

renderStations();
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
  
      navigator.mediaSession.setActionHandler("play", () => {
        player.play();
      });
  
      navigator.mediaSession.setActionHandler("pause", () => {
        player.pause();
      });
  
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playPreviousStation();
      });
  
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playNextStation();
      });
    }
  }
  
  function playPreviousStation() {
    if (!currentStation || !radios.length) return;
    const currentIndex = radios.findIndex(r => r.name === currentStation);
    const prevIndex = (currentIndex - 1 + radios.length) % radios.length;
    playStation(radios[prevIndex]);
  }
  
  function playNextStation() {
    if (!currentStation || !radios.length) return;
    const currentIndex = radios.findIndex(r => r.name === currentStation);
    const nextIndex = (currentIndex + 1) % radios.length;
    playStation(radios[nextIndex]);
  }
  
  function playStation(station) {
    currentStation = station.name;
    player.src = station.streamUrl;
    player.play();
    nowPlaying.textContent = `Now Playing: ${station.name}`;
    renderStations(searchInput.value);
    updateMediaSessionMetadata(station);
  }
  

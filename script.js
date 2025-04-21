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

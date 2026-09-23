const releaseList = document.getElementById("releaseList");
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");
const audio = document.getElementById("audio");
const player = document.getElementById("player");
const playBtn = document.getElementById("playBtn");
const progress = document.getElementById("progress");
const currentTime = document.getElementById("currentTime");
const duration = document.getElementById("duration");
const playerTitle = document.getElementById("playerTitle");
const playerRelease = document.getElementById("playerRelease");
const playerArt = document.getElementById("playerArt");
const spotifyEmbed = document.getElementById("spotifyEmbed");

let queue = [], queueIndex = -1, objectUrls = [];
let spotifyController = null;
let spotifyReady = false;
let usingSpotify = false;
let spotifyApi = null;
let pendingSpotify = null;

window.onSpotifyIframeApiReady = (IFrameAPI) => {
  spotifyApi = IFrameAPI;
  spotifyReady = true;
  if (pendingSpotify) {
    createSpotifyController(pendingSpotify.url, pendingSpotify.autoPlay);
    pendingSpotify = null;
  }
};

function createSpotifyController(url, autoPlay = false) {
  if (!spotifyApi || !url) return;
  if (spotifyController) {
    spotifyController.loadEntity(url);
    if (autoPlay) setTimeout(() => spotifyController?.play(), 250);
    return;
  }

  const element = document.getElementById("spotifyEmbed");
  if (!element) return;

  spotifyApi.createController(element, {
    width: "100%",
    height: "152",
    url
  }, (EmbedController) => {
    spotifyController = EmbedController;

    spotifyController.addListener("playback_update", (event) => {
      if (!usingSpotify || !event?.data) return;
      const state = event.data;
      const pos = Number(state.position || 0) / 1000;
      const dur = Number(state.duration || 0) / 1000;
      currentTime.textContent = fmt(pos);
      duration.textContent = fmt(dur);
      duration.dataset.seconds = String(dur);
      progress.value = dur ? (pos / dur) * 100 : 0;
      playBtn.textContent = state.isPaused ? "▶" : "❚❚";
    });

    spotifyController.addListener("playback_started", () => {
      if (usingSpotify) playBtn.textContent = "❚❚";
    });

    if (autoPlay) setTimeout(() => spotifyController?.play(), 250);
  });
}
function renderMusic() {
  const q = (searchInput.value || "").toLowerCase().trim();
  const filter = filterSelect.value;
  releaseList.innerHTML = "";

  CAS_RELEASES
    .filter(r =>
      (filter === "all" || r.type === filter) &&
      (!q || r.title.toLowerCase().includes(q) || r.tracks.some(t => t.toLowerCase().includes(q)))
    )
    .forEach(r => {
      const section = document.createElement("article");
      section.className = "release";
      section.id = r.title;
      section.innerHTML = `
        <div class="release-cover cover ${r.color}"><span>CAS</span><b>${r.title}</b></div>
        <div class="release-body">
          <div class="release-top">
            <div><p class="eyebrow">${r.year} / ${r.type}</p><h2>${r.title}</h2></div>
            <a href="${r.official}" target="_blank" rel="noopener">OFFICIAL ↗</a>
          </div>
          <ol class="tracklist">
            ${r.tracks.map((t,i) => `
              <li>
                <button class="track-play" data-release="${escapeAttr(r.title)}" data-track="${escapeAttr(t)}" data-index="${i}">
                  <span>${String(i+1).padStart(2,"0")}</span><strong>${t}</strong><em>PLAY</em>
                </button>
              </li>
            `).join("")}
          </ol>
        </div>`;
      releaseList.appendChild(section);
    });

  document.querySelectorAll(".track-play").forEach(b => b.addEventListener("click", () => {
    const release = b.dataset.release;
    const title = b.dataset.track;
    const releaseObj = CAS_RELEASES.find(x => x.title === release);
    if (!releaseObj) return;

    queue = releaseObj.tracks.map(t => {
      const track = ALL_TRACKS.find(x => x.release === release && x.title === t);
      return {
        title: t,
        release,
        color: releaseObj.color,
        spotify: track?.spotify || ""
      };
    });

    queueIndex = releaseObj.tracks.indexOf(title);
    loadQueueItem(true);
  }));
}

function escapeAttr(s) {
  return s.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function loadQueueItem(autoPlay = false) {
  const item = queue[queueIndex];
  if (!item) return;

  player.classList.remove("hidden");
  playerTitle.textContent = item.title;
  playerRelease.textContent = item.release;
  playerArt.className = `player-art cover ${item.color}`;
  playerArt.textContent = "CAS";
  progress.value = 0;
  currentTime.textContent = "0:00";
  duration.textContent = "0:00";

  const local = window.CAS_LOCAL_AUDIO?.[item.title];

  if (item.spotify) {
    usingSpotify = true;
    audio.pause();
    audio.removeAttribute("src");
    spotifyEmbed.classList.remove("hidden");
    playBtn.textContent = "▶";

    if (!spotifyReady) {
      pendingSpotify = { url: item.spotify, autoPlay };
      playerTitle.textContent = item.title;
      playerRelease.textContent = `${item.release} · Spotify loading…`;
      return;
    }

    createSpotifyController(item.spotify, autoPlay);
    return;
  }

  usingSpotify = false;
  spotifyEmbed.classList.add("hidden");

  if (local) {
    audio.src = local;
    audio.play().catch(()=>{});
    playBtn.textContent = "❚❚";
  } else {
    audio.removeAttribute("src");
    playBtn.textContent = "▶";
  }
}

playBtn.addEventListener("click", () => {
  if (usingSpotify) {
    if (!spotifyController) return;
    spotifyController.togglePlay();
    return;
  }

  if (!audio.src) {
    alert("Add this song's Spotify link in CAS_SPOTIFY in data.js, or load your own licensed/local audio file.");
    return;
  }

  if (audio.paused) {
    audio.play();
    playBtn.textContent = "❚❚";
  } else {
    audio.pause();
    playBtn.textContent = "▶";
  }
});

document.getElementById("prevBtn").addEventListener("click", () => {
  if (queue.length) {
    queueIndex = (queueIndex - 1 + queue.length) % queue.length;
    loadQueueItem(true);
  }
});

document.getElementById("nextBtn").addEventListener("click", () => {
  if (queue.length) {
    queueIndex = (queueIndex + 1) % queue.length;
    loadQueueItem(true);
  }
});

audio.addEventListener("timeupdate", () => {
  if (usingSpotify) return;
  progress.value = audio.duration ? (audio.currentTime / audio.duration * 100) : 0;
  currentTime.textContent = fmt(audio.currentTime);
});

audio.addEventListener("loadedmetadata", () => {
  if (!usingSpotify) duration.textContent = fmt(audio.duration);
});

audio.addEventListener("ended", () => {
  if (queue.length) {
    queueIndex = (queueIndex + 1) % queue.length;
    loadQueueItem(true);
  }
});

progress.addEventListener("input", () => {
  const item = queue[queueIndex];
  if (usingSpotify && spotifyController && item?.spotify) {
    const dur = Number(duration.dataset.seconds || 0);
    if (dur) spotifyController.seek((progress.value / 100) * dur);
    return;
  }
  if (audio.duration) audio.currentTime = progress.value / 100 * audio.duration;
});

function fmt(s) {
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
}

document.getElementById("audioInput").addEventListener("change", e => {
  window.CAS_LOCAL_AUDIO = {};
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];

  [...e.target.files].forEach(file => {
    const key = file.name.replace(/\.[^.]+$/," ").trim().toLowerCase();
    const match = ALL_TRACKS.find(t => t.title.toLowerCase() === key);
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    if (match) window.CAS_LOCAL_AUDIO[match.title] = url;
  });

  alert("Local audio library loaded. File names should match song titles, e.g. “Apocalypse.mp3”.");
});

searchInput.addEventListener("input", renderMusic);
filterSelect.addEventListener("change", renderMusic);
renderMusic();

const hash = decodeURIComponent(location.hash.slice(1));
if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({behavior:"smooth",block:"start"}), 150);

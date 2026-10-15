import { createStationScene } from "./scene.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ghosts = [
  "search and play anything or paste a url",
  "lofi rain on the platform",
  "solidify your bond",
  "tonight's selection",
  "Mr. Penguin is listening",
  "Faded · Alan Walker",
];

const stationMeta = {
  today: { song: "Chart Drift", artist: "today's selection" },
  arcade: { song: "Pixel Night", artist: "8-bit core" },
  lofi: { song: "Dusty Keys", artist: "lofi beats" },
  jazz: { song: "Brushed Midnight", artist: "soulful jazz" },
  deepwork: { song: "Soft Focus", artist: "deep work music" },
  nightdrive: { song: "Neon Highway", artist: "night drive" },
  house: { song: "Velvet Floor", artist: "house party" },
  "808s": { song: "Sub Pressure", artist: "808s & beats" },
};

const state = {
  scene: null,
  source: null,
  station: "today",
  listening: false,
  audioCtx: null,
  analyser: null,
  data: null,
  sourceNode: null,
  demoNodes: [],
  demoAudio: null,
  micStream: null,
  rafMeter: 0,
};

const FADED_META = { song: "Faded", artist: "Alan Walker" };
const GUIDE_KEY = "pm-guide-seen-v1";


function toast(msg) {
  const host = $("[data-pui-toasts]");
  const el = document.createElement("div");
  el.className = "pui-toast";
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-on"));
  setTimeout(() => {
    el.classList.remove("is-on");
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

function setTape(mode, meta = {}) {
  $$("[data-tape]").forEach((el) => {
    el.hidden = el.dataset.tape !== mode;
  });
  if (mode === "detected") {
    $("[data-pui-song]").textContent = meta.song || "";
    $("[data-pui-artist]").textContent = meta.artist || "";
  }
  if (mode === "idle") {
    $("[data-pui-device]")?.classList.remove("is-listening");
  } else {
    $("[data-pui-device]")?.classList.add("is-listening");
  }
}

function setRadio(on, meta = {}) {
  const bar = $("[data-pui-radio-bar]");
  bar.hidden = !on;
  if (on) {
    $("[data-pui-radio-station]").textContent = meta.station || state.station;
    $("[data-pui-radio-artist]").textContent = meta.artist || "";
    $("[data-pui-radio-song]").textContent = meta.song || "";
  }
  $("[data-pui-station-stop]").hidden = !on;
}

function startGhost() {
  const ghost = $("[data-pui-search-ghost]");
  const input = $("[data-pui-search-input]");
  let gi = 0;
  let ci = 0;
  let deleting = false;
  ghost.classList.add("is-typing");

  const step = () => {
    if (input.value) {
      ghost.classList.add("is-hidden");
      setTimeout(step, 400);
      return;
    }
    ghost.classList.remove("is-hidden");
    const phrase = ghosts[gi];
    if (!deleting) {
      ci++;
      ghost.textContent = phrase.slice(0, ci);
      if (ci >= phrase.length) {
        deleting = true;
        setTimeout(step, 1500);
        return;
      }
      setTimeout(step, 40 + Math.random() * 35);
    } else {
      ci--;
      ghost.textContent = phrase.slice(0, Math.max(0, ci));
      if (ci <= 0) {
        deleting = false;
        gi = (gi + 1) % ghosts.length;
        setTimeout(step, 280);
        return;
      }
      setTimeout(step, 22);
    }
  };
  step();
  input.addEventListener("input", () => ghost.classList.toggle("is-hidden", Boolean(input.value)));
}

function ensureAudio() {
  if (state.audioCtx) return state.audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  state.audioCtx = new Ctx();
  state.analyser = state.audioCtx.createAnalyser();
  state.analyser.fftSize = 512;
  state.analyser.smoothingTimeConstant = 0.8;
  state.data = new Uint8Array(state.analyser.frequencyBinCount);
  return state.audioCtx;
}

function stopAudioGraph() {
  for (const n of state.demoNodes) {
    try {
      n.stop?.();
      n.disconnect?.();
    } catch {
      /* ignore */
    }
  }
  state.demoNodes = [];
  if (state.demoAudio) {
    try {
      state.demoAudio.pause();
      state.demoAudio.src = "";
    } catch {
      /* ignore */
    }
    state.demoAudio = null;
  }
  try {
    state.sourceNode?.disconnect();
  } catch {
    /* ignore */
  }
  state.sourceNode = null;
  if (state.micStream) {
    state.micStream.getTracks().forEach((t) => t.stop());
    state.micStream = null;
  }
}

function startMeter() {
  cancelAnimationFrame(state.rafMeter);
  const loop = () => {
    state.rafMeter = requestAnimationFrame(loop);
    let energy = 0.05;
    if (state.listening && state.analyser && state.data) {
      state.analyser.getByteFrequencyData(state.data);
      let sum = 0;
      for (let i = 0; i < 32; i++) sum += state.data[i];
      energy = sum / (32 * 255);
      // wave bars
      $$("[data-pui-wave] i").forEach((el, i) => {
        const v = state.data[i * 4] / 255;
        el.style.height = `${2 + v * 10}px`;
      });
      const prog = $("[data-pui-progress]");
      if (prog) prog.style.width = `${20 + energy * 70}%`;
    }
    state.scene?.setAudioEnergy(energy);
  };
  loop();
}

async function startDemo() {
  stopAudioGraph();
  const ctx = ensureAudio();
  await ctx.resume();

  const audio = new Audio("audio/faded.mp3");
  audio.loop = true;
  audio.crossOrigin = "anonymous";
  state.demoAudio = audio;

  const src = ctx.createMediaElementSource(audio);
  src.connect(state.analyser);
  src.connect(ctx.destination);
  state.sourceNode = src;
  state.demoNodes = [src];

  try {
    await audio.play();
  } catch {
    toast("Tap Demo again to unlock audio");
    return;
  }

  state.listening = true;
  setTape("detected", FADED_META);
  setRadio(true, { ...FADED_META, station: "demo" });
  state.scene?.burstTrain();
  toast("Now playing — Faded · Alan Walker");
}

async function startMic() {
  stopAudioGraph();
  const ctx = ensureAudio();
  await ctx.resume();
  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false },
      video: false,
    });
  } catch {
    toast("Mic permission denied");
    clearSourceChips();
    return;
  }
  const src = ctx.createMediaStreamSource(state.micStream);
  src.connect(state.analyser);
  state.sourceNode = src;
  state.listening = true;
  setTape("listening");
  setRadio(true, { song: "Live Room", artist: "microphone", station: "mic" });
  $("[data-pui-micmode]").hidden = false;
  toast("Mic open — play something nearby");
}

function stopListening() {
  stopAudioGraph();
  state.listening = false;
  state.source = null;
  clearSourceChips();
  setTape("idle");
  setRadio(false);
  $("[data-pui-micmode]").hidden = true;
  state.scene?.setAudioEnergy(0);
  toast("Stopped");
}

function clearSourceChips() {
  $$(".pui-chip-src").forEach((b) => b.classList.remove("is-on"));
}

function openHowToGuide() {
  const guide = $("[data-pui-guide]");
  guide.hidden = false;
  guide.dataset.mode = "howto";
  $("[data-g2-title]").textContent = "how to use this app";
  $("[data-g2-body]").innerHTML = `
    <ol class="pui-guide-steps">
      <li><b>Drag</b> the scene to orbit the hero a full <b>360°</b>.</li>
      <li>Tap <b>demo</b> to play <b>Faded</b> by Alan Walker — lamps and the hero react.</li>
      <li>Tap <b>microphone</b> to react to music in your room.</li>
      <li>Pick a <b>station</b> for the vibe; trains pass on their own.</li>
      <li>Open <b>settings</b> for turntable spin, trains, and cursor look.</li>
    </ol>
  `;
  $("[data-g2-note]").textContent = "Tip: enable Turntable in settings for hands-free 360°.";
  $('[data-pui="guide-go"]').textContent = "got it";
}

function wireUI() {
  const guide = $("[data-pui-guide]");
  const settings = $("[data-pui-settings]");

  $$('[data-pui="src-spotify"], [data-pui="src-youtube"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      clearSourceChips();
      btn.classList.add("is-on");
      guide.hidden = false;
      guide.dataset.mode = "share";
      $("[data-g2-title]").textContent =
        btn.dataset.pui === "src-spotify" ? "share from spotify" : "share from youtube";
      $("[data-g2-body]").innerHTML =
        "This sample can’t hook Spotify/YouTube tab capture. Use <b>microphone</b> or <b>demo</b> — the hero still reacts in 3D.";
      $("[data-g2-note]").textContent = "On the real penguin.music site, Chrome’s share dialog appears here.";
      $('[data-pui="guide-go"]').textContent = "got it";
    });
  });

  $('[data-pui="guide-open"]')?.addEventListener("click", openHowToGuide);

  $('[data-pui="guide-go"]')?.addEventListener("click", () => {
    const mode = guide.dataset.mode || "howto";
    guide.hidden = true;
    localStorage.setItem(GUIDE_KEY, "1");
    if (mode === "share") {
      clearSourceChips();
      toast("Use microphone or demo in this sample");
    }
  });
  $('[data-pui="guide-back"]')?.addEventListener("click", () => {
    guide.hidden = true;
    localStorage.setItem(GUIDE_KEY, "1");
    if (guide.dataset.mode === "share") clearSourceChips();
  });

  $('[data-pui="src-speaker"]')?.addEventListener("click", async () => {
    clearSourceChips();
    $('[data-pui="src-speaker"]').classList.add("is-on");
    state.source = "mic";
    setTape("searching");
    await startMic();
  });

  $('[data-pui="src-demo"]')?.addEventListener("click", async () => {
    if (state.source === "demo" && state.listening) {
      stopListening();
      return;
    }
    clearSourceChips();
    $('[data-pui="src-demo"]').classList.add("is-on");
    state.source = "demo";
    setTape("searching");
    await startDemo();
  });

  $$('[data-pui="stop"]').forEach((b) => b.addEventListener("click", stopListening));

  $('[data-pui="radio-toggle"]')?.addEventListener("click", () => {
    if (!state.demoAudio || state.source !== "demo") return;
    if (state.demoAudio.paused) {
      state.demoAudio.play();
      $('[data-pui="radio-toggle"]').textContent = "❚❚";
    } else {
      state.demoAudio.pause();
      $('[data-pui="radio-toggle"]').textContent = "▶";
    }
  });

  $$('[data-pui="station"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      $$('[data-pui="station"]').forEach((b) => b.classList.remove("is-on"));
      btn.classList.add("is-on");
      state.station = btn.dataset.station;
      toast(`Station · ${btn.textContent}`);
      state.scene?.burstTrain();
      if (state.listening && state.source === "demo") {
        setRadio(true, { ...FADED_META, station: state.station });
        setTape("detected", FADED_META);
      } else if (state.listening) {
        const meta = stationMeta[state.station];
        setRadio(true, { ...meta, station: state.station });
        if ($('[data-tape="detected"]').hidden === false) setTape("detected", meta);
      }
    });
  });

  $('[data-pui="station-boiler"]')?.addEventListener("click", () => toast("boiler room — coming later"));

  const grid = $("[data-pui-stations-grid]");
  $('[data-pui="stations-left"]')?.addEventListener("click", () => grid.scrollBy({ left: -180, behavior: "smooth" }));
  $('[data-pui="stations-right"]')?.addEventListener("click", () => grid.scrollBy({ left: 180, behavior: "smooth" }));

  $('[data-pui="settings"]')?.addEventListener("click", () => {
    settings.hidden = false;
  });
  $('[data-pui="settings-close"]')?.addEventListener("click", () => {
    settings.hidden = true;
  });
  settings?.addEventListener("click", (e) => {
    if (e.target === settings) settings.hidden = true;
  });

  $("[data-train-toggle]")?.addEventListener("change", (e) => {
    state.scene?.setTrainsEnabled(e.target.checked);
  });
  $("[data-look-toggle]")?.addEventListener("change", (e) => {
    state.scene?.setLookEnabled(e.target.checked);
  });
  $("[data-turntable-toggle]")?.addEventListener("change", (e) => {
    state.scene?.setTurntable(e.target.checked);
    $('[data-pui="turntable-quick"]')?.classList.toggle("is-on", e.target.checked);
    toast(e.target.checked ? "Turntable on — full 360° spin" : "Turntable off — drag to orbit");
  });

  $('[data-pui="turntable-quick"]')?.addEventListener("click", () => {
    const box = $("[data-turntable-toggle]");
    if (!box) return;
    box.checked = !box.checked;
    box.dispatchEvent(new Event("change"));
  });

  $('[data-pui="reset-cam"]')?.addEventListener("click", () => {
    state.scene?.resetCamera();
    toast("Camera reset");
  });

  $('[data-pui="fullscreen"]')?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      toast("Fullscreen blocked");
    }
  });

  $('[data-pui="search-go"]')?.addEventListener("click", () => {
    const q = $("[data-pui-search-input]").value.trim();
    if (!q) {
      toast("Type a song, or use demo / mic");
      return;
    }
    setTape("searching");
    $("[data-pui-searching-for]").textContent = `finding “${q.slice(0, 28)}”`;
    setTimeout(() => {
      setTape("detected", { song: q, artist: "sample search" });
      setRadio(true, { song: q, artist: "sample search", station: state.station });
      toast("Sample only — no live catalogue here");
      state.scene?.burstTrain();
    }, 1200);
  });

  $("[data-pui-search-input]")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $('[data-pui="search-go"]').click();
  });

  $$('[data-pui="mic-speaker"], [data-pui="mic-live"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      $$('[data-pui="mic-speaker"], [data-pui="mic-live"]').forEach((b) => b.classList.remove("is-on"));
      btn.classList.add("is-on");
      toast(btn.dataset.pui === "mic-live" ? "Live instrument mode" : "External speaker mode");
    });
  });
}

async function main() {
  wireUI();
  startGhost();

  let progress = 0;
  const host = $("#scene-host");

  const scenePromise = createStationScene(host, {
    onProgress: (p) => {
      progress = p;
    },
  });

  // drive boot bar from shared progress
  const bar = $("[data-cover-bar]");
  const pct = $("[data-cover-pct]");
  const cover = $("#boot-cover");

  await new Promise((resolve) => {
    const tick = () => {
      const target = Math.max(progress * 100, 8);
      const cur = parseFloat(bar.style.width) || 0;
      const next = cur + Math.max(0.8, (target - cur) * 0.12) + (progress >= 1 ? 2 : 0.4);
      const shown = Math.min(progress >= 1 ? 100 : 97, next);
      bar.style.width = `${shown}%`;
      pct.textContent = `${Math.floor(shown)}%`;
      if (progress >= 1 && shown >= 100) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    scenePromise.then(() => {
      progress = 1;
    });
  });

  state.scene = await scenePromise;
  cover.classList.add("boot-cover-done");
  setTimeout(() => cover.remove(), 900);
  startMeter();
  toast("Drag for 360° — tap Guide anytime");
  if (!localStorage.getItem(GUIDE_KEY)) {
    setTimeout(openHowToGuide, 700);
  }
}

main().catch((err) => {
  console.error(err);
  toast("Scene failed to load — check console");
});

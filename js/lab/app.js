// Starship Flight Lab — main app.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { TRACKS, worldPos, forcesAt, phasesFor, CHAPTERS, shipEnd, paceAt, SRC, PAD_H, CATCH_ALT, R_EARTH } from "./flight.js";
import { createEnvironment, SUN_DIR } from "./env.js";
import { createPlume, createSmoke, padCloudParticles, trailParticles, burstParticles, createPlasma, createArrow, createPath, pathMaterials } from "./fx.js";
import { createBooster, createShip, createSite } from "./models.js";

const root = document.getElementById("lab");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = s => root.querySelector(s);
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------------------------------------------------------------- renderer */
const canvas = $(".fl-canvas");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
} catch (e) {
  root.classList.add("is-error");
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2e8);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 20; controls.maxDistance = 4e7;
controls.enablePan = false;
controls.autoRotateSpeed = 0.6;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.55, 0.96);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// The whole world hangs from a pivot at Earth's centre. Each frame the pivot turns so the
// vehicle being followed sits at the "top" of the planet: one consistent golden-hour sky,
// sun and reflections everywhere along the flight, and small numbers near the camera.
const EARTH_C = new THREE.Vector3(0, -R_EARTH, 0);
const pivot = new THREE.Group(); pivot.position.copy(EARTH_C); scene.add(pivot);
const world = new THREE.Group(); world.position.set(0, R_EARTH, 0); pivot.add(world);
const env = createEnvironment(scene, renderer, world);

/* ---------------------------------------------------------------- models */
const site = createSite();
world.add(site.group);
const booster = createBooster();
const ship = createShip();
world.add(booster.group, ship.group);
booster.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
ship.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
[booster.group, ship.group, site.group].forEach(g => g.traverse(o => {
  const m = o.material; if (!m || Array.isArray(m)) return;
  if (m.metalness > 0.6) { m.envMapIntensity = 1.15; m.roughness = Math.max(0.22, m.roughness * 0.85); }
}));
const B_LEN = booster.height || 72.3, S_LEN = ship.height || 52;

// engine plumes
function enginePositions(model, which) {
  if (which === "booster") return (model.engines?.positions || []).map(p => ({ x: p.x, z: p.z, ring: p.ring, vac: false }));
  const g = o => { const v = new THREE.Vector3(); o.updateMatrixWorld?.(true); v.copy(o.position); return v; };
  const sl = (model.engines?.sl || []).map(o => ({ ...pick(g(o)), ring: "c", vac: false }));
  const vac = (model.engines?.vac || []).map(o => ({ ...pick(g(o)), ring: "v", vac: true }));
  return sl.concat(vac);
}
const pick = v => ({ x: v.x, z: v.z });
const bEng = enginePositions(booster, "booster");
const sEng = enginePositions(ship, "ship");
const bPlumes = bEng.map((p, i) => { const m = createPlume({ seed: i }); m.position.set(p.x, 0, p.z); booster.group.add(m); return m; });
const bEnvelope = createPlume({ core: 0xffd9a8, edge: 0xff6a1e, seed: 99 });
booster.group.add(bEnvelope);
const sPlumes = sEng.map((p, i) => { const m = createPlume({ seed: 40 + i, core: p.vac ? 0xd9d6ff : 0xfff1dc, edge: p.vac ? 0x8a6bff : 0xff8a3a }); m.position.set(p.x, 0, p.z); ship.group.add(m); return m; });
// hot-staging vents: ship exhaust escaping sideways through the ring slots
const ringVents = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  const pivot = new THREE.Group();
  pivot.position.set(Math.cos(a) * 4.4, 71.4, Math.sin(a) * 4.4);
  pivot.rotation.y = -a;              // local +X now points radially outward
  const m = createPlume({ core: 0xfff0d0, edge: 0xff7a1a, seed: 70 + i });
  m.rotation.z = Math.PI / 2;         // plume's -Y axis → +X (outward)
  pivot.add(m); booster.group.add(pivot);
  return m;
});
const plasma = createPlasma();
ship.group.add(plasma);
world.add(plasma.wake);

/* ---------------------------------------------------------------- state */
const state = {
  chapter: "booster", profile: "splash", t: CHAPTERS.booster.t0, playing: false, speed: 1,
  cam: "follow", cutaway: false, path: false, arrows: true, lastUi: 0, details: false,
};
const shipTrack = () => TRACKS.ship[state.profile];
const chapterRange = () => state.chapter === "booster" ? [CHAPTERS.booster.t0, CHAPTERS.booster.t1] : [CHAPTERS.ship.t0, shipEnd(state.profile)];

/* ---------------------------------------------------------------- smoke */
const smokes = [];
function buildSmoke() {
  smokes.forEach(s => world.remove(s)); smokes.length = 0;
  const puff = env.puff;
  const padY = PAD_H * 0.25;
  const pad = createSmoke(puff, padCloudParticles(-3, 26, reduceMotion ? 300 : 1100), { tau: 5, rise: 1.6, opacity: 0.85 });
  pad.position.set(0, padY, 0); smokes.push(pad);
  // ascent exhaust column
  const P = new THREE.Vector3();
  const tail = t => { const s = TRACKS.booster.at(t); worldPos(s.x, s.alt, P); P.y -= 40; return P.clone(); };
  smokes.push(createSmoke(puff, trailParticles(4, 75, reduceMotion ? 200 : 700, tail, 26, 26, 160), { tau: 3, rise: 0.4, opacity: 0.55, lit: 0xfff0e2, shadow: 0xa9a4a3 }));
  // hot staging burst (left behind as the stack accelerates)
  const ring = t => { const s = TRACKS.booster.at(t); worldPos(s.x, s.alt, P); const th = (s.x * 1000) / R_EARTH, a = th + s.pitch * DEG; P.x += Math.sin(a) * 72; P.y += Math.cos(a) * 72; return P.clone(); };
  smokes.push(createSmoke(puff, trailParticles(159, 167, 220, ring, 22, 30, 40), { tau: 2, rise: 0, opacity: 0.6, lit: 0xffb27a, shadow: 0x4a3a33, glow: 0xff7a1a }));
  // booster landing burn hitting the mount
  smokes.push(createSmoke(puff, burstParticles(408, 423, 220, new THREE.Vector3(0, PAD_H, 0), 28, 4, 7, 5, 30), { tau: 4, rise: 1.0, opacity: 0.55 }));
  // ship landing: splashdown spray or tower-catch cloud
  const end = shipTrack().at(shipEnd(state.profile));
  const L = new THREE.Vector3(); worldPos(end.x, 0, L);
  const t1 = state.profile === "catch" ? 5826 : 3856;
  const land = createSmoke(puff, burstParticles(t1 - 14, t1 + 1, 320, new THREE.Vector3(), 30, 5, 8, 8, 40), { tau: 4, rise: 1, opacity: 0.75 });
  land.position.copy(L); if (state.profile === "catch") land.position.y = PAD_H;
  smokes.push(land);
  smokes.forEach(s => world.add(s));
}

/* ---------------------------------------------------------------- paths */
let paths = [];
function buildPaths() {
  paths.forEach(p => world.remove(p)); paths = [];
  const pts = (track, t0, t1, step) => { const out = []; for (let t = t0; t <= t1; t += step) { const s = track.at(t); const v = new THREE.Vector3(); worldPos(s.x, s.alt, v); out.push(v); } return out; };
  paths.push(createPath(pts(TRACKS.booster, 0, 423, 1), 0xe7b65a, 0.95));
  paths.push(createPath(pts(shipTrack(), 0, shipEnd(state.profile), 4), 0x7fd4c1, 0.95));
  paths.forEach(p => { p.visible = state.path; world.add(p); });
  pathMaterials.forEach(m => m.resolution.set(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight));
}

/* ---------------------------------------------------------------- force vectors */
// Colours are shared with the CSS tokens (--f-*) so the panel and the scene agree.
const ARROWS = {
  thrust: { name: "Thrust", color: 0xf2681c, css: "var(--f-thrust)" },
  weight: { name: "Gravity", color: 0x7c64e0, css: "var(--f-gravity)" },
  drag: { name: "Drag", color: 0x2f80ed, css: "var(--f-drag)" },
  lift: { name: "Lift", color: 0x0fa37f, css: "var(--f-lift)" },
  support: { name: "Pad reaction", color: 0xd8d2c6, css: "var(--f-support)" },
};
const arrowObjs = {};
const labelLayer = $(".fl-labels");
for (const k in ARROWS) {
  arrowObjs[k] = createArrow(ARROWS[k].color);
  scene.add(arrowObjs[k]);
  const el = document.createElement("div");
  el.className = "fl-flabel"; el.innerHTML = `<i style="background:${ARROWS[k].css}"></i><span class="n"></span><span class="v"></span>`;
  labelLayer.appendChild(el);
  ARROWS[k].el = el;
}
const fmtF = n => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)} MN` : `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)} kN`;
const forceLen = (F, L) => Math.min(L * 0.62, Math.sqrt(F / 1e6) * L * 0.075);

/* vehicle markers for the planet-scale Trajectory view */
const markers = ["booster", "ship"].map(k => {
  const el = document.createElement("div");
  el.className = "fl-marker"; el.innerHTML = `<i></i><span>${k === "booster" ? "Super Heavy" : "Starship"}</span>`;
  labelLayer.appendChild(el);
  return { k, el };
});
/* X-ray callouts */
const callouts = [];
function addCallout(obj, title, sub) {
  const el = document.createElement("div");
  el.className = "fl-callout"; el.innerHTML = `<b>${title}</b><span>${sub || ""}</span>`;
  labelLayer.appendChild(el);
  callouts.push({ obj, el, sub: el.querySelector("span") });
  return callouts[callouts.length - 1];
}
const C = {
  bLox: booster.tanks?.lox && addCallout(booster.tanks.lox, "Liquid oxygen", ""),
  bCh4: booster.tanks?.ch4 && addCallout(booster.tanks.ch4, "Liquid methane", ""),
  bDown: booster.tanks?.downcomer && addCallout(booster.tanks.downcomer, "Downcomer", "methane feed line"),
  bFins: booster.gridFins?.[0] && addCallout(booster.gridFins[0], "Grid fins", ""),
  bRing: booster.hotStageRing && addCallout(booster.hotStageRing, "Hot-stage ring", "vents ship exhaust"),
  sLox: ship.tanks?.lox && addCallout(ship.tanks.lox, "Liquid oxygen", ""),
  sCh4: ship.tanks?.ch4 && addCallout(ship.tanks.ch4, "Liquid methane", ""),
  sHdr: ship.tanks?.headerLox && addCallout(ship.tanks.headerLox, "Header tank", "landing reserve"),
  sFlap: ship.flaps?.fwdR && addCallout(ship.flaps.fwdR, "Forward flaps", ""),
  sShield: ship.heatShield && addCallout(ship.heatShield, "Heat shield", "~18,000 tiles"),
};

/* ---------------------------------------------------------------- UI */
let phases = phasesFor(state.profile);
const ui = {
  play: $(".fl-play"), restart: $(".fl-restart"), clock: $(".fl-t"), clockPhase: $(".fl-phase"), story: $(".fl-story"),
  range: $(".fl-range"), ticks: $(".fl-ticks"), fill: $(".fl-fill"), log: $(".fl-log-scroll"),
  ctx: $(".fl-ctx"), bars: $(".fl-bars"), netV: $(".fl-netv"), accel: $(".fl-accel"), verdicts: $(".fl-verdicts"), tele: $(".fl-tele"),
  massTotal: $(".fl-mass-total"), massProp: $(".fl-mass-prop"),
  step: $(".fl-step"), when: $(".fl-when"), title: $(".fl-title"), lede: $(".fl-lede"), points: $(".fl-points"), foot: $(".fl-foot"), math: $(".fl-math"),
  whyBtn: $(".fl-whybtn"), mathBtn: $(".fl-mathbtn"),
};
// force bars, built once
const BAR_ORDER = ["thrust", "weight", "drag", "lift", "support"];
ui.bars.innerHTML = BAR_ORDER.map(k => `<li data-k="${k}"><span class="n"><i style="background:${ARROWS[k].css}"></i><span class="lbl">${ARROWS[k].name}</span></span><span class="v mono">0</span><span class="bar"><b style="background:${ARROWS[k].css}"></b></span></li>`).join("");
const barEls = Object.fromEntries([...ui.bars.querySelectorAll("li")].map(li => [li.dataset.k, { li, v: li.querySelector(".v"), lbl: li.querySelector(".lbl"), bar: li.querySelector(".bar b") }]));
// telemetry, built once
const TELE = [["alt", "Altitude"], ["v", "Speed"], ["mach", "Mach"], ["x", "Downrange"], ["eng", "Engines"], ["prop", "Propellant"]];
ui.tele.innerHTML = TELE.map(([k, n]) => `<div><dt>${n}</dt><dd class="mono" data-k="${k}">—</dd></div>`).join("");
const teleEls = Object.fromEntries([...ui.tele.querySelectorAll("dd")].map(d => [d.dataset.k, d]));

// story-time integral for a pacing-proportional scrubber
let storyMap = null;
function buildStory() {
  const [t0, t1] = chapterRange();
  const step = 0.25, ts = [], ss = [];
  let s = 0;
  for (let t = t0; t <= t1 + 1e-6; t += step) { ts.push(t); ss.push(s); s += step / paceAt(state.chapter, t, state.profile); }
  storyMap = { t0, t1, step, ts, ss, total: ss[ss.length - 1] };
}
const tToStory = t => { const m = storyMap; const i = clamp(Math.round((t - m.t0) / m.step), 0, m.ss.length - 1); return m.ss[i]; };
function storyToT(s) {
  const m = storyMap; let lo = 0, hi = m.ss.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (m.ss[mid] <= s) lo = mid; else hi = mid; }
  const k = (s - m.ss[lo]) / Math.max(1e-6, m.ss[hi] - m.ss[lo]);
  return m.ts[lo] + k * (m.ts[hi] - m.ts[lo]);
}
const fmtClock = t => {
  const s = Math.abs(t), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return `T${t < 0 ? "−" : "+"}${h ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};
const fmtStory = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const CH_NAME = { booster: ["Super Heavy", "launch & catch"], ship: ["Starship", "space & back"] };
const chapterPhases = ch => phases.filter(p => p.chapter === ch);

// flight log: both chapters, every step jumps the mission there
function buildLog() {
  ui.log.innerHTML = ["booster", "ship"].map(ch => `
    <div class="fl-log-group" data-ch="${ch}">
      <button class="fl-log-head" data-ch="${ch}"><b>${CH_NAME[ch][0]}</b><span>${CH_NAME[ch][1]}</span></button>
      <ol class="fl-log-list">${chapterPhases(ch).map(p => `<li><button class="fl-log-item" data-ch="${ch}" data-t="${p.t}"><i></i><span>${p.label}</span><span class="t mono">${fmtClock(p.t)}</span></button></li>`).join("")}</ol>
    </div>`).join("");
  ui.log.querySelectorAll(".fl-log-head").forEach(b => b.addEventListener("click", () => { if (b.dataset.ch !== state.chapter) setChapter(b.dataset.ch); }));
  ui.log.querySelectorAll(".fl-log-item").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.ch !== state.chapter) setChapter(b.dataset.ch);
    setT(+b.dataset.t + 0.01);
  }));
  markLog();
}
function markLog() {
  ui.log.querySelectorAll(".fl-log-group").forEach(g => g.classList.toggle("is-active", g.dataset.ch === state.chapter));
  const cur = lastPhase;
  ui.log.querySelectorAll(".fl-log-item").forEach(b => {
    const mine = b.dataset.ch === state.chapter, t = +b.dataset.t;
    b.classList.toggle("is-current", mine && cur && t === cur.t);
    b.classList.toggle("is-past", mine && t < state.t && !(cur && t === cur.t));
    if (mine && cur && t === cur.t) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
  });
}
function buildTimeline() {
  buildStory();
  const ph = chapterPhases(state.chapter).filter(p => p.t >= storyMap.t0 && p.t <= storyMap.t1);
  ui.ticks.innerHTML = ph.map(p => `<i data-t="${p.t}" style="left:${(tToStory(p.t) / storyMap.total) * 100}%"></i>`).join("");
}

function setT(t) {
  const [t0, t1] = chapterRange();
  state.t = clamp(t, t0, t1);
}
function setPlaying(p) {
  state.playing = p;
  root.classList.toggle("is-playing", p);
  ui.play.setAttribute("aria-label", p ? "Pause" : "Play");
}
ui.play.addEventListener("click", () => {
  const [t0, t1] = chapterRange();
  if (!state.playing && state.t >= t1 - 0.01) state.t = t0;
  setPlaying(!state.playing);
});
ui.restart.addEventListener("click", () => { state.t = chapterRange()[0]; lastPhase = null; });
ui.range.addEventListener("input", () => { state.t = storyToT((ui.range.value / 1000) * storyMap.total); });
function pressGroup(sel, pick) {
  const btns = root.querySelectorAll(sel);
  btns.forEach(b => b.addEventListener("click", () => {
    btns.forEach(x => x.setAttribute("aria-pressed", x === b));
    pick(b);
  }));
}
pressGroup("[data-speed]", b => { state.speed = +b.dataset.speed; });
pressGroup("[data-cam]", b => { state.cam = b.dataset.cam; camBlend = 0; });
pressGroup("[data-profile]", b => {
  state.profile = b.dataset.profile;
  phases = phasesFor(state.profile);
  buildSmoke(); buildPaths(); buildLog();
  if (state.chapter === "ship") buildTimeline();
  lastPhase = null;
});
function setChapter(ch) {
  state.chapter = ch;
  buildTimeline();
  state.t = ch === "ship" ? 150 : CHAPTERS.booster.t0;
  lastPhase = null; camBlend = 0;
  markLog();
}
const toggle = (sel, key, after) => $(sel).addEventListener("click", e => {
  state[key] = !state[key]; e.currentTarget.setAttribute("aria-pressed", state[key]); after?.();
});
toggle(".fl-xray", "cutaway", () => { camBlend = 0; booster.setCutaway?.(state.cutaway); ship.setCutaway?.(state.cutaway); });
toggle(".fl-traj", "path", () => { paths.forEach(p => p.visible = state.path); camBlend = 0; });
toggle(".fl-vec", "arrows");
const expander = (btn, cls) => btn.addEventListener("click", () => {
  const on = btn.getAttribute("aria-expanded") !== "true";
  btn.setAttribute("aria-expanded", on); root.classList.toggle(cls, on);
});
expander(ui.whyBtn, "show-why");
expander(ui.mathBtn, "show-math");
root.addEventListener("keydown", e => {
  if (e.code === "Space" && !e.target.closest("button, input, a")) { e.preventDefault(); ui.play.click(); }
});

// uneven glow for the heat shield: hotter patches and cooler seams, so tiles never read as flat paint
function mottleTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#6a6a6a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 110, v = 150 + Math.random() * 105;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${v},${v},${v},.55)`); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 1.5;
  for (let y = 0; y < 512; y += 16) for (let x = (y / 16) % 2 ? 9 : 0; x < 512; x += 18) {
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; g.lineTo(x + 9 * Math.cos(a), y + 9 * Math.sin(a)); } g.closePath(); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 6); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* ---------------------------------------------------------------- choreography */
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), axis = new THREE.Vector3();
const bPos = new THREE.Vector3(), sPos = new THREE.Vector3();
const zAxis = new THREE.Vector3(0, 0, 1);
// yaw: spin about the vehicle's own axis first (catch pins face the arms), then pitch about Z.
function placeFromTrack(group, s, out, yaw = 0) {
  const th = worldPos(s.x, s.alt, out);
  group.position.copy(out);
  group.rotation.order = "ZYX";
  group.rotation.set(0, yaw, -(th + s.pitch * DEG));
  return th;
}
function velocityDir(track, t, out) {
  const a = track.at(t - 0.5), b = track.at(t + 0.5);
  worldPos(a.x, a.alt, tmpV); worldPos(b.x, b.alt, out);
  out.sub(tmpV); const L = out.length(); if (L < 1e-3) return out.set(0, 0, 0); return out.divideScalar(L);
}
function heatOf(s) {
  if (s.alt > 125 || s.v < 3000) return 0;
  const rho = Math.exp(-s.alt / 7.2);
  return clamp(rho * Math.pow(s.v / 26000, 3) / 6e-5, 0, 1);
}

function updateVehicles(t, time) {
  const sb = TRACKS.booster.at(t);
  const st = shipTrack().at(t);
  const stacked = t < 166;
  const thB = placeFromTrack(booster.group, sb, bPos, Math.PI / 2);
  if (stacked) {
    // ship rides on top of the booster until separation, then slides off its own track
    axis.set(0, 1, 0).applyQuaternion(booster.group.quaternion);
    sPos.copy(bPos).addScaledVector(axis, B_LEN + 0.3);
    if (t > 159) {
      const k = smooth(159, 166, t);
      const own = new THREE.Vector3(); placeFromTrack(ship.group, st, own);
      sPos.lerp(own, k * k);
    }
    ship.group.position.copy(sPos);
    ship.group.rotation.order = "ZYX";
    ship.group.rotation.set(0, 0, booster.group.rotation.z);
  } else {
    // full-reuse catch: yaw the ship during the final approach so its catch pins face the arms
    const yaw = state.profile === "catch" ? Math.PI / 2 * smooth(5810, 5822, t) : 0;
    placeFromTrack(ship.group, st, sPos, yaw);
  }
  // hide the booster on the ship chapter of the full-reuse profile once it's long gone
  booster.group.visible = !(state.chapter === "ship" && state.profile === "catch" && t > 1000);

  // propellant & frost
  const bFrac = sb.prop / TRACKS.booster.prop0, sFrac = st.prop / shipTrack().prop0;
  booster.setPropellant?.(bFrac, bFrac); ship.setPropellant?.(sFrac, sFrac);
  const fz = state.cutaway ? 0 : 1;
  booster.setFrost?.(fz * (t < 0 ? 1 : t < 160 ? 1 - t / 180 : 0));
  ship.setFrost?.(fz * (t < 0 ? 1 : t < 400 ? 1 - t / 400 : 0));

  // grid fins: locked on ascent, steering during descent
  const finAct = t > 228 && t < 419 ? 1 : 0;
  (booster.gridFins || []).forEach((f, i) => { f.rotation.x = finAct * 0.18 * Math.sin(time * 1.3 + i * 1.7); });
  // flaps
  let fwd = 0.45, aft = 0.45;
  const sc = shipTrack();
  const isReentry = st.eng === 0 && t > 2600 && st.alt < 140;
  if (isReentry) { fwd = 0.25 + 0.08 * Math.sin(time * 0.9); aft = 0.2 + 0.08 * Math.sin(time * 1.1 + 1); }
  if (st.eng > 0 && t > 2600) { fwd = 0.9; aft = 0.2; }        // flip: fold the forward flaps
  if (t < 600) { fwd = 0.75; aft = 0.75; }
  ship.setFlaps?.(fwd, aft);
  void sc;

  // tower: QD arm, carriage, chopsticks
  const shipCatch = state.profile === "catch" && state.chapter === "ship";
  site.setQD?.(clamp((t + 6) / 4, 0, 1));
  if (shipCatch && t > 1000) {
    site.setCarriage?.(PAD_H + 18.5 + 36.7 - 2.2);
    site.setArms?.(1 - smooth(5826, 5829, t));
  } else {
    site.setCarriage?.(t < 0 ? PAD_H + B_LEN + 20 : PAD_H + CATCH_ALT + 64.25 - 2.2);
    site.setArms?.(t < 0 ? 0.55 : 1 - smooth(419.5, 422.5, t));
  }
  (site.beacons || []).forEach((b, i) => { if (b.material) b.material.emissiveIntensity = 0.5 + 2.5 * (Math.sin(time * 2.6 + i) > 0.6 ? 1 : 0); });

  // ---- plumes ----
  const altB = sb.alt * 1000;
  const press = Math.exp(-altB / 7400);
  const expand = lerp(1.25, 5.5, 1 - press), diamonds = press;
  const bLit = new Set();
  bEng.forEach((p, i) => {
    const on = sb.eng >= 33 || (sb.eng >= 13 && p.ring !== "o") || (sb.eng >= 3 && p.ring === "c");
    if (on) bLit.add(i);
    const thr = stacked && t < 0 ? clamp((t + 3) / 3, 0, 1) : sb.thr;
    bPlumes[i].set(0.65, lerp(34, 80, 1 - press) * (0.55 + 0.45 * thr), on ? (0.6 + 0.4 * thr) : 0, expand, diamonds, time);
  });
  const clusterR = sb.eng >= 33 ? 4.6 : sb.eng >= 13 ? 3.0 : 1.5;
  bEnvelope.set(clusterR, lerp(120, 240, 1 - press) * (sb.eng >= 13 ? 1 : 0.6), sb.eng > 0 ? lerp(0.75, 0.3, 1 - press) * (sb.eng >= 13 ? 1 : 0.7) : 0, lerp(1.3, 3.2, 1 - press), 0, time);

  const vent = t >= 159 && t < 168 ? (t < 166 ? 1 : (168 - t) / 2) : 0;
  ringVents.forEach(m => m.set(1.1, 22 + 10 * Math.sin(time * 9 + m.id), vent * 0.9, 3.2, 0, time));
  const altS = st.alt * 1000, pS = Math.exp(-altS / 7400);
  sEng.forEach((p, i) => {
    let on = st.eng >= 6 || (st.eng >= 3 && !p.vac) || (st.eng >= 1 && i === 0);
    if (stacked && t < 159) on = false;
    const r = p.vac ? 1.15 : 0.65;
    sPlumes[i].set(r, p.vac ? lerp(30, 90, 1 - pS) : lerp(16, 70, 1 - pS), on ? (stacked ? 0.9 : 0.8) : 0, p.vac ? lerp(1.4, 4, 1 - pS) : lerp(1.25, 5.5, 1 - pS), pS, time);
  });

  // ---- reentry plasma ----
  const heat = heatOf(st);
  plasma.set(heat, time);
  // tiles glow orange-red as they approach ~1,400 °C
  const hsm = ship.heatShield?.material;
  if (hsm && hsm.emissive) {
    hsm.emissive.setRGB(1.0, 0.32, 0.12);
    if (!hsm.userData.glowMap) {
      hsm.userData.glowMap = mottleTexture();
      hsm.emissiveMap = hsm.userData.glowMap; hsm.needsUpdate = true;
    }
    hsm.emissive.setRGB(1.0, 0.42, 0.16);
    hsm.emissiveIntensity = THREE.MathUtils.smoothstep(heat, 0.15, 0.85) * 2.4;
  }
  if (heat > 0.01) {
    velocityDir(sc, t, tmpV2);
    plasma.wake.position.copy(sPos).addScaledVector(axis.set(0, 1, 0).applyQuaternion(ship.group.quaternion), 26);
    plasma.wake.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tmpV2.clone().negate());
    const wr = 9, wl = 320 * heat + 80;
    plasma.wake.scale.set(wr, wl, wr);
    plasma.layout(wr, wl);
  }

  // ocean patch for splashdown
  const endS = sc.at(shipEnd(state.profile));
  const L = new THREE.Vector3(); const thE = worldPos(endS.x, 0, L); L.y -= PAD_H + 0.5;
  env.placeOcean(L, thE);
  env.showOcean(state.profile === "splash" && state.chapter === "ship" && st.alt < 40 && t > 2000);
  return { sb, st, stacked, thB, heat };
}

/* ---------------------------------------------------------------- camera */
let camBlend = 0, snapCam = true;
const camTarget = new THREE.Vector3();
const lastTarget = new THREE.Vector3();
let lastFocus = null;
let lastCamPhase = "";
function focusInfo(t) {
  const ch = state.chapter;
  if (t < 166) return { group: booster.group, mid: (B_LEN + S_LEN) * 0.5, len: B_LEN + S_LEN, kind: "stack" };
  if (ch === "booster") return { group: booster.group, mid: B_LEN / 2, len: B_LEN, kind: "booster" };
  return { group: ship.group, mid: S_LEN / 2, len: S_LEN, kind: "ship" };
}
const fPos = new THREE.Vector3(), fQuat = new THREE.Quaternion();
function updateCamera(t, dt, info) {
  const f = focusInfo(t);
  // turn the world so the focused vehicle sits on top of the planet
  const ft = f.kind === "ship" ? shipTrack().at(t) : TRACKS.booster.at(t);
  const theta = (ft.x * 1000) / R_EARTH;
  pivot.rotation.z = theta;
  pivot.updateMatrixWorld(true);
  f.group.getWorldPosition(fPos); f.group.getWorldQuaternion(fQuat);
  f.wpos = fPos; f.wquat = fQuat;
  axis.set(0, 1, 0).applyQuaternion(fQuat);
  camTarget.copy(fPos).addScaledVector(axis, f.mid);
  // keep the camera's offset when the focus jumps between vehicles
  if (lastFocus !== f.group) { lastTarget.copy(camTarget); lastFocus = f.group; camBlend = 0; }
  const camPhase = f.kind + (f.kind === "ship" && t > 2600 ? "-entry" : "");
  if (camPhase !== lastCamPhase) { lastCamPhase = camPhase; camBlend = 0; }
  const delta = tmpV.copy(camTarget).sub(lastTarget);
  camera.position.add(delta); controls.target.add(delta);
  lastTarget.copy(camTarget);
  // where the camera wants to be
  const up = tmpV2.copy(camTarget).sub(EARTH_C).normalize();
  let dist = f.len * 2.75, elev = 0.12, az = -0.35;
  if (f.kind === "ship" && t > 2600) { az = 1.15; elev = 0.05; }      // look at the belly and the shock layer
  if (state.cutaway && state.cam === "follow") dist *= 0.8;
  if (camera.aspect < 1) dist *= Math.min(2, 1 / Math.max(0.45, camera.aspect));   // portrait screens: pull back
  if (state.cam === "wide") { dist = f.len * 7; elev = 0.12; az = -0.6; }
  if (state.cam === "orbit") { dist = f.len * 2.6; elev = 0.25; }
  if (f.kind !== "stack" && info.sb.alt < 0.3 && state.chapter === "booster" && t > 380) { dist = Math.max(dist, 260); elev = 0.22; az = -0.75; }
  if (state.path) {
    if (state.chapter === "booster") { dist = 230000; elev = 0.18; az = -0.2; }
    else { dist = 2.4e7; elev = 1.05; az = 0.5; }
  }
  if (camBlend < 1) {
    camBlend = Math.min(1, camBlend + dt * 1.4);
    const k = 1 - Math.pow(1 - camBlend, 3);
    // build a desired position around the target in the local frame (east = +x, up = local vertical)
    const east = new THREE.Vector3(1, 0, 0).projectOnPlane(up).normalize();
    const north = new THREE.Vector3().crossVectors(east, up).normalize();
    const dir = east.clone().multiplyScalar(Math.cos(elev) * Math.sin(az)).addScaledVector(north, Math.cos(elev) * Math.cos(az)).addScaledVector(up, Math.sin(elev));
    const want = camTarget.clone().addScaledVector(dir, dist);
    const target = state.path && state.chapter === "ship" ? EARTH_C : camTarget;
    const kk = snapCam ? 1 : k * 0.35 + (camBlend >= 1 ? 1 : 0);
    snapCam = false;
    camera.position.lerp(want, kk);
    controls.target.lerp(target, kk);
  }
  camera.up.copy(up);
  controls.autoRotate = state.cam === "orbit" && !state.path;
  // keep the camera out of the ground near the pad
  const camAlt = camera.position.distanceTo(EARTH_C) - R_EARTH;
  if (camAlt < 3) camera.position.addScaledVector(up, 3 - camAlt);
  const d = camera.position.distanceTo(controls.target);
  camera.near = clamp(d * 0.01, 0.3, 5000); camera.far = 2e8; camera.updateProjectionMatrix();
  controls.update();
  return f;
}

/* ---------------------------------------------------------------- forces & panel */
let lastPhase = null;
const projV = new THREE.Vector3();
let placed = [];
function placeLabel(el, world, visible, avoid = false) {
  if (!visible) { el.style.display = "none"; return; }
  projV.copy(world).project(camera);
  if (projV.z > 1 || projV.z < -1) { el.style.display = "none"; return; }
  const w = canvas.clientWidth, h = canvas.clientHeight;
  let x = (projV.x * 0.5 + 0.5) * w, y = (-projV.y * 0.5 + 0.5) * h;
  if (avoid) {            // nudge force labels apart so they never stack on top of each other
    for (let k = 0; k < 6; k++) {
      const hit = placed.find(p => Math.abs(p.x - x) < 140 && Math.abs(p.y - y) < 38);
      if (!hit) break;
      y = hit.y + (y >= hit.y ? 40 : -40);
    }
    placed.push({ x, y });
  }
  el.style.display = "";
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function updateForces(t, f, info) {
  const kind = f.kind === "ship" ? "ship" : "booster";
  const track = kind === "ship" ? shipTrack() : TRACKS.booster;
  const F = forcesAt(kind, track, t, shipTrack());
  const origin = tmpV.copy(f.wpos).addScaledVector(axis.set(0, 1, 0).applyQuaternion(f.wquat), f.mid);
  const down = EARTH_C.clone().sub(origin).normalize();
  const vdir = velocityDir(track, t, new THREE.Vector3()).applyQuaternion(pivot.quaternion);
  const thrustDir = axis.clone();
  const dragDir = vdir.lengthSq() > 0 ? vdir.clone().negate() : thrustDir.clone();
  const liftDir = new THREE.Vector3().crossVectors(vdir, new THREE.Vector3(0, 0, 1)).normalize().negate();
  const L = f.len;
  const visArrows = state.arrows && !state.path;
  const vals = { weight: F.weight, thrust: F.thrust, drag: F.drag, lift: F.lift, support: F.support };
  const dirs = { weight: down, thrust: thrustDir, drag: dragDir, lift: liftDir, support: down.clone().negate() };
  const thick = L / 160;
  placed = [];
  for (const k in ARROWS) {
    const len = forceLen(vals[k], L);
    const show = visArrows && vals[k] > 1000 && len > 1;
    arrowObjs[k].setTo(origin, dirs[k], show ? len : 0, thick);
    ARROWS[k].el.querySelector(".n").textContent = k === "support" ? F.supportLabel : ARROWS[k].name;
    ARROWS[k].el.querySelector(".v").textContent = fmtF(vals[k]);
    placeLabel(ARROWS[k].el, tmpV2.copy(origin).addScaledVector(dirs[k], (show ? len : 0) + thick * 6), show, true);
  }
  // net force (vector sum)
  const net = new THREE.Vector3();
  for (const k in vals) net.addScaledVector(dirs[k], vals[k]);
  return { F, net: net.length(), vals };
}
const BAR_MAX = Math.sqrt(80);   // bars use a square-root scale; 80 MN fills the track
function updatePanel(t, f, info, forces) {
  const { F, vals } = forces;
  const s = F.s;
  for (const k of BAR_ORDER) {
    const el = barEls[k], v = vals[k];
    el.v.textContent = fmtF(v);
    el.li.classList.toggle("is-zero", v < 1000);
    el.bar.style.transform = `scaleX(${Math.min(1, Math.sqrt(v / 1e6) / BAR_MAX).toFixed(4)})`;
  }
  barEls.support.lbl.textContent = F.supportLabel;
  ui.netV.textContent = fmtF(forces.net);
  ui.accel.textContent = `${F.accelG.toFixed(2)} g`;
  ui.ctx.textContent = t < 0 ? "Held on the pad" : f.kind === "stack" ? (t >= 158 ? "Staging" : "Stacked ascent") :
    f.kind === "booster" ? (t >= 421 ? "Resting on the arms" : s.eng ? "Under power" : "Unpowered fall") :
    (info.heat > 0.05 ? "In the plasma" : s.eng ? "Under power" : s.alt < 0.01 ? "Down" : "Free fall");
  const track = f.kind === "ship" ? shipTrack() : TRACKS.booster;
  ui.massTotal.textContent = `${Math.round(F.mass / 1000).toLocaleString()} t on board`;
  ui.massProp.textContent = `${Math.round(s.prop / 1000).toLocaleString()} t propellant`;
  // verdicts
  const lift = t < 0 ? ["Clamped", "caution"] : F.twr > 1 ? ["Climbing", "good"] : s.eng ? ["Braking", "caution"] : ["Coasting", ""];
  const qk = F.q / 1000;
  const q = qk > 30 ? ["Near peak", "caution"] : qk > 1 ? ["Loaded", "good"] : ["Thin air", ""];
  const third = state.chapter === "booster"
    ? ["Catch", t >= 421 ? ["Secured", "good"] : t >= 396 ? ["Go", "good"] : ["Standby", ""], s.eng ? `${s.eng} of 33 lit` : "engines off"]
    : ["Heat shield", info.heat > 0.02 ? [`${Math.round(80 + 1320 * Math.sqrt(info.heat)).toLocaleString()} °C`, info.heat > 0.6 ? "alert" : "caution"] : ["Cool", ""], info.heat > 0.02 ? "tile surface" : `${s.eng} of 6 lit`];
  ui.verdicts.innerHTML = `
    <div class="fl-verdict"><span class="k">Thrust/weight</span><b class="${lift[1]}">${lift[0]}</b><span class="sub mono">${F.twr.toFixed(2)}</span></div>
    <div class="fl-verdict"><span class="k">Air load</span><b class="${q[1]}">${q[0]}</b><span class="sub mono">${qk.toFixed(qk < 10 ? 1 : 0)} kPa</span></div>
    <div class="fl-verdict"><span class="k">${third[0]}</span><b class="${third[1][1]}">${third[1][0]}</b><span class="sub mono">${third[2]}</span></div>`;
  teleEls.alt.textContent = s.alt < 1 ? `${Math.round(s.alt * 1000)} m` : `${s.alt.toFixed(s.alt < 10 ? 2 : 1)} km`;
  teleEls.v.textContent = `${Math.round(s.v).toLocaleString()} km/h`;
  teleEls.mach.textContent = F.mach.toFixed(F.mach < 10 ? 2 : 1);
  teleEls.x.textContent = `${Math.abs(s.x).toLocaleString(undefined, { maximumFractionDigits: s.x < 10 ? 1 : 0 })} km`;
  teleEls.eng.textContent = `${s.eng} / ${f.kind === "ship" ? 6 : 33}`;
  teleEls.prop.textContent = `${Math.round((s.prop / track.prop0) * 100)}%`;
  ui.math.innerHTML = `
    <div>W = m·g = ${Math.round(F.mass / 1000).toLocaleString()} t × ${F.g.toFixed(2)} m/s² = <b>${fmtF(F.weight)}</b></div>
    <div>T = Σ engines at ${(Math.exp(-s.alt / 7.4) * 101.3).toFixed(1)} kPa outside = <b>${fmtF(F.thrust)}</b></div>
    <div>D = ½ρv² · C<sub>d</sub>A = ${(F.q / 1000).toFixed(1)} kPa × C<sub>d</sub>A = <b>${fmtF(F.drag)}</b></div>
    <div>|ΣF| = <b>${fmtF(forces.net)}</b> → a = ΣF ÷ m ≈ <b>${F.accelG.toFixed(2)} g</b></div>`;
  // X-ray callout values
  if (C.bLox) C.bLox.sub.textContent = `${Math.round(TRACKS.booster.at(t).prop * 0.78 / 1000).toLocaleString()} t`;
  if (C.bCh4) C.bCh4.sub.textContent = `${Math.round(TRACKS.booster.at(t).prop * 0.22 / 1000).toLocaleString()} t`;
  if (C.bFins) C.bFins.sub.textContent = t > 228 && t < 419 ? "steering" : "locked";
  if (C.sLox) C.sLox.sub.textContent = `${Math.round(shipTrack().at(t).prop * 0.78 / 1000).toLocaleString()} t`;
  if (C.sCh4) C.sCh4.sub.textContent = `${Math.round(shipTrack().at(t).prop * 0.22 / 1000).toLocaleString()} t`;
  if (C.sFlap) C.sFlap.sub.textContent = info.heat > 0.02 ? "steering" : "neutral";
}
function updatePhase(t) {
  const list = chapterPhases(state.chapter);
  let cur = list[0], idx = 0;
  list.forEach((p, i) => { if (p.t <= t + 1e-6) { cur = p; idx = i; } });
  if (cur !== lastPhase) {
    lastPhase = cur;
    ui.step.textContent = `${CH_NAME[state.chapter][0]} · ${String(idx + 1).padStart(2, "0")} of ${String(list.length).padStart(2, "0")}`;
    ui.when.textContent = fmtClock(cur.t);
    ui.title.textContent = cur.title;
    ui.lede.textContent = cur.lede;
    ui.clockPhase.textContent = cur.label;
    ui.points.innerHTML = cur.bullets.map(([h, col, text, src]) => {
      const S = SRC[src];
      return `<li style="--dot:var(--${col === "plasma" ? "f-thrust" : col === "methane" ? "f-drag" : col === "ship" ? "f-lift" : col === "booster" ? "f-gravity" : "f-thrust"})"><b>${h}.</b>${text} ${S ? `<a href="${S[1]}" target="_blank" rel="noopener">${S[0]}</a>` : ""}</li>`;
    }).join("");
    ui.foot.innerHTML = cur.foot || "";
    ui.foot.hidden = !cur.foot;
  }
  markLog();
  ui.ticks.querySelectorAll("i").forEach(i => i.classList.toggle("is-past", +i.dataset.t <= t));
}

/* ---------------------------------------------------------------- loop */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  pathMaterials.forEach(m => m.resolution.set(w, h));
  // lift the optical centre above the transport bar so the vehicle isn't hidden behind it
  // on wide screens the explainer + transport float over the bottom of the scene
  const bottom = $(".fl-bottom");
  const d = getComputedStyle(bottom).position === "absolute" ? Math.round(bottom.offsetHeight * 0.55) : 0;
  camera.aspect = w / (h + d);
  camera.setViewOffset(w, h + d, 0, d, w, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

let prev = performance.now(), visible = true, needsRender = true;
const clock0 = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
  if (!visible) return;
  if (state.playing) {
    const [, t1] = chapterRange();
    state.t = Math.min(t1, state.t + dt * paceAt(state.chapter, state.t, state.profile) * state.speed);
    if (state.t >= t1) setPlaying(false);
  }
  renderScene(dt, (now - clock0) / 1000);
}
function renderScene(dt, time) {
  const t = state.t;
  const info = updateVehicles(t, time);
  smokes.forEach(s => s.setTime(t));
  const f = updateCamera(t, dt, info);
  env.update(camera, f.wpos, time, dt, world.localToWorld(tmpV2.set(0, 0, 0)));
  const forces = updateForces(t, f, info);
  // cutaway callouts
  const minor = new Set([C.bFins, C.sFlap, C.sShield, C.bRing]);
  for (const c of callouts) {
    const isB = booster.group.getObjectById(c.obj.id) != null;
    let show = state.cutaway && !state.path && ((isB && (f.kind !== "ship")) || (!isB && f.kind !== "booster"));
    if (f.kind === "stack" && minor.has(c)) show = false;
    if (show) { c.obj.getWorldPosition(tmpV); placeLabel(c.el, tmpV, true, true); } else placeLabel(c.el, tmpV, false);
  }
  for (const m of markers) {
    const g = m.k === "booster" ? booster.group : ship.group;
    const show = state.path && g.visible && !(m.k === "booster" && state.chapter === "ship" && t > 430) && !(m.k === "ship" && t < 166);
    if (show) { g.getWorldPosition(tmpV); placeLabel(m.el, tmpV, true); } else placeLabel(m.el, tmpV, false);
  }
  composer.render(dt);
  // UI at ~15 fps
  if (time - state.lastUi > 0.066 || !state.playing) {
    state.lastUi = time;
    updatePanel(t, f, info, forces);
    updatePhase(t);
    ui.clock.textContent = fmtClock(t);
    const sNow = tToStory(t);
    if (!ui.range.matches(":active")) ui.range.value = Math.round((sNow / storyMap.total) * 1000);
    ui.story.textContent = `${fmtStory(sNow)} / ${fmtStory(storyMap.total)}`;
    ui.fill.style.width = `${(sNow / storyMap.total) * 100}%`;
  }
}
function renderOnce() { needsRender = true; }
void needsRender;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; prev = performance.now(); }, { threshold: 0.01 }).observe(root);

/* ---------------------------------------------------------------- init */
buildSmoke(); buildPaths(); buildTimeline(); buildLog();
new ResizeObserver(() => resize()).observe($(".fl-bottom"));
camera.position.set(-120, 60, 210); controls.target.set(0, 70, 0);
resize();
renderScene(0, 0);
root.classList.add("is-ready");
requestAnimationFrame(frame);
void SUN_DIR;
// small hook for debugging from the console
window.__lab = { state, setT, setChapter };

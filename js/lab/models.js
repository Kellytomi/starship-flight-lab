// Starship Flight Lab — procedural models (Super Heavy booster, Starship, launch site).
// Independent educational visualisation; not affiliated with SpaceX.
//
// Conventions: 1 unit = 1 m, +Y up. Each vehicle's origin is the centre of its engine
// exit plane (y = 0), nose along +Y, belly (heat shield) along +X, flaps on the ±Z sides.
//
// three r160, no network textures (all CanvasTexture).

import * as THREE from "three";

const R = 4.5;                 // vehicle radius
const DEG = Math.PI / 180;
const RING_H = 1.83;           // height of one stainless ring section (weld spacing)
const TILE_PITCH = 0.30;       // heat-shield hex tile pitch (m)

// ───────────────────────────────────────────────────────────────────────────────
// Canvas textures
// ───────────────────────────────────────────────────────────────────────────────

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function canvasTex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _cache = {};

// Weld seams + staggered vertical panel seams + faint stringer lines. One texture repeat = 2 ring sections.
function weldBase() {
  if (_cache.weld) return _cache.weld;
  const S = 256;
  const c = makeCanvas(S, S), g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, S, S);
  // faint vertical stringer lines
  g.fillStyle = "rgba(0,0,0,0.035)";
  for (let x = 16; x < S; x += 32) g.fillRect(x, 0, 1, S);
  // subtle brushed shading (horizontal streaks)
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${(Math.random() * 0.035).toFixed(3)})`;
    g.fillRect(0, Math.random() * S, S, 1);
  }
  // vertical panel seams, staggered between the two rings
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(0, 0, 2, S / 2);
  g.fillRect(S / 2, S / 2, 2, S / 2);
  // weld rings
  g.fillStyle = "rgba(0,0,0,0.30)"; g.fillRect(0, 0, S, 3); g.fillRect(0, S / 2, S, 3);
  g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(0, 3, S, 1); g.fillRect(0, S / 2 + 3, S, 1);
  g.fillStyle = "rgba(0,0,0,0.10)"; g.fillRect(0, S - 2, S, 2); g.fillRect(0, S / 2 - 2, S, 2);

  // roughness map: base ≈0.36, welds and seams rougher
  const r = makeCanvas(S, S), rg = r.getContext("2d");
  rg.fillStyle = "rgb(92,92,92)"; rg.fillRect(0, 0, S, S);
  for (let i = 0; i < 300; i++) {
    rg.fillStyle = `rgba(255,255,255,${(Math.random() * 0.08).toFixed(3)})`;
    rg.fillRect(0, Math.random() * S, S, 1);
  }
  rg.fillStyle = "rgb(170,170,170)";
  rg.fillRect(0, 0, S, 4); rg.fillRect(0, S / 2, S, 4);
  rg.fillStyle = "rgb(140,140,140)";
  rg.fillRect(0, 0, 3, S / 2); rg.fillRect(S / 2, S / 2, 3, S / 2);

  _cache.weld = { map: canvasTex(c, true), rough: canvasTex(r, false) };
  return _cache.weld;
}

function weldTex(repeatX, repeatY) {
  const b = weldBase();
  const map = b.map.clone(); map.repeat.set(repeatX, repeatY); map.needsUpdate = true;
  const rough = b.rough.clone(); rough.repeat.set(repeatX, repeatY); rough.needsUpdate = true;
  return { map, rough };
}

// Hexagonal heat-shield tiles (pointy-top hex grid, seamless). One repeat = HEX_COLS tiles wide.
const HEX_COLS = 8, HEX_ROWS = 8, HEX_R = 36;
const HEX_W = Math.sqrt(3) * HEX_R;
const HEX_REPEAT_W = HEX_COLS * TILE_PITCH;                    // metres per repeat in u
const HEX_REPEAT_H = HEX_ROWS * 1.5 * HEX_R / HEX_W * TILE_PITCH; // metres per repeat in v

function hexBase() {
  if (_cache.hex) return _cache.hex;
  const W = Math.round(HEX_COLS * HEX_W), H = Math.round(HEX_ROWS * 1.5 * HEX_R);
  const c = makeCanvas(W, H), g = c.getContext("2d");
  const b = makeCanvas(W, H), bg = b.getContext("2d");
  g.fillStyle = "#05060a"; g.fillRect(0, 0, W, H);
  bg.fillStyle = "#303030"; bg.fillRect(0, 0, W, H);
  const hex = (ctx, cx, cy, r) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * 60 - 30) * DEG;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  // deterministic pseudo-random per tile
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let j = -1; j <= HEX_ROWS; j++) {
    for (let i = -1; i <= HEX_COLS; i++) {
      const cx = i * HEX_W + ((j & 1) ? HEX_W / 2 : 0) + HEX_W / 2;
      const cy = j * 1.5 * HEX_R + HEX_R;
      const v = 14 + rnd() * 9;
      g.fillStyle = `rgb(${v | 0},${(v + 2) | 0},${(v + 6) | 0})`;
      hex(g, cx, cy, HEX_R * 0.93); g.fill();
      // soft highlight toward the top of each tile
      const grad = g.createLinearGradient(cx, cy - HEX_R, cx, cy + HEX_R);
      grad.addColorStop(0, "rgba(255,255,255,0.05)");
      grad.addColorStop(1, "rgba(0,0,0,0.10)");
      g.fillStyle = grad; hex(g, cx, cy, HEX_R * 0.93); g.fill();
      bg.fillStyle = "#d0d0d0"; hex(bg, cx, cy, HEX_R * 0.93); bg.fill();
      bg.fillStyle = "#b0b0b0"; hex(bg, cx, cy, HEX_R * 0.75); bg.fill();
    }
  }
  _cache.hex = { map: canvasTex(c, true), bump: canvasTex(b, false) };
  return _cache.hex;
}

function hexTex(repeatX, repeatY) {
  const b = hexBase();
  const map = b.map.clone(); map.repeat.set(repeatX, repeatY); map.needsUpdate = true;
  const bump = b.bump.clone(); bump.repeat.set(repeatX, repeatY); bump.needsUpdate = true;
  return { map, bump };
}

function concreteTex() {
  if (_cache.concrete) return _cache.concrete;
  const S = 256;
  const c = makeCanvas(S, S), g = c.getContext("2d");
  g.fillStyle = "#8c8f94"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 6000; i++) {
    const v = 120 + Math.random() * 50;
    g.fillStyle = `rgba(${v},${v},${v + 3},0.35)`;
    g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }
  // expansion joints
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S);
  const t = canvasTex(c, true);
  _cache.concrete = t;
  return t;
}

// ───────────────────────────────────────────────────────────────────────────────
// Materials
// ───────────────────────────────────────────────────────────────────────────────

function steelMat(repeatX, repeatY) {
  const t = weldTex(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    color: 0xc9d0d8, metalness: 0.9, roughness: 1.0,
    map: t.map, roughnessMap: t.rough, envMapIntensity: 1.0,
  });
}
function plainSteel(color = 0xc9d0d8, roughness = 0.35) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness });
}
function tileMat(repeatX, repeatY, doubleSided = false) {
  const t = hexTex(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    color: 0xffffff, map: t.map, bumpMap: t.bump, bumpScale: 0.025,
    roughness: 0.8, metalness: 0.15, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
}
function darkMetal(color = 0x3b3f45) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.5 });
}
function bellMat() {
  return new THREE.MeshStandardMaterial({ color: 0x70757b, metalness: 0.92, roughness: 0.38, side: THREE.DoubleSide });
}
let _towerMat, _concreteMat, _beaconMat;
function towerMat() {
  return _towerMat || (_towerMat = new THREE.MeshStandardMaterial({ color: 0x2c3440, metalness: 0.6, roughness: 0.55 }));
}
function concreteMat() {
  if (_concreteMat) return _concreteMat;
  const t = concreteTex().clone(); t.repeat.set(40, 40); t.needsUpdate = true;
  return (_concreteMat = new THREE.MeshStandardMaterial({ color: 0x9a9da3, map: t, roughness: 0.95, metalness: 0.0 }));
}
function beaconMat() {
  return _beaconMat || (_beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff2a1a, emissive: 0xff2010, emissiveIntensity: 2.5, roughness: 0.4, metalness: 0,
  }));
}
function tankShellMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xdde3ea, metalness: 0.6, roughness: 0.35, transparent: true, opacity: 0.18,
    depthWrite: false, side: THREE.DoubleSide,
  });
}
function liquidMat(color) {
  // emissive is a slightly more saturated version of the colour so pale cryo liquids keep a tint under ACES
  const em = new THREE.Color(color).offsetHSL(0, 0.25, -0.12);
  return new THREE.MeshStandardMaterial({
    color, emissive: em, emissiveIntensity: 0.35, transparent: true, opacity: 0.6,
    depthWrite: false, roughness: 0.2, metalness: 0,
  });
}
function frostMat() {
  return new THREE.MeshStandardMaterial({
    color: 0xeaf5ff, roughness: 0.95, metalness: 0, transparent: true, opacity: 0, depthWrite: false,
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ───────────────────────────────────────────────────────────────────────────────

/** Rocket engine bell: Lathe profile, exit plane at y=0, throat/flange at y=h. */
function bellGeometry(rExit, rThroat, h, seg = 32) {
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = rThroat + (rExit - rThroat) * Math.pow(1 - t, 1.65);
    pts.push(new THREE.Vector2(r, t * h));
  }
  pts.push(new THREE.Vector2(rThroat * 1.3, h + 0.06));
  pts.push(new THREE.Vector2(rThroat * 1.3, h + 0.3));
  pts.push(new THREE.Vector2(rThroat * 0.9, h + 0.32));
  return new THREE.LatheGeometry(pts, seg);
}

/** Propellant tank: cylinder with elliptical domes. Bottom at y=0, top at y=h. */
function tankGeometry(r, h, domeB, domeT, seg = 48) {
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {           // bottom dome
    const a = (i / n) * Math.PI / 2;
    pts.push(new THREE.Vector2(r * Math.sin(a), domeB * (1 - Math.cos(a))));
  }
  for (let i = n; i >= 0; i--) {           // top dome
    const a = (i / n) * Math.PI / 2;
    pts.push(new THREE.Vector2(r * Math.sin(a), h - domeT * (1 - Math.cos(a))));
  }
  return new THREE.LatheGeometry(pts, seg);
}

/** Starship nose: tangent ogive profile, base radius R, length L. y measured from base. */
function ogiveRadius(y, Rb = R, L = 18) {
  const rho = (Rb * Rb + L * L) / (2 * L);
  const v = rho * rho - y * y;
  return Math.max(0, Math.sqrt(Math.max(0, v)) + Rb - rho);
}

/** Profile points for a cylinder (y0..yCyl) plus optional ogive nose (yCyl..yTip), ~uniform arc-length spacing. */
function hullProfile(y0, yCyl, yTip, step = 0.5) {
  const pts = [];
  for (let y = y0; y < yCyl - 1e-6; y += step) pts.push(new THREE.Vector2(R, y));
  pts.push(new THREE.Vector2(R, yCyl));
  if (yTip > yCyl) {
    const L = yTip - yCyl;
    // march along the ogive with roughly constant arc length
    let y = 0, prev = new THREE.Vector2(R, yCyl);
    while (y < L) {
      const dy = 0.1;
      let acc = 0;
      while (acc < step && y < L) {
        y += dy;
        const p = new THREE.Vector2(ogiveRadius(Math.min(y, L), R, L), yCyl + Math.min(y, L));
        acc += p.distanceTo(prev); prev = p;
      }
      pts.push(prev.clone());
    }
    const last = pts[pts.length - 1];
    if (last.x > 0.02) pts.push(new THREE.Vector2(0, yTip));
    else last.x = 0;
  }
  return pts;
}

function arcLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += pts[i].distanceTo(pts[i - 1]);
  return s;
}

/** Instanced-box truss builder. Each beam is a unit box scaled to (w, length, d) and aimed a→b. */
class Truss {
  constructor(material) { this.items = []; this.material = material; }
  beam(a, b, w, d = w) { this.items.push({ a: a.clone(), b: b.clone(), w, d }); return this; }
  build() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, this.material, this.items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(), mid = new THREE.Vector3(), s = new THREE.Vector3();
    this.items.forEach((it, i) => {
      dir.subVectors(it.b, it.a);
      const len = dir.length();
      dir.normalize();
      q.setFromUnitVectors(up, dir);
      mid.addVectors(it.a, it.b).multiplyScalar(0.5);
      s.set(it.w, len, it.d);
      m.compose(mid, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rT, rB, h, mat, x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Collect unique materials across meshes. */
function uniqueMaterials(meshes) {
  const set = new Set();
  meshes.forEach((m) => { if (m.material) set.add(m.material); });
  return [...set];
}

function makeCutaway(hull, internals) {
  const mats = uniqueMaterials(hull);
  return (on) => {
    mats.forEach((m) => {
      m.transparent = !!on;
      m.opacity = on ? 0.12 : 1.0;
      m.depthWrite = !on;
      m.needsUpdate = true;
    });
    hull.forEach((h) => { h.castShadow = !on; });
    internals.visible = !!on;
  };
}

/** Liquid column: unit cylinder scaled to (r, frac*h, r), bottom-anchored at y0. */
let _unitCyl;
function makeLiquid(r, y0, h, color) {
  _unitCyl = _unitCyl || new THREE.CylinderGeometry(1, 1, 1, 48, 1, false).translate(0, 0.5, 0);
  const m = new THREE.Mesh(_unitCyl, liquidMat(color));
  m.position.y = y0;
  m.scale.set(r, h, r);
  m.userData.h = h;
  m.renderOrder = 1;
  return m;
}
function setLevel(m, frac) {
  frac = Math.min(1, Math.max(0, frac || 0));
  m.visible = frac > 0.002;
  m.scale.y = Math.max(0.001, frac * m.userData.h);
}

function makeFrost(y0, y1, r = R + 0.05) {
  const geo = new THREE.CylinderGeometry(r, r, y1 - y0, 64, 1, true);
  const m = new THREE.Mesh(geo, frostMat());
  m.position.y = (y0 + y1) / 2;
  m.visible = false;
  m.renderOrder = 3;
  return m;
}
function frostSetter(mesh) {
  return (amount) => {
    amount = Math.min(1, Math.max(0, amount || 0));
    mesh.visible = amount > 0.005;
    mesh.material.opacity = amount * 0.55;
  };
}

/** Raptor engine as a group: bell + powerhead + pipes. Exit plane at y = 0. */
function makeEngine(rExit, rThroat, h, bellM, headM) {
  const g = new THREE.Group();
  const bell = new THREE.Mesh(bellGeometry(rExit, rThroat, h), bellM);
  bell.castShadow = true; bell.receiveShadow = true;
  g.add(bell);
  const head = cyl(0.42, 0.46, 1.1, headM, 0, h + 0.3 + 0.55, 0, 20);
  g.add(head);
  const pre = cyl(0.22, 0.22, 0.9, headM, 0.42, h + 0.75, 0.2, 12); pre.rotation.z = 0.25; g.add(pre);
  const pre2 = cyl(0.18, 0.18, 0.8, headM, -0.38, h + 0.7, -0.25, 12); pre2.rotation.z = -0.3; g.add(pre2);
  g.userData.bell = bell;
  return g;
}

// ───────────────────────────────────────────────────────────────────────────────
// Super Heavy booster
// ───────────────────────────────────────────────────────────────────────────────

export function createBooster() {
  const group = new THREE.Group();
  group.name = "SuperHeavy";
  const hull = [];

  const SKIRT_Y = 0.8;           // bottom lip of the aft skirt (bells protrude 0.8 m below)
  const BODY_TOP = 70.5;
  const HSR_TOP = 72.3;

  // Body (open ended so engines/thrust structure are visible from below)
  const bodyH = BODY_TOP - SKIRT_Y;
  const bodyMat = steelMat(4, bodyH / RING_H / 2);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, bodyH, 96, 1, true), bodyMat);
  body.position.y = SKIRT_Y + bodyH / 2;
  body.castShadow = true; body.receiveShadow = true;
  group.add(body); hull.push(body);

  // Skirt lip ring + a few stiffener rings
  const lipMat = plainSteel(0xb8c0c8, 0.4);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 8, 96), lipMat);
  lip.rotation.x = Math.PI / 2; lip.position.y = SKIRT_Y; group.add(lip); hull.push(lip);

  // Thrust structure (dark puck visible between the engine bells)
  const thrustMat = darkMetal(0x2a2d32);
  const puck = cyl(R - 0.05, R - 0.05, 0.5, thrustMat, 0, 3.9, 0, 64);
  group.add(puck);
  // engine mounting boss ring
  const boss = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.18, 8, 48), thrustMat);
  boss.rotation.x = Math.PI / 2; boss.position.y = 2.35; group.add(boss);

  // Engines: 33 Raptors (3 centre / 10 middle / 20 outer), instanced bells + powerheads
  const positions = [];
  const addRing = (n, r, ring, offset) => {
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * Math.PI * 2;
      positions.push({ x: r * Math.cos(a), z: r * Math.sin(a), ring });
    }
  };
  addRing(3, 1.2, "c", Math.PI / 2);
  addRing(10, 2.8, "m", 0);
  addRing(20, 3.98, "o", Math.PI / 20);
  const bellGeo = bellGeometry(0.62, 0.23, 1.8, 28);
  const bells = new THREE.InstancedMesh(bellGeo, bellMat(), 33);
  const headGeo = new THREE.CylinderGeometry(0.4, 0.44, 1.0, 16).translate(0, 1.8 + 0.3 + 0.5, 0);
  const heads = new THREE.InstancedMesh(headGeo, darkMetal(0x50555c), 33);
  const m = new THREE.Matrix4();
  positions.forEach((p, i) => {
    m.makeTranslation(p.x, 0, p.z);
    bells.setMatrixAt(i, m); heads.setMatrixAt(i, m);
  });
  bells.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  bells.castShadow = true; bells.receiveShadow = true; heads.castShadow = true;
  group.add(bells, heads);

  // Chines (4 aerodynamic fairings over COPVs, aft) and raceway (+X side)
  const chineMat = steelMat(1, 16 / RING_H / 2);
  const chineGeo = new THREE.CylinderGeometry(0.5, 0.6, 16, 14, 1, false, 0, Math.PI);
  [45, 135, 225, 315].forEach((deg) => {
    const a = deg * DEG;
    const holder = new THREE.Object3D();
    holder.position.set(R * Math.cos(a) - 0.18 * Math.cos(a), 11, R * Math.sin(a) - 0.18 * Math.sin(a));
    holder.rotation.y = -a;
    const chine = new THREE.Mesh(chineGeo, chineMat);   // half-cylinder bulges toward holder +X (outward)
    chine.castShadow = true; chine.receiveShadow = true;
    holder.add(chine); group.add(holder); hull.push(chine);
  });
  const raceMat = plainSteel(0xb5bcc4, 0.45);
  const raceway = box(0.28, 66, 0.6, raceMat, R + 0.08, 3 + 33, 0);
  group.add(raceway); hull.push(raceway);
  // small conduit clamps along the raceway
  for (let y = 6; y < 68; y += 6.2) { const c = box(0.4, 0.3, 0.8, raceMat, R + 0.1, y, 0); group.add(c); hull.push(c); }

  // Grid fins (4, y≈66, 45° offsets). Each pivot: local +X = radial (outward), rotate about pivot.rotation.x.
  const gridFins = [];
  const finMat = darkMetal(0x5b6066);
  const finFrameGeo = { x: new THREE.BoxGeometry(3.0, 0.6, 0.16), z: new THREE.BoxGeometry(0.16, 0.6, 4.2) };
  const vaneGeo = new THREE.BoxGeometry(1, 1, 1);
  [45, 135, 225, 315].forEach((deg) => {
    const a = deg * DEG;
    const pivot = new THREE.Object3D();
    pivot.position.set(R * Math.cos(a), 66, R * Math.sin(a));
    pivot.rotation.y = -a;
    const fin = new THREE.Group();
    const L = 3.2, W = 4.2, T = 0.6, X0 = 0.35;
    // frame
    const fz1 = new THREE.Mesh(finFrameGeo.x, finMat); fz1.position.set(X0 + 1.5, 0, W / 2);
    const fz2 = new THREE.Mesh(finFrameGeo.x, finMat); fz2.position.set(X0 + 1.5, 0, -W / 2);
    const fx1 = new THREE.Mesh(finFrameGeo.z, finMat); fx1.position.set(L + 0.1, 0, 0);
    const fx2 = new THREE.Mesh(finFrameGeo.z, finMat); fx2.position.set(X0, 0, 0);
    [fz1, fz2, fx1, fx2].forEach((f) => { f.castShadow = true; fin.add(f); });
    // lattice vanes (instanced): 7 spanwise + 5 chordwise
    const nZ = 7, nX = 5;
    const vanes = new THREE.InstancedMesh(vaneGeo, finMat, nZ + nX);
    const mm = new THREE.Matrix4();
    let k = 0;
    for (let i = 1; i <= nZ; i++) {
      const z = -W / 2 + (i / (nZ + 1)) * W;
      mm.compose(V3(X0 + (L - X0 + 0.1) / 2, 0, z), new THREE.Quaternion(), V3(L - X0 + 0.1, T, 0.08));
      vanes.setMatrixAt(k++, mm);
    }
    for (let i = 1; i <= nX; i++) {
      const x = X0 + (i / (nX + 1)) * (L - X0);
      mm.compose(V3(x, 0, 0), new THREE.Quaternion(), V3(0.08, T, W));
      vanes.setMatrixAt(k++, mm);
    }
    vanes.instanceMatrix.needsUpdate = true; vanes.castShadow = true;
    fin.add(vanes);
    // shaft / actuator hub
    const hub = cyl(0.32, 0.32, 1.1, finMat, 0.1, 0, 0, 16); hub.rotation.z = Math.PI / 2; fin.add(hub);
    pivot.add(fin);
    // fixed actuator housing on the body (not rotating)
    const housing = box(0.9, 1.4, 1.6, finMat, 0.15, 0, 0);
    const hHolder = new THREE.Object3D(); hHolder.position.copy(pivot.position); hHolder.rotation.y = -a; hHolder.add(housing);
    group.add(hHolder);
    group.add(pivot);
    gridFins.push(pivot);
  });

  // Catch pins (hard points the chopsticks support), ±Z just below the grid fins
  const pinMat = darkMetal(0x6a6f76);
  [1, -1].forEach((s) => {
    const pin = box(0.9, 0.7, 0.9, pinMat, 0, 64.6, s * (R + 0.3));
    group.add(pin);
    const gusset = box(1.4, 1.6, 0.5, pinMat, 0, 64.6, s * (R + 0.05)); group.add(gusset);
  });

  // Hot-stage ring: two flanges, 20 vent slots (instanced curved posts), domed shield inside
  const hotStageRing = new THREE.Group();
  hotStageRing.name = "HotStageRing";
  const hsrMat = darkMetal(0x5c6168);
  const flangeGeo = new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.28, 96, 1, false);
  const f1 = new THREE.Mesh(flangeGeo, hsrMat); f1.position.y = BODY_TOP + 0.14;
  const f2 = new THREE.Mesh(flangeGeo, hsrMat); f2.position.y = HSR_TOP - 0.14;
  f1.castShadow = f2.castShadow = true;
  hotStageRing.add(f1, f2);
  const nSlots = 20;
  const postGeo = new THREE.CylinderGeometry(R + 0.02, R + 0.02, HSR_TOP - BODY_TOP - 0.56, 6, 1, true, 0, (Math.PI * 2 / nSlots) * 0.55);
  const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x5c6168, metalness: 0.85, roughness: 0.5, side: THREE.DoubleSide }), nSlots);
  const pm = new THREE.Matrix4(), pq = new THREE.Quaternion();
  for (let i = 0; i < nSlots; i++) {
    pq.setFromAxisAngle(V3(0, 1, 0), (i / nSlots) * Math.PI * 2);
    pm.compose(V3(0, (BODY_TOP + HSR_TOP) / 2, 0), pq, V3(1, 1, 1));
    posts.setMatrixAt(i, pm);
  }
  posts.instanceMatrix.needsUpdate = true; posts.castShadow = true;
  hotStageRing.add(posts);
  // blast shield dome inside the ring
  const domePts = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; domePts.push(new THREE.Vector2(4.3 * Math.cos(a), BODY_TOP + 0.1 + 1.1 * Math.sin(a))); }
  const dome = new THREE.Mesh(new THREE.LatheGeometry(domePts, 48), new THREE.MeshStandardMaterial({ color: 0x3a3e45, metalness: 0.8, roughness: 0.55, side: THREE.DoubleSide }));
  dome.castShadow = true; dome.receiveShadow = true;
  hotStageRing.add(dome);
  group.add(hotStageRing);

  // Internals (visible in cutaway): tanks, liquids, downcomer
  const internals = new THREE.Group();
  internals.visible = false;
  const shell = tankShellMat();
  const loxY0 = 4, loxY1 = 43, ch4Y0 = 44, ch4Y1 = 68;
  const lox = new THREE.Mesh(tankGeometry(R - 0.25, loxY1 - loxY0, 1.8, 1.8), shell);
  lox.position.y = loxY0; lox.renderOrder = 2;
  const ch4 = new THREE.Mesh(tankGeometry(R - 0.25, ch4Y1 - ch4Y0, 0.3, 1.8), shell);
  ch4.position.y = ch4Y0; ch4.renderOrder = 2;
  const downcomer = cyl(0.75, 0.75, ch4Y0 + 0.5 - 2.8, darkMetal(0x8a9099), 0, (ch4Y0 + 0.5 + 2.8) / 2, 0, 24);
  const loxLiquid = makeLiquid(R - 0.3, loxY0 + 0.4, loxY1 - loxY0 - 0.8, 0xa8f0ff);
  const ch4Liquid = makeLiquid(R - 0.3, ch4Y0 + 0.2, ch4Y1 - ch4Y0 - 0.8, 0x45b8ff);
  // a few internal ring stringers / slosh baffles for depth
  const baffleMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.45, side: THREE.DoubleSide });
  for (let y = 10; y < 40; y += 10) { const b = new THREE.Mesh(new THREE.RingGeometry(3.4, R - 0.3, 48), baffleMat); b.rotation.x = -Math.PI / 2; b.position.y = y; internals.add(b); }
  internals.add(lox, ch4, downcomer, loxLiquid, ch4Liquid);
  group.add(internals);

  const frost = makeFrost(loxY0, ch4Y1);
  group.add(frost);

  const setCutaway = makeCutaway(hull, internals);

  return {
    group,
    height: HSR_TOP,
    engines: { mesh: bells, powerheads: heads, positions },
    gridFins,
    hotStageRing,
    hull,
    tanks: { lox, ch4, downcomer },
    setCutaway,
    setPropellant(loxFrac, ch4Frac) { setLevel(loxLiquid, loxFrac); setLevel(ch4Liquid, ch4Frac); },
    setFrost: frostSetter(frost),
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Starship (upper stage)
// ───────────────────────────────────────────────────────────────────────────────

/** Flap: extruded trapezoid (steel) with hex-tile overlay on the +X (belly) face.
 *  Shape coords: x = outward span from hinge line (positive = away from body), y = along body from hinge.
 *  Returned mesh group is oriented so shape-x → ±Z (per `sign`), shape-y → +Y, thickness along X. */
function makeFlap(points, thickness, sign, tileM, steelM) {
  const shp = new THREE.Shape(points.map((p) => new THREE.Vector2(p[0] * sign, p[1])));
  const geo = new THREE.ExtrudeGeometry(shp, { depth: thickness, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(-Math.PI / 2);                   // shape x → +Z, extrude z → -X
  const steel = new THREE.Mesh(geo, steelM);
  steel.castShadow = true; steel.receiveShadow = true;

  const overlay = new THREE.ShapeGeometry(shp, 6);
  overlay.translate(0, 0, -(thickness / 2 + 0.08));
  overlay.rotateY(-Math.PI / 2);               // ends up on +X face
  const tiles = new THREE.Mesh(overlay, tileM);
  tiles.castShadow = false; tiles.receiveShadow = true;

  const g = new THREE.Group();
  g.add(steel, tiles);
  return g;
}

export function createShip() {
  const group = new THREE.Group();
  group.name = "Starship";
  const hull = [];

  const SKIRT_Y = 0.5, CYL_TOP = 34, TIP = 52;

  // Hull: lathe (cylinder + ogive nose)
  const prof = hullProfile(SKIRT_Y, CYL_TOP, TIP, 0.5);
  const arc = arcLength(prof);
  const hullMat = steelMat(4, arc / RING_H / 2);
  const hullMesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), hullMat);
  hullMesh.castShadow = true; hullMesh.receiveShadow = true;
  group.add(hullMesh); hull.push(hullMesh);

  // Heat shield: +X half, tiles wrap 180° around the belly and up the nose
  const shieldProf = prof.map((p) => new THREE.Vector2(p.x > 0.05 ? p.x + 0.05 : 0, p.y));
  const shieldMat = tileMat((Math.PI * R) / HEX_REPEAT_W, arc / HEX_REPEAT_H);
  const heatShield = new THREE.Mesh(new THREE.LatheGeometry(shieldProf, 64, 0, Math.PI), shieldMat);
  heatShield.name = "HeatShield";
  heatShield.castShadow = true; heatShield.receiveShadow = true;
  group.add(heatShield); hull.push(heatShield);

  // Skirt lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R, 0.08, 8, 96), plainSteel(0xb8c0c8, 0.4));
  lip.rotation.x = Math.PI / 2; lip.position.y = SKIRT_Y; group.add(lip); hull.push(lip);

  // Thrust structure
  const thrustMat = darkMetal(0x2a2d32);
  const puck = cyl(R - 0.05, R - 0.05, 0.4, thrustMat, 0, 3.0, 0, 64);
  group.add(puck);

  // Engines: 3 sea-level (centre, r=1.3) + 3 vacuum (outer, r=3.0)
  const bellM = bellMat(), headM = darkMetal(0x50555c);
  const sl = [], vac = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
    const e = makeEngine(0.65, 0.23, 1.8, bellM, headM);
    e.position.set(1.3 * Math.cos(a), 0, 1.3 * Math.sin(a));
    e.name = "RaptorSL" + i;
    group.add(e); sl.push(e);
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + Math.PI / 3 + (i / 3) * Math.PI * 2;
    const e = makeEngine(1.15, 0.25, 3.5, bellM, headM);
    e.position.set(3.0 * Math.cos(a), 0, 3.0 * Math.sin(a));
    e.name = "RaptorVac" + i;
    group.add(e); vac.push(e);
  }

  // Flaps. Hinge pivots on the ±Z sides at x = 0 (belly/leeward boundary). Rotation about Y.
  const flapSteel = plainSteel(0xc9d0d8, 0.36);
  const flapTiles = tileMat(1 / HEX_REPEAT_W, 1 / HEX_REPEAT_H, true);
  const aftShape = [[-1.2, 0], [4.6, 0.9], [4.6, 7.6], [2.2, 11.6], [-1.2, 12.0]];
  const fwdShape = [[-1.4, 0], [2.8, 0.4], [2.8, 4.4], [0.2, 7.6], [-1.4, 8.0]];
  const flaps = {};
  const mkFlap = (name, shape, thick, y0, zHinge, sign) => {
    const pivot = new THREE.Object3D();
    pivot.name = name;
    pivot.position.set(0, y0, sign * zHinge);
    pivot.add(makeFlap(shape, thick, sign, flapTiles, flapSteel));
    group.add(pivot);
    flaps[name] = pivot;
  };
  mkFlap("aftL", aftShape, 0.6, 2.0, R, +1);
  mkFlap("aftR", aftShape, 0.6, 2.0, R, -1);
  mkFlap("fwdL", fwdShape, 0.45, 38.0, 3.4, +1);
  mkFlap("fwdR", fwdShape, 0.45, 38.0, 3.4, -1);

  // Hinge aerocovers (fixed fairings along the hinge lines)
  const coverMat = plainSteel(0xb5bcc4, 0.45);
  [+1, -1].forEach((s) => {
    const aft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 12.2, 12, 1, false, 0, Math.PI), coverMat);
    aft.position.set(0.1, 8.1, s * (R - 0.1)); aft.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    aft.castShadow = true; group.add(aft); hull.push(aft);
    const fwd = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 8.2, 12, 1, false, 0, Math.PI), coverMat);
    fwd.position.set(0.1, 42.0, s * 3.2); fwd.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    fwd.castShadow = true; group.add(fwd); hull.push(fwd);
  });

  // Catch pins just below the forward flaps (±Z, y≈37)
  const pinMat = darkMetal(0x6a6f76);
  const rPin = ogiveRadius(37 - CYL_TOP);
  [+1, -1].forEach((s) => {
    const pin = cyl(0.3, 0.34, 1.0, pinMat, 0, 37, s * (rPin + 0.25), 16);
    pin.rotation.x = Math.PI / 2;
    group.add(pin);
  });

  // Payload ("pez") door on the leeward (-X) side, y≈36
  const doorY0 = 35.0, doorY1 = 37.6, doorW = 1.5; // radians of arc
  const doorProf = [];
  for (let y = doorY0; y <= doorY1 + 1e-6; y += 0.4) doorProf.push(new THREE.Vector2(ogiveRadius(y - CYL_TOP) + 0.07, y));
  const payloadDoor = new THREE.Mesh(new THREE.LatheGeometry(doorProf, 24, -Math.PI / 2 - doorW / 2, doorW), plainSteel(0xbfc6ce, 0.42));
  payloadDoor.name = "PayloadDoor";
  payloadDoor.castShadow = true; payloadDoor.receiveShadow = true;
  const frameProf = [];
  for (let y = doorY0 - 0.25; y <= doorY1 + 0.25 + 1e-6; y += 0.4) frameProf.push(new THREE.Vector2(ogiveRadius(y - CYL_TOP) + 0.045, y));
  const doorFrame = new THREE.Mesh(new THREE.LatheGeometry(frameProf, 24, -Math.PI / 2 - doorW / 2 - 0.05, doorW + 0.1), darkMetal(0x1c1f24));
  group.add(doorFrame, payloadDoor); hull.push(payloadDoor, doorFrame);

  // Nose tip cap + a couple of RCS pods for detail
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), plainSteel(0xd8dde3, 0.3));
  tip.position.y = TIP - 0.2; group.add(tip); hull.push(tip);

  // Internals
  const internals = new THREE.Group();
  internals.visible = false;
  const shell = tankShellMat();
  const lox = new THREE.Mesh(tankGeometry(R - 0.25, 15, 1.5, 1.5), shell); lox.position.y = 3; lox.renderOrder = 2;
  const ch4 = new THREE.Mesh(tankGeometry(R - 0.25, 14, 0.3, 1.6), shell); ch4.position.y = 18.2; ch4.renderOrder = 2;
  const headerLox = new THREE.Mesh(new THREE.SphereGeometry(1.55, 32, 24), shell); headerLox.position.y = 43; headerLox.renderOrder = 2;
  const headerCh4 = new THREE.Mesh(tankGeometry(2.1, 1.8, 0.4, 0.4, 32), shell); headerCh4.position.y = 18.4; headerCh4.renderOrder = 2;
  const pipeMat = darkMetal(0x8a9099);
  const downcomer = cyl(0.45, 0.45, 16, pipeMat, 0, 2.9 + 8, 0, 16);           // CH4 downcomer through LOX tank
  const headerLine = cyl(0.18, 0.18, 10.5, pipeMat, 1.2, 32 + 5.25, 0, 10);     // header LOX feed line down the nose
  const loxLiquid = makeLiquid(R - 0.3, 3.4, 14.2, 0xa8f0ff);
  const ch4Liquid = makeLiquid(R - 0.3, 18.4, 13.2, 0x45b8ff);
  internals.add(lox, ch4, headerLox, headerCh4, downcomer, headerLine, loxLiquid, ch4Liquid);
  group.add(internals);

  const frost = makeFrost(3, 32);
  group.add(frost);

  const setCutaway = makeCutaway(hull, internals);

  const MAX_FLAP = 70 * DEG;
  function setFlaps(fwd, aft) {
    fwd = Math.min(1, Math.max(0, fwd || 0));
    aft = Math.min(1, Math.max(0, aft || 0));
    // +Z (L) flaps fold toward -X with negative rotation.y; -Z (R) flaps with positive rotation.y
    flaps.fwdL.rotation.y = -fwd * MAX_FLAP;
    flaps.fwdR.rotation.y = +fwd * MAX_FLAP;
    flaps.aftL.rotation.y = -aft * MAX_FLAP;
    flaps.aftR.rotation.y = +aft * MAX_FLAP;
  }
  setFlaps(0, 0);

  return {
    group,
    height: TIP,
    engines: { sl, vac },
    flaps,
    setFlaps,
    hull,
    heatShield,
    tanks: { lox, ch4, headerLox, headerCh4 },
    payloadDoor,
    setCutaway,
    setPropellant(loxFrac, ch4Frac) { setLevel(loxLiquid, loxFrac); setLevel(ch4Liquid, ch4Frac); },
    setFrost: frostSetter(frost),
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Launch site: OLM, tower, chopsticks, QD arm, tank farm
// ───────────────────────────────────────────────────────────────────────────────

function buildChopstick(sign, mat) {
  // Local frame: hinge at origin, arm extends along +Z, outward = sign * X.
  const pivot = new THREE.Object3D();
  const L = 32, W = 2.8, C = 0.8;
  const xi = 0, xo = sign * (W - C / 2 - 0.4), xb = sign * (W / 2 - 0.2);
  const yt = 1.5, ybRoot = -6.0, ybTip = -1.6;
  const yb = (z) => ybRoot + (ybTip - ybRoot) * (z / L);
  const t = new Truss(mat);
  t.beam(V3(xi, yt, 0), V3(xi, yt, L), C, C);
  t.beam(V3(xo, yt, 0), V3(xo, yt, L), C, C);
  t.beam(V3(xb, ybRoot, 0), V3(xb, ybTip, L), 0.9, 0.9);
  const n = 8;
  for (let k = 0; k <= n; k++) {
    const z = (k / n) * L, z2 = ((k + 1) / n) * L;
    t.beam(V3(xi, yt, z), V3(xb, yb(z), z), 0.4);
    t.beam(V3(xo, yt, z), V3(xb, yb(z), z), 0.4);
    t.beam(V3(xi, yt, z), V3(xo, yt, z), 0.4);
    if (k < n) {
      t.beam(V3(xi, yt, z), V3(xb, yb(z2), z2), 0.28);
      t.beam(V3(xo, yt, z), V3(xb, yb(z2), z2), 0.28);
      if (k % 2) t.beam(V3(xi, yt, z), V3(xo, yt, z2), 0.28);
      else t.beam(V3(xo, yt, z), V3(xi, yt, z2), 0.28);
    }
  }
  pivot.add(t.build());
  // top deck plate + rails + landing shuttle
  const deck = box(W, 0.25, L - 0.6, mat, (xi + xo) / 2, yt + C / 2 + 0.12, L / 2); pivot.add(deck);
  const railMat = plainSteel(0x8f98a3, 0.4);
  [xi + sign * 0.45, xo - sign * 0.45].forEach((x) => { pivot.add(box(0.3, 0.3, L - 2, railMat, x, yt + C / 2 + 0.4, L / 2)); });
  const shuttle = box(W - 0.5, 0.9, 6, darkMetal(0x4a515b), (xi + xo) / 2, yt + C / 2 + 0.25 + 0.45 + 0.1, 19.5);
  pivot.add(shuttle);
  const pad = box(W - 0.9, 0.3, 5.2, plainSteel(0x6c7480, 0.5), (xi + xo) / 2, yt + C / 2 + 0.25 + 0.9 + 0.2, 19.5); pivot.add(pad);
  // hinge collar + root block
  const collar = cyl(1.3, 1.3, 7.5, mat, 0, -1.2, 0, 24); pivot.add(collar);
  pivot.add(box(2.6, 8.4, 2.6, mat, xb, -2.0, 1.6));
  return pivot;
}

export function createSite() {
  const group = new THREE.Group();
  group.name = "LaunchSite";
  const beacons = [];
  const tMat = towerMat();
  const padHeight = 20;

  // Ground concrete apron
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), concreteMat());
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.02; ground.receiveShadow = true;
  group.add(ground);

  // ── Orbital launch mount
  const olm = new THREE.Group(); olm.name = "OLM";
  const olmMat = darkMetal(0x3f444c);
  const deckMat = darkMetal(0x4b5059);
  const tableShape = new THREE.Shape();
  tableShape.moveTo(-12, -12); tableShape.lineTo(12, -12); tableShape.lineTo(12, 12); tableShape.lineTo(-12, 12); tableShape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 6, 0, Math.PI * 2, true); tableShape.holes.push(hole);
  const tableGeo = new THREE.ExtrudeGeometry(tableShape, { depth: 6, bevelEnabled: false });
  tableGeo.rotateX(-Math.PI / 2); tableGeo.translate(0, padHeight - 6, 0);
  const table = new THREE.Mesh(tableGeo, deckMat); table.castShadow = true; table.receiveShadow = true;
  olm.add(table);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    olm.add(cyl(1.6, 1.8, padHeight - 6, olmMat, 10.3 * Math.cos(a), (padHeight - 6) / 2, 10.3 * Math.sin(a), 20));
    const a2 = ((i + 1) / 6) * Math.PI * 2 + Math.PI / 6;
    const tr = new Truss(olmMat);
    tr.beam(V3(10.3 * Math.cos(a), 2, 10.3 * Math.sin(a)), V3(10.3 * Math.cos(a2), 12, 10.3 * Math.sin(a2)), 0.5);
    olm.add(tr.build());
  }
  // hold-down clamps around the hole
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const c = box(1.0, 1.2, 0.9, olmMat, 6.9 * Math.cos(a), padHeight + 0.6, 6.9 * Math.sin(a));
    c.rotation.y = -a; olm.add(c);
  }
  // deck railing posts
  for (let i = 0; i < 24; i++) {
    const s = i / 24, p = s * 4;
    const x = p < 1 ? -12 + p * 24 : p < 2 ? 12 : p < 3 ? 12 - (p - 2) * 24 : -12;
    const z = p < 1 ? -12 : p < 2 ? -12 + (p - 1) * 24 : p < 3 ? 12 : 12 - (p - 3) * 24;
    olm.add(cyl(0.06, 0.06, 1.2, olmMat, x, padHeight + 0.6, z, 6));
  }
  // flame deflector / water-cooled steel plate
  const plate = box(28, 1.0, 28, darkMetal(0x4a4640), 0, 0.6, 0); olm.add(plate);
  const plateCone = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2.2, 32), darkMetal(0x55504a)); plateCone.position.y = 1.1 + 1.1; plateCone.castShadow = true; olm.add(plateCone);
  // deluge pipes
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const p = cyl(0.5, 0.5, 30, olmMat, 15 * Math.cos(a), 0.8, 15 * Math.sin(a), 12); p.rotation.z = Math.PI / 2; p.rotation.y = a; olm.add(p); }
  group.add(olm);

  // ── Tower (12×12 m lattice, 145 m) centred at (0,0,-26)
  const tower = new THREE.Group(); tower.name = "Tower";
  const TX = 6, TZ = -26, TH = 145, LEVEL = 7.25, NLEV = 20;
  const corners = [V3(-TX, 0, TZ - 6), V3(TX, 0, TZ - 6), V3(TX, 0, TZ + 6), V3(-TX, 0, TZ + 6)];
  const tt = new Truss(tMat);
  corners.forEach((c) => tt.beam(c, V3(c.x, TH, c.z), 1.3));
  for (let lv = 1; lv <= NLEV; lv++) {
    const y = lv * LEVEL, y0 = (lv - 1) * LEVEL;
    for (let f = 0; f < 4; f++) {
      const a = corners[f], b = corners[(f + 1) % 4];
      tt.beam(V3(a.x, y, a.z), V3(b.x, y, b.z), 0.6);
      if ((lv + f) % 2) tt.beam(V3(a.x, y0, a.z), V3(b.x, y, b.z), 0.45);
      else tt.beam(V3(b.x, y0, b.z), V3(a.x, y, a.z), 0.45);
    }
    if (lv % 2 === 0) {
      tt.beam(V3(corners[0].x, y, corners[0].z), V3(corners[2].x, y, corners[2].z), 0.35);
      tt.beam(V3(corners[1].x, y, corners[1].z), V3(corners[3].x, y, corners[3].z), 0.35);
    }
  }
  tower.add(tt.build());
  // carriage rails on the front face, cable/elevator run on the back
  [-1, 1].forEach((s) => tower.add(box(0.7, TH, 0.7, plainSteel(0x8f98a3, 0.45), s * (TX + 0.9), TH / 2, TZ + 6.6)));
  tower.add(box(3.2, TH, 3.2, tMat, 0, TH / 2, TZ - 7.6));
  // top platform, equipment room, lightning mast
  tower.add(box(16, 1.4, 16, tMat, 0, TH + 0.7, TZ));
  tower.add(box(6, 3.5, 6, darkMetal(0x3a4350), 2, TH + 1.4 + 1.75, TZ - 2));
  tower.add(cyl(0.25, 0.35, 14, plainSteel(0x8f98a3, 0.45), -5, TH + 1.4 + 7, TZ - 5, 8));
  const beaconGeo = new THREE.SphereGeometry(0.45, 12, 10);
  const addBeacon = (x, y, z) => { const b = new THREE.Mesh(beaconGeo, beaconMat()); b.position.set(x, y, z); beacons.push(b); tower.add(b); return b; };
  corners.forEach((c) => addBeacon(c.x * 1.08, TH + 1.9, TZ + (c.z - TZ) * 1.08));
  addBeacon(-5, TH + 1.4 + 14.3, TZ - 5);

  // ── Carriage + chopsticks
  const carriage = new THREE.Group(); carriage.name = "Carriage";
  const HZ = TZ + 6.5;  // hinge z (just in front of the tower face)
  carriage.add(box(16, 7, 2.6, tMat, 0, 0, HZ - 1.6));
  [-1, 1].forEach((s) => {
    carriage.add(box(1.9, 8.5, 1.9, darkMetal(0x3a4350), s * (TX + 0.9), 0, HZ + 0.1));
    carriage.add(cyl(1.0, 1.0, 9.5, tMat, s * TX, 0, HZ, 20));
  });
  const armR = buildChopstick(+1, tMat); armR.position.set(TX, 0, HZ); armR.name = "ChopstickR";
  const armL = buildChopstick(-1, tMat); armL.position.set(-TX, 0, HZ); armL.name = "ChopstickL";
  carriage.add(armR, armL);
  carriage.position.y = 80;
  tower.add(carriage);

  // ── QD arm (ship quick-disconnect) at y≈100
  const qd = new THREE.Object3D(); qd.name = "QDArm";
  qd.position.set(TX + 0.5, 100, HZ);
  const QL = 16;
  const qt = new Truss(tMat);
  [[-1, -1.5], [1, -1.5], [-1, 1.5], [1, 1.5]].forEach(([x, y]) => qt.beam(V3(x, y, 0), V3(x * 0.6, y * 0.6, QL), 0.4));
  for (let z = 0; z <= QL; z += 4) {
    const k = 1 - 0.4 * z / QL;
    qt.beam(V3(-k, -1.5 * k, z), V3(k, -1.5 * k, z), 0.25); qt.beam(V3(-k, 1.5 * k, z), V3(k, 1.5 * k, z), 0.25);
    qt.beam(V3(-k, -1.5 * k, z), V3(-k, 1.5 * k, z), 0.25); qt.beam(V3(k, -1.5 * k, z), V3(k, 1.5 * k, z), 0.25);
    if (z + 4 <= QL) { const k2 = 1 - 0.4 * (z + 4) / QL; qt.beam(V3(-k, 1.5 * k, z), V3(k2, 1.5 * k2, z + 4), 0.2); qt.beam(V3(-k, -1.5 * k, z), V3(-k2, 1.5 * k2, z + 4), 0.2); }
  }
  qd.add(qt.build());
  qd.add(box(2.4, 3.2, 0.6, darkMetal(0x5a606a), 0, 0, QL + 0.3));   // umbilical plate
  qd.add(cyl(1.1, 1.1, 5, tMat, 0, 0, 0, 20));                       // hinge post
  const qdDir = V3(-qd.position.x, 0, -4.5 - qd.position.z);
  const qdBase = Math.atan2(qdDir.x, qdDir.z);                       // yaw that points the arm at the vehicle
  const qdRetract = -Math.PI / 2;
  tower.add(qd);
  group.add(tower);

  // ── Tank farm (x −90..−140, z 40..90)
  const farm = new THREE.Group(); farm.name = "TankFarm";
  farm.add(box(64, 0.5, 64, concreteMat(), -115, 0.25, 65));
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.35, roughness: 0.5 });
  const insul = new THREE.MeshStandardMaterial({ color: 0xe8ebee, metalness: 0.1, roughness: 0.8 });
  [[-96, 50], [-108, 50], [-120, 50], [-132, 50], [-102, 66]].forEach(([x, z], i) => {
    const h = 24;
    const t = cyl(5, 5, h, i < 3 ? tankMat : insul, x, 0.5 + h / 2, z, 32); farm.add(t);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), i < 3 ? tankMat : insul);
    cap.position.set(x, 0.5 + h, z); cap.scale.y = 0.35; cap.castShadow = true; farm.add(cap);
    if (i === 0 || i === 3) { const b = new THREE.Mesh(beaconGeo, beaconMat()); b.position.set(x, 0.5 + h + 2.2, z); beacons.push(b); farm.add(b); }
  });
  [[-100, 82], [-116, 82], [-132, 82]].forEach(([x, z]) => {
    const t = new THREE.Mesh(new THREE.CapsuleGeometry(4, 22, 6, 24), tankMat);
    t.rotation.z = Math.PI / 2; t.position.set(x, 4.8, z); t.castShadow = true; t.receiveShadow = true; farm.add(t);
    [-8, 8].forEach((dx) => farm.add(box(2.5, 1.2, 9, darkMetal(0x5a606a), x + dx, 1.1, z)));
  });
  // transfer pipes toward the pad
  const pipe = cyl(0.35, 0.35, 90, plainSteel(0xa9b2bc, 0.45), -50, 1.2, 40, 10); pipe.rotation.z = Math.PI / 2; farm.add(pipe);
  const pipe2 = cyl(0.35, 0.35, 40, plainSteel(0xa9b2bc, 0.45), -6, 1.2, 20, 10); pipe2.rotation.x = Math.PI / 2; farm.add(pipe2);
  group.add(farm);

  // ── Light poles
  const poleMat = plainSteel(0x8f98a3, 0.5);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xfff0c8, emissiveIntensity: 1.6 });
  [[70, 70], [-70, -20], [45, -80]].forEach(([x, z]) => {
    group.add(cyl(0.25, 0.4, 30, poleMat, x, 15, z, 10));
    group.add(box(4, 0.3, 0.3, poleMat, x, 29.5, z));
    group.add(box(3.6, 0.5, 0.8, lampMat, x, 29.1, z));
  });

  function setArms(open) {
    open = Math.min(1, Math.max(0, open == null ? 1 : open));
    armR.rotation.y = +open * 40 * DEG;
    armL.rotation.y = -open * 40 * DEG;
  }
  function setCarriage(h) { carriage.position.y = h; }
  function setQD(t) {
    t = Math.min(1, Math.max(0, t || 0));
    qd.rotation.y = qdBase + (qdRetract - qdBase) * t;
  }
  setArms(1); setQD(1);

  return { group, padHeight, tower, carriage, arms: { left: armL, right: armR }, qd, setArms, setCarriage, setQD, beacons };
}

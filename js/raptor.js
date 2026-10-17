/* ============================================================
   Starship, Explained — 03 Raptor engine module
   Renders everything inside #mount-raptor. Vanilla ES module,
   no dependencies. All styling lives in css/raptor.css under
   #sec-raptor. Figures are approximate and labelled as such.
   ============================================================ */

const NS = 'http://www.w3.org/2000/svg';
const REDUCED_MQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => REDUCED_MQ.matches;

/* ---------- tiny DOM helpers ---------- */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid) el.append(kid);
  return el;
}
const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/* ---------- reference figures (approximate, public info) ---------- */
const RAPTOR3 = { thrust: 280, pc: 350, ispSL: 327, ispVac: 350 };
const GENS = [
  { id: 'r1', name: 'Raptor 1', year: '2019–21', thrust: 185, mass: 2080, pc: 250,
    note: 'Flew on the Starship hop tests (SN8–SN15). A forest of external pipes, flanges and sensor cabling.' },
  { id: 'r2', name: 'Raptor 2', year: '2022–25', thrust: 230, mass: 1630, pc: 300,
    note: 'Simplified and cheaper: fewer flanges and bolted joints, higher flow. Powered the first orbital test flights.' },
  { id: 'r3', name: 'Raptor 3', year: '2025→', thrust: 280, mass: 1525, pc: 350,
    note: 'Plumbing and sensors are integrated inside the engine castings, so it needs no separate heat shield and is lighter despite more thrust.' },
];
const STACK_MASS_T = 5000;  // full-stack liftoff mass, approximate

/* ============================================================
   1. FULL-FLOW STAGED COMBUSTION SCHEMATIC
   ============================================================ */

/* Geometry (viewBox 0 0 600 850). Shared node positions. */
const G = {
  tankF: { x: 30, y: 20, w: 200, h: 52 },
  tankO: { x: 370, y: 20, w: 200, h: 52 },
  pumpF: { cx: 70, cy: 200, r: 24 },
  pumpO: { cx: 530, cy: 200, r: 24 },
  turbF: { cx: 150, cy: 200, w: 48, h: 40 },
  turbO: { cx: 450, cy: 200, w: 48, h: 40 },
  pbF:   { cx: 235, cy: 200, w: 60, h: 40 },
  pbO:   { cx: 365, cy: 200, w: 60, h: 40 },
  pbMid: { cx: 300, cy: 200, w: 60, h: 40 },
};
const CHAMBER_D = 'M240,376 Q240,360 256,360 L344,360 Q360,360 360,376 L360,450 L325,480 L275,480 L240,450 Z';
const BELL_D = 'M275,480 L325,480 L325,490 C360,540 440,600 450,690 L150,690 C160,600 240,540 275,490 Z';
const JACKET_D = 'M150,690 C160,600 240,540 275,490 L275,480 L240,450 L240,376 Q240,360 256,360 L344,360 Q360,360 360,376 L360,450 L325,480 L325,490 C360,540 440,600 450,690';
// Regenerative cooling particle routes (pump → nozzle lip → up the walls → collector)
const REGEN_A = 'M70,224 L70,700 L150,700 L150,690 C160,600 240,540 275,490 L275,480 L240,450 L240,352';
const REGEN_B = 'M70,224 L70,700 L150,700 L150,690 L450,690 C440,600 360,540 325,490 L325,480 L360,450 L360,352 L240,352';
const END_PB = ' L240,220';
const END_CHAMBER = ' L240,344 L252,344 L252,364';

const INFO = {
  tankF: { kind: 'ch4', title: 'Methane tank',
    body: 'Liquid methane (CH₄) stored at roughly −160 °C, sub-cooled below its boiling point so it is denser and more fits in the tank. It is the fuel, and it also does double duty as the coolant for the chamber and nozzle walls.' },
  tankO: { kind: 'lox', title: 'Liquid oxygen tank',
    body: 'Liquid oxygen at about −183 °C, also sub-cooled. Raptor burns roughly 3.6 kg of oxygen for every kilogram of methane, so the oxidizer side moves most of the mass and the oxygen tank is the bigger one.' },
  pumpF: { kind: 'ch4', title: 'Fuel turbopump',
    body: 'A centrifugal pump spinning at tens of thousands of rpm. It raises the methane from a few bar in the tank to several hundred bar — well above the chamber pressure it has to push into. The turbine next to it, on the same shaft, provides the power.' },
  pumpO: { kind: 'lox', title: 'Oxidizer turbopump',
    body: 'The same idea for liquid oxygen, on its own separate shaft. Keeping the two shafts apart means there is no rotating seal between hot oxygen and hot methane — a classic leak-and-explode failure point in older single-shaft engines.' },
  turbF: { kind: 'hot', title: 'Fuel-side turbine',
    body: 'Warm, fuel-rich gas from the preburner expands across the blades and spins the fuel pump. Because the entire methane flow passes through, the turbine gets the power it needs from a modest temperature drop — which is why it runs cooler than in other cycles.' },
  turbO: { kind: 'hot', title: 'Oxidizer-side turbine',
    body: 'Driven by oxygen-rich gas from its own preburner. Hot oxygen-rich gas attacks most metals, so the blades, housing and ducts are made from SpaceX\'s in-house superalloys. The exhaust is not thrown away: it flows on into the main chamber.' },
  pbF: { kind: 'hot', title: 'Fuel-rich preburner',
    body: 'A small combustion chamber that burns a small fraction of the oxygen in nearly all of the methane. With far more fuel than oxygen, the gas comes out relatively cool (hundreds of °C rather than thousands) but with plenty of energy to spin the fuel turbine. The product is a warm, fuel-rich gas that still has to be burned.' },
  pbO: { kind: 'hot', title: 'Oxygen-rich preburner',
    body: 'Burns a small fraction of the methane in nearly all of the oxygen. Hot, high-pressure oxygen-rich gas will burn ordinary steel like a sparkler, so these parts use special alloys (SpaceX calls its own SX300 and SX500). The Soviet RD-170 family pioneered ox-rich preburners; Raptor is the first to pair one with a fuel-rich preburner.' },
  pbSC: { kind: 'hot', title: 'Preburner (oxygen-rich)',
    body: 'In a conventional staged-combustion engine a single preburner runs all of one propellant with a trickle of the other and drives both pumps. Nothing is wasted, but one turbine has to deliver all the pump power, so it runs hotter and closer to its limits. (Fuel-rich versions exist too, like the RS-25.)' },
  gg: { kind: 'hot', title: 'Gas generator',
    body: 'A small combustor that burns a few percent of both propellants to make moderate-temperature gas for the turbines. Simple and robust — Merlin, F-1 and RS-68 all use it — but the turbine exhaust is dumped, and the turbine power limits how much chamber pressure you can reach (Merlin: ~100 bar).' },
  ventF: { kind: 'hot', title: 'Turbine exhaust, dumped',
    body: 'In an open cycle the turbine exhaust leaves through its own pipe and produces almost no thrust. A few percent of the propellant you lifted off the pad is simply thrown away, and the fuel-rich exhaust is why gas-generator rockets trail a sooty plume.' },
  ventO: { kind: 'hot', title: 'Turbine exhaust, dumped',
    body: 'Same on this side: the gas that drove the turbine exits overboard. (Real gas-generator engines usually have one turbine driving both pumps; two are drawn here so the three cycles line up.)' },
  chamber: { kind: 'hot', title: 'Main combustion chamber',
    body: 'Both turbine exhausts arrive here already gaseous and mix through the injector. Gas–gas combustion is fast and complete, which is what lets Raptor run at ~350 bar (Raptor 3) — the highest chamber pressure of any rocket engine that has flown. That is about 350 kg pressing on every square centimetre of the wall.' },
  bell: { kind: 'hot', title: 'Throat and bell nozzle',
    body: 'The throat is the narrowest point; the gas hits the speed of sound there and goes supersonic in the bell, which converts pressure into exhaust velocity. The sea-level nozzle exit is about 1.3 m across; the vacuum version (RVac) is about 2.3 m, which is why it needs a shorter, hotter flame to push against thin air.' },
  regen: { kind: 'ch4', title: 'Regenerative cooling channels',
    body: 'Before the methane is burned it is pumped through hundreds of narrow channels in the chamber and nozzle walls, carrying away heat that would otherwise melt the steel within seconds. The heat is not wasted — it preheats the fuel on its way to the preburner. The blue band in the walls shows this flow.' },
};

const CYCLES = {
  gg: {
    name: 'Gas generator (open)', short: 'Open cycle',
    blurb: 'Simple and cheap. A small gas generator burns a few percent of the propellant to spin the turbines, and that exhaust is thrown overboard. Turbine power — and so chamber pressure — is limited.',
    chamberNote: 'liquid + liquid', chamberPc: '~100 bar',
    wasted: '~3–5 % of propellant', turbine: 'Moderate temp, all power from one small flow', pressure: '~100 bar (Merlin)',
    nodes: ['tankF', 'tankO', 'pumpF', 'pumpO', 'turbF', 'turbO', 'gg', 'ventF', 'ventO', 'regen', 'chamber', 'bell'],
    edges: [
      { k: 'ch4', w: 'main', d: 'M40,72 L40,200 L46,200' },
      { k: 'lox', w: 'main', d: 'M560,72 L560,200 L554,200' },
      { k: 'ch4', w: 'small', d: 'M70,176 L70,150 L284,150 L284,180' },
      { k: 'lox', w: 'small', d: 'M530,176 L530,150 L316,150 L316,180' },
      { k: 'hot', w: 'small', d: 'M270,200 L174,200' },
      { k: 'hot', w: 'small', d: 'M330,200 L426,200' },
      { k: 'hot', w: 'small', d: 'M150,220 L150,300 L100,300 L100,345', fade: true },
      { k: 'hot', w: 'small', d: 'M450,220 L450,300 L500,300 L500,345', fade: true },
      { k: 'lox', w: 'main', d: 'M530,224 L530,400 L358,400' },
      { k: 'ch4', w: 'main', d: REGEN_A + END_CHAMBER, regen: true },
      { k: 'ch4', w: 'main', d: REGEN_B + END_CHAMBER, regen: true },
    ],
    labels: [
      { x: 170, y: 142, t: 'a little CH₄', k: 'ch4' },
      { x: 430, y: 142, t: 'a little LOX', k: 'lox', a: 'end' },
      { x: 300, y: 252, t: 'hot gas', k: 'hot', a: 'middle' },
      { x: 100, y: 365, t: 'dumped', k: 'hot', a: 'middle' },
      { x: 500, y: 365, t: 'dumped', k: 'hot', a: 'middle' },
      { x: 542, y: 320, t: 'most LOX', k: 'lox' },
      { x: 82, y: 460, t: 'all CH₄ → cooling', k: 'ch4' },
    ],
  },
  sc: {
    name: 'Staged combustion', short: 'Closed cycle',
    blurb: 'The turbine exhaust goes into the main chamber, so nothing is wasted. But one preburner drives everything: it runs all of one propellant through a single hot turbine, and the pumps share a shaft or gearbox.',
    chamberNote: 'fuel + hot gas', chamberPc: '~250 bar',
    wasted: 'None', turbine: 'Hot — one turbine carries all the pump power', pressure: '~200–260 bar (RS-25, RD-180)',
    nodes: ['tankF', 'tankO', 'pumpF', 'pumpO', 'turbF', 'turbO', 'pbSC', 'regen', 'chamber', 'bell'],
    edges: [
      { k: 'ch4', w: 'main', d: 'M40,72 L40,200 L46,200' },
      { k: 'lox', w: 'main', d: 'M560,72 L560,200 L554,200' },
      { k: 'ch4', w: 'small', d: 'M70,176 L70,150 L284,150 L284,180' },
      { k: 'lox', w: 'main', d: 'M530,176 L530,150 L316,150 L316,180' },
      { k: 'hot', w: 'main', d: 'M270,200 L174,200' },
      { k: 'hot', w: 'main', d: 'M330,200 L426,200' },
      { k: 'hot', w: 'main', d: 'M150,220 L150,400 L242,400' },
      { k: 'hot', w: 'main', d: 'M450,220 L450,400 L358,400' },
      { k: 'ch4', w: 'main', d: REGEN_A + END_CHAMBER, regen: true },
      { k: 'ch4', w: 'main', d: REGEN_B + END_CHAMBER, regen: true },
    ],
    labels: [
      { x: 170, y: 142, t: 'a little CH₄', k: 'ch4' },
      { x: 430, y: 142, t: 'all the LOX', k: 'lox', a: 'end' },
      { x: 300, y: 250, t: 'ox-rich gas', k: 'hot', a: 'middle' },
      { x: 300, y: 338, t: 'into the chamber', k: 'hot', a: 'middle' },
      { x: 82, y: 460, t: 'all CH₄ → cooling', k: 'ch4' },
    ],
  },
  ffsc: {
    name: 'Full-flow (Raptor)', short: 'Full-flow staged combustion',
    blurb: 'Both propellants are turned to gas before the main chamber. Each turbine sees its entire propellant flow, so it needs only a small temperature rise to make its power: cooler turbines, more margin, higher chamber pressure and longer life. The price is an oxygen-rich preburner that demands exotic alloys.',
    chamberNote: 'gas + gas', chamberPc: '~350 bar',
    wasted: 'None', turbine: 'Cooler — two turbines, each on a full flow', pressure: '~350 bar (Raptor 3)',
    nodes: ['tankF', 'tankO', 'pumpF', 'pumpO', 'turbF', 'turbO', 'pbF', 'pbO', 'regen', 'chamber', 'bell'],
    edges: [
      { k: 'ch4', w: 'main', d: 'M40,72 L40,200 L46,200' },
      { k: 'lox', w: 'main', d: 'M560,72 L560,200 L554,200' },
      { k: 'lox', w: 'main', d: 'M530,176 L530,150 L365,150 L365,180' },
      { k: 'lox', w: 'small', d: 'M365,168 L290,168 L290,186 L265,186' },
      { k: 'ch4', w: 'small', d: 'M240,262 L310,262 L310,215 L335,215' },
      { k: 'hot', w: 'main', d: 'M205,200 L174,200' },
      { k: 'hot', w: 'main', d: 'M395,200 L426,200' },
      { k: 'hot', w: 'main', d: 'M150,220 L150,400 L242,400' },
      { k: 'hot', w: 'main', d: 'M450,220 L450,400 L358,400' },
      { k: 'ch4', w: 'main', d: REGEN_A + END_PB, regen: true },
      { k: 'ch4', w: 'main', d: REGEN_B + END_PB, regen: true },
    ],
    labels: [
      { x: 440, y: 142, t: 'most LOX', k: 'lox', a: 'end' },
      { x: 300, y: 160, t: 'a little LOX', k: 'lox', a: 'middle' },
      { x: 300, y: 274, t: 'a little CH₄', k: 'ch4', a: 'middle' },
      { x: 110, y: 330, t: 'fuel-rich', k: 'hot', a: 'middle' },
      { x: 490, y: 330, t: 'ox-rich', k: 'hot', a: 'middle' },
      { x: 82, y: 460, t: 'all CH₄ → cooling', k: 'ch4' },
    ],
  },
};

/* ---------- node renderers ---------- */
function nodeGroup(id, kind) {
  const info = INFO[id];
  return s('g', { class: `rp-node rp-node-${kind}`, 'data-id': id, tabindex: 0, role: 'button',
    'aria-label': `${info.title}: show details` });
}
function label(x, y, text, opts = {}) {
  return s('text', { x, y, class: `rp-lbl ${opts.cls || ''}`, 'text-anchor': opts.a || 'middle', text });
}
function rotor(cx, cy, r, blades) {
  const g = s('g', { class: 'rp-rotor' });
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    g.append(s('line', { x1: cx, y1: cy, x2: cx + Math.cos(a) * r, y2: cy + Math.sin(a) * r }));
  }
  g.append(s('circle', { cx, cy, r: 2.5, class: 'rp-rotor-hub' }));
  return g;
}
const DRAW = {
  tankF() { const t = G.tankF, g = nodeGroup('tankF', 'ch4');
    g.append(s('rect', { x: t.x, y: t.y, width: t.w, height: t.h, rx: 12, class: 'rp-shape' }),
      s('rect', { x: t.x + 8, y: t.y + 30, width: t.w - 16, height: t.h - 38, rx: 4, class: 'rp-liquid' }),
      label(t.x + t.w / 2, t.y + 22, 'CH₄  liquid methane')); return g; },
  tankO() { const t = G.tankO, g = nodeGroup('tankO', 'lox');
    g.append(s('rect', { x: t.x, y: t.y, width: t.w, height: t.h, rx: 12, class: 'rp-shape' }),
      s('rect', { x: t.x + 8, y: t.y + 30, width: t.w - 16, height: t.h - 38, rx: 4, class: 'rp-liquid' }),
      label(t.x + t.w / 2, t.y + 22, 'LOX  liquid oxygen')); return g; },
  pumpF() { return pump('pumpF', G.pumpF, 'ch4', 'fuel pump', 'start'); },
  pumpO() { return pump('pumpO', G.pumpO, 'lox', 'LOX pump', 'end'); },
  turbF() { return turbine('turbF', G.turbF, G.pumpF); },
  turbO() { return turbine('turbO', G.turbO, G.pumpO); },
  pbF() { return preburner('pbF', G.pbF, 'fuel-rich\npreburner'); },
  pbO() { return preburner('pbO', G.pbO, 'ox-rich\npreburner'); },
  pbSC() { return preburner('pbSC', G.pbMid, 'preburner\n(ox-rich)'); },
  gg() { return preburner('gg', G.pbMid, 'gas\ngenerator'); },
  ventF() { return vent('ventF', 100, 345); },
  ventO() { return vent('ventO', 500, 345); },
  regen() { const g = nodeGroup('regen', 'ch4');
    g.append(s('path', { d: JACKET_D, class: 'rp-jacket' })); return g; },
  chamber() { const g = nodeGroup('chamber', 'hot');
    g.append(s('path', { d: CHAMBER_D, class: 'rp-shape rp-chamber' }),
      s('path', { d: 'M256,372 L344,372', class: 'rp-injector' }),
      s('path', { d: 'M262,380 L338,380', class: 'rp-injector' }),
      label(300, 412, 'main chamber'),
      label(300, 427, '', { cls: 'rp-lbl-sub rp-chamber-note' }),
      label(300, 441, '', { cls: 'rp-lbl-sub rp-chamber-pc' })); return g; },
  bell() { const g = nodeGroup('bell', 'hot');
    g.append(s('path', { d: BELL_D, class: 'rp-shape rp-bell' }),
      label(300, 500, 'throat', { cls: 'rp-lbl-sub' }),
      label(300, 600, 'bell nozzle', { cls: 'rp-lbl-dim' })); return g; },
};
function pump(id, p, kind, text, side) {
  const g = nodeGroup(id, kind);
  g.append(s('circle', { cx: p.cx, cy: p.cy, r: p.r, class: 'rp-shape' }), rotor(p.cx, p.cy, p.r - 7, 3),
    s('text', { x: p.cx, y: p.cy + p.r + 16, class: 'rp-lbl', 'text-anchor': 'middle', text }));
  void side;
  return g;
}
function turbine(id, t, pumpG) {
  const g = nodeGroup(id, 'hot');
  const x = t.cx - t.w / 2, y = t.cy - t.h / 2;
  const shaftX1 = pumpG.cx < t.cx ? pumpG.cx + pumpG.r : pumpG.cx - pumpG.r;
  const shaftX2 = pumpG.cx < t.cx ? x : x + t.w;
  g.append(s('line', { x1: shaftX1, y1: t.cy, x2: shaftX2, y2: t.cy, class: 'rp-shaft' }),
    s('rect', { x, y, width: t.w, height: t.h, rx: 5, class: 'rp-shape' }), rotor(t.cx, t.cy, 13, 6),
    s('text', { x: t.cx, y: y + t.h + 16, class: 'rp-lbl', 'text-anchor': 'middle', text: 'turbine' }));
  return g;
}
function preburner(id, p, text) {
  const g = nodeGroup(id, 'hot');
  const x = p.cx - p.w / 2, y = p.cy - p.h / 2;
  const lines = text.split('\n');
  g.append(s('rect', { x, y, width: p.w, height: p.h, rx: 8, class: 'rp-shape rp-pb' }),
    s('path', { d: `M${p.cx - 6},${p.cy + 8} Q${p.cx - 7},${p.cy - 2} ${p.cx},${p.cy - 9} Q${p.cx + 7},${p.cy - 2} ${p.cx + 6},${p.cy + 8} Z`, class: 'rp-flamelet' }));
  lines.forEach((ln, i) => g.append(s('text', { x: p.cx, y: y + p.h + 14 + i * 12, class: 'rp-lbl', 'text-anchor': 'middle', text: ln })));
  return g;
}
function vent(id, x, y) {
  const g = nodeGroup(id, 'hot');
  g.append(s('path', { d: `M${x - 10},${y} L${x},${y + 10} L${x + 10},${y}`, class: 'rp-vent' }),
    s('path', { d: `M${x - 10},${y + 7} L${x},${y + 17} L${x + 10},${y + 7}`, class: 'rp-vent rp-vent-2' }));
  return g;
}

/* ---------- the schematic widget ---------- */
function buildSchematic() {
  const state = { cycle: 'ffsc', throttle: 1, selected: null, visible: false, running: false, raf: 0, last: 0, edges: [] };

  const svg = s('svg', { viewBox: '0 0 600 850', class: 'rp-svg', role: 'group', 'aria-label': 'Animated engine cycle schematic' });
  const defs = s('defs');
  for (const k of ['ch4', 'lox', 'hot']) {
    const m = s('marker', { id: `rp-arr-${k}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
    m.append(s('path', { d: 'M0,0 L10,5 L0,10 Z', class: `rp-arrow rp-arrow-${k}` }));
    defs.append(m);
  }
  const grad = s('linearGradient', { id: 'rp-plume-grad', x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(s('stop', { offset: '0', class: 'rp-stop-core' }), s('stop', { offset: '0.35', class: 'rp-stop-mid' }), s('stop', { offset: '1', class: 'rp-stop-end' }));
  const gradCore = s('linearGradient', { id: 'rp-core-grad', x1: 0, y1: 0, x2: 0, y2: 1 });
  gradCore.append(s('stop', { offset: '0', class: 'rp-stop-blue' }), s('stop', { offset: '1', class: 'rp-stop-blue-end' }));
  const blur = s('filter', { id: 'rp-blur', x: '-30%', y: '-30%', width: '160%', height: '160%' });
  blur.append(s('feGaussianBlur', { stdDeviation: 7 }));
  defs.append(grad, gradCore, blur);
  svg.append(defs);

  const gPlume = s('g', { class: 'rp-plume' });
  const plumeGlow = s('path', { class: 'rp-plume-glow', filter: 'url(#rp-blur)' });
  const plumeOuter = s('path', { class: 'rp-plume-outer' });
  const plumeCore = s('path', { class: 'rp-plume-core' });
  const diamonds = [0, 1, 2].map(() => s('ellipse', { class: 'rp-diamond' }));
  gPlume.append(plumeGlow, plumeOuter, plumeCore, ...diamonds);
  const gPipes = s('g', { class: 'rp-pipes' });
  const gNodes = s('g', { class: 'rp-nodes' });
  const gDots = s('g', { class: 'rp-dots', 'aria-hidden': 'true' });
  const gLabels = s('g', { class: 'rp-flowlabels', 'aria-hidden': 'true' });
  svg.append(gPlume, gPipes, gNodes, gDots, gLabels);

  /* info card */
  const infoKind = h('span', { class: 'chip rp-info-kind' });
  const infoTitle = h('h4', { class: 'rp-info-title', text: 'Tap any component' });
  const infoBody = h('p', { class: 'rp-info-body', text: 'Hover or tap the tanks, pumps, preburners, turbines, chamber or nozzle to learn what each one does. Blue dots are methane, pale cyan is liquid oxygen, orange is hot gas.' });
  const infoCard = h('div', { class: 'rp-info panel', 'aria-live': 'polite' }, h('div', { class: 'rp-info-head' }, infoKind, infoTitle), infoBody);

  function showInfo(id) {
    const info = INFO[id];
    if (!info) return;
    infoKind.textContent = { ch4: 'methane', lox: 'oxygen', hot: 'hot gas' }[info.kind];
    infoKind.dataset.kind = info.kind;
    infoTitle.textContent = info.title;
    infoBody.textContent = info.body;
  }
  function select(id) {
    state.selected = id;
    gNodes.querySelectorAll('.rp-node').forEach(n => n.classList.toggle('is-selected', n.dataset.id === id));
    showInfo(id);
  }

  /* cycle toggle */
  const cycleBtns = {};
  const cycleBar = h('div', { class: 'rp-cycles', role: 'group', 'aria-label': 'Compare engine cycles' });
  for (const key of ['gg', 'sc', 'ffsc']) {
    cycleBtns[key] = h('button', { class: 'btn', type: 'button', 'aria-pressed': String(key === state.cycle), text: CYCLES[key].name, onclick: () => setCycle(key) });
    cycleBar.append(cycleBtns[key]);
  }
  const cycleTitle = h('h4', { class: 'rp-cycle-title' });
  const cycleBlurb = h('p', { class: 'rp-cycle-blurb' });
  const cycleRows = { wasted: h('dd'), turbine: h('dd'), pressure: h('dd') };
  const cycleFacts = h('dl', { class: 'rp-cycle-facts' },
    h('div', {}, h('dt', { text: 'Wasted propellant' }), cycleRows.wasted),
    h('div', {}, h('dt', { text: 'Turbine conditions' }), cycleRows.turbine),
    h('div', {}, h('dt', { text: 'Typical chamber pressure' }), cycleRows.pressure));
  const cyclePanel = h('div', { class: 'rp-cycle panel' }, h('p', { class: 'rp-kicker', text: 'Compare cycles' }), cycleBar, cycleTitle, cycleBlurb, cycleFacts);

  function setCycle(key) {
    state.cycle = key;
    for (const k in cycleBtns) cycleBtns[k].setAttribute('aria-pressed', String(k === key));
    const c = CYCLES[key];
    cycleTitle.textContent = c.short;
    cycleBlurb.textContent = c.blurb;
    cycleRows.wasted.textContent = c.wasted;
    cycleRows.turbine.textContent = c.turbine;
    cycleRows.pressure.textContent = c.pressure;
    render();
  }

  function render() {
    const c = CYCLES[state.cycle];
    gPipes.replaceChildren();
    gNodes.replaceChildren();
    gDots.replaceChildren();
    gLabels.replaceChildren();
    state.edges = [];
    for (const e of c.edges) {
      const p = s('path', { d: e.d, class: `rp-pipe rp-pipe-${e.k} rp-pipe-${e.w}`, 'marker-end': e.regen ? null : `url(#rp-arr-${e.k})` });
      gPipes.append(p);
      const len = p.getTotalLength();
      const spacing = e.k === 'hot' ? 30 : (e.w === 'main' ? 26 : 40);
      const n = Math.max(2, Math.round(len / spacing));
      const dots = [];
      for (let i = 0; i < n; i++) {
        const d = s('circle', { r: e.k === 'hot' ? 3.2 : (e.w === 'main' ? 2.6 : 2), class: `rp-dot rp-dot-${e.k}` });
        gDots.append(d);
        dots.push({ el: d, p: i / n });
      }
      state.edges.push({ path: p, len, dots, fade: !!e.fade, speed: e.k === 'hot' ? 130 : 85 });
    }
    for (const id of c.nodes) {
      const g = DRAW[id]();
      g.addEventListener('click', () => select(id));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(id); } });
      g.addEventListener('pointerenter', () => { if (!state.selected) showInfo(id); });
      g.addEventListener('focus', () => showInfo(id));
      gNodes.append(g);
    }
    const note = gNodes.querySelector('.rp-chamber-note');
    if (note) note.textContent = c.chamberNote;
    const pc = gNodes.querySelector('.rp-chamber-pc');
    if (pc) pc.textContent = c.chamberPc;
    for (const l of c.labels) gLabels.append(s('text', { x: l.x, y: l.y, class: `rp-flowlbl rp-flowlbl-${l.k}`, 'text-anchor': l.a || 'start', text: l.t }));
    if (state.selected && !c.nodes.includes(state.selected)) state.selected = null;
    if (state.selected) select(state.selected);
    placeDots(0);
    updatePlume();
  }

  function placeDots(dt) {
    for (const e of state.edges) {
      const v = e.speed * (0.35 + 0.65 * state.throttle);
      for (const d of e.dots) {
        if (dt) d.p = (d.p + (v * dt) / e.len) % 1;
        const pt = e.path.getPointAtLength(d.p * e.len);
        d.el.setAttribute('cx', pt.x.toFixed(1));
        d.el.setAttribute('cy', pt.y.toFixed(1));
        if (e.fade) d.el.style.opacity = String(Math.max(0, 1 - Math.max(0, (d.p - 0.65) / 0.35)));
      }
    }
  }

  /* plume reacts to throttle */
  function updatePlume() {
    const t = state.throttle;
    const Lp = 50 + 110 * t;
    const pinch = (1 - t) * 55;
    const y0 = 690;
    const dOuter = `M168,${y0} Q${168 + pinch + 36},${y0 + Lp * 0.5} 300,${y0 + Lp} Q${432 - pinch - 36},${y0 + Lp * 0.5} 432,${y0} Z`;
    plumeOuter.setAttribute('d', dOuter);
    plumeGlow.setAttribute('d', dOuter);
    plumeCore.setAttribute('d', `M${236 + pinch * 0.4},${y0} C270,${y0 + Lp * 0.35} 300,${y0 + Lp * 0.6} 300,${y0 + Lp * 0.75} C300,${y0 + Lp * 0.6} 330,${y0 + Lp * 0.35} ${364 - pinch * 0.4},${y0} Z`);
    gPlume.style.opacity = String(0.45 + 0.55 * t);
    diamonds.forEach((d, i) => {
      d.setAttribute('cx', 300);
      d.setAttribute('cy', (y0 + Lp * (0.16 + i * 0.17)).toFixed(1));
      d.setAttribute('rx', (5 + (1 - t) * 5).toFixed(1));
      d.setAttribute('ry', (10 + (1 - t) * 4).toFixed(1));
      d.style.opacity = String(0.25 + 0.6 * (1 - t));
    });
    svg.style.setProperty('--rp-spin', `${(1.6 - 1.0 * t).toFixed(2)}s`);
  }

  /* throttle panel */
  const slider = h('input', { type: 'range', min: 40, max: 100, step: 1, value: 100, 'aria-label': 'Throttle, percent' });
  const throttleVal = h('span', { class: 'rp-throttle-val mono', text: '100 %' });
  const readouts = {
    thrust: h('dd', { class: 'v' }), kn: h('span', { class: 'rp-sub' }),
    pc: h('dd', { class: 'v' }), isp: h('dd', { class: 'v' }), ispv: h('dd', { class: 'v' }),
  };
  const readoutList = h('dl', { class: 'rp-readouts' },
    h('div', { class: 'stat' }, h('dt', { class: 'k', text: 'Thrust (sea level)' }), readouts.thrust, readouts.kn),
    h('div', { class: 'stat' }, h('dt', { class: 'k', text: 'Chamber pressure' }), readouts.pc),
    h('div', { class: 'stat' }, h('dt', { class: 'k', text: 'Isp, sea level' }), readouts.isp),
    h('div', { class: 'stat' }, h('dt', { class: 'k', text: 'Isp, RVac in vacuum' }), readouts.ispv));
  function updateThrottle() {
    const t = Number(slider.value) / 100;
    state.throttle = t;
    throttleVal.textContent = `${slider.value} %`;
    const thrust = RAPTOR3.thrust * t;
    readouts.thrust.textContent = `~${fmt(thrust)} tf`;
    readouts.kn.textContent = `≈ ${fmt(thrust * 9.80665)} kN`;
    readouts.pc.textContent = `~${fmt(RAPTOR3.pc * t)} bar`;
    readouts.isp.textContent = `~${fmt(RAPTOR3.ispSL - (1 - t) * 25)} s`;
    readouts.ispv.textContent = `~${fmt(RAPTOR3.ispVac - (1 - t) * 6)}+ s`;
    updatePlume();
    if (reduced()) placeDots(0);
  }
  slider.addEventListener('input', updateThrottle);
  const throttlePanel = h('div', { class: 'rp-throttle panel' },
    h('div', { class: 'rp-throttle-head' }, h('p', { class: 'rp-kicker', text: 'Throttle (Raptor 3, sea level)' }), throttleVal),
    slider,
    h('div', { class: 'rp-range-ticks mono', 'aria-hidden': 'true' }, h('span', { text: '40 %' }), h('span', { text: 'min deep throttle' }), h('span', { text: '100 %' })),
    readoutList,
    h('p', { class: 'note', text: 'Approximate. Thrust and chamber pressure scale roughly with throttle; Isp at sea level drops a little at low throttle because the bell over-expands the exhaust (watch the plume pinch in). Raptor 2 for comparison: ~230 tf and ~300 bar.' }));

  /* legend */
  const legend = h('div', { class: 'rp-legend', 'aria-hidden': 'true' },
    h('span', { class: 'chip' }, h('i', { class: 'dot rp-dot-ch4' }), 'methane'),
    h('span', { class: 'chip' }, h('i', { class: 'dot rp-dot-lox' }), 'liquid oxygen'),
    h('span', { class: 'chip' }, h('i', { class: 'dot rp-dot-hot' }), 'hot gas'),
    h('span', { class: 'chip rp-legend-w' }, 'thick = most of the flow, thin = a small fraction'));

  /* animation loop */
  function frame(now) {
    if (!state.running) return;
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    placeDots(dt);
    state.raf = requestAnimationFrame(frame);
  }
  function start() {
    if (state.running || reduced() || !state.visible) return;
    state.running = true;
    state.last = performance.now();
    state.raf = requestAnimationFrame(frame);
  }
  function stop() { state.running = false; cancelAnimationFrame(state.raf); }
  REDUCED_MQ.addEventListener('change', () => { if (reduced()) { stop(); placeDots(0); } else start(); });
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

  const figure = h('figure', { class: 'rp-figure' }, svg, legend,
    h('figcaption', { class: 'rp-caption', text: 'Schematic, not to scale. Dots show where each propellant goes; the engine cycle is selected on the right.' }));
  const aside = h('div', { class: 'rp-side' }, infoCard, cyclePanel, throttlePanel);
  const root = h('div', { class: 'rp-ffsc grid-2' }, figure, aside);

  setCycle('ffsc');
  updateThrottle();

  return { root, setVisible(v) { state.visible = v; v ? start() : stop(); }, rerender: render };
}

/* ============================================================
   2. GENERATIONS COMPARISON
   ============================================================ */
function buildGenerations() {
  const metrics = [
    { key: 'thrust', label: 'Thrust at sea level', unit: 'tf', max: 300, fmt: v => `~${fmt(v)} tf` },
    { key: 'mass', label: 'Engine mass', unit: 'kg', max: 2200, fmt: v => `~${fmt(v)} kg`, lowerBetter: true },
    { key: 'pc', label: 'Chamber pressure', unit: 'bar', max: 380, fmt: v => `~${fmt(v)} bar` },
    { key: 'twr', label: 'Thrust-to-weight', unit: ':1', max: 200, fmt: v => `~${fmt(v)} : 1` },
  ];
  const data = GENS.map(g => ({ ...g, twr: (g.thrust * 1000) / g.mass }));
  const chart = h('div', { class: 'rp-bars', role: 'table', 'aria-label': 'Raptor generations compared' });
  for (const m of metrics) {
    const row = h('div', { class: 'rp-bar-row', role: 'row' }, h('div', { class: 'rp-bar-label', role: 'rowheader', text: m.label }));
    const bars = h('div', { class: 'rp-bar-set' });
    for (const g of data) {
      const pct = (g[m.key] / m.max) * 100;
      const fill = h('i', { class: `rp-bar-fill rp-bar-${g.id}` });
      fill.style.setProperty('--w', `${pct.toFixed(1)}%`);
      bars.append(h('div', { class: 'rp-bar', role: 'cell' },
        h('span', { class: 'rp-bar-gen mono', text: g.name.replace('Raptor ', 'R') }),
        h('span', { class: 'rp-bar-track' }, fill),
        h('span', { class: 'rp-bar-val mono', text: m.fmt(g[m.key]) })));
    }
    row.append(bars);
    chart.append(row);
  }
  const cards = h('div', { class: 'rp-gen-cards' }, data.map(g => h('div', { class: `rp-gen-card rp-gen-${g.id}` },
    h('div', { class: 'rp-gen-head' }, h('h4', { text: g.name }), h('span', { class: 'chip', text: g.year })),
    h('p', { text: g.note }))));

  /* RVac vs sea-level nozzle silhouette */
  const rv = s('svg', { viewBox: '0 0 360 220', class: 'rp-rvac-svg', role: 'img', 'aria-label': 'Sea-level Raptor nozzle next to the larger Raptor Vacuum nozzle' });
  const nozzle = (cx, exitW, len, cls) => s('path', { class: cls,
    d: `M${cx - 14},20 L${cx + 14},20 L${cx + 14},38 C${cx + 14 + exitW * 0.3},${38 + len * 0.3} ${cx + exitW / 2 - 4},${38 + len * 0.6} ${cx + exitW / 2},${38 + len} L${cx - exitW / 2},${38 + len} C${cx - exitW / 2 + 4},${38 + len * 0.6} ${cx - 14 - exitW * 0.3},${38 + len * 0.3} ${cx - 14},38 Z` });
  rv.append(s('rect', { x: 0, y: 0, width: 360, height: 220, class: 'rp-rvac-bg' }),
    s('g', { class: 'rp-rvac-sl' }, nozzle(90, 78, 110, 'rp-rvac-shape'), s('text', { x: 90, y: 190, class: 'rp-lbl', 'text-anchor': 'middle', text: 'Raptor (sea level)' }), s('text', { x: 90, y: 206, class: 'rp-lbl rp-lbl-sub', 'text-anchor': 'middle', text: 'exit ≈ 1.3 m' })),
    s('g', { class: 'rp-rvac-vac' }, nozzle(250, 138, 140, 'rp-rvac-shape rp-rvac-big'), s('text', { x: 250, y: 190, class: 'rp-lbl', 'text-anchor': 'middle', text: 'Raptor Vacuum (RVac)' }), s('text', { x: 250, y: 206, class: 'rp-lbl rp-lbl-sub', 'text-anchor': 'middle', text: 'exit ≈ 2.3 m' })),
    s('line', { x1: 181, y1: 178, x2: 319, y2: 178, class: 'rp-dim' }), s('line', { x1: 51, y1: 148, x2: 129, y2: 148, class: 'rp-dim' }));
  const rvac = h('div', { class: 'rp-rvac panel' },
    h('p', { class: 'rp-kicker', text: 'Raptor Vacuum' }),
    rv,
    h('p', { text: 'The ship carries three RVacs on the outside of its engine bay. Same power head, but a much bigger, radiatively cooled bell (~2.3 m exit) lets the gas expand further in vacuum, pushing specific impulse from ~327 s to roughly 350+ s. A nozzle that large would be over-expanded at sea level, so it is used only once the ship is high in thin air.' }));

  const root = h('div', { class: 'rp-gens' },
    h('div', { class: 'rp-block-head' }, h('h3', { text: 'Three generations, one direction: more thrust, less engine.' }),
      h('p', { class: 'rp-block-lede', text: 'Each Raptor is lighter and more powerful than the last. Bars are approximate figures from public statements; the vehicle you watch may fly a mix.' })),
    h('div', { class: 'grid-2 rp-gens-grid' }, h('div', { class: 'panel rp-bars-panel' }, chart, h('p', { class: 'note', text: 'Thrust-to-weight is the engine\'s own thrust divided by its own weight (280 tf ÷ 1.525 t ≈ 184). Lighter engines mean more payload for the same thrust.' })), h('div', { class: 'rp-gens-side' }, cards, rvac)));

  const reveal = () => chart.classList.add('is-in');
  return { root, reveal };
}

/* ============================================================
   3. SUPER HEAVY ENGINE LAYOUT
   ============================================================ */
const MODES = [
  { id: 'liftoff', label: 'Liftoff (33)', lit: ['c', 'm', 'o'],
    note: 'All 33 engines light in a staggered sequence just before liftoff. The outer 20 are started with ground-side equipment on the launch mount, so this is the only time they run.' },
  { id: 'hotstage', label: 'Hot staging (3)', lit: ['c'],
    note: 'Seconds before separation the booster throttles down and shuts off all but the 3 center engines, which keep a little thrust on so the stack stays settled while the ship lights its six engines above.' },
  { id: 'boostback', label: 'Boostback (13)', lit: ['c', 'm'],
    note: 'After separation the booster flips and relights the 13 inner engines to fly back toward the launch site. The outer 20 cannot be relit in flight, so they stay dark for the rest of the trip.' },
  { id: 'landing', label: 'Landing burn (13 → 3)', lit: ['c', 'm'], then: ['c'],
    note: 'The landing burn starts with 13 engines to kill speed fast, then drops to just the 3 gimbaling center engines for a precise, slow hover into the tower arms.' },
];
function buildLayout() {
  const state = { mode: 'liftoff', failed: new Set(), lit: new Set(), timer: 0, stage: '' };
  const engines = [];
  const R_OUTER = 155, R_MID = 95, R_CENTER = 32, R_NOZ = 24;
  let n = 1;
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i / 3) * Math.PI * 2; engines.push({ id: n++, ring: 'c', x: 200 + Math.cos(a) * R_CENTER, y: 200 + Math.sin(a) * R_CENTER }); }
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + ((i + 0.5) / 10) * Math.PI * 2; engines.push({ id: n++, ring: 'm', x: 200 + Math.cos(a) * R_MID, y: 200 + Math.sin(a) * R_MID }); }
  for (let i = 0; i < 20; i++) { const a = -Math.PI / 2 + (i / 20) * Math.PI * 2; engines.push({ id: n++, ring: 'o', x: 200 + Math.cos(a) * R_OUTER, y: 200 + Math.sin(a) * R_OUTER }); }
  const RING_NAME = { c: 'center', m: 'middle ring', o: 'outer ring' };

  const svg = s('svg', { viewBox: '0 0 400 400', class: 'rp-booster-svg', role: 'group', 'aria-label': 'Super Heavy booster seen from below, 33 engines' });
  const defs = s('defs');
  const glow = s('filter', { id: 'rp-eng-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
  glow.append(s('feGaussianBlur', { stdDeviation: 4 }));
  defs.append(glow);
  svg.append(defs,
    s('circle', { cx: 200, cy: 200, r: 190, class: 'rp-hull' }),
    s('circle', { cx: 200, cy: 200, r: 182, class: 'rp-hull-inner' }),
    s('circle', { cx: 200, cy: 200, r: R_OUTER, class: 'rp-ring-guide' }),
    s('circle', { cx: 200, cy: 200, r: R_MID, class: 'rp-ring-guide rp-ring-gimbal' }),
    s('circle', { cx: 200, cy: 200, r: R_CENTER, class: 'rp-ring-guide rp-ring-gimbal' }));
  const gEng = s('g', { class: 'rp-engines' });
  svg.append(gEng);
  for (const e of engines) {
    const g = s('g', { class: `rp-eng rp-eng-${e.ring}`, tabindex: 0, role: 'button', 'aria-pressed': 'false', 'data-id': e.id });
    g.append(s('circle', { cx: e.x, cy: e.y, r: R_NOZ + 6, class: 'rp-eng-glow', filter: 'url(#rp-eng-glow)' }),
      s('circle', { cx: e.x, cy: e.y, r: R_NOZ, class: 'rp-eng-lip' }),
      s('circle', { cx: e.x, cy: e.y, r: R_NOZ * 0.58, class: 'rp-eng-core' }),
      s('path', { d: `M${e.x - 8},${e.y - 8} L${e.x + 8},${e.y + 8} M${e.x + 8},${e.y - 8} L${e.x - 8},${e.y + 8}`, class: 'rp-eng-x' }));
    e.el = g;
    g.addEventListener('click', () => toggleFail(e));
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleFail(e); } });
    gEng.append(g);
  }

  /* controls */
  const modeBtns = {};
  const modeBar = h('div', { class: 'rp-modes', role: 'group', 'aria-label': 'Flight phase' });
  for (const m of MODES) {
    modeBtns[m.id] = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', text: m.label, onclick: () => setMode(m.id, true) });
    modeBar.append(modeBtns[m.id]);
  }
  const modeNote = h('p', { class: 'rp-mode-note' });
  const stageLbl = h('span', { class: 'chip rp-stage' });
  const ro = { lit: h('dd', { class: 'v' }), thrust: h('dd', { class: 'v' }), twr: h('dd', { class: 'v' }), out: h('dd', { class: 'v' }) };
  const readout = h('dl', { class: 'rp-readouts rp-readouts-4' },
    h('div', { class: 'stat' }, h('dt', { class: 'k', text: 'Engines running' }), ro.lit),
    h('div', { class: 'stat' }, h('dt', { class: 'k', text: 'Engines out' }), ro.out),
    h('div', { class: 'stat' }, h('dt', { class: 'k', text: 'Total thrust' }), ro.thrust),
    h('div', { class: 'stat' }, h('dt', { class: 'k', text: 'Thrust-to-weight at liftoff' }), ro.twr));
  const resetBtn = h('button', { class: 'btn', type: 'button', text: 'Reset engines', onclick: () => { state.failed.clear(); refresh(); } });
  const verdict = h('p', { class: 'rp-verdict mono' });

  function setMode(id, replay) {
    state.mode = id;
    clearTimeout(state.timer);
    for (const k in modeBtns) modeBtns[k].setAttribute('aria-pressed', String(k === id));
    const m = MODES.find(x => x.id === id);
    modeNote.textContent = m.note;
    state.lit = new Set(m.lit);
    state.stage = m.then ? 'step 1 of 2 · 13 engines' : '';
    refresh();
    if (m.then) {
      state.timer = setTimeout(() => {
        state.lit = new Set(m.then);
        state.stage = 'step 2 of 2 · 3 center engines';
        refresh();
      }, reduced() ? 2200 : 1600);
    }
    void replay;
  }
  function toggleFail(e) {
    state.failed.has(e.id) ? state.failed.delete(e.id) : state.failed.add(e.id);
    refresh();
  }
  function refresh() {
    let running = 0;
    for (const e of engines) {
      const lit = state.lit.has(e.ring) && !state.failed.has(e.id);
      const out = state.failed.has(e.id);
      e.el.classList.toggle('is-lit', lit);
      e.el.classList.toggle('is-out', out);
      e.el.setAttribute('aria-pressed', String(out));
      e.el.setAttribute('aria-label', `Engine ${e.id}, ${RING_NAME[e.ring]}${e.ring === 'o' ? ', fixed' : ', gimbaled'}: ${out ? 'shut down (click to restore)' : lit ? 'running (click to simulate an engine-out)' : 'off in this phase (click to mark as failed)'}`);
      if (lit) running++;
    }
    const thrust = running * RAPTOR3.thrust;
    const twr = thrust / STACK_MASS_T;
    ro.lit.textContent = String(running);
    ro.out.textContent = String(state.failed.size);
    ro.thrust.textContent = `~${fmt(thrust)} tf`;
    const isLiftoff = state.mode === 'liftoff';
    ro.twr.textContent = isLiftoff ? `~${twr.toFixed(2)}` : '—';
    ro.twr.dataset.state = !isLiftoff ? '' : twr >= 1.3 ? 'ok' : twr >= 1.0 ? 'warn' : 'bad';
    stageLbl.textContent = state.stage;
    stageLbl.hidden = !state.stage;
    if (isLiftoff) {
      verdict.textContent = twr < 1 ? `Below 1 — ${fmt(thrust)} tf cannot lift ~${fmt(STACK_MASS_T)} t. The vehicle stays on the pad (the computer would abort before release).`
        : twr < 1.3 ? `Marginal. It would lift off, but slowly: gravity losses eat into performance and the margin for another failure is thin.`
        : `Healthy. ${running} × ${RAPTOR3.thrust} tf ≈ ${fmt(thrust)} tf against ~${fmt(STACK_MASS_T)} t. Each lost engine costs about ${(RAPTOR3.thrust / STACK_MASS_T).toFixed(3)} of TWR.`;
    } else {
      verdict.textContent = `${running} engine${running === 1 ? '' : 's'} running in this phase. Thrust-to-weight is shown for liftoff only, when the full stack weighs ~${fmt(STACK_MASS_T)} t.`;
    }
  }

  /* ship bottom view */
  const ship = s('svg', { viewBox: '0 0 400 400', class: 'rp-ship-svg', role: 'img', 'aria-label': 'Starship seen from below: three sea-level Raptors in the center and three Raptor Vacuum engines around them' });
  ship.append(s('circle', { cx: 200, cy: 200, r: 190, class: 'rp-hull' }), s('circle', { cx: 200, cy: 200, r: 182, class: 'rp-hull-inner' }),
    s('circle', { cx: 200, cy: 200, r: 42, class: 'rp-ring-guide rp-ring-gimbal' }));
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 6 + (i / 3) * Math.PI * 2, x = 200 + Math.cos(a) * 118, y = 200 + Math.sin(a) * 118;
    ship.append(s('g', { class: 'rp-eng rp-eng-vac is-lit' }, s('circle', { cx: x, cy: y, r: 52, class: 'rp-eng-glow', filter: 'url(#rp-eng-glow)' }), s('circle', { cx: x, cy: y, r: 47, class: 'rp-eng-lip' }), s('circle', { cx: x, cy: y, r: 20, class: 'rp-eng-core' })));
  }
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i / 3) * Math.PI * 2, x = 200 + Math.cos(a) * 42, y = 200 + Math.sin(a) * 42;
    ship.append(s('g', { class: 'rp-eng rp-eng-c is-lit' }, s('circle', { cx: x, cy: y, r: 30, class: 'rp-eng-glow', filter: 'url(#rp-eng-glow)' }), s('circle', { cx: x, cy: y, r: 24, class: 'rp-eng-lip' }), s('circle', { cx: x, cy: y, r: 14, class: 'rp-eng-core' })));
  }
  ship.append(s('text', { x: 200, y: 30, class: 'rp-lbl', 'text-anchor': 'middle', text: '3 × RVac  ·  outer, fixed' }),
    s('text', { x: 200, y: 376, class: 'rp-lbl', 'text-anchor': 'middle', text: '3 × sea-level  ·  center, gimbaled' }));

  const boosterLegend = h('ul', { class: 'rp-eng-legend' },
    h('li', {}, h('i', { class: 'rp-key rp-key-c' }), h('span', { html: '<strong>3 center</strong> · gimbaled. Steer during ascent and do the final landing hover.' })),
    h('li', {}, h('i', { class: 'rp-key rp-key-m' }), h('span', { html: '<strong>10 middle ring</strong> · gimbaled. Relit for boostback and landing.' })),
    h('li', {}, h('i', { class: 'rp-key rp-key-o' }), h('span', { html: '<strong>20 outer ring</strong> · fixed, no gimbal. Started on the pad by ground equipment; run only during ascent.' })));

  const root = h('div', { class: 'rp-layout' },
    h('div', { class: 'rp-block-head' }, h('h3', { text: 'Thirty-three engines, three rings, four jobs.' }),
      h('p', { class: 'rp-block-lede', text: 'Super Heavy seen from below. Pick a phase of flight to see which engines run — then click engines to shut them down and watch what it does to the numbers.' })),
    h('div', { class: 'grid-2 rp-layout-grid' },
      h('div', { class: 'panel rp-booster-panel' },
        h('div', { class: 'rp-modes-head' }, modeBar, stageLbl),
        svg,
        modeNote,
        boosterLegend),
      h('div', { class: 'rp-layout-side' },
        h('div', { class: 'panel rp-engineout' },
          h('div', { class: 'rp-engineout-head' }, h('p', { class: 'rp-kicker', text: 'Engine-out demo' }), resetBtn),
          readout, verdict,
          h('p', { class: 'note', text: `Approximate arithmetic: ${RAPTOR3.thrust} tf per Raptor 3 and a ~${fmt(STACK_MASS_T)} t full stack at liftoff (33 × 280 ≈ 9,240 tf, TWR ≈ 1.85). With Raptor 2 (~230 tf) the figures are ~7,600 tf and ~1.5. Starship is designed to keep flying with a few engines out; several test flights have lost engines and still completed the booster's return.` })),
        h('div', { class: 'panel rp-ship-panel' },
          h('p', { class: 'rp-kicker', text: 'Starship (the ship)' }),
          ship,
          h('p', { text: 'Six engines: three sea-level Raptors in the center that gimbal to steer and to perform the landing flip, and three fixed Raptor Vacuums around them for efficient thrust in space.' })))));

  setMode('liftoff');
  return { root };
}

/* ============================================================
   4. WHY METHANE
   ============================================================ */
function buildMethane() {
  return h('div', { class: 'rp-methane panel' },
    h('div', { class: 'rp-methane-text' },
      h('p', { class: 'rp-kicker', text: 'Why methane?' }),
      h('h3', { text: 'Clean to burn, cheap to buy, and you can make it on Mars.' }),
      h('p', { text: 'Kerosene, the Falcon 9 fuel, leaves soot (coking) inside the engine that has to be scrubbed out between flights. Methane burns clean, so a Raptor can be reflown with far less refurbishment. It is also dense enough to keep the tanks a sensible size (unlike hydrogen), easy to store sub-cooled next to liquid oxygen since the two boil at similar temperatures, and plentiful as natural gas.' }),
      h('p', { text: 'The long game is Mars. Its thin atmosphere is mostly carbon dioxide and there is water ice in the ground. Electricity from solar panels splits the water, and the Sabatier reaction turns the hydrogen and CO₂ into methane. The oxygen left over from the electrolysis is the oxidizer. A ship that can refill its own tanks is a ship that can come home.' })),
    h('div', { class: 'rp-methane-eq mono', 'aria-label': 'Reactions used to make propellant on Mars' },
      h('div', { class: 'rp-eq' }, h('span', { class: 'rp-eq-k', text: 'electrolysis' }), h('span', { html: '2 H<sub>2</sub>O → 2 H<sub>2</sub> + O<sub>2</sub>' })),
      h('div', { class: 'rp-eq' }, h('span', { class: 'rp-eq-k', text: 'Sabatier' }), h('span', { html: 'CO<sub>2</sub> + 4 H<sub>2</sub> → CH<sub>4</sub> + 2 H<sub>2</sub>O' })),
      h('div', { class: 'rp-eq rp-eq-result' }, h('span', { class: 'rp-eq-k', text: 'in the tanks' }), h('span', { html: 'CH<sub>4</sub> (fuel) + O<sub>2</sub> (oxidizer)' })),
      h('p', { class: 'note', text: 'Water from the Sabatier step is recycled back into the electrolyser. Raptor burns about 3.6 parts oxygen to 1 part methane by mass.' })));
}

/* ============================================================
   MOUNT
   ============================================================ */
function main() {
  const mount = document.getElementById('mount-raptor');
  if (!mount) return;
  const schematic = buildSchematic();
  const gens = buildGenerations();
  const layout = buildLayout();
  mount.append(schematic.root, gens.root, layout.root, buildMethane());

  // Pause the particle loop when the schematic is off-screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (en.target === schematic.root) schematic.setVisible(en.isIntersecting);
        if (en.target === gens.root && en.isIntersecting) { gens.reveal(); io.unobserve(gens.root); }
      }
    }, { rootMargin: '80px 0px', threshold: 0.02 });
    io.observe(schematic.root);
    io.observe(gens.root);
  } else {
    schematic.setVisible(true);
    gens.reveal();
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
else main();

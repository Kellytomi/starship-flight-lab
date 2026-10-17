/* ============================================================
   Starship, Explained — 05 Boostback & the catch
   Self-contained module: renders into #mount-catch.
   A) step-through explainer (SVG)   B) tower anatomy (SVG)
   C) "Catch it yourself" canvas mini-game
   ============================================================ */

/* ---------------- tiny helpers ---------------- */
const SVG_NS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = matchMedia('(pointer: coarse)');

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) n.append(c);
  return n;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);

/* Read design tokens once so canvas drawing uses the same palette. */
const cs = getComputedStyle(document.documentElement);
const T = (name, fallback) => (cs.getPropertyValue(name) || fallback).trim();
const C = {
  bg: T('--bg', '#04060a'), bg2: T('--bg-2', '#080c13'), panel: T('--panel', '#0c121b'),
  panel2: T('--panel-2', '#111925'), line: T('--line', '#1b2533'), line2: T('--line-2', '#2a3647'),
  text: T('--text', '#e8edf3'), text2: T('--text-2', '#b4c0ce'), muted: T('--muted', '#7b889a'),
  faint: T('--faint', '#4b5768'), steel: T('--steel', '#c9d3de'), steelDark: T('--steel-dark', '#8d99a8'),
  flame: T('--flame', '#ff7a1a'), flame2: T('--flame-2', '#ffc46b'), plasma: T('--plasma', '#ff4f6d'),
  methane: T('--methane', '#45b8ff'), lox: T('--lox', '#a8f0ff'), booster: T('--booster', '#e7b65a'),
  ship: T('--ship', '#7fd4c1'), tower: T('--tower', '#9aa7ff'), ok: T('--ok', '#4ade80'), warn: T('--warn', '#facc15'), bad: T('--bad', '#f87171'),
};
function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ============================================================
   INIT
   ============================================================ */
function init(root) {
  root.classList.add('catch-root');
  root.append(buildExplainer(), buildTower(), buildGame());
}

/* ============================================================
   PART A — Step-through explainer
   ============================================================ */
const STEPS = [
  {
    id: 'meco', f: 0.0, rot: 72, plume: 0.35, title: 'MECO & hot staging',
    time: '~T+2:40', alt: '~65–70 km', speed: '~5,500 km/h', engines: '33 → 3',
    body: 'Most of the booster’s 33 engines shut down at main engine cut-off, leaving only the three gimballing centre engines running. Starship lights its own engines while still attached, firing through the vented hot-stage ring, and pushes itself away. The booster is now a near-empty steel tube travelling sideways at hypersonic speed.',
  },
  {
    id: 'flip', f: 0.13, rot: -100, plume: 0.0, title: 'The flip',
    time: '~T+2:45', alt: '~70 km', speed: '~5,400 km/h', engines: '3 (gimballing)',
    body: 'Freed from the ship, the booster swings itself around by roughly 180° using engine gimbal and cold-gas thrusters, so that its engines face into the direction of travel. In the thin air at 70 km there is almost no aerodynamic force to fight, so the rotation takes only a few seconds.',
  },
  {
    id: 'boostback', f: 0.28, rot: -100, plume: 1.0, title: 'Boostback burn',
    time: '~T+2:50 – 3:50', alt: '~75 → 95 km', speed: '5,400 → ~1,200 km/h', engines: '13',
    body: 'Ten more engines relight, so 13 of the centre engines push against the booster’s eastward velocity. Over about a minute the burn cancels the horizontal speed and then reverses it, bending the trajectory back toward the launch site. The booster is still climbing, and coasts up to an apogee of roughly 90–100 km.',
  },
  {
    id: 'coast', f: 0.58, rot: -8, plume: 0.0, title: 'Coast & descent',
    time: '~T+4:00 – 6:15', alt: '~95 km → 5 km', speed: 'up to ~4,500 km/h', engines: '0',
    body: 'Engines off, the booster falls engines-first back into the atmosphere. Four grid fins near the top (three larger ones on the Block 3 booster) act like moving stabilisers, steering it toward a point in the Gulf just offshore. Air drag does most of the braking: the booster is transonic by about T+6 and its skin glows from the heat.',
  },
  {
    id: 'landing', f: 0.83, rot: -4, plume: 0.8, title: 'Landing burn',
    time: '~T+6:20', alt: '~2 km → 100 m', speed: '~1,000 → ~15 km/h', engines: '13 → 3',
    body: '13 engines light for the landing burn, then shut down in stages to the three centre engines for fine control. Only now does the booster divert from its offshore aim point to the tower — and only if every health check passes. The Flight Director must call “go for catch”; if anything is marginal the booster keeps its course and splashes down in the Gulf.',
  },
  {
    id: 'catch', f: 1.0, rot: 0, plume: 0.3, title: 'The catch',
    time: '~T+7:00', alt: '~85 m (arms)', speed: '< ~2 m/s', engines: '3',
    body: 'The booster slows to a near-hover beside the tower and translates sideways between the open chopsticks. The arms close, and the booster settles onto them via small catch pins below the grid fins; shock absorbers on the arms take up the load. The arms ride a carriage that moves up and down the tower, so it can lower the booster onto the launch mount. First success: Flight 5, 13 October 2024.',
  },
];

function buildExplainer() {
  const part = el('section', { class: 'catch-part', 'aria-labelledby': 'catch-a-title' });
  part.append(
    el('div', { class: 'catch-part-head' }, [
      el('span', { class: 'chip catch-part-chip', text: 'Part A' }),
      el('h3', { id: 'catch-a-title', text: 'Seven minutes from staging to the tower' }),
      el('p', { class: 'catch-part-lede', text: 'Step through the booster’s return. The scene is schematic: altitudes are to a rough scale, the tower is not.' }),
    ]),
  );

  const grid = el('div', { class: 'catch-explainer grid-2' });
  const sceneBox = el('div', { class: 'panel catch-scene-box' });
  sceneBox.innerHTML = `
  <svg class="catch-scene" viewBox="0 0 800 440" role="img" aria-label="Side view of the booster trajectory from staging back to the launch tower">
    <defs>
      <linearGradient id="cx-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.bg}"/><stop offset="1" stop-color="${C.panel2}"/>
      </linearGradient>
      <linearGradient id="cx-steel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${C.steelDark}"/><stop offset=".45" stop-color="${C.steel}"/><stop offset="1" stop-color="${C.steelDark}"/>
      </linearGradient>
      <linearGradient id="cx-flame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.flame2}"/><stop offset=".5" stop-color="${C.flame}"/><stop offset="1" stop-color="${C.flame}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="cx-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${rgba(C.methane, 0.35)}"/><stop offset="1" stop-color="${rgba(C.methane, 0.05)}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="440" fill="url(#cx-sky)"/>
    <g class="cx-grid" font-family="var(--font-mono)" font-size="10" fill="${C.faint}">
      <line x1="0" y1="40" x2="800" y2="40" stroke="${C.line}" stroke-dasharray="3 5"/><text x="8" y="36">100 km</text>
      <line x1="0" y1="210" x2="800" y2="210" stroke="${C.line}" stroke-dasharray="3 5"/><text x="8" y="206">50 km</text>
      <line x1="0" y1="312" x2="800" y2="312" stroke="${C.line}" stroke-dasharray="3 5"/><text x="8" y="308">20 km</text>
      <text x="8" y="376">0 km</text>
    </g>
    <rect x="0" y="380" width="800" height="60" fill="${C.panel}"/>
    <rect x="0" y="380" width="210" height="60" fill="${rgba(C.booster, 0.12)}"/>
    <rect x="210" y="380" width="590" height="60" fill="url(#cx-water)"/>
    <line x1="0" y1="380" x2="800" y2="380" stroke="${C.line2}"/>
    <g font-family="var(--font-mono)" font-size="10" fill="${C.muted}" letter-spacing=".1em">
      <text x="24" y="430">STARBASE, TX</text>
      <text x="520" y="430">GULF OF MEXICO</text>
    </g>
    <!-- offshore aim point -->
    <g class="cx-aim" transform="translate(250,380)">
      <circle r="4" fill="none" stroke="${C.warn}" stroke-width="1.5"/><line x1="0" y1="-9" x2="0" y2="9" stroke="${C.warn}" stroke-width="1"/><line x1="-9" y1="0" x2="9" y2="0" stroke="${C.warn}" stroke-width="1"/>
      <text x="12" y="-8" font-family="var(--font-mono)" font-size="10" fill="${C.warn}">offshore aim point</text>
    </g>
    <!-- tower (not to scale) -->
    <g class="cx-tower" transform="translate(88,380)">
      <rect x="-5" y="-62" width="10" height="62" fill="${C.panel2}" stroke="${C.tower}" stroke-width="1"/>
      <path d="M-5,-10 l10,-10 M-5,-20 l10,-10 M-5,-30 l10,-10 M-5,-40 l10,-10 M-5,-50 l10,-10" stroke="${rgba(C.tower, 0.5)}" stroke-width="1"/>
      <g class="cx-arms"><rect x="5" y="-44" width="22" height="3" fill="${C.tower}"/><rect x="5" y="-38" width="22" height="3" fill="${C.tower}"/></g>
      <rect x="14" y="-6" width="26" height="6" fill="${C.line2}"/>
      <text x="-10" y="-70" font-family="var(--font-mono)" font-size="10" fill="${C.tower}">TOWER</text>
    </g>
    <!-- ascent (ghost) -->
    <path d="M100,375 Q300,170 560,90" fill="none" stroke="${C.faint}" stroke-width="1.5" stroke-dasharray="2 6"/>
    <text x="330" y="235" font-family="var(--font-mono)" font-size="10" fill="${C.faint}" transform="rotate(-27 330 235)">ASCENT (STACK)</text>
    <!-- return trajectory -->
    <path class="cx-path-ghost" fill="none" stroke="${C.line2}" stroke-width="1.5"/>
    <path class="cx-path" fill="none" stroke="${C.booster}" stroke-width="2.5" stroke-linecap="round"/>
    <text x="608" y="24" font-family="var(--font-mono)" font-size="10" fill="${C.muted}">APOGEE ~95 km</text>
    <g class="cx-markers"></g>
    <!-- ship -->
    <g class="cx-ship">
      <path d="M0,-30 C6,-20 6,-5 6,22 L-6,22 C-6,-5 -6,-20 0,-30z" fill="url(#cx-steel)"/>
      <path d="M-6,-6 l-5,3 v14 l5,2z M6,-6 l5,3 v14 l-5,2z" fill="${C.ship}" opacity=".9"/>
      <path class="cx-ship-plume" d="M-4,23 L0,52 L4,23z" fill="url(#cx-flame)"/>
    </g>
    <!-- booster -->
    <g class="cx-booster">
      <g class="cx-plume"><path d="M-4.5,36 L0,110 L4.5,36z" fill="url(#cx-flame)"/><path d="M-2,36 L0,80 L2,36z" fill="${C.flame2}" opacity=".8"/></g>
      <rect x="-5" y="-36" width="10" height="72" rx="1" fill="url(#cx-steel)"/>
      <rect x="-5" y="-36" width="10" height="4" fill="${C.steelDark}"/>
      <rect x="-5" y="30" width="10" height="6" fill="${C.faint}"/>
      <rect x="-9" y="-30" width="4" height="7" rx="1" fill="${C.booster}"/>
      <rect x="5" y="-30" width="4" height="7" rx="1" fill="${C.booster}"/>
      <rect x="-6" y="-21" width="2" height="2" fill="${C.text}"/><rect x="4" y="-21" width="2" height="2" fill="${C.text}"/>
    </g>
  </svg>`;
  const svg = sceneBox.querySelector('svg');
  const PATH_D = 'M560,90 C620,58 700,24 672,34 C600,58 420,70 300,150 C240,190 160,250 112,336';
  const pathGhost = svg.querySelector('.cx-path-ghost');
  const path = svg.querySelector('.cx-path');
  pathGhost.setAttribute('d', PATH_D);
  path.setAttribute('d', PATH_D);
  const booster = svg.querySelector('.cx-booster');
  const plume = svg.querySelector('.cx-plume');
  const ship = svg.querySelector('.cx-ship');
  const arms = svg.querySelector('.cx-arms');
  const markers = svg.querySelector('.cx-markers');

  /* ---- step card ---- */
  const card = el('div', { class: 'panel catch-step-card' });
  const stepNum = el('div', { class: 'catch-step-num mono' });
  const stepTitle = el('h4', { class: 'catch-step-title' });
  const stepBody = el('p', { class: 'catch-step-body' });
  const stats = el('dl', { class: 'catch-step-stats' });
  const statEls = {};
  for (const [k, label] of [['time', 'Mission time'], ['alt', 'Altitude'], ['speed', 'Speed'], ['engines', 'Engines lit']]) {
    const v = el('dd', { class: 'v' });
    stats.append(el('div', { class: 'stat' }, [el('dt', { class: 'k', text: label }), v]));
    statEls[k] = v;
  }
  const nav = el('div', { class: 'catch-step-nav' });
  const prevBtn = el('button', { class: 'btn', type: 'button', 'aria-label': 'Previous step', text: '← Prev' });
  const nextBtn = el('button', { class: 'btn', type: 'button', 'aria-label': 'Next step', text: 'Next →' });
  nav.append(prevBtn, nextBtn);
  card.append(stepNum, stepTitle, stepBody, stats, nav);

  /* ---- pills + scrubber ---- */
  const pills = el('div', { class: 'catch-pills', role: 'tablist', 'aria-label': 'Return steps' });
  const pillEls = STEPS.map((s, i) => {
    const b = el('button', { class: 'catch-pill', type: 'button', role: 'tab', 'aria-selected': 'false', 'data-i': i }, [
      el('span', { class: 'catch-pill-n', text: String(i + 1) }), el('span', { class: 'catch-pill-t', text: s.title }),
    ]);
    b.addEventListener('click', () => goTo(i));
    pills.append(b);
    return b;
  });
  const scrubWrap = el('div', { class: 'catch-scrub' });
  const scrub = el('input', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': 'Scrub through the booster’s return' });
  scrubWrap.append(el('span', { class: 'mono catch-scrub-l', text: 'T+2:40' }), scrub, el('span', { class: 'mono catch-scrub-l', text: 'T+7:00' }));

  grid.append(el('div', { class: 'catch-explainer-left' }, [sceneBox, pills, scrubWrap]), card);
  part.append(grid);

  /* ---- scene state machine ---- */
  let len = 0;
  let f = 0, stepIndex = -1, raf = 0, tweenFrom = 0, tweenTo = 0, tweenStart = 0, tweenDur = 0;

  function stateAt(fv) {
    let i = 0;
    while (i < STEPS.length - 2 && fv > STEPS[i + 1].f) i++;
    const a = STEPS[i], b = STEPS[i + 1];
    const t = clamp((fv - a.f) / (b.f - a.f), 0, 1);
    const tRot = smooth(clamp((t - 0.1) / 0.8, 0, 1));
    const tPl = b.plume > a.plume ? clamp((t - 0.7) / 0.3, 0, 1) : clamp(t / 0.3, 0, 1);
    return { rot: lerp(a.rot, b.rot, tRot), plume: lerp(a.plume, b.plume, tPl), seg: i, t };
  }
  function nearestStep(fv) {
    let best = 0, bd = Infinity;
    STEPS.forEach((s, i) => { const d = Math.abs(s.f - fv); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function render() {
    if (!len) len = path.getTotalLength();
    const p = path.getPointAtLength(f * len);
    const st = stateAt(f);
    booster.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${st.rot.toFixed(1)})`);
    plume.setAttribute('transform', `scale(1,${Math.max(0.0001, st.plume).toFixed(3)})`);
    plume.style.opacity = st.plume > 0.02 ? '1' : '0';
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len * (1 - f)}`;
    // ship separates during step 1 -> 2
    const sT = clamp(f / 0.13, 0, 1);
    if (sT < 1) {
      ship.style.opacity = String(1 - sT);
      ship.setAttribute('transform', `translate(${560 + 10 + sT * 130},${90 - 14 - sT * 70}) rotate(66)`);
    } else ship.style.opacity = '0';
    // arms close at the very end
    const close = clamp((f - 0.97) / 0.03, 0, 1);
    arms.setAttribute('transform', `translate(0,${(-2 * close).toFixed(1)})`);
    arms.style.opacity = String(0.7 + 0.3 * close);
    scrub.value = String(Math.round(f * 1000));
    const ns = nearestStep(f);
    if (ns !== stepIndex) setStep(ns);
  }
  function setStep(i) {
    stepIndex = i;
    const s = STEPS[i];
    stepNum.textContent = `STEP ${i + 1} / ${STEPS.length}`;
    stepTitle.textContent = s.title;
    stepBody.textContent = s.body;
    for (const k of Object.keys(statEls)) statEls[k].textContent = s[k];
    pillEls.forEach((b, j) => { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.classList.toggle('is-active', j === i); });
    markers.querySelectorAll('g').forEach((g, j) => g.classList.toggle('is-active', j === i));
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === STEPS.length - 1;
    scrub.setAttribute('aria-valuetext', `Step ${i + 1}: ${s.title}`);
  }
  function tick(now) {
    const t = clamp((now - tweenStart) / tweenDur, 0, 1);
    f = lerp(tweenFrom, tweenTo, easeOut(t));
    render();
    if (t < 1) raf = requestAnimationFrame(tick);
    else raf = 0;
  }
  function animateTo(target) {
    cancelAnimationFrame(raf);
    if (reduceMotion.matches) { f = target; render(); return; }
    tweenFrom = f; tweenTo = target; tweenStart = performance.now();
    tweenDur = 500 + 1400 * Math.abs(target - f);
    raf = requestAnimationFrame(tick);
  }
  function goTo(i) { animateTo(STEPS[clamp(i, 0, STEPS.length - 1)].f); }
  prevBtn.addEventListener('click', () => goTo(stepIndex - 1));
  nextBtn.addEventListener('click', () => goTo(stepIndex + 1));
  scrub.addEventListener('input', () => { cancelAnimationFrame(raf); raf = 0; f = Number(scrub.value) / 1000; render(); });
  pills.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(stepIndex + 1); pillEls[clamp(stepIndex + 1, 0, 5)].focus(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(stepIndex - 1); pillEls[clamp(stepIndex - 1, 0, 5)].focus(); }
  });

  // markers along the path (numbered, clickable)
  requestAnimationFrame(() => {
    len = path.getTotalLength();
    STEPS.forEach((s, i) => {
      const p = path.getPointAtLength(s.f * len);
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'cx-marker');
      g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
      g.innerHTML = `<circle r="9" fill="${C.panel}" stroke="${C.booster}" stroke-width="1.5"/><text y="3.5" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="${C.text}">${i + 1}</text>`;
      g.addEventListener('click', () => goTo(i));
      markers.append(g);
    });
    render();
  });

  return part;
}

/* ============================================================
   PART B — Tower anatomy ("Mechazilla")
   ============================================================ */
const TOWER_PARTS = [
  { id: 'tower', x: 180, y: 110, name: 'Integration tower', chip: '~145 m', body: 'A square steel lattice tower, roughly 145 m tall — taller than the full 123 m stack. It carries the arms, the propellant and power umbilicals, and the lift system. Internally nicknamed “Mechazilla”.' },
  { id: 'chop', x: 318, y: 290, name: 'Chopsticks (catch arms)', chip: '~36 m long', body: 'Two steel arms that can open and close like a pincer. They lift the booster and ship onto the mount for stacking, and they catch the booster on its way back. Hydraulic actuators at the hinge swing them; the arms are mostly stacked tanks of ballast and steel.' },
  { id: 'carriage', x: 222, y: 318, name: 'Carriage & draw-works', chip: 'moves vertically', body: 'The arms hang from a carriage that rides on rails up the tower, pulled by cables from a winch (the draw-works) at the top. That is how the arms can raise the booster off the mount, or lower a caught booster back onto it.' },
  { id: 'shock', x: 268, y: 304, name: 'Shock absorbers & rails', chip: 'catch load', body: 'The booster lands on a pair of rails along the arms, which sit on shock absorbers. They take up the remaining downward motion of a 200-plus-tonne booster. The rails also let the arms slide the booster into exact position for stacking.' },
  { id: 'pins', x: 371, y: 276, name: 'Catch pins', chip: 'under grid fins', body: 'Small hardened steel fittings on the booster’s upper section, just below the grid fins. The booster hangs from these two pins on the arm rails. On Block 2 the grid-fin hard points doubled as catch points; later boosters use dedicated fittings.' },
  { id: 'qd', x: 288, y: 234, name: 'Ship quick-disconnect arm', chip: 'fuels Starship', body: 'A separate, shorter arm that swings in to plug the ship’s umbilical plate: methane, liquid oxygen, power and data. It swings back just before liftoff. The booster has its own quick-disconnect built into the launch mount below.' },
  { id: 'olm', x: 345, y: 578, name: 'Orbital launch mount (OLM)', chip: 'hold-downs + booster QD', body: 'A ring on six legs that the booster sits on for launch. It holds the vehicle with clamps, supplies the booster’s propellant through its own quick-disconnect, and contains the hold-down and release hardware.' },
  { id: 'deluge', x: 345, y: 626, name: 'Flame deflector & deluge', chip: 'water-cooled steel', body: 'Beneath the mount, a water-cooled steel plate sprays huge volumes of water upward at ignition to absorb the heat and sound of 33 engines. It was added after the first flight dug a crater under the pad.' },
];

function buildTower() {
  const part = el('section', { class: 'catch-part', 'aria-labelledby': 'catch-b-title' });
  part.append(
    el('div', { class: 'catch-part-head' }, [
      el('span', { class: 'chip catch-part-chip', text: 'Part B' }),
      el('h3', { id: 'catch-b-title', text: 'Anatomy of the tower' }),
      el('p', { class: 'catch-part-lede', text: 'The same arms that stack the rocket also catch it. Hover or tap a hotspot.' }),
    ]),
  );
  const grid = el('div', { class: 'catch-tower grid-2' });
  const box = el('div', { class: 'panel catch-tower-box' });

  // Scale: 600 px for 145 m => ~4.14 px/m. Stack of 123 m on an 18 m mount.
  const G = 640;             // ground y
  const PXM = 600 / 145;     // px per metre
  const olmTop = G - 18 * PXM;
  const bH = 71 * PXM, sH = 52 * PXM;
  const bTop = olmTop - bH, sTop = bTop - sH;
  const bx = 346, bw = 9 * PXM;

  let lattice = '';
  for (let y = 40; y < G; y += 24) lattice += `M150,${y} L210,${y + 24} M210,${y} L150,${y + 24} M150,${y} h60 `;

  box.innerHTML = `
  <svg class="catch-tower-svg" viewBox="0 0 480 680" role="img" aria-label="Diagram of the launch tower with chopsticks, quick-disconnect arm and launch mount">
    <defs>
      <linearGradient id="ct-steel" x1="0" x2="1"><stop offset="0" stop-color="${C.steelDark}"/><stop offset=".45" stop-color="${C.steel}"/><stop offset="1" stop-color="${C.steelDark}"/></linearGradient>
      <linearGradient id="ct-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}"/><stop offset="1" stop-color="${C.panel2}"/></linearGradient>
    </defs>
    <rect width="480" height="680" fill="url(#ct-sky)"/>
    <g font-family="var(--font-mono)" font-size="10" fill="${C.faint}">
      <line x1="60" y1="${G - 100 * PXM}" x2="460" y2="${G - 100 * PXM}" stroke="${C.line}" stroke-dasharray="3 5"/><text x="420" y="${G - 100 * PXM - 4}">100 m</text>
      <line x1="60" y1="${G - 50 * PXM}" x2="460" y2="${G - 50 * PXM}" stroke="${C.line}" stroke-dasharray="3 5"/><text x="426" y="${G - 50 * PXM - 4}">50 m</text>
    </g>
    <!-- height dimension -->
    <g stroke="${C.tower}" fill="${C.tower}" font-family="var(--font-mono)" font-size="11">
      <line x1="110" y1="40" x2="110" y2="${G}" stroke-dasharray="2 4" opacity=".6"/>
      <line x1="104" y1="40" x2="116" y2="40"/><line x1="104" y1="${G}" x2="116" y2="${G}"/>
      <text x="100" y="340" text-anchor="end" stroke="none">~145 m</text>
    </g>
    <!-- tower -->
    <rect x="150" y="40" width="60" height="${G - 40}" fill="${C.panel}" stroke="${C.tower}" stroke-width="1.2"/>
    <path d="${lattice}" stroke="${rgba(C.tower, 0.45)}" stroke-width="1" fill="none"/>
    <rect x="144" y="28" width="72" height="16" rx="2" fill="${C.panel2}" stroke="${C.tower}"/>
    <rect x="208" y="40" width="4" height="${G - 40}" fill="${rgba(C.tower, 0.6)}"/>
    <!-- cables -->
    <line x1="222" y1="44" x2="222" y2="296" stroke="${C.steelDark}" stroke-width="1" stroke-dasharray="1 3"/>
    <!-- OLM -->
    <g>
      <rect x="296" y="${olmTop}" width="100" height="14" rx="2" fill="${C.panel2}" stroke="${C.steelDark}"/>
      <path d="M302,${olmTop + 14} v${G - olmTop - 14} M330,${olmTop + 14} v${G - olmTop - 14} M362,${olmTop + 14} v${G - olmTop - 14} M390,${olmTop + 14} v${G - olmTop - 14}" stroke="${C.steelDark}" stroke-width="5"/>
      <rect x="286" y="${G - 10}" width="120" height="10" fill="${C.line2}"/>
      <path d="M306,${G - 8} q40,-10 80,0" fill="none" stroke="${C.lox}" stroke-width="1.5" opacity=".8"/>
      <path d="M318,${G - 12} q4,-6 8,0 M342,${G - 14} q4,-6 8,0 M366,${G - 12} q4,-6 8,0" fill="none" stroke="${C.lox}" stroke-width="1" opacity=".7"/>
      <rect x="${bx - bw / 2 - 10}" y="${olmTop - 6}" width="10" height="8" fill="${C.faint}"/>
    </g>
    <!-- booster -->
    <rect x="${bx - bw / 2}" y="${bTop}" width="${bw}" height="${bH}" fill="url(#ct-steel)"/>
    <rect x="${bx - bw / 2}" y="${bTop}" width="${bw}" height="6" fill="${C.steelDark}"/>
    <rect x="${bx - bw / 2}" y="${olmTop - 26}" width="${bw}" height="26" fill="${C.faint}"/>
    <rect x="${bx - bw / 2 - 7}" y="${bTop + 10}" width="7" height="22" rx="1" fill="${C.booster}"/>
    <rect x="${bx + bw / 2}" y="${bTop + 10}" width="7" height="22" rx="1" fill="${C.booster}"/>
    <rect x="${bx + bw / 2}" y="${bTop + 36}" width="4" height="4" fill="${C.text}"/>
    <rect x="${bx - bw / 2 - 4}" y="${bTop + 36}" width="4" height="4" fill="${C.text}"/>
    <!-- ship -->
    <path d="M${bx - bw / 2},${bTop} V${sTop + 50} C${bx - bw / 2},${sTop + 15} ${bx - 6},${sTop} ${bx},${sTop} C${bx + 6},${sTop} ${bx + bw / 2},${sTop + 15} ${bx + bw / 2},${sTop + 50} V${bTop}z" fill="url(#ct-steel)"/>
    <rect x="${bx - bw / 2}" y="${sTop + 50}" width="4" height="${bTop - sTop - 50}" fill="${rgba(C.ship, 0.55)}"/>
    <path d="M${bx - bw / 2},${sTop + 22} l-12,6 v34 l12,4z M${bx - bw / 2},${bTop - 60} l-14,8 v46 l14,4z" fill="${C.ship}" opacity=".85"/>
    <!-- ship QD arm -->
    <g>
      <rect x="212" y="226" width="22" height="18" rx="2" fill="${C.panel2}" stroke="${C.tower}"/>
      <rect x="232" y="232" width="${bx - bw / 2 - 236}" height="7" fill="${C.tower}"/>
      <rect x="${bx - bw / 2 - 8}" y="228" width="8" height="15" fill="${C.methane}"/>
    </g>
    <!-- chopsticks carriage + arms -->
    <g>
      <rect x="212" y="276" width="26" height="60" rx="2" fill="${C.panel2}" stroke="${C.tower}" stroke-width="1.2"/>
      <rect x="238" y="298" width="150" height="10" rx="2" fill="${C.tower}" opacity=".55"/>
      <rect x="238" y="290" width="150" height="10" rx="2" fill="${C.tower}"/>
      <rect x="250" y="286" width="126" height="4" fill="${C.steel}"/>
      <path d="M256,300 v8 M268,300 v8 M364,300 v8 M376,300 v8" stroke="${C.flame2}" stroke-width="3"/>
    </g>
    <g class="ct-hotspots"></g>
    <line x1="0" y1="${G}" x2="480" y2="${G}" stroke="${C.line2}"/>
    <rect x="0" y="${G}" width="480" height="40" fill="${C.panel}"/>
  </svg>`;
  const svg = box.querySelector('svg');
  const hs = svg.querySelector('.ct-hotspots');

  const card = el('div', { class: 'panel catch-tower-card' });
  const cName = el('h4', { class: 'catch-tower-name' });
  const cChip = el('span', { class: 'chip catch-tower-chip' });
  const cBody = el('p', { class: 'catch-tower-body' });
  const list = el('div', { class: 'catch-tower-list', role: 'list' });
  card.append(el('div', { class: 'catch-tower-cardhead' }, [cName, cChip]), cBody, list);

  let active = -1;
  const spots = [], listBtns = [];
  function show(i) {
    if (i === active) return;
    active = i;
    const p = TOWER_PARTS[i];
    cName.textContent = p.name; cChip.textContent = p.chip; cBody.textContent = p.body;
    spots.forEach((g, j) => g.classList.toggle('is-active', j === i));
    listBtns.forEach((b, j) => b.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
    card.classList.remove('is-flash'); void card.offsetWidth; card.classList.add('is-flash');
  }
  TOWER_PARTS.forEach((p, i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'ct-hot');
    g.setAttribute('transform', `translate(${p.x},${p.y})`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', p.name);
    g.innerHTML = `<circle class="ct-hot-ring" r="16" fill="${rgba(C.methane, 0.12)}"/><circle class="ct-hot-dot" r="9" fill="${C.panel}" stroke="${C.methane}" stroke-width="1.5"/><text y="3.5" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="${C.text}">${i + 1}</text>`;
    g.addEventListener('mouseenter', () => show(i));
    g.addEventListener('focus', () => show(i));
    g.addEventListener('click', () => show(i));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } });
    hs.append(g); spots.push(g);

    const b = el('button', { class: 'catch-tower-item', type: 'button', 'aria-pressed': 'false', role: 'listitem' }, [
      el('span', { class: 'catch-tower-item-n mono', text: String(i + 1) }), el('span', { text: p.name }),
    ]);
    b.addEventListener('click', () => show(i));
    b.addEventListener('mouseenter', () => show(i));
    list.append(b); listBtns.push(b);
  });
  show(1);

  grid.append(box, card);
  part.append(grid, el('p', { class: 'note', text: 'Schematic, roughly to scale vertically. The arms are shown at their pre-launch height around the stacked vehicle; during a catch the carriage positions them higher, near the top of the tower’s travel.' }));
  return part;
}

/* ============================================================
   PART C — "Catch it yourself"
   ============================================================ */
const G0 = 9.81;
const BOOSTER_H = 71, BOOSTER_R = 4.5;
const PIN_H = 62;                 // catch pins height above base (m)
const ARM_Y = 85;                 // arm rail height above ground (m)
const TOWER_X = -27, TOWER_HW = 6, TOWER_H = 145;  // tower centre, half-width, height
const ARM_INNER = -21, ARM_OUTER = 16;              // arm span in x (m), catch target is x = 0
const OLM_TOP = 18;
const DRY_MASS = 200_000;
const MAX_THRUST = 5.4e6;         // 3 centre engines, throttle-limited (~1.8 MN each)
const ISP = 330;
const GIMBAL_MAX = 0.26;          // ~15 deg
const RCS_AUTH = 0.12;            // rad/s^2 from cold gas / grid fins alone

const DIFFS = {
  easy:   { label: 'Easy',   alt: 420, x: 110, vy: -32, vx: -10, fuel: 62_000, wind: 0.0,  tol: { vy: 2.5, vx: 1.3, tilt: 6, gap: 8 } },
  normal: { label: 'Normal', alt: 600, x: 170, vy: -52, vx: -16, fuel: 46_000, wind: 0.35, tol: { vy: 2.0, vx: 1.0, tilt: 5, gap: 6 } },
  hard:   { label: 'Hard',   alt: 820, x: 260, vy: -74, vx: -24, fuel: 36_000, wind: 0.9,  tol: { vy: 1.5, vx: 0.8, tilt: 4, gap: 5 } },
};

function buildGame() {
  const part = el('section', { class: 'catch-part catch-game-part', 'aria-labelledby': 'catch-c-title' });
  part.append(
    el('div', { class: 'catch-part-head' }, [
      el('span', { class: 'chip catch-part-chip', text: 'Part C' }),
      el('h3', { id: 'catch-c-title', text: 'Catch it yourself' }),
      el('p', { class: 'catch-part-lede', text: 'You have three engines, a little propellant and one chance. Bring the booster to the arms slowly, level and in the middle.' }),
    ]),
  );

  const panel = el('div', { class: 'panel catch-game', tabindex: '-1' });

  /* ---- toolbar ---- */
  const toolbar = el('div', { class: 'catch-game-bar' });
  const diffGroup = el('div', { class: 'catch-diff', role: 'group', 'aria-label': 'Difficulty' });
  const diffBtns = {};
  for (const [k, d] of Object.entries(DIFFS)) {
    const b = el('button', { class: 'btn', type: 'button', 'aria-pressed': k === 'normal' ? 'true' : 'false', text: d.label });
    b.addEventListener('click', () => { setDiff(k); });
    diffGroup.append(b); diffBtns[k] = b;
  }
  const startBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Start catch attempt' });
  toolbar.append(diffGroup, el('span', { class: 'catch-keys mono', html: '<kbd>W</kbd><kbd>S</kbd> throttle &middot; <kbd>A</kbd><kbd>D</kbd> tilt &middot; <kbd>Esc</kbd> abort' }), startBtn);

  /* ---- HUD ---- */
  const hud = el('div', { class: 'catch-hud', 'aria-live': 'off' });
  const hudEls = {};
  for (const [k, label, unit] of [['alt', 'Alt to arms', 'm'], ['vy', 'Vertical', 'm/s'], ['vx', 'Horizontal', 'm/s'], ['tilt', 'Tilt', '°'], ['thr', 'Throttle', '%'], ['eng', 'Engines', '']]) {
    const v = el('span', { class: 'catch-hud-v', text: '—' });
    hud.append(el('div', { class: 'catch-hud-item', 'data-k': k }, [el('span', { class: 'catch-hud-k', text: label }), el('span', { class: 'catch-hud-vw' }, [v, el('span', { class: 'catch-hud-u', text: unit })])]));
    hudEls[k] = v;
  }
  const fuelBar = el('div', { class: 'catch-fuel', role: 'progressbar', 'aria-label': 'Propellant remaining', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '100' }, [el('div', { class: 'catch-fuel-fill' }), el('span', { class: 'catch-fuel-l mono', text: 'PROP 100%' })]);
  const goChip = el('span', { class: 'chip catch-go', text: 'STANDBY' });
  hud.append(el('div', { class: 'catch-hud-item catch-hud-fuel' }, [fuelBar, goChip]));

  /* ---- canvas + overlay ---- */
  const stage = el('div', { class: 'catch-stage' });
  const canvas = el('canvas', { class: 'catch-canvas', tabindex: '0', 'aria-label': 'Booster catch simulator. Use W and S to throttle, A and D to tilt.' });
  const overlay = el('div', { class: 'catch-overlay', role: 'status', 'aria-live': 'polite' });
  const touch = el('div', { class: 'catch-touch', 'aria-hidden': 'false' });
  const touchBtn = (cls, label, html) => el('button', { class: 'catch-tbtn ' + cls, type: 'button', 'aria-label': label, html });
  const tUp = touchBtn('t-up', 'Throttle up', '&#9650;<small>THR</small>');
  const tDown = touchBtn('t-down', 'Throttle down', '&#9660;<small>THR</small>');
  const tLeft = touchBtn('t-left', 'Tilt left', '&#9664;<small>TILT</small>');
  const tRight = touchBtn('t-right', 'Tilt right', '&#9654;<small>TILT</small>');
  touch.append(el('div', { class: 'catch-touch-g' }, [tLeft, tRight]), el('div', { class: 'catch-touch-g' }, [tDown, tUp]));
  stage.append(canvas, overlay, touch);

  panel.append(toolbar, hud, stage);
  part.append(panel, el('p', { class: 'note', text: 'Physics are simplified but honest: gravity, thrust from three throttled engines, propellant burn, angular inertia, air drag and (on Normal and Hard) wind gusts. Real boosters fly this entirely by computer in about twenty seconds.' }));

  /* ---------------- game state ---------------- */
  const ctx = canvas.getContext('2d');
  let diffKey = 'normal';
  let W = 0, H = 0, dpr = 1;
  const keys = { up: false, down: false, left: false, right: false };
  const cam = { cx: 0, cy: 150, scale: 2 };
  const st = {
    mode: 'idle', // idle | run | catching | rud | done
    t: 0, b: null, parts: [], smoke: [], shake: 0, armsClose: 0, settle: 0, endT: 0, result: null,
    wind: 0, windTarget: 0, windT: 0, visible: true, pausedHidden: false,
  };
  let rafId = 0, last = 0, acc = 0;
  const FIXED = 1 / 120;

  function setDiff(k) {
    diffKey = k;
    for (const [kk, b] of Object.entries(diffBtns)) b.setAttribute('aria-pressed', kk === k ? 'true' : 'false');
    reset();
  }
  function newBooster() {
    const d = DIFFS[diffKey];
    return { x: d.x, y: d.alt, vx: d.vx, vy: d.vy, ang: 0.06, angVel: 0, throttle: 0, gimbal: 0, fuel: d.fuel, fuel0: d.fuel, maxAlt: d.alt };
  }
  function reset() {
    st.mode = 'idle'; st.t = 0; st.b = newBooster(); st.parts = []; st.smoke = []; st.shake = 0; st.armsClose = 0; st.settle = 0; st.result = null;
    st.wind = 0; st.windTarget = 0; st.windT = 0;
    for (const k in keys) keys[k] = false;
    cam.cx = st.b.x * 0.5; cam.cy = st.b.y * 0.55; cam.scale = 1;
    startBtn.textContent = 'Start catch attempt';
    goChip.textContent = 'STANDBY'; goChip.className = 'chip catch-go';
    showOverlay('idle');
    ensureLoop();
  }
  function start() {
    reset();
    st.mode = 'run';
    startBtn.textContent = 'Restart';
    overlay.innerHTML = ''; overlay.classList.remove('is-on');
    canvas.focus({ preventScroll: true });
    ensureLoop();
  }
  function showOverlay(kind, data) {
    overlay.innerHTML = '';
    overlay.classList.add('is-on');
    const d = DIFFS[diffKey];
    if (kind === 'idle') {
      overlay.append(
        el('div', { class: 'catch-ov-card' }, [
          el('p', { class: 'catch-ov-eyebrow mono', text: `GO FOR CATCH · ${d.label.toUpperCase()}` }),
          el('h4', { text: 'Bring Super Heavy home' }),
          el('p', { text: `The booster starts ${d.alt} m up and ${d.x} m east of the tower, falling at ${Math.abs(d.vy)} m/s. Kill the horizontal drift, then hover down to the arms: under ${d.tol.vy} m/s down, ${d.tol.vx} m/s sideways, within ${d.tol.tilt}° of vertical.` }),
          el('p', { class: 'catch-ov-hint mono', html: 'Hover throttle is around 45%. Tilt <em>into</em> your drift to cancel it, then level out.' }),
          el('button', { class: 'btn btn-primary', type: 'button', text: 'Start', onclick: start }),
        ]),
      );
    } else if (kind === 'result') {
      const r = data;
      const card = el('div', { class: 'catch-ov-card ' + (r.ok ? 'is-ok' : 'is-bad') });
      card.append(el('p', { class: 'catch-ov-eyebrow mono', text: r.eyebrow }), el('h4', { text: r.title }), el('p', { text: r.body }));
      if (r.report) {
        const dl = el('dl', { class: 'catch-report' });
        for (const [k, v] of r.report) dl.append(el('div', { class: 'stat' }, [el('dt', { class: 'k', text: k }), el('dd', { class: 'v', text: v })]));
        card.append(dl);
      }
      card.append(el('button', { class: 'btn btn-primary', type: 'button', text: r.ok ? 'Catch another' : 'Try again', onclick: start }));
      overlay.append(card);
    } else if (kind === 'paused') {
      overlay.append(el('div', { class: 'catch-ov-card is-small' }, [el('p', { class: 'mono', text: 'PAUSED — scroll back to resume' })]));
    }
  }

  /* ---------------- input ---------------- */
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function gameHasFocus() { return panel.contains(document.activeElement); }
  window.addEventListener('keydown', (e) => {
    if (st.mode !== 'run' || !gameHasFocus()) return;
    if (e.code === 'Escape') { e.preventDefault(); abort('Attempt aborted by the operator.'); return; }
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    keys[k] = true;
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  panel.addEventListener('focusout', (e) => { if (!panel.contains(e.relatedTarget)) for (const k in keys) keys[k] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  for (const [btn, k] of [[tUp, 'up'], [tDown, 'down'], [tLeft, 'left'], [tRight, 'right']]) {
    const on = (e) => { e.preventDefault(); keys[k] = true; btn.classList.add('is-down'); if (st.mode === 'idle') start(); };
    const off = () => { keys[k] = false; btn.classList.remove('is-down'); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  startBtn.addEventListener('click', start);
  canvas.addEventListener('pointerdown', () => { if (st.mode === 'idle') return; canvas.focus({ preventScroll: true }); });
  if (coarsePointer.matches) panel.classList.add('has-touch');
  coarsePointer.addEventListener?.('change', (e) => panel.classList.toggle('has-touch', e.matches));

  /* ---------------- sizing ---------------- */
  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    draw(0);
  }
  new ResizeObserver(resize).observe(stage);

  /* ---------------- visibility ---------------- */
  const io = new IntersectionObserver(([en]) => {
    st.visible = en.isIntersecting;
    if (!st.visible) {
      if (st.mode === 'run') { st.pausedHidden = true; showOverlay('paused'); }
      cancelAnimationFrame(rafId); rafId = 0;
    } else {
      if (st.pausedHidden && st.mode === 'run') { st.pausedHidden = false; overlay.innerHTML = ''; overlay.classList.remove('is-on'); }
      last = 0; ensureLoop();
    }
  }, { threshold: 0.05 });
  io.observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; } else { last = 0; ensureLoop(); } });

  function ensureLoop() { if (!rafId && st.visible && !document.hidden) rafId = requestAnimationFrame(frame); }
  function frame(now) {
    rafId = 0;
    if (!last) last = now;
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (st.mode === 'run' && !st.pausedHidden) {
      acc += dt;
      while (acc >= FIXED) { physics(FIXED); acc -= FIXED; if (st.mode !== 'run') { acc = 0; break; } }
    } else if (st.mode !== 'idle') {
      st.t += dt;
    }
    updateFx(dt);
    updateCamera(dt);
    draw(dt);
    updateHud();
    if (st.mode === 'catching' && st.t - st.endT > 2.4) finishCatch();
    if (st.mode === 'rud' && st.t - st.endT > 2.2) finishRud();
    // Keep looping while the stage is on screen; the IntersectionObserver
    // and visibilitychange handlers stop it when it is not.
    ensureLoop();
  }

  /* ---------------- physics ---------------- */
  function physics(dt) {
    const b = st.b, d = DIFFS[diffKey];
    st.t += dt;
    // controls
    const thrRate = 1.1;
    if (keys.up) b.throttle = clamp(b.throttle + thrRate * dt, 0, 1);
    if (keys.down) b.throttle = clamp(b.throttle - thrRate * dt, 0, 1);
    const gTarget = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    b.gimbal = lerp(b.gimbal, gTarget, Math.min(1, 10 * dt));
    // wind gusts
    if (d.wind > 0) {
      st.windT -= dt;
      if (st.windT <= 0) { st.windTarget = (Math.random() * 2 - 1) * d.wind; st.windT = 1.5 + Math.random() * 3; }
      st.wind = lerp(st.wind, st.windTarget, Math.min(1, 0.8 * dt));
    }
    // thrust
    const mass = DRY_MASS + b.fuel;
    let thrust = b.fuel > 0 ? b.throttle * MAX_THRUST : 0;
    if (thrust > 0) {
      b.fuel = Math.max(0, b.fuel - (thrust / (ISP * G0)) * dt);
      if (b.fuel === 0) { thrust = 0; b.throttle = 0; }
    }
    const delta = b.gimbal * GIMBAL_MAX;
    // thrust along body axis (+ small lateral component from gimbal)
    const axBody = thrust * Math.sin(delta), ayBody = thrust * Math.cos(delta);
    const cosA = Math.cos(b.ang), sinA = Math.sin(b.ang);
    const fx = ayBody * sinA + axBody * cosA;
    const fy = ayBody * cosA - axBody * sinA;
    // drag (terminal velocity ~ 90 m/s empty)
    const k = 0.0012 * (DRY_MASS / mass);
    const ax = fx / mass - k * b.vx * Math.abs(b.vx) + st.wind;
    const ay = fy / mass - G0 - k * b.vy * Math.abs(b.vy);
    // rotation: torque from gimbal + always-available RCS/grid-fin authority + aero damping
    const I = (mass * BOOSTER_H * BOOSTER_H) / 12;
    const torque = thrust * Math.sin(delta) * (BOOSTER_H / 2);
    const speed = Math.hypot(b.vx, b.vy);
    let angAcc = torque / I + b.gimbal * RCS_AUTH;
    angAcc += -b.ang * 0.12 * Math.min(1, speed / 60) - b.angVel * 0.6;
    const prevPinY = b.y + PIN_H * Math.cos(b.ang);
    b.vx += ax * dt; b.vy += ay * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.angVel += angAcc * dt; b.ang += b.angVel * dt;
    // exhaust smoke
    if (thrust > 0 && Math.random() < 0.9) spawnSmoke(b);

    // ---- outcomes ----
    const pinY = b.y + PIN_H * Math.cos(b.ang);
    const pinX = b.x + PIN_H * Math.sin(b.ang);
    const tiltDeg = Math.abs(b.ang) * 180 / Math.PI;
    if (prevPinY >= ARM_Y && pinY < ARM_Y) {
      if (Math.abs(pinX) <= d.tol.gap) {
        if (Math.abs(b.vy) <= d.tol.vy && Math.abs(b.vx) <= d.tol.vx && tiltDeg <= d.tol.tilt) return caught();
        return rud('Hard contact with the arms', `Arrived between the chopsticks but ${Math.abs(b.vy) > d.tol.vy ? `${fmt(Math.abs(b.vy))} m/s down was too fast` : Math.abs(b.vx) > d.tol.vx ? `${fmt(Math.abs(b.vx))} m/s sideways was too much drift` : `${fmt(tiltDeg)}° of tilt was too much`}. The catch pins skipped off the rails and the booster folded over the arms.`);
      }
      if (pinX > ARM_INNER - 6 && pinX < ARM_OUTER + 6) return rud('Hit the chopsticks', `The booster came down ${fmt(Math.abs(pinX), 0)} m off centre and struck the arm structure. Rapid unscheduled disassembly.`);
    }
    // tower collision (sample three points along the body)
    for (const s of [0, 0.5, 1]) {
      const px = b.x + s * BOOSTER_H * Math.sin(b.ang), py = b.y + s * BOOSTER_H * Math.cos(b.ang);
      if (py < TOWER_H && Math.abs(px - TOWER_X) < TOWER_HW + BOOSTER_R) return rud('Tower strike', 'The booster hit the integration tower. Mechazilla will need a few weeks in the shop.');
    }
    if (b.y <= (Math.abs(b.x) < 60 ? OLM_TOP : 0)) {
      return rud(Math.abs(b.x) < 60 ? 'Missed the arms' : 'Ground impact', Math.abs(b.x) < 60
        ? `The booster went past the arms at ${fmt(Math.abs(b.vy))} m/s and met the launch mount instead. Nobody catches on the first try.`
        : `Touched down ${fmt(Math.abs(b.x), 0)} m from the tower at ${fmt(Math.abs(b.vy))} m/s. Super Heavy has no legs, so that counts as a crash.`);
    }
    if (b.fuel <= 0 && b.y > 40) return abort('Propellant depleted. The flight computer calls the catch off and steers for the Gulf.');
    if (Math.abs(b.x) > 420 || b.y > DIFFS[diffKey].alt * 1.5) return abort('The booster left the catch corridor. Flight Director calls no-go; it diverts to a Gulf splashdown.');
    if (b.ang > 1.2 || b.ang < -1.2) return rud('Loss of control', 'The booster tumbled past 70° and could not recover. The aerodynamic loads tore it apart.');
  }

  function caught() {
    st.mode = 'catching'; st.endT = st.t; st.armsClose = 0; st.settle = 0;
    const b = st.b, d = DIFFS[diffKey];
    const fuelPct = b.fuel / b.fuel0;
    const vS = clamp(1 - Math.abs(b.vy) / d.tol.vy, 0, 1), hS = clamp(1 - Math.abs(b.vx) / d.tol.vx, 0, 1), tS = clamp(1 - (Math.abs(b.ang) * 180 / Math.PI) / d.tol.tilt, 0, 1);
    const score = Math.round(40 * fuelPct + 25 * vS + 20 * hS + 15 * tS);
    const grade = score >= 88 ? 'Flawless' : score >= 72 ? 'Textbook catch' : score >= 50 ? 'Caught' : 'Caught (barely)';
    st.result = {
      ok: true, eyebrow: `CATCH CONFIRMED · ${d.label.toUpperCase()} · SCORE ${score}`, title: grade + '.',
      body: score >= 72 ? 'Chopsticks closed, booster secured. That is the hardest landing in rocketry, done by hand.' : 'The arms held. The ground crew would like a word about the propellant margin, but it is home.',
      report: [['Touchdown vertical', `${fmt(Math.abs(b.vy))} m/s`], ['Horizontal', `${fmt(Math.abs(b.vx))} m/s`], ['Tilt', `${fmt(Math.abs(b.ang) * 180 / Math.PI)}°`], ['Propellant left', `${Math.round(fuelPct * 100)}%`], ['Flight time', `${fmt(st.t, 1)} s`]],
    };
    b.vx = 0; b.vy = 0; b.angVel = 0; b.throttle = 0;
    goChip.textContent = 'CAUGHT'; goChip.className = 'chip catch-go is-ok';
  }
  function finishCatch() { st.mode = 'done'; showOverlay('result', st.result); }
  function rud(title, body) {
    st.mode = 'rud'; st.endT = st.t; st.shake = 1;
    const b = st.b;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 55;
      const along = Math.random() * BOOSTER_H;
      st.parts.push({ x: b.x + along * Math.sin(b.ang), y: b.y + along * Math.cos(b.ang), vx: Math.cos(a) * sp + b.vx * 0.3, vy: Math.sin(a) * sp + 15, life: 1.2 + Math.random() * 1.4, r: 1.5 + Math.random() * 4,
        col: [C.flame, C.flame2, C.plasma, C.steel, C.steelDark][Math.floor(Math.random() * 5)] });
    }
    st.result = { ok: false, eyebrow: 'RUD · RAPID UNSCHEDULED DISASSEMBLY', title, body };
    goChip.textContent = 'RUD'; goChip.className = 'chip catch-go is-bad';
  }
  function finishRud() { st.mode = 'done'; showOverlay('result', st.result); }
  function abort(body) {
    st.mode = 'done';
    st.result = { ok: false, eyebrow: 'ABORT · DIVERTED TO GULF SPLASHDOWN', title: 'No-go for catch.', body };
    goChip.textContent = 'NO-GO'; goChip.className = 'chip catch-go is-bad';
    showOverlay('result', st.result);
  }

  function spawnSmoke(b) {
    const base = { x: b.x, y: b.y };
    const dirx = -Math.sin(b.ang), diry = -Math.cos(b.ang);
    const sp = 25 + 40 * b.throttle;
    st.smoke.push({ x: base.x + (Math.random() - 0.5) * 3, y: base.y, vx: dirx * sp + (Math.random() - 0.5) * 10 + b.vx * 0.5, vy: diry * sp + (Math.random() - 0.5) * 10 + b.vy * 0.5, life: 0.9 + Math.random() * 0.8, age: 0, r: 2 + Math.random() * 3 });
    if (st.smoke.length > (reduceMotion.matches ? 60 : 220)) st.smoke.shift();
  }
  function updateFx(dt) {
    for (const p of st.smoke) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy = p.vy * 0.97 + 6 * dt; p.r += 6 * dt; if (p.y < 0.5) { p.y = 0.5; p.vy = Math.abs(p.vy) * 0.2; p.vx *= 1.4; } }
    st.smoke = st.smoke.filter((p) => p.age < p.life);
    for (const p of st.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= G0 * 2.2 * dt; p.vx *= 0.995; if (p.y < 0) { p.y = 0; p.vy = -p.vy * 0.3; p.vx *= 0.6; } }
    st.parts = st.parts.filter((p) => p.life > 0);
    st.shake = Math.max(0, st.shake - dt * 1.4);
    if (st.mode === 'catching') {
      const u = clamp((st.t - st.endT) / 1.1, 0, 1);
      st.armsClose = easeOut(u);
      const v = clamp((st.t - st.endT - 0.9) / 1.0, 0, 1);
      st.settle = Math.sin(v * Math.PI) * 0.5 + v * 1.2;  // bounce then sit
    }
  }

  /* ---------------- camera ---------------- */
  function camTarget() {
    const b = st.b;
    const topNeed = Math.max(TOWER_H + 30, b.y + BOOSTER_H + 40);
    let viewH = topNeed + 20;
    const spanX = Math.abs(b.x - TOWER_X) + 120;
    let scale = Math.min(H / viewH, W / spanX);
    scale = clamp(scale, 0.25, 6);
    const cx = (b.x + TOWER_X) / 2 + 10;
    return { cx, scale };
  }
  function updateCamera(dt) {
    const tg = camTarget();
    const k = Math.min(1, dt * 2.2);
    cam.scale = lerp(cam.scale, tg.scale, k);
    cam.cx = lerp(cam.cx, tg.cx, k);
  }
  const sx = (x) => W / 2 + (x - cam.cx) * cam.scale;
  const sy = (y) => H - 24 - y * cam.scale;

  /* ---------------- drawing ---------------- */
  function draw(dt) {
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = st.b;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.bg); g.addColorStop(1, C.panel2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (st.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * st.shake, (Math.random() - 0.5) * 10 * st.shake);
    const s = cam.scale;
    // altitude grid
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
    ctx.fillStyle = C.faint; ctx.font = '10px ' + 'IBM Plex Mono, ui-monospace, monospace';
    const step = s > 2.5 ? 50 : s > 1 ? 100 : 200;
    for (let a = step; a < 2000; a += step) { const y = sy(a); if (y < -10) break; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.fillText(a + ' m', 8, y - 3); }
    ctx.setLineDash([]);
    // catch altitude line
    ctx.strokeStyle = rgba(C.booster, 0.35); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(0, sy(ARM_Y)); ctx.lineTo(W, sy(ARM_Y)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = rgba(C.booster, 0.7); ctx.fillText('CATCH HEIGHT', W - 96, sy(ARM_Y) - 4);
    // ground: land left of x=120, water right
    ctx.fillStyle = C.panel; ctx.fillRect(0, sy(0), W, H - sy(0));
    ctx.fillStyle = rgba(C.booster, 0.10); ctx.fillRect(0, sy(0), sx(120) - 0, H - sy(0));
    const wg = ctx.createLinearGradient(0, sy(0), 0, H); wg.addColorStop(0, rgba(C.methane, 0.3)); wg.addColorStop(1, rgba(C.methane, 0.03));
    ctx.fillStyle = wg; ctx.fillRect(sx(120), sy(0), W, H - sy(0));
    ctx.strokeStyle = C.line2; ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0)); ctx.stroke();
    drawTower(s);
    // far arm
    drawArm(s, 'far');
    // smoke
    for (const p of st.smoke) { const a = (1 - p.age / p.life) * 0.35; ctx.fillStyle = rgba(C.steelDark, a); ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), Math.max(1, p.r * s), 0, Math.PI * 2); ctx.fill(); }
    const exploded = st.mode === 'rud' || (st.mode === 'done' && st.result && !st.result.ok && st.result.eyebrow.startsWith('RUD'));
    if (!exploded) drawBooster(s);
    drawArm(s, 'near');
    // debris
    for (const p of st.parts) { ctx.fillStyle = rgba(p.col, clamp(p.life, 0, 1)); ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), Math.max(1.2, p.r * s * 0.6), 0, Math.PI * 2); ctx.fill(); }
    // wind indicator
    if (DIFFS[diffKey].wind > 0 && st.mode === 'run') {
      ctx.fillStyle = C.muted; ctx.fillText('WIND', W - 96, 18);
      const wl = clamp(st.wind / DIFFS[diffKey].wind, -1, 1) * 28;
      ctx.strokeStyle = C.lox; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W - 56, 14); ctx.lineTo(W - 56 + wl, 14); ctx.stroke();
      ctx.beginPath(); ctx.arc(W - 56 + wl, 14, 2.5, 0, Math.PI * 2); ctx.fillStyle = C.lox; ctx.fill();
    }
    ctx.restore();
  }
  function drawTower(s) {
    const x0 = sx(TOWER_X - TOWER_HW), x1 = sx(TOWER_X + TOWER_HW), yTop = sy(TOWER_H), yG = sy(0);
    ctx.fillStyle = C.panel2; ctx.fillRect(x0, yTop, x1 - x0, yG - yTop);
    ctx.strokeStyle = C.tower; ctx.lineWidth = 1; ctx.strokeRect(x0, yTop, x1 - x0, yG - yTop);
    ctx.strokeStyle = rgba(C.tower, 0.4); ctx.beginPath();
    const stepM = s > 1.2 ? 6 : 12;
    for (let h = 0; h < TOWER_H; h += stepM) { const y = sy(h), y2 = sy(h + stepM); ctx.moveTo(x0, y); ctx.lineTo(x1, y2); ctx.moveTo(x1, y); ctx.lineTo(x0, y2); }
    ctx.stroke();
    // draw-works at top
    ctx.fillStyle = C.panel2; ctx.strokeStyle = C.tower; const dw = 7 * s;
    ctx.fillRect(x0 - dw * 0.15, yTop - 4 * s, (x1 - x0) + dw * 0.3, 4 * s); ctx.strokeRect(x0 - dw * 0.15, yTop - 4 * s, (x1 - x0) + dw * 0.3, 4 * s);
    // OLM
    const ox0 = sx(-10), ox1 = sx(10), oy = sy(OLM_TOP);
    ctx.fillStyle = C.panel2; ctx.strokeStyle = C.steelDark; ctx.lineWidth = 1;
    ctx.fillRect(ox0, oy, ox1 - ox0, 3 * s); ctx.strokeRect(ox0, oy, ox1 - ox0, 3 * s);
    ctx.lineWidth = Math.max(1.5, 1.4 * s);
    ctx.beginPath(); for (const lx of [-8, -3, 3, 8]) { ctx.moveTo(sx(lx), oy + 3 * s); ctx.lineTo(sx(lx), sy(0)); } ctx.stroke();
    ctx.lineWidth = 1;
    // carriage
    const cy0 = sy(ARM_Y + 4), cy1 = sy(ARM_Y - 6);
    ctx.fillStyle = C.panel2; ctx.strokeStyle = C.tower; ctx.lineWidth = 1.2;
    ctx.fillRect(x1 - 1, cy0, 3 * s, cy1 - cy0); ctx.strokeRect(x1 - 1, cy0, 3 * s, cy1 - cy0);
    // cable
    ctx.strokeStyle = rgba(C.steel, 0.5); ctx.setLineDash([1, 3]); ctx.beginPath(); ctx.moveTo(x1 + 1.5 * s, yTop); ctx.lineTo(x1 + 1.5 * s, cy0); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawArm(s, which) {
    // perspective-ish: near arm opens downward on screen, far arm upward; closed = horizontal
    const open = 1 - st.armsClose;
    const hingeX = sx(ARM_INNER), hingeY = sy(ARM_Y);
    const ang = (which === 'near' ? 1 : -1) * open * 0.22;
    const L = (ARM_OUTER - ARM_INNER) * s;
    const t = Math.max(3, 2.2 * s);
    ctx.save();
    ctx.translate(hingeX, hingeY + (which === 'near' ? 1 : -1) * 0.6 * s);
    ctx.rotate(ang);
    ctx.fillStyle = which === 'near' ? C.tower : rgba(C.tower, 0.55);
    ctx.fillRect(0, -t / 2, L, t);
    // rail + shock absorbers
    ctx.fillStyle = which === 'near' ? C.steel : rgba(C.steel, 0.5);
    ctx.fillRect(3 * s, -t / 2 - Math.max(1, 0.6 * s), L - 6 * s, Math.max(1, 0.6 * s));
    ctx.fillStyle = C.flame2; for (const px of [5, 9, 26, 30]) ctx.fillRect(px * s, t / 2, Math.max(1, 0.9 * s), Math.max(1, 1.4 * s));
    ctx.restore();
    if (which === 'near' && st.mode === 'run') {
      // target box between the arms
      const d = DIFFS[diffKey];
      ctx.strokeStyle = rgba(C.ok, 0.55); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.strokeRect(sx(-d.tol.gap), sy(ARM_Y + 3), (2 * d.tol.gap) * s, 6 * s); ctx.setLineDash([]);
    }
  }
  function drawBooster(s) {
    const b = st.b;
    const settle = st.mode === 'catching' || (st.mode === 'done' && st.result?.ok) ? st.settle : 0;
    ctx.save();
    ctx.translate(sx(b.x), sy(b.y - settle));
    ctx.rotate(b.ang);
    const w = BOOSTER_R * 2 * s, h = BOOSTER_H * s;
    // plume
    const thr = b.fuel > 0 ? b.throttle : 0;
    if (thr > 0.02 && st.mode === 'run') {
      const flick = reduceMotion.matches ? 1 : 0.85 + Math.random() * 0.3;
      const len = (8 + 46 * thr) * s * flick;
      const pg = ctx.createLinearGradient(0, 0, 0, len);
      pg.addColorStop(0, rgba(C.flame2, 0.95)); pg.addColorStop(0.35, rgba(C.flame, 0.8)); pg.addColorStop(1, rgba(C.flame, 0));
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.moveTo(-w * 0.42, 0); ctx.quadraticCurveTo(-w * 0.2, len * 0.6, 0, len); ctx.quadraticCurveTo(w * 0.2, len * 0.6, w * 0.42, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(C.lox, 0.85);
      ctx.beginPath(); ctx.moveTo(-w * 0.16, 0); ctx.lineTo(0, len * 0.45); ctx.lineTo(w * 0.16, 0); ctx.closePath(); ctx.fill();
      // glow
      const gl = ctx.createRadialGradient(0, len * 0.15, 0, 0, len * 0.15, Math.max(8, w * 2.2));
      gl.addColorStop(0, rgba(C.flame, 0.35)); gl.addColorStop(1, rgba(C.flame, 0));
      ctx.fillStyle = gl; ctx.fillRect(-w * 3, -w, w * 6, len);
    }
    // body
    const bg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bg.addColorStop(0, C.steelDark); bg.addColorStop(0.42, C.steel); bg.addColorStop(1, C.steelDark);
    ctx.fillStyle = bg;
    ctx.fillRect(-w / 2, -h, w, h);
    // ring lines
    ctx.strokeStyle = rgba(C.faint, 0.5); ctx.lineWidth = 1;
    if (s > 1.2) { ctx.beginPath(); for (let m = 10; m < BOOSTER_H; m += 10) { ctx.moveTo(-w / 2, -m * s); ctx.lineTo(w / 2, -m * s); } ctx.stroke(); }
    // engine section & hot-stage ring
    ctx.fillStyle = C.faint; ctx.fillRect(-w / 2, -7 * s, w, 7 * s);
    ctx.fillStyle = C.steelDark; ctx.fillRect(-w / 2, -h, w, 2 * s);
    ctx.fillStyle = C.panel2; ctx.fillRect(-w / 2, -h + 2 * s, w, 1.2 * s);
    // grid fins
    ctx.fillStyle = C.booster;
    ctx.fillRect(-w / 2 - 2.6 * s, -h + 2.5 * s, 2.6 * s, 4.5 * s);
    ctx.fillRect(w / 2, -h + 2.5 * s, 2.6 * s, 4.5 * s);
    // catch pins
    ctx.fillStyle = C.text;
    ctx.fillRect(-w / 2 - 1.2 * s, -PIN_H * s - 0.6 * s, 1.2 * s, 1.2 * s);
    ctx.fillRect(w / 2, -PIN_H * s - 0.6 * s, 1.2 * s, 1.2 * s);
    // engines (3 nozzles)
    ctx.fillStyle = C.line2;
    for (const ex of [-0.27, 0, 0.27]) { ctx.beginPath(); ctx.moveTo(ex * w - 0.9 * s, 0); ctx.lineTo(ex * w + 0.9 * s, 0); ctx.lineTo(ex * w + 1.3 * s, 1.8 * s); ctx.lineTo(ex * w - 1.3 * s, 1.8 * s); ctx.closePath(); ctx.fill(); }
    // gimbal indicator
    if (st.mode === 'run' && Math.abs(b.gimbal) > 0.05) {
      ctx.strokeStyle = rgba(C.methane, 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 1.8 * s); ctx.lineTo(b.gimbal * GIMBAL_MAX * 3 * s * 2, 1.8 * s + 5 * s); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- HUD ---------------- */
  function updateHud() {
    const b = st.b, d = DIFFS[diffKey];
    const pinY = b.y + PIN_H * Math.cos(b.ang);
    const tilt = b.ang * 180 / Math.PI;
    hudEls.alt.textContent = fmt(pinY - ARM_Y, 0);
    hudEls.vy.textContent = (b.vy > 0 ? '+' : '') + fmt(b.vy);
    hudEls.vx.textContent = (b.vx > 0 ? '+' : '') + fmt(b.vx);
    hudEls.tilt.textContent = (tilt > 0 ? '+' : '') + fmt(tilt);
    hudEls.thr.textContent = fmt(b.throttle * 100, 0);
    hudEls.eng.textContent = b.throttle > 0.02 && b.fuel > 0 ? '3 / 3' : '0 / 3';
    const okV = Math.abs(b.vy) <= d.tol.vy, okH = Math.abs(b.vx) <= d.tol.vx, okT = Math.abs(tilt) <= d.tol.tilt;
    hud.querySelector('[data-k="vy"]').classList.toggle('is-bad', !okV && st.mode === 'run' && pinY - ARM_Y < 80);
    hud.querySelector('[data-k="vx"]').classList.toggle('is-bad', !okH && st.mode === 'run' && pinY - ARM_Y < 80);
    hud.querySelector('[data-k="tilt"]').classList.toggle('is-bad', !okT && st.mode === 'run');
    const fp = clamp(b.fuel / b.fuel0, 0, 1);
    fuelBar.firstChild.style.width = (fp * 100).toFixed(1) + '%';
    fuelBar.setAttribute('aria-valuenow', String(Math.round(fp * 100)));
    fuelBar.lastChild.textContent = 'PROP ' + Math.round(fp * 100) + '%';
    fuelBar.classList.toggle('is-low', fp < 0.2);
    if (st.mode === 'run') {
      const pinX = b.x + PIN_H * Math.sin(b.ang);
      const inCorr = Math.abs(pinX) < d.tol.gap * 2.5 && pinY - ARM_Y < 120;
      if (inCorr && okV && okH && okT) { goChip.textContent = 'GO FOR CATCH'; goChip.className = 'chip catch-go is-ok'; }
      else if (pinY - ARM_Y < 120) { goChip.textContent = 'NOT ALIGNED'; goChip.className = 'chip catch-go is-warn'; }
      else { goChip.textContent = 'DESCENDING'; goChip.className = 'chip catch-go'; }
    }
  }

  reset();
  return part;
}

/* ---------------- boot ---------------- */
const mount = document.getElementById('mount-catch');
if (mount) init(mount);

/* ============================================================
   Starship, Explained — 06 Reentry & the flip
   Self-contained ES module. Renders into #mount-reentry.
   ============================================================ */

/* ---------- small helpers ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rad = d => d * Math.PI / 180;

const rgbCache = new Map();
function rgb(hex) {
  if (rgbCache.has(hex)) return rgbCache.get(hex);
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, out);
  return out;
}
const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`; };
const mixRGB = (a, b, t) => { const A = rgb(a), B = rgb(b); return A.map((v, i) => Math.round(v + (B[i] - v) * t)); };
const mix = (a, b, t) => `rgb(${mixRGB(a, b, t).join(',')})`;
const col = (arr, a) => `rgba(${arr[0]},${arr[1]},${arr[2]},${clamp(a, 0, 1)})`;

function boot(root) {
  const cs = getComputedStyle(document.documentElement);
  const tok = (n, fb) => (cs.getPropertyValue(n).trim() || fb);
  const C = {
    bg: tok('--bg', '#04060a'), bg2: tok('--bg-2', '#080c13'),
    panel: tok('--panel', '#0c121b'), panel2: tok('--panel-2', '#111925'),
    line: tok('--line', '#1b2533'), line2: tok('--line-2', '#2a3647'),
    text: tok('--text', '#e8edf3'), text2: tok('--text-2', '#b4c0ce'),
    muted: tok('--muted', '#7b889a'), faint: tok('--faint', '#4b5768'),
    steel: tok('--steel', '#c9d3de'), steelDark: tok('--steel-dark', '#8d99a8'),
    flame: tok('--flame', '#ff7a1a'), flame2: tok('--flame-2', '#ffc46b'),
    plasma: tok('--plasma', '#ff4f6d'), methane: tok('--methane', '#45b8ff'),
    lox: tok('--lox', '#a8f0ff'), ship: tok('--ship', '#7fd4c1'),
    tower: tok('--tower', '#9aa7ff'), warn: tok('--warn', '#facc15'), bad: tok('--bad', '#f87171'),
  };
  const MONO = tok('--font-mono', 'ui-monospace, Menlo, monospace');

  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = mq.matches;
  mq.addEventListener('change', e => { reduced = e.matches; });

  root.innerHTML = template();
  const q = sel => root.querySelector(sel);
  const d = name => root.querySelector(`[data-re="${name}"]`);

  initScrubber({ root, q, d, C, MONO, isReduced: () => reduced });
  initShield({ root, q, d, C, MONO, isReduced: () => reduced });
  initFlaps({ root, q, d, C });
}

/* ============================================================
   TEMPLATE
   ============================================================ */
function template() {
  return `
<div class="re">
  <dl class="re-kpis">
    <div class="stat"><dt class="k">Heat-shield tiles</dt><dd class="v">~18,000</dd></div>
    <div class="stat"><dt class="k">Peak tile surface</dt><dd class="v">~1,400 &deg;C</dd></div>
    <div class="stat"><dt class="k">Belly-flop terminal speed</dt><dd class="v">~300 km/h</dd></div>
    <div class="stat"><dt class="k">Flip altitude</dt><dd class="v">~500 m</dd></div>
  </dl>

  <!-- 1. Reentry scrubber -->
  <div class="panel re-scrub">
    <div class="re-scrub-grid">
      <div class="re-stage" data-re="stage">
        <canvas data-re="scene" role="img" aria-label="Animated reentry scene"></canvas>
        <div class="re-hud">
          <span class="chip"><span class="dot" data-re="phase-dot"></span><span data-re="phase-chip">Entry interface</span></span>
          <span class="chip re-hud-time" data-re="hud-time">T+47:00</span>
        </div>
        <p class="re-caption" data-re="caption"></p>
      </div>
      <div class="re-readouts" aria-live="off">
        <div class="stat re-stat-wide"><span class="k">Phase</span><span class="v" data-re="phase">&mdash;</span></div>
        <div class="stat"><span class="k">Altitude</span><span class="v" data-re="alt">&mdash;</span></div>
        <div class="stat"><span class="k">Mission time</span><span class="v" data-re="time">&mdash;</span></div>
        <div class="stat"><span class="k">Speed</span><span class="v" data-re="spd">&mdash;</span></div>
        <div class="stat"><span class="k">Mach</span><span class="v" data-re="mach">&mdash;</span></div>
        <div class="stat"><span class="k">Angle of attack</span><span class="v" data-re="aoa">&mdash;</span></div>
        <div class="stat"><span class="k">Tile surface</span><span class="v" data-re="temp">&mdash;</span></div>
        <div class="stat"><span class="k">G-load</span><span class="v" data-re="g">&mdash;</span></div>
        <div class="stat"><span class="k">Flaps</span><span class="v" data-re="flaps">&mdash;</span></div>
        <p class="re-phase-copy" data-re="copy"></p>
      </div>
    </div>
    <div class="re-controls">
      <div class="re-ctl-row">
        <button type="button" class="btn btn-primary" data-re="play" aria-pressed="false">Play reentry</button>
        <div class="re-landing" role="group" aria-label="Landing mode">
          <button type="button" class="btn" data-re="mode" data-mode="tower" aria-pressed="true">Tower catch</button>
          <button type="button" class="btn" data-re="mode" data-mode="ocean" aria-pressed="false">Ocean splashdown</button>
        </div>
      </div>
      <div class="re-timeline">
        <label class="re-vh" for="re-scrub">Reentry progress, from entry interface to touchdown</label>
        <input id="re-scrub" type="range" min="0" max="1000" value="0" step="1" data-re="slider">
        <div class="re-marks" data-re="marks"></div>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <!-- 2. Heat shield explorer -->
    <div class="panel re-shield">
      <div class="re-panel-head">
        <h3>Heat shield explorer</h3>
        <p class="muted">Hover or tap a tile. Arrow keys move the selection when the grid is focused.</p>
      </div>
      <div class="re-shield-stage" data-re="shield-stage">
        <canvas data-re="shield" tabindex="0" role="img" aria-label="Interactive hexagonal heat-shield tile grid on Starship's windward belly"></canvas>
      </div>
      <div class="re-tile-info" data-re="tile-info" aria-live="polite">
        <span class="chip"><span class="dot re-dot-ship"></span><span data-re="tile-zone">No tile selected</span></span>
        <p data-re="tile-text">Each hexagon on this map stands in for a cluster of real tiles. The whole windward side is covered; the leeward side is bare steel.</p>
      </div>
      <div class="re-ctl-row">
        <button type="button" class="btn" data-re="lose">Simulate tile loss</button>
        <button type="button" class="btn" data-re="reset">Reset shield</button>
        <span class="muted re-small" data-re="tile-scale"></span>
      </div>
      <div class="re-xsec-wrap">
        <svg class="re-xsec" viewBox="0 0 400 132" role="img" aria-label="Cross-section of the heat shield: hot plasma above, ceramic hexagonal tiles with small expansion gaps, a backup ablative layer, metal studs, and the stainless-steel hull below.">
          <defs>
            <pattern id="re-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" class="re-xs-hatch"/>
            </pattern>
          </defs>
          <g class="re-xs-plasma">
            <path d="M28 10 q40 10 80 0 t80 0 t80 0" />
            <path d="M28 20 q40 10 80 0 t80 0 t80 0" opacity=".5"/>
            <text x="232" y="16" class="re-xs-label re-xs-label-hot">plasma ~1,400 &deg;C</text>
          </g>
          <g class="re-xs-tiles">
            <path d="M28 48 h62 l4 4 v26 l-4 4 h-62 l-4 -4 v-26 z" />
            <path d="M100 48 h62 l4 4 v26 l-4 4 h-62 l-4 -4 v-26 z" />
            <path d="M172 48 h62 l4 4 v26 l-4 4 h-62 l-4 -4 v-26 z" />
            <text x="248" y="66" class="re-xs-label">silica ceramic tile</text>
            <text x="248" y="78" class="re-xs-label re-xs-dim">gap ~1&ndash;2 mm for expansion</text>
          </g>
          <rect x="24" y="86" width="214" height="16" class="re-xs-backup"/>
          <rect x="24" y="86" width="214" height="16" fill="url(#re-hatch)"/>
          <text x="248" y="98" class="re-xs-label">ablative backup layer</text>
          <g class="re-xs-studs">
            <rect x="44" y="60" width="4" height="46"/><rect x="72" y="60" width="4" height="46"/>
            <rect x="116" y="60" width="4" height="46"/><rect x="144" y="60" width="4" height="46"/>
            <rect x="188" y="60" width="4" height="46"/><rect x="216" y="60" width="4" height="46"/>
          </g>
          <rect x="24" y="102" width="214" height="20" class="re-xs-hull"/>
          <text x="248" y="116" class="re-xs-label">30X stainless hull</text>
        </svg>
      </div>
      <p class="note">Tiles are mechanically pinned to the hull with three studs each, not glued. The gaps between them let the tiles and the steel expand at different rates without cracking. Block 2 ships add a thin ablative blanket underneath as a backup if a tile falls off. On the leeward side there are no tiles at all: 30X-series stainless keeps its strength at temperatures that would ruin aluminium.</p>
    </div>

    <!-- 3. Flap controls -->
    <div class="panel re-flaps">
      <div class="re-panel-head">
        <h3>Flap controls</h3>
        <p class="muted">The flaps do not generate lift like wings; they are drag brakes. Fold one in and that corner of the ship drops.</p>
      </div>
      <div class="re-flap-grid">
        <div class="re-flap-svg" data-re="flap-svg"></div>
        <div class="re-flap-ctls">
          <fieldset class="re-fs">
            <legend>Forward flaps</legend>
            <label class="re-slider"><span>Left <b data-re="v-fl">15&deg;</b></span><input type="range" min="0" max="90" value="15" data-flap="fl" aria-label="Forward left flap fold angle"></label>
            <label class="re-slider"><span>Right <b data-re="v-fr">15&deg;</b></span><input type="range" min="0" max="90" value="15" data-flap="fr" aria-label="Forward right flap fold angle"></label>
          </fieldset>
          <fieldset class="re-fs">
            <legend>Aft flaps</legend>
            <label class="re-slider"><span>Left <b data-re="v-al">15&deg;</b></span><input type="range" min="0" max="90" value="15" data-flap="al" aria-label="Aft left flap fold angle"></label>
            <label class="re-slider"><span>Right <b data-re="v-ar">15&deg;</b></span><input type="range" min="0" max="90" value="15" data-flap="ar" aria-label="Aft right flap fold angle"></label>
          </fieldset>
          <div class="steps" role="group" aria-label="Flap presets">
            <button type="button" class="btn" data-preset="15,15,15,15">Trim</button>
            <button type="button" class="btn" data-preset="0,0,70,70">Nose up (flip)</button>
            <button type="button" class="btn" data-preset="70,70,5,5">Nose down</button>
            <button type="button" class="btn" data-preset="0,65,0,65">Roll right</button>
          </div>
        </div>
      </div>
      <div class="re-flap-read">
        <div class="stat"><span class="k">Pitch</span><span class="v" data-re="r-pitch">trimmed</span></div>
        <div class="stat"><span class="k">Roll</span><span class="v" data-re="r-roll">trimmed</span></div>
        <div class="stat"><span class="k">Yaw</span><span class="v" data-re="r-yaw">trimmed</span></div>
        <div class="stat"><span class="k">Terminal speed</span><span class="v" data-re="r-vt">~300 km/h</span></div>
      </div>
      <p class="re-flap-copy" data-re="flap-copy"></p>
      <p class="note">0&deg; = flap fully out (maximum drag), 90&deg; = folded flat against the hull. Qualitative model: each flap's drag scales with its projected area, and the ship rotates toward whichever side has less drag. In flight the computer blends this with cold-gas thrusters and, during the flip, engine gimbal.</p>
    </div>
  </div>

  <!-- 4. Comparison -->
  <div class="panel re-compare">
    <div class="re-panel-head">
      <h3>Why fall on your belly?</h3>
      <p class="muted">Three ways to bring a spacecraft home. The trick is to let the atmosphere do as much of the braking as possible without carrying dead weight to do it.</p>
    </div>
    <div class="re-cmp">
      <article class="re-cmp-col">
        <h4><span class="dot re-dot-steel"></span>Capsule <span class="muted">(Apollo, Dragon)</span></h4>
        <dl>
          <div><dt>How it slows</dt><dd>Blunt heat shield, then parachutes.</dd></div>
          <div><dt>Final descent</dt><dd>~25&ndash;30 km/h under main chutes</dd></div>
          <div><dt>What it needs</dt><dd>Ocean (or airbags) and a recovery ship.</dd></div>
          <div><dt>Dead mass</dt><dd>Low, but chutes are hard to reuse and cannot steer to a pad.</dd></div>
        </dl>
      </article>
      <article class="re-cmp-col">
        <h4><span class="dot re-dot-tower"></span>Winged glider <span class="muted">(Space Shuttle)</span></h4>
        <dl>
          <div><dt>How it slows</dt><dd>Lifting body and wings, then a long unpowered glide.</dd></div>
          <div><dt>Final descent</dt><dd>~350 km/h at touchdown</dd></div>
          <div><dt>What it needs</dt><dd>A ~4.5 km runway and landing gear.</dd></div>
          <div><dt>Dead mass</dt><dd>High: wings and gear do nothing in space.</dd></div>
        </dl>
      </article>
      <article class="re-cmp-col re-cmp-hero">
        <h4><span class="dot re-dot-ship"></span>Belly-flop <span class="muted">(Starship)</span></h4>
        <dl>
          <div><dt>How it slows</dt><dd>The whole hull is the brake: ~9 m &times; ~50 m of drag area.</dd></div>
          <div><dt>Final descent</dt><dd>~300 km/h terminal, then a few seconds of engine burn to zero</dd></div>
          <div><dt>What it needs</dt><dd>A flat pad, or the tower's arms. No runway, no ocean.</dd></div>
          <div><dt>Dead mass</dt><dd>Four flaps and a few tonnes of landing propellant.</dd></div>
        </dl>
      </article>
    </div>
    <p class="note">Lower terminal speed is the whole point. Propellant needed for a landing burn grows with the speed you must cancel, so braking from ~300 km/h costs a fraction of what a tail-first, engines-only descent would. Falling flat also spreads the heat over the largest possible area of tiles.</p>
  </div>
</div>`;
}

/* ============================================================
   1. REENTRY SCRUBBER
   ============================================================ */
// t, alt km, spd km/h, aoa deg, axis deg, fpa deg, tile temp C, g, mission sec, fwd fold, aft fold, plume, heat, control activity
const KEYS = [
  [0.000, 120, 26000, 65, 63.5, -1.5, 150, 0.05, 2820, 15, 15, 0, 0.04, 0.2],
  [0.150, 95, 25800, 68, 66, -2, 700, 0.3, 2990, 15, 15, 0, 0.4, 0.3],
  [0.300, 78, 24500, 70, 67.5, -2.5, 1250, 0.9, 3140, 15, 15, 0, 0.85, 0.4],
  [0.400, 68, 21000, 70, 66.5, -3.5, 1400, 1.8, 3260, 15, 15, 0, 1.0, 0.5],
  [0.520, 52, 12500, 72, 66, -6, 1150, 2.6, 3400, 15, 15, 0, 0.8, 0.7],
  [0.620, 35, 5000, 75, 63, -12, 750, 2.0, 3520, 12, 12, 0, 0.45, 0.9],
  [0.700, 22, 1800, 78, 53, -25, 400, 1.3, 3620, 10, 10, 0, 0.2, 1],
  [0.780, 10, 600, 85, 30, -55, 160, 1.05, 3740, 8, 8, 0, 0.05, 1],
  [0.860, 2.5, 330, 90, 2, -88, 70, 1.0, 3880, 8, 8, 0, 0, 1],
  [0.900, 0.9, 300, 90, 0, -90, 50, 1.0, 3900, 8, 8, 0, 0, 1],
  [0.920, 0.5, 280, 90, 0, -90, 45, 1.1, 3908, 5, 20, 0.15, 0, 1],
  [0.950, 0.3, 190, 90, 90, -90, 40, 1.9, 3916, 0, 75, 1, 0, 0.4],
  [0.975, 0.08, 60, 90, 90, -90, 35, 1.6, 3926, 80, 80, 0.85, 0, 0],
  [0.990, 0.015, 15, 90, 90, -90, 35, 1.3, 3932, 85, 85, 0.6, 0, 0],
  [1.000, 0, 0, 90, 90, -90, 30, 1.0, 3936, 85, 85, 0, 0, 0],
];

function sample(t) {
  t = clamp(t, 0, 1);
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const u = clamp((t - a[0]) / ((b[0] - a[0]) || 1), 0, 1);
  const us = smooth(u);
  const f = (k, sm) => lerp(a[k], b[k], sm ? us : u);
  return {
    t, alt: f(1), spd: f(2), aoa: f(3), axis: f(4, true), fpa: f(5), temp: f(6), g: f(7),
    tsec: f(8), fFwd: f(9, true), fAft: f(10, true), plume: f(11, true), heat: f(12), ctrl: f(13),
  };
}

const PHASES = [
  { t: 0, name: 'Entry interface', short: 'Entry', tag: '~120 km · belly-first · angle of attack ~65°',
    copy: 'About 47 minutes after launch and roughly 120 km up, Starship meets the first measurable air at ~26,000 km/h (~7.3 km/s). It has already rolled belly-first and holds a 60–70° angle of attack so the tiled underside, not the nose, takes the hit.' },
  { t: 0.12, name: 'Plasma onset', short: 'Plasma', alt: true, tag: 'Shock layer ionises · Starlink link holds',
    copy: 'Air piles up ahead of the belly faster than it can get out of the way. The shock layer heats to thousands of degrees and ionises into a pink-orange plasma sheath. The leeward side stays cool enough for Starlink antennas to keep talking through the plasma, so there is no communications blackout, unlike Apollo.' },
  { t: 0.30, name: 'Peak heating', short: 'Peak heating', tag: '~70–80 km · tiles ~1,400 °C · >2 g',
    copy: 'Between roughly 80 and 60 km, still above Mach 20, tile surfaces reach ~1,400 °C. The stainless steel underneath is kept far cooler by the tiles and the expansion gaps between them. Deceleration climbs past ~2 g as the ship sheds most of its speed in a few minutes.' },
  { t: 0.52, name: 'Hypersonic to supersonic', short: 'Hypersonic', alt: true, tag: 'Flaps trim pitch, roll and yaw',
    copy: 'As the air thickens, the four flaps (two forward, two aft) take over attitude control. Like a skydiver spreading or tucking arms and legs, they shift drag between nose and tail, left and right, to hold the belly square to the flow.' },
  { t: 0.72, name: 'Subsonic belly-flop', short: 'Belly-flop', tag: 'Terminal velocity ~300 km/h',
    copy: 'Below ~10 km the ship is simply falling, belly-down, at terminal velocity: about 300 km/h. The whole hull is the brake. The flaps make constant small corrections to keep it flat and pointed at the landing site.' },
  { t: 0.90, name: 'Landing flip', short: 'Flip', alt: true, tag: '~500 m · Raptors relight · header tanks feed',
    copy: 'At ~500 m, two or three sea-level Raptors relight and gimbal hard. The aft flaps fold in, the forward flaps stay out, and the tail swings down: in a few seconds the ship is vertical. Engines feed from small header tanks, because propellant in the nearly empty main tanks would slosh and starve them mid-swing.' },
  { t: 0.95, name: 'Landing burn', short: 'Burn', alt: true, tag: 'Vertical · throttling down to a hover',
    copy: 'Upright now, the engines throttle down and the flaps fold flat. Guidance steers the ship over the pad, or, on future flights, into the gap between the tower’s chopstick arms.' },
  { t: 0.985, name: 'Touchdown', short: 'Touchdown', tag: '', copy: '' },
];
const END_TOWER = { name: 'Tower catch', tag: 'Catch pins on the forward flaps settle onto the arms',
  copy: 'Future flights will have the ship caught like the booster: two catch pins just below the forward flaps come to rest on the chopstick rails, the engines cut, and the ship never touches the ground. No legs, no runway.' };
const END_OCEAN = { name: 'Splashdown', tag: 'Indian Ocean · test flights 2024–25',
  copy: 'Early test flights ended in the Indian Ocean: the ship hovered briefly over the water, then tipped over and sank. The point was proving the flip and burn, not saving the vehicle.' };

function phaseAt(t, mode) {
  let p = PHASES[0];
  for (const ph of PHASES) if (t >= ph.t) p = ph;
  if (p === PHASES[PHASES.length - 1]) return mode === 'tower' ? END_TOWER : END_OCEAN;
  return p;
}

const SOUND = [[0, 340], [11, 295], [20, 295], [47, 330], [70, 300], [90, 270], [130, 270]];
function speedOfSound(alt) {
  for (let i = 0; i < SOUND.length - 1; i++) {
    const [a0, v0] = SOUND[i], [a1, v1] = SOUND[i + 1];
    if (alt <= a1) return lerp(v0, v1, (alt - a0) / (a1 - a0));
  }
  return 270;
}

function fmtAlt(km) {
  if (km >= 10) return `${Math.round(km)} km`;
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(km * 1000)} m`;
}
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `T+${m}:${String(s).padStart(2, '0')}`;
}
function fmtFold(f) { return f <= 25 ? 'out' : f < 60 ? 'mid' : 'in'; }

function initScrubber({ root, d, C, MONO, isReduced }) {
  const stage = d('stage');
  const canvas = d('scene');
  const ctx = canvas.getContext('2d');
  const slider = d('slider');
  const playBtn = d('play');
  const modeBtns = Array.from(root.querySelectorAll('[data-re="mode"]'));
  const marks = d('marks');
  const el = {
    phase: d('phase'), phaseChip: d('phase-chip'), phaseDot: d('phase-dot'), hudTime: d('hud-time'),
    caption: d('caption'), alt: d('alt'), time: d('time'), spd: d('spd'), mach: d('mach'),
    aoa: d('aoa'), temp: d('temp'), g: d('g'), flaps: d('flaps'), copy: d('copy'),
  };

  let t = 0, S = sample(0), mode = 'tower';
  let cw = 0, ch = 0, dpr = 1;
  let clock = 0, lastTs = 0, raf = 0, visible = false, playing = false;
  const DURATION = 48; // seconds for a full playthrough
  let lastPhase = null;

  // stars & particles
  const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.2, tw: Math.random() * 6.28 }));
  const parts = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), k: 0.5 + Math.random() }));
  const NO_DASH = [];

  /* ---- phase markers ---- */
  PHASES.forEach((ph, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 're-mark' + (i === 0 ? ' is-first' : '') + (i === PHASES.length - 1 ? ' is-last' : '') + (ph.alt ? ' is-alt' : '');
    b.style.left = `${ph.t * 100}%`;
    b.dataset.t = String(ph.t);
    b.innerHTML = `<span class="re-mark-tick" aria-hidden="true"></span><span class="re-mark-label">${ph.short}</span>`;
    b.setAttribute('aria-label', `Jump to ${ph.name}`);
    b.addEventListener('click', () => { setT(ph.t + 0.0005); });
    marks.appendChild(b);
  });

  /* ---- sizing ---- */
  function fit() {
    const rect = stage.getBoundingClientRect();
    cw = Math.max(1, Math.round(rect.width));
    ch = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    requestDraw();
  }
  new ResizeObserver(fit).observe(stage);

  /* ---- visibility ---- */
  const io = new IntersectionObserver(entries => {
    visible = entries.some(e => e.isIntersecting);
    if (visible) start(); else stop();
  }, { threshold: 0.05 });
  io.observe(stage);

  function start() { if (!raf) { lastTs = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function requestDraw() { if (!raf && visible) raf = requestAnimationFrame(frame); else if (!raf && cw) draw(); }

  function frame(ts) {
    raf = 0;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    const anim = !isReduced();
    if (playing) {
      setT(t + dt / DURATION, true);
      if (t >= 1) setPlaying(false);
    }
    if (anim) { clock += dt; stepParticles(dt); }
    draw();
    if (visible && (playing || anim)) raf = requestAnimationFrame(frame);
  }

  /* ---- state ---- */
  function setT(nt, fromPlay) {
    t = clamp(nt, 0, 1);
    S = sample(t);
    if (!fromPlay || Math.abs(Number(slider.value) / 1000 - t) > 0.0015) slider.value = String(Math.round(t * 1000));
    updateReadouts();
    if (!fromPlay) requestDraw();
  }
  function setPlaying(p) {
    playing = p;
    playBtn.setAttribute('aria-pressed', String(p));
    playBtn.textContent = p ? 'Pause' : (t >= 1 ? 'Replay reentry' : 'Play reentry');
    if (p) start();
  }
  playBtn.addEventListener('click', () => {
    if (!playing && t >= 1) setT(0);
    setPlaying(!playing);
  });
  slider.addEventListener('input', () => { if (playing) setPlaying(false); setT(Number(slider.value) / 1000); });
  modeBtns.forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    modeBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    lastPhase = null;
    updateReadouts();
    requestDraw();
  }));

  function updateReadouts() {
    const s = S;
    const ph = phaseAt(t, mode);
    const mach = s.spd / 3.6 / speedOfSound(s.alt);
    const tailFirst = t > 0.93;
    el.alt.textContent = fmtAlt(s.alt);
    el.time.textContent = fmtTime(s.tsec);
    el.hudTime.textContent = fmtTime(s.tsec);
    el.spd.textContent = `${(Math.round(s.spd / 10) * 10).toLocaleString('en-US')} km/h`;
    el.mach.textContent = s.spd < 40 ? '—' : mach >= 5 ? `${Math.round(mach)}` : mach.toFixed(1);
    el.aoa.textContent = tailFirst ? 'tail-first' : `~${Math.round(s.aoa)}°`;
    el.temp.textContent = `~${Math.round(s.temp / 10) * 10} °C`;
    el.g.textContent = `${s.g.toFixed(1)} g`;
    el.flaps.textContent = `fwd ${fmtFold(s.fFwd)} · aft ${fmtFold(s.fAft)}`;
    slider.setAttribute('aria-valuetext', `${ph.name}, ${fmtAlt(s.alt)}, ${Math.round(s.spd)} km/h`);
    if (ph !== lastPhase) {
      lastPhase = ph;
      el.phase.textContent = ph.name;
      el.phaseChip.textContent = ph.name;
      el.caption.textContent = ph.tag;
      el.copy.textContent = ph.copy;
      el.phaseDot.style.background = s.heat > 0.3 ? C.plasma : s.plume > 0.1 ? C.flame : C.ship;
      canvas.setAttribute('aria-label', `Reentry scene: ${ph.name}. ${ph.tag}`);
      marks.querySelectorAll('.re-mark').forEach(m => m.classList.toggle('is-active', Number(m.dataset.t) <= t));
    }
  }

  /* ---- particles ---- */
  function flowDir() {
    const f = rad(S.fpa);
    return [-Math.cos(f), Math.sin(f)]; // screen coords, opposite to velocity
  }
  function stepParticles(dt) {
    const dens = clamp((115 - S.alt) / 95, 0, 1);
    if (dens <= 0 || S.spd < 20) return;
    const v = (40 + 1100 * (S.spd / 26000)) * dens;
    const [fx, fy] = flowDir();
    for (const p of parts) {
      p.x += fx * v * dt * p.k / cw;
      p.y += fy * v * dt * p.k / ch;
      if (p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1) {
        // respawn upstream
        if (Math.abs(fx) > Math.abs(fy)) { p.x = fx > 0 ? -0.05 : 1.05; p.y = Math.random(); }
        else { p.y = fy > 0 ? -0.05 : 1.05; p.x = Math.random(); }
      }
    }
  }
  function drawParticles() {
    const s = S;
    const dens = clamp((115 - s.alt) / 95, 0, 1);
    if (dens <= 0 || s.spd < 20) return;
    const v = (40 + 1100 * (s.spd / 26000)) * dens;
    const [fx, fy] = flowDir();
    const len = clamp(v * 0.04, 2, 70);
    const tint = mixRGB(C.steel, C.plasma, s.heat * 0.8);
    const base = dens * clamp(s.spd / 2500, 0.15, 1) * 0.55;
    ctx.lineWidth = 1;
    for (const p of parts) {
      const x = p.x * cw, y = p.y * ch;
      ctx.strokeStyle = col(tint, base * p.k * 0.7);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + fx * len * p.k, y + fy * len * p.k); ctx.stroke();
    }
  }

  /* ---- drawing ---- */
  function bodyPath(L, r, nl) {
    ctx.beginPath();
    ctx.moveTo(-L / 2, -r);
    ctx.lineTo(L / 2 - nl, -r);
    ctx.bezierCurveTo(L / 2 - nl * 0.45, -r, L / 2 - nl * 0.08, -r * 0.5, L / 2, 0);
    ctx.bezierCurveTo(L / 2 - nl * 0.08, r * 0.5, L / 2 - nl * 0.45, r, L / 2 - nl, r);
    ctx.lineTo(-L / 2, r);
    ctx.closePath();
  }

  function draw() {
    const s = S, W = cw, H = ch;
    if (!W || !H) return;
    const L = Math.min(W * 0.36, H * 0.56), r = L * 0.09, nl = L * 0.26;
    const a = rad(s.axis), ca = Math.cos(a), sa = Math.sin(a);
    const bright = clamp(1 - s.alt / 100, 0, 1);
    const gvis = clamp(1 - s.alt / 3, 0, 1);
    const groundY = H + 30 - smooth(gvis) * (H * 0.24 + 30);

    // sky
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, mix(C.bg, C.methane, 0.28 * bright));
    sky.addColorStop(1, mix(C.bg, C.methane, 0.6 * bright));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // stars
    const sA = Math.pow(1 - bright, 1.6);
    if (sA > 0.02) {
      for (const st of stars) {
        const tw = 0.55 + 0.45 * Math.sin(clock * 1.3 + st.tw);
        ctx.fillStyle = rgba(C.text, sA * tw * 0.9);
        ctx.fillRect(st.x * W, st.y * H, st.s, st.s);
      }
    }

    // horizon haze
    if (gvis > 0) {
      const hz = ctx.createLinearGradient(0, groundY - H * 0.25, 0, groundY);
      hz.addColorStop(0, rgba(C.lox, 0)); hz.addColorStop(1, rgba(C.lox, 0.2 * gvis));
      ctx.fillStyle = hz; ctx.fillRect(0, groundY - H * 0.25, W, H * 0.25);
    }

    // ship placement: tail descends toward the ground as it gets close
    const off = mode === 'tower' ? 0.17 * L : 0;
    const cx = W * 0.5;
    const cy = lerp(H * 0.5, groundY - off - 0.5 * L * sa, smooth(gvis));

    if (gvis > 0) drawGround(groundY, cx, L, W, H, gvis);
    if (mode === 'tower' && gvis > 0) drawTower(groundY, cx, L, 'back');

    drawParticles();

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-a);
    if (s.heat > 0.02) drawWake(s, L, r);
    drawShip(s, L, r, nl);
    if (s.heat > 0.02) drawPlasma(s, L, r, nl);
    if (s.plume > 0.01) drawPlume(s, L, r);
    ctx.restore();

    if (mode === 'tower' && gvis > 0) drawTower(groundY, cx, L, 'front');
    drawLink(s, cx, cy, ca, sa, L, r, W, H);
  }

  function drawGround(groundY, cx, L, W, H, gvis) {
    if (mode === 'ocean') {
      const g = ctx.createLinearGradient(0, groundY, 0, H);
      g.addColorStop(0, mix(C.bg, C.methane, 0.4)); g.addColorStop(1, mix(C.bg, C.methane, 0.08));
      ctx.fillStyle = g; ctx.fillRect(0, groundY, W, H - groundY);
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        ctx.strokeStyle = rgba(C.lox, 0.28 - k * 0.06);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = groundY + 4 + k * 9 + Math.sin(x * 0.045 + clock * 1.4 + k * 1.7) * 2.2;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (S.t >= 0.99) {
        const p = clamp((S.t - 0.99) / 0.01, 0, 1);
        ctx.strokeStyle = rgba(C.lox, 0.5 * p);
        ctx.beginPath(); ctx.ellipse(cx, groundY + 2, L * 0.25 * (0.5 + p), L * 0.03 * (0.5 + p), 0, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      const g = ctx.createLinearGradient(0, groundY, 0, H);
      g.addColorStop(0, mix(C.bg, C.steelDark, 0.2)); g.addColorStop(1, mix(C.bg, C.steelDark, 0.06));
      ctx.fillStyle = g; ctx.fillRect(0, groundY, W, H - groundY);
      // pad
      ctx.fillStyle = rgba(C.steelDark, 0.55);
      ctx.fillRect(cx - L * 0.55, groundY - 3, L * 1.1, 4);
      ctx.strokeStyle = rgba(C.line2, 0.9); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, groundY + 0.5); ctx.lineTo(W, groundY + 0.5); ctx.stroke();
    }
    ctx.strokeStyle = rgba(C.lox, 0.35 * gvis); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, groundY - 0.5); ctx.lineTo(W, groundY - 0.5); ctx.stroke();
  }

  function drawTower(groundY, cx, L, layer) {
    const tx = cx + 0.36 * L, tw = 0.09 * L, top = groundY - 1.32 * L, armsY = groundY - 0.95 * L;
    const ext = lerp(0.1 * L, 0.52 * L, smooth((S.t - 0.95) / 0.04));
    if (layer === 'back') {
      ctx.fillStyle = rgba(C.tower, 0.14); ctx.fillRect(tx, top, tw, groundY - top);
      ctx.strokeStyle = rgba(C.tower, 0.55); ctx.lineWidth = 1;
      ctx.strokeRect(tx + 0.5, top + 0.5, tw, groundY - top);
      ctx.beginPath();
      const step = L * 0.09; let flip = false;
      for (let y = top; y < groundY - step; y += step) {
        ctx.moveTo(flip ? tx : tx + tw, y); ctx.lineTo(flip ? tx + tw : tx, y + step); flip = !flip;
      }
      ctx.strokeStyle = rgba(C.tower, 0.3); ctx.stroke();
      // back arm
      ctx.fillStyle = rgba(C.tower, 0.4);
      ctx.fillRect(tx - ext, armsY - 0.035 * L, ext, 0.024 * L);
    } else {
      ctx.fillStyle = rgba(C.tower, 0.9);
      ctx.fillRect(tx - ext, armsY, ext + 2, 0.03 * L);
      ctx.fillStyle = rgba(C.text, 0.5);
      ctx.fillRect(tx - ext, armsY, ext + 2, 1.5);
    }
  }

  function drawShip(s, L, r, nl) {
    const wob = ph => s.ctrl * 4 * Math.sin(clock * 2.1 + ph);
    const fF = clamp(s.fFwd + wob(0), 0, 90), fA = clamp(s.fAft + wob(2.2), 0, 90);
    const flap = (x0, x1, span, fold, fwd) => {
      const w = Math.max(L * 0.014, span * Math.cos(rad(fold)));
      for (const sg of [-1, 1]) {
        const y0 = sg * r, y1 = sg * (r + w);
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y0);
        ctx.lineTo(x1 - (fwd ? 0.03 : 0.015) * L, y1); ctx.lineTo(x0 + (fwd ? 0.05 : 0) * L, y1);
        ctx.closePath();
        ctx.fillStyle = sg > 0 ? mix(C.panel2, C.steelDark, 0.15) : mix(C.steelDark, C.steel, 0.35);
        ctx.fill();
        ctx.strokeStyle = rgba(C.steel, fold > 45 ? 0.9 : 0.5); ctx.lineWidth = 1; ctx.stroke();
      }
    };
    flap(0.17 * L, 0.40 * L, 0.11 * L, fF, true);
    flap(-0.49 * L, -0.23 * L, 0.16 * L, fA, false);

    // engines
    for (const k of [-1, 0, 1]) {
      const yc = k * r * 0.58, w0 = r * 0.42, w1 = r * 0.6;
      ctx.beginPath();
      ctx.moveTo(-L / 2, yc - w0 / 2); ctx.lineTo(-L / 2 - 0.035 * L, yc - w1 / 2);
      ctx.lineTo(-L / 2 - 0.035 * L, yc + w1 / 2); ctx.lineTo(-L / 2, yc + w0 / 2); ctx.closePath();
      ctx.fillStyle = mix(C.steelDark, C.bg, 0.45); ctx.fill();
      ctx.strokeStyle = rgba(C.steel, 0.4); ctx.stroke();
    }

    // body
    bodyPath(L, r, nl);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, mix(C.steel, C.text, 0.25));
    g.addColorStop(0.32, C.steel);
    g.addColorStop(0.5, C.steelDark);
    g.addColorStop(0.53, mix(C.panel2, C.steelDark, 0.2));
    g.addColorStop(1, C.bg2);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rgba(C.steel, 0.65); ctx.lineWidth = 1; ctx.stroke();

    // tile texture + header tanks (clipped to body)
    ctx.save();
    bodyPath(L, r, nl); ctx.clip();
    ctx.strokeStyle = rgba(C.steel, 0.08); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -L / 2; x < L / 2; x += r * 0.42) { ctx.moveTo(x, r * 0.06); ctx.lineTo(x + r * 0.3, r); }
    ctx.stroke();
    // hull ring seams
    ctx.strokeStyle = rgba(C.bg, 0.25);
    ctx.beginPath();
    for (let x = -L / 2 + L * 0.085; x < L / 2 - nl; x += L * 0.085) { ctx.moveTo(x, -r); ctx.lineTo(x, 0.05 * r); }
    ctx.stroke();
    const hA = clamp((s.t - 0.89) / 0.03, 0, 1);
    if (hA > 0) {
      const pulse = 0.75 + 0.25 * Math.sin(clock * 6);
      ctx.fillStyle = rgba(C.methane, 0.75 * hA * pulse);
      ctx.fillRect(L / 2 - nl * 0.95, -r * 0.3, nl * 0.45, r * 0.6);
      ctx.fillStyle = rgba(C.lox, 0.75 * hA * pulse);
      ctx.fillRect(-0.12 * L, -r * 0.35, 0.12 * L, r * 0.7);
      ctx.strokeStyle = rgba(C.methane, 0.5 * hA); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(L / 2 - nl * 0.95, 0); ctx.lineTo(-L / 2, 0); ctx.stroke();
    }
    ctx.restore();

    // catch pins (just below the forward flaps)
    ctx.fillStyle = C.steel;
    ctx.fillRect(0.15 * L, -r - 3, 0.02 * L, 3);
    ctx.fillRect(0.15 * L, r, 0.02 * L, 3);
  }

  function drawWake(s, L, r) {
    const fx = -Math.cos(rad(s.aoa)), fy = -Math.sin(rad(s.aoa));
    const len = L * (0.5 + 0.9 * s.heat) * clamp(s.spd / 8000, 0.2, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, fx * len, fy * len);
    g.addColorStop(0, rgba(C.plasma, 0.42 * s.heat));
    g.addColorStop(0.5, rgba(C.flame, 0.14 * s.heat));
    g.addColorStop(1, rgba(C.plasma, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-L / 2, r); ctx.lineTo(L / 2, 0);
    ctx.lineTo(L / 2 + fx * len * 0.7, fy * len * 0.7);
    ctx.lineTo(-L / 2 + fx * len, -r * 0.5 + fy * len);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawPlasma(s, L, r, nl) {
    const fl = s.heat * (0.86 + 0.1 * Math.sin(clock * 19) + 0.04 * Math.sin(clock * 47));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0.05 * L, r * 1.1, r * 0.3, 0.05 * L, r * 1.1, L * 0.75);
    halo.addColorStop(0, rgba(C.plasma, 0.3 * fl));
    halo.addColorStop(0.4, rgba(C.plasma, 0.1 * fl));
    halo.addColorStop(1, rgba(C.plasma, 0));
    ctx.fillStyle = halo; ctx.fillRect(-L, -L, 2 * L, 2 * L);

    ctx.save(); ctx.translate(0, r * 0.25); ctx.scale(1.08, 1.55); bodyPath(L, r, nl); ctx.restore();
    const g = ctx.createLinearGradient(0, -r, 0, r * 2.6);
    g.addColorStop(0, rgba(C.plasma, 0));
    g.addColorStop(0.45, rgba(C.plasma, 0.05 * fl));
    g.addColorStop(0.62, rgba(C.plasma, 0.75 * fl));
    g.addColorStop(0.8, rgba(C.flame2, 0.55 * fl));
    g.addColorStop(1, rgba(C.flame2, 0));
    ctx.fillStyle = g; ctx.fill();

    ctx.strokeStyle = rgba(C.flame2, 0.6 * fl); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-L / 2 + 4, r + 1); ctx.lineTo(L / 2 - nl, r + 1); ctx.stroke();
    ctx.restore();
  }

  function drawPlume(s, L, r) {
    const p = s.plume * (0.9 + 0.08 * Math.sin(clock * 31) + 0.05 * Math.sin(clock * 57));
    const len = L * 0.85 * p;
    const x0 = -L / 2 - 0.03 * L;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createLinearGradient(x0, 0, x0 - len, 0);
    g.addColorStop(0, rgba(C.flame2, 0.95)); g.addColorStop(0.35, rgba(C.flame, 0.6)); g.addColorStop(1, rgba(C.plasma, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, -r * 0.6); ctx.quadraticCurveTo(x0 - len * 0.5, -r * 1.0, x0 - len, 0);
    ctx.quadraticCurveTo(x0 - len * 0.5, r * 1.0, x0, r * 0.6); ctx.closePath(); ctx.fill();
    g = ctx.createLinearGradient(x0, 0, x0 - len * 0.55, 0);
    g.addColorStop(0, rgba(C.text, 0.8)); g.addColorStop(0.3, rgba(C.flame2, 0.6)); g.addColorStop(1, rgba(C.flame2, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, -r * 0.3); ctx.quadraticCurveTo(x0 - len * 0.25, -r * 0.4, x0 - len * 0.55, 0);
    ctx.quadraticCurveTo(x0 - len * 0.25, r * 0.4, x0, r * 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawLink(s, cx, cy, ca, sa, L, r, W, H) {
    if (s.heat < 0.15 || s.alt < 25) return;
    const alpha = clamp((s.heat - 0.15) * 3, 0, 1) * 0.9;
    const lx = 0.02 * L, ly = -r - 3;
    const px = cx + lx * ca + ly * sa, py = cy - lx * sa + ly * ca;
    const sx = W * 0.84, sy = H * 0.15;
    ctx.save();
    ctx.setLineDash([3, 5]); ctx.lineDashOffset = -clock * 30;
    ctx.strokeStyle = rgba(C.methane, alpha * 0.8); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.setLineDash(NO_DASH);
    ctx.fillStyle = rgba(C.steel, alpha); ctx.fillRect(sx - 5, sy - 3, 10, 6);
    ctx.fillStyle = rgba(C.methane, alpha * 0.8);
    ctx.fillRect(sx - 21, sy - 2, 14, 4); ctx.fillRect(sx + 7, sy - 2, 14, 4);
    ctx.font = `500 10px ${MONO}`; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = rgba(C.text2, alpha);
    ctx.fillText(W < 480 ? 'STARLINK' : 'STARLINK · NO BLACKOUT', sx + 22, sy + 8);
    ctx.restore();
  }

  // initial
  setT(0);
  fit();
}

/* ============================================================
   2. HEAT SHIELD EXPLORER
   ============================================================ */
const ZONES = {
  nose: { name: 'Nose cap', temp: '~1,200–1,300 °C', note: 'Stagnation region near the tip. Thicker tiles here, and the methane header tank sits just behind them.' },
  belly: { name: 'Windward belly', temp: '~1,100–1,400 °C', note: 'The main field of identical hexes. Each is a silica-based ceramic, pinned by three studs, with a small gap to its neighbours so everything can expand.' },
  edge: { name: 'Sidewall transition', temp: '~800–1,000 °C', note: 'Where tiles give way to bare stainless steel on the leeward side. The flow is cooler here, so no tiles are needed beyond this line.' },
  skirt: { name: 'Aft skirt', temp: '~1,000–1,200 °C', note: 'Tiles wrap around toward the engine bay, which is shielded by the body in the belly-flop attitude.' },
  hingeF: { name: 'Forward flap hinge', temp: '~1,400 °C and up', note: 'The hardest spot to protect: hot gas can work into the hinge gap. Block 2 moved the forward flaps leeward to shrink their exposure.' },
  hingeA: { name: 'Aft flap hinge', temp: '~1,400 °C and up', note: 'On Flight 4, plasma burned through an aft flap hinge during peak heating. The flap kept working and the ship still completed its flip and burn.' },
  flapF: { name: 'Forward flap (windward face)', temp: '~1,200 °C', note: 'The flaps are tiled too, and take the same beating as the belly while they steer.' },
  flapA: { name: 'Aft flap (windward face)', temp: '~1,200–1,300 °C', note: 'The bigger aft flaps sit nearest the hottest flow. Their actuators live inside the hull, behind the shield.' },
};

function initShield({ d, C, MONO, isReduced }) {
  const wrap = d('shield-stage');
  const canvas = d('shield');
  const ctx = canvas.getContext('2d');
  const zoneEl = d('tile-zone'), textEl = d('tile-text'), scaleEl = d('tile-scale');
  const loseBtn = d('lose'), resetBtn = d('reset');

  let W = 0, H = 0, dpr = 1, R = 8;
  let tiles = [], byKey = new Map();
  let geo = null;
  let hover = null, sel = null;
  let hot = []; // { tile, t0 }
  let raf = 0, lostCount = 0;

  const SQ3 = Math.sqrt(3);
  const key = (q, r) => `${q},${r}`;

  function build() {
    const rect = wrap.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width)); H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = clamp(W / 100, 6, 11);

    const pad = R * 2.2;
    const noseX = pad, tailX = W - pad, bodyL = tailX - noseX;
    const bodyR = Math.min(H * 0.165, bodyL * 0.105);
    const cy = H / 2, noseLen = bodyL * 0.27;
    geo = {
      noseX, tailX, bodyL, bodyR, cy, noseLen,
      fx0: noseX + noseLen * 0.75, fx1: noseX + noseLen * 1.55, fS: bodyR * 0.95,
      ax0: tailX - bodyL * 0.26, ax1: tailX - bodyL * 0.04, aS: bodyR * 1.35,
    };

    const prevLost = new Set(tiles.filter(t => t.lost).map(t => t.key));
    tiles = []; byKey = new Map();
    const qMax = Math.ceil(W / (1.5 * R)) + 2;
    for (let q = -1; q <= qMax; q++) {
      const rMin = Math.floor((-q / 2) - 2), rMax = Math.ceil(H / (SQ3 * R) - q / 2) + 2;
      for (let r = rMin; r <= rMax; r++) {
        const x = R * 1.5 * q, y = R * SQ3 * (r + q / 2);
        const zone = zoneAt(x, y);
        if (!zone) continue;
        const t = { q, r, x, y, zone, key: key(q, r), seed: Math.random(), lost: prevLost.has(key(q, r)) };
        tiles.push(t); byKey.set(t.key, t);
      }
    }
    lostCount = tiles.filter(t => t.lost).length;
    const per = Math.max(1, Math.round(18000 / tiles.length));
    scaleEl.textContent = `${tiles.length} hexes shown · each ≈ ${per} real tiles`;
    if (sel && !byKey.has(sel.key)) sel = null; else if (sel) sel = byKey.get(sel.key);
    hot = hot.filter(h => byKey.has(h.tile.key)).map(h => ({ tile: byKey.get(h.tile.key), t0: h.t0 }));
    draw();
  }

  function zoneAt(x, y) {
    const g = geo; const dy = Math.abs(y - g.cy);
    if (x < g.noseX || x > g.tailX) return null;
    let halfH = g.bodyR;
    if (x < g.noseX + g.noseLen) { const u = (x - g.noseX) / g.noseLen; halfH = g.bodyR * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))); }
    if (dy <= halfH) {
      if (x < g.noseX + g.noseLen * 0.6) return 'nose';
      if (dy > g.bodyR * 0.74) return 'edge';
      if (x > g.tailX - g.bodyL * 0.08) return 'skirt';
      return 'belly';
    }
    if (x >= g.fx0 && x <= g.fx1 && dy <= g.bodyR + g.fS) return dy < g.bodyR + R * 1.3 ? 'hingeF' : 'flapF';
    if (x >= g.ax0 && x <= g.ax1 && dy <= g.bodyR + g.aS) return dy < g.bodyR + R * 1.3 ? 'hingeA' : 'flapA';
    return null;
  }

  function tileAt(px, py) {
    const qf = (2 / 3 * px) / R, rf = (-1 / 3 * px + SQ3 / 3 * py) / R;
    // cube round
    let x = qf, z = rf, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    return byKey.get(key(rx, rz)) || null;
  }

  function hexPath(x, y, rr) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 3 * i;
      const px = x + rr * Math.cos(ang), py = y + rr * Math.sin(ang);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function draw() {
    if (!W) return;
    const now = performance.now();
    ctx.clearRect(0, 0, W, H);
    // silhouette (bare hull underneath)
    const g = geo;
    ctx.save();
    ctx.strokeStyle = rgba(C.steel, 0.22); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.tailX, g.cy - g.bodyR); ctx.lineTo(g.noseX + g.noseLen, g.cy - g.bodyR);
    ctx.bezierCurveTo(g.noseX + g.noseLen * 0.45, g.cy - g.bodyR, g.noseX + g.noseLen * 0.08, g.cy - g.bodyR * 0.5, g.noseX, g.cy);
    ctx.bezierCurveTo(g.noseX + g.noseLen * 0.08, g.cy + g.bodyR * 0.5, g.noseX + g.noseLen * 0.45, g.cy + g.bodyR, g.noseX + g.noseLen, g.cy + g.bodyR);
    ctx.lineTo(g.tailX, g.cy + g.bodyR); ctx.closePath(); ctx.stroke();
    ctx.restore();

    for (const t of tiles) {
      hexPath(t.x, t.y, R - 0.7);
      if (t.lost) ctx.fillStyle = mix(C.steelDark, C.steel, 0.3);
      else ctx.fillStyle = mix(C.panel2, C.steelDark, 0.06 + 0.12 * t.seed);
      ctx.fill();
    }
    // hot spots
    let animating = false;
    if (hot.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const h of hot) {
        const p = isReduced() ? 1 : clamp((now - h.t0) / 1400, 0, 1);
        if (p < 1) animating = true;
        const e = smooth(p);
        const rr = R * (1.2 + 2.6 * e);
        const gr = ctx.createRadialGradient(h.tile.x, h.tile.y, R * 0.2, h.tile.x, h.tile.y, rr);
        gr.addColorStop(0, rgba(C.flame2, 0.95 * e));
        gr.addColorStop(0.35, rgba(C.flame, 0.6 * e));
        gr.addColorStop(0.7, rgba(C.plasma, 0.25 * e));
        gr.addColorStop(1, rgba(C.plasma, 0));
        ctx.fillStyle = gr; ctx.fillRect(h.tile.x - rr, h.tile.y - rr, rr * 2, rr * 2);
      }
      ctx.restore();
    }
    // zone outlines for hinge lines
    ctx.strokeStyle = rgba(C.line2, 0.8); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.fx0, g.cy - g.bodyR); ctx.lineTo(g.fx1, g.cy - g.bodyR);
    ctx.moveTo(g.fx0, g.cy + g.bodyR); ctx.lineTo(g.fx1, g.cy + g.bodyR);
    ctx.moveTo(g.ax0, g.cy - g.bodyR); ctx.lineTo(g.ax1, g.cy - g.bodyR);
    ctx.moveTo(g.ax0, g.cy + g.bodyR); ctx.lineTo(g.ax1, g.cy + g.bodyR);
    ctx.stroke();
    // labels
    ctx.font = `500 10px ${MONO}`; ctx.fillStyle = rgba(C.muted, 0.9); ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left'; ctx.fillText('NOSE', g.noseX, g.cy - g.bodyR - g.fS - 6);
    ctx.textAlign = 'right'; ctx.fillText('AFT', g.tailX, g.cy - g.bodyR - g.aS - 6);
    ctx.textAlign = 'left';
    ctx.fillText(W < 480 ? 'WINDWARD BELLY (TILED)' : 'WINDWARD BELLY (TILED) · LEEWARD SIDE IS BARE STEEL', g.noseX, H - 6);

    const focus = hover || sel;
    if (focus) {
      hexPath(focus.x, focus.y, R - 0.2);
      ctx.strokeStyle = sel === focus ? C.methane : rgba(C.methane, 0.7); ctx.lineWidth = sel === focus ? 2 : 1.5; ctx.stroke();
    }
    if (animating && !raf) raf = requestAnimationFrame(() => { raf = 0; draw(); });
  }

  function describe(t) {
    if (!t) {
      zoneEl.textContent = 'No tile selected';
      textEl.textContent = 'Each hexagon on this map stands in for a cluster of real tiles. The whole windward side is covered; the leeward side is bare steel.';
      return;
    }
    const z = ZONES[t.zone];
    zoneEl.textContent = `${z.name} · ${t.lost ? 'TILE LOST' : 'intact'}`;
    textEl.textContent = t.lost
      ? `Bare hull exposed here. ${lossText(t)}`
      : `Tile ${t.q}:${t.r + Math.ceil(t.q / 2)} · est. peak surface ${z.temp}. ${z.note}`;
  }
  function lossText(t) {
    const z = ZONES[t.zone];
    return `Hot gas now reaches the stainless skin at ${z.temp} surface conditions. The steel's mass and the ablative backup layer buy time, and the gap flow around a single missing tile is usually survivable, but neighbouring tiles see hotter, more turbulent flow and can go next. ${lostCount > 1 ? `${lostCount} tiles lost: the hot spot is spreading.` : 'Early flights lost a handful of tiles and still made it down.'}`;
  }

  function setHover(t) { if (t !== hover) { hover = t; describe(hover || sel); draw(); } }
  function setSel(t) { sel = t; describe(sel); draw(); }

  canvas.addEventListener('pointermove', e => {
    const b = canvas.getBoundingClientRect();
    setHover(tileAt(e.clientX - b.left, e.clientY - b.top));
  });
  canvas.addEventListener('pointerleave', () => setHover(null));
  canvas.addEventListener('click', e => {
    const b = canvas.getBoundingClientRect();
    setSel(tileAt(e.clientX - b.left, e.clientY - b.top));
  });
  canvas.addEventListener('keydown', e => {
    const dirs = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const dir = dirs[e.key];
    if (dir) {
      e.preventDefault();
      if (!sel) { setSel(centreTile()); return; }
      let q = sel.q, r = sel.r;
      for (let i = 0; i < 6; i++) {
        q += dir[0]; r += dir[1];
        if (dir[0] && (q & 1) === 0 && dir[0] === 1) { /* keep rows level across columns */ }
        const t = byKey.get(key(q, r)); if (t) { setSel(t); return; }
      }
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loseTile(); }
  });

  function centreTile() {
    let best = null, bd = Infinity;
    for (const t of tiles) { const dd = (t.x - W * 0.55) ** 2 + (t.y - H / 2) ** 2; if (dd < bd) { bd = dd; best = t; } }
    return best;
  }
  function neighbours(t) {
    const out = [];
    for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
      const n = byKey.get(key(t.q + dq, t.r + dr)); if (n && !n.lost) out.push(n);
    }
    return out;
  }
  function loseTile() {
    let t = sel && !sel.lost ? sel : null;
    if (!t) {
      const lostTiles = tiles.filter(x => x.lost);
      if (lostTiles.length) {
        const cands = lostTiles.flatMap(neighbours);
        t = cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
      }
      if (!t) t = centreTile();
    }
    if (!t) return;
    t.lost = true; lostCount++;
    hot.push({ tile: t, t0: performance.now() });
    sel = t; describe(t); draw();
  }
  loseBtn.addEventListener('click', loseTile);
  resetBtn.addEventListener('click', () => {
    for (const t of tiles) t.lost = false;
    hot = []; lostCount = 0; sel = null; describe(null); draw();
  });

  new ResizeObserver(build).observe(wrap);
  build();
}

/* ============================================================
   3. FLAP CONTROLS
   ============================================================ */
function initFlaps({ root, d, C }) {
  const host = d('flap-svg');
  host.innerHTML = `
<svg viewBox="0 0 420 300" class="re-flapsvg" role="img" aria-label="Diagram: belly view of Starship with four flaps, plus pitch and roll indicators">
  <g class="re-f-grid" aria-hidden="true">
    <line x1="0" y1="150" x2="420" y2="150"/><line x1="150" y1="0" x2="150" y2="300"/>
  </g>
  <!-- belly view: nose at left, tail at right -->
  <g class="re-f-belly" transform="translate(0,0)">
    <text x="36" y="38" class="re-f-label">BELLY VIEW · NOSE</text>
    <text x="272" y="38" class="re-f-label" text-anchor="end">TAIL</text>
    <polygon data-f="fl" class="re-f-flap" points=""/>
    <polygon data-f="fr" class="re-f-flap" points=""/>
    <polygon data-f="al" class="re-f-flap" points=""/>
    <polygon data-f="ar" class="re-f-flap" points=""/>
    <path class="re-f-body" d="M36 150 C36 136 44 126 70 126 L272 126 L272 174 L70 174 C44 174 36 164 36 150 Z"/>
    <circle class="re-f-cg" cx="196" cy="150" r="4"/>
    <text x="200" y="192" class="re-f-label re-f-dim" text-anchor="end">CENTRE OF MASS</text>
    <circle data-d="fl" class="re-f-drag" cx="0" cy="0" r="0"/>
    <circle data-d="fr" class="re-f-drag" cx="0" cy="0" r="0"/>
    <circle data-d="al" class="re-f-drag" cx="0" cy="0" r="0"/>
    <circle data-d="ar" class="re-f-drag" cx="0" cy="0" r="0"/>
    <text x="36" y="282" class="re-f-label re-f-dim">DOT SIZE = DRAG ON THAT FLAP</text>
  </g>
  <!-- pitch indicator -->
  <g transform="translate(345,78)">
    <text x="0" y="-48" class="re-f-label" text-anchor="middle">PITCH</text>
    <line x1="-46" y1="0" x2="46" y2="0" class="re-f-ref"/>
    <g data-ind="pitch">
      <path class="re-f-side" d="M-34 -6 L22 -6 Q34 -6 36 0 Q34 6 22 6 L-34 6 Z"/>
      <rect x="-32" y="-11" width="12" height="5" class="re-f-sideflap"/>
      <rect x="10" y="-10" width="9" height="4" class="re-f-sideflap"/>
      <rect x="-32" y="6" width="12" height="5" class="re-f-sideflap"/>
      <rect x="10" y="6" width="9" height="4" class="re-f-sideflap"/>
    </g>
    <path data-arrow="pitch" class="re-f-arrow" d=""/>
    <text x="0" y="40" class="re-f-label re-f-dim" text-anchor="middle">side view · nose right</text>
  </g>
  <!-- roll indicator -->
  <g transform="translate(345,222)">
    <text x="0" y="-48" class="re-f-label" text-anchor="middle">ROLL</text>
    <line x1="-46" y1="0" x2="46" y2="0" class="re-f-ref"/>
    <g data-ind="roll">
      <circle r="14" class="re-f-side"/>
      <rect x="-40" y="-2" width="26" height="4" class="re-f-sideflap"/>
      <rect x="14" y="-2" width="26" height="4" class="re-f-sideflap"/>
      <path d="M-14 0 A14 14 0 0 0 14 0 Z" class="re-f-tileside"/>
    </g>
    <path data-arrow="roll" class="re-f-arrow" d=""/>
    <text x="0" y="40" class="re-f-label re-f-dim" text-anchor="middle">view from the tail</text>
  </g>
</svg>`;

  const inputs = {};
  root.querySelectorAll('[data-flap]').forEach(i => { inputs[i.dataset.flap] = i; });
  const vals = { fl: d('v-fl'), fr: d('v-fr'), al: d('v-al'), ar: d('v-ar') };
  const poly = {}; host.querySelectorAll('[data-f]').forEach(p => { poly[p.dataset.f] = p; });
  const dots = {}; host.querySelectorAll('[data-d]').forEach(p => { dots[p.dataset.d] = p; });
  const ind = { pitch: host.querySelector('[data-ind="pitch"]'), roll: host.querySelector('[data-ind="roll"]') };
  const arrows = { pitch: host.querySelector('[data-arrow="pitch"]'), roll: host.querySelector('[data-arrow="roll"]') };
  const out = { pitch: d('r-pitch'), roll: d('r-roll'), yaw: d('r-yaw'), vt: d('r-vt'), copy: d('flap-copy') };

  // flap geometry (belly view, nose at left). "left" flaps drawn at the top edge.
  const FLAPS = {
    fl: { x0: 78, x1: 120, span: 34, side: -1, fwd: true },
    fr: { x0: 78, x1: 120, span: 34, side: 1, fwd: true },
    al: { x0: 206, x1: 266, span: 52, side: -1, fwd: false },
    ar: { x0: 206, x1: 266, span: 52, side: 1, fwd: false },
  };
  const Y0 = 126, Y1 = 174;

  function arcArrow(mag) {
    // curved arrow from the right side, amplitude ∝ mag; positive = counter-clockwise in SVG (nose up)
    const m = clamp(mag, -1, 1);
    if (Math.abs(m) < 0.08) return '';
    const R0 = 42, a0 = 0, a1 = -m * 1.1; // radians
    const x0 = R0 * Math.cos(a0), y0 = R0 * Math.sin(a0);
    const x1 = R0 * Math.cos(a1), y1 = R0 * Math.sin(a1);
    const sweep = m > 0 ? 0 : 1;
    const tx = -Math.sin(a1) * (m > 0 ? -1 : 1), ty = Math.cos(a1) * (m > 0 ? -1 : 1);
    const hx = x1 + tx * 7, hy = y1 + ty * 7;
    const nx = Math.cos(a1), ny = Math.sin(a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${R0} ${R0} 0 0 ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)} M${(x1 + nx * 4).toFixed(1)} ${(y1 + ny * 4).toFixed(1)} L${hx.toFixed(1)} ${hy.toFixed(1)} L${(x1 - nx * 4).toFixed(1)} ${(y1 - ny * 4).toFixed(1)}`;
  }

  function pct(v) { return `${Math.round(Math.abs(v) * 100)}%`; }

  function update() {
    const a = {};
    for (const k in inputs) { a[k] = Number(inputs[k].value); vals[k].textContent = `${a[k]}°`; }
    const dr = {}; for (const k in a) dr[k] = Math.cos(rad(a[k]));
    const pitch = ((dr.fl + dr.fr) - (dr.al + dr.ar)) / 2;   // + = nose up
    const roll = ((dr.fl + dr.al) - (dr.fr + dr.ar)) / 2;    // + = roll right (left side up)
    const yaw = ((dr.fl + dr.ar) - (dr.fr + dr.al)) / 2;
    const meanD = (dr.fl + dr.fr + dr.al + dr.ar) / 4;
    const vt = 300 * Math.sqrt(1 / (0.72 + 0.28 * meanD));

    for (const k in FLAPS) {
      const f = FLAPS[k];
      const w = Math.max(4, f.span * dr[k]);
      const yh = f.side < 0 ? Y0 : Y1, yt = yh + f.side * w;
      const taperA = f.fwd ? 10 : 0, taperB = f.fwd ? 5 : 3;
      poly[k].setAttribute('points', `${f.x0},${yh} ${f.x1},${yh} ${f.x1 - taperB},${yt} ${f.x0 + taperA},${yt}`);
      poly[k].classList.toggle('is-folded', a[k] > 45);
      const dot = dots[k];
      dot.setAttribute('cx', (f.x0 + f.x1) / 2); dot.setAttribute('cy', yh + f.side * (w / 2));
      dot.setAttribute('r', (2 + 7 * dr[k]).toFixed(1));
    }
    ind.pitch.setAttribute('transform', `rotate(${(-pitch * 28).toFixed(1)})`);
    ind.roll.setAttribute('transform', `rotate(${(roll * 28).toFixed(1)})`);
    arrows.pitch.setAttribute('d', arcArrow(pitch));
    arrows.roll.setAttribute('d', arcArrow(-roll));

    out.pitch.textContent = Math.abs(pitch) < 0.08 ? 'trimmed' : (pitch > 0 ? `nose up ${pct(pitch)}` : `nose down ${pct(pitch)}`);
    out.roll.textContent = Math.abs(roll) < 0.08 ? 'trimmed' : (roll > 0 ? `roll right ${pct(roll)}` : `roll left ${pct(roll)}`);
    out.yaw.textContent = Math.abs(yaw) < 0.08 ? 'trimmed' : (yaw > 0 ? `slight nose-left ${pct(yaw * 0.5)}` : `slight nose-right ${pct(yaw * 0.5)}`);
    out.vt.textContent = `~${Math.round(vt / 5) * 5} km/h`;

    const parts = [];
    if (Math.abs(pitch) >= 0.08) {
      parts.push(pitch > 0
        ? 'The forward flaps are catching more air than the aft flaps, so the tail is held less firmly and drops while the nose is pushed back: nose up. This is exactly what the ship does at the start of the landing flip.'
        : 'The aft flaps are catching more air than the forward flaps, so the tail is held up and the nose drops: nose down.');
    } else parts.push('Pitch is trimmed: drag ahead of and behind the centre of mass balances out.');
    if (Math.abs(roll) >= 0.08) {
      parts.push(roll > 0
        ? 'The left-hand flaps have more drag, so that side is pushed up and the ship rolls toward its right.'
        : 'The right-hand flaps have more drag, so that side is pushed up and the ship rolls toward its left.');
    }
    if (Math.abs(yaw) >= 0.08) parts.push('A diagonal asymmetry (one forward flap against the opposite aft flap) also twists the ship slightly in yaw; the flight computer uses this together with cold-gas thrusters.');
    if (meanD < 0.5) parts.push('With most flaps folded, total drag drops and terminal velocity rises.');
    out.copy.textContent = parts.join(' ');
  }

  for (const k in inputs) inputs[k].addEventListener('input', update);
  root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const [fl, fr, al, ar] = b.dataset.preset.split(',').map(Number);
    inputs.fl.value = fl; inputs.fr.value = fr; inputs.al.value = al; inputs.ar.value = ar;
    update();
  }));
  update();
}

/* ---------- boot ---------- */
const mount = document.getElementById('mount-reentry');
if (mount) boot(mount);

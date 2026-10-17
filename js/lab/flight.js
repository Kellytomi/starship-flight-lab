// Flight model: trajectories, mass/propellant, forces and the narrative for every phase.
// Figures are approximate, modelled on public information about Block 2 Starship test
// flights (2024–2025). Trajectory keyframes are interpolated with monotone cubics.

export const R_EARTH = 6371e3;          // m
export const G0 = 9.80665;
export const PAD_H = 20;                // launch-mount deck height (m), set by the site model
export const CATCH_ALT = 25;            // booster engine plane height above deck at catch (m)

/* ------------------------------------------------------------------ */
/* Keyframes: [t (s), downrange (km), altitude (km), speed (km/h), pitch (deg), engines, throttle] */
const STACK = [
  [-30, 0, 0, 0, 0, 0, 0],
  [-3, 0, 0, 0, 0, 33, 0.6],
  [0, 0, 0, 0, 0, 33, 1],
  [10, 0, 0.15, 90, 0, 33, 1],
  [30, 0.3, 2.2, 520, 3, 33, 1],
  [40, 0.9, 5.2, 900, 7, 33, 0.82],
  [52, 2.5, 11, 1500, 15, 33, 0.8],
  [66, 5.2, 17.5, 2050, 21, 33, 1],
  [80, 9, 24, 2600, 27, 33, 1],
  [110, 22, 40, 3800, 40, 33, 1],
  [140, 40, 56, 4900, 50, 33, 0.92],
  [158, 55, 65, 5500, 55, 33, 0.9],
];
const BOOSTER = STACK.concat([
  [161, 57.3, 66.6, 5450, 56, 3, 0.55],
  [166, 61, 69.6, 5300, 58, 3, 0.55],
  [172, 64.5, 72.3, 5000, 10, 3, 0.6],
  [178, 67, 74.3, 4600, -70, 13, 0.85],
  [210, 74, 84, 2400, -82, 13, 0.85],
  [228, 75, 88.5, 1500, -80, 0, 0],
  [255, 72, 94, 1400, -20, 0, 0],
  [275, 68, 95, 1450, -5, 0, 0],
  [320, 52, 80, 2600, -8, 0, 0],
  [350, 33, 50, 3900, -8, 0, 0],
  [368, 18, 26, 3200, -6, 0, 0],
  [380, 8, 11, 1250, -4, 0, 0],
  [392, 2.4, 3.2, 850, -3, 0, 0],
  [396, 1.1, 1.6, 700, -2, 13, 0.9],
  [404, 0.3, 0.45, 260, -1, 13, 0.75],
  [409, 0.06, 0.16, 90, 0, 3, 0.75],
  [416, 0.003, 0.05, 12, 0, 3, 0.55],
  [421, 0, CATCH_ALT / 1000 + 0.0005, 1, 0, 3, 0.45],
  [423, 0, CATCH_ALT / 1000, 0, 0, 0, 0],
  [9000, 0, CATCH_ALT / 1000, 0, 0, 0, 0],
]);
const SHIP_ASCENT = [
  [159, 55.7, 65.5, 5500, 55, 6, 1],
  [161, 57.32, 66.62, 5480, 56, 6, 1],
  [166, 61.2, 69.75, 5600, 58, 6, 1],
  [175, 68, 75.5, 6100, 61, 6, 1],
  [200, 90, 90, 7300, 66, 6, 1],
  [260, 175, 118, 10000, 74, 6, 1],
  [330, 330, 143, 14000, 80, 6, 1],
  [400, 560, 158, 18000, 85, 6, 1],
  [470, 880, 166, 22500, 88, 6, 0.9],
  [515, 1150, 170, 26400, 90, 0, 0],
];
// Test-flight profile: splash down in the Indian Ocean ~65 min after launch.
const SHIP_SPLASH = STACK.concat(SHIP_ASCENT, [
  [900, 3900, 185, 26600, 90, 0, 0],
  [1700, 9800, 195, 26700, 90, 0, 0],
  [2240, 13700, 182, 26800, 90, 1, 1],
  [2246, 13744, 182, 26800, 90, 0, 0],
  [2700, 16900, 135, 26700, 22, 0, 0],
  [2820, 17780, 120, 26500, 20, 0, 0],
  [3060, 19300, 75, 24000, 22, 0, 0],
  [3300, 20300, 50, 14000, 25, 0, 0],
  [3500, 20700, 30, 4500, 30, 0, 0],
  [3650, 20785, 12, 1150, 45, 0, 0],
  [3800, 20800, 2, 330, 88, 0, 0],
  [3830, 20801, 0.6, 300, 90, 0, 0],
  [3833, 20801.05, 0.5, 290, 90, 3, 0.9],
  [3840, 20801.1, 0.3, 180, 5, 3, 0.8],
  [3850, 20801.12, 0.05, 30, 0, 3, 0.5],
  [3856, 20801.12, 0, 0, 0, 0, 0],
  [9000, 20801.12, 0, 0, 0, 0, 0],
]);
// Full-reuse profile: one orbit, deorbit burn, return to the tower and get caught.
const C = 2 * Math.PI * R_EARTH / 1000;   // km around
const SHIP_CATCH = STACK.concat(SHIP_ASCENT, [
  [900, 3900, 185, 26600, 90, 0, 0],
  [2400, 15000, 205, 26700, 90, 0, 0],
  [3900, C - 9800, 200, 26700, 90, 0, 0],
  [4280, C - 7050, 195, 26650, 90, 1, 1],        // deorbit burn
  [4300, C - 6900, 195, 26500, 90, 0, 0],
  [4700, C - 3900, 130, 26500, 22, 0, 0],
  [4790, C - 3250, 120, 26450, 20, 0, 0],
  [5030, C - 1720, 75, 24000, 22, 0, 0],
  [5270, C - 600, 50, 14000, 25, 0, 0],
  [5470, C - 140, 30, 4500, 30, 0, 0],
  [5620, C - 22, 12, 1150, 45, 0, 0],
  [5770, C - 2.4, 2, 330, 88, 0, 0],
  [5800, C - 0.45, 0.6, 300, 90, 0, 0],
  [5803, C - 0.22, 0.5, 290, 90, 3, 0.9],
  [5810, C - 0.04, 0.3, 160, 5, 3, 0.8],
  [5820, C - 0.002, 0.08, 25, 0, 3, 0.6],
  [5826, C, 0.0185, 0, 0, 3, 0.45],
  [5828, C, 0.0185, 0, 0, 0, 0],
  [9000, C, 0.0185, 0, 0, 0, 0],
]);

/* ------------------------------------------------------------------ */
function monotone(ts, ys) {
  const n = ts.length, h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = ts[i + 1] - ts[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return t => {
    if (t <= ts[0]) return ys[0];
    if (t >= ts[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ts[mid] <= t) lo = mid; else hi = mid; }
    const hh = h[lo], u = (t - ts[lo]) / hh, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[lo] + (u3 - 2 * u2 + u) * hh * m[lo] + (-2 * u3 + 3 * u2) * ys[lo + 1] + (u3 - u2) * hh * m[lo + 1];
  };
}

/* Engines & vehicles (Raptor 2-class figures) */
const RAPTOR = { fsl: 2.26e6, fvac: 2.53e6, ispSl: 327, ispVac: 350 };
const RVAC = { fsl: 0, fvac: 2.58e6, ispSl: 0, ispVac: 378 };
const P0 = 101325;
export const atm = h => {                  // h in m → { rho, p, a (speed of sound) }
  const hh = Math.max(0, h);
  const rho = 1.225 * Math.exp(-hh / 7400);
  const p = P0 * Math.exp(-hh / 7400);
  const T = hh < 11000 ? 288 - 0.0065 * hh : hh < 20000 ? 216.65 : hh < 47000 ? 216.65 + 0.0028 * (hh - 20000) : 270;
  return { rho, p, a: Math.sqrt(1.4 * 287 * T) };
};
const engF = (e, p) => Math.max(0, e.fvac - (e.fvac - (e.fsl || e.fvac * 0.2)) * (p / P0));

const VEH = {
  booster: { dry: 275e3, area: 63.6, cd: 0.45, len: 72.3 },
  ship: { dry: 130e3, area: 63.6, cd: 0.4, len: 52, bellyArea: 430 },
};

function buildTrack(keys, kind) {
  const ts = keys.map(k => k[0]);
  const ch = [1, 2, 3, 4, 6].map(c => monotone(ts, keys.map(k => k[c])));
  const engAt = t => { let e = 0; for (const k of keys) { if (k[0] <= t) e = k[5]; else break; } return e; };
  // integrate propellant use on a 0.5 s grid
  const step = 0.5, t0 = keys[0][0], t1 = keys[keys.length - 1][0];
  const used = [0];
  let acc = 0;
  for (let t = t0; t < t1; t += step) {
    const e = engAt(t), thr = Math.max(0, ch[4](t));
    const alt = Math.max(0, ch[1](t)) * 1000, { p } = atm(alt);
    let mdot = 0;
    if (kind === "ship" && t < 159) mdot = 0;                 // ship engines are off while stacked
    else if (kind === "booster") {
      // booster engines (in stacked flight the ship's engines are off)
      mdot = e * thr * engF(RAPTOR, p) / (G0 * lerp(RAPTOR.ispSl, RAPTOR.ispVac, 1 - p / P0));
    } else {
      const sl = Math.min(3, e), vac = e >= 6 ? 3 : 0;
      mdot = thr * (sl * engF(RAPTOR, p) / (G0 * lerp(RAPTOR.ispSl, RAPTOR.ispVac, 1 - p / P0)) + vac * engF(RVAC, p) / (G0 * RVAC.ispVac));
    }
    acc += mdot * step; used.push(acc);
  }
  // Normalise to published propellant loads (~3,400 t booster, ~1,500 t ship); the simple
  // engine model above slightly over-predicts flow, so scale it rather than invent masses.
  const target = kind === "booster" ? 3350e3 : 1480e3;
  const kScale = target / acc;
  for (let i = 0; i < used.length; i++) used[i] *= kScale;
  const usedAt = t => used[Math.max(0, Math.min(used.length - 1, Math.round((t - t0) / step)))];
  const total = target;
  const reserve = kind === "booster" ? 22e3 : 30e3;
  const prop0 = total + reserve;
  return {
    kind, keys, t0, t1, prop0,
    at(t) {
      const x = ch[0](t), alt = Math.max(0, ch[1](t)), v = Math.max(0, ch[2](t)), pitch = ch[3](t);
      return { t, x, alt, v, pitch, eng: engAt(t), thr: Math.max(0, Math.min(1, ch[4](t))), prop: Math.max(reserve * 0.2, prop0 - usedAt(t)) };
    },
  };
}
const lerp = (a, b, k) => a + (b - a) * k;

export const TRACKS = {
  booster: buildTrack(BOOSTER, "booster"),
  ship: { splash: buildTrack(SHIP_SPLASH, "ship"), catch: buildTrack(SHIP_CATCH, "ship") },
};

/* World position on a curved Earth: downrange along +X, up +Y, launch mount at origin. */
export function worldPos(xKm, altKm, out) {
  const th = (xKm * 1000) / R_EARTH, r = R_EARTH + altKm * 1000 + PAD_H;
  out.x = r * Math.sin(th); out.y = r * Math.cos(th) - R_EARTH; out.z = 0;
  return th;
}

/* ------------------------------------------------------------------ */
/* Forces on one vehicle at time t (SI units). Stacked flight (t < 166) is one body. */
export function forcesAt(kind, track, t, shipTrack) {
  const s = track.at(t);
  const stacked = t < 166;
  const h = s.alt * 1000;
  const A = atm(h);
  const vms = s.v / 3.6;
  const g = G0 * Math.pow(R_EARTH / (R_EARTH + h), 2);
  let mass = VEH[kind].dry + s.prop;
  if (stacked) {
    const other = kind === "booster" ? shipTrack.at(t) : TRACKS.booster.at(t);
    mass += (kind === "booster" ? VEH.ship.dry : VEH.booster.dry) + other.prop;
  }
  // thrust
  let thrust = 0;
  const bs = TRACKS.booster.at(t);
  if (stacked) {
    thrust = bs.eng * bs.thr * engF(RAPTOR, A.p);
    if (t >= 159) { const ss = shipTrack.at(t); thrust += ss.thr * (3 * engF(RAPTOR, A.p) + 3 * engF(RVAC, A.p)) * 0.25; } // most ship thrust goes into the ring
  } else if (kind === "booster") thrust = s.eng * s.thr * engF(RAPTOR, A.p);
  else {
    const sl = Math.min(3, s.eng), vac = s.eng >= 6 ? 3 : 0;
    thrust = s.thr * (sl * engF(RAPTOR, A.p) + vac * engF(RVAC, A.p));
  }
  // aerodynamics
  const q = 0.5 * A.rho * vms * vms;
  let cd = VEH[kind].cd, area = VEH[kind].area;
  const ship = kind === "ship";
  const reentry = ship && t > 2600 && s.eng === 0 && s.alt > 0.55;
  if (reentry) { area = VEH.ship.bellyArea; cd = s.v > 4000 ? 1.45 : 1.15; }
  if (kind === "booster" && t > 228) cd = 0.9;        // engines-first with grid fins
  const drag = q * cd * area;
  const lift = reentry && s.v > 1500 ? drag * 0.3 : 0;
  const weight = mass * g;
  // support from the launch mount (before liftoff) or the chopsticks (after catch)
  let support = 0, supportLabel = "Pad reaction";
  if (t < 0) support = Math.max(0, weight - thrust);
  if (kind === "booster" && t >= 421) { support = Math.max(0, weight - thrust); supportLabel = "Arm load"; }
  if (ship && track === TRACKS.ship.catch && t >= 5826) { support = Math.max(0, weight - thrust); supportLabel = "Arm load"; }
  if (ship && track === TRACKS.ship.splash && t >= 3856) { support = weight; supportLabel = "Buoyancy"; }
  return {
    s, mass, g, weight, thrust, drag, lift, q, support, supportLabel,
    mach: vms / A.a, twr: thrust / weight, accelG: Math.abs(thrust - drag - weight * Math.cos(s.pitch * Math.PI / 180)) / mass / G0,
  };
}

/* ------------------------------------------------------------------ */
/* Sources cited in the panel */
export const SRC = {
  spacex: ["SpaceX", "https://www.spacex.com/vehicles/starship/"],
  wikiSH: ["Wikipedia", "https://en.wikipedia.org/wiki/SpaceX_Super_Heavy"],
  wikiShip: ["Wikipedia", "https://en.wikipedia.org/wiki/SpaceX_Starship_(spacecraft)"],
  raptor: ["Wikipedia", "https://en.wikipedia.org/wiki/SpaceX_Raptor"],
  maxq: ["Wikipedia", "https://en.wikipedia.org/wiki/Max_q"],
  entry: ["Wikipedia", "https://en.wikipedia.org/wiki/Atmospheric_entry"],
  gridfin: ["Wikipedia", "https://en.wikipedia.org/wiki/Grid_fin"],
  thrust: ["NASA", "https://www.grc.nasa.gov/www/k-12/rocket/rktthsum.html"],
  drag: ["NASA", "https://www.grc.nasa.gov/www/k-12/airplane/drageq.html"],
  newton3: ["NASA", "https://www.grc.nasa.gov/www/k-12/airplane/newton3.html"],
  rocketEq: ["OpenStax", "https://openstax.org/books/university-physics-volume-1/pages/9-7-rocket-propulsion"],
  newton2: ["OpenStax", "https://openstax.org/books/university-physics-volume-1/pages/5-3-newtons-second-law"],
  gravity: ["OpenStax", "https://openstax.org/books/university-physics-volume-1/pages/13-2-gravitation-near-earths-surface"],
  orbit: ["OpenStax", "https://openstax.org/books/university-physics-volume-1/pages/13-4-satellite-orbits-and-energy"],
};

/* ------------------------------------------------------------------ */
/* Phases. `chapter`: "booster" (launch & catch) or "ship" (space & back).
   Each bullet: [heading, colour-token, text, sourceKey] */
export const PHASES = [
  { t: -30, key: "pad", chapter: "booster", label: "Pad", title: "Fuelled and waiting",
    lede: "Super Heavy and Starship stand on the launch mount holding about 4,900 tonnes of liquid methane and liquid oxygen.",
    bullets: [
      ["Cryogenic propellant", "methane", "Methane is stored near −160 °C and oxygen near −200 °C, chilled below their boiling points so more fits in the tanks. That is why frost forms on the steel.", "wikiSH"],
      ["Clamps hold it down", "booster", "Until liftoff, clamps on the mount carry the full weight. The pad reaction you see in the Forces panel is the mount pushing back up.", "newton3"],
      ["Two separate vehicles", "ship", "The 71 m booster and 52 m ship are each complete rockets with their own tanks and engines, stacked by the tower's arms.", "spacex"],
    ], foot: "Turn on <b>X-ray</b> to see the tanks and how full they are." },
  { t: -3, key: "ign", chapter: "booster", label: "Ignition", title: "Thirty-three engines light",
    lede: "In about three seconds every Raptor starts in sequence. The clamps stay closed until the computers confirm all engines are healthy.",
    bullets: [
      ["Outer ring is started from the ground", "flame", "The 20 outer engines are fixed (no gimbal) and are spun up by equipment on the launch mount to save weight on the booster.", "wikiSH"],
      ["Water deluge", "methane", "A steel plate beneath the mount sprays water upward. It absorbs heat and sound — most of the white cloud is steam and water, not smoke.", "spacex"],
      ["Thrust vs. weight", "booster", "Thrust is still building. While it is below the weight, the mount keeps carrying the difference.", "newton2"],
    ], foot: "Methane and oxygen burn to CO₂ and water vapour, so the plume itself is fairly clean." },
  { t: 0, key: "lo", chapter: "booster", label: "Liftoff", title: "Thrust beats weight",
    lede: "Clamps release. Around 7,500 tonnes-force of thrust against ~5,000 t of rocket gives a thrust-to-weight ratio of about 1.4.",
    bullets: [
      ["Net force points up", "flame", "Acceleration comes from the difference between thrust and weight, not from thrust alone. At liftoff that difference is small, so the rocket rises slowly at first.", "newton2"],
      ["It gets lighter every second", "booster", "The booster burns about 20 tonnes of propellant per second. Same thrust, less mass: acceleration keeps climbing.", "rocketEq"],
      ["Gas goes down, rocket goes up", "methane", "Exhaust is thrown downward at over 3 km/s; the reaction pushes the vehicle up. No air is needed to push against.", "newton3"],
    ] },
  { t: 52, key: "maxq", chapter: "booster", label: "Max Q", title: "Maximum dynamic pressure",
    lede: "Speed is rising fast and the air is still fairly thick. Their combination — dynamic pressure, q — peaks here, loading the structure most.",
    bullets: [
      ["q = ½ ρ v²", "methane", "Dynamic pressure grows with the square of speed but falls with air density. It peaks at roughly 11–13 km altitude.", "maxq"],
      ["Throttle down", "flame", "The engines ease back a little through max-Q to keep aerodynamic loads within limits, then throttle up again as the air thins.", "maxq"],
      ["Drag is a force too", "ship", "Drag = ½ ρ v² · Cd · A. Watch it peak in the Forces panel and then fade as the rocket leaves the atmosphere.", "drag"],
    ] },
  { t: 158, key: "hs", chapter: "booster", label: "Hot staging", title: "The ship lights while still attached",
    lede: "At ~65 km and ~5,500 km/h the booster cuts 30 engines. The ship ignites all six engines straight into the vented ring between the stages.",
    bullets: [
      ["Why keep three running", "booster", "The three centre engines keep a gentle push so propellant stays settled at the bottom of the tanks, ready for the boostback relight.", "wikiSH"],
      ["The vented ring", "flame", "Ship exhaust escapes sideways through slots in the hot-stage ring. Without it the blast would hit the booster's dome directly.", "wikiSH"],
      ["No gap in acceleration", "ship", "Hot staging avoids a coasting pause, which is worth roughly 10% more payload.", "spacex"],
    ] },
  { t: 172, key: "bb", chapter: "booster", label: "Boostback", title: "Flip and fly back",
    lede: "The booster swings around about 180° and relights 13 engines to cancel its downrange speed and aim back at the launch site.",
    bullets: [
      ["Thrust against the motion", "flame", "The engines now push opposite to the direction of travel. Velocity drops toward zero, then reverses.", "newton2"],
      ["Gimbal and cold gas", "methane", "Steering engines gimbal and cold-gas thrusters help rotate a 70 m tube in a near-vacuum where aerodynamic surfaces do nothing.", "wikiSH"],
      ["Propellant is precious", "booster", "Every tonne kept for boostback and landing is a tonne not used to push the ship — the price of reusability.", "rocketEq"],
    ] },
  { t: 228, key: "coast", chapter: "booster", label: "Descent", title: "Falling engines-first",
    lede: "Engines off. The booster arcs up to ~95 km, then falls back tail-first, steered by its grid fins.",
    bullets: [
      ["Grid fins steer", "booster", "The lattice fins act like small wings in fast, thin air, nudging the booster toward an aim point just offshore.", "gridfin"],
      ["Air does the braking", "methane", "Drag slows it from ~4,000 km/h to under the speed of sound for free — no propellant needed.", "drag"],
      ["Free fall isn't zero force", "flame", "Gravity is still pulling the full weight; with engines off, gravity and drag are the only forces acting.", "gravity"],
    ] },
  { t: 396, key: "lb", chapter: "booster", label: "Landing burn", title: "Braking hard, then precisely",
    lede: "At ~1.5 km, 13 engines light to brake hard, then shut down to the 3 centre engines for fine control.",
    bullets: [
      ["Go / no-go for catch", "booster", "Only if the booster and tower are healthy does the flight team call the catch. Otherwise it diverts to a splashdown in the Gulf.", "wikiSH"],
      ["Thrust exceeds weight", "flame", "Upward thrust larger than weight makes the net force point up even though the booster is still moving down — so it slows.", "newton2"],
      ["Divert to the tower", "methane", "The booster aims offshore until the last moment, then translates sideways toward the tower so a failure would miss the pad.", "spacex"],
    ] },
  { t: 419, key: "catch", chapter: "booster", label: "Catch", title: "Caught by the tower",
    lede: "Nearly hovering, the booster slides between the chopsticks. The arms close and it settles onto them by its catch fittings.",
    bullets: [
      ["No landing legs", "booster", "Legs would weigh tonnes. Moving the landing hardware to the tower makes the booster lighter and lets it be lowered straight back onto the mount.", "spacex"],
      ["Weight moves to the arms", "flame", "As the engines shut down, the arm load in the Forces panel rises to the full weight of the nearly empty booster.", "newton3"],
      ["Seven minutes, pad to pad", "methane", "First achieved on Flight 5, 13 October 2024.", "wikiSH"],
    ], foot: "Pick <b>Starship</b> in the flight log to follow the ship to space and back." },

  { t: 159, key: "s-hs", chapter: "ship", label: "Separation", title: "Ship on its own engines",
    lede: "Starship pulls away at ~70 km. Three sea-level Raptors and three vacuum Raptors with huge nozzles now push it toward orbital speed.",
    bullets: [
      ["Bigger nozzle, better in vacuum", "methane", "Raptor Vacuum's nozzle lets exhaust expand further before leaving, converting more pressure into thrust where there is no outside air.", "thrust"],
      ["Thrust grows with altitude", "flame", "As outside pressure drops, every engine produces more thrust — watch the number creep up.", "thrust"],
    ] },
  { t: 330, key: "s-asc", chapter: "ship", label: "Ascent", title: "Building horizontal speed",
    lede: "Getting high is easy; going fast sideways is the hard part. The ship pitches toward the horizon to build ~26,000 km/h.",
    bullets: [
      ["Orbit is falling sideways", "ship", "At about 7.8 km/s the ground curves away as fast as the ship falls toward it.", "orbit"],
      ["Mass keeps dropping", "flame", "The ship burns roughly 4 tonnes of propellant per second; its acceleration rises toward 3 g near cutoff.", "rocketEq"],
    ] },
  { t: 515, key: "seco", chapter: "ship", label: "SECO", title: "Engine cutoff, coasting",
    lede: "Engines off at ~26,000 km/h. Now only gravity acts — and the ship is weightless inside, even though gravity is almost as strong as on the ground.",
    bullets: [
      ["Weightless, not gravity-less", "ship", "At 170 km gravity is still ~95% of surface gravity. Everything aboard falls together, so nothing presses on anything.", "gravity"],
      ["Test flights stay suborbital", "methane", "Flight tests use a trajectory just short of orbit, so the ship comes down in the Indian Ocean even if an engine can't relight.", "wikiShip"],
    ] },
  { t: 2240, key: "relight", chapter: "ship", label: "Relight", title: "Relighting a Raptor in space",
    lede: "A single Raptor fires briefly in vacuum. A reliable relight is what makes a real deorbit burn — and safe orbital flight — possible.",
    bullets: [
      ["Settling propellant", "methane", "In free fall, liquid floats. Small thrusters push the ship gently so propellant settles over the engine inlets before ignition.", "wikiShip"],
      ["Header tanks", "flame", "Small header tanks hold landing propellant separately from the big main tanks.", "wikiShip"],
    ] },
  { t: 2820, key: "ei", chapter: "ship", label: "Entry", title: "Hitting the atmosphere belly-first",
    lede: "At ~120 km the ship is already turned about 65° nose-up to its flight path, presenting ~18,000 hexagonal heat-shield tiles to the air.",
    bullets: [
      ["Kinetic energy becomes heat", "plasma", "Air compressed in the shock wave ahead of the belly reaches thousands of degrees and becomes glowing plasma.", "entry"],
      ["Belly-first means more drag", "ship", "A broad side presents ~7× more area than nose-first, so it slows higher where the air is thin and heating is gentler.", "drag"],
      ["A little lift", "methane", "At this angle the body also generates some lift, used to steer the descent toward the target.", "entry"],
    ] },
  { t: 3060, key: "heat", chapter: "ship", label: "Peak heat", title: "Peak heating",
    lede: "Tile surfaces reach around 1,400 °C while the steel underneath stays far cooler. Drag now decelerates the ship at several g.",
    bullets: [
      ["Tiles, gaps and pins", "plasma", "Tiles are pinned to the hull with small gaps for thermal expansion. A missing tile lets hot plasma reach the steel.", "wikiShip"],
      ["Radio through the plasma", "methane", "Starlink terminals on the shaded side keep video flowing where older spacecraft had a radio blackout.", "wikiShip"],
    ] },
  { t: 3650, key: "flop", chapter: "ship", label: "Belly-flop", title: "Skydiving at 300 km/h",
    lede: "Below the speed of sound the ship falls horizontally like a skydiver. Drag balances weight and speed stops increasing.",
    bullets: [
      ["Terminal velocity", "ship", "When drag equals weight, net force is zero and the fall speed stays constant.", "drag"],
      ["Four flaps steer", "booster", "Two forward and two aft flaps work like a skydiver's arms and legs to keep the ship stable.", "wikiShip"],
    ] },
  { t: 3833, key: "flip", chapter: "ship", label: "Flip", title: "The landing flip",
    lede: "At ~500 m the sea-level Raptors relight and swing the 52 m ship from horizontal to vertical in a few seconds.",
    bullets: [
      ["Header tanks feed the flip", "methane", "Main-tank propellant sloshes sideways during the rotation, so the engines draw from small header tanks instead.", "wikiShip"],
      ["Thrust off-centre makes torque", "flame", "Gimballing the engines pushes the tail sideways, rotating the ship before the thrust is used for braking.", "newton2"],
    ] },
  { t: 3856, key: "land", chapter: "ship", label: "Landing", title: "Touchdown",
    lede: "Landing burn to zero. Test flights end in a controlled splashdown; operational ships are meant to be caught by the tower like the booster.",
    bullets: [
      ["Splashdown on test flights", "methane", "Flights so far ended in the Indian Ocean. Switch the Ending to Tower catch to see the planned alternative.", "wikiShip"],
      ["Catch pins", "ship", "Small pins below the forward flaps are what the tower arms will grab.", "wikiShip"],
    ] },
];
// Ship catch profile retimes the ship phases after SECO
export function phasesFor(profile) {
  if (profile !== "catch") return PHASES;
  const remap = { relight: 4280, ei: 4790, heat: 5030, flop: 5620, flip: 5803, land: 5826 };
  return PHASES.map(p => {
    if (!(p.key in remap)) return p;
    if (p.key === "relight") return { ...p, t: remap[p.key], label: "Deorbit", title: "The deorbit burn",
      lede: "After one lap of the planet, a short engine burn lowers the far side of the orbit into the atmosphere, timed so the ship comes down on top of the launch site.",
      bullets: [["A small push is enough", "methane", "Slowing by only ~100 m/s drops the low point of the orbit into the air; drag does the rest.", "orbit"], ["Timing is aiming", "ship", "Where you start the burn decides where you land, thousands of kilometres later.", "orbit"]] };
    if (p.key === "land") return { ...p, t: remap[p.key], title: "Caught by the tower",
      lede: "The ship hovers in beside the tower and the chopsticks close under its catch pins — full reuse: both stages back where they started.",
      bullets: [["Catch pins", "ship", "Pins below the forward flaps rest on the arms, so the ship needs no landing legs either.", "wikiShip"], ["Rapid reuse", "booster", "The goal is to refuel and fly again within hours, like an airliner.", "spacex"]] };
    return { ...p, t: remap[p.key] };
  });
}

export const CHAPTERS = {
  booster: { name: "Launch & booster catch", t0: -30, t1: 432, focus: "booster" },
  ship: { name: "Ship to space & back", t0: 150, focus: "ship" },
};
export const shipEnd = profile => (profile === "catch" ? 5840 : 3866);

// Story pacing: how many mission-seconds pass per real second at 1×.
export function paceAt(chapter, t, profile) {
  if (chapter === "booster") {
    if (t < -4) return 4;
    if (t < 4) return 1;
    if (t < 150) return 4;
    if (t < 182) return 1.6;
    if (t < 380) return 7;
    if (t < 395) return 3;
    return 1.2;
  }
  const c = profile === "catch";
  const ei = c ? 4760 : 2790, fl = c ? 5770 : 3800, rl = c ? 4270 : 2232;
  if (t < 185) return 1.6;
  if (t < 515) return 8;
  if (t > rl && t < rl + 25) return 4;
  if (t < ei) return c ? 160 : 90;
  if (t < fl) return 14;
  return 1.2;
}

// Effects: engine plumes, deterministic smoke/steam, reentry plasma, force arrows, paths.
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

/* ================================================================== */
/* Engine plume: open cylinder reshaped in the vertex shader.
   Local frame: exit plane at y = 0, plume extends toward -Y, unit radius & length (scale the mesh). */
const plumeVert = /* glsl */`
uniform float uExpand;
varying float vS;
varying vec3 vN;
varying vec3 vView;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  float s = clamp(-position.y, 0.0, 1.0);          // 0 at nozzle exit → 1 at tail
  float r = mix(1.0, uExpand, pow(s, 0.55));
  r *= mix(1.0, 0.35, smoothstep(0.65, 1.0, s) * step(uExpand, 1.6)); // sea-level plume tapers
  vec3 p = vec3(position.x * r, position.y, position.z * r);
  vS = s;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * vec3(normal.x, 0.0, normal.z));
  vView = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;
const plumeFrag = /* glsl */`
uniform float uTime;
uniform float uPower;
uniform float uDiamonds;      // 0..1 visibility of shock diamonds (sea level)
uniform vec3 uCore;
uniform vec3 uEdge;
uniform float uSeed;
varying float vS;
varying vec3 vN;
varying vec3 vView;
#include <logdepthbuf_pars_fragment>
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  float facing = abs(dot(normalize(vN), normalize(vView)));     // 1 = looking through the middle
  float body = pow(facing, 1.4);
  float along = pow(1.0 - vS, 1.6);
  float flick = 0.85 + 0.15 * sin(uTime * 63.0 + uSeed * 10.0 + vS * 40.0) * sin(uTime * 41.0 + uSeed);
  float diam = 1.0 + uDiamonds * 0.9 * pow(max(0.0, cos(vS * 6.2831 * 4.5)), 6.0) * (1.0 - smoothstep(0.1, 0.7, vS));
  vec3 col = mix(uEdge, uCore, pow(body, 2.0) * (1.0 - vS * 0.8));
  float a = along * body * flick * diam * uPower;
  gl_FragColor = vec4(col * a * 2.2, a);
}`;
export function createPlume({ core = 0xfff1dc, edge = 0xff8a3a, seed = 0 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 40, 40, true);
  geo.translate(0, -0.5, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: plumeVert, fragmentShader: plumeFrag, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uPower: { value: 1 }, uExpand: { value: 1.3 }, uDiamonds: { value: 1 },
      uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) }, uSeed: { value: seed },
    },
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false; m.renderOrder = 5;
  m.set = (radius, length, power, expand, diamonds, time) => {
    m.visible = power > 0.01;
    m.scale.set(radius, length, radius);
    mat.uniforms.uPower.value = power; mat.uniforms.uExpand.value = expand;
    mat.uniforms.uDiamonds.value = diamonds; mat.uniforms.uTime.value = time;
  };
  return m;
}

/* ================================================================== */
/* Deterministic particle clouds. Every particle's state is a pure function of
   mission time, so scrubbing backwards and forwards replays the same cloud. */
const smokeVert = /* glsl */`
attribute vec3 aStart;
attribute vec3 aVel;
attribute vec4 aP;         // birth, life, size0, grow
attribute float aSeed;
uniform float uTime;
uniform float uTau;
uniform float uRise;
uniform vec3 uWind;
varying vec2 vUv;
varying float vAlpha;
varying float vShade;
varying float vAge;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  float age = uTime - aP.x;
  float life = aP.y;
  vUv = uv;
  vAge = age / life;
  if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; return; }
  vec3 c = aStart + aVel * uTau * (1.0 - exp(-age / uTau)) + vec3(0.0, uRise * age, 0.0) + uWind * age;
  float size = aP.z + aP.w * sqrt(age);
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float rot = aSeed * 6.2831 + age * 0.05 * (aSeed - 0.5);
  vec2 q = (uv - 0.5) * size;
  q = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
  mv.xy += q;
  vShade = uv.y;
  float fadeIn = smoothstep(0.0, 0.06, vAge);
  float fadeOut = 1.0 - smoothstep(0.55, 1.0, vAge);
  vAlpha = fadeIn * fadeOut;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const smokeFrag = /* glsl */`
uniform sampler2D uMap;
uniform vec3 uLit;
uniform vec3 uShadow;
uniform vec3 uGlow;       // hot glow near the source (exhaust light)
uniform float uOpacity;
varying vec2 vUv;
varying float vAlpha;
varying float vShade;
varying float vAge;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(uMap, vUv);
  vec3 col = mix(uShadow, uLit, smoothstep(0.0, 1.0, vShade));
  col += uGlow * (1.0 - smoothstep(0.0, 0.25, vAge));
  float a = t.a * vAlpha * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function createSmoke(texture, particles, opts = {}) {
  const n = particles.length;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const start = new Float32Array(n * 3), vel = new Float32Array(n * 3), p = new Float32Array(n * 4), seed = new Float32Array(n);
  particles.forEach((q, i) => {
    start.set(q.start, i * 3); vel.set(q.vel, i * 3);
    p.set([q.birth, q.life, q.size0, q.grow], i * 4); seed[i] = Math.random();
  });
  geo.setAttribute("aStart", new THREE.InstancedBufferAttribute(start, 3));
  geo.setAttribute("aVel", new THREE.InstancedBufferAttribute(vel, 3));
  geo.setAttribute("aP", new THREE.InstancedBufferAttribute(p, 4));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    vertexShader: smokeVert, fragmentShader: smokeFrag, transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uTau: { value: opts.tau ?? 4 }, uRise: { value: opts.rise ?? 2 },
      uWind: { value: new THREE.Vector3(...(opts.wind ?? [1.5, 0, 0.6])) }, uMap: { value: texture },
      uLit: { value: new THREE.Color(opts.lit ?? 0xfff4ea) }, uShadow: { value: new THREE.Color(opts.shadow ?? 0x8d8e94) },
      uGlow: { value: new THREE.Color(opts.glow ?? 0x000000) }, uOpacity: { value: opts.opacity ?? 0.9 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 4;
  mesh.setTime = t => { mat.uniforms.uTime.value = t; };
  return mesh;
}
const rnd = (a, b) => a + Math.random() * (b - a);

// Launch: water-deluge steam and exhaust billowing out from under the mount.
export function padCloudParticles(t0, t1, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const birth = t0 + Math.pow(Math.random(), 1.6) * (t1 - t0);
    const a = Math.random() * Math.PI * 2, sp = rnd(18, 55);
    out.push({
      birth, life: rnd(35, 75), size0: rnd(10, 22), grow: rnd(9, 15),
      start: [Math.cos(a) * rnd(4, 14), rnd(2, 10), Math.sin(a) * rnd(4, 14)],
      vel: [Math.cos(a) * sp, rnd(0, 6), Math.sin(a) * sp],
    });
  }
  return out;
}
// A trail left along a trajectory: posAt(t) returns a world position (Vector3) for the plume tail.
export function trailParticles(t0, t1, count, posAt, size0, grow, life) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const birth = rnd(t0, t1); const p = posAt(birth);
    out.push({ birth, life: life * rnd(0.7, 1.2), size0: size0 * rnd(0.7, 1.3), grow: grow * rnd(0.8, 1.2),
      start: [p.x + rnd(-6, 6), p.y + rnd(-6, 6), p.z + rnd(-6, 6)], vel: [rnd(-4, 4), rnd(-2, 3), rnd(-4, 4)] });
  }
  return out;
}
// Burst around a point (landing, splashdown, hot staging).
export function burstParticles(t0, t1, count, center, radial, up, size0, grow, life) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, sp = rnd(radial * 0.4, radial);
    out.push({ birth: rnd(t0, t1), life: life * rnd(0.6, 1.2), size0: size0 * rnd(0.7, 1.3), grow: grow * rnd(0.8, 1.2),
      start: [center.x + rnd(-3, 3), center.y + rnd(0, 4), center.z + rnd(-3, 3)],
      vel: [Math.cos(a) * sp, rnd(0, up), Math.sin(a) * sp] });
  }
  return out;
}

/* ================================================================== */
/* Reentry plasma. Three layers, all additive and driven by a 0..1 heat value:
   1. a turbulent shock layer hugging the windward belly (+X local),
   2. a soft wake trailing opposite the velocity,
   3. thin streamers peeling off the flaps and edges, like real entry footage. */
const NOISE = /* glsl */`
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.07; a *= 0.5; } return s; }`;
const plasmaVert = /* glsl */`
varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() { vL = position; vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;
export function createPlasma() {
  const g = new THREE.Group();
  const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: plasmaVert };
  // 1. shock layer
  const shockMat = new THREE.ShaderMaterial({ ...common,
    uniforms: { uHeat: { value: 0 }, uTime: { value: 0 } },
    fragmentShader: `uniform float uHeat; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec2 vUv;
      ${NOISE}
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float belly = smoothstep(0.0, 0.9, vL.x);
        float ends = 1.0 - smoothstep(0.7, 1.0, abs(vL.y));
        float turb = fbm(vec2(vUv.x * 14.0, vUv.y * 9.0 - uTime * 3.0));
        float rim = pow(1.0 - facing, 2.2);
        vec3 col = mix(vec3(1.0, 0.28, 0.55), vec3(1.0, 0.72, 0.42), turb);
        float a = (rim * 1.1 + 0.4) * belly * ends * uHeat * (0.45 + 0.9 * turb);
        gl_FragColor = vec4(col * a * 2.4, a);
      }` });
  const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), shockMat);
  shock.scale.set(7.6, 30, 7.0); shock.position.set(3.0, 25, 0);
  g.add(shock);
  // 2. wake (oriented each frame by the app: local -Y = downstream)
  const wakeMat = new THREE.ShaderMaterial({ ...common,
    uniforms: { uHeat: { value: 0 }, uTime: { value: 0 } },
    vertexShader: plasmaVert.replace("vL = position;", "vL = position;"),
    fragmentShader: `uniform float uHeat; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec2 vUv;
      ${NOISE}
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float s = clamp(-vL.y, 0.0, 1.0);
        float body = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        float streak = pow(fbm(vec2(vUv.x * 22.0, s * 2.0 - uTime * 2.5)), 2.2) * 2.2;
        float a = pow(1.0 - s, 2.0) * body * streak * uHeat * 0.9;
        vec3 col = mix(vec3(1.0, 0.45, 0.35), vec3(0.85, 0.25, 0.75), s) * 1.6;
        gl_FragColor = vec4(col * a, a);
      }` });
  const wakeGeo = new THREE.CylinderGeometry(1, 0.35, 1, 48, 24, true); wakeGeo.translate(0, -0.5, 0);
  const wake = new THREE.Mesh(wakeGeo, wakeMat); wake.frustumCulled = false;
  // 3. streamers peeling off the edges, children of the wake so they trail downstream
  const strMat = new THREE.ShaderMaterial({ ...common,
    uniforms: { uHeat: { value: 0 }, uTime: { value: 0 } },
    fragmentShader: `uniform float uHeat; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec2 vUv;
      ${NOISE}
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float s = clamp(-vL.y, 0.0, 1.0);
        float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float flick = 0.6 + 0.8 * vn(vec2(s * 10.0 - uTime * 6.0, vUv.x * 3.0));
        float a = pow(1.0 - s, 1.8) * core * flick * uHeat;
        vec3 col = mix(vec3(1.0, 0.62, 0.32), vec3(1.0, 0.22, 0.5), smoothstep(0.0, 0.6, s));
        gl_FragColor = vec4(col * a * 3.0, a);
      }` });
  const strGeo = new THREE.CylinderGeometry(1, 0.2, 1, 12, 16, true); strGeo.translate(0, -0.5, 0);
  const streamers = [];
  const spots = [[0.55, 0.15], [-0.55, 0.15], [0.6, -0.55], [-0.6, -0.55], [0.0, 0.62], [0.35, 0.5], [-0.35, 0.5], [0.0, -0.7]];
  spots.forEach(([x, z], i) => {
    const m = new THREE.Mesh(strGeo, strMat);
    m.position.set(x, 0, z); m.userData.len = 0.7 + (i % 3) * 0.25; m.frustumCulled = false;
    wake.add(m); streamers.push(m);
  });
  g.wake = wake;
  g.set = (heat, time) => {
    const on = heat > 0.01;
    g.visible = on; wake.visible = on;
    for (const m of [shockMat, wakeMat, strMat]) { m.uniforms.uHeat.value = heat; m.uniforms.uTime.value = time; }
  };
  // streamer sizes are relative to the wake's scale; keep them thin
  g.layout = (wakeRadius, wakeLength) => {
    streamers.forEach(m => m.scale.set(0.9 / wakeRadius, m.userData.len, 0.9 / wakeRadius));
    void wakeLength;
  };
  return g;
}

/* ================================================================== */
/* Force arrows drawn on top of everything, with HTML labels. */
export function createArrow(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.85, toneMapped: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 10), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4, 16), mat);
  shaft.renderOrder = head.renderOrder = 20;
  g.add(shaft, head);
  const up = new THREE.Vector3(0, 1, 0);
  g.setTo = (origin, dir, length, thick) => {
    g.visible = length > 0.5;
    if (!g.visible) return;
    g.position.copy(origin);
    g.quaternion.setFromUnitVectors(up, dir);
    const hl = Math.min(4 * thick, length * 0.45);
    shaft.scale.set(thick, length - hl, thick); shaft.position.y = (length - hl) / 2;
    head.scale.set(thick, hl / 4, thick); head.position.y = length - hl / 2;
  };
  return g;
}

/* Trajectory polyline (screen-space fat line). Positions are stored relative to the
   first point to keep float32 precision on planet-sized paths. */
export const pathMaterials = [];
export function createPath(points, color, opacity = 0.9) {
  const o = points[0].clone();
  const flat = [];
  for (const p of points) flat.push(p.x - o.x, p.y - o.y, p.z - o.z);
  const geo = new LineGeometry(); geo.setPositions(flat);
  const mat = new LineMaterial({ color, linewidth: 2.6, transparent: true, opacity, depthWrite: false, worldUnits: false });
  mat.resolution.set(innerWidth, innerHeight);
  pathMaterials.push(mat);
  const line = new Line2(geo, mat);
  line.position.copy(o);
  line.computeLineDistances();
  line.frustumCulled = false; line.renderOrder = 6;
  return line;
}

// Environment: altitude-aware sky, sun, Starbase land + Gulf water, Earth from orbit, stars, clouds.
import * as THREE from "three";
import { R_EARTH } from "./flight.js";

export const SUN_DIR = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();   // golden-hour sun, from the south-west

/* ---------------- sky dome ---------------- */
const skyVert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const skyFrag = /* glsl */`
uniform vec3 uSun;
uniform float uAlt;        // camera altitude, km
uniform float uDip;        // horizon dip (radians)
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float space = smoothstep(15.0, 75.0, uAlt);
  float e = d.y + uDip;                         // elevation above the true horizon
  float sunDot = max(dot(d, uSun), 0.0);
  // Rayleigh-ish gradient: deep blue overhead, warm pale horizon
  vec3 zenith = vec3(0.055, 0.16, 0.42);
  vec3 horizon = vec3(0.86, 0.66, 0.50);
  vec3 col = mix(horizon, zenith, pow(clamp(e, 0.0, 1.0), 0.42));
  // warmer near the sun azimuth
  col += vec3(1.0, 0.55, 0.25) * pow(sunDot, 6.0) * 0.55 * (1.0 - clamp(e * 2.0, 0.0, 1.0));
  // below horizon: hazy ground glow fading to dark
  vec3 below = mix(vec3(0.42, 0.40, 0.40), vec3(0.08, 0.09, 0.11), clamp(-e * 6.0, 0.0, 1.0));
  col = mix(below, col, smoothstep(-0.01, 0.01, e));
  // thin blue limb seen from space
  vec3 limb = vec3(0.30, 0.55, 1.0) * exp(-abs(e) * 60.0) * 1.2 + vec3(1.0, 0.6, 0.3) * exp(-abs(e) * 160.0) * pow(sunDot, 3.0);
  vec3 spaceCol = mix(vec3(0.0), limb, step(-0.002, e)) + limb * 0.3;
  col = mix(col, spaceCol, space);
  // sun disc + mie halo
  col += vec3(1.0, 0.85, 0.65) * pow(sunDot, 900.0) * 30.0;
  col += vec3(1.0, 0.75, 0.5) * pow(sunDot, 40.0) * 0.35 * (1.0 - space * 0.7);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/* ---------------- water ---------------- */
const waterVert = /* glsl */`
varying vec3 vWorld;
varying vec2 vLocal;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vLocal = position.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;
const waterFrag = /* glsl */`
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uCam;
uniform float uFade;
uniform float uShore;      // local x of the shoreline (very negative = open ocean)
varying vec3 vWorld;
varying vec2 vLocal;
#include <logdepthbuf_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// Sum of directional deep-water waves (dispersion: c = sqrt(g/k)); returns the surface slope.
vec2 waveSlope(vec2 p, float t) {
  vec2 g = vec2(0.0);
  float L = 64.0, A = 0.85;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float ang = 0.35 + sin(fi * 1.7) * 0.9;            // spread around the wind direction
    vec2 d = vec2(cos(ang), sin(ang));
    float k = 6.2831 / L;
    float c = sqrt(9.81 / k);
    float ph = k * dot(d, p) - c * k * t + fi * 1.3;
    g += d * (A * k * cos(ph));
    L *= 0.69; A *= 0.66;
  }
  return g;
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 toCam = uCam - vWorld;
  float dist = length(toCam);
  vec3 v = toCam / dist;
  // slopes fade with distance: far water reads glassy instead of shimmering noise
  float detail = 1.0 / (1.0 + dist / 1800.0);
  vec2 sl = waveSlope(vLocal, uTime) * detail;
  sl += (vec2(noise(vLocal * 0.9 + uTime * 0.6), noise(vLocal * 0.9 - uTime * 0.5)) - 0.5) * 0.12 * detail;
  vec3 n = normalize(vec3(-sl.x, 1.0, sl.y));
  // reflection of an approximate sky dome
  vec3 r = reflect(-v, n);
  float re = clamp(r.y, 0.0, 1.0);
  vec3 skyRefl = mix(vec3(0.80, 0.74, 0.69), vec3(0.24, 0.42, 0.70), pow(re, 0.45));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  // water body: deep blue-green offshore, turquoise over sand near the beach
  float off = vLocal.x - uShore;
  float shallow = 1.0 - smoothstep(0.0, 700.0, off);
  vec3 deep = vec3(0.012, 0.06, 0.085);
  vec3 shoal = vec3(0.10, 0.33, 0.33);
  vec3 body = mix(deep, shoal, shallow);
  body += vec3(0.02, 0.09, 0.08) * pow(max(dot(n, uSun), 0.0), 3.0) * (1.0 - fres);   // light scattered up through wave faces
  vec3 col = mix(body, skyRefl, fres);
  // sun glitter: a hot core plus a broad sheen
  float sd = max(dot(r, uSun), 0.0);
  col += vec3(1.0, 0.86, 0.66) * (pow(sd, 900.0) * 28.0 + pow(sd, 60.0) * 0.35);
  // surf: breaking lines and foam in the first few tens of metres
  float surfZone = 1.0 - smoothstep(4.0, 90.0, off);
  float breakers = smoothstep(0.82, 1.0, sin(off * 0.11 - uTime * 1.3 + noise(vLocal * 0.02) * 4.0));
  float foam = clamp(breakers * 0.8 + smoothstep(0.55, 0.85, noise(vLocal * 0.09 + uTime * 0.15)) * 0.6, 0.0, 1.0) * surfZone;
  foam = max(foam, (1.0 - smoothstep(0.0, 6.0, off)) * 0.85);
  col = mix(col, vec3(0.92, 0.93, 0.92), foam * step(-1.0, off));
  // aerial perspective
  col = mix(col, vec3(0.74, 0.70, 0.66), smoothstep(1500.0, 42000.0, dist) * 0.7);
  gl_FragColor = vec4(col, uFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/* ---------------- procedural textures ---------------- */
function noiseCanvas(size, paint) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); paint(g, size); return c;
}
function landTexture() {
  // coastal South Texas: pale sand, salt/mud flats, patches of low green-brown scrub, tidal channels
  const c = noiseCanvas(2048, (g, S) => {
    g.fillStyle = "#a39579"; g.fillRect(0, 0, S, S);
    const blob = (x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
    for (let i = 0; i < 260; i++) blob(Math.random() * S, Math.random() * S, 60 + Math.random() * 220, Math.random() < 0.5 ? "rgba(120,118,82,.35)" : "rgba(196,186,160,.35)");
    for (let i = 0; i < 1600; i++) blob(Math.random() * S, Math.random() * S, 8 + Math.random() * 40, Math.random() < 0.6 ? "rgba(88,92,58,.45)" : "rgba(70,66,50,.35)");
    // tidal channels
    g.strokeStyle = "rgba(92,98,96,.45)"; g.lineCap = "round";
    for (let k = 0; k < 14; k++) {
      let x = Math.random() * S, y = Math.random() * S; g.lineWidth = 2 + Math.random() * 5; g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 40; j++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.3) * 40; g.lineTo(x, y); }
      g.stroke();
    }
    const img = g.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}
function concreteTexture() {
  const c = noiseCanvas(512, (g, S) => {
    g.fillStyle = "#8e8d88"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 20000; i++) { const v = 120 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v - 4},.25)`; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
    g.strokeStyle = "rgba(40,40,40,.35)"; g.lineWidth = 2;
    for (let k = 0; k <= S; k += S / 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); }
    // scorch around the mount
    const gr = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
    gr.addColorStop(0, "rgba(20,18,16,.75)"); gr.addColorStop(1, "rgba(20,18,16,0)");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function puffTexture() {
  // billowy cloud puff: many small soft lobes inside a soft round envelope, plus fine grain
  const S = 256;
  const c = noiseCanvas(S, g => {
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * S * 0.3;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * 0.85;
      const r = S * (0.05 + Math.random() * 0.11) * (1 - d / (S * 0.45));
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,.22)"); gr.addColorStop(0.7, "rgba(255,255,255,.08)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const img = g.getImageData(0, 0, S, S), dd = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4, rr = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      const env = Math.max(0, 1 - rr * rr);
      dd[i + 3] = Math.min(255, dd[i + 3] * env * (0.8 + Math.random() * 0.4));
    }
    g.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------------- Earth orientation: Starbase at the top, east along +X ---------------- */
function earthQuaternion(latDeg, lonDeg) {
  const f = latDeg * Math.PI / 180, l = lonDeg * Math.PI / 180;
  const up = new THREE.Vector3(Math.cos(f) * Math.cos(l), Math.sin(f), -Math.cos(f) * Math.sin(l));
  const east = new THREE.Vector3(-Math.sin(l), 0, -Math.cos(l));
  const north = new THREE.Vector3().crossVectors(east, up).negate();   // up × east = north → negate for south? compute explicitly
  const n2 = new THREE.Vector3(-Math.sin(f) * Math.cos(l), Math.cos(f), Math.sin(f) * Math.sin(l));
  const south = n2.clone().negate();
  void north;
  const m = new THREE.Matrix4().makeBasis(east, up, south);   // local axes in sphere coords
  return new THREE.Quaternion().setFromRotationMatrix(m.invert());
}

/* ================================================================== */
export function createEnvironment(scene, renderer, world = scene) {
  const env = { update: null };
  const loader = new THREE.TextureLoader();

  // sky
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false,
    uniforms: { uSun: { value: SUN_DIR }, uAlt: { value: 0 }, uDip: { value: 0 } },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  // environment map for reflections (rendered from the low-altitude sky once)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat.clone());
  envSky.material.uniforms.uSun.value = SUN_DIR; envScene.add(envSky);
  // lower hemisphere of the reflection = dusty ground, so polished steel reads dark below the horizon line
  const ground = new THREE.Mesh(new THREE.SphereGeometry(9.5, 32, 16, 0, Math.PI * 2, Math.PI / 2 + 0.02, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a4339, side: THREE.BackSide }));
  envScene.add(ground);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  // aerial perspective: distant ground fades into the warm haze at the horizon
  scene.fog = new THREE.FogExp2(0xbfb4a8, 0.00004);
  // lights
  const sun = new THREE.DirectionalLight(0xffe2c4, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  const sc = sun.shadow.camera; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 900;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0x9cc1ff, 0x6b5a46, 0.55);
  scene.add(hemi);

  // ---- local Starbase terrain ----
  const local = new THREE.Group(); world.add(local);
  const landTex = landTexture(); landTex.repeat.set(30, 30);
  const landMat = new THREE.MeshStandardMaterial({ map: landTex, bumpMap: landTex, bumpScale: 2.2, roughness: 0.96, metalness: 0 });
  // break up tiling: blend the texture at two very different scales
  landMat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `
      #ifdef USE_MAP
        vec4 fineC = texture2D(map, vMapUv);
        vec4 macroC = texture2D(map, vMapUv * 0.083 + vec2(0.37, 0.11));
        vec4 midC = texture2D(map, vMapUv * 0.29 + vec2(0.71, 0.43));
        // close-up grain: scrub and soil at ~30 m scale, fading out with distance (texture gradient = depth)
        vec4 grainC = texture2D(map, vMapUv * 61.0 + vec2(0.13, 0.57));
        float near = 1.0 - smoothstep(150.0, 2600.0, length(vViewPosition));
        vec4 base = fineC * 0.5 + macroC * 0.3 + midC * 0.2;
        diffuseColor *= mix(base, base * (0.55 + grainC * 0.9), near * 0.85) + 0.03;
      #endif`);
  };
  const LAND = 60000;
  const terrainH = (wx, wz) => {
    const r = Math.hypot(wx + 30, wz + 10);
    const keep = THREE.MathUtils.smoothstep(r, 350, 1200);          // flat apron around the site
    const shore = 1 - THREE.MathUtils.smoothstep(wx, 1500, 2150);   // fade to beach level at the coast
    return (Math.sin(wx * 0.0021) * Math.cos(wz * 0.0017) * 3.2 + Math.sin(wx * 0.0093 + wz * 0.007) * 1.4 + Math.sin(wz * 0.021 - wx * 0.013) * 0.6) * keep * shore;
  };
  // gentle relief: low swells and hummocks (flat around the pad), so low sun picks out the shape of the land
  const landGeo = new THREE.PlaneGeometry(LAND, LAND, 240, 240);
  {
    const pos = landGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), ly = pos.getY(i);
      const wx = lx - LAND / 2 + 2200, wz = -ly;                   // world coords of this vertex
      pos.setZ(i, terrainH(wx, wz));
    }
    landGeo.computeVertexNormals();
  }
  const land = new THREE.Mesh(landGeo, landMat);
  land.rotation.x = -Math.PI / 2; land.position.set(-LAND / 2 + 2200, -0.05, 0);   // land west of the beach at x≈2.2 km
  land.receiveShadow = true; local.add(land);
  // beach strip
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(260, LAND), new THREE.MeshStandardMaterial({ color: 0xcdbb98, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(2200 - 60, 0, 0); local.add(beach);
  // concrete apron around the mount
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.9 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(-30, 0.02, -10); apron.receiveShadow = true; local.add(apron);
  // dunes behind the beach
  {
    const duneMat = new THREE.MeshStandardMaterial({ color: 0xcbb994, roughness: 1, flatShading: false });
    const dunes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), duneMat, 160);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < 160; i++) {
      const z = -12000 + (i / 160) * 24000 + (Math.random() - 0.5) * 120;
      m.compose(new THREE.Vector3(1960 + Math.random() * 120, -0.5, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 0.6 - 0.3),
        new THREE.Vector3(35 + Math.random() * 50, 3 + Math.random() * 6, 70 + Math.random() * 110));
      dunes.setMatrixAt(i, m);
    }
    dunes.receiveShadow = true; local.add(dunes);
  }
  // low coastal scrub: clumps of dark brush give the ground scale and parallax
  {
    const N = 12000;
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    // clump centres, denser away from the concrete
    const clumps = [];
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2, r = 220 + Math.pow(Math.random(), 1.4) * 5600;
      clumps.push([-30 + Math.cos(a) * r, -10 + Math.sin(a) * r, 10 + Math.random() * 45]);
    }
    let n = 0, guard = 0;
    while (n < N && guard++ < N * 4) {
      const [cx, cz, spread] = clumps[(Math.random() * clumps.length) | 0];
      const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * spread;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (x > 1880) continue;                                   // not on the beach
      if (Math.abs(z - 260) < 14 && x < -150) continue;          // keep the road clear
      if (Math.abs(x + 30) < 175 && Math.abs(z + 10) < 175) continue;   // concrete apron
      const sx = 1.4 + Math.random() * 3.2;
      m.compose(new THREE.Vector3(x, terrainH(x, z) - 0.3, z), q.setFromEuler(new THREE.Euler(Math.random() * 0.4, Math.random() * 6.28, Math.random() * 0.4)),
        new THREE.Vector3(sx * (0.7 + Math.random() * 0.6), sx * (0.35 + Math.random() * 0.3), sx * (0.7 + Math.random() * 0.6)));
      bushes.setMatrixAt(n, m);
      col.setHSL(0.13 + Math.random() * 0.08, 0.18 + Math.random() * 0.14, 0.09 + Math.random() * 0.07);
      bushes.setColorAt(n, col);
      n++;
    }
    bushes.count = n;
    bushes.receiveShadow = true; local.add(bushes);
  }
  // the factory a few kilometres inland: high bays give the launch site a sense of scale
  {
    const shell = new THREE.MeshStandardMaterial({ color: 0xe6e4df, roughness: 0.55, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.8 });
    const add = (w, h, d, x, z, mat = shell) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, h / 2, z); b.castShadow = b.receiveShadow = true; local.add(b);
    };
    add(60, 92, 48, -2600, 360);  add(46, 70, 40, -2520, 430);  add(120, 26, 70, -2720, 470);
    add(80, 18, 50, -2450, 520, dark); add(36, 55, 30, -2850, 330);  add(160, 12, 60, -2300, 610, dark);
    const tank = new THREE.CylinderGeometry(9, 9, 34, 24);
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(tank, shell); t.position.set(-2380 - i * 24, 17, 300); t.castShadow = true; local.add(t); }
  }
  // a road leading to the site
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 9000), new THREE.MeshStandardMaterial({ color: 0x3d3d3c, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2; road.rotation.z = Math.PI / 2; road.position.set(-4600, 0.03, 260); local.add(road);
  // water
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: waterVert, fragmentShader: waterFrag, transparent: true,
    uniforms: { uTime: { value: 0 }, uSun: { value: SUN_DIR }, uCam: { value: new THREE.Vector3() }, uFade: { value: 1 }, uShore: { value: -LAND / 2 } },
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(LAND, LAND, 1, 1), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(LAND / 2 + 2000, -0.4, 0); local.add(water);

  // ---- splashdown ocean patch (moved to wherever the ship comes down) ----
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(80000, 80000), waterMat.clone());
  ocean.material.uniforms = { uTime: waterMat.uniforms.uTime, uSun: { value: SUN_DIR }, uCam: waterMat.uniforms.uCam, uFade: { value: 1 }, uShore: { value: -1e9 } };
  ocean.visible = false; world.add(ocean);
  env.placeOcean = (pos, theta) => {
    ocean.position.copy(pos);
    ocean.rotation.set(-Math.PI / 2, 0, 0);
    ocean.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -theta);
  };

  // ---- Earth ----
  const earth = new THREE.Group(); earth.position.set(0, -R_EARTH, 0); world.add(earth);
  const EARTH_C = new THREE.Vector3(0, -R_EARTH, 0);
  const earthBody = new THREE.Group(); earthBody.quaternion.copy(earthQuaternion(25.997, -97.157)); earth.add(earthBody);
  const earthMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  loader.load("assets/earth.jpg", t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; earthMat.map = t; earthMat.needsUpdate = true; });
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH - 120, 160, 80), earthMat);
  earthBody.add(earthMesh);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, roughness: 1 });
  // sharpen the cloud mask: thin haze in the source image becomes clear sky, real clouds stay bright
  cloudMat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <alphamap_fragment>", `
      #ifdef USE_ALPHAMAP
        diffuseColor.a *= smoothstep(0.28, 0.85, texture2D(alphaMap, vAlphaMapUv).g);
      #endif`);
  };
  loader.load("assets/clouds.jpg", t => { cloudMat.alphaMap = t; cloudMat.needsUpdate = true; });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH + 2500, 160, 80), cloudMat);
  earthBody.add(clouds);
  // atmosphere rim
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
    uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: `varying vec3 vN; varying vec3 vP;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vP;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec3 v = normalize(cameraPosition - vP);
        float rim = pow(1.0 - abs(dot(v, vN)), 3.0);
        float lit = clamp(dot(vN, uSun) * 0.8 + 0.4, 0.0, 1.0);
        gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * rim * 1.6 * lit, rim * lit);
      }`,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * 1.018, 128, 64), atmoMat);
  earth.add(atmo);

  // ---- low cumulus clouds around the launch site ----
  const puff = puffTexture();
  const cloudGroup = new THREE.Group(); world.add(cloudGroup);
  const cMat = new THREE.SpriteMaterial({ map: puff, color: 0xfff3e6, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  for (let i = 0; i < 110; i++) {
    const a = Math.random() * Math.PI * 2, d = 3000 + Math.random() * 26000;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 1600 + Math.random() * 1400;
    for (let j = 0; j < 5; j++) {
      const s = new THREE.Sprite(cMat);
      const size = 700 + Math.random() * 1100;
      s.scale.set(size, size * 0.6, 1);
      s.position.set(cx + (Math.random() - 0.5) * 1400, cy + Math.random() * 300, cz + (Math.random() - 0.5) * 900);
      cloudGroup.add(s);
    }
  }

  // ---- stars ----
  const starGeo = new THREE.BufferGeometry();
  const N = 4000, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos[i * 3] = r * Math.cos(th); pos[i * 3 + 1] = u; pos[i * 3 + 2] = r * Math.sin(th);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; stars.renderOrder = -9;
  scene.add(stars);

  const tmp = new THREE.Vector3();
  env.update = (camera, focusPos, time, dt, padPos) => {
    const camAlt = (camera.position.distanceTo(EARTH_C) - R_EARTH) / 1000;  // km
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9);
    skyMat.uniforms.uAlt.value = camAlt;
    skyMat.uniforms.uDip.value = Math.sqrt(Math.max(0, 2 * camAlt * 1000 / R_EARTH));
    stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    starMat.opacity = THREE.MathUtils.smoothstep(camAlt, 25, 70);
    waterMat.uniforms.uTime.value = time;
    waterMat.uniforms.uCam.value.copy(camera.position);
    // local terrain near the pad, the textured globe from altitude
    const nearPad = camera.position.distanceTo(padPos) < 120000;
    local.visible = nearPad;
    cloudGroup.visible = nearPad && camAlt < 40;
    const globe = THREE.MathUtils.smoothstep(camAlt, 6, 25);
    earthMesh.visible = clouds.visible = globe > 0 || !nearPad;
    cloudMat.opacity = 0.9 * Math.max(globe, nearPad ? 0 : 1);
    atmo.visible = camAlt > 20;
    clouds.rotation.y += dt * 0.00002;
    // shadows follow the action
    tmp.copy(focusPos);
    sun.target.position.copy(tmp);
    sun.position.copy(tmp).addScaledVector(SUN_DIR, 400);
    sun.intensity = 3.2;
    scene.fog.density = camAlt > 40 ? 0 : 0.000045 * Math.exp(-camAlt / 6);
    hemi.intensity = 0.55 * (1 - THREE.MathUtils.smoothstep(camAlt, 30, 90)) + 0.08;
  };
  env.showOcean = v => { ocean.visible = v; };
  env.sun = sun;
  env.puff = puff;
  return env;
}

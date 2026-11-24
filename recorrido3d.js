/* Volver al Corazón · Recorrido 3D (three.js r147 UMD, sin compilar) */
(function () {
'use strict';
const T = window.THREE;
const host = document.getElementById('scene');
if (!T || !host) return;
const PUNTOS = window.PUNTOS || [];
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); // aleatorio estable
const R = (a, b) => a + rnd() * (b - a);

/* ============ GEOMETRÍA BASE (m) · x = este, z = sur, origen = centro del parque ============ */
// Ajustado a OpenStreetMap: el anillo real se aproxima a un círculo de 57,6 m de radio (eje de la calzada)
// y la Cra 34 sale de él con rumbo 53,8° (este → sur). Del centro del parque a la Calle 4B hay 313 m.
const OSM = window.OSM_CALI || null, OFF = [13.46, 48.74]; // nodo OSM → centro del parque
const R_PARK = 48, R_RING = 64;
const DIR = new T.Vector2(0.59024, 0.80723).normalize(), NOR = new T.Vector2(DIR.y, -DIR.x);
const A = DIR.clone().multiplyScalar(62), LEN = 291, HALF = 13;
const B = A.clone().add(DIR.clone().multiplyScalar(LEN));
const along = (s, o) => new T.Vector2(A.x + DIR.x * s + NOR.x * o, A.y + DIR.y * s + NOR.y * o);
const angDir = Math.atan2(DIR.x, DIR.y);
const ringXZ = (a, r) => new T.Vector2(Math.cos(a) * r, Math.sin(a) * r);
// puntos (1–4 sobre el eje de la Cra 34; 5–9 en la rotonda)
const S_PT = { 1: 251, 2: 135, 3: 72, 4: 20 }; // 1 = Calle 4B (Carulla), 2 = Calle 4, 3 = Calle 3A, 4 = llegada
const P = {};
[1, 2, 3, 4].forEach(n => { const v = along(S_PT[n], 0); P[n] = [v.x, v.y]; });
P[5] = [57, -19]; P[6] = [2, -66]; P[7] = [-56, -13]; P[8] = [-9, 52]; P[9] = [0, 0];

/* ============ RENDERER ============ */
const isMobile = matchMedia('(max-width: 900px)').matches;
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.75));
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new T.Scene();
const cam = new T.PerspectiveCamera(42, 1, 0.5, 4000);
const controls = new T.OrbitControls(cam, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.485; controls.minDistance = 8; controls.maxDistance = 900;
controls.screenSpacePanning = false;

/* ============ CIELO (domo con degradado) ============ */
const skyU = { uLin: { value: 0 }, top: { value: new T.Color(0x5f9bd2) }, mid: { value: new T.Color(0xd6e4ea) }, bot: { value: new T.Color(0xf6d9b0) } };
const sky = new T.Mesh(new T.SphereGeometry(2200, 32, 16), new T.ShaderMaterial({
  side: T.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float uLin; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h>0.08 ? mix(mid, top, smoothstep(0.08,0.6,h)) : mix(bot, mid, smoothstep(-0.05,0.08,h)); c = mix(c, pow(c, vec3(2.2)) * 1.35, uLin); gl_FragColor = vec4(c,1.); }'
}));
scene.add(sky);
scene.fog = new T.Fog(0xe9dcc6, 560, 2100);

/* ============ LUCES ============ */
const hemi = new T.HemisphereLight(0xffe9cf, 0x5f6a4a, 0.62); scene.add(hemi);
const sun = new T.DirectionalLight(0xffc98a, 2.35);
sun.position.set(-280, 175, 130); sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 2048 : 4096, isMobile ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -340, right: 340, top: 340, bottom: -340, near: 40, far: 1100 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.5; sun.shadow.radius = 3;
sun.target.position.set(70, 0, 110); scene.add(sun, sun.target);
const fill = new T.DirectionalLight(0xbcd4ff, 0.25); fill.position.set(200, 120, -200); scene.add(fill);

/* ============ TEXTURAS PROCEDURALES ============ */
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]);
  t.encoding = T.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
// adoquines: color + altura dibujados con el mismo trazo; de la altura salen el mapa normal y la rugosidad
function pavers(base, joint, pattern, out) {
  const W2 = 512, hc = document.createElement('canvas'); hc.width = hc.height = W2; const h = hc.getContext('2d');
  h.fillStyle = '#262626'; h.fillRect(0, 0, W2, W2);
  const rc = document.createElement('canvas'); rc.width = rc.height = W2; const r = rc.getContext('2d'); r.fillStyle = '#fff'; r.fillRect(0, 0, W2, W2);
  const piece = (g, x, y, w, hh) => { // color con variación por pieza + leve degradado
    const l = R(-18, 18); g.fillStyle = base; g.fillRect(x, y, w, hh); g.fillStyle = `rgba(${l > 0 ? '255,236,210' : '60,28,12'},${Math.abs(l) / 80})`; g.fillRect(x, y, w, hh);
    const gr = g.createLinearGradient(x, y, x + w, y + hh); gr.addColorStop(0, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); g.fillStyle = gr; g.fillRect(x, y, w, hh);
    if (rnd() < 0.18) { g.fillStyle = 'rgba(40,30,20,.10)'; g.beginPath(); g.ellipse(x + R(0, w), y + R(0, hh), R(2, 7), R(2, 5), R(0, 3), 0, 6.3); g.fill(); } // mancha de uso
    const top = 175 + R(-25, 25) | 0; h.fillStyle = `rgb(${top - 50},${top - 50},${top - 50})`; h.fillRect(x, y, w, hh); h.fillStyle = `rgb(${top},${top},${top})`; h.fillRect(x + 2, y + 2, w - 4, hh - 4); // bisel
    const ro = 150 + R(0, 90) | 0; r.fillStyle = `rgb(${ro},${ro},${ro})`; r.fillRect(x, y, w, hh);
  };
  const t = canvasTex(W2, W2, (g, w) => {
    g.fillStyle = joint; g.fillRect(0, 0, w, w);
    if (pattern === 'slab') {
      const bw = 128, bh = 64;
      for (let y = 0; y < w; y += bh) for (let x = -bw; x < w; x += bw) { const off = (y / bh) % 2 ? bw / 2 : 0; piece(g, x + off + 2, y + 2, bw - 4, bh - 4); }
    } else {
      const u = 32; // espina de pez ortogonal (pares horizontales / verticales)
      for (let j = 0; j < w / u; j++) for (let i = 0; i < w / u; i += 2) {
        const hor = ((i / 2) + j) % 2 === 0, x = i * u, y = j * u;
        if (hor) { [0, 1].forEach(k => piece(g, x + 1.5, y + k * u / 2 + 1.5, 2 * u - 3, u / 2 - 3)); }
        else { [0, 1, 2, 3].forEach(k => piece(g, x + k * u / 2 + 1.5, y + 1.5, u / 2 - 3, u - 3)); }
      }
    }
    const n = g.getImageData(0, 0, w, w); for (let i = 0; i < n.data.length; i += 4) { const v = (rnd() - 0.5) * 14; n.data[i] += v; n.data[i + 1] += v; n.data[i + 2] += v; } g.putImageData(n, 0, 0);
  });
  // normal desde la altura (Sobel)
  const hd = h.getImageData(0, 0, W2, W2).data, nc = document.createElement('canvas'); nc.width = nc.height = W2; const ng = nc.getContext('2d'), nd = ng.createImageData(W2, W2);
  const H = (x, y) => hd[(((y + W2) % W2) * W2 + ((x + W2) % W2)) * 4] / 255;
  for (let y = 0; y < W2; y++) for (let x = 0; x < W2; x++) { const dx = (H(x - 1, y) - H(x + 1, y)) * 3.2, dy = (H(x, y - 1) - H(x, y + 1)) * 3.2, l = Math.hypot(dx, dy, 1), i = (y * W2 + x) * 4;
    nd.data[i] = (dx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255; }
  ng.putImageData(nd, 0, 0);
  const mk = c => { const x = new T.CanvasTexture(c); x.wrapS = x.wrapT = T.RepeatWrapping; x.anisotropy = renderer.capabilities.getMaxAnisotropy(); return x; };
  return { map: t, normalMap: mk(nc), roughnessMap: mk(rc), normalScale: new T.Vector2(0.9, 0.9) };
}
function grassTex(c1, c2, tint) {
  const t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < 0.5 ? c2 : 'rgba(255,255,210,.07)'; g.fillRect(rnd() * w, rnd() * w, 1.5, 3); }
  });
  t.userData.grass = tint || 0xffffff; return t;
}
// fachadas: muros cálidos de Cali, ventanas con marco de madera, postigos y franja de entrepiso
const WALLS = ['#f3ead9', '#efe0c4', '#e8c99a', '#d9a27a', '#f6f2ea', '#e4d8c3', '#d8c7a6', '#efd9c7', '#c98f6a', '#f1e6d2'];
function facade(wall, night) {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = night ? '#000' : wall; g.fillRect(0, 0, w, w);
    if (!night) { const n = g.getImageData(0, 0, w, w); for (let i = 0; i < n.data.length; i += 4) { const v = (rnd() - 0.5) * 8; n.data[i] += v; n.data[i + 1] += v; n.data[i + 2] += v; } g.putImageData(n, 0, 0); }
    const shutters = rnd() < 0.5;
    for (let f = 0; f < 3; f++) for (let b = 0; b < 4; b++) {
      const x = b * 64 + 18, y = f * 85 + 20, ww = 28, hh = 50;
      if (night) { g.fillStyle = rnd() < 0.6 ? (rnd() < 0.5 ? '#ffcf8a' : '#ffe2b0') : '#000'; g.fillRect(x, y, ww, hh); continue; }
      g.fillStyle = '#5a3d27'; g.fillRect(x - 3, y - 3, ww + 6, hh + 6);           // marco de madera
      g.fillStyle = '#2d3a3f'; g.fillRect(x, y, ww, hh);                            // vidrio
      g.fillStyle = 'rgba(255,240,220,.22)'; g.fillRect(x, y, ww, 9);
      g.fillStyle = '#5a3d27'; g.fillRect(x + ww / 2 - 1, y, 2, hh);
      if (shutters) { g.fillStyle = '#7a4f30'; g.fillRect(x - 13, y - 2, 9, hh + 4); g.fillRect(x + ww + 4, y - 2, 9, hh + 4); }
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x - 6, y + hh + 3, ww + 12, 4); // alféizar
    }
    if (!night) { g.fillStyle = 'rgba(70,45,30,.16)'; for (let f = 1; f < 3; f++) g.fillRect(0, f * 85 - 4, w, 4); }
  });
}
const facadeSets = WALLS.map(c => ({ map: facade(c, false), em: facade(c, true) }));

/* ============ MATERIALES ============ */
const std = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o));
const M = {
  ground: std({ color: 0xb8ae9a, roughness: 1 }),
  asphalt: std({ color: 0x77736d, roughness: 1 }),
  curb: std({ color: 0xe6dfd2 }),
  pavers: std(Object.assign(pavers('#c4774c', '#7d4a31'), { roughness: 1 })),
  pavers2: std(Object.assign(pavers('#c9c4bb', '#8e877b', 'slab'), { roughness: 1 })),
  stone: std(Object.assign(pavers('#e6dccb', '#b0a28b', 'slab'), { roughness: 0.95 })),
  tactile: std({ roughness: 0.75, map: canvasTex(64, 64, (g, w) => { g.fillStyle = '#e2b43a'; g.fillRect(0, 0, w, w); for (let y = 8; y < w; y += 16) for (let x = 8; x < w; x += 16) { const gr = g.createRadialGradient(x - 2, y - 2, 1, x, y, 6); gr.addColorStop(0, '#fbe08a'); gr.addColorStop(1, '#b88a1e'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 5.5, 0, 6.3); g.fill(); } }, [1, 40]) }),
  timber: std({ color: 0x8a5a36, roughness: 0.7 }),
  vine: std({ color: 0x4f8f3f, roughness: 0.9, side: T.DoubleSide, transparent: true, opacity: 0.92 }),
  rail: std({ color: 0x2b2b2b, metalness: 0.5, roughness: 0.5 }),
  grass: std({ map: grassTex('#74a752', '#5f9342', 0xd2e6b8), roughness: 1 }),
  lawn2: std({ map: grassTex('#86b762', '#6ea24f', 0xe6f2cc), roughness: 1 }),
  garden: std({ map: grassTex('#4a7f3d', '#3a6a30', 0x8fa878), roughness: 1 }),
  soil: std({ color: 0x7a5b3f, roughness: 1 }),
  water: new T.MeshPhysicalMaterial({ color: 0x5f9fc8, roughness: 0.08, metalness: 0.1, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.9 }),
  roof: std({ color: 0xd8d2c7 }), roofTile: std({ color: 0xb2654a }),
  glass: std({ color: 0x2c3a40, roughness: 0.2, metalness: 0.3, emissive: 0xffb760, emissiveIntensity: 0.25 }),
  heart: std({ color: 0x4d4844, roughness: 0.8 }),
  wood: std({ color: 0x9b6a42, roughness: 0.75 }),
  trunk: std({ color: 0x6f5e4c, roughness: 1, map: canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#8a7a68'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '40,30,20' : '200,190,170'},${R(0.08, 0.25)})`; g.fillRect(rnd() * w, rnd() * h, R(2, 6), R(10, 40)); } }) }),
  palmTrunk: std({ color: 0xa89a84, roughness: 0.95 }),
  leaf: std({ color: 0xffffff, roughness: 0.85 }), // color por instancia
  bronze: std({ color: 0x5e3f25, metalness: 0.8, roughness: 0.35 }),
  white: std({ color: 0xf8f6f1 }),
  metal: std({ color: 0x2f3437, metalness: 0.6, roughness: 0.45 }),
  lamp: std({ color: 0xfff4d6, emissive: 0xffd08a, emissiveIntensity: 0.4 }),
  bulb: new T.MeshBasicMaterial({ color: 0xfff0c8 }),
  sensor: std({ color: 0x4fb0ff, emissive: 0x2f8fff, emissiveIntensity: 1.8 }),
  planter: std({ color: 0xbfb4a4, roughness: 0.95 }),
  person: std({ color: 0xffffff, roughness: 0.8 })
};

/* ============ AYUDANTES ============ */
let PARENT = scene;
const add = (geo, mat, x, y, z, ry = 0, cast = true, recv = true) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = recv; PARENT.add(m); return m; };
const flat = (geo, mat, y, x = 0, z = 0, rz = 0) => { const m = new T.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.rotation.z = rz; m.position.set(x, y, z); m.receiveShadow = true; PARENT.add(m); return m; };
const tmp = new T.Object3D();
function instanced(geo, mat, list, setter, opts = {}) {
  const im = new T.InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => { tmp.position.set(0, 0, 0); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); setter(tmp, it, i); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); if (opts.color) im.setColorAt(i, opts.color(it, i)); });
  im.castShadow = opts.cast !== false; im.receiveShadow = true; PARENT.add(im); return im;
}
/* --- transformación HOY → PROPUESTA: onda radial en el shader (descarta fragmentos según la distancia) --- */
const REV = { uC: { value: new T.Vector2(0, 0) }, uR: { value: 0 }, uGlow: { value: 1 } };
const CLONES = new Map();
function revealMat(mat, inverse) {
  if (!mat || mat.isShaderMaterial) return mat;
  if (!CLONES.has(mat)) CLONES.set(mat, {});
  const bag = CLONES.get(mat), key = inverse ? 'i' : 'p';
  if (bag[key]) return bag[key];
  const m = mat.clone();
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uC: REV.uC, uR: REV.uR, uGlow: REV.uGlow });
    sh.vertexShader = 'varying vec3 vRW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 rw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n rw = instanceMatrix * rw;\n#endif\n vRW = (modelMatrix * rw).xyz; }');
    sh.fragmentShader = 'uniform vec2 uC; uniform float uR; uniform float uGlow; varying vec3 vRW;\n' + sh.fragmentShader.replace('#include <output_fragment>',
      'float rd = distance(vRW.xz, uC);\n' + (inverse ? 'if (rd < uR) discard;\n' : 'if (rd > uR) discard;\n') + '#include <output_fragment>\n' +
      (inverse ? 'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0,0.72,0.45), uGlow * 0.55 * smoothstep(4.0, 0.0, rd - uR));' : 'gl_FragColor.rgb += vec3(0.45,1.0,0.55) * uGlow * 0.9 * smoothstep(3.5, 0.0, uR - rd);'));
  };
  m.customProgramCacheKey = () => 'rev-' + key + '-' + (mat.type || '');
  bag[key] = m; return m;
}
const DEPTH = {};
function revealDepth(inverse) {
  const k = inverse ? 'i' : 'p'; if (DEPTH[k]) return DEPTH[k];
  const m = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uC: REV.uC, uR: REV.uR });
    sh.vertexShader = 'varying vec3 vRW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 rw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n rw = instanceMatrix * rw;\n#endif\n vRW = (modelMatrix * rw).xyz; }');
    sh.fragmentShader = 'uniform vec2 uC; uniform float uR; varying vec3 vRW;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n float rd = distance(vRW.xz, uC);\n ' + (inverse ? 'if (rd < uR) discard;' : 'if (rd > uR) discard;'));
  };
  m.customProgramCacheKey = () => 'revD-' + k;
  return DEPTH[k] = m;
}
function applyReveal(list, inverse) { list.forEach(o => o.traverse(n => { if (n.isMesh && n.castShadow) n.customDepthMaterial = revealDepth(inverse); if (n.isMesh) n.material = Array.isArray(n.material) ? n.material.map(x => revealMat(x, inverse)) : revealMat(n.material, inverse); })); }
const variants = (mat, fn) => { fn(mat); const b = CLONES.get(mat); if (b) Object.values(b).forEach(fn); };
const BLD = [];
function texRepeat(mat, rx, ry) { const m = mat.clone(); ['map', 'normalMap', 'roughnessMap'].forEach(k => { if (mat[k]) { m[k] = mat[k].clone(); m[k].needsUpdate = true; m[k].repeat.set(rx, ry); } }); return m; }
const inCorridor = (v, pad) => { const d = v.clone().sub(A), s = d.dot(DIR), o = Math.abs(d.dot(NOR)); return s > -25 && s < LEN + 25 && o < HALF + pad; };

/* ============ SUELO Y CONTEXTO REAL (OpenStreetMap) ============ */
flat(new T.PlaneGeometry(3600, 3600), M.ground, 0);
// cerros de Cali al occidente (silueta lejana, se pierde en la neblina)
{ const g = new T.PlaneGeometry(4200, 900, 120, 30); g.rotateX(-Math.PI / 2); const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i), t = (z + 450) / 900;
    const n = Math.sin(x * 0.004) * 0.5 + Math.sin(x * 0.011 + 2) * 0.3 + Math.sin(x * 0.027 + 5) * 0.15;
    pa.setY(i, Math.max(0, (t * t) * (260 + n * 150))); }
  g.computeVertexNormals(); const hills = new T.Mesh(g, std({ color: 0x6f8d5a, roughness: 1 })); hills.position.set(-1500, -2, 0); hills.rotation.y = Math.PI / 2 + 0.25; hills.receiveShadow = false; scene.add(hills); }
// rejilla de ocupación de 2 m: calles, edificios reales, corredor y anillo
const GC = 2, GN = 760, GH = GN / 2, occ = new Uint8Array(GN * GN);
const gi = (x, z) => { const i = Math.floor(x / GC) + GH, j = Math.floor(z / GC) + GH; return (i < 0 || j < 0 || i >= GN || j >= GN) ? -1 : j * GN + i; };
const isOcc = (x, z) => { const k = gi(x, z); return k < 0 || occ[k] > 0; };
function markDisc(x, z, r, v = 1) { for (let a = x - r; a <= x + r; a += GC) for (let b = z - r; b <= z + r; b += GC) if ((a - x) ** 2 + (b - z) ** 2 <= r * r) { const k = gi(a, b); if (k >= 0) occ[k] = Math.max(occ[k], v); } }
function inPoly(x, z, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > z) !== (b.y > z) && x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
function markPoly(pts, v = 2) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.y); z1 = Math.max(z1, p.y); });
  for (let x = x0 - 2; x <= x1 + 2; x += GC) for (let z = z0 - 2; z <= z1 + 2; z += GC) if (inPoly(x, z, pts)) { const k = gi(x, z); if (k >= 0) occ[k] = Math.max(occ[k], v); } }
const polyGeo = v => new T.ShapeGeometry(new T.Shape(v.map(p => new T.Vector2(p.x, -p.y)))).rotateX(-Math.PI / 2);
const toV = arr => { const o = []; for (let i = 0; i < arr.length; i += 2) o.push(new T.Vector2(arr[i] + OFF[0], arr[i + 1] + OFF[1])); return o; };
const inCorr = (v, pad) => { const d = v.clone().sub(A), s2 = d.dot(DIR), o = Math.abs(d.dot(NOR)); return s2 > -14 && s2 < LEN + 2 && o < HALF + pad; };
const inRing = (v, pad) => v.length() < R_RING + pad;
// corredor y anillo reservados
for (let s2 = -14; s2 < LEN + 4; s2 += 1.5) for (let o = -HALF + 1; o <= HALF - 1; o += 1.5) { const v = along(s2, o), k = gi(v.x, v.y); if (k >= 0) occ[k] = 3; }
markDisc(0, 0, R_RING - 2, 3);
// calzadas reales: cinta de asfalto + andén, recortadas donde empieza el proyecto
const RW = { pr: 9.5, te: 8, re: 7, se: 4.5, pl: 3.6 }, roadRuns = [], mioRuns = [], stations = [];
function ribbon(list, y) { // list: [[p, q, halfW]] → una sola geometría
  const pos = [], idx = []; let b = 0;
  list.forEach(([p, q, h]) => { const d = q.clone().sub(p); const L = d.length(); if (L < 0.01) return; d.divideScalar(L); const n = new T.Vector2(-d.y, d.x).multiplyScalar(h);
    const e = d.clone().multiplyScalar(Math.min(h, 2)); const p2 = p.clone().sub(e), q2 = q.clone().add(e);
    pos.push(p2.x + n.x, y, p2.y + n.y, p2.x - n.x, y, p2.y - n.y, q2.x + n.x, y, q2.y + n.y, q2.x - n.x, y, q2.y - n.y); idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); b += 4; });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
const segA = [], segS = [], segM = [], dashes = [];
if (OSM) OSM.hw.forEach(([cls, name, oneway, flatPts]) => {
  const pts = toV(flatPts), mio = name === 'MIO';
  if (cls === 'pl') { stations.push(pts); return; }
  const hw = mio ? 3.6 : RW[cls] / 2; let run = [];
  const flush = () => { if (run.length > 1) (mio ? mioRuns : roadRuns).push({ pts: run, cls, oneway }); run = []; };
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], L = p.distanceTo(q), n = Math.max(1, Math.ceil(L / 3));
    for (let k = 0; k < n; k++) {
      const a = p.clone().lerp(q, k / n), c = p.clone().lerp(q, (k + 1) / n), m = a.clone().add(c).multiplyScalar(0.5);
      if (inRing(m, 1) || inCorr(m, -1) || m.length() > 900) { flush(); continue; }
      (mio ? segM : segA).push([a, c, hw]); if (!mio) segS.push([a, c, hw + 2.6]);
      if (!run.length) run.push(a); run.push(c);
      if (!mio && !oneway && (cls === 'te' || cls === 'pr') && k % 2 === 0) dashes.push([a.clone().lerp(c, 0.2), a.clone().lerp(c, 0.8), 0.08]);
      const r = hw + 2.6; for (let t = 0; t <= 1; t += 0.34) { const v = a.clone().lerp(c, t); markDisc(v.x, v.y, r, 1); }
    }
  }
  flush();
});
const runLen = r => { r.cum = [0]; for (let i = 1; i < r.pts.length; i++) r.cum.push(r.cum[i - 1] + r.pts[i].distanceTo(r.pts[i - 1])); r.L = r.cum[r.cum.length - 1]; return r; };
function runAt(r, d) { let i = 1; while (i < r.cum.length - 1 && r.cum[i] < d) i++; const k = (d - r.cum[i - 1]) / (r.cum[i] - r.cum[i - 1] || 1), p = r.pts[i - 1], q = r.pts[i]; return [p.x + (q.x - p.x) * k, p.y + (q.y - p.y) * k, Math.atan2(q.x - p.x, q.y - p.y)]; }
roadRuns.forEach(runLen); mioRuns.forEach(runLen);
const sideMat = std({ color: 0xd3ccbf, roughness: 1 }), mioMat = std({ color: 0xa9a49b, roughness: 0.95 });
add(ribbon(segS, 0.03), sideMat, 0, 0, 0, 0, false, true);
add(ribbon(segA, 0.05), M.asphalt, 0, 0, 0, 0, false, true);
add(ribbon(segM, 0.055), mioMat, 0, 0, 0, 0, false, true);
add(ribbon(dashes, 0.065), new T.MeshBasicMaterial({ color: 0xf2efe6 }), 0, 0, 0, 0, false, false);
// estaciones del MIO sobre la Calle 5
stations.forEach(pts => { const p = pts[0], q = pts[pts.length - 1], c = p.clone().add(q).multiplyScalar(0.5), L = p.distanceTo(q), ry = Math.atan2(q.x - p.x, q.y - p.y);
  add(new T.BoxGeometry(4.2, 1.0, L), M.curb, c.x, 0.5, c.y, ry); add(new T.BoxGeometry(4.6, 0.25, L + 1), std({ color: 0x5f9a6a }), c.x, 4.2, c.y, ry);
  add(new T.BoxGeometry(3.6, 3.1, L - 1), std({ color: 0x9fc3c9, transparent: true, opacity: 0.45, roughness: 0.1 }), c.x, 2.6, c.y, ry, false); markDisc(c.x, c.y, L / 2, 1); });
// manzanas reales: parques deportivos, agua, parqueaderos
if (OSM) { (OSM.parks || []).forEach(a => { const v = toV(a); add(polyGeo(v), std({ color: 0x6f9a52 }), 0, 0.06, 0, 0, false, true); markPoly(v); });
  (OSM.water || []).forEach(a => { const v = toV(a); add(polyGeo(v), M.water, 0, 0.08, 0, 0, false, true); markPoly(v); });
  (OSM.parking || []).forEach(a => { const v = toV(a); add(polyGeo(v), M.asphalt, 0, 0.04, 0, 0, false, true); markPoly(v); }); }
// aberturas reales del anillo: donde las calles OSM tocan el borde
const openings = [];
roadRuns.forEach(r => [r.pts[0], r.pts[r.pts.length - 1]].forEach(v => { if (v.length() < R_RING + 9) { const a = Math.atan2(v.y, v.x); if (!openings.some(o => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.15)) openings.push(a); } }));
openings.push(Math.atan2(DIR.y, DIR.x));
const PROP = []; let _mk = scene.children.length;
/* ============ BULEVAR CRA 34 ============ */
const mid = along(LEN / 2, 0);
flat(new T.PlaneGeometry(HALF * 2, LEN), texRepeat(M.pavers, HALF * 2 / 7, LEN / 7), 0.12, mid.x, mid.y, angDir);
// franjas de piedra clara junto a fachadas (paso libre)
[-1, 1].forEach(sd => { const c = along(LEN / 2, sd * (HALF - 1.6)); flat(new T.PlaneGeometry(3.2, LEN), texRepeat(M.pavers2, 0.5, LEN / 7), 0.13, c.x, c.y, angDir); });
[-1, 1].forEach(sd => { const c = along(LEN / 2, sd * (HALF - 3.4)); flat(new T.PlaneGeometry(0.6, LEN - 4), M.tactile, 0.135, c.x, c.y, angDir); });
// eje verde central
const spineL = LEN - 36, spC = along(36 + spineL / 2, 0);
add(new T.BoxGeometry(7.2, 0.55, spineL), M.curb, spC.x, 0.27, spC.y, angDir, false);
flat(new T.PlaneGeometry(6.4, spineL - 0.6), texRepeat(M.garden, 1, spineL / 6), 0.56, spC.x, spC.y, angDir);
// jardines de lluvia laterales con lámina de agua
[-1, 1].forEach(sd => {
  for (let s = 40; s < LEN - 12; s += 26) {
    const c = along(s + 8, sd * (HALF - 5.2));
    add(new T.BoxGeometry(2.4, 0.35, 15), M.curb, c.x, 0.17, c.y, angDir, false);
    flat(new T.PlaneGeometry(2.0, 14.6), M.garden, 0.36, c.x, c.y, angDir);
    flat(new T.PlaneGeometry(0.5, 13), M.water, 0.38, c.x, c.y, angDir);
  }
});
// puerta sur (punto 1): franja táctil, bolardos y biciparqueadero
const p1 = along(S_PT[1] + 14, 0);
flat(new T.PlaneGeometry(HALF * 2 - 1, 1.6), std({ color: 0xe5b733, roughness: 0.7 }), 0.15, p1.x, p1.y, angDir + Math.PI / 2);
const bollards = []; for (let o = -HALF + 2; o <= HALF - 2; o += 2.2) bollards.push(along(S_PT[1] + 15.5, o));
instanced(new T.CylinderGeometry(0.16, 0.18, 1.0, 10), M.metal, bollards, (o, v) => o.position.set(v.x, 0.62, v.y));
const bike = along(S_PT[1] + 2, HALF - 4.5);
{ const st = (s2, o) => along(S_PT[1] + 2 + s2, HALF - 4.5 + o);
  [[-4.6, -1.3], [4.6, -1.3], [-4.6, 1.3], [4.6, 1.3]].forEach(([a, o]) => { const v = st(a, o); add(new T.BoxGeometry(0.14, 2.8, 0.14), M.rail, v.x, 1.4, v.y, angDir); });
  for (let k = -4.6; k <= 4.6; k += 0.42) { const v = st(k, 0); add(new T.BoxGeometry(3.2, 0.1, 0.2), M.timber, v.x, 2.85, v.y, angDir + Math.PI / 2, true, false); }
  [-1.3, 1.3].forEach(o => { const v = st(0, o); add(new T.BoxGeometry(0.12, 0.16, 9.6), M.rail, v.x, 2.75, v.y, angDir, false); });
  for (let k = -4.4; k <= 4.4; k += 0.32) { const v = st(k, 1.45); add(new T.BoxGeometry(0.16, 2.2, 0.06), M.timber, v.x, 1.25, v.y, angDir + Math.PI / 2, false); } }
// bicicletas parqueadas
{ const bk = []; for (let i = -3.5; i <= 3.5; i += 1) if (rnd() < 0.8) bk.push(along(S_PT[1] + 2 + i, HALF - 4.5));
  const wg = new T.TorusGeometry(0.33, 0.035, 5, 14); wg.rotateY(Math.PI / 2);
  instanced(wg, M.rail, bk.flatMap(v => [[v, -0.5], [v, 0.5]]), (o, [v, k]) => { const n = NOR.clone().multiplyScalar(k); o.position.set(v.x + n.x, 0.4, v.y + n.y); o.rotation.y = angDir + Math.PI / 2; }, { cast: false });
  instanced(new T.BoxGeometry(0.05, 0.05, 1.0), std({ color: 0xffffff, metalness: 0.4, roughness: 0.4 }), bk, (o, v) => { o.position.set(v.x, 0.62, v.y); o.rotation.y = angDir + Math.PI / 2; o.rotation.x = 0.25; }, { color: (v, i) => new T.Color([0x2f6fb0, 0xd9472b, 0x2b2b2b, 0x3e8e5e, 0xf2c94c][i % 5]) }); }
const racks = []; for (let i = -3.5; i <= 3.5; i += 1) racks.push(along(S_PT[1] + 2 + i, HALF - 4.5));
instanced(new T.TorusGeometry(0.42, 0.05, 6, 14, Math.PI), M.metal, racks, (o, v) => { o.position.set(v.x, 0.2, v.y); o.rotation.y = angDir + Math.PI / 2; });

/* ============ ANILLO Y PARQUE ============ */
flat(new T.RingGeometry(R_PARK + 1, R_RING, 128, 1), texRepeat(M.pavers, 26, 26), 0.12);
add(new T.CylinderGeometry(R_PARK + 1, R_PARK + 1, 0.45, 128, 1, true), M.curb, 0, 0.22, 0, 0, false);
flat(new T.CircleGeometry(R_PARK + 1, 128), texRepeat(M.grass, 10, 10), 0.4);
// 4 lóbulos con tonos distintos
const lobeTex = [M.lawn2, M.grass, M.lawn2, M.grass];
for (let i = 0; i < 4; i++) flat(new T.CircleGeometry(R_PARK - 2.5, 48, i * Math.PI / 2 + 0.06, Math.PI / 2 - 0.12), texRepeat(lobeTex[i], 6, 6), 0.42);
// senderos en cruz y anillo interior
[0, Math.PI / 2].forEach(r => flat(new T.PlaneGeometry(3.6, R_PARK * 2 - 1), texRepeat(M.stone, 0.6, 14), 0.44, 0, 0, r));
flat(new T.RingGeometry(R_PARK - 3.4, R_PARK - 1.2, 128), texRepeat(M.stone, 30, 1), 0.44);
// Plaza de Teddy
flat(new T.CircleGeometry(11, 64), texRepeat(M.stone, 4, 4), 0.46);
const plinth = add(new T.CylinderGeometry(2.4, 2.9, 1.8, 40), M.stone, 0, 1.3, 0);
add(new T.TorusGeometry(2.9, 0.12, 8, 40), M.bronze, 0, 2.2, 0, 0, false).rotation.x = Math.PI / 2;
const BENCHC = std({ color: 0xdcd5c9, side: T.DoubleSide });
flat(new T.RingGeometry(11, 14.5, 96), std({ color: 0xc8a27a, roughness: 1 }), 0.45);
[[8.6, 0.35, 1.25], [8.6, 2.45, 1.25], [8.6, 4.55, 1.2]].forEach(([r, a0, len]) => {
  add(new T.CylinderGeometry(r + 0.35, r + 0.35, 0.5, 48, 1, true, a0, len), BENCHC, 0, 0.7, 0);
  add(new T.CylinderGeometry(r - 0.35, r - 0.35, 0.5, 48, 1, true, a0, len), BENCHC, 0, 0.7, 0);
  const top = flat(new T.RingGeometry(r - 0.4, r + 0.4, 48, 1, a0 - Math.PI / 2, len), M.timber, 0.97); top.rotation.z = 0; });
const fr = []; for (let i = 0; i < 90; i++) { const a = rnd() * Math.PI * 2, r = R(3.1, 4.4); fr.push([Math.cos(a) * r, Math.sin(a) * r, i]); }
instanced(new T.IcosahedronGeometry(0.28, 0), std({ color: 0xffffff }), fr, (o, f) => { o.position.set(f[0], 0.62, f[1]); o.scale.setScalar(R(0.8, 1.3)); }, { cast: false, color: (f, i) => new T.Color([0xe94b6a, 0xf2c94c, 0xf08a3c, 0x3f7f3a, 0xb75ad1, 0x4d8f3f, 0xd8342b][i % 7]) });
// Teddy (pastor alemán estilizado)
const dog = new T.Group(); dog.position.set(0, 2.2, 0); dog.rotation.y = -0.7; scene.add(dog);
const dp = (geo, x, y, z, rx = 0, rz = 0) => { const m = new T.Mesh(geo, M.bronze); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; dog.add(m); };
dp(new T.CapsuleGeometry(0.42, 1.5, 6, 12), 0, 1.05, 0, 0, Math.PI / 2);
dp(new T.CapsuleGeometry(0.34, 0.5, 6, 12), 0.95, 1.55, 0, 0, -0.6);
dp(new T.CapsuleGeometry(0.2, 0.45, 6, 10), 1.45, 1.75, 0, 0, Math.PI / 2 - 0.15);
dp(new T.ConeGeometry(0.14, 0.42, 8), 1.12, 2.15, 0.15); dp(new T.ConeGeometry(0.14, 0.42, 8), 1.12, 2.15, -0.15);
[[0.55, 0.22], [0.55, -0.22], [-0.6, 0.22], [-0.6, -0.22]].forEach(([x, z]) => dp(new T.CapsuleGeometry(0.11, 0.7, 4, 8), x, 0.42, z));
dp(new T.CapsuleGeometry(0.1, 0.8, 4, 8), -1.2, 1.05, 0, 0, 1.0);
// zona canina (lóbulo NO): cerca baja + bebedero
const fenceArc = []; for (let a = -Math.PI + 0.12; a < -Math.PI / 2 - 0.12; a += 0.035) fenceArc.push(ringXZ(a, R_PARK - 5));
for (let r = 13; r < R_PARK - 5; r += 1.2) { fenceArc.push(new T.Vector2(-r, -2.6)); fenceArc.push(new T.Vector2(-2.6, -r)); }
instanced(new T.BoxGeometry(0.12, 1.1, 0.12), M.wood, fenceArc, (o, v) => o.position.set(v.x, 0.95, v.y));
add(new T.CylinderGeometry(0.7, 0.8, 1.1, 20), M.stone, -20, 0.95, -20);
// juego infantil (lóbulo SO)
flat(new T.CircleGeometry(9, 40), std({ color: 0xd9a06b, roughness: 1 }), 0.45, -22, 20);
[[-24, 17, 0xe2783f], [-19, 24, 0x3f8fd0], [-27, 23, 0xf0c13d]].forEach(([x, z, c], i) => {
  add(new T.BoxGeometry(2.6, 2.2, 2.6), std({ color: c }), x, 1.55, z, i);
  add(new T.ConeGeometry(2.1, 1.4, 4), std({ color: 0xf6efe4 }), x, 3.35, z, i + Math.PI / 4);
});
add(new T.BoxGeometry(6, 0.25, 0.25), M.wood, -18, 3, 16, 0.6); add(new T.BoxGeometry(0.25, 3, 0.25), M.wood, -20.5, 1.5, 14.4); add(new T.BoxGeometry(0.25, 3, 0.25), M.wood, -15.5, 1.5, 17.6);
// encuentro (lóbulo NE): anfiteatro circular
for (let k = 0; k < 3; k++) { const t = add(new T.TorusGeometry(5 + k * 1.3, 0.35, 6, 48, Math.PI * 1.2), M.stone, 22, 0.55 + k * 0.32, -21); t.rotation.x = -Math.PI / 2; t.rotation.z = 0.9; }
flat(new T.CircleGeometry(4.6, 40), texRepeat(M.stone, 2, 2), 0.47, 22, -21);
// estancia (lóbulo SE): bancas bajo árboles + mesas
for (let i = 0; i < 6; i++) { const v = ringXZ(0.25 + i * 0.22, 26); add(new T.BoxGeometry(2.2, 0.5, 0.6), M.wood, v.x, 0.75, v.y, -(0.25 + i * 0.22)); }

/* plaza de llegada (punto 4) con corazón en el piso y espejo de agua */
const p4 = along(S_PT[4], 0);
flat(new T.CircleGeometry(17, 72), texRepeat(M.pavers, 5, 5), 0.14, p4.x, p4.y);
const hs = new T.Shape(), k = 0.75;
hs.moveTo(0, -9 * k); hs.bezierCurveTo(-3 * k, -12 * k, -12 * k, -8 * k, -11 * k, 0); hs.bezierCurveTo(-10 * k, 7 * k, -2 * k, 9 * k, 0, 4 * k);
hs.bezierCurveTo(2 * k, 9 * k, 10 * k, 7 * k, 11 * k, 0); hs.bezierCurveTo(12 * k, -8 * k, 3 * k, -12 * k, 0, -9 * k);
const heartOut = new T.Shape(hs.getPoints(64)); const heartHole = new T.Path(hs.getPoints(64).map(p => p.clone().multiplyScalar(0.82)));
heartOut.holes.push(heartHole);
flat(new T.ShapeGeometry(heartOut, 64), M.heart, 0.16, p4.x, p4.y, angDir + Math.PI);
flat(new T.ShapeGeometry(new T.Shape(hs.getPoints(64).map(p => p.clone().multiplyScalar(0.5))), 32), M.heart, 0.16, p4.x, p4.y, angDir + Math.PI);
const wm = along(S_PT[4] + 6, -9); add(new T.CylinderGeometry(3.2, 3.2, 0.3, 40), M.curb, wm.x, 0.15, wm.y, 0, false); flat(new T.CircleGeometry(2.9, 40), M.water, 0.32, wm.x, wm.y);
const qr = along(S_PT[4] + 4, 8); add(new T.BoxGeometry(0.95, 2.5, 0.38), std({ color: 0xa8774a, roughness: 0.7 }), qr.x, 1.25, qr.y, angDir); add(new T.CylinderGeometry(0.475, 0.475, 0.38, 20, 1, false, 0, Math.PI), std({ color: 0xa8774a, roughness: 0.7 }), qr.x, 2.5, qr.y, angDir + Math.PI / 2).rotation.x = Math.PI / 2;
{ const f = DIR.clone().multiplyScalar(0.2); add(new T.BoxGeometry(0.66, 0.9, 0.02), std({ color: 0x2c4a3a, emissive: 0x3a9c66, emissiveIntensity: 0.5 }), qr.x + f.x, 1.75, qr.y + f.y, angDir); add(new T.BoxGeometry(0.32, 0.32, 0.02), M.white, qr.x + f.x * 1.05, 1.05, qr.y + f.y * 1.05, angDir); }

/* plaza del café y flores (punto 8) */
const k8 = ringXZ(Math.atan2(52, -9), R_RING - 6);
const a8 = Math.atan2(52, -9), t8 = new T.Vector2(-Math.sin(a8), Math.cos(a8)), r8 = new T.Vector2(Math.cos(a8), Math.sin(a8));
const at8 = (u, v) => k8.clone().add(t8.clone().multiplyScalar(u)).add(r8.clone().multiplyScalar(v));
{ const roofM = std({ color: 0x3b3f42, metalness: 0.5, roughness: 0.5 }), ry8 = -a8 - Math.PI / 2;
  [[-3, -1.8], [3, -1.8], [-3, 1.8], [3, 1.8]].forEach(([u, v]) => { const q = at8(u, v); add(new T.BoxGeometry(0.16, 3.4, 0.16), M.timber, q.x, 1.7, q.y, ry8); });
  const rf = add(new T.BoxGeometry(7, 0.12, 4.6), roofM, k8.x, 3.55, k8.y, ry8); rf.rotateX(0.12);
  const bk = at8(0, 1.6); add(new T.BoxGeometry(6, 2.4, 0.3), M.timber, bk.x, 1.3, bk.y, ry8);
  const flowers = [];
  for (let tier = 0; tier < 3; tier++) { const q = at8(0, 1.1 - tier * 0.8); add(new T.BoxGeometry(5.8, 0.3 + tier * 0.0, 0.7), M.wood, q.x, 0.9 - tier * 0.3, q.y, ry8);
    for (let u = -2.6; u <= 2.6; u += 0.42) { const v2 = at8(u, 1.1 - tier * 0.8); flowers.push([v2.x, 1.25 - tier * 0.3, v2.y]); } }
  instanced(new T.CylinderGeometry(0.17, 0.13, 0.32, 8), std({ color: 0x8a9096, metalness: 0.5, roughness: 0.4 }), flowers, (o, f) => o.position.set(f[0], f[1], f[2]), { cast: false });
  instanced(new T.IcosahedronGeometry(0.24, 0), std({ color: 0xffffff }), flowers, (o, f, i) => { o.position.set(f[0], f[1] + 0.3, f[2]); o.scale.set(1, 1.2, 1); o.rotation.y = i; }, { color: (f, i) => new T.Color([0xe94b6a, 0xf2c94c, 0xf08a3c, 0xb75ad1, 0xffffff, 0xd8342b, 0xff8fb1][i % 7]) });
  // café al lado
  const cf = ringXZ(a8 + 0.16, R_RING - 6); add(new T.BoxGeometry(3.6, 2.8, 3), M.wood, cf.x, 1.5, cf.y, ry8); add(new T.BoxGeometry(4.4, 0.15, 3.8), roofM, cf.x, 3.0, cf.y, ry8);
  const gl = cf.clone().add(r8.clone().multiplyScalar(-1.52)); add(new T.BoxGeometry(2.8, 1.3, 0.05), M.glass, gl.x, 1.9, gl.y, ry8, false); }
const bins = ringXZ(Math.atan2(52, -9) + 0.12, R_RING - 4);
[0x5aa84f, 0xe8b04a, 0x7c8285].forEach((c, i) => add(new T.BoxGeometry(0.8, 1.1, 0.8), std({ color: c }), bins.x + i * 0.95, 0.7, bins.y));

PROP.push(...scene.children.slice(_mk));
/* ============ EDIFICIOS ============ */
/* oclusión ambiental de contacto horneada: sombras suaves al pie de muros, bancas, materas, mesas y árboles */
const aoRectTex = canvasTex(128, 128, (g, w) => { g.filter = 'blur(9px)'; g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(20, 20, w - 40, w - 40); });
const aoBlobTex = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const aoMat = (tex, op) => new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const AO_R = []; // [x, z, w, d, ry]
function aoLayer(list, tex, op, y, pad = 1.0) { if (!list.length) return null; const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  const im = instanced(g, aoMat(tex, op), list, (o, a) => { o.position.set(a[0], a[5] !== undefined ? a[5] : y, a[1]); o.rotation.y = a[4] || 0; o.scale.set(a[2] * pad, 1, a[3] * pad); }, { cast: false }); im.receiveShadow = false; im.renderOrder = 1; return im; }
const shopBands = [];
const AWN = [0xd9724a, 0x2f7a55, 0xf1e7d6, 0x9a3f3a, 0xe0b04a].map(c => std({ color: c }));
// el barrio se fusiona por anillos de distancia y material: ~1.000 edificios en pocas llamadas de dibujo
const BAKE = new Map();
function bake(grp, dist) {
  const band = Math.min(9, Math.floor(dist / 70));
  grp.children.forEach(m => { if (!m.isMesh) return; m.updateMatrix();
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix);
    ['uv2'].forEach(k => g.deleteAttribute(k));
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const parts = Array.isArray(m.material) ? m.geometry.groups.map(gr => [mats[gr.materialIndex], gr.start, gr.count]) : [[mats[0], 0, g.attributes.position.count]];
    parts.forEach(([mat, st, cnt]) => { const key = band + '|' + mat.uuid; if (!BAKE.has(key)) BAKE.set(key, { band, mat, geos: [] });
      const sub = new T.BufferGeometry(); ['position', 'normal', 'uv'].forEach(k => { const at = g.attributes[k]; sub.setAttribute(k, new T.BufferAttribute(at.array.slice(st * at.itemSize, (st + cnt) * at.itemSize), at.itemSize)); });
      BAKE.get(key).geos.push(sub); }); });
}
function flushBake() {
  const groups = {};
  BAKE.forEach(({ band, mat, geos }) => { const g = T.BufferGeometryUtils.mergeBufferGeometries(geos, false); if (!g) return;
    if (!groups[band]) { groups[band] = new T.Group(); scene.add(groups[band]); BLD.push({ g: groups[band], d: band * 70 + 35 }); }
    const m = new T.Mesh(g, mat); m.castShadow = m.receiveShadow = true; groups[band].add(m); });
  BAKE.clear();
}
const winMats = facadeSets.map(fs => std({ map: fs.map, emissiveMap: fs.em, emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.95 }));
const wallMat = () => winMats[(rnd() * winMats.length) | 0];
// huella orientada libre en la rejilla
function obbFree(x, z, w, d, ry, pad = 1) { const c = Math.cos(ry), sn = Math.sin(ry);
  for (let u = -w / 2 - pad; u <= w / 2 + pad; u += 1.5) for (let v = -d / 2 - pad; v <= d / 2 + pad; v += 1.5) { const px = x + u * c + v * sn, pz = z - u * sn + v * c; if (isOcc(px, pz)) return false; } return true; }
function obbMark(x, z, w, d, ry) { const c = Math.cos(ry), sn = Math.sin(ry);
  for (let u = -w / 2; u <= w / 2; u += 1.5) for (let v = -d / 2; v <= d / 2; v += 1.5) { const k = gi(x + u * c + v * sn, z - u * sn + v * c); if (k >= 0) occ[k] = 2; } }
// edificio real de OSM: muros extruidos de su huella con UV en metros
function realBuilding(pts, h, name) {
  const grp = new T.Group(); scene.add(grp); if (pts[0].distanceTo(pts[pts.length - 1]) < 0.1) pts = pts.slice(0, -1);
  let area = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; area += p.x * q.y - q.x * p.y; }); if (area < 0) pts = pts.slice().reverse();
  const pos = [], uv = [], idx = []; let b = 0, run = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], L = p.distanceTo(q);
    pos.push(p.x, 0.1, p.y, q.x, 0.1, q.y, q.x, h, q.y, p.x, h, p.y); uv.push(run / 12, 0, (run + L) / 12, 0, (run + L) / 12, h / 9.6, run / 12, h / 9.6);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2); b += 4; run += L; });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new T.Mesh(g, wallMat()); m.castShadow = m.receiveShadow = true; grp.add(m);
  const roof = new T.Mesh(polyGeo(pts), M.roof); roof.position.y = h; roof.receiveShadow = true; grp.add(roof);
  const c = pts.reduce((a, p) => a.add(p), new T.Vector2()).divideScalar(pts.length);
  if (h > 9) { const t = new T.Mesh(new T.BoxGeometry(4, 2, 4), M.roof); t.position.set(c.x, h + 1, c.y); t.castShadow = true; grp.add(t); }
  { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.y); z1 = Math.max(z1, p.y); }); AO_R.push([(x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 3.2, z1 - z0 + 3.2, 0]); }
  BLD.push({ g: grp, d: Math.hypot(c.x - 80, c.y - 110) }); return grp;
}
function building(x, z, w, d, h, ry, opts = {}) {
  const grp = new T.Group(); if (!opts.merge) scene.add(grp); const prevP = PARENT; PARENT = grp;
  const wall = wallMat();
  const geo = new T.BoxGeometry(w, h, d);
  // UV proporcionales a los metros (módulo 12 m × 9.6 m)
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const fw = (f < 2) ? d : w, sx = fw / 12, sy = h / 9.6;
    for (let v = 0; v < 4; v++) { const i = f * 4 + v; if (f === 2 || f === 3) uv.setXY(i, 0.02, 0.02); else uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy + (opts.ground ? 0 : 0)); }
  }
  const roofM = opts.tile ? M.roofTile : M.roof;
  const m = add(geo, [wall, wall, roofM, roofM, wall, wall], x, h / 2 + 0.1, z, ry);
  if (opts.tile) { const r = add(new T.ConeGeometry(Math.hypot(w, d) / 2 * 0.98, 3, 4), M.roofTile, x, h + 1.6, z, ry + Math.PI / 4); r.scale.set(w / Math.hypot(w, d) * 1.41, 1, d / Math.hypot(w, d) * 1.41); }
  else { add(new T.BoxGeometry(w * 0.3, 1.6, d * 0.3), M.roof, x + R(-w / 4, w / 4), h + 0.9, z + R(-d / 4, d / 4), ry); }
  if (opts.balcony && h > 7) {
    for (let f = 1; f * 3.2 + 1 < h - 1; f++) {
      const fr = new T.Vector2(0, d / 2 + 0.6).rotateAround(new T.Vector2(), -ry), y = f * 3.2 + 0.5;
      add(new T.BoxGeometry(w * 0.82, 0.18, 1.2), M.curb, x + fr.x, y, z + fr.y, ry);
      const rr = new T.Vector2(0, d / 2 + 1.15).rotateAround(new T.Vector2(), -ry);
      add(new T.BoxGeometry(w * 0.82, 1.0, 0.06), opts.woodRail ? M.timber : M.rail, x + rr.x, y + 0.55, z + rr.y, ry, false);
    }
  }
  if (opts.shop) {
    const front = new T.Vector2(0, d / 2 + 0.35).rotateAround(new T.Vector2(), -ry);
    const g = add(new T.BoxGeometry(w * 0.9, 3.2, 0.5), M.glass, x + front.x, 1.8, z + front.y, ry, false);
    shopBands.push(g);
    const aw = new T.Vector2(0, d / 2 + 1.4).rotateAround(new T.Vector2(), -ry);
    const a = add(new T.BoxGeometry(w * 0.86, 0.18, 2.4), AWN[(rnd() * 5) | 0], x + aw.x, 3.75, z + aw.y, ry); a.rotation.x = 0; a.rotateX(-0.22);
  }
  PARENT = prevP; AO_R.push([x, z, w + 3.2, d + 3.2, ry]); if (opts.merge) bake(grp, Math.hypot(x - 80, z - 110)); else BLD.push({ g: grp, d: Math.hypot(x - 80, z - 110) });
  return m;
}
// frentes de la Cra 34
// edificios mapeados en OSM (Carulla, Las Margaritas, San Fernando del Viento, Univalle, bancos de la Calle 5…)
const LV = { university: 3, hospital: 4, commercial: 2, parking: 3, yes: 3, block: 3, roof: 1 };
if (OSM) OSM.bld.forEach(([lv, name, arr]) => {
  const v = toV(arr), c = v.reduce((a, p) => a.add(p), new T.Vector2()).divideScalar(v.length);
  if (c.length() > 900 || v.some(p => inCorr(p, 0.5) || inRing(p, 2))) return;
  const fl = +lv || LV[name] || 3; realBuilding(v, fl * 3.2 + 0.6, name); markPoly(v, 2);
});
// frentes de la Cra 34: un lote tras otro, saltando bocacalles y edificios reales
[-1, 1].forEach(sd => {
  let s = -6;
  while (s < LEN + 20) {
    const w = R(10, 17), fl = rnd() < 0.18 ? 5 + ((rnd() * 2) | 0) : 2 + ((rnd() * 2.2) | 0), d = R(14, 20), h = fl * 3.2 + 0.6;
    const c = along(s + w / 2, sd * (HALF + d / 2 + 0.8)), ry = angDir - sd * Math.PI / 2;
    if (!obbFree(c.x, c.y, w, d, ry, 0.3)) { s += 3; continue; }
    obbMark(c.x, c.y, w, d, ry);
    building(c.x, c.y, w, d, h, ry, { shop: true, balcony: true, woodRail: rnd() < 0.5, tile: fl <= 3 && rnd() < 0.55 });
    s += w + 0.8;
  }
});
// frentes del anillo (dejando bocacalles)
for (let a = -Math.PI; a < Math.PI; a += 0.165) {
  if (openings.some(o => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.2)) continue;
  const fl = rnd() < 0.22 ? 5 + ((rnd() * 2) | 0) : 2 + ((rnd() * 2.2) | 0), r = R_RING + 10.5, h = fl * 3.2 + 0.6;
  if (!obbFree(Math.cos(a) * r, Math.sin(a) * r, 11.5, 17, -a - Math.PI / 2, 0)) continue; obbMark(Math.cos(a) * r, Math.sin(a) * r, 11.5, 17, -a - Math.PI / 2);
  building(Math.cos(a) * r, Math.sin(a) * r, 11.5, 17, h, -a - Math.PI / 2, { shop: true, balcony: true, woodRail: rnd() < 0.5, tile: fl <= 3 && rnd() < 0.5 });
}
// barrio real: lotes que dan la cara a cada calle de OSM, uno al lado del otro, hasta llenar la manzana
const RAD = isMobile ? 380 : 520;
roadRuns.forEach(r => {
  const hw = RW[r.cls] / 2 + 2.6;
  [-1, 1].forEach(sd => { let t = 2;
    while (t < r.L - 2) {
      const w = R(9, 15), dp = R(11, 18), [mx, mz, ang] = runAt(r, t + w / 2), d = new T.Vector2(Math.sin(ang), Math.cos(ang)), n = new T.Vector2(-d.y, d.x);
      const c = new T.Vector2(mx, mz).add(n.clone().multiplyScalar(sd * (hw + dp / 2 + 2.4)));
      if (c.length() > RAD) { t += w; continue; }
      const f = n.clone().multiplyScalar(-sd), ry = Math.atan2(f.x, f.y);
      if (!obbFree(c.x, c.y, w, dp, ry, 0)) { t += 2.5; continue; }
      obbMark(c.x, c.y, w, dp, ry);
      const big = rnd() < 0.04, h = big ? R(16, 30) : (rnd() < 0.5 ? 2 : 3) * 3.2 + 0.6;
      building(c.x, c.y, w, dp, h, ry, { merge: true, tile: h < 11 && rnd() < 0.6, shop: r.cls !== 're' && rnd() < 0.5, balcony: big });
      const c2 = c.clone().add(n.clone().multiplyScalar(sd * (dp / 2 + 7.5))), d2 = R(9, 13), w2 = w * R(0.7, 1);
      if (c2.length() < RAD && rnd() < 0.7 && obbFree(c2.x, c2.y, w2, d2, ry, 0.5)) { obbMark(c2.x, c2.y, w2, d2, ry); building(c2.x, c2.y, w2, d2, R(5.5, 9.5), ry, { merge: true, tile: rnd() < 0.7 }); }
      t += w + R(0.4, 1.6);
    }
  });
});
flushBake();
aoLayer(AO_R, aoRectTex, 0.42, 0.165);

/* ============ VEGETACIÓN ============ */
const trees = []; // [x, z, escala, tipo 0=frondoso 1=samán]
for (let i = 0; i < 52; i++) { const a = rnd() * Math.PI * 2, r = R(21, R_PARK - 5); if (Math.abs(Math.sin(a * 2)) < 0.12) continue; trees.push([Math.cos(a) * r, Math.sin(a) * r, R(0.8, 1.2), rnd() < 0.65 ? 1 : 0]); }
for (let i = 0; i < 30; i++) { const v = ringXZ(i / 30 * Math.PI * 2 + 0.05, R_RING + 1.2); if (openings.some(o => Math.abs(Math.atan2(Math.sin(i / 30 * Math.PI * 2 - o), Math.cos(i / 30 * Math.PI * 2 - o))) < 0.18)) continue; trees.push([v.x, v.y, R(0.55, 0.7), 0]); }
[-1, 1].forEach(sd => { for (let s = 30; s < LEN; s += 17) { const v = along(s + (sd > 0 ? 8 : 0), sd * (HALF - 2.9)); trees.push([v.x, v.y, R(0.5, 0.6), 0]); } });
// árboles de calle sobre los andenes reales y árboles de patio en lo que queda libre
roadRuns.forEach(r => { const hw = RW[r.cls] / 2 + 1.3; for (let t = R(2, 9); t < r.L; t += R(9, 16)) [-1, 1].forEach(sd => { if (rnd() < 0.35) return;
  const [x, z, ang] = runAt(r, t), v = new T.Vector2(x + Math.cos(ang) * hw * sd, z - Math.sin(ang) * hw * sd), k = gi(v.x, v.y); if (k < 0 || occ[k] >= 2 || v.length() > RAD + 60) return; trees.push([v.x, v.y, R(0.5, 0.85), rnd() < 0.25 ? 1 : 0]); }); });
for (let i = 0; i < (isMobile ? 260 : 420); i++) { const x = R(-RAD, RAD), z = R(-RAD, RAD), k = gi(x, z); if (k < 0 || occ[k] || Math.hypot(x, z) > RAD + 80) continue; trees.push([x, z, R(0.6, 1.25), rnd() < 0.3 ? 1 : 0]); }
const leafCols = [0x4a8a3c, 0x5d9a45, 0x3f7a36, 0x6fa64e, 0x7fb257, 0x568f40, 0x8fbc5c];
// guayacanes amarillos y rosados (como en los renders): uno de cada ~7 árboles medianos
trees.forEach(t => { if (t[3] === 0 && t[2] > 0.55 && rnd() < 0.15) t[3] = rnd() < 0.55 ? 2 : 3; });
const crownGeo = new T.IcosahedronGeometry(1, 2);
// textura de hojas: decenas de hojas elípticas con nervadura, fondo transparente (copa) y opaco (arbustos)
function leafCanvas(opaque) { return canvasTex(256, 256, (g, w) => {
  if (opaque) { g.fillStyle = '#7fa760'; g.fillRect(0, 0, w, w); }
  for (let i = 0; i < (opaque ? 260 : 150); i++) { const x = rnd() * w, y = rnd() * w, a = rnd() * Math.PI * 2, L = R(10, 22), l = R(52, 86) | 0;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `hsl(${R(88, 112) | 0},${R(28, 48) | 0}%,${l}%)`; g.beginPath(); g.ellipse(0, 0, L, L * 0.38, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,60,20,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke(); g.restore(); }
}); }
const leafTex = leafCanvas(false), leafOpaque = leafCanvas(true);
M.leaf.map = leafOpaque;
// copa = tarjetas de hojas cruzadas dentro de un elipsoide
const cardsGeo = (() => { const parts = []; for (let k = 0; k < 26; k++) { const g = new T.PlaneGeometry(0.95, 0.95); const e = new T.Euler(R(0, 6.3), R(0, 6.3), R(0, 6.3)); g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(e));
  const u = rnd(), v = rnd(), th = u * Math.PI * 2, ph = Math.acos(2 * v - 1), r = Math.pow(rnd(), 0.35) * 0.78; g.translate(Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 0.9, Math.sin(ph) * Math.sin(th) * r); parts.push(g); }
  return T.BufferGeometryUtils.mergeBufferGeometries(parts); })();
const WIND = { value: 0 };
function addWind(mat, amp) { const prev = mat.onBeforeCompile; mat.onBeforeCompile = sh => { sh.uniforms.uTime = WIND;
  sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n float wph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.11;\n#else\n float wph = 0.0;\n#endif\n float wk = max(0.0, position.y + 0.6);\n transformed.x += sin(uTime * 1.3 + wph + position.y * 1.7) * ' + amp + ' * wk;\n transformed.z += cos(uTime * 1.05 + wph * 1.3) * ' + amp * 0.8 + ' * wk;');
  }; mat.customProgramCacheKey = () => 'wind' + amp; return mat; }
M.foliage = addWind(std({ map: leafTex, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.8 }), 0.05);
M.leafCore = addWind(std({ map: leafOpaque, color: 0x6d8f55, roughness: 0.95 }), 0.03);
const leafDepth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: leafTex, alphaTest: 0.45 });
instanced(new T.CylinderGeometry(0.38, 0.6, 1, 7), M.trunk, trees, (o, t) => { o.position.set(t[0], 3 * t[2], t[1]); o.scale.set(t[2], 6 * t[2], t[2]); });
aoLayer(trees.map(t => { const v = new T.Vector2(t[0], t[1]); return [t[0], t[1], 7 * t[2], 7 * t[2], 0, v.length() < R_PARK ? 0.47 : (inCorr(v, 0) ? 0.172 : 0.075)]; }), aoBlobTex, 0.32, 0.1);
// 3 lóbulos de copa por árbol, color variado
const bloomTex = canvasTex(256, 256, (g, w) => { for (let i = 0; i < 420; i++) { const x = rnd() * w, y = rnd() * w, r = R(2.5, 6); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#e8e8e8'); gr.addColorStop(1, 'rgba(200,200,200,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `hsla(${R(85, 110) | 0},35%,${R(35, 55) | 0}%,.9)`; g.beginPath(); g.ellipse(rnd() * w, rnd() * w, R(6, 12), R(2.5, 4), R(0, 3), 0, 6.3); g.fill(); } });
M.bloom = addWind(std({ map: bloomTex, alphaTest: 0.4, side: T.DoubleSide, roughness: 0.7 }), 0.05);
const bloomDepth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: bloomTex, alphaTest: 0.4 });
const leafy = trees.filter(t => t[3] < 2), blooms = trees.filter(t => t[3] >= 2);
// guayacán: copa extendida y abierta, cargada de flor
for (let part = 0; part < 3; part++) {
  const im = instanced(cardsGeo, M.bloom, blooms, (o, t, i) => { const s = t[2]; const ox = part === 0 ? 0 : (part === 1 ? 2.6 : -2.4) * s, oz = part === 0 ? 0 : (part === 1 ? 1.4 : -1.5) * s;
    o.position.set(t[0] + ox, (7.8 + part * 0.5) * s, t[1] + oz); o.scale.set(5.4 * s, 3.0 * s, 5.4 * s); o.rotation.y = i * 1.7 + part; },
    { color: t => new T.Color(t[3] === 2 ? 0xf6c629 : 0xec8fbf).multiplyScalar(R(0.92, 1.08)) });
  im.customDepthMaterial = bloomDepth;
}
instanced(crownGeo, M.leafCore, blooms, (o, t) => { const s = t[2]; o.position.set(t[0], 7.6 * s, t[1]); o.scale.set(3.4 * s, 1.5 * s, 3.4 * s); }, { color: t => new T.Color(t[3] === 2 ? 0xb39a3a : 0xa8748a) });
// ramas: dos brazos inclinados por árbol hacia los lóbulos de la copa
{ const up = new T.Vector3(0, 1, 0), q = new T.Quaternion(), dv = new T.Vector3(), br = [];
  trees.forEach(t => { const s = t[2], sam = t[3] === 1; [[2.4, 1.2], [-2.0, -1.6]].forEach(([ox, oz]) => br.push([t[0], t[1], s, ox * s * (sam ? 1.3 : 1), oz * s * (sam ? 1.3 : 1), sam ? 7.6 * s : 7.2 * s])); });
  instanced(new T.CylinderGeometry(0.16, 0.3, 1, 6).translate(0, 0.5, 0), M.trunk, br, (o, b) => { const y0 = 4.6 * b[2]; dv.set(b[3], b[5] - y0, b[4]); const L = dv.length(); q.setFromUnitVectors(up, dv.normalize());
    o.position.set(b[0], y0, b[1]); o.quaternion.copy(q); o.scale.set(b[2], L, b[2]); }); }
for (let part = 0; part < 6; part++) {
  const card = part >= 3, pp = part % 3;
  const im = instanced(card ? cardsGeo : crownGeo, card ? M.foliage : M.leafCore, leafy, (o, t, i) => { const part = pp;
    const s = t[2], sam = t[3] === 1;
    const ox = part === 0 ? 0 : (part === 1 ? 2.4 : -2.0) * s, oz = part === 0 ? 0 : (part === 1 ? 1.2 : -1.6) * s;
    const r = sam ? (part === 0 ? 6.2 : 4.2) : (part === 0 ? 4.6 : 3.2);
    o.position.set(t[0] + ox, (sam ? 8.4 : 7.6 + part * 0.9) * s, t[1] + oz);
    const kk = card ? 1.18 : 0.8; o.scale.set(r * s * kk, (sam ? 0.42 : 0.82) * r * s * (card ? 1.25 : 0.8), r * s * kk); o.rotation.y = i + (card ? 1.3 : 0);
  }, { color: (t, i) => new T.Color(leafCols[(i + pp * 2) % leafCols.length]).multiplyScalar(pp === 0 ? 1.05 : 1.15) });
  if (card) im.customDepthMaterial = leafDepth;
}
// palmas reales del eje verde
const pathOff = s2 => Math.sin(s2 / 9) * 1.6; // sendero de piedra que serpentea por el eje verde
const palms = []; for (let s = 44; s < LEN - 8; s += 8.5) { const v = along(s, -Math.sign(pathOff(s) || 1) * R(1.2, 2.2)); palms.push([v.x, v.y, R(0.92, 1.12)]); }
for (let i = 0; i < 8; i++) { const v = along(S_PT[1] + 8, -HALF + 5 + i * 0.1); }
instanced(new T.CylinderGeometry(0.22, 0.32, 1, 9), M.palmTrunk, palms, (o, p) => { o.position.set(p[0], 8 * p[2], p[1]); o.scale.set(p[2], 16 * p[2], p[2]); });
// copa de palma: hojas largas arqueadas fusionadas en una geometría
function palmCrownGeo() {
  const pos = [], idx = []; let base = 0;
  for (let f = 0; f < 11; f++) {
    const a = f / 11 * Math.PI * 2, seg = 6, L = 5.2;
    for (let j = 0; j <= seg; j++) {
      const t = j / seg, r = t * L, y = Math.sin(t * Math.PI * 0.85) * 1.4 - t * t * 2.4, wdt = Math.sin(t * Math.PI) * 0.7 + 0.05;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, px = -Math.sin(a) * wdt, pz = Math.cos(a) * wdt;
      pos.push(cx + px, y, cz + pz, cx - px, y, cz - pz);
      if (j < seg) { const b = base + j * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    base += (seg + 1) * 2;
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
instanced(palmCrownGeo(), addWind(std({ color: 0x3e7d3e, roughness: 0.85, side: T.DoubleSide }), 0.06), palms, (o, p, i) => { o.position.set(p[0], 16 * p[2], p[1]); o.scale.setScalar(p[2]); o.rotation.y = i * 0.7; });
_mk = scene.children.length;
// jardines tropicales: matas, heliconias (hojas en abanico + flor roja/naranja) y helechos
const shrubs = [], helis = [];
for (let s = 38; s < LEN - 6; s += 1.6) { let o0 = R(-2.7, 2.7); if (Math.abs(o0 - pathOff(s)) < 1.15) o0 = pathOff(s) + (o0 > pathOff(s) ? 1.3 : -1.3); if (Math.abs(o0) > 2.9) continue; const v = along(s, o0); shrubs.push([v.x, 0.8, v.y, R(0.55, 1.0)]); if (rnd() < 0.5) helis.push([v.x + R(-0.6, 0.6), v.y + R(-0.6, 0.6), R(0.8, 1.2)]); }
[-1, 1].forEach(sd => { for (let s = 40; s < LEN - 12; s += 26) for (let q = 0; q < 9; q++) { const v = along(s + 1 + q * 1.6, sd * (HALF - 5.2) + R(-0.7, 0.7)); shrubs.push([v.x, 0.55, v.y, R(0.45, 0.75)]); if (q % 2) helis.push([v.x, v.y, R(0.7, 1.0)]); } });
for (let i = 0; i < 260; i++) { const v = ringXZ(rnd() * Math.PI * 2, R(R_PARK - 2.2, R_PARK + 0.4)); shrubs.push([v.x, 0.7, v.y, R(0.5, 0.95)]); if (rnd() < 0.35) helis.push([v.x, v.y, R(0.7, 1.1)]); }
{ const p4c = along(S_PT[4], 0); for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, v = new T.Vector2(p4c.x + Math.cos(a) * R(14, 17), p4c.y + Math.sin(a) * R(14, 17)); if (inCorridor(v, -HALF + 6)) continue; shrubs.push([v.x, 0.6, v.y, R(0.5, 0.9)]); helis.push([v.x, v.y, R(0.8, 1.1)]); } }
instanced(new T.IcosahedronGeometry(1, 1), M.leaf, shrubs, (o, sh) => { o.position.set(sh[0], sh[1], sh[2]); o.scale.set(sh[3], sh[3] * 0.75, sh[3]); }, { color: (sh, i) => new T.Color([0x3f7f3a, 0x4d8f3f, 0x5f9d48, 0x356f34][i % 4]) });
const heliLeaf = (() => { // abanico de 5 hojas
  const pos = [], idx = []; let b = 0;
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, tilt = 0.35;
    const pts = [[0, 0], [0.18, 0.7], [0, 1.6], [-0.18, 0.7]];
    pts.forEach(([u, v]) => { const r = v * Math.sin(tilt), x = Math.cos(a) * r + -Math.sin(a) * u, z = Math.sin(a) * r + Math.cos(a) * u; pos.push(x, v * Math.cos(tilt), z); });
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3); b += 4; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
instanced(heliLeaf, std({ color: 0x3b7a33, side: T.DoubleSide, roughness: 0.8 }), helis, (o, h, i) => { o.position.set(h[0], 0.45, h[1]); o.scale.setScalar(h[2]); o.rotation.y = i; });
instanced(new T.ConeGeometry(0.13, 0.45, 5), std({ color: 0xffffff, roughness: 0.6 }), helis, (o, h, i) => { o.position.set(h[0] + 0.15, 0.45 + 1.15 * h[2], h[1]); o.rotation.z = 0.5; o.scale.setScalar(h[2]); }, { cast: false, color: (h, i) => new T.Color([0xd8342b, 0xf07a2a, 0xe9b52f, 0xd9466b][i % 4]) });

/* ============ MOBILIARIO: terrazas, pérgolas, luminarias, luces colgantes ============ */
// terrazas: mesa + parasol
const terr = [];
for (let s = 50; s < 130; s += 4.2) [-1, 1].forEach(sd => terr.push(along(s, sd * (HALF - 4.8))));
for (let a = -1.45; a < 0.55; a += 0.085) terr.push(ringXZ(a, R_RING - 3.6));
for (let a = -1.9; a < -1.2; a += 0.09) terr.push(ringXZ(a, R_RING - 3.6));
instanced(new T.CylinderGeometry(0.55, 0.55, 0.06, 14), M.white, terr, (o, v) => o.position.set(v.x, 0.95, v.y));
instanced(new T.CylinderGeometry(0.04, 0.04, 2.4, 6), M.metal, terr, (o, v) => o.position.set(v.x, 1.35, v.y), { cast: false });
instanced(new T.ConeGeometry(1.6, 0.6, 10, 1, true), std({ color: 0xffffff, side: T.DoubleSide }), terr, (o, v) => o.position.set(v.x, 2.6, v.y), { color: (v, i) => new T.Color(i % 3 ? 0xf4ede2 : 0xd9724a) });
const chairs = []; terr.forEach(v => { for (let q = 0; q < 3; q++) { const a = q / 3 * Math.PI * 2; chairs.push([v.x + Math.cos(a) * 0.95, v.y + Math.sin(a) * 0.95, Math.atan2(-Math.cos(a), -Math.sin(a))]); } });
// sillas de bistró: asiento, espaldar y patas (miran a la mesa)
instanced(new T.BoxGeometry(0.44, 0.05, 0.42), M.wood, chairs, (o, c) => { o.position.set(c[0], 0.46, c[1]); o.rotation.y = c[2]; }, { cast: false });
instanced(new T.BoxGeometry(0.44, 0.42, 0.04).translate(0, 0.21, -0.2), M.wood, chairs, (o, c) => { o.position.set(c[0], 0.48, c[1]); o.rotation.y = c[2]; o.rotateX(-0.12); }, { cast: false });
instanced(T.BufferGeometryUtils.mergeBufferGeometries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => new T.BoxGeometry(0.035, 0.44, 0.035).translate(u * 0.19, -0.22, v * 0.18))), M.rail, chairs, (o, c) => { o.position.set(c[0], 0.44, c[1]); o.rotation.y = c[2]; o.scale.set(1, 1, 1); }, { cast: false });
const bulbs = [], vineClumps = [];
// pérgolas del frente gastronómico (punto 3)
[-1, 1].forEach(sd => {
  for (let s = 58; s < 120; s += 14) {
    const c = along(s, sd * (HALF - 4.8));
    const top = add(new T.BoxGeometry(5.2, 0.25, 11), M.wood, c.x, 3.6, c.y, angDir);
    for (let q = 0; q < 6; q++) { const b = along(s - 5 + q * 2, sd * (HALF - 4.8)); add(new T.BoxGeometry(5.4, 0.18, 0.22), M.wood, b.x, 3.85, b.y, angDir + Math.PI / 2, false); }
    [[-2.4, -5], [2.4, -5], [-2.4, 5], [2.4, 5]].forEach(([o, ds]) => { const p = along(s + ds, sd * (HALF - 4.8) + o); add(new T.BoxGeometry(0.22, 3.6, 0.22), M.wood, p.x, 1.8, p.y, angDir); });
    top.visible = false; // solo vigas
    for (let q = 0; q < 12; q++) [-2.5, 0, 2.5].forEach(o => { if (rnd() < 0.75) { const v = along(s - 5.4 + q * 0.95, sd * (HALF - 4.8) + o); vineClumps.push([v.x, v.y, R(0.45, 0.8)]); } });
    for (let q = 0; q < 10; q++) { const b = along(s - 5 + q * 1.1, sd * (HALF - 4.8) + R(-2.2, 2.2)); bulbs.push([b.x, 3.55, b.y]); }
  }
});
instanced(new T.IcosahedronGeometry(1, 1), M.leaf, vineClumps, (o, v) => { o.position.set(v[0], 4.05, v[1]); o.scale.set(v[2] * 1.3, v[2] * 0.55, v[2] * 1.3); }, { color: (v, i) => new T.Color([0x4f8f3f, 0x5f9d48, 0xa8457a, 0x3f7a36, 0x6fa64e, 0x4a8a3c, 0xc0558f][i % 7]) });
// materas que delimitan terrazas
const planters = []; for (let s = 46; s < 132; s += 3.5) [-1, 1].forEach(sd => planters.push(along(s, sd * (HALF - 7.4))));
for (let a = -1.45; a < 0.55; a += 0.05) planters.push(ringXZ(a, R_RING - 6.4));
instanced(new T.BoxGeometry(1.5, 0.75, 1.5), M.timber, planters, (o, v) => o.position.set(v.x, 0.5, v.y));
instanced(new T.IcosahedronGeometry(0.75, 0), M.leaf, planters, (o, v) => o.position.set(v.x, 1.2, v.y), { color: (v, i) => new T.Color(i % 4 ? 0x4a8a45 : 0x6aa456) });
// luminarias peatonales
const lamps = [];
for (let s = 10; s < LEN; s += 18) [-1, 1].forEach(sd => lamps.push(along(s + (sd > 0 ? 9 : 0), sd * (HALF - 3.2))));
for (let a = 0; a < Math.PI * 2; a += 0.3) lamps.push(ringXZ(a, R_PARK + 2.6));
instanced(new T.CylinderGeometry(0.08, 0.12, 4.4, 8), M.rail, lamps, (o, v) => o.position.set(v.x, 2.3, v.y));
const lampHeads = instanced(new T.CylinderGeometry(0.26, 0.2, 0.62, 6), M.lamp, lamps, (o, v) => o.position.set(v.x, 4.75, v.y), { cast: false });
instanced(new T.ConeGeometry(0.36, 0.3, 6), M.rail, lamps, (o, v) => o.position.set(v.x, 5.2, v.y), { cast: false });
// manchas de luz en el piso (solo de noche)
const glowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,210,140,.9)'); gr.addColorStop(1, 'rgba(255,210,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const glowMat = new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 });
const pools = instanced(new T.PlaneGeometry(9, 9), glowMat, lamps, (o, v) => { o.position.set(v.x, 0.2, v.y); o.rotation.x = -Math.PI / 2; }, { cast: false });
// luces colgantes (catenarias)
function catenary(p, q, n, sag, h) { for (let i = 1; i < n; i++) { const t = i / n; bulbs.push([p.x + (q.x - p.x) * t, h - Math.sin(t * Math.PI) * sag, p.y + (q.y - p.y) * t]); } }
for (let s = 54; s < 128; s += 7) [-1, 1].forEach(sd => catenary(along(s, sd * (HALF - 0.8)), along(s + 3.5, sd * (HALF - 8)), 9, 0.6, 4.4));
for (let a = -1.45; a < 0.5; a += 0.12) catenary(ringXZ(a, R_RING - 0.6), ringXZ(a + 0.06, R_PARK + 2.6), 10, 0.7, 4.6);
const bulbMesh = instanced(new T.SphereGeometry(0.09, 6, 4), M.bulb, bulbs, (o, b) => o.position.set(b[0], b[1], b[2]), { cast: false });

/* ============ SENSORES TEDDY CONECTA ============ */
const sensorPos = [along(S_PT[1], HALF - 3.2), along(S_PT[2] + 4, -HALF + 3.2), along(S_PT[3], HALF - 3.2), along(S_PT[4] + 10, -10), ringXZ(-0.32, R_PARK + 2.6), ringXZ(-1.54, R_PARK + 2.6), ringXZ(-2.91, R_PARK + 2.6), ringXZ(1.74, R_PARK + 2.6)];
const sensors = new T.Group(); scene.add(sensors);
const halos = [];
sensorPos.forEach(v => {
  const s = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), M.sensor); s.position.set(v.x, 5.4, v.y); sensors.add(s);
  const h = new T.Mesh(new T.RingGeometry(0.9, 1.15, 40), new T.MeshBasicMaterial({ color: 0x6cc0ff, transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false }));
  h.position.copy(s.position); sensors.add(h); halos.push(h);
});

const skin = [0xf2c9a4, 0xd9a47a, 0xb07a52, 0x8a5a3a], cloth = [0xd96c4a, 0x2f6fb0, 0xf2c94c, 0x3e8e5e, 0xf4efe6, 0x7a5aa6, 0x2b3a33, 0xe94b6a, 0x4fb0d8];

/* ============ DETALLES DE LOS RENDERS ============ */
// P2 · sendero de piedra y bancas de madera en el eje verde
{ const seg = []; for (let s2 = 37; s2 < LEN - 2; s2 += 1.2) seg.push([along(s2, pathOff(s2)), along(s2 + 1.2, pathOff(s2 + 1.2)), 0.7]);
  add(ribbon(seg, 0.6), std({ color: 0xe2d6c2, roughness: 0.85 }), 0, 0, 0, 0, false, true);
  const stepStones = []; for (let s2 = 40; s2 < LEN - 4; s2 += 0.9) stepStones.push(along(s2, pathOff(s2) + R(-0.25, 0.25)));
  instanced(new T.CylinderGeometry(0.32, 0.34, 0.05, 7), std({ color: 0xcfc2ab }), stepStones, (o, v, i) => { o.position.set(v.x, 0.63, v.y); o.rotation.y = i; }, { cast: false }); }
const spineBench = []; for (let s2 = 44; s2 < LEN - 10; s2 += 11) [-1, 1].forEach(sd => spineBench.push([along(s2 + (sd > 0 ? 5 : 0), sd * 4.15), sd]));
instanced(new T.BoxGeometry(0.55, 0.12, 2.3), M.timber, spineBench, (o, [v, sd]) => { o.position.set(v.x, 0.55, v.y); o.rotation.y = angDir; });
instanced(new T.BoxGeometry(0.08, 0.5, 2.3), M.timber, spineBench, (o, [v, sd]) => { const b = v.clone().add(NOR.clone().multiplyScalar(-sd * 0.25)); o.position.set(b.x, 0.85, b.y); o.rotation.y = angDir; });
instanced(new T.BoxGeometry(0.45, 0.45, 0.12), M.rail, spineBench.flatMap(b => [[b[0].clone().add(DIR.clone().multiplyScalar(0.9)), b[1]], [b[0].clone().add(DIR.clone().multiplyScalar(-0.9)), b[1]]]), (o, [v]) => { o.position.set(v.x, 0.32, v.y); o.rotation.y = angDir; }, { cast: false });
// P2 · bahía de cargue con carrito eléctrico y vendedor con carreta
{ const lb = along(S_PT[2] + 8, HALF - 6.4); flat(new T.PlaneGeometry(2.6, 6), std({ color: 0x3fa7a0, roughness: 0.8 }), 0.14, lb.x, lb.y, angDir);
  add(new T.BoxGeometry(1.4, 1.3, 2.4), M.white, lb.x, 0.95, lb.y, angDir); const cb = along(S_PT[2] + 9.3, HALF - 6.4); add(new T.BoxGeometry(1.35, 1.5, 0.9), std({ color: 0x3a9c66 }), cb.x, 1.05, cb.y, angDir);
  const vc = along(S_PT[2] - 6, -HALF + 6.2); add(new T.BoxGeometry(1.0, 0.9, 1.8), std({ color: 0xf2c94c }), vc.x, 0.75, vc.y, angDir); add(new T.ConeGeometry(1.4, 0.5, 8, 1, true), std({ color: 0xd9724a, side: T.DoubleSide }), vc.x, 2.5, vc.y);
  add(new T.CylinderGeometry(0.03, 0.03, 2.2, 5), M.metal, vc.x, 1.4, vc.y, 0, false); }
// P1 · bancas bajo los árboles de la puerta sur
{ const bb = []; for (let i = -2; i <= 2; i++) [-1, 1].forEach(sd => bb.push(along(S_PT[1] - 10 + i * 4.5, sd * (HALF - 6.2))));
  instanced(new T.BoxGeometry(0.6, 0.45, 2.0), M.timber, bb, (o, v) => { o.position.set(v.x, 0.35, v.y); o.rotation.y = angDir; }); }
// P7 · higuerón gigante con raíces aéreas y parque infantil de madera natural sobre una franja verde
const a7 = Math.atan2(P[7][1], P[7][0]);
flat(new T.RingGeometry(R_PARK + 1, R_RING - 2.5, 40, 1, -(a7 + 0.32), 0.64), texRepeat(M.grass, 6, 2), 0.125);
{
  const pg = ringXZ(a7 - 0.1, R_PARK + 7.5), wood = std({ color: 0xb28a5c, roughness: 0.9 });
  flat(new T.CircleGeometry(6.5, 40), std({ color: 0xc9a06e, roughness: 1 }), 0.14, pg.x, pg.y);
  for (let i = 0; i < 4; i++) { const lg = add(new T.CylinderGeometry(0.28, 0.28, 4.2, 8), wood, pg.x - 3 + i * 1.6, 0.45 + (i % 2) * 0.3, pg.y + R(-2, 2)); lg.rotation.z = Math.PI / 2; lg.rotation.y = R(-0.6, 0.6); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(new T.CylinderGeometry(0.35, 0.38, 0.35 + (i % 3) * 0.25, 9), wood, pg.x + Math.cos(a) * 4.8, 0.3, pg.y + Math.sin(a) * 4.8); }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => add(new T.CylinderGeometry(0.16, 0.18, 3.4, 7), wood, pg.x + u * 1.4 + 2, 1.8, pg.y + v * 1.4));
  add(new T.BoxGeometry(3.2, 0.2, 3.2), wood, pg.x + 2, 2.1, pg.y); const sl = add(new T.BoxGeometry(0.9, 0.08, 3.6), std({ color: 0x5aa84f }), pg.x + 2, 1.15, pg.y + 3.0); sl.rotation.x = 0.55; }
// P6 · árboles de sombra en materas grandes y parqueo de motos al fondo, fuera del anillo
const a6 = Math.atan2(P[6][1], P[6][0]);
{ const pts = []; for (let i = -3; i <= 3; i++) if (i) pts.push(ringXZ(a6 + i * 0.11, R_RING - 3.2));
  instanced(new T.BoxGeometry(2.4, 0.95, 2.4), M.timber, pts, (o, v) => o.position.set(v.x, 0.6, v.y));
  instanced(new T.CylinderGeometry(0.18, 0.25, 3.4, 6), M.trunk, pts, (o, v) => o.position.set(v.x, 2.6, v.y));
  instanced(crownGeo, M.leaf, pts, (o, v, i) => { o.position.set(v.x, 5, v.y); o.scale.set(2.6, 1.9, 2.6); o.rotation.y = i; }, { color: (v, i) => new T.Color([0x4a8a3c, 0x6fa64e, 0x568f40][i % 3]) });
  const mp = [], base = ringXZ(a6 - 0.62, R_RING + 3); for (let i = 0; i < 12; i++) mp.push(ringXZ(a6 - 0.68 + i * 0.012, R_RING + 3.2));
  flat(new T.RingGeometry(R_RING + 1.5, R_RING + 5, 12, 1, -(a6 - 0.55), 0.17), std({ color: 0x9fa4a8 }), 0.13);
  instanced(new T.BoxGeometry(0.42, 0.9, 1.8), std({ color: 0xffffff, roughness: 0.5 }), mp, (o, v) => { o.position.set(v.x, 0.6, v.y); o.rotation.y = -(a6 - 0.62); }, { color: (v, i) => new T.Color([0x2b2b2b, 0xa8352e, 0x355a88][i % 3]) }); }

// P2 · bolardos de luz de madera a lado y lado del sendero (render 2)
{ const bl = []; for (let s2 = 40; s2 < LEN - 4; s2 += 3.4) [-1, 1].forEach(k => bl.push(along(s2 + (k > 0 ? 1.7 : 0), pathOff(s2) + k * 1.05)));
  instanced(new T.BoxGeometry(0.16, 0.75, 0.16), M.timber, bl, (o, v) => o.position.set(v.x, 0.95, v.y), { cast: false });
  instanced(new T.BoxGeometry(0.17, 0.1, 0.17), M.lamp, bl, (o, v) => o.position.set(v.x, 1.25, v.y), { cast: false }); }
// P3 · poste inteligente con anillo verde y pantalla (render 3)
{ const sp = along(S_PT[3] - 6, HALF - 3.4); add(new T.CylinderGeometry(0.11, 0.14, 6.4, 10), M.rail, sp.x, 3.2, sp.y);
  const ring = add(new T.TorusGeometry(0.32, 0.06, 8, 24), std({ color: 0x3fd07a, emissive: 0x3fd07a, emissiveIntensity: 1.6 }), sp.x, 6.0, sp.y, angDir, false); ring.rotation.x = 0;
  add(new T.BoxGeometry(0.42, 0.62, 0.08), std({ color: 0x1e3a5a, emissive: 0x2f6fb0, emissiveIntensity: 0.9 }), sp.x, 3.4, sp.y, angDir, false); }
// P6 · materas de concreto con bambú y piso gris claro (render 6)
flat(new T.RingGeometry(R_PARK + 1, R_RING, 48, 1, -(a6 + 0.5), 1.0), texRepeat(M.pavers2, 8, 2), 0.124);
{ const bp = []; [-0.42, -0.3, 0.3, 0.42].forEach(d => bp.push(ringXZ(a6 + d, R_RING - 2.2)));
  instanced(new T.BoxGeometry(3.4, 0.9, 1.3), std({ color: 0xcfc9bf, roughness: 0.95 }), bp, (o, v) => { o.position.set(v.x, 0.55, v.y); o.rotation.y = -Math.atan2(v.y, v.x) - Math.PI / 2; });
  const canes = []; bp.forEach(v => { const a = Math.atan2(v.y, v.x); for (let i = 0; i < 14; i++) { const t = R(-1.5, 1.5), q = v.clone().add(new T.Vector2(-Math.sin(a), Math.cos(a)).multiplyScalar(t)).add(new T.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(R(-0.4, 0.4))); canes.push([q.x, q.y, R(3, 5)]); } });
  instanced(new T.CylinderGeometry(0.035, 0.045, 1, 5), std({ color: 0x8aa84a }), canes, (o, c) => { o.position.set(c[0], 1 + c[2] / 2, c[1]); o.scale.set(1, c[2], 1); o.rotation.z = R(-0.08, 0.08); }, { cast: false });
  instanced(new T.IcosahedronGeometry(0.6, 0), M.leaf, canes, (o, c, i) => { o.position.set(c[0], 1 + c[2] * R(0.6, 1), c[1]); o.scale.set(1, 1.6, 1); o.rotation.y = i; }, { color: (c, i) => new T.Color([0x5f9d48, 0x7fb257, 0x4d8f3f][i % 3]) }); }
// P7 · columpios, rodadero y torre sobre caucho verde (render 7); los columpios se mecen
const SWINGS = [];
{ const pc = ringXZ(a7 + 0.12, R_PARK + 8), tg = new T.Vector2(-Math.sin(a7), Math.cos(a7)), wood = std({ color: 0xb28a5c, roughness: 0.9 });
  flat(new T.CircleGeometry(7, 40), std({ color: 0x5e8f4f, roughness: 1 }), 0.15, pc.x, pc.y);
  const ry = Math.atan2(-tg.y, tg.x);
  [-1.9, 1.9].forEach(u => { const q = pc.clone().add(tg.clone().multiplyScalar(u)); [-0.8, 0.8].forEach(w => { const leg = add(new T.CylinderGeometry(0.09, 0.11, 2.9, 7), wood, q.x, 1.4, q.y, ry); leg.rotateX(w * 0.32); }); });
  const beam = add(new T.CylinderGeometry(0.1, 0.1, 4.2, 8), wood, pc.x, 2.75, pc.y); beam.rotation.set(0, ry, Math.PI / 2, 'YXZ');
  [-0.9, 0.9].forEach(u => { const q = pc.clone().add(tg.clone().multiplyScalar(u)); const piv = new T.Group(); piv.position.set(q.x, 2.7, q.y); piv.rotation.order = 'YXZ'; piv.rotation.y = ry; scene.add(piv);
    [-0.22, 0.22].forEach(k => { const rope = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 1.9, 4), M.rail); rope.position.set(k, -0.95, 0); piv.add(rope); });
    const seat = new T.Mesh(new T.BoxGeometry(0.55, 0.06, 0.25), std({ color: 0x2b2b2b })); seat.position.y = -1.9; seat.castShadow = true; piv.add(seat);
    SWINGS.push({ piv, ph: rnd() * 6, amp: R(0.45, 0.7) }); });
  const tw = pc.clone().add(tg.clone().multiplyScalar(-4.2)).add(new T.Vector2(Math.cos(a7), Math.sin(a7)).multiplyScalar(2));
  [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([u, v]) => add(new T.BoxGeometry(0.16, 3.2, 0.16), wood, tw.x + u, 1.6, tw.y + v));
  add(new T.BoxGeometry(1.8, 0.14, 1.8), wood, tw.x, 1.6, tw.y); add(new T.ConeGeometry(1.4, 1.0, 4), std({ color: 0xd9724a }), tw.x, 3.6, tw.y, Math.PI / 4);
  const sl2 = add(new T.BoxGeometry(0.7, 0.08, 3.2), std({ color: 0xf2c94c }), tw.x, 0.85, tw.y + 2.3); sl2.rotation.x = 0.5; }
// AO de contacto del mobiliario de la propuesta
{ const inPark = v => Math.hypot(v.x, v.y) < R_PARK ? 0.47 : 0.172, L2 = [];
  terr.forEach(v => L2.push([v.x, v.y, 3.0, 3.0, 0, inPark(v)]));
  planters.forEach(v => L2.push([v.x, v.y, 2.6, 2.6, 0, inPark(v)]));
  spineBench.forEach(([v]) => L2.push([v.x, v.y, 1.6, 3.0, angDir, 0.172]));
  lamps.forEach(v => L2.push([v.x, v.y, 1.2, 1.2, 0, inPark(v)]));
  aoLayer(L2, aoBlobTex, 0.5, 0.172); }
/* ============ DEL DOCUMENTO "PARQUE DEL PERRO 24/7": tránsito controlado, islas de residuos, polinizadores ============ */
// "No se elimina el tránsito: se reorganiza priorizando al peatón" → carril de servicio compartido a 10 km/h (residentes, carga en horario fijo, emergencias)
const SERVICE_O = 5.1;
{ const edge = std({ color: 0xd9d3c4, roughness: 0.9 }), segs = [];
  [-1, 1].forEach(sd => [-1.35, 1.35].forEach(k => { for (let s2 = 2; s2 < LEN - 2; s2 += 2) segs.push([along(s2, sd * SERVICE_O + k), along(s2 + 2, sd * SERVICE_O + k), 0.09]); }));
  add(ribbon(segs, 0.145), edge, 0, 0, 0, 0, false, true);
  // pictogramas de 10 km/h y bici cada 40 m
  const pic = canvasTex(128, 128, (g, w) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, w); g.strokeStyle = '#f4f1ea'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 50, 0, 6.3); g.stroke(); g.fillStyle = '#f4f1ea'; g.font = 'bold 46px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('10', 64, 66); });
  const pm = new T.MeshBasicMaterial({ map: pic, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  [-1, 1].forEach(sd => { for (let s2 = 20; s2 < LEN - 10; s2 += 40) { const v = along(s2, sd * SERVICE_O); flat(new T.PlaneGeometry(1.6, 1.6), pm, 0.15, v.x, v.y, angDir + (sd > 0 ? Math.PI : 0)); } });
  // letreros de horario de carga en las bahías
  const sign = canvasTex(128, 192, (g, w, h) => { g.fillStyle = '#1e3a5a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 22px Inter, Arial'; g.textAlign = 'center'; g.fillText('CARGA', 64, 40); g.font = 'bold 30px Inter, Arial'; g.fillText('5–9 a.m.', 64, 86); g.font = '18px Inter, Arial'; g.fillText('Residentes', 64, 128); g.fillText('Emergencias', 64, 154); });
  [[S_PT[2] + 8, 1], [S_PT[1] - 30, -1], [S_PT[3] + 30, 1]].forEach(([s2, sd]) => { const v = along(s2, sd * (HALF - 6.4)); add(new T.CylinderGeometry(0.04, 0.04, 2.4, 6), M.metal, v.x, 1.2, v.y, 0, false); add(new T.BoxGeometry(0.5, 0.75, 0.03), std({ map: sign, roughness: 0.6 }), v.x, 2.2, v.y, angDir + (sd > 0 ? -Math.PI / 2 : Math.PI / 2), false); });
}
// vehículos de servicio circulando lento por el carril compartido
const SERV = [{ s: 30, sd: 1, v: 2.8, kind: 0 }, { s: 180, sd: -1, v: 2.6, kind: 1 }, { s: 250, sd: 1, v: 3.0, kind: 2 }];
const servBody = new T.InstancedMesh(new T.BoxGeometry(1.6, 1.7, 3.6), std({ color: 0xffffff, roughness: 0.4, metalness: 0.2 }), SERV.length), servCab = new T.InstancedMesh(new T.BoxGeometry(1.5, 0.7, 0.9), std({ color: 0x1e2628, roughness: 0.15, metalness: 0.5 }), SERV.length);
SERV.forEach((c, i) => servBody.setColorAt(i, new T.Color([0xf4f3ee, 0x3a9c66, 0xf2f2f2][c.kind])));
servBody.castShadow = true; servBody.frustumCulled = servCab.frustumCulled = false; scene.add(servBody, servCab);
function moveService(dt) {
  SERV.forEach((c, i) => { c.s += c.v * dt * c.sd; if (c.s > LEN - 4) c.s = 4; if (c.s < 4) c.s = LEN - 4; const v = along(c.s, c.sd * SERVICE_O), ry = angDir + (c.sd > 0 ? 0 : Math.PI);
    tmp.rotation.set(0, ry, 0); tmp.scale.set(1, 1, 1); tmp.position.set(v.x, 1.05, v.y); tmp.updateMatrix(); servBody.setMatrixAt(i, tmp.matrix);
    const f = DIR.clone().multiplyScalar(1.4 * c.sd); tmp.position.set(v.x + f.x, 1.4, v.y + f.y); tmp.updateMatrix(); servCab.setMatrixAt(i, tmp.matrix); });
  servBody.instanceMatrix.needsUpdate = servCab.instanceMatrix.needsUpdate = true;
}
/* ============ SISTEMAS DENTRO DEL MODELO: tránsito, residuos, agua y biodiversidad construidos en 3D ============ */
// letreros interpretativos (texto en canvas)
function signTex(title, lines, col) { return canvasTex(256, 320, (g, w, h) => {
  g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, w, h); g.fillStyle = col; g.fillRect(0, 0, w, 74);
  g.fillStyle = '#fff'; g.font = 'bold 30px Inter, Arial'; g.textAlign = 'left'; g.fillText(title, 16, 48);
  g.fillStyle = '#1c2a22'; g.font = '21px Inter, Arial'; lines.forEach((l, i) => g.fillText(l, 16, 116 + i * 32)); }); }
function panel(v, ry, tex, h = 1.9) { const g = add(new T.CylinderGeometry(0.05, 0.05, h, 6), M.rail, v.x, h / 2, v.y, 0, false);
  const p = add(new T.BoxGeometry(0.8, 1.0, 0.04), std({ map: tex, roughness: 0.7 }), v.x, h - 0.15, v.y, ry, false); return p; }
// --- 1 · TRÁNSITO CONTROLADO: cruces elevados, bolardos retráctiles y señal 10 km/h en cada bocacalle real ---
const CROSS = [];
roadRuns.forEach(r => [r.pts[0], r.pts[r.pts.length - 1]].forEach(v => { const d = v.clone().sub(A), s2 = d.dot(DIR), o = Math.abs(d.dot(NOR));
  if (s2 > 4 && s2 < LEN + 6 && o < HALF + 9 && !CROSS.some(c => Math.abs(c.s - s2) < 14)) CROSS.push({ s: Math.min(LEN - 2, s2), sd: Math.sign(d.dot(NOR)) || 1 }); }));
const zonaTex = canvasTex(128, 192, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#245c3d'; g.fillRect(6, 6, w - 12, h - 12); g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = 'bold 18px Inter, Arial'; g.fillText('PRIORIDAD', 64, 40); g.fillText('PEATONAL', 64, 62); g.beginPath(); g.arc(64, 112, 34, 0, 6.3); g.fill(); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(64, 112, 34, 0, 6.3); g.lineWidth = 7; g.strokeStyle = '#c0392b'; g.stroke();
  g.fillStyle = '#111'; g.font = 'bold 34px Inter, Arial'; g.fillText('10', 64, 124); g.fillStyle = '#fff'; g.font = '15px Inter, Arial'; g.fillText('Residentes · Carga', 64, 168); g.fillText('5–9 a.m.', 64, 184); });
CROSS.forEach(c => {
  const m = along(c.s, 0); // plataforma: banda táctil + cambio de piso a lo ancho
  flat(new T.PlaneGeometry(HALF * 2 - 0.6, 4.2), texRepeat(M.stone, 6, 1), 0.16, m.x, m.y, angDir + Math.PI / 2);
  [-1.9, 1.9].forEach(k => { const t = along(c.s + k, 0); flat(new T.PlaneGeometry(HALF * 2 - 0.6, 0.5), M.tactile, 0.17, t.x, t.y, angDir + Math.PI / 2); });
  for (let o = -HALF + 1.4; o <= HALF - 1.4; o += 1.5) { const b = along(c.s + 2.6, o); add(new T.CylinderGeometry(0.11, 0.13, 0.85, 10), M.metal, b.x, 0.55, b.y, 0, true); add(new T.CylinderGeometry(0.115, 0.115, 0.06, 10), std({ color: 0xe3b23c }), b.x, 0.85, b.y, 0, false); }
  [-1, 1].forEach(sd => { const sv = along(c.s + 3.5, sd * (HALF - 0.8)); panel(sv, angDir + (sd > 0 ? Math.PI : 0) + Math.PI, zonaTex, 2.6); });
});
// --- 2 · RESIDUOS: puntos limpios con contenedores soterrados (buzones en superficie, tanque bajo el piso) ---
const limpioTex = signTex('Punto limpio', ['Blanco: aprovechables', 'Negro: no aprovechables', 'Verde: orgánicos', 'Tanque soterrado', '3.200–6.400 L'], '#3f8f46');
// --- 3 · AGUA: jardines de lluvia hundidos con rejillas, entradas de agua, piedra de río y letrero ---
const aguaTex = signTex('Jardín de lluvia', ['El agua del piso entra', 'por las rejillas, se filtra', 'en las plantas y se', 'infiltra en el suelo.', 'Hasta 30 cm de lámina.'], '#1e5d8c');
{ const grate = std({ color: 0x3a3d40, metalness: 0.6, roughness: 0.5, map: canvasTex(32, 128, (g, w, h) => { g.fillStyle = '#2a2c2e'; g.fillRect(0, 0, w, h); g.fillStyle = '#6b6f73'; for (let y = 2; y < h; y += 6) g.fillRect(3, y, w - 6, 2); }) });
  const pebbles = [];
  [-1, 1].forEach(sd => { for (let s2 = 40; s2 < LEN - 12; s2 += 26) {
    [2, 8, 14].forEach(k => { const a = along(s2 + k, sd * (HALF - 0.9)), b = along(s2 + k, sd * (HALF - 4.0)), c = a.clone().add(b).multiplyScalar(0.5); flat(new T.PlaneGeometry(0.32, a.distanceTo(b)), grate, 0.145, c.x, c.y, angDir + Math.PI / 2); });
    for (let q = 0; q < 26; q++) { const v = along(s2 + 1 + q * 0.55, sd * (HALF - 5.2) + (q % 2 ? 0.75 : -0.75) + R(-0.15, 0.15)); pebbles.push([v.x, v.y, R(0.12, 0.24)]); }
    if (((s2 - 40) / 26) % 2 === 0) panel(along(s2 - 1, sd * (HALF - 6.9)), angDir + (sd > 0 ? -Math.PI / 2 : Math.PI / 2), aguaTex); } });
  instanced(new T.IcosahedronGeometry(1, 0), std({ color: 0xc9c2b4, roughness: 0.8 }), pebbles, (o, p) => { o.position.set(p[0], 0.4, p[1]); o.scale.set(p[2], p[2] * 0.55, p[2]); o.rotation.y = p[2] * 40; }, { cast: false, color: (p, i) => new T.Color([0xc9c2b4, 0xa59d90, 0xe0d9cc][i % 3]) }); }
// --- 4 · BIODIVERSIDAD: jardín de polinizadores con hotel de insectos, meliponario, casas de aves y compostaje ---
const BIO_C = ringXZ(0.78, 33);
const polTex = signTex('Polinizadores', ['Lantana, salvia, asclepias', 'y heliconias nativas.', 'Hotel de insectos y', 'meliponario (abejas', 'sin aguijón).'], '#d4692c');
{ const c = BIO_C;
  flat(new T.CircleGeometry(8.5, 40), std({ color: 0x8a6a48, roughness: 1 }), 0.46, c.x, c.y);
  const fl = []; for (let i = 0; i < 520; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 8; fl.push([c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, i]); }
  instanced(new T.IcosahedronGeometry(0.12, 0), std({ color: 0xffffff }), fl, (o, f) => { o.position.set(f[0], 0.62 + rnd() * 0.25, f[1]); o.scale.setScalar(R(0.7, 1.4)); }, { cast: false, color: (f, i) => new T.Color([0xf08a24, 0xe94b6a, 0x8b5cf6, 0xf2c94c, 0xd8342b, 0x4d8f3f, 0x3f7f3a, 0xf7f3ea][i % 8]) });
  instanced(new T.IcosahedronGeometry(0.45, 0), M.leaf, fl.filter((f, i) => i % 3 === 0), (o, f) => o.position.set(f[0] + 0.2, 0.55, f[1]), { cast: false, color: () => new T.Color(0x4d8f3f) });
  // hotel de insectos: marco de madera con celdas de troncos, cañas y ladrillo perforado
  const hotelTex = canvasTex(128, 192, (g, w, h) => { g.fillStyle = '#7a5434'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 46) for (let x = 8; x < w - 8; x += 58) { g.fillStyle = ['#c9a37a', '#a0522d', '#d8c39a'][(x + y) % 3]; g.fillRect(x, y, 52, 40);
      g.fillStyle = '#2a1c12'; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(x + 6 + (k % 5) * 10, y + 7 + ((k / 5) | 0) * 12, 3, 0, 6.3); g.fill(); } } });
  const ho = ringXZ(0.78, 26.5); add(new T.BoxGeometry(1.6, 2.2, 0.5), std({ map: hotelTex, roughness: 0.9 }), ho.x, 1.6, ho.y, -0.78 - Math.PI / 2);
  add(new T.ConeGeometry(1.35, 0.6, 4), M.roofTile, ho.x, 3.0, ho.y, -0.78 - Math.PI / 2 + Math.PI / 4); [-0.6, 0.6].forEach(k => { const t = ho.clone().add(new T.Vector2(-Math.sin(0.78), Math.cos(0.78)).multiplyScalar(k)); add(new T.BoxGeometry(0.12, 0.6, 0.12), M.timber, t.x, 0.3, t.y); });
  // meliponario: cajas de madera sobre postes bajo techo
  const me = ringXZ(0.98, 37); add(new T.BoxGeometry(2.6, 0.12, 1.2), M.roofTile, me.x, 2.0, me.y, -0.98); [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]].forEach(([u, v]) => add(new T.BoxGeometry(0.1, 2.0, 0.1), M.timber, me.x + u * Math.cos(-0.98) + v * Math.sin(-0.98), 1.0, me.y - u * Math.sin(-0.98) + v * Math.cos(-0.98), 0, false));
  [-0.7, 0, 0.7].forEach(u => add(new T.BoxGeometry(0.5, 0.35, 0.4), std({ color: 0xc9a37a }), me.x + u * Math.cos(-0.98), 1.1, me.y - u * Math.sin(-0.98), -0.98));
  panel(ringXZ(0.6, 25.5), -0.6 + Math.PI / 2, polTex);
  // compostaje alimentado por las islas orgánicas
  const cp = ringXZ(1.25, 39); const compTex = signTex('Compostaje', ['Los orgánicos de los', 'restaurantes vuelven', 'como abono para los', 'jardines del parque.'], '#245c3d');
  [-1.3, 0, 1.3].forEach((u, i) => { const v = cp.clone().add(new T.Vector2(-Math.sin(1.25), Math.cos(1.25)).multiplyScalar(u)); add(new T.BoxGeometry(1.2, 1.0, 1.2), M.timber, v.x, 0.55, v.y, -1.25); flat(new T.PlaneGeometry(1.05, 1.05), std({ color: [0x5a3e26, 0x6b4a2b, 0x4a3420][i] }), 1.06, v.x, v.y, -1.25); });
  panel(ringXZ(1.25, 35.5), -1.25 + Math.PI / 2, compTex);
  // casas de aves en los árboles del parque
  const bh = []; trees.filter(t => Math.hypot(t[0], t[1]) < R_PARK).slice(0, 14).forEach(t => bh.push([t[0] + 0.5 * t[2], t[1], 3.6 * t[2]]));
  instanced(new T.BoxGeometry(0.35, 0.45, 0.35), M.timber, bh, (o, b) => o.position.set(b[0], b[2], b[1]));
  instanced(new T.ConeGeometry(0.32, 0.22, 4), M.roofTile, bh, (o, b) => { o.position.set(b[0], b[2] + 0.33, b[1]); o.rotation.y = Math.PI / 4; }, { cast: false }); }
// colibríes que visitan las heliconias
const NHB = isMobile ? 6 : 14, HB = [];
{ const src = helis.length ? helis : [[BIO_C.x, BIO_C.y]]; for (let i = 0; i < NHB; i++) { const h = i < 5 ? [BIO_C.x + R(-5, 5), BIO_C.y + R(-5, 5)] : src[(rnd() * src.length) | 0]; HB.push({ x: h[0], z: h[1], ph: rnd() * 6, t: rnd() * 4 }); } }
const hbBody = new T.InstancedMesh(new T.CapsuleGeometry(0.035, 0.12, 2, 6).rotateX(Math.PI / 2), std({ color: 0x1f8a5a, metalness: 0.5, roughness: 0.3 }), NHB);
const hbWing = new T.InstancedMesh(new T.PlaneGeometry(0.16, 0.05).translate(0.08, 0, 0).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x2c3a32, side: T.DoubleSide, transparent: true, opacity: 0.6 }), NHB * 2);
hbBody.frustumCulled = hbWing.frustumCulled = false; scene.add(hbBody, hbWing);
function moveHummingbirds(dt, tt) { const big = LAYERS.bio ? 3 : 1.4;
  HB.forEach((b, i) => { b.t += dt; const hop = Math.floor(b.t / 2.2), k = (b.t % 2.2) / 2.2, ang = hop * 2.4 + b.ph, ang2 = (hop + 1) * 2.4 + b.ph;
    const p0 = [b.x + Math.cos(ang) * 1.2, b.z + Math.sin(ang) * 1.2], p1 = [b.x + Math.cos(ang2) * 1.2, b.z + Math.sin(ang2) * 1.2], m = k < 0.7 ? 0 : (k - 0.7) / 0.3, s = m * m * (3 - 2 * m);
    const x = p0[0] + (p1[0] - p0[0]) * s, z = p0[1] + (p1[1] - p0[1]) * s, y = 1.3 + Math.sin(tt * 5 + b.ph) * 0.06 + Math.sin(s * Math.PI) * 0.4, ry = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    _e.set(0, ry, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(big, big, big); _bq.compose(_p, _q, _s); hbBody.setMatrixAt(i, _bq);
    [-1, 1].forEach((sg, j) => { _s.set(big * sg, big, big); _bq.compose(_p, _q, _s); _bw.makeRotationZ(Math.sin(tt * 60 + b.ph) * 1.1 * sg); _bq.multiply(_bw); hbWing.setMatrixAt(i * 2 + j, _bq); }); });
  hbBody.instanceMatrix.needsUpdate = hbWing.instanceMatrix.needsUpdate = true; }

// islas de residuos con el código de colores nacional (Res. 2184 de 2019): blanco aprovechables, negro no aprovechables, verde orgánicos
const ISLAS = [];
for (let s2 = 30; s2 < LEN; s2 += 55) ISLAS.push({ v: along(s2, (s2 % 110 < 55 ? 1 : -1) * (HALF - 2.2)), ry: angDir });
[0.9, 1.98, -0.6, -2.1, -3.6].forEach(a => ISLAS.push({ v: ringXZ(a, R_RING - 1.6), ry: -a - Math.PI / 2 }));
{ const cols = [0xf4f4f0, 0x222222, 0x3f8f46], bins = [];
  ISLAS.forEach(is => cols.forEach((c, k) => { const t = new T.Vector2(Math.cos(is.ry), -Math.sin(is.ry)); bins.push([is.v.x + t.x * (k - 1) * 0.72, is.v.y + t.y * (k - 1) * 0.72, is.ry, c]); }));
  instanced(new T.CylinderGeometry(0.3, 0.34, 1.1, 18), std({ color: 0xffffff, roughness: 0.45, metalness: 0.2 }), bins, (o, b) => { o.position.set(b[0], 0.7, b[1]); o.rotation.y = b[2]; }, { color: b => new T.Color(b[3]) });
  instanced(new T.SphereGeometry(0.33, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.metal, bins, (o, b) => { o.position.set(b[0], 1.25, b[1]); o.scale.set(1, 0.45, 1); }, { cast: false });
  instanced(new T.BoxGeometry(0.26, 0.07, 0.04), std({ color: 0x111111 }), bins, (o, b) => { o.position.set(b[0] + Math.sin(b[2]) * 0.31, 1.05, b[1] + Math.cos(b[2]) * 0.31); o.rotation.y = b[2]; }, { cast: false });
  // plataforma de acero sobre el tanque soterrado (anillo de juntas)
  ISLAS.forEach(is => { flat(new T.PlaneGeometry(2.9, 1.3), std({ color: 0x7d8286, metalness: 0.6, roughness: 0.4, map: canvasTex(64, 32, (g, w, h) => { g.fillStyle = '#7d8286'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4d5256'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4); for (let x = 8; x < w; x += 8) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x - 4, h - 4); g.stroke(); } }) }), 0.17, is.v.x, is.v.y, is.ry); });
  ISLAS.forEach(is => { const bk = new T.Vector2(Math.sin(is.ry), Math.cos(is.ry)).multiplyScalar(-0.55); add(new T.BoxGeometry(2.6, 1.7, 0.06), M.timber, is.v.x + bk.x, 0.95, is.v.y + bk.y, is.ry, false);
    add(new T.BoxGeometry(0.9, 1.12, 0.02), std({ map: limpioTex, roughness: 0.7 }), is.v.x + bk.x * 0.93 + Math.cos(is.ry) * 0.7, 1.2, is.v.y + bk.y * 0.93 - Math.sin(is.ry) * 0.7, is.ry, false); }); }
// polinizadores: mariposas que revolotean sobre heliconias y jardines (biología del documento)
const NBF = isMobile ? 30 : 70, FLY = [];
{ const src = helis.length ? helis : shrubs.map(s => [s[0], s[2]]); for (let i = 0; i < NBF; i++) { const h = src[(rnd() * src.length) | 0]; FLY.push({ cx: h[0], cz: h[1], r: R(0.4, 1.6), a: rnd() * 6.28, w: R(0.8, 1.8) * (rnd() < 0.5 ? -1 : 1), h: R(0.8, 1.9), ph: rnd() * 6, c: [0xf08a24, 0xf2c94c, 0x3f7fd6, 0xffffff, 0xe94b6a][i % 5] }); } }
const wingG = new T.PlaneGeometry(0.14, 0.11); wingG.translate(0.07, 0, 0); wingG.rotateX(-Math.PI / 2);
const wingMat = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide });
const wingL = new T.InstancedMesh(wingG, wingMat, NBF), wingR = new T.InstancedMesh(wingG, wingMat, NBF);
FLY.forEach((f, i) => { wingL.setColorAt(i, new T.Color(f.c)); wingR.setColorAt(i, new T.Color(f.c)); });
wingL.frustumCulled = wingR.frustumCulled = false; scene.add(wingL, wingR);
const _bq = new T.Matrix4(), _bw = new T.Matrix4();
function moveButterflies(dt, tt) {
  const big = LAYERS.bio ? 2.4 : 1;
  FLY.forEach((f, i) => { f.a += f.w * dt; const x = f.cx + Math.cos(f.a) * f.r + Math.sin(tt * 2.3 + f.ph) * 0.3, z = f.cz + Math.sin(f.a) * f.r, y = f.h + Math.sin(tt * 3.1 + f.ph) * 0.25;
    const ry = Math.atan2(-Math.sin(f.a), Math.cos(f.a)) * Math.sign(f.w), flap = Math.sin(tt * 22 + f.ph) * 0.9;
    [[wingL, -1], [wingR, 1]].forEach(([im, s]) => { _e.set(0, ry, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(big * s, big, big); _bq.compose(_p, _q, _s); _bw.makeRotationZ(flap * s); _bq.multiply(_bw); im.setMatrixAt(i, _bq); }); });
  wingL.instanceMatrix.needsUpdate = wingR.instanceMatrix.needsUpdate = true;
}

// ciclistas en ambos sentidos del bulevar
const NB = isMobile ? 8 : 14, bikes = [];
for (let i = 0; i < NB; i++) bikes.push({ s: rnd() * LEN, sd: i % 2 ? 1 : -1, v: R(3.5, 5.2), ph: rnd() * 6 });
const bikeWheel = new T.TorusGeometry(0.34, 0.04, 5, 14); bikeWheel.rotateY(Math.PI / 2);
const bikeW = new T.InstancedMesh(bikeWheel, M.rail, NB * 2), bikeF = new T.InstancedMesh(new T.BoxGeometry(0.05, 0.06, 1.0), std({ color: 0xffffff, metalness: 0.4, roughness: 0.4 }), NB);
bikes.forEach((b, i) => bikeF.setColorAt(i, new T.Color([0x2f6fb0, 0xd9472b, 0x2b2b2b, 0x3e8e5e, 0xf2c94c][i % 5])));
bikeW.castShadow = bikeF.castShadow = true; bikeW.frustumCulled = bikeF.frustumCulled = false; scene.add(bikeW, bikeF);
function moveBikes(dt) {
  bikes.forEach((b, i) => {
    b.s += b.v * dt * b.sd; if (b.s > LEN) b.s = 0; if (b.s < 0) b.s = LEN;
    const v = along(b.s, b.sd * 5.6), ry = angDir + (b.sd > 0 ? 0 : Math.PI), f = DIR.clone().multiplyScalar(b.sd * 0.55);
    tmp.rotation.set(0, ry, 0); tmp.scale.set(1, 1, 1);
    [1, -1].forEach((k, j) => { tmp.position.set(v.x + f.x * k, 0.46, v.y + f.y * k); tmp.updateMatrix(); bikeW.setMatrixAt(i * 2 + j, tmp.matrix); });
    tmp.position.set(v.x, 0.72, v.y); tmp.updateMatrix(); bikeF.setMatrixAt(i, tmp.matrix);
  });
  bikeW.instanceMatrix.needsUpdate = bikeF.instanceMatrix.needsUpdate = true;
}

PROP.push(...scene.children.slice(_mk));
// P7 · el higuerón existe hoy: se queda en ambas capas
{ const f = ringXZ(a7 + 0.12, R_PARK - 3.5), bark = std({ color: 0x8b7a66, roughness: 1 });
  add(new T.CylinderGeometry(1.3, 2.2, 8, 12), bark, f.x, 4, f.y);
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2 + R(-0.2, 0.2), r = R(2.4, 4.6), hh = R(7, 10.5); const rt = add(new T.CylinderGeometry(0.05, 0.11, hh, 5), std({ color: 0x6f5f4e, roughness: 1 }), f.x + Math.cos(a) * r, hh / 2, f.y + Math.sin(a) * r, 0); rt.rotation.z = R(-0.08, 0.08); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const br = add(new T.CylinderGeometry(0.35, 0.6, 7, 7), bark, f.x + Math.cos(a) * 2.6, 9.5, f.y + Math.sin(a) * 2.6); br.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); }
  [[0, 0, 11, 13], [6, 3, 8, 12], [-6, -2, 8.5, 12.5], [2, -6, 7.5, 13.5], [-3, 6, 7, 12]].forEach(([dx, dz, r, y], i) => { const c = add(crownGeo, std({ color: [0x3f7a36, 0x4a8a3c, 0x568f40][i % 3], roughness: 0.9 }), f.x + dx, y, f.y + dz); c.scale.set(r, r * 0.42, r); });
}
/* ============ PERSONAS ARTICULADAS (como en los renders) ============ */
// cuerpo de 7 piezas: piernas y brazos que oscilan al caminar, torso, cabeza y pelo; niños a escala 0,62
const FQ = isMobile ? 0.55 : 1;
const SHIRT = [0xf2f0ea, 0x9cc3e0, 0x2b3d5c, 0xe0785a, 0xe3b54a, 0x6d7a45, 0x2a2a2a, 0xe79ab0, 0x4f9a6a, 0xa3a3a3, 0xc0392b, 0xffffff, 0x7a5aa6];
const PANTS = [0x3d5a80, 0x2a3550, 0xc8b48a, 0x222222, 0xe8e4da, 0x6f6f6f, 0x3d5a80, 0x55402e];
const SKIN = [0xf1c7a0, 0xdeb08a, 0xc68c64, 0xa5714d, 0x7a5236], HAIR = [0x1e1712, 0x2e2018, 0x4a3122, 0x6b4a2b, 0x151515, 0x8a6a4a];
const people = [];
const pick = a => a[(rnd() * a.length) | 0];
function person(o) { const p = Object.assign({ kid: false, sc: R(0.93, 1.03), ph: rnd() * 6, vis: undefined, prop: true, mode: 'walk', v: 0, longHair: rnd() < 0.45, sleeve: rnd() < 0.55 }, o); p.shirt = pick(SHIRT); p.pants = pick(PANTS); p.skin = pick(SKIN); p.hair = pick(HAIR); if (p.kid) p.sc = R(0.55, 0.68); people.push(p); return p; }
const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
// 1 · paseantes del bulevar: andenes (visibles también hoy) y centro (solo propuesta)
for (let i = 0; i < 170 * FQ; i++) { const side = rnd() < 0.42, sd = rnd() < 0.5 ? -1 : 1;
  person({ path: 'corr', s: R(0, LEN), o: sd * (side ? R(9.3, 11.8) : R(4.2, 8.4)), v: (rnd() < 0.5 ? -1 : 1) * R(1.0, 1.45), prop: !side, bag: rnd() < 0.25, stroller: !side && rnd() < 0.06 }); }
// 2 · anillo: paseantes y algunos trotando
for (let i = 0; i < 110 * FQ; i++) { const jog = i % 18 === 0; person({ path: 'ring', a: rnd() * 6.283, r: R(R_PARK + 2, R_RING - 5), v: (rnd() < 0.5 ? -1 : 1) * (jog ? R(2.4, 2.9) : R(1.0, 1.4)), jog, bag: rnd() < 0.15, stroller: !jog && rnd() < 0.05 }); }
// 3 · comensales en las terrazas
terr.forEach(t => { for (let q = 0; q < 3; q++) { if (rnd() > 0.55) continue; const a = q / 3 * Math.PI * 2, x = t.x + Math.cos(a) * 0.95, z = t.y + Math.sin(a) * 0.95;
  person({ mode: 'sit', x, z, ry: faceTo(x, z, t.x, t.y), talk: rnd() < 0.6 }); } });
// 4 · bancas del eje verde, de la puerta sur y de la plaza de Teddy
spineBench.forEach(([v, sd]) => { if (rnd() < 0.5) return; const f = NOR.clone().multiplyScalar(sd); person({ mode: 'sit', x: v.x + f.x * 0.1, z: v.y + f.y * 0.1, ry: Math.atan2(f.x, f.y), seat: 0.55 }); });
for (let i = -2; i <= 2; i++) [-1, 1].forEach(sd => { if (rnd() < 0.45) return; const v = along(S_PT[1] - 10 + i * 4.5, sd * (HALF - 6.2)); const f = NOR.clone().multiplyScalar(-sd); person({ mode: 'sit', x: v.x, z: v.y, ry: Math.atan2(f.x, f.y), seat: 0.42 }); });
[[0.35, 1.25], [2.45, 1.25], [4.55, 1.2]].forEach(([a0, len]) => { for (let k = 0; k < 3; k++) { if (rnd() < 0.35) continue; const ph = a0 + R(0.1, len - 0.1), x = 8.6 * Math.sin(ph), z = 8.6 * Math.cos(ph); person({ mode: 'sit', x, z, ry: faceTo(x, z, 0, 0), seat: 0.97 }); } });
// 5 · grupos conversando: plaza del corazón, frentes gastronómicos, puesto de flores, anillo
const group = (cx, cz, n) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + R(-0.3, 0.3), x = cx + Math.cos(a) * 0.75, z = cz + Math.sin(a) * 0.75; person({ mode: 'stand', x, z, ry: faceTo(x, z, cx, cz), talk: true, bag: rnd() < 0.3 }); } };
{ const q = along(S_PT[4] + 2, 5.5); group(q.x, q.y, 3); const q2 = along(S_PT[4] - 6, -6); group(q2.x, q2.y, 2); }
for (let s2 = 58; s2 < 128; s2 += 17) [-1, 1].forEach(sd => { if (rnd() < 0.4) return; const q = along(s2 + R(0, 6), sd * (HALF - 2.4)); group(q.x, q.y, 2 + ((rnd() * 2) | 0)); });
for (let u = -2; u <= 2; u += 1.3) { const q = at8(u, -1.0), x = q.x, z = q.y; person({ mode: 'stand', x, z, ry: faceTo(x, z, at8(u, 1).x, at8(u, 1).y), bag: rnd() < 0.5 }); }
{ const q = at8(0.4, 0.7); person({ mode: 'stand', x: q.x, z: q.y, ry: faceTo(q.x, q.y, at8(0.4, -1).x, at8(0.4, -1).y), shirt0: 0x3a9c66 }); }
for (let a = -1.3; a < 0.5; a += 0.42) { const q = ringXZ(a + R(-0.05, 0.05), R_PARK + 3.2); group(q.x, q.y, 2); }
// 6 · niños jugando: plaza del corazón, parque infantil de madera, lóbulo de juegos y plaza de Teddy
const playKids = (cx, cz, n, r) => { for (let k = 0; k < n; k++) person({ kid: true, mode: 'play', cx, cz, a: rnd() * 6.28, r: R(r * 0.4, r), w: (rnd() < 0.5 ? -1 : 1) * R(0.5, 1.1) }); };
{ const q = along(S_PT[4] + 1, -1); playKids(q.x, q.y, 4, 5); }
{ const pc = ringXZ(a7 + 0.12, R_PARK + 8); playKids(pc.x, pc.y, 4, 5); const pg = ringXZ(a7 - 0.1, R_PARK + 7.5); playKids(pg.x, pg.y, 3, 4); }
playKids(-22, 20, 4, 6); playKids(0, 0, 2, 13);
SWINGS.forEach(sw => person({ kid: true, mode: 'swing', sw }));
bikes.forEach(b => person({ mode: 'cycle', b }));
// 7 · meseros entre la fachada y las mesas
for (let i = 0; i < 6 * FQ + 1; i++) { const sd = i % 2 ? 1 : -1, s2 = R(56, 126); person({ mode: 'shuttle', p0: along(s2, sd * (HALF - 1.6)), p1: along(s2 + R(-3, 3), sd * (HALF - 5.6)), t: rnd(), v: R(0.25, 0.4), shirt0: 0xf4f1ea, pants0: 0x222222 }); }
for (let i = 0; i < 4 * FQ; i++) { const a = R(-1.4, 0.4); person({ mode: 'shuttle', p0: ringXZ(a, R_RING - 0.8), p1: ringXZ(a + R(-0.04, 0.04), R_RING - 4.5), t: rnd(), v: R(0.25, 0.4), shirt0: 0x222222, pants0: 0x222222 }); }
people.forEach(p => { if (p.shirt0) p.shirt = p.shirt0; if (p.pants0) p.pants = p.pants0; if (p.mode === 'sit' || p.mode === 'stand') p.bag = p.bag && p.mode === 'stand'; });

// mallas instanciadas
const NPP = people.length;
const gLeg = new T.CapsuleGeometry(0.075, 0.7, 3, 8); gLeg.translate(0, -0.425, 0);
const gArm = new T.CapsuleGeometry(0.048, 0.5, 3, 6); gArm.translate(0, -0.3, 0);
const gTor = new T.CapsuleGeometry(0.17, 0.36, 4, 10); gTor.scale(1.1, 1, 0.68);
const gHead = new T.SphereGeometry(0.11, 12, 10), gHair = new T.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
const mk = (g, n) => { const m = new T.InstancedMesh(g, M.person, Math.max(1, n)); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; };
const legIM = mk(gLeg, NPP * 2), armIM = mk(gArm, NPP * 2), torIM = mk(gTor, NPP), headIM = mk(gHead, NPP), hairIM = mk(gHair, NPP);
const bagP = people.filter(p => p.bag), strP = people.filter(p => p.stroller);
const bagIM = mk(new T.BoxGeometry(0.3, 0.36, 0.12), bagP.length), strIM = mk(new T.BoxGeometry(0.5, 0.42, 0.78), strP.length), strHood = mk(new T.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), strP.length);
bagP.forEach((p, i) => { p.bi = i; bagIM.setColorAt(i, new T.Color(pick([0xf4efe2, 0xc9a27a, 0xe0785a, 0x2f7a55]))); });
strP.forEach((p, i) => { p.si = i; const c = new T.Color(pick([0x2b3d5c, 0x6d7a45, 0x9a9a9a, 0xd98a9a])); strIM.setColorAt(i, c); strHood.setColorAt(i, c); });
const C = new T.Color();
people.forEach((p, i) => {
  legIM.setColorAt(i * 2, C.set(p.pants)); legIM.setColorAt(i * 2 + 1, C.set(p.pants));
  armIM.setColorAt(i * 2, C.set(p.sleeve ? p.skin : p.shirt)); armIM.setColorAt(i * 2 + 1, C.set(p.sleeve ? p.skin : p.shirt));
  torIM.setColorAt(i, C.set(p.shirt)); headIM.setColorAt(i, C.set(p.skin)); hairIM.setColorAt(i, C.set(p.hair));
});
const _b = new T.Matrix4(), _l = new T.Matrix4(), _o = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(0, 0, 0, 'YXZ'), _p = new T.Vector3(), _s = new T.Vector3();
function baseM(x, y, z, ry, sc, rx = 0) { _e.set(rx, ry, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sc, sc, sc); _b.compose(_p, _q, _s); }
function part(im, idx, lx, ly, lz, rx = 0, rz = 0, sy = 1, ry = 0) { _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(lx, ly, lz); _s.set(1, sy, 1); _l.compose(_p, _q, _s); _o.multiplyMatrices(_b, _l); im.setMatrixAt(idx, _o); }

// el Parque del Perro: uno de cada cuatro paseantes va con su perro, y hay perros sueltos en la zona canina
const owners = people.filter(p => p.path && !p.stroller && !p.jog && rnd() < 0.24), NDZ = 7, ND = owners.length + NDZ;
owners.forEach((p, i) => p.dog = i);
const dogBody = new T.CapsuleGeometry(0.15, 0.48, 4, 8); dogBody.rotateX(Math.PI / 2);
const gDogLeg = new T.CapsuleGeometry(0.035, 0.24, 2, 5); gDogLeg.translate(0, -0.155, 0);
const dogB = mk(dogBody, ND), dogHd = mk(new T.BoxGeometry(0.2, 0.2, 0.3), ND), dogLeg = mk(gDogLeg, ND * 4), dogTail = mk(new T.CylinderGeometry(0.025, 0.035, 0.3, 4), ND);
for (let i = 0; i < ND; i++) { const c = new T.Color([0x6b4a2b, 0x2a2420, 0xd8b98a, 0x9a6b3e, 0xf1ece2][i % 5]); dogB.setColorAt(i, c); dogHd.setColorAt(i, c); dogTail.setColorAt(i, c); for (let k = 0; k < 4; k++) dogLeg.setColorAt(i * 4 + k, c); }
const dz = [...Array(NDZ)].map((_, i) => ({ r: R(3, 9), a: rnd() * 6.28, v: R(0.6, 1.4) * (i % 2 ? 1 : -1), ph: rnd() * 6 }));
function setDog(i, x, z, ry, sc, tt, ph, speed = 1) {
  const rd = REAL.dogs && REAL.dogs[i]; if (rd) { rd.o.position.set(x, 0, z); rd.o.rotation.y = ry; rd.o.scale.setScalar(Math.max(0.0001, sc)); rd.o.visible = sc > 0.02;
    const run = speed > 1.6, wk = Math.min(1, speed * 2), k = 0.15; rd.ww = (rd.ww || 0) + ((run ? 0 : wk) - (rd.ww || 0)) * k; rd.wr = (rd.wr || 0) + ((run ? 1 : 0) - (rd.wr || 0)) * k; rd.wsv = (rd.wsv || 0) + ((wk < 0.2 ? 1 : 0) - (rd.wsv || 0)) * k;
    rd.w.setEffectiveWeight(rd.ww); rd.r.setEffectiveWeight(rd.wr); rd.sv.setEffectiveWeight(rd.wsv); rd.w.timeScale = Math.max(0.5, speed * 0.9); return; }
  const f = tt * 9 * speed + ph, hop = Math.abs(Math.sin(f)) * 0.04;
  baseM(x, hop, z, ry, sc);
  part(dogB, i, 0, 0.42, 0); part(dogHd, i, 0, 0.6, 0.42, -0.2); part(dogTail, i, 0, 0.55, -0.42, -0.8 + Math.sin(tt * 14 + ph) * 0.3, Math.sin(tt * 12 + ph) * 0.5);
  [[0.09, 0.26, 0], [-0.09, 0.26, Math.PI], [0.09, -0.24, Math.PI], [-0.09, -0.24, 0]].forEach(([lx, lz, o], k) => part(dogLeg, i * 4 + k, lx, 0.36, lz, Math.sin(f + o) * 0.6 * Math.min(1, speed)));
}
function hiddenAt(p, x, z) {
  if (Math.hypot(x - REV.uC.value.x, z - REV.uC.value.y) < REV.uR.value) return false;
  return p.prop;
}
function pose(i, p, x, y, z, ry, sc, kind, ph, amp, tt, rx = 0) {
  baseM(x, y, z, ry, sc, rx);
  const k = kind;
  if (k === 'sit') {
    const sy = p.seat || 0.47, talk = p.talk ? Math.sin(tt * 2.1 + p.ph) : 0;
    part(legIM, i * 2, 0.1, sy, 0, -1.35, 0, 0.62); part(legIM, i * 2 + 1, -0.1, sy, 0, -1.3, 0, 0.62);
    part(torIM, i, 0, sy + 0.36, -0.04, -0.05 + talk * 0.03);
    part(armIM, i * 2, 0.22, sy + 0.62, 0, -0.75 + (talk > 0.6 ? -0.5 : 0), 0.15); part(armIM, i * 2 + 1, -0.22, sy + 0.62, 0, -0.7, -0.15);
    part(headIM, i, 0, sy + 0.84, 0, 0, 0, 1, talk * 0.25); part(hairIM, i, 0, sy + 0.86, -0.012, -0.25, 0, p.longHair ? 1.25 : 1, talk * 0.25);
    return;
  }
  const s1 = Math.sin(ph), bob = Math.abs(Math.cos(ph)) * 0.035 * amp * 2;
  const hip = 0.9 + bob, leg = s1 * 0.42 * amp, arm = s1 * 0.38 * amp;
  let gL = 0, gR = 0; if (k === 'stand') { const g = p.talk ? Math.sin(tt * 1.7 + p.ph) : 0; gR = g > 0.3 ? -0.6 * g : 0; gL = 0.05 * Math.sin(tt + p.ph); }
  part(legIM, i * 2, 0.1, hip, 0, -leg); part(legIM, i * 2 + 1, -0.1, hip, 0, leg);
  part(torIM, i, 0, hip + 0.36, 0, (p.jog ? 0.18 : 0.04) * amp + (k === 'stand' ? 0 : 0), Math.sin(ph) * 0.03);
  if (p.stroller) { part(armIM, i * 2, 0.2, hip + 0.6, 0, -1.0, 0.05); part(armIM, i * 2 + 1, -0.2, hip + 0.6, 0, -1.0, -0.05); }
  else { part(armIM, i * 2, 0.22, hip + 0.6, 0, arm * (p.jog ? 1.6 : 1) + gR, 0.08 + (p.jog ? 0.1 : 0)); part(armIM, i * 2 + 1, -0.22, hip + 0.6, 0, -arm * (p.jog ? 1.6 : 1) + gL, -0.08); }
  const look = k === 'walk' ? Math.sin(tt * 0.35 + p.ph * 3) * 0.35 : (p.talk ? Math.sin(tt * 0.8 + p.ph) * 0.2 : 0);
  part(headIM, i, 0, hip + 0.82, 0.02, 0, 0, 1, look); part(hairIM, i, 0, hip + 0.845, 0.005, -0.25, 0, p.longHair && !p.kid ? 1.25 : 1, look);
  if (p.bag) part(bagIM, p.bi, -0.3, hip - 0.12, 0, -arm * 0.6);
  if (p.stroller) { part(strIM, p.si, 0, 0.55, 0.78); part(strHood, p.si, 0, 0.76, 0.6, -0.3); }
}
function moveWalkers(dt, tt) {
  people.forEach((p, i) => {
    let x, z, ry = p.ry || 0, y = 0, rx = 0, kind = p.mode === 'sit' ? 'sit' : 'walk', amp = 1, speed = Math.abs(p.v || 0);
    if (p.path === 'corr') { p.s += p.v * dt; if (p.s > LEN + 5) p.s = -5; if (p.s < -5) p.s = LEN + 5; const v = along(p.s, p.o); x = v.x; z = v.y; ry = angDir + (p.v > 0 ? 0 : Math.PI); }
    else if (p.path === 'ring') { p.a += p.v / p.r * dt; const v = ringXZ(p.a, p.r); x = v.x; z = v.y; ry = Math.atan2(-Math.sin(p.a), Math.cos(p.a)) + (p.v > 0 ? 0 : Math.PI); }
    else if (p.mode === 'play') { p.a += p.w * dt; const rr = p.r * (0.75 + 0.25 * Math.sin(tt * 0.6 + p.ph)); x = p.cx + Math.cos(p.a) * rr; z = p.cz + Math.sin(p.a) * rr; ry = Math.atan2(-Math.sin(p.a), Math.cos(p.a)) + (p.w > 0 ? 0 : Math.PI); speed = Math.abs(p.w) * rr; amp = 1.6; y = Math.abs(Math.sin(tt * 3 + p.ph)) > 0.97 ? 0.15 : 0; }
    else if (p.mode === 'shuttle') { p.t += p.v * dt; const u = (Math.sin(p.t * Math.PI) + 1) / 2, dir = Math.cos(p.t * Math.PI); x = p.p0.x + (p.p1.x - p.p0.x) * u; z = p.p0.y + (p.p1.y - p.p0.y) * u; ry = Math.atan2(p.p1.x - p.p0.x, p.p1.y - p.p0.y) + (dir >= 0 ? 0 : Math.PI); speed = Math.abs(dir) * 1.3; if (Math.abs(dir) < 0.15) kind = 'stand'; }
    else if (p.mode === 'cycle') { const b = p.b, v = along(b.s, b.sd * 5.6); x = v.x; z = v.y; ry = angDir + (b.sd > 0 ? 0 : Math.PI); kind = 'cycle'; }
    else if (p.mode === 'swing') { const sw = p.sw, th = Math.sin(tt * 1.9 + sw.ph) * sw.amp; sw.piv.rotation.x = th; x = sw.piv.position.x; z = sw.piv.position.z; y = sw.piv.position.y; rx = th; ry = sw.piv.rotation.y; kind = "swing"; }
    else { x = p.x; z = p.z; if (p.mode === 'stand') kind = 'stand'; }
    if (kind === 'stand') speed = 0;
    // aparecen con la onda: en la calle de hoy solo hay gente en los andenes
    const tgt = hiddenAt(p, x, z) ? 0 : 1; p.vis = p.vis === undefined ? tgt : p.vis + (tgt - p.vis) * Math.min(1, dt * 5); const sc = Math.max(0.001, p.vis) * p.sc;
    p.phase = (p.phase || p.ph) + dt * (speed * 4.6 / p.sc + (kind === 'stand' ? 0 : 0));
    if (kind === 'cycle') { baseM(x, 0, z, ry, sc); const c = tt * 5 + p.ph, hip = 1.02;
      part(legIM, i * 2, 0.1, hip, -0.1, -0.55 + Math.sin(c) * 0.45, 0, 0.9); part(legIM, i * 2 + 1, -0.1, hip, -0.1, -0.55 - Math.sin(c) * 0.45, 0, 0.9);
      part(torIM, i, 0, hip + 0.32, 0.05, 0.45); part(armIM, i * 2, 0.2, hip + 0.55, 0.22, -1.15, 0.1); part(armIM, i * 2 + 1, -0.2, hip + 0.55, 0.22, -1.15, -0.1);
      part(headIM, i, 0, hip + 0.74, 0.3); part(hairIM, i, 0, hip + 0.77, 0.28, -0.25);
    } else if (kind === 'swing') { baseM(x, y, z, ry, sc, rx); const sy = -1.85;
      part(legIM, i * 2, 0.1, sy, 0, -1.3 + Math.sin(tt * 1.9 + p.sw.ph) * 0.4, 0, 0.62); part(legIM, i * 2 + 1, -0.1, sy, 0, -1.3 + Math.sin(tt * 1.9 + p.sw.ph) * 0.4, 0, 0.62);
      part(torIM, i, 0, sy + 0.36, 0); part(armIM, i * 2, 0.22, sy + 0.95, 0, -2.9, 0.1); part(armIM, i * 2 + 1, -0.22, sy + 0.95, 0, -2.9, -0.1);
      part(headIM, i, 0, sy + 0.84, 0); part(hairIM, i, 0, sy + 0.86, -0.01, -0.25);
    } else { if (p.hero) p._st = { x, y, z, ry, sc, kind, speed }; pose(i, p, x, y, z, ry, p.hero ? 0.0001 : sc, kind, p.phase, kind === 'stand' ? 0 : amp, tt); }
    if (p.dog !== undefined) { const h = ry; setDog(p.dog, x + Math.sin(h) * 1.1 + Math.cos(h) * 0.55, z + Math.cos(h) * 1.1 - Math.sin(h) * 0.55, h, sc / p.sc, tt, p.ph, speed / 1.2); }
  });
  dz.forEach((d, j) => { d.a += d.v * dt * 0.5; const x = -23 + Math.cos(d.a) * d.r, z = -23 + Math.sin(d.a) * d.r; setDog(owners.length + j, x, z, Math.atan2(-Math.sin(d.a), Math.cos(d.a)) + (d.v > 0 ? 0 : Math.PI), 1, tt, d.ph, Math.abs(d.v) * d.r * 0.5); });
  [legIM, armIM, torIM, headIM, hairIM, bagIM, strIM, strHood, dogB, dogHd, dogLeg, dogTail].forEach(m => m.instanceMatrix.needsUpdate = true);
}

/* ============ TRÁFICO DEL BARRIO REAL Y BUSES DEL MIO ============ */
const drivable = roadRuns.filter(r => r.cls !== 'se' && r.L > 40), buses = mioRuns.filter(r => r.L > 60);
const ctxCars = []; for (let i = 0; i < (isMobile ? 26 : 48) && drivable.length; i++) { const r = drivable[(rnd() * drivable.length) | 0]; ctxCars.push({ r, d: rnd() * r.L, v: R(6, 10), side: r.oneway ? 0 : (rnd() < 0.5 ? 1 : -1) }); }
const ctxB = new T.InstancedMesh(new T.BoxGeometry(1.8, 0.8, 4.2), std({ color: 0xffffff, roughness: 0.35, metalness: 0.35 }), ctxCars.length), ctxC = new T.InstancedMesh(new T.BoxGeometry(1.6, 0.62, 2.2), std({ color: 0x1e2628, roughness: 0.15, metalness: 0.4 }), ctxCars.length);
ctxCars.forEach((c, i) => ctxB.setColorAt(i, new T.Color([0xe9e6df, 0x2b2f33, 0xa8352e, 0x9aa3ab, 0x355a88, 0xe7c02c, 0xf4f4f2][i % 7]))); ctxB.castShadow = true; scene.add(ctxB, ctxC);
const mio = []; buses.forEach(r => { for (let k = 0; k < 2; k++) mio.push({ r, d: (k * 0.5 + rnd() * 0.2) * r.L, v: R(7, 9) }); });
const mioB = new T.InstancedMesh(new T.BoxGeometry(2.55, 3.1, 18), std({ color: 0xf4f3ee, roughness: 0.4 }), Math.max(1, mio.length)), mioS = new T.InstancedMesh(new T.BoxGeometry(2.6, 0.5, 18.05), std({ color: 0x2f8f5a }), Math.max(1, mio.length));
mioB.castShadow = true; scene.add(mioB, mioS);
function moveCtx(dt) {
  ctxCars.forEach((c, i) => { c.d += c.v * dt * (c.side < 0 ? -1 : 1); if (c.d > c.r.L) c.d = 0; if (c.d < 0) c.d = c.r.L;
    let [x, z, ry] = runAt(c.r, c.d); if (c.side) { x += Math.cos(ry) * 1.9 * c.side; z -= Math.sin(ry) * 1.9 * c.side; } if (c.side < 0) ry += Math.PI;
    tmp.rotation.set(0, ry, 0); tmp.scale.set(1, 1, 1); tmp.position.set(x, 0.7, z); tmp.updateMatrix(); ctxB.setMatrixAt(i, tmp.matrix); tmp.position.set(x, 1.4, z); tmp.updateMatrix(); ctxC.setMatrixAt(i, tmp.matrix); });
  mio.forEach((b, i) => { b.d += b.v * dt; if (b.d > b.r.L) b.d = 0; const [x, z, ry] = runAt(b.r, b.d);
    tmp.rotation.set(0, ry, 0); tmp.scale.set(1, 1, 1); tmp.position.set(x, 1.85, z); tmp.updateMatrix(); mioB.setMatrixAt(i, tmp.matrix); tmp.position.set(x, 0.9, z); tmp.updateMatrix(); mioS.setMatrixAt(i, tmp.matrix); });
  ctxB.instanceMatrix.needsUpdate = ctxC.instanceMatrix.needsUpdate = mioB.instanceMatrix.needsUpdate = mioS.instanceMatrix.needsUpdate = true;
}

/* ============ CAPA "HOY": calzadas, carros, motos y tráfico ============ */
applyReveal(PROP.filter(o => o !== dog && o !== plinth), false);
const HOY = new T.Group(); scene.add(HOY); PARENT = HOY;
const asph = std({ color: 0x3d3c3b, roughness: 0.95 }), conc = std({ color: 0xb7b1a6, roughness: 1 }), paint = new T.MeshBasicMaterial({ color: 0xefece4 }), yel = std({ color: 0xdcae35, roughness: 0.7 });
{ const mc = along(LEN / 2, 0);
  [-1, 1].forEach(sd => {
    const c = along(LEN / 2, sd * 4.9); flat(new T.PlaneGeometry(7.4, LEN), asph, 0.125, c.x, c.y, angDir);
    const sw = along(LEN / 2, sd * 10.8); flat(new T.PlaneGeometry(4.4, LEN), conc, 0.125, sw.x, sw.y, angDir);
    for (let s2 = 4; s2 < LEN; s2 += 6) { const l = along(s2, sd * 4.9); flat(new T.PlaneGeometry(0.16, 2.6), paint, 0.14, l.x, l.y, angDir); }
    for (let s2 = 14; s2 < LEN - 8; s2 += 5.6) { const l = along(s2, sd * 7.3); flat(new T.PlaneGeometry(2.1, 0.12), yel, 0.14, l.x, l.y, angDir); }
  });
  add(new T.BoxGeometry(2.4, 0.3, LEN - 8), conc, mc.x, 0.15, mc.y, angDir, false);
  flat(new T.PlaneGeometry(2.0, LEN - 8), M.garden, 0.31, mc.x, mc.y, angDir);
  for (let o = -8; o <= 8; o += 1.4) { const z = along(S_PT[4] + 7, o); flat(new T.PlaneGeometry(0.75, 4.2), paint, 0.14, z.x, z.y, angDir); }
  const isl = along(S_PT[4] - 3, 0); add(new T.BoxGeometry(3.4, 0.35, 6.5), yel, isl.x, 0.17, isl.y, angDir);
  flat(new T.RingGeometry(R_PARK + 1, R_RING - 4, 96), asph, 0.125);
  flat(new T.RingGeometry(R_RING - 4, R_RING + 0.6, 96), conc, 0.127);
  flat(new T.CircleGeometry(R_PARK + 1, 96), texRepeat(M.grass, 9, 9), 0.41);
  flat(new T.RingGeometry(19.5, 22, 64, 1, 0.3, 4.4), conc, 0.43);
  flat(new T.PlaneGeometry(2.2, R_PARK * 2 - 4), conc, 0.43, 0, 0, 0.6);
}
const carBody = new T.BoxGeometry(1.85, 0.8, 4.3), carCab = new T.BoxGeometry(1.62, 0.64, 2.3); carBody.translate(0, 0.05, 0); carCab.translate(0, -0.06, -0.2);
const CAR_COL = [0xe9e6df, 0x2b2f33, 0xa8352e, 0x9aa3ab, 0x355a88, 0xf4f4f2, 0x6b6f72, 0xe7c02c];
const carMat = std({ color: 0xffffff, roughness: 0.35, metalness: 0.35 }), cabMat = std({ color: 0x1e2628, roughness: 0.15, metalness: 0.4 });
const parked = [];
[-1, 1].forEach(sd => { for (let s2 = 12; s2 < LEN - 6; s2 += 5.6) { if (rnd() < 0.2) continue; const v = along(s2, sd * 7.3); parked.push([v.x, v.y, angDir, s2 > S_PT[1] - 20 ? 7 : -1]); } });
for (let a = 0; a < Math.PI * 2; a += 0.088) { if (rnd() < 0.22) continue; const v = ringXZ(a, R_PARK + 3.1); parked.push([v.x, v.y, -a, -1]); }
const carColor = (c, i) => new T.Color(c[3] >= 0 && i % 2 ? CAR_COL[7] : CAR_COL[i % 7]);
instanced(carBody, carMat, parked, (o, c) => { o.position.set(c[0], 0.72, c[1]); o.rotation.y = c[2]; }, { color: carColor });
instanced(carCab, cabMat, parked, (o, c) => { o.position.set(c[0], 1.48, c[1]); o.rotation.y = c[2]; });
const wheelGeo = new T.CylinderGeometry(0.36, 0.36, 0.26, 12); wheelGeo.rotateZ(Math.PI / 2);
const wheels = []; parked.forEach(c => [[-0.9, 1.35], [0.9, 1.35], [-0.9, -1.35], [0.9, -1.35]].forEach(([wx, wz]) => {
  const cs = Math.cos(c[2]), sn = Math.sin(c[2]); wheels.push([c[0] + wx * cs + wz * sn, c[1] - wx * sn + wz * cs, c[2]]); }));
instanced(wheelGeo, std({ color: 0x1a1a1a, roughness: 0.8 }), wheels, (o, w) => { o.position.set(w[0], 0.36, w[1]); o.rotation.y = w[2]; }, { cast: false });
const motos = [];
[-1, 1].forEach(sd => { for (let s2 = 20; s2 < LEN; s2 += 9) { if (rnd() < 0.35) continue; for (let k2 = 0; k2 < 3; k2++) { const v = along(s2 + k2 * 0.95, sd * (HALF - 2.3)); motos.push([v.x, v.y, angDir + Math.PI / 2]); } } });
for (let a = -1.6; a < 0.6; a += 0.1) { const v = ringXZ(a, R_RING - 1.7); motos.push([v.x, v.y, -a + Math.PI / 2]); }
instanced(new T.BoxGeometry(0.45, 0.95, 1.85), std({ color: 0xffffff, roughness: 0.5 }), motos, (o, m2) => { o.position.set(m2[0], 0.62, m2[1]); o.rotation.y = m2[2]; }, { color: (m2, i) => new T.Color([0x2b2b2b, 0xa8352e, 0x355a88, 0x2b2b2b][i % 4]) });
// tráfico en movimiento
const traffic = [];
for (let i = 0; i < 30; i++) traffic.push(i < 18 ? { ring: false, s: rnd() * LEN, sd: i % 2 ? 1 : -1, v: R(8, 12) } : { ring: true, a: rnd() * 6.283, v: R(0.14, 0.2) });
const trafB = new T.InstancedMesh(carBody, carMat, traffic.length), trafC = new T.InstancedMesh(carCab, cabMat, traffic.length);
traffic.forEach((c, i) => trafB.setColorAt(i, new T.Color(CAR_COL[(i * 3) % 8])));
trafB.castShadow = trafC.castShadow = true; HOY.add(trafB, trafC);
function moveTraffic(dt) {
  traffic.forEach((c, i) => {
    let x, z, ry;
    if (c.ring) { c.a -= c.v * dt; const v = ringXZ(c.a, R_PARK + 7.6); x = v.x; z = v.y; ry = -c.a + Math.PI; }
    else { c.s += c.v * dt * c.sd; if (c.s > LEN) c.s = 0; if (c.s < 0) c.s = LEN; const v = along(c.s, c.sd * 3.3); x = v.x; z = v.y; ry = angDir + (c.sd > 0 ? 0 : Math.PI); }
    tmp.rotation.set(0, ry, 0); tmp.scale.set(1, 1, 1);
    tmp.position.set(x, 0.72, z); tmp.updateMatrix(); trafB.setMatrixAt(i, tmp.matrix);
    tmp.position.set(x, 1.48, z); tmp.updateMatrix(); trafC.setMatrixAt(i, tmp.matrix);
  });
  trafB.instanceMatrix.needsUpdate = trafC.instanceMatrix.needsUpdate = true;
}
PARENT = scene;
applyReveal([HOY], true);

/* ============ CAPAS DE LECTURA (zonificación del documento, agua SUDS, residuos, polinizadores) ============ */
const LAYERS = { zonas: false, agua: false, residuos: false, bio: false };
const LG = { zonas: new T.Group(), agua: new T.Group(), residuos: new T.Group() };
Object.values(LG).forEach(g => { g.visible = false; scene.add(g); });
const ovMat = (c, op = 0.5) => { const m = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: Math.min(0.85, op * 1.45), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }); m.userData.op = m.opacity; return m; };
const ZCOL = { eco: 0x2f9e57, peat: 0x2f7fb0, econ: 0xe07b39, veh: 0x2b2f33 };
const ZMESH = {};
{ const P2 = PARENT; PARENT = LG.zonas;
  const zg = k => { const g = new T.Group(); LG.zonas.add(g); ZMESH[k] = g; return g; };
  // corredor peatonal: bulevar y plaza del anillo
  let g = zg('peat'); PARENT = g; flat(new T.PlaneGeometry(HALF * 2, LEN + 10), ovMat(ZCOL.peat, 0.38), 0.2, along(LEN / 2, 0).x, along(LEN / 2, 0).y, angDir); flat(new T.RingGeometry(R_PARK + 1, R_RING, 96), ovMat(ZCOL.peat, 0.38), 0.2);
  // núcleo ecológico: parque, eje verde y jardines de lluvia
  g = zg('eco'); PARENT = g; flat(new T.CircleGeometry(R_PARK, 96), ovMat(ZCOL.eco, 0.5), 0.5); flat(new T.PlaneGeometry(7.4, LEN - 36), ovMat(ZCOL.eco, 0.55), 0.66, along(36 + (LEN - 36) / 2, 0).x, along(36 + (LEN - 36) / 2, 0).y, angDir);
  [-1, 1].forEach(sd => { for (let s2 = 40; s2 < LEN - 12; s2 += 26) { const c = along(s2 + 8, sd * (HALF - 5.2)); flat(new T.PlaneGeometry(2.6, 15.5), ovMat(ZCOL.eco, 0.6), 0.42, c.x, c.y, angDir); } });
  // actividad económica: frentes de terrazas, anillo de bares, comercio norte y plaza de flores
  g = zg('econ'); PARENT = g; [-1, 1].forEach(sd => { const c = along(89, sd * (HALF - 3.8)); flat(new T.PlaneGeometry(7.2, 86), ovMat(ZCOL.econ, 0.55), 0.24, c.x, c.y, angDir); });
  [[-1.5, 2.05], [-1.95, 0.8]].forEach(([a0, len]) => flat(new T.RingGeometry(R_RING - 7.5, R_RING, 48, 1, -(a0 + len), len), ovMat(ZCOL.econ, 0.55), 0.24));
  flat(new T.RingGeometry(R_RING - 9, R_RING, 24, 1, -(Math.atan2(52, -9) + 0.3), 0.5), ovMat(ZCOL.econ, 0.55), 0.24);
  // zona vehicular controlada: carriles de servicio, bahías y calles del entorno
  g = zg('veh'); PARENT = g; [-1, 1].forEach(sd => { const c = along(LEN / 2, sd * SERVICE_O); flat(new T.PlaneGeometry(2.8, LEN - 4), ovMat(ZCOL.veh, 0.6), 0.26, c.x, c.y, angDir); });
  add(ribbon(segA.filter(([p]) => p.length() < 260), 0.3), ovMat(ZCOL.veh, 0.5), 0, 0, 0, 0, false, false);
  PARENT = P2; }
// agua: flechas que corren de las superficies permeables a los jardines de lluvia y al parque
const arrowTex = canvasTex(64, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(90,180,255,.95)'; g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w - 10, 52); g.lineTo(w / 2 + 9, 46); g.lineTo(w / 2 + 9, h - 12); g.lineTo(w / 2 - 9, h - 12); g.lineTo(w / 2 - 9, 46); g.lineTo(10, 52); g.closePath(); g.fill(); });
const arrowMat = new T.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
{ const P2 = PARENT; PARENT = LG.agua;
  [-1, 1].forEach(sd => { for (let s2 = 40; s2 < LEN - 12; s2 += 26) for (let k = 0; k < 3; k++) { const a = along(s2 + 3 + k * 5, sd * (HALF - 0.8)), b = along(s2 + 3 + k * 5, sd * (HALF - 5.0)), c = a.clone().add(b).multiplyScalar(0.5);
      const m = flat(new T.PlaneGeometry(1.8, a.distanceTo(b)), arrowMat, 0.3, c.x, c.y, angDir + Math.PI / 2 + (sd > 0 ? Math.PI : 0)); }
    for (let s2 = 40; s2 < LEN - 12; s2 += 26) { const c = along(s2 + 8, sd * (HALF - 5.2)); flat(new T.PlaneGeometry(1.6, 15), ovMat(0x4fa8ff, 0.5), 0.45, c.x, c.y, angDir); } });
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) { const p = ringXZ(a, (R_PARK + R_RING) / 2), q = ringXZ(a, R_PARK - 2), c = p.clone().add(q).multiplyScalar(0.5); flat(new T.PlaneGeometry(2.4, p.distanceTo(q)), arrowMat, 0.48, c.x, c.y, Math.atan2(q.x - p.x, q.y - p.y) + Math.PI); }
  PARENT = P2; }
// lluvia: trazos que caen cerca de la cámara cuando la capa de agua está activa
const NRAIN = 900, rainIM = new T.InstancedMesh(new T.BoxGeometry(0.04, 1.2, 0.04), new T.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.7 }), NRAIN);
const rainP = [...Array(NRAIN)].map(() => [R(-60, 60), R(0, 40), R(-60, 60), R(14, 20)]); rainIM.frustumCulled = false; rainIM.visible = false; LG.agua.add(rainIM);
// residuos: faros sobre cada isla
{ const P2 = PARENT; PARENT = LG.residuos; const bm = new T.MeshBasicMaterial({ color: 0x8fe39b, transparent: true, opacity: 0.55, depthWrite: false });
  ISLAS.forEach(is => { add(new T.CylinderGeometry(0.35, 0.35, 16, 10, 1, true), bm, is.v.x, 9, is.v.y, 0, false, false); add(new T.SphereGeometry(0.9, 12, 8), bm, is.v.x, 17.5, is.v.y, 0, false, false); const r = flat(new T.RingGeometry(1.8, 2.3, 32), bm, 0.3, is.v.x, is.v.y); }); PARENT = P2; }
function setLayer(k, on) { LAYERS[k] = on; if (LG[k]) LG[k].visible = on; if (k === 'agua') rainIM.visible = on; document.querySelectorAll(`[data-layer="${k}"]`).forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); const lg = document.getElementById('zlegend'); if (lg) lg.hidden = !LAYERS.zonas; }
function highlightZone(k) { Object.entries(ZMESH).forEach(([z, g]) => g.children.forEach(m => { if (m.material) m.material.opacity = !k || z === k ? (m.material.userData.op || 0.6) : 0.08; })); }
function updateLayers(dt, tt) {
  arrowTex.offset.y = (arrowTex.offset.y + dt * 0.9) % 1;
  if (rainIM.visible) { const c = controls.target; rainP.forEach((r, i) => { r[1] -= r[3] * dt; if (r[1] < 0) { r[1] = 40; r[0] = R(-60, 60); r[2] = R(-60, 60); } tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.position.set(c.x + r[0], r[1], c.z + r[2]); tmp.updateMatrix(); rainIM.setMatrixAt(i, tmp.matrix); }); rainIM.instanceMatrix.needsUpdate = true; }
  if (LAYERS.residuos) LG.residuos.children.forEach((m, i) => { if (m.material) m.material.opacity = 0.35 + 0.25 * Math.sin(tt * 3 + i); });
}

/* ============ VUELO DEL RECORRIDO ============ */
// fotogramas clave: [pos, objetivo, punto que se describe]
const KF = [];
const V3 = (x, y, z) => new T.Vector3(x, y, z);
KF.push([V3(330, 230, 420), V3(80, 0, 120), 0]);
KF.push([(() => { const c = along(LEN + 40, 18); return V3(c.x, 70, c.y); })(), (() => { const t = along(S_PT[1], 0); return V3(t.x, 0, t.y); })(), 0]);
for (let s = S_PT[1] + 42; s >= S_PT[4] + 18; s -= 16) {
  const c = along(s, 4.6), t = along(s - 40, 1.5);
  const near = [1, 2, 3, 4].reduce((b, n) => Math.abs(s - 30 - S_PT[n]) < Math.abs(s - 30 - S_PT[b]) ? n : b, 1);
  KF.push([V3(c.x, 9.5 + Math.max(0, (S_PT[4] + 60 - s)) * 0.14, c.y), V3(t.x, 3, t.y), near]);
}
KF.push([(() => { const c = along(S_PT[4] + 14, 8); return V3(c.x, 26, c.y); })(), V3(10, 2, 10), 4]);
const aIn = Math.atan2(along(S_PT[4], 0).y, along(S_PT[4], 0).x);
const ringStops = [[-0.32, 5], [-1.54, 6], [-2.91, 7], [-4.54, 8]];
for (let a = aIn - 0.35; a > -4.75; a -= 0.32) {
  const near = ringStops.reduce((b, r) => Math.abs(a + 0.55 - r[0]) < Math.abs(a + 0.55 - b[0]) ? r : b)[1];
  const c = ringXZ(a, 55.5), t = ringXZ(a - 0.55, 47);
  KF.push([V3(c.x, 12, c.y), V3(t.x, 3, t.y), a > -0.05 ? 4 : near]);
}
KF.push([V3(30, 46, 40), V3(0, 1.5, 0), 9]);
KF.push([V3(-26, 40, -30), V3(0, 2, 0), 9]);
KF.push([V3(-120, 140, 160), V3(40, 0, 70), 0]);
const posCurve = new T.CatmullRomCurve3(KF.map(k => k[0]), false, 'centripetal');
const tgtCurve = new T.CatmullRomCurve3(KF.map(k => k[1]), false, 'centripetal');
const TOUR_SEC = 96, NK = KF.length - 1;
const tagAt = cu => KF[Math.min(NK, Math.round(cu * NK))][2];
// cada tramo pesa más cerca de la primera llegada a un punto: la cámara frena, mira y sigue
const firstK = {}; KF.forEach((k, i) => { if (k[2] && firstK[k[2]] === undefined) firstK[k[2]] = i; });
const isFirst = i => Object.values(firstK).includes(i);
const segW = []; for (let i = 0; i < NK; i++) segW.push(isFirst(i) || isFirst(i + 1) ? 2.3 : 1);
const cumW = [0]; segW.forEach(w => cumW.push(cumW[cumW.length - 1] + w)); const WT = cumW[NK];
function curveU(tau) {
  const x = Math.max(0, Math.min(1, tau)) * WT; let i = 0; while (i < NK - 1 && cumW[i + 1] < x) i++;
  let f = (x - cumW[i]) / segW[i]; if (segW[i] > 1) f = f * f * (3 - 2 * f) * 0.55 + f * 0.45; // frena suave en las paradas
  return (i + f) / NK;
}
const tauOfK = i => cumW[i] / WT;
// vistas fijas por punto
const VIEW = { 0: [V3(300, 200, 380), V3(80, 0, 120)] };
[1, 2, 3].forEach(n => { const c = along(S_PT[n] + 32, 4.6), t = along(S_PT[n] - 22, 1.5); VIEW[n] = [V3(c.x, 9.5, c.y), V3(t.x, 2.5, t.y)]; });
{ const c = along(S_PT[4] + 30, 9), t = along(S_PT[4] - 16, 0); VIEW[4] = [V3(c.x, 30, c.y), V3(t.x, 1, t.y)]; }
ringStops.forEach(([a, n]) => { const c = ringXZ(a + 0.5, 55.5), t = ringXZ(a, 50); VIEW[n] = [V3(c.x, 12, c.y), V3(t.x, 3, t.y)]; });
VIEW[9] = [V3(26, 48, 36), V3(0, 1.5, 0)];

/* ============ INTERFAZ ============ */
const $ = id => document.getElementById(id);
const ui = { scrub: $('scrub'), time: $('time'), play: $('btnPlay'), night: $('btnNight'), over: $('btnOverview'), hint: $('hint'), pins: $('pins'), marks: $('marks') };
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let u = 0, playing = false, fly = null, current = -1, night = false, follow = false, chapterN = -1;

// marcadores HTML
const pinEls = [];
for (let n = 1; n <= 9; n++) {
  const d = PUNTOS[n] || {}, el = document.createElement('div');
  el.className = 'pin ' + (n <= 3 ? 'a' : 'b');
  el.innerHTML = `<span class="tag">${d.titulo || ''}</span><button type="button" aria-label="Ir al punto ${n}: ${d.titulo || ''}">${n}</button><span class="stem"></span>`;
  el.querySelector('button').onclick = () => { stop(); goPoint(n); };
  ui.pins.appendChild(el); pinEls.push({ el, n, pos: V3(P[n][0], n === 9 ? 6 : 3, P[n][1]) });
}
// puntos de información de los sistemas (tránsito, residuos, agua, biodiversidad)
const HOTS = [
  { ic: '🚦', t: 'Acceso controlado 10 km/h', d: 'Cruce elevado a nivel con franja táctil y bolardos retráctiles. Entran solo residentes, emergencias y carga de 5 a 9 a.m.; el resto del día la calle es del peatón.', ref: ['Buenos Aires · Calle prioridad peatón', 'https://buenosaires.gob.ar/gcaba_historico/desarrollourbano/manualdedisenourbano/paisaje-urbano-morfologia/resolucion-general-de-secciones-de-calles/calle-prioridad-peaton'], layer: 'zonas', pos: (() => { const c = CROSS.reduce((b, x) => Math.abs(x.s - S_PT[1]) < Math.abs(b.s - S_PT[1]) ? x : b, CROSS[0] || { s: S_PT[1] }); const v = along(c.s, 0); return V3(v.x, 1, v.y); })() },
  { ic: '♻️', t: 'Punto limpio soterrado', d: 'Tres buzones en superficie (blanco aprovechables, negro no aprovechables, verde orgánicos) sobre tanques bajo el piso de 3.200 a 6.400 L. Se vacían con un camión con elevador: no hay bolsas en la calle.', ref: ['Bogotá · contenedores soterrados', 'https://bogota.gov.co/mi-ciudad/habitat/contenedores-soterrados-en-bogota-asi-funcionan-y-mas-datos-2026'], layer: 'residuos', pos: V3(ISLAS[1].v.x, 1, ISLAS[1].v.y) },
  { ic: '💧', t: 'Jardín de lluvia', d: 'Franja vegetal hundida con piedra de río. Las rejillas llevan el agua del adoquín al jardín, donde se filtra y se infiltra; la lámina se mantiene por debajo del nivel del piso.', ref: ['NACTO · Bioretention swale', 'https://nacto.org/publication/urban-street-stormwater-guide/stormwater-elements/bioretention-swale/'], layer: 'agua', pos: (() => { const v = along(66 + 8, HALF - 5.2); return V3(v.x, 1, v.y); })() },
  { ic: '🐝', t: 'Jardín de polinizadores', d: 'Lantana, salvia, asclepias y heliconias; hotel de insectos, meliponario de abejas sin aguijón, casas de aves y colibríes. Al lado, el compostaje convierte los orgánicos en abono.', ref: ['DAGMA · polinizadores en Corazón de Pance', 'https://www.cali.gov.co/dagma/publicaciones/166601/proteccion-a-los-polinizadores-en-el-parque-ambiental-corazon-de-pance/'], layer: 'bio', pos: V3(BIO_C.x, 1, BIO_C.y) }
];
const hotCard = document.createElement('div'); hotCard.className = 'hotcard'; hotCard.hidden = true; host.parentElement.appendChild(hotCard);
const hotEls = HOTS.map((h, i) => { const el = document.createElement('div'); el.className = 'pin hot';
  el.innerHTML = `<button type="button" aria-label="${h.t}">${h.ic}</button><span class="stem"></span>`;
  el.querySelector('button').onclick = e => { e.stopPropagation(); stop(); flyTo(h.pos.clone().add(V3(14, 12, 14)), h.pos, 1800);
    hotCard.innerHTML = `<button class="x" type="button" aria-label="Cerrar">×</button><b>${h.ic} ${h.t}</b><p>${h.d}</p><div><button class="lay" type="button">Ver capa</button><a href="${h.ref[1]}" target="_blank" rel="noopener">${h.ref[0]} ↗</a></div>`;
    hotCard.hidden = false; hotCard.querySelector('.x').onclick = () => hotCard.hidden = true;
    hotCard.querySelector('.lay').onclick = () => { ['zonas', 'agua', 'residuos', 'bio'].forEach(l => setLayer(l, l === h.layer)); }; };
  ui.pins.appendChild(el); return { el, pos: h.pos }; });
// marcas de la línea de tiempo
const firstU = {}; Object.entries(firstK).forEach(([n, i]) => firstU[n] = tauOfK(i));
Object.entries(firstU).forEach(([n, uu]) => { const s = document.createElement('span'); s.style.left = (uu * 100) + '%'; s.textContent = n; ui.marks.appendChild(s); });

// panel lateral
const pnums = $('pnums');
const allBtn = document.createElement('button'); allBtn.type = 'button'; allBtn.className = 'all'; allBtn.textContent = 'General'; allBtn.dataset.n = 0; pnums.appendChild(allBtn);
for (let n = 1; n <= 9; n++) { const b = document.createElement('button'); b.type = 'button'; b.textContent = n; b.dataset.n = n; b.className = n <= 3 ? 'a' : 'b'; b.setAttribute('aria-label', 'Punto ' + n); pnums.appendChild(b); }
pnums.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; stop(); goPoint(+b.dataset.n); });
document.querySelectorAll('.ptabs button').forEach(b => b.onclick = () => { stop(); goPoint(b.dataset.tramo === 'a' ? 1 : 4); });
const cmp = $('compare'), cmpIn = $('cmp');
const setX = v => { cmp.style.setProperty('--x', v + '%'); cmpIn.value = v; };
let sweep = null;
cmpIn.addEventListener('input', () => { sweep = null; setX(cmpIn.value); });
document.querySelectorAll('.cmpbtns button').forEach(b => b.onclick = () => { sweep = null; animX(+b.dataset.x, 700); });
function animX(to, dur) { sweep = { t0: performance.now(), keys: [[0, +cmpIn.value], [dur, to]] }; }
function autoSweep() { sweep = { t0: performance.now() + 450, keys: [[0, 100], [1500, 0], [1900, 0], [2700, 50]] }; setX(100); }
function stepSweep(now) {
  if (!sweep) return; const t = now - sweep.t0; if (t < 0) return; const K = sweep.keys;
  let j = 0; while (j < K.length - 2 && K[j + 1][0] < t) j++;
  const a = K[j], b = K[j + 1], k = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
  setX(+(a[1] + (b[1] - a[1]) * ease(k)).toFixed(1)); if (t >= K[K.length - 1][0]) sweep = null;
}
setX(50);
const pad = n => String(n).padStart(2, '0');
function showPanel(n) {
  if (n === current) return; current = n;
  const d = PUNTOS[n] || PUNTOS[0];
  $('pzone').textContent = d.zona; $('ptitle').textContent = d.titulo; $('phoy').textContent = d.hoy; $('pprop').textContent = d.prop; if ($('pges')) $('pges').textContent = d.ges || '';
  $('pchips').innerHTML = (d.chips || []).map(c => `<span>${c}</span>`).join('');
  const im = n === 0 ? d.img : pad(n);
  $('imgBefore').src = `img/${im}-antes.jpg`; $('imgAfter').src = `img/${im}-despues.jpg`;
  $('imgBefore').alt = `Punto ${n} hoy`; $('imgAfter').alt = `Punto ${n} con la propuesta`;
  [...pnums.children].forEach(b => { const on = +b.dataset.n === n; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('.ptabs button').forEach(b => b.classList.toggle('on', (n >= 1 && n <= 3 && b.dataset.tramo === 'a') || (n >= 4 && b.dataset.tramo === 'b')));
  pinEls.forEach(p => p.el.classList.toggle('act', p.n === n));
  autoSweep();
}
// precarga de imágenes
for (let n = 1; n <= 9; n++) ['antes', 'despues'].forEach(k => { const i = new Image(); i.src = `img/${pad(n)}-${k}.jpg`; });

const chap = $('chapter'); let chapT = 0;
function showChapter(n) {
  if (!n || n === chapterN) return; chapterN = n; const d = PUNTOS[n] || {};
  chap.classList.remove('show'); chap.classList.toggle('b', n > 3);
  setTimeout(() => { $('chN').textContent = n; $('chZ').textContent = d.zona || ''; $('chT').textContent = d.titulo || ''; chap.classList.add('show'); }, 120);
  clearTimeout(chapT); chapT = setTimeout(() => chap.classList.remove('show'), 4200);
}
/* --- interruptor HOY / PROPUESTA (onda radial) --- */
const modeBtn = $('btnMode'), waveEl = $('wave'); let wave = null, propOn = false, waveHideT = 0;
const R_FULL = 1400, C0 = along(S_PT[1] + 34, 0);
function setModeUI(on) { propOn = on; modeBtn.setAttribute('aria-pressed', on); $('modeTxt').textContent = on ? 'Propuesta' : 'Hoy'; }
function waveTo(on, center, dur = 3200, from) {
  follow = false; if (center) REV.uC.value.copy(center);
  wave = { t0: performance.now(), dur, r0: from !== undefined ? from : REV.uR.value, r1: on ? R_FULL : 0 };
  if (on && wave.r0 > 600) wave.r0 = 0;
  setModeUI(on); waveEl.classList.add('show'); clearTimeout(waveHideT);
}
modeBtn.onclick = () => {
  const c = new T.Vector2(controls.target.x, controls.target.z), on = !propOn;
  stop(); waveTo(on, c, on ? 2600 : 1800, on ? 0 : 420); animX(on ? 0 : 100, 900);
};
function flyTo(pos, tgt, dur = 2400) { fly = { t0: performance.now(), dur, p0: cam.position.clone(), q0: controls.target.clone(), p1: pos.clone(), q1: tgt.clone() }; }
function goPoint(n) { const v = VIEW[n]; flyTo(v[0], v[1]); showPanel(n); const uu = n === 0 ? 0 : firstU[n]; if (uu !== undefined) setU(uu, false); }
function setU(v, apply = true) {
  u = Math.max(0, Math.min(1, v)); ui.scrub.value = Math.round(u * 1000); ui.scrub.style.setProperty('--p', (u * 100) + '%');
  ui.time.textContent = `${fmt(u * TOUR_SEC)} / ${fmt(TOUR_SEC)}`;
  if (apply) {
    const cu = curveU(u); cam.position.copy(posCurve.getPoint(cu)); controls.target.copy(tgtCurve.getPoint(cu));
    const tag = tagAt(cu); showPanel(tag); if (playing) showChapter(tag);
    if (follow) { const ramp = Math.max(0, Math.min(1, cu * NK - 1)), d = (Math.hypot(controls.target.x - C0.x, controls.target.z - C0.y) + 22) * ramp * ramp * (3 - 2 * ramp); if (d > REV.uR.value) REV.uR.value = d; if (u > 0.965 && !wave) waveTo(true, null, 2600); }
  }
}
function play() {
  if (u >= 0.999 || u < 0.005) { setU(0, false); chapterN = -1; REV.uC.value.copy(C0); REV.uR.value = 0; wave = null; setModeUI(false); }
  follow = REV.uR.value < R_FULL - 1 || u < 0.005; if (follow) { wave = null; REV.uC.value.copy(C0); setModeUI(true); }
  fly = null; playing = true; ui.play.innerHTML = '❚❚ <span class="t">Pausar</span>';
  const p = posCurve.getPoint(curveU(u)), t = tgtCurve.getPoint(curveU(u));
  if (cam.position.distanceTo(p) > 3) { flyTo(p, t, 1600); fly.thenPlay = true; playing = false; }
}
function stop() { if (follow) { follow = false; if (REV.uR.value < R_FULL) waveTo(true, null, 1800); } playing = false; ui.play.innerHTML = '▶ <span class="t">Recorrido</span>'; }
ui.play.onclick = () => playing || (fly && fly.thenPlay) ? (fly = null, stop()) : play();
ui.over.onclick = () => { stop(); goPoint(0); };
ui.scrub.addEventListener('input', () => { stop(); fly = null; setU(ui.scrub.value / 1000); });
controls.addEventListener('start', () => { if (playing) stop(); fly = null; ui.hint.style.opacity = 0; });

/* ============ DÍA / NOCHE ============ */
let composer = null, bloom = null, sao = null, fxaa = null, grade = null;
const GRADE = { uniforms: { tDiffuse: { value: null }, exposure: { value: 0.95 }, sat: { value: 1.06 }, contrast: { value: 1.12 }, vig: { value: 0.7 }, tint: { value: new T.Color(1.0, 0.985, 0.95) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, sat, contrast, vig; uniform vec3 tint; varying vec2 vUv;
  vec3 vacRRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
  vec3 vacAces(vec3 c){ const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
    const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602)); c *= exposure / 0.6; c = I * c; c = vacRRT(c); c = O * c; return clamp(c, 0.0, 1.0); }
  vec3 vacSRGB(vec3 c){ return mix(c * 12.92, pow(c, vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c)); }
  void main(){ vec3 c = vacSRGB(vacAces(texture2D(tDiffuse, vUv).rgb)); float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, sat); c = (c - 0.5) * contrast + 0.5; c *= tint;
    vec2 d = vUv - 0.5; c *= 1.0 - vig * dot(d, d); gl_FragColor = vec4(c, 1.0); }` };
const HQ = !isMobile && !/nosao/.test(location.search);
function setupComposer() {
  if (composer || !T.EffectComposer) return;
  const pr = renderer.getPixelRatio(), w = host.clientWidth, h = host.clientHeight;
  const rt = new T.WebGLRenderTarget(w * pr, h * pr, { type: T.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  composer = new T.EffectComposer(renderer, rt);
  composer.addPass(new T.RenderPass(scene, cam));
  if (T.UnrealBloomPass) { bloom = new T.UnrealBloomPass(new T.Vector2(w, h), 0.9, 0.55, 0.62); bloom.enabled = night; composer.addPass(bloom); }
  grade = new T.ShaderPass(GRADE); composer.addPass(grade);
  if (T.FXAAShader && !renderer.capabilities.isWebGL2) { fxaa = new T.ShaderPass(T.FXAAShader); composer.addPass(fxaa); }
  skyU.uLin.value = 1; resize();
}
function applyNight(on) {
  night = on; ui.night.classList.toggle('on', on); ui.night.innerHTML = on ? '☀ <span class="t">Día</span>' : '☾ <span class="t">Noche</span>';
  skyU.top.value.set(on ? 0x0b1630 : 0x5f9bd2); skyU.mid.value.set(on ? 0x1c2c4a : 0xd6e4ea); skyU.bot.value.set(on ? 0x3a3448 : 0xf6d9b0);
  scene.fog.color.set(on ? 0x1b2236 : 0xe9dcc6);
  hemi.intensity = on ? 0.16 : (REAL.env ? 0.32 : 0.62); hemi.color.set(on ? 0x8fa6d8 : 0xffe9cf);
  sun.intensity = on ? 0.32 : 2.35; sun.color.set(on ? 0x9db6ff : 0xffc98a); fill.intensity = on ? 0.08 : 0.25;
  winMats.forEach(m => m.emissiveIntensity = on ? 1.0 : 0);
  variants(M.glass, m => m.emissiveIntensity = on ? 2.2 : 0.25); variants(M.lamp, m => m.emissiveIntensity = on ? 4 : 0.4);
  variants(glowMat, m => m.opacity = on ? 0.8 : 0); variants(M.bulb, m => m.color.set(on ? 0xffe3a0 : 0xf5efe2));
  renderer.toneMappingExposure = on ? 1.15 : 1.0; if (grade) grade.uniforms.exposure.value = on ? 1.1 : 0.95; if (bloom) bloom.enabled = on;
  document.querySelector('.stage').style.background = on ? 'linear-gradient(180deg,#0b1630,#2a2a3c)' : '';
}
ui.night.onclick = () => applyNight(!night);

/* ============ BUCLE ============ */
function resize() {
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  if (composer) { composer.setSize(w, h); bloom && bloom.setSize(w, h); if (fxaa) fxaa.uniforms.resolution.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio())); }
}
new ResizeObserver(resize).observe(host); resize();
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const vtmp = new T.Vector3();
let last = performance.now(), tt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
  if (introPending && tt > 0.1) { startIntro(); }
  if (fly) {
    const k = Math.min(1, (now - fly.t0) / fly.dur), e = ease(k);
    cam.position.lerpVectors(fly.p0, fly.p1, e);
    const arc = Math.min(60, fly.p0.distanceTo(fly.p1) * 0.18); cam.position.y += Math.sin(e * Math.PI) * arc;
    controls.target.lerpVectors(fly.q0, fly.q1, e);
    if (k >= 1) { const tp = fly.thenPlay, cb = fly.then; fly = null; if (tp) { playing = true; ui.play.innerHTML = '❚❚ <span class="t">Pausar</span>'; } if (cb) cb(); }
  } else if (playing) {
    setU(u + dt / TOUR_SEC);
    // cámara en mano: balanceo mínimo para que el vuelo respire
    cam.position.x += Math.sin(tt * 0.63) * 0.22; cam.position.y += Math.sin(tt * 0.91) * 0.12; controls.target.x += Math.sin(tt * 0.47) * 0.18;
    if (u >= 1) stop();
  }
  if (wave) {
    const k = Math.min(1, (now - wave.t0) / wave.dur), e = 1 - Math.pow(1 - k, 3);
    REV.uR.value = wave.r0 + (wave.r1 - wave.r0) * (wave.r1 > wave.r0 ? e * e : e);
    waveEl.querySelector('span').style.setProperty('--w', propOn ? Math.min(1, REV.uR.value / 400) : Math.min(1, REV.uR.value / 420));
    if (k >= 1) { wave = null; waveHideT = setTimeout(() => waveEl.classList.remove('show'), 900); }
  } else if (follow) waveEl.querySelector('span').style.setProperty('--w', u);
  if (follow && !waveEl.classList.contains('show')) waveEl.classList.add('show');
  REV.uGlow.value = REV.uR.value > R_FULL - 50 || REV.uR.value < 0.5 ? 0 : 1;
  stepSweep(now);
  if (rise) stepRise(now);
  moveWalkers(dt, tt); moveTraffic(dt); moveBikes(dt); moveCtx(dt); moveService(dt); moveButterflies(dt, tt); moveHummingbirds(dt, tt); updateLayers(dt, tt);
  const pulse = 1 + Math.sin(tt * 3) * 0.25; halos.forEach(h => { h.scale.setScalar(pulse); h.quaternion.copy(cam.quaternion); });
  controls.update();
  // marcadores proyectados
  const w = host.clientWidth, h = host.clientHeight;
  pinEls.forEach(p => {
    vtmp.copy(p.pos); vtmp.y += 14; vtmp.project(cam);
    const vis = vtmp.z < 1 && Math.abs(vtmp.x) < 1.1 && Math.abs(vtmp.y) < 1.1;
    p.el.style.display = vis ? '' : 'none';
    if (vis) { p.el.style.left = ((vtmp.x + 1) / 2 * w) + 'px'; p.el.style.top = ((1 - vtmp.y) / 2 * h) + 'px'; p.el.classList.toggle('far', cam.position.distanceTo(p.pos) > 320); }
  });
  hotEls.forEach(p => { vtmp.copy(p.pos); vtmp.y += 3; vtmp.project(cam); const d = cam.position.distanceTo(p.pos), vis = vtmp.z < 1 && Math.abs(vtmp.x) < 1.05 && Math.abs(vtmp.y) < 1.05 && d < 260 && propOn;
    p.el.style.display = vis ? '' : 'none'; if (vis) { p.el.style.left = ((vtmp.x + 1) / 2 * w) + 'px'; p.el.style.top = ((1 - vtmp.y) / 2 * h) + 'px'; } });
  WIND.value = tt; if (REAL.mixers) REAL.update(dt, tt);
  if (composer) composer.render(); else renderer.render(scene, cam);
}
/* ============ MODO REALISTA: luz HDRI, pasto fotográfico, personas y perros con esqueleto, aves ============ */
const REAL = { mixers: null, dogs: null, heroes: [], birds: [] };
const b64buf = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
REAL.init = async function () {
  const AS = window.VAC_ASSETS; if (!AS || !T.GLTFLoader) return;
  REAL.mixers = [];
  // 1 · iluminación por imagen (atardecer HDRI) → reflejos y sombras suaves de cielo
  try { if (T.RGBELoader) { const d = new T.RGBELoader().parse(b64buf(AS.hdr)); const tx = new T.DataTexture(d.data, d.width, d.height, T.RGBAFormat, d.type);
    tx.flipY = true; tx.magFilter = tx.minFilter = T.LinearFilter; tx.generateMipmaps = false; tx.mapping = T.EquirectangularReflectionMapping; tx.needsUpdate = true;
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(tx).texture; pm.dispose();
    scene.traverse(o => { if (!o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.isMeshStandardMaterial) m.envMapIntensity = m === M.water ? 1 : 0.5; }); });
    REAL.env = true; if (!night) hemi.intensity = 0.32; } } catch (e) { console.warn('hdr', e); }
  // 2 · pasto fotográfico con relieve
  const img = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const [gI, gN] = await Promise.all([img(AS.grass), img(AS.grassN)]);
  const seen = new Set();
  scene.traverse(o => { if (!o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m.map || !m.map.userData.grass || seen.has(m)) return; seen.add(m);
    m.map.image = gI; m.map.needsUpdate = true; const n = m.map.clone(); n.image = gN; n.encoding = T.LinearEncoding; n.needsUpdate = true; m.normalMap = n; m.normalScale = new T.Vector2(0.7, 0.7);
    m.color.set(m.map.userData.grass); m.needsUpdate = true; }); });
  // 3 · modelos
  const L = new T.GLTFLoader(), parse = b => new Promise((res, rej) => L.parse(b64buf(b), '', res, rej));
  const [GA, GW, GM, GD, GP, GS] = await Promise.all([AS.anims, AS.woman, AS.man, AS.dog, AS.parrot, AS.stork].map(parse));
  const clip = (name, pref) => { const c = GA.animations.find(a => a.name === name).clone(); c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') && !/Hips\./.test(t.name)).map(t => { t = t.clone(); t.name = t.name.replace('mixamorig', pref); return t; }); return c; };
  const norm = (o, h) => { o.updateMatrixWorld(true); let y0 = 1e9, y1 = -1e9, nb = 0; const v = new T.Vector3();
    o.traverse(b => { if (b.isBone) { nb++; b.getWorldPosition(v); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } });
    if (!nb) { const bb = new T.Box3().setFromObject(o); y0 = bb.min.y; y1 = bb.max.y; }
    const k = h / ((y1 - y0) * (nb ? 1.08 : 1)); const g = new T.Group(); o.scale.multiplyScalar(k); o.updateMatrixWorld(true);
    let m = 1e9; o.traverse(b => { if (b.isBone) { b.getWorldPosition(v); m = Math.min(m, v.y); } }); if (nb) o.position.y -= m - 0.07 * h / 1.7; else o.position.y -= y0 * k; g.add(o); return g; };
  const W = { tpl: norm(GW.scene, 1.66), pref: 'mixamorig' }, Mn = { tpl: norm(GM.scene, 1.76), pref: '' };
  [W, Mn].forEach(c => { c.walk = clip('Walk', c.pref); c.idle = clip('Idle', c.pref); c.run = clip('Run', c.pref);
    c.tpl.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 0.6; } }); });
  // a quién se le pone cuerpo realista: los más cercanos al recorrido (bulevar y anillo) y algunos grupos
  const NH = isMobile ? 18 : 64;
  const cand = people.filter(p => (p.path && !p.stroller) || p.mode === 'stand');
  for (let k = 0; k < NH && cand.length; k++) {
    const p = cand.splice(((k * 7919) % cand.length), 1)[0], useMan = k % 2 === 1 || p.jog, C = useMan ? Mn : W;
    const o = T.SkeletonUtils.clone(C.tpl);
    if (useMan) o.traverse(m => { if (m.isMesh && /Outfit_Top|Top/i.test(m.name)) { m.material = m.material.clone(); m.material.color.set(pick(SHIRT)).lerp(new T.Color(1, 1, 1), 0.35); }
      if (m.isMesh && /Outfit_Bottom|Bottom/i.test(m.name)) { m.material = m.material.clone(); m.material.color.set(pick(PANTS)).lerp(new T.Color(1, 1, 1), 0.3); }
      if (m.isMesh && /Headwear|Hat/i.test(m.name) && rnd() < 0.7) m.visible = false; });
    scene.add(o); const mx = new T.AnimationMixer(o);
    const aW = mx.clipAction(C.walk), aI = mx.clipAction(C.idle), aR = mx.clipAction(C.run);
    [aW, aI, aR].forEach(a => { a.play(); a.setEffectiveWeight(0); a.time = rnd() * 2; }); REAL.mixers.push(mx);
    p.hero = { o, mx, aW, aI, aR, k: p.sc };
  }
  // 4 · perros con esqueleto (pelaje café, negro y crema como pastor alemán y criollos)
  const DT = norm(GD.scene, 0.62), dogCols = [0x5a4a40, 0x2a2420, 0x9a8a70, 0x6a5040, 0xd8d0c0];
  DT.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  REAL.dogs = [];
  for (let i = 0; i < ND; i++) { const o = T.SkeletonUtils.clone(DT); const col = new T.Color(dogCols[i % 5]);
    o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.copy(col); } });
    scene.add(o); const mx = new T.AnimationMixer(o), w = mx.clipAction(GD.animations.find(a => a.name === 'Walk')), r = mx.clipAction(GD.animations.find(a => a.name === 'Run')), sv = mx.clipAction(GD.animations.find(a => a.name === 'Survey'));
    [w, r, sv].forEach(a => { a.play(); a.setEffectiveWeight(0); a.time = rnd(); }); REAL.mixers.push(mx); REAL.dogs.push({ o, mx, w, r, sv }); }
  dogB.visible = dogHd.visible = dogLeg.visible = dogTail.visible = false;
  // 5 · aves: loros y garzas sobrevolando el parque y el bulevar
  const birdTpl = (g, size, col) => { const m = g.scene.children[0]; const bb = new T.Box3().setFromObject(m), k = size / bb.getSize(new T.Vector3()).x; return { m, k, clip: g.animations[0], col }; };
  const BP = birdTpl(GP, 0.9, 0x3fae4a), BS = birdTpl(GS, 1.7, 0xf4f2ea);
  const NBD = isMobile ? 10 : 22;
  for (let i = 0; i < NBD; i++) { const tp = i % 3 === 0 ? BS : BP; const m = tp.m.clone(); m.material = m.material.clone(); m.material.color.set(tp.col); if (m.material.vertexColors) m.material.color.set(0xffffff);
    m.scale.setScalar(tp.k); m.castShadow = true; scene.add(m); const mx = new T.AnimationMixer(m); const a = mx.clipAction(tp.clip); a.play(); a.time = rnd(); a.timeScale = tp === BS ? 0.6 : 1.1; REAL.mixers.push(mx);
    const flock = i % 4; REAL.birds.push({ m, cx: flock === 3 ? along(150, 0).x : R(-20, 20), cz: flock === 3 ? along(150, 0).y : R(-20, 20), r: flock === 3 ? R(60, 110) : R(28, 75), h: R(16, 34), a: rnd() * 6.28, v: R(0.16, 0.3) * (flock % 2 ? 1 : -1), ph: rnd() * 6 }); }
  REAL.ready = true;
};
const _hv = new T.Vector3();
REAL.update = function (dt, tt) {
  if (!REAL.ready) return;
  people.forEach(p => { const h = p.hero; if (!h) return; const st = p._st; if (!st) return;
    h.o.position.set(st.x, st.y, st.z); h.o.rotation.y = st.ry; h.o.scale.setScalar(Math.max(0.0001, st.sc)); h.o.visible = st.sc > 0.02;
    const run = !!p.jog, still = st.kind === 'stand' || st.speed < 0.05;
    const tw = still ? 0 : (run ? 0 : 1), ti = still ? 1 : 0, tr = run && !still ? 1 : 0, kk = Math.min(1, dt * 4);
    h.wW = (h.wW || 0) + (tw - (h.wW || 0)) * kk; h.wI = (h.wI || 0) + (ti - (h.wI || 0)) * kk; h.wR = (h.wR || 0) + (tr - (h.wR || 0)) * kk;
    h.aW.setEffectiveWeight(h.wW); h.aI.setEffectiveWeight(h.wI); h.aR.setEffectiveWeight(h.wR);
    h.aW.timeScale = Math.max(0.6, st.speed / 1.25); h.aR.timeScale = Math.max(0.7, st.speed / 2.8); });
  REAL.birds.forEach(b => { b.a += b.v * dt; const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, y = b.h + Math.sin(tt * 0.5 + b.ph) * 3;
    b.m.position.set(x, y, z); b.m.rotation.set(0, Math.atan2(-Math.sin(b.a), Math.cos(b.a)) * (b.v > 0 ? 1 : 1) + (b.v > 0 ? 0 : Math.PI), b.v > 0 ? -0.25 : 0.25); });
  REAL.mixers.forEach(m => m.update(dt));
};
function loadRealism() {
  if (REAL.loading) return; REAL.loading = true;
  const s2 = document.createElement('script'); s2.src = 'realismo_assets.js'; s2.async = true;
  s2.onload = () => REAL.init().catch(e => console.warn('realismo', e));
  document.head.appendChild(s2);
}

/* ============ INTRO: edificios que se levantan, vuelo de llegada y onda de transformación ============ */
let rise = { t0: performance.now() + 500 };
BLD.forEach(b => { b.g.scale.y = 0.001; b.delay = b.d * 6 + rnd() * 260; });
const backOut = k => { const c = 1.5; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function stepRise(now) {
  const t = now - rise.t0; let done = true;
  BLD.forEach(b => { const k = Math.max(0, Math.min(1, (t - b.delay) / 1100)); b.g.scale.y = Math.max(0.001, backOut(k)); if (k < 1) done = false; });
  if (done) rise = null;
}
REV.uC.value.copy(C0); REV.uR.value = 0; setModeUI(false);
cam.position.set(820, 560, 1080); controls.target.set(60, 0, 90);
showPanel(0); setU(0, false);
let introPending = true;
function startIntro() {
  introPending = false; setupComposer(); setTimeout(loadRealism, 600); if (rise) rise.t0 = performance.now() + 150;
  flyTo(VIEW[0][0], VIEW[0][1], 4600);
  fly.then = () => { waveTo(true, C0, 5600, 0); };
}
try { renderer.compile(scene, cam); } catch (e) {}
requestAnimationFrame(frame);
const lBtn = $('btnLayers'), lMenu = $('layerMenu');
if (lBtn) { lBtn.onclick = e => { e.stopPropagation(); lMenu.hidden = !lMenu.hidden; lBtn.setAttribute('aria-expanded', !lMenu.hidden); };
  lMenu.querySelectorAll('[data-layer]').forEach(b => b.onclick = () => { const k = b.dataset.layer; setLayer(k, !LAYERS[k]); if (k === 'zonas' && LAYERS.zonas) { stop(); goPoint(0); } });
  document.addEventListener('click', e => { if (!lMenu.hidden && !lMenu.contains(e.target) && e.target !== lBtn) { lMenu.hidden = true; lBtn.setAttribute('aria-expanded', false); } }); }
document.querySelectorAll('#zlegend [data-z]').forEach(el => { el.onmouseenter = () => highlightZone(el.dataset.z); el.onmouseleave = () => highlightZone(null); });
window.VAC = { _dbg: () => ({ isl: ISLAS.length, isl0: ISLAS[1] && [ISLAS[1].v.x, ISLAS[1].v.y], lg: Object.fromEntries(Object.entries(LG).map(([k, g]) => { let n = 0; g.traverse(o => { if (o.isMesh) n++; }); return [k, [n, g.visible, g.parent === scene]]; })), z: Object.fromEntries(Object.entries(ZMESH).map(([k, g]) => [k, g.children.length])) }), setMode: on => { if (propOn !== on) modeBtn.click(); }, goPoint: n => { stop(); goPoint(n); }, setLayer, highlightZone, layers: LAYERS, overview: () => { stop(); goPoint(0); } };
window.__vac = { REAL: () => REAL, along, renderer, scene, BLD, roadRuns, occ, REV, setU: v => setU(v), get u() { return u; }, freeze(r, c) { wave = null; follow = false; fly = null; rise = null; if (c) REV.uC.value.set(c[0], c[1]); REV.uR.value = r; }, riseAt(k) { BLD.forEach(x => x.g.scale.y = Math.max(0.001, Math.min(1, k * 2 - x.d / 250))); }, view(n) { const v = VIEW[n]; cam.position.copy(v[0]); controls.target.copy(v[1]); }, cam, controls, C0 };
const ld = $('loading'); if (ld) { ld.style.opacity = 0; setTimeout(() => ld.remove(), 700); }
setTimeout(() => { if (ui.hint) ui.hint.style.opacity = 0; }, 7000);
})();

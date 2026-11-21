import * as THREE from 'three';

// Free-hand 3D flight paths for the Creative Studio.
// Strokes drawn on screen are lifted onto a camera-facing plane, given real
// depth (a gentle S-curve in and out of the screen), smoothed into a Catmull-Rom
// curve and rendered as a glowing tube whose light trail follows the flyers.

const tubeVS = /* glsl */ `
varying float vU;
varying vec3 vN;
varying vec3 vV;
void main(){
  vU = uv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const tubeFS = /* glsl */ `
uniform vec3 uColor;
uniform float uHead;
uniform float uTrail;
uniform float uBase;
uniform float uTime;
uniform float uLoop;
uniform float uDir;
varying float vU;
varying vec3 vN;
varying vec3 vV;
void main(){
  float d = (uHead - vU) * uDir;
  if (uLoop > 0.5 && d < 0.0) d += 1.0;
  float trail = d >= 0.0 ? exp(-d / max(uTrail, 0.005)) : 0.0;
  float dash = 0.5 + 0.5*sin(vU*220.0 - uTime*6.0);
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
  float core = 1.0 - rim;
  float a = uBase*(0.35 + 0.35*dash) + trail*(0.6 + 0.6*core);
  vec3 c = uColor * (0.6 + core*0.9) * (uBase*0.6 + trail*2.4) + vec3(1.0)*trail*core*0.5;
  gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
}`;

export class PathSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.paths = [];
    this.settings = { color: '#7cf3ff', width: 1, trail: 0.25, speed: 1, loop: 'loop', depth: 1 };
    this.drawing = null;
    this.preview = null;
    this._plane = new THREE.Plane();
    this._ray = new THREE.Raycaster();
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
  }

  // ---- drawing -------------------------------------------------------
  begin(ndc) {
    this.drawing = { pts: [], ndc: [] };
    this.add(ndc);
  }

  add(ndc) {
    if (!this.drawing) return;
    const last = this.drawing.ndc[this.drawing.ndc.length - 1];
    if (last && Math.hypot(ndc.x - last.x, ndc.y - last.y) < 0.012) return;
    this.drawing.ndc.push(ndc.clone());
    this.camera.getWorldDirection(this._n);
    this._plane.setFromNormalAndCoplanarPoint(this._n, new THREE.Vector3(0, 0, 0));
    this._ray.setFromCamera(ndc, this.camera);
    const hit = this._ray.ray.intersectPlane(this._plane, new THREE.Vector3());
    if (hit) this.drawing.pts.push(hit);
    this.updatePreview();
  }

  updatePreview() {
    const pts = this.drawing?.pts || [];
    if (this.preview) { this.group.remove(this.preview); this.preview.geometry.dispose(); this.preview.material.dispose(); this.preview = null; }
    if (pts.length < 2) return;
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    this.preview = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(this.settings.color).multiplyScalar(2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.preview.renderOrder = 12;
    this.group.add(this.preview);
  }

  end() {
    const d = this.drawing;
    this.drawing = null;
    this.updatePreview();
    if (!d || d.pts.length < 4) return null;
    // Total on-screen length must be meaningful
    let len = 0;
    for (let i = 1; i < d.pts.length; i++) len += d.pts[i].distanceTo(d.pts[i - 1]);
    if (len < 1.5) return null;
    // Lift into 3D: push points in and out along the view direction.
    this.camera.getWorldDirection(this._n);
    const n = d.pts.length;
    const pts = d.pts.map((p, i) => {
      const u = i / (n - 1);
      return p.clone().addScaledVector(this._n, Math.sin(u * Math.PI * 2) * 3.2 * this.settings.depth);
    });
    return this.create(pts.map((p) => p.toArray()), this.settings.color);
  }

  // ---- paths ---------------------------------------------------------
  create(points, color) {
    const vecs = points.map((p) => new THREE.Vector3().fromArray(p));
    // resample for even spacing
    const raw = new THREE.CatmullRomCurve3(vecs, false, 'centripetal');
    const L = raw.getLength();
    const samples = Math.max(24, Math.min(240, Math.round(L * 4)));
    const even = raw.getSpacedPoints(samples);
    const closed = this.settings.loop === 'loop' && even[0].distanceTo(even[even.length - 1]) < L * 0.15;
    const curve = new THREE.CatmullRomCurve3(even, closed, 'centripetal');
    const path = {
      id: Math.random().toString(36).slice(2, 8),
      points: even.map((p) => p.toArray().map((v) => +v.toFixed(3))),
      color,
      curve,
      length: curve.getLength(),
      head: 0,
      dir: 1,
      uniforms: {
        uColor: { value: new THREE.Color(color) }, uHead: { value: 0 }, uTrail: { value: 0.25 },
        uBase: { value: 0.25 }, uTime: { value: 0 }, uLoop: { value: 1 }, uDir: { value: 1 },
      },
    };
    this.buildMesh(path);
    this.paths.push(path);
    return path;
  }

  buildMesh(path) {
    if (path.mesh) { this.group.remove(path.mesh); path.mesh.geometry.dispose(); }
    const segs = Math.max(64, Math.min(600, Math.round(path.length * 10)));
    const geo = new THREE.TubeGeometry(path.curve, segs, 0.028 * this.settings.width, 8, path.curve.closed);
    if (!path.material) {
      path.material = new THREE.ShaderMaterial({
        uniforms: path.uniforms, vertexShader: tubeVS, fragmentShader: tubeFS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
    }
    path.mesh = new THREE.Mesh(geo, path.material);
    path.mesh.renderOrder = 11;
    path.mesh.frustumCulled = false;
    this.group.add(path.mesh);
  }

  setWidth(w) {
    this.settings.width = w;
    clearTimeout(this._wt);
    this._wt = setTimeout(() => this.paths.forEach((p) => this.buildMesh(p)), 80);
  }

  setColor(hex) {
    this.settings.color = hex;
    const p = this.paths[this.paths.length - 1];
    if (p) { p.color = hex; p.uniforms.uColor.value.set(hex); }
  }

  clear() {
    this.paths.forEach((p) => { this.group.remove(p.mesh); p.mesh.geometry.dispose(); p.material.dispose(); });
    this.paths = [];
  }

  undoLast() {
    const p = this.paths.pop();
    if (p) { this.group.remove(p.mesh); p.mesh.geometry.dispose(); p.material.dispose(); }
  }

  serialize() { return this.paths.map((p) => ({ points: p.points, color: p.color })); }

  load(list) {
    this.clear();
    (list || []).forEach((p) => { if (p.points?.length > 3) this.create(p.points, p.color || this.settings.color); });
  }

  // Parameter along a path for a flyer, given the path head and an offset.
  sample(path, offset) {
    let u = path.head - offset;
    const mode = this.settings.loop;
    if (mode === 'loop') u = ((u % 1) + 1) % 1;
    else if (mode === 'pingpong') { const k = ((u % 2) + 2) % 2; u = k > 1 ? 2 - k : k; }
    else u = Math.max(0, Math.min(1, u));
    const pos = path.curve.getPointAt(u);
    const tan = path.curve.getTangentAt(u);
    if (mode === 'pingpong' && path.dir < 0) tan.negate();
    return { pos, tangent: tan, u };
  }

  update(dt, t, speed) {
    const s = this.settings;
    for (const p of this.paths) {
      const du = (dt * speed * s.speed * 3.2) / Math.max(p.length, 1);
      if (s.loop === 'pingpong') {
        p.head += du;
        const k = ((p.head % 2) + 2) % 2;
        p.dir = k > 1 ? -1 : 1;
      } else if (s.loop === 'once') {
        p.head = Math.min(1.0001, p.head + du);
      } else p.head = (p.head + du) % 1;
      const k = ((p.head % 2) + 2) % 2;
      const visHead = s.loop === 'pingpong' ? (k > 1 ? 2 - k : k) : Math.min(1, p.head);
      p.uniforms.uHead.value = visHead;
      p.uniforms.uTrail.value = s.trail;
      p.uniforms.uTime.value = t;
      p.uniforms.uLoop.value = s.loop === 'loop' ? 1 : 0;
      p.uniforms.uDir.value = p.dir;
    }
  }

  restart() { this.paths.forEach((p) => { p.head = 0; p.dir = 1; }); }

  dispose() { this.clear(); }
}

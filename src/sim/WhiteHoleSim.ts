import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as S from "./shaders";

export interface SimParams {
  flowSpeed: number; // 0..3
  spin: number; // 0..3
  bloom: number; // 0..3
  lensing: number; // 0..2
  particleCount: number; // 10k..160k
  jets: boolean;
  shockwaves: boolean;
  autoRotate: boolean;
  timeScale: number; // 0..2
}

export interface SimStats {
  fps: number;
  projectiles: number;
  ejected: number;
  distance: number;
}

export type SimEvent = "throw" | "bounce" | "burst";

const MAX_DISK = 160000;
const MAX_JET = 24000;
const INNER = 1.25;
const OUTER = 22;
// The additive disk is far above 1.0 in HDR, so real bloom strength past ~0.3 whites out the frame.
// The 0..3 UI slider maps onto that usable range.
export const BLOOM_SCALE = 0.1;

/** Renders a scene on top of the current buffer after clearing depth. */
class OverlayPass extends Pass {
  scene: THREE.Scene;
  camera: THREE.Camera;
  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
  }
  render(renderer: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const old = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = old;
  }
}

interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  trail: THREE.Line;
  trailPos: Float32Array;
  heat: number;
  bounced: boolean;
  age: number;
}

interface Shell {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  life: number;
  big: boolean;
}

/** Widen the vertical FOV on portrait screens so the disk is not cropped at the sides. */
export function fovFor(aspect: number) {
  return aspect < 1 ? Math.min(85, 55 / Math.sqrt(aspect)) : 55;
}

export function glowTexture(inner: string, mid: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.2, mid);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Nebula sky sphere plus a twinkling star field; returns the stars material (needs uTime). */
export function buildSpaceBackground(scene: THREE.Scene, pixelRatio: number): THREE.ShaderMaterial {
  const bg = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 32),
    new THREE.ShaderMaterial({
      vertexShader: S.backgroundVert,
      fragmentShader: S.backgroundFrag,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  scene.add(bg);

  const N = 9000;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    // concentrate some stars in a galactic band
    const band = Math.random() < 0.45;
    const y = band ? (Math.random() - 0.5) * 0.35 : u;
    const sy = band ? Math.sqrt(1 - y * y) : s;
    const R = 700;
    pos[i * 3] = Math.cos(th) * sy * R;
    pos[i * 3 + 1] = y * R;
    pos[i * 3 + 2] = Math.sin(th) * sy * R;
    const t = Math.random();
    c.setHSL(t < 0.3 ? 0.6 : t < 0.6 ? 0.12 : 0.02 + Math.random() * 0.1, 0.5 + Math.random() * 0.4, 0.75 + Math.random() * 0.2);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    size[i] = Math.random() < 0.02 ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.8;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const starsMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: S.starsVert,
    fragmentShader: S.starsFrag,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  scene.add(new THREE.Points(g, starsMat));
  return starsMat;
}

export class WhiteHoleSim {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene = new THREE.Scene();
  private bgScene = new THREE.Scene();
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private lensPass: ShaderPass;
  private timer = new THREE.Timer();
  private raf = 0;
  private container: HTMLElement;

  private params: SimParams;
  private flow = 0;
  private rot = 0;
  private time = 0;
  private burst = 0;
  private shellTimer = 0;

  private diskMat!: THREE.ShaderMaterial;
  private diskGeo!: THREE.BufferGeometry;
  private jetMat!: THREE.ShaderMaterial;
  private jetPoints!: THREE.Points;
  private gasMat!: THREE.ShaderMaterial;
  private coreMat!: THREE.ShaderMaterial;
  private core!: THREE.Mesh;
  private glow!: THREE.Sprite;
  private glow2!: THREE.Sprite;
  private starsMat!: THREE.ShaderMaterial;
  private shells: Shell[] = [];
  private pendingShells: { at: number; big: boolean }[] = [];
  private projectiles: Projectile[] = [];
  private stats: SimStats = { fps: 60, projectiles: 0, ejected: 0, distance: 0 };
  private fpsAcc = 0;
  private fpsFrames = 0;
  private shake = 0;
  private onStats?: (s: SimStats) => void;
  private onEvent?: (e: SimEvent) => void;
  private ro: ResizeObserver;

  constructor(
    container: HTMLElement,
    params: SimParams,
    onStats?: (s: SimStats) => void,
    onEvent?: (e: SimEvent) => void
  ) {
    this.container = container;
    this.params = { ...params };
    this.onStats = onStats;
    this.onEvent = onEvent;

    // container can still be 0×0 on the first frame; a zero-size composer floods the console with FBO errors
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer =new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(fovFor(w / h), w / h, 0.05, 2000);
    this.camera.position.set(0, 9, 26);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 120;
    this.controls.autoRotate = params.autoRotate;
    this.controls.autoRotateSpeed = 0.35;

    this.buildBackground();
    this.buildCore();
    this.buildDisk();
    this.buildJets();
    this.buildShells();

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    const bgPass = new RenderPass(this.bgScene, this.camera);
    this.composer.addPass(bgPass);

    this.lensPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          uCenter: { value: new THREE.Vector2(0.5, 0.5) },
          uRadius: { value: 0.05 },
          uAspect: { value: w / h },
          uStrength: { value: params.lensing },
        },
        vertexShader: S.lensVert,
        fragmentShader: S.lensFrag,
        depthTest: false,
        depthWrite: false,
      })
    );
    this.composer.addPass(this.lensPass);
    this.composer.addPass(new OverlayPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), params.bloom * BLOOM_SCALE, 0.4, 0.9);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.applyParams();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.animate();
  }

  // ---------- Build ----------
  private buildBackground() {
    this.starsMat = buildSpaceBackground(this.bgScene, this.renderer.getPixelRatio());
  }

  private buildCore() {
    this.coreMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBurst: { value: 0 } },
      vertexShader: S.coreVert,
      fragmentShader: S.coreFrag,
    });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.coreMat);
    this.scene.add(this.core);

    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture("rgba(255,255,255,1)", "rgba(190,215,255,0.55)"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    this.glow.scale.setScalar(9);
    this.scene.add(this.glow);

    this.glow2 = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture("rgba(160,190,255,0.6)", "rgba(90,110,255,0.18)"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    this.glow2.scale.setScalar(30);
    this.scene.add(this.glow2);

    // the horizon itself is the light source that lights asteroids
    this.scene.add(new THREE.PointLight(0xe4ecff, 4, 0, 0));
    this.scene.add(new THREE.AmbientLight(0x8090b0, 1.8));
  }

  private buildDisk() {
    // Continuous gas layer
    this.gasMat = new THREE.ShaderMaterial({
      uniforms: {
        uFlow: { value: 0 },
        uRot: { value: 0 },
        uInner: { value: INNER },
        uOuter: { value: OUTER },
        uIntensity: { value: 1.2 },
      },
      vertexShader: S.diskGasVert,
      fragmentShader: S.diskGasFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const gas = new THREE.Mesh(new THREE.RingGeometry(INNER, OUTER, 256, 64), this.gasMat);
    gas.rotation.x = -Math.PI / 2;
    // RingGeometry lies in XY; rotate so swirl matches particles (particles use x/z with sin->z)
    gas.scale.y = -1;
    this.scene.add(gas);

    // Particle stream
    const seeds = new Float32Array(MAX_DISK * 4);
    for (let i = 0; i < MAX_DISK * 4; i++) seeds[i] = Math.random();
    this.diskGeo = new THREE.BufferGeometry();
    this.diskGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_DISK * 3), 3));
    this.diskGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    this.diskGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), OUTER * 1.5);
    this.diskMat = new THREE.ShaderMaterial({
      uniforms: {
        uFlow: { value: 0 },
        uRot: { value: 0 },
        uSize: { value: 1.6 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uInner: { value: INNER },
        uOuter: { value: OUTER },
        uBurst: { value: 0 },
        uIntensity: { value: 1.4 },
      },
      vertexShader: S.diskParticlesVert,
      fragmentShader: S.particlesFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(this.diskGeo, this.diskMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  private buildJets() {
    const seeds = new Float32Array(MAX_JET * 4);
    for (let i = 0; i < MAX_JET * 4; i++) seeds[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_JET * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    this.jetMat = new THREE.ShaderMaterial({
      uniforms: {
        uFlow: { value: 0 },
        uRot: { value: 0 },
        uSize: { value: 1.8 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uLength: { value: 28 },
        uBurst: { value: 0 },
        uIntensity: { value: 1.3 },
      },
      vertexShader: S.jetVert,
      fragmentShader: S.particlesFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.jetPoints = new THREE.Points(g, this.jetMat);
    this.jetPoints.frustumCulled = false;
    this.scene.add(this.jetPoints);
  }

  private buildShells() {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color(0.7, 0.85, 1.0) },
          uTime: { value: 0 },
        },
        vertexShader: S.shellVert,
        fragmentShader: S.shellFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shells.push({ mesh, mat, age: 0, life: 1, big: false });
    }
  }

  // ---------- Public API ----------
  setParams(p: SimParams) {
    this.params = { ...p };
    this.applyParams();
  }

  private applyParams() {
    const p = this.params;
    this.bloomPass.strength = p.bloom * BLOOM_SCALE;
    // Bloom at 0 would still cost a full mip-chain blur every frame
    this.bloomPass.enabled = p.bloom > 0;
    this.lensPass.uniforms.uStrength.value = p.lensing;
    this.diskGeo.setDrawRange(0, Math.floor(p.particleCount));
    this.jetPoints.visible = p.jets;
    this.controls.autoRotate = p.autoRotate;
  }

  triggerBurst() {
    this.burst = 1;
    this.shake = 1;
    this.spawnShell(true);
    this.pendingShells.push({ at: this.time + 0.18, big: true }, { at: this.time + 0.38, big: false });
    this.onEvent?.("burst");
  }

  throwMatter() {
    const dir = new THREE.Vector3().subVectors(new THREE.Vector3(), this.camera.position).normalize();
    const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const start = this.camera.position
      .clone()
      .addScaledVector(dir, 4)
      .addScaledVector(right, (Math.random() - 0.5) * 3)
      .addScaledVector(up, -1 + (Math.random() - 0.5) * 1.5);
    const target = new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2);
    const vel = target.sub(start).normalize().multiplyScalar(6 + Math.random() * 2);
    // small tangential offset for orbital curvature
    vel.addScaledVector(right, (Math.random() - 0.5) * 1.5);

    // Icosahedron is non-indexed: merge first so shared corners get the same bump, otherwise faces split apart
    const ico = new THREE.IcosahedronGeometry(0.22 + Math.random() * 0.12, 1);
    ico.deleteAttribute("uv"); // uv seams would keep seam vertices from merging
    ico.deleteAttribute("normal");
    const geo = mergeVertices(ico);
    ico.dispose();
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const s = 0.8 + Math.random() * 0.4;
      p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.5, 0.48), roughness: 0.95, flatShading: true })
    );
    mesh.position.copy(start);
    this.scene.add(mesh);

    const TL = 90;
    const trailPos = new Float32Array(TL * 3);
    for (let i = 0; i < TL; i++) trailPos.set([start.x, start.y, start.z], i * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const tcol = new Float32Array(TL * 3);
    for (let i = 0; i < TL; i++) {
      const f = 1 - i / TL;
      tcol.set([f * 1.0, f * 0.75, f * 0.5], i * 3);
    }
    tg.setAttribute("color", new THREE.BufferAttribute(tcol, 3));
    const trail = new THREE.Line(
      tg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    trail.frustumCulled = false;
    this.scene.add(trail);

    this.projectiles.push({ mesh, vel, trail, trailPos, heat: 0, bounced: false, age: 0 });
    if (this.projectiles.length > 12) this.removeProjectile(this.projectiles[0]);
    this.onEvent?.("throw");
  }

  resetCamera() {
    this.camera.position.set(0, 9, 26);
    this.controls.target.set(0, 0, 0);
  }

  setCameraPreset(preset: "top" | "side" | "close") {
    if (preset === "top") this.camera.position.set(0, 34, 0.01);
    if (preset === "side") this.camera.position.set(30, 0.6, 0);
    if (preset === "close") this.camera.position.set(4.5, 1.8, 6);
    this.controls.target.set(0, 0, 0);
  }

  dispose() {
    this.timer.dispose();
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.composer.dispose();
    for (const sc of [this.scene, this.bgScene]) {
      sc.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) {
          (mat as THREE.SpriteMaterial).map?.dispose();
          mat.dispose();
        }
      });
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- Internals ----------
  private spawnShell(big: boolean) {
    const s = this.shells.find((x) => !x.mesh.visible) ?? this.shells[0];
    s.age = 0;
    s.big = big;
    s.life = big ? 3.2 : 2.6;
    s.mesh.visible = true;
    const c = s.mat.uniforms.uColor.value as THREE.Color;
    if (big) c.setRGB(1.0, 0.95, 0.9);
    else c.setRGB(0.6, 0.8, 1.0);
  }

  private removeProjectile(p: Projectile) {
    this.scene.remove(p.mesh);
    this.scene.remove(p.trail);
    p.mesh.geometry.dispose();
    (p.mesh.material as THREE.Material).dispose();
    p.trail.geometry.dispose();
    (p.trail.material as THREE.Material).dispose();
    this.projectiles = this.projectiles.filter((x) => x !== p);
  }

  private updateProjectiles(dt: number) {
    const tmp = new THREE.Vector3();
    for (const p of [...this.projectiles]) {
      p.age += dt;
      const pos = p.mesh.position;
      const r = Math.max(pos.length(), 0.05);
      tmp.copy(pos).normalize();

      // Gravity outside the horizon is attractive (same Schwarzschild exterior as a black hole)
      const G = 26;
      const acc = tmp.clone().multiplyScalar(-G / (r * r));
      // Outflow pressure: nothing can cross a white hole horizon from outside
      const push = (this.params.flowSpeed + 0.4) * 60 * (1 + this.burst * 4);
      acc.addScaledVector(tmp, push / Math.pow(r, 3.2));
      // radial drag from outflowing stream
      const vr = p.vel.dot(tmp);
      if (r < 5 && vr < 0) acc.addScaledVector(tmp, -vr * 2.2);
      if (r < 3.5) p.heat = Math.min(1, p.heat + dt * 0.9);
      if (r < 1.6) {
        // hard wall
        pos.copy(tmp).multiplyScalar(1.6);
        const vr2 = p.vel.dot(tmp);
        if (vr2 < 0) p.vel.addScaledVector(tmp, -vr2 * 2.2);
      }
      if (!p.bounced && r < 4 && p.vel.dot(tmp) > 0.5) {
        p.bounced = true;
        this.stats.ejected++;
        this.onEvent?.("bounce");
        if (this.params.shockwaves) this.spawnShell(false);
      }
      p.vel.addScaledVector(acc, dt);
      // speed cap
      const sp = p.vel.length();
      if (sp > 40) p.vel.multiplyScalar(40 / sp);
      pos.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 1.3;
      p.mesh.rotation.y += dt * 0.9;

      // glow by heat
      const m = p.mesh.material as THREE.MeshStandardMaterial;
      const h = p.heat;
      m.emissive.setRGB(h * 3.5, h * 2.4, h * 2.6);

      // trail
      const tp = p.trailPos;
      tp.copyWithin(3, 0, tp.length - 3);
      tp[0] = pos.x;
      tp[1] = pos.y;
      tp[2] = pos.z;
      const attr = p.trail.geometry.attributes.position as THREE.BufferAttribute;
      attr.needsUpdate = true;
      const tc = p.trail.geometry.attributes.color as THREE.BufferAttribute;
      const n = tc.count;
      for (let i = 0; i < n; i++) {
        const f = (1 - i / n) * (0.4 + h * 2.5);
        tc.setXYZ(i, f, f * (0.7 + h * 0.2), f * (0.45 + h * 0.6));
      }
      tc.needsUpdate = true;

      if (pos.length() > 140 || p.age > 40) this.removeProjectile(p);
    }
  }

  private updateShells(dt: number) {
    for (const s of this.shells) {
      if (!s.mesh.visible) continue;
      s.age += dt;
      const t = s.age / s.life;
      if (t >= 1) {
        s.mesh.visible = false;
        continue;
      }
      s.mesh.scale.setScalar(1.1 + Math.pow(t, 0.7) * (s.big ? 34 : 18));
      s.mat.uniforms.uOpacity.value = (1 - t) * (s.big ? 1.4 : 0.8);
      s.mat.uniforms.uTime.value = this.time;
    }
  }

  private updateLens() {
    const v = new THREE.Vector3(0, 0, 0).project(this.camera);
    const center = this.lensPass.uniforms.uCenter.value as THREE.Vector2;
    center.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    const dist = this.camera.position.length();
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const behind = v.z > 1;
    this.lensPass.uniforms.uRadius.value = behind ? 0 : (1 / (dist * tanHalf)) * 0.5;
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.fov = fovFor(w / h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
    this.lensPass.uniforms.uAspect.value = w / h;
  }

  private animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    this.timer.update();
    const rawDt = Math.min(this.timer.getDelta(), 0.05);
    const p = this.params;
    const dt = rawDt * p.timeScale;
    this.time += dt;

    // FPS
    this.fpsAcc += rawDt;
    this.fpsFrames++;
    if (this.fpsAcc > 0.5) {
      this.stats.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      this.stats.projectiles = this.projectiles.length;
      this.stats.distance = this.camera.position.length();
      this.onStats?.({ ...this.stats });
    }

    this.burst = Math.max(0, this.burst - rawDt * 0.45);
    const burstBoost = 1 + this.burst * 5;
    this.flow += dt * p.flowSpeed * burstBoost;
    this.rot += dt * p.spin * 0.25;

    // uniforms
    const du = this.diskMat.uniforms;
    du.uFlow.value = this.flow;
    du.uRot.value = this.rot;
    du.uBurst.value = this.burst;
    du.uIntensity.value = 1.5 + this.burst * 1.5;
    const ju = this.jetMat.uniforms;
    ju.uFlow.value = this.flow * 1.4;
    ju.uRot.value = this.rot;
    ju.uBurst.value = this.burst;
    ju.uIntensity.value = 1.5 + this.burst * 1.5;
    this.gasMat.uniforms.uFlow.value = this.flow;
    this.gasMat.uniforms.uRot.value = this.rot;
    this.gasMat.uniforms.uIntensity.value = 1.4 + this.burst;
    this.coreMat.uniforms.uTime.value = this.time;
    this.coreMat.uniforms.uBurst.value = this.burst;
    this.starsMat.uniforms.uTime.value = this.time;

    const pulse = 1 + Math.sin(this.time * 3) * 0.04;
    (this.glow.material as THREE.SpriteMaterial).opacity = 0.95 + this.burst;
    this.glow.scale.setScalar((9 + this.burst * 14) * pulse);
    (this.glow2.material as THREE.SpriteMaterial).opacity = 0.55 + this.burst * 0.8;
    this.glow2.scale.setScalar(30 + this.burst * 30);
    this.core.scale.setScalar(1 + 0.02 * Math.sin(this.time * 7) + this.burst * 0.15);

    // shockwaves
    if (p.shockwaves) {
      this.shellTimer -= dt * Math.max(0.2, p.flowSpeed);
      if (this.shellTimer <= 0) {
        this.shellTimer = 2.4;
        this.spawnShell(false);
      }
    }
    // delayed burst shells run on simulation time, so they pause with the sim and die with dispose()
    this.pendingShells = this.pendingShells.filter((s) => {
      if (this.time < s.at) return true;
      this.spawnShell(s.big);
      return false;
    });
    this.updateShells(dt);
    this.updateProjectiles(dt);

    // camera shake
    this.controls.update();
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - rawDt * 1.2);
      const s = this.shake * this.shake * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }

    this.updateLens();
    this.composer.render(rawDt);
  };
}

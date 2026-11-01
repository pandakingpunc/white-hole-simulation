import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import * as S from "./shaders";
import { BLOOM_SCALE, buildSpaceBackground, fovFor, glowTexture } from "./WhiteHoleSim";
import { capturedFraction, eardleyLifetime, inspiralTime, petersDadt } from "./eardley";

// Collision modes. Everything is in units of the total mass M = 1 (G = c = 1), so lengths and
// times are in M. Only the timing of explosions and sealing comes from the paper (eardley.ts);
// orbits are Newtonian circles shrinking at the Peters rate, and the looks are illustrative.

export type BinaryMode = "wh-wh" | "wh-bh";

export interface BinaryParams {
  mode: BinaryMode;
  a0: number; // initial separation, M
  q: number; // m2/m1, 0.1..1
  logDM: number; // log10 of the perturbation dM/m felt by each white hole
  tExplode: number; // when a white hole would explode on its own, M (Infinity = never)
  instability: boolean; // false = hypothetical white holes that never get sealed
  bloom: number;
  speed: number;
  autoRotate: boolean;
}

export type BodyKind = "white" | "black" | "gone" | "merged";

export interface BodyStatus {
  kind: BodyKind;
  m: number;
  sealAt: number; // M; Infinity if never
  explodeAt: number;
  changedAt: number | null; // when it was sealed or exploded
}

export interface BinaryStats {
  fps: number;
  t: number;
  a: number;
  phase: "inspiral" | "single" | "merged" | "contact" | "empty";
  bodies: BodyStatus[];
  finalMass: number | null;
}

export type BinaryEvent = "sealed" | "exploded" | "domino" | "merged" | "contact";

const MERGE_SEPARATION = 2; // horizons touch: 2 m1 + 2 m2
const TRAIL = 500;
const OUTFLOW = 2600;

const outflowVert = /* glsl */ `
uniform vec3 uCenter;
uniform float uR0;
uniform float uReach;
uniform float uTime;
uniform float uPixelRatio;
attribute vec4 aSeed;
varying vec3 vColor;
varying float vAlpha;
${S.paletteGLSL}
void main(){
  float life = fract(aSeed.w + uTime*(0.25 + 0.2*aSeed.x));
  float th = aSeed.y*6.28318;
  float z = aSeed.z*2.0-1.0;
  vec3 dir = vec3(sqrt(1.0-z*z)*cos(th), z*0.55, sqrt(1.0-z*z)*sin(th));
  vec3 pos = uCenter + normalize(dir)*(uR0 + life*uReach);
  vec4 mv = modelViewMatrix*vec4(pos,1.0);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = (1.4 + aSeed.x)*uPixelRatio*(40.0/-mv.z);
  vColor = heat(1.0 - life*0.9);
  vAlpha = smoothstep(0.0,0.08,life)*(1.0-life);
}
`;

const outflowFrag = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord-0.5);
  float a = smoothstep(0.5,0.0,d);
  gl_FragColor = vec4(vColor*1.6, a*a*vAlpha*uOpacity);
}
`;

/** Warm ring peaking just outside the dark disk: a stand-in for the photon ring. */
function ringTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(0.46, "rgba(0,0,0,0)");
  grd.addColorStop(0.54, "rgba(255,190,110,1)");
  grd.addColorStop(0.66, "rgba(255,110,40,0.45)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Body {
  status: BodyStatus;
  pos: THREE.Vector3;
  group: THREE.Group;
  whiteCore: THREE.Mesh;
  blackCore: THREE.Mesh;
  glow: THREE.Sprite;
  sheet: THREE.Sprite;
  halo: THREE.Sprite;
  outflow: THREE.Points;
  outflowMat: THREE.ShaderMaterial;
  trail: THREE.Line;
  trailPos: Float32Array;
}

interface Flash {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  life: number;
  size: number;
}

interface Ripple {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
}

export class BinarySim {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene = new THREE.Scene();
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private timer = new THREE.Timer();
  private raf = 0;
  private ro: ResizeObserver;
  private container: HTMLElement;
  private starsMat: THREE.ShaderMaterial;
  private coreMat: THREE.ShaderMaterial;

  private params: BinaryParams;
  private bodies: Body[] = [];
  private flashes: Flash[] = [];
  private ripples: Ripple[] = [];
  private t = 0;
  private a = 0;
  private phi = 0;
  private phase: BinaryStats["phase"] = "inspiral";
  private finalMass: number | null = null;
  private visTime = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;
  private onStats?: (s: BinaryStats) => void;
  private onEvent?: (e: BinaryEvent) => void;

  constructor(
    container: HTMLElement,
    params: BinaryParams,
    onStats?: (s: BinaryStats) => void,
    onEvent?: (e: BinaryEvent) => void
  ) {
    this.container = container;
    this.params = { ...params };
    this.onStats = onStats;
    this.onEvent = onEvent;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(fovFor(w / h), w / h, 0.05, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 200;
    this.controls.autoRotateSpeed = 0.3;

    this.starsMat = buildSpaceBackground(this.scene, this.renderer.getPixelRatio());
    this.coreMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBurst: { value: 0 } },
      vertexShader: S.coreVert,
      fragmentShader: S.coreFrag,
    });
    this.scene.add(new THREE.AmbientLight(0xffffff, 1));

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0, 0.4, 0.9);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.reset(params);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.animate();
  }

  // ---------- Public API ----------
  /** Live settings; anything that changes the physics needs reset(). */
  setParams(p: BinaryParams) {
    this.params = { ...p };
    this.bloomPass.strength = p.bloom * BLOOM_SCALE;
    this.bloomPass.enabled = p.bloom > 0;
    this.controls.autoRotate = p.autoRotate;
  }

  reset(p: BinaryParams) {
    this.setParams(p);
    for (const b of this.bodies) this.disposeBody(b);
    for (const f of this.flashes) this.scene.remove(f.mesh);
    for (const r of this.ripples) this.scene.remove(r.mesh);
    this.bodies = [];
    this.flashes = [];
    this.ripples = [];
    this.t = 0;
    this.phi = 0;
    this.a = p.a0;
    this.phase = "inspiral";
    this.finalMass = null;

    const m1 = 1 / (1 + p.q);
    const m2 = p.q / (1 + p.q);
    const kinds: BodyKind[] = p.mode === "wh-wh" ? ["white", "white"] : ["white", "black"];
    [m1, m2].forEach((m, i) => {
      const dM = m * 10 ** p.logDM;
      const sealAt = kinds[i] === "white" && p.instability ? eardleyLifetime(m, dM) : Infinity;
      // only body 1 explodes on its own, so its burst can be seen hitting the partner
      const explodeAt = kinds[i] === "white" && i === 0 ? p.tExplode : Infinity;
      this.bodies.push(this.makeBody({ kind: kinds[i], m, sealAt, explodeAt, changedAt: null }));
    });
    this.placeBodies();
    for (const b of this.bodies) {
      for (let i = 0; i < TRAIL; i++) b.trailPos.set([b.pos.x, b.pos.y, b.pos.z], i * 3);
      b.trail.geometry.attributes.position.needsUpdate = true;
    }

    const d = Math.max(30, p.a0 * 2.2);
    this.camera.position.set(0, d * 0.55, d);
    this.controls.target.set(0, 0, 0);
    this.emitStats();
  }

  resetCamera() {
    const d = Math.max(30, this.params.a0 * 2.2);
    this.camera.position.set(0, d * 0.55, d);
    this.controls.target.set(0, 0, 0);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.timer.dispose();
    this.ro.disconnect();
    this.controls.dispose();
    this.composer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        (mat as THREE.SpriteMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- Build ----------
  private makeBody(status: BodyStatus): Body {
    const group = new THREE.Group();
    const r = 2 * status.m; // horizon radius
    const sphere = new THREE.SphereGeometry(r, 48, 32);
    const whiteCore = new THREE.Mesh(sphere, this.coreMat);
    const blackCore = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture("rgba(255,255,255,1)", "rgba(170,200,255,0.5)"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    glow.scale.setScalar(r * 5);
    // the blue sheet: infalling matter piling up just outside the past horizon
    const sheet = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture("rgba(120,170,255,0.9)", "rgba(60,90,255,0.35)"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      })
    );
    sheet.scale.setScalar(r * 3.2);
    // black-hole look: dark disk (the core) in front of a warm halo
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: ringTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    halo.scale.setScalar(r * 4);
    group.add(whiteCore, blackCore, glow, sheet, halo);
    this.scene.add(group);

    const seeds = new Float32Array(OUTFLOW * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const og = new THREE.BufferGeometry();
    og.setAttribute("position", new THREE.BufferAttribute(new Float32Array(OUTFLOW * 3), 3));
    og.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    const outflowMat = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector3() },
        uR0: { value: r * 1.05 },
        uReach: { value: r * 7 },
        uTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uOpacity: { value: 1 },
      },
      vertexShader: outflowVert,
      fragmentShader: outflowFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const outflow = new THREE.Points(og, outflowMat);
    outflow.frustumCulled = false;
    this.scene.add(outflow);

    const trailPos = new Float32Array(TRAIL * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const tcol = new Float32Array(TRAIL * 3);
    tg.setAttribute("color", new THREE.BufferAttribute(tcol, 3));
    const trail = new THREE.Line(
      tg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    trail.frustumCulled = false;
    this.scene.add(trail);

    const body: Body = { status, pos: new THREE.Vector3(), group, whiteCore, blackCore, glow, sheet, halo, outflow, outflowMat, trail, trailPos };
    this.applyLook(body);
    return body;
  }

  private disposeBody(b: Body) {
    for (const o of [b.group, b.outflow, b.trail]) {
      this.scene.remove(o);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat && mat !== this.coreMat) {
          (mat as THREE.SpriteMaterial).map?.dispose();
          mat.dispose();
        }
      });
    }
  }

  private applyLook(b: Body) {
    const k = b.status.kind;
    b.group.visible = k === "white" || k === "black";
    b.whiteCore.visible = k === "white";
    b.glow.visible = k === "white";
    b.sheet.visible = k === "white";
    b.outflow.visible = k === "white";
    b.blackCore.visible = k === "black";
    b.halo.visible = k === "black";
    const tc = b.trail.geometry.attributes.color as THREE.BufferAttribute;
    const [cr, cg, cb] = k === "white" ? [0.55, 0.7, 1] : [1, 0.55, 0.25];
    for (let i = 0; i < TRAIL; i++) {
      const f = (1 - i / TRAIL) * 0.6;
      tc.setXYZ(i, cr * f, cg * f, cb * f);
    }
    tc.needsUpdate = true;
  }

  // ---------- Events ----------
  private flash(at: THREE.Vector3, size: number, color: [number, number, number], life = 2.2) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 1 }, uColor: { value: new THREE.Color(...color) }, uTime: { value: 0 } },
      vertexShader: S.shellVert,
      fragmentShader: S.shellFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat);
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.flashes.push({ mesh, mat, age: 0, life, size });
  }

  private ripple(at: THREE.Vector3) {
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9fc4ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 128), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(at);
      this.scene.add(mesh);
      this.ripples.push({ mesh, mat, age: -i * 0.35 });
    }
  }

  private seal(b: Body) {
    b.status.kind = "black";
    b.status.changedAt = this.t;
    this.applyLook(b);
    this.flash(b.pos, 6 * b.status.m, [0.6, 0.75, 1.0], 1.6);
    this.onEvent?.("sealed");
  }

  private explode(b: Body) {
    b.status.kind = "gone";
    b.status.changedAt = this.t;
    this.applyLook(b);
    this.flash(b.pos, 30, [1.0, 0.95, 0.9], 3);
    this.onEvent?.("exploded");
    // the burst reaches the partner after a light-travel time a and acts as a big dM on it
    const other = this.bodies.find((x) => x !== b && x.status.kind === "white");
    if (other && this.params.instability) {
      const dM = capturedFraction(other.status.m, this.a) * b.status.m;
      const sealAt = this.t + this.a + eardleyLifetime(other.status.m, dM);
      if (sealAt < other.status.sealAt) {
        other.status.sealAt = sealAt;
        this.onEvent?.("domino");
      }
    }
  }

  // ---------- Simulation ----------
  private alive() {
    return this.bodies.filter((b) => b.status.kind === "white" || b.status.kind === "black");
  }

  private placeBodies() {
    const [b1, b2] = this.bodies;
    const m1 = b1.status.m;
    const m2 = b2.status.m;
    const M = m1 + m2;
    b1.pos.set(Math.cos(this.phi), 0, Math.sin(this.phi)).multiplyScalar((-m2 / M) * this.a);
    b2.pos.set(Math.cos(this.phi), 0, Math.sin(this.phi)).multiplyScalar((m1 / M) * this.a);
  }

  /** Simulation time to advance per real second. Slow while a white hole's fate is pending, so it is visible. */
  private rate() {
    const base = 60 * this.params.speed;
    const pending = this.bodies.some(
      (b) => b.status.kind === "white" && Number.isFinite(Math.min(b.status.sealAt, b.status.explodeAt))
    );
    if (pending || this.phase !== "inspiral") return base;
    const eta = (this.bodies[0].status.m * this.bodies[1].status.m) / 1;
    return base + (this.params.speed * inspiralTime(this.a, 1, eta)) / 8;
  }

  private step(dt: number) {
    // fates of the white holes inside this step, in time order
    for (const b of this.bodies) {
      if (b.status.kind !== "white") continue;
      const s = b.status;
      const fateAt = Math.min(s.sealAt, s.explodeAt);
      if (this.t + dt < fateAt) continue;
      if (s.explodeAt <= s.sealAt) this.explode(b);
      else this.seal(b);
    }

    if (this.phase === "inspiral") {
      const alive = this.alive();
      if (alive.length === 2) {
        const [b1, b2] = this.bodies;
        const eta = b1.status.m * b2.status.m;
        const touching = this.a <= MERGE_SEPARATION;
        if (touching) {
          if (b1.status.kind === "black" && b2.status.kind === "black") this.merge();
          else {
            // a white-hole horizon touching another horizon: no known solution, so stop here
            this.phase = "contact";
            this.onEvent?.("contact");
          }
        } else {
          const a4 = this.a ** 4 + 4 * petersDadt(1, 1, eta) * dt; // exact: d(a^4)/dt is constant
          this.a = Math.max(MERGE_SEPARATION, a4 > 0 ? Math.sqrt(Math.sqrt(a4)) : 0);
          this.phi += Math.sqrt(1 / this.a ** 3) * dt;
          this.placeBodies();
        }
      } else if (alive.length === 1) {
        this.phase = "single";
      } else {
        this.phase = "empty";
      }
    }
    if (this.phase === "single") {
      // the survivor drifts to the centre and stays
      const b = this.alive()[0];
      b?.pos.multiplyScalar(Math.exp(-dt / 400));
    }
    this.t += dt;
  }

  private merge() {
    const [b1, b2] = this.bodies;
    const eta = b1.status.m * b2.status.m;
    // illustrative fit: about 4.8% of the mass radiated for equal masses, scaling with (4 eta)^2
    this.finalMass = 1 - 0.048 * (4 * eta) ** 2;
    const com = new THREE.Vector3();
    b2.status.kind = "merged";
    this.applyLook(b2);
    b1.pos.copy(com);
    // the sphere was built with radius 2 m1; grow it to the final horizon 2 M_f
    b1.group.scale.setScalar(this.finalMass / b1.status.m);
    b1.status.m = this.finalMass;
    this.phase = "merged";
    this.flash(com, 18, [0.8, 0.9, 1.0], 2.6);
    this.ripple(com);
    this.onEvent?.("merged");
  }

  private emitStats() {
    this.onStats?.({
      fps: this.fps,
      t: this.t,
      a: this.a,
      phase: this.phase,
      bodies: this.bodies.map((b) => ({ ...b.status })),
      finalMass: this.finalMass,
    });
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
  }

  private animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    this.timer.update();
    const rawDt = Math.min(this.timer.getDelta(), 0.05);
    this.visTime += rawDt;

    if (this.phase === "inspiral" || this.phase === "single") {
      // sub-step so a fast playback never jumps over a white hole's deadline
      const total = this.rate() * rawDt;
      const n = Math.max(1, Math.ceil(total / 20));
      for (let i = 0; i < n; i++) this.step(total / n);
    }

    for (const b of this.bodies) {
      b.group.position.copy(b.pos);
      b.outflowMat.uniforms.uCenter.value.copy(b.pos);
      b.outflowMat.uniforms.uTime.value = this.visTime;
      if (b.status.kind === "white") {
        // the blue sheet brightens as the deadline approaches
        const age = this.t / Math.min(b.status.sealAt, 1e9);
        (b.sheet.material as THREE.SpriteMaterial).opacity = Number.isFinite(b.status.sealAt) ? Math.min(1, age ** 3 * 1.4) : 0;
        b.glow.scale.setScalar(10 * b.status.m * (1 + 0.04 * Math.sin(this.visTime * 3)));
      }
      const shown = b.status.kind === "white" || b.status.kind === "black";
      if (this.phase === "inspiral" && shown) {
        const tp = b.trailPos;
        tp.copyWithin(3, 0, tp.length - 3);
        tp[0] = b.pos.x;
        tp[1] = b.pos.y;
        tp[2] = b.pos.z;
        b.trail.geometry.attributes.position.needsUpdate = true;
      }
      b.trail.visible = this.phase === "inspiral" && shown;
    }
    this.coreMat.uniforms.uTime.value = this.visTime;
    this.starsMat.uniforms.uTime.value = this.visTime;

    for (const f of [...this.flashes]) {
      f.age += rawDt;
      const k = f.age / f.life;
      if (k >= 1) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mat.dispose();
        this.flashes = this.flashes.filter((x) => x !== f);
        continue;
      }
      f.mesh.scale.setScalar(0.5 + Math.pow(k, 0.6) * f.size);
      f.mat.uniforms.uOpacity.value = (1 - k) * 1.3;
      f.mat.uniforms.uTime.value = this.visTime;
    }
    for (const r of [...this.ripples]) {
      r.age += rawDt;
      if (r.age < 0) continue;
      const k = r.age / 4;
      if (k >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mat.dispose();
        this.ripples = this.ripples.filter((x) => x !== r);
        continue;
      }
      r.mesh.scale.setScalar(2 + k * 60);
      r.mat.opacity = (1 - k) * 0.6;
    }

    this.fpsAcc += rawDt;
    this.fpsFrames++;
    if (this.fpsAcc > 0.25) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      this.emitStats();
    }

    this.controls.update();
    this.composer.render(rawDt);
  };
}

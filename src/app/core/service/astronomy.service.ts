import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// --- Declutter: show only labels near screen center and above horizon ---
type DeclutterOpts = {
  /** Max labels on screen */
  maxLabels?: number;
  /** NDC radius from center (0=center .. 1=screen corner); smaller = stricter */
  radius?: number;
  /** Throttle updates (ms) to save CPU */
  throttleMs?: number;
};

export type BibleStar = {
  name: string;          // "Genesis 1"
  ra_h: number;          // 0..24
  dec_d: number;         // -90..+90 (your JSON keeps these >0)
  book?: string;         // short code like "GEN"
  chapter?: number;      // 1..n
  testament?: string;    // "Old" | "New"
  division?: string;     // e.g. "The Law"
  division_color?: string; // "#rrggbb"
  verses?: number;
  icon?: string;
};

@Injectable({ providedIn: 'root' })
export class AstronomyService {
  constructor(private http: HttpClient) {}

  private readonly DATA_URL = '/stars.json';

  private starsData?: BibleStar[];
  private starsDataPromise?: Promise<BibleStar[]>;

  // --- PUBLIC API -----------------------------------------------------------

  async loadStarsData(): Promise<BibleStar[]> {
    if (this.starsData) return this.starsData;
    if (!this.starsDataPromise) {
      const url = new URL(this.DATA_URL, document.baseURI).toString();
      this.starsDataPromise = firstValueFrom(this.http.get<BibleStar[]>(url)).then(d => {
        this.starsData = d;
        return d;
      });
    }
    return this.starsDataPromise;
  }

  /** Stars as additive glowy points (shader) */
  createStars(radius = 1000): THREE.Points {
    const geo = new THREE.BufferGeometry();
    // empty; we’ll fill after JSON loads
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(0), 3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(new Float32Array(0), 1));
    geo.setAttribute('aLum',     new THREE.BufferAttribute(new Float32Array(0), 1));

    const mat = this.makeStarShader();
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;

    this.loadStarsData().then(data => {
      const n = data.length;
      const pos  = new Float32Array(n * 3);
      const col  = new Float32Array(n * 3);
      const size = new Float32Array(n);
      const lum  = new Float32Array(n);

      // normalize verses for brightness/size
      let vMin = Infinity, vMax = -Infinity;
      for (const s of data) {
        if (typeof s.verses === 'number') {
          vMin = Math.min(vMin, s.verses);
          vMax = Math.max(vMax, s.verses);
        }
      }
      if (!isFinite(vMin) || !isFinite(vMax) || vMin === vMax) { vMin = 10; vMax = 50; }

      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const s = data[i];
        v.copy(this.raDecToVec(s.ra_h, s.dec_d, radius));
        pos.set([v.x, v.y, v.z], i * 3);

        const c = this.hexToRgb01(s.division_color || '#9fbfff');
        col.set(c, i * 3);

        const t = Math.sqrt((Math.max(vMin, Math.min(vMax, s.verses ?? vMin)) - vMin) / (vMax - vMin + 1e-6));
        size[i] = 2.0 + t * 7.0; // 2..9 px
        lum[i]  = t;             // 0..1
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      g.setAttribute('aSize',    new THREE.BufferAttribute(size, 1));
      g.setAttribute('aLum',     new THREE.BufferAttribute(lum, 1));
      g.computeBoundingSphere?.();

      points.geometry.dispose();
      points.geometry = g;
    });

    return points;
  }

  /** Constellations per book = line through its chapters (in order) */
  createBookConstellations(radius = 1000): THREE.Group {
    const group = new THREE.Group();
    this.loadStarsData().then(data => {
      const byBook = this.groupBy(data, s => s.book || s.name.split(' ')[0]);
      for (const [book, arr] of byBook) {
        const chapters = arr
          .slice()
          .sort((a,b) => (a.chapter ?? 0) - (b.chapter ?? 0));
        if (chapters.length < 2) continue;

        const pts = chapters.map(s => this.raDecToVec(s.ra_h, s.dec_d, radius - 1));
        const col = new THREE.Color(this.hexToRgb01(chapters[0].division_color || '#6ea8ff').map(x => x) as any);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: col.getHex(), transparent: true, opacity: 0.45 });
        group.add(new THREE.Line(geo, mat));
      }
    });
    return group;
  }

  /** Optional: label every star (book + chapter) */
  createStarLabels(radius = 1000, opts: { fontSize?: number; pad?: number; useIcon?: boolean } = {}): THREE.Group {
    const { fontSize = 22, pad = 6, useIcon = true } = opts;
    const group = new THREE.Group();
    group.renderOrder = 2;

    this.loadStarsData().then(data => {
      for (const s of data) {
        const text = `${useIcon && s.icon ? s.icon + ' ' : ''}${s.name}`;
        const spr = this.makeSprite(text, fontSize, pad);
        const p = this.raDecToVec(s.ra_h, s.dec_d, radius - 2);
        spr.position.copy(p);
        // world scale ~2 units per pixel at radius ~1000
        const w = spr.material.map!.image.width;
        const h = spr.material.map!.image.height;
        const worldPerPx = 2.0;
        spr.scale.set(w * worldPerPx, h * worldPerPx, 1);
        group.add(spr);
      }
    });

    return group;
  }

  // --- SHADERS / HELPERS ----------------------------------------------------

  private makeStarShader(): THREE.ShaderMaterial {
    const uniforms = {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    };

    const vert = `
      attribute float aSize;
      attribute float aLum;
      varying vec3 vColor;
      varying float vLum;
      void main() {
        vColor = color;
        vLum = aLum;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio;
      }
    `;

    const frag = `
      precision mediump float;
      varying vec3 vColor;
      varying float vLum;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        if (r > 1.0) discard;

        float core = 1.0 - smoothstep(0.0, 1.0, r);
        float halo = smoothstep(0.4, 1.0, r);

        vec3 col = mix(vec3(1.0), vColor, core);
        float bright = 0.65 + 0.6 * clamp(vLum, 0.0, 1.0);
        float a = max(core, halo * 0.6) * bright;

        gl_FragColor = vec4(col * bright, a);
      }
    `;

    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
  }

  private groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
    const m = new Map<K, T[]>();
    for (const it of arr) {
      const k = key(it);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return m;
  }

  raDecToVec(ra_h: number, dec_d: number, r = 1000): THREE.Vector3 {
    const ra = ra_h * (Math.PI * 2 / 24);
    const dec = THREE.MathUtils.degToRad(dec_d);
    return new THREE.Vector3(
      r * Math.cos(dec) * Math.cos(ra),
      r * Math.sin(dec),
      r * Math.cos(dec) * Math.sin(ra),
    );
    // y is "altitude" at latitude=0; your skyGroup tilt handles latitude
  }

  private hexToRgb01(hex: string): [number, number, number] {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return [0.75, 0.85, 1.0];
    return [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255];
  }

  private makeSprite(text: string, fs = 22, pad = 6): THREE.Sprite {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = `${fs}px system-ui, -apple-system, Segoe UI, Inter, Roboto`;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = fs + pad * 2;
    c.width = w; c.height = h;

    ctx.font = `${fs}px system-ui, -apple-system, Segoe UI, Inter, Roboto`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#e5e7eb'; ctx.fillText(text, pad, h/2);

    const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
    return new THREE.Sprite(mat);
  }

  private _declutterLast = 0;
  private _tmpWorld = new THREE.Vector3();
  private _tmpNdc   = new THREE.Vector3();

  /**
   * Toggle visibility on label sprites inside `group` based on screen-center proximity.
   * Call this in your render loop (it's internally throttled).
   */
  updateLabelDecluttering(
    group: THREE.Group,
    camera: THREE.Camera,
    opts: DeclutterOpts = {}
  ) {
    const now = performance.now();
    const throttleMs = opts.throttleMs ?? 120;
    if (now - this._declutterLast < throttleMs) return;
    this._declutterLast = now;

    const radius = opts.radius ?? 0.65;     // 0.65 ≈ central circle
    const max    = opts.maxLabels ?? 80;    // cap visible labels

    // Collect candidates with their distance from screen center
    const candidates: { i: number; d: number; spr: THREE.Sprite }[] = [];
    const N = group.children.length;

    for (let i = 0; i < N; i++) {
      const spr = group.children[i] as THREE.Sprite;
      if (!spr) continue;

      // WORLD position (account for skyGroup rotation)
      spr.getWorldPosition(this._tmpWorld);

      // Horizon cull (world y≤0 means below horizon plane)
      if (this._tmpWorld.y <= 0.0) { spr.visible = false; continue; }

      // Project to NDC
      this._tmpNdc.copy(this._tmpWorld).project(camera);

      // Behind camera / outside clip
      if (this._tmpNdc.z < -1.0 || this._tmpNdc.z > 1.0) { spr.visible = false; continue; }

      const dist = Math.hypot(this._tmpNdc.x, this._tmpNdc.y); // 0 center .. ~1 corner
      if (dist <= radius) candidates.push({ i, d: dist, spr });
      else spr.visible = false; // outside circle
    }

    // Show closest K; hide the rest
    candidates.sort((a, b) => a.d - b.d);
    for (let i = 0; i < candidates.length; i++) {
      const { spr } = candidates[i];
      spr.visible = i < max;
    }
  }

}

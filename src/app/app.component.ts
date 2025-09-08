import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AstronomyService } from './core/service/astronomy.service';
import { HudComponent } from './components/hud/hud.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HudComponent],
  template: `
    <div #rendererContainer></div>
    <app-hud
      (timeChange)="onTimeChange($event)"
      (latitudeChange)="onLatitudeChange($event)"
      (fovChange)="onFovChange($event)"
      (toggleLabels)="onToggleLabels()"
      (toggleConstellations)="onToggleConstellations()"
    ></app-hud>
  `,
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef<HTMLDivElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  /** Rotating sky (stars + constellations + labels) */
  private skyGroup!: THREE.Group;
  /** Static landscape (ground + horizon glow + skyline) */
  private groundGroup!: THREE.Group;

  private stars!: THREE.Points;
  private constellations!: THREE.Group;
  private labels!: THREE.Group;

  private rafId = 0;

  constructor(private astronomyService: AstronomyService) {}

  // ---------------- Lifecycle ----------------
  ngAfterViewInit() {
    this.initThree();
    this.initLandscape();   // ground hemisphere + glow ring + skyline
    this.addSky();          // stars/labels/constellations inside rotating skyGroup
    this.animate();
    window.addEventListener('resize', this.onWindowResize);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onWindowResize);
    cancelAnimationFrame(this.rafId);
    this.controls?.dispose();
    this.renderer?.dispose();

    // dispose geometries/materials
    this.scene?.traverse((obj: any) => {
      obj.geometry?.dispose?.();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach(mm => mm?.dispose?.());
      else m?.dispose?.();
    });
  }

  // ---------------- Init ----------------
  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Put camera essentially at the center of the celestial sphere
    this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 5000);
    this.camera.position.set(0, 0, 0.01);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 1);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableRotate = true;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    // Clamp look so you cannot dip below the horizon
    this.controls.minPolarAngle = 0.02;                // ≈ straight up (0 = zenith)
    this.controls.maxPolarAngle = Math.PI / 2 - 0.01;  // stop at horizon

    this.skyGroup = new THREE.Group();
    this.groundGroup = new THREE.Group();

    // Depth order clarity: ground first (static), then sky (rotating)
    this.scene.add(this.groundGroup);
    this.scene.add(this.skyGroup);

    // Make sure the radius matches the sphere you placed your stars on.
    // If you used ~990/1000 for stars, use the same here.
    this.labels = this.astronomyService.createStarLabels(1000, {
      useIcon: true,          // show the emoji from stars.json if present
      fontSize: 22,           // tweak to taste
      pad: 6,
      textColor: '#e5e7eb',
      bg: 'rgba(0,0,0,0.45)'
    });
    this.skyGroup.add(this.labels);

  }

  /** Ground hemisphere + soft horizon glow + skyline (Stellarium-like) */
  private initLandscape() {
    const r = 995;

    // 1) Inside-facing lower hemisphere that WRITES DEPTH (occludes stars below horizon)
    const hemiGeo = new THREE.SphereGeometry(
      r, 64, 32,
      0, Math.PI * 2,
      Math.PI / 2, Math.PI // only the lower half (y <= 0)
    );
    hemiGeo.scale(-1, 1, 1); // invert normals to render from inside

    // Vertex color gradient: darker nadir → lighter near horizon
    const vCount = hemiGeo.attributes['position'].count;
    const colors = new Float32Array(vCount * 3);
    const posAttr = hemiGeo.attributes['position'] as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < vCount; i++) {
      const y = posAttr.getY(i); // [-r, 0]
      const t = THREE.MathUtils.clamp(1 - Math.abs(y) / r, 0, 1);
      // mix(#061017, #152335)
      c.setRGB(
        THREE.MathUtils.lerp(0x06/255, 0x15/255, t),
        THREE.MathUtils.lerp(0x10/255, 0x23/255, t),
        THREE.MathUtils.lerp(0x17/255, 0x35/255, t),
      );
      colors[i*3+0] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
    }
    hemiGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const groundMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
      depthWrite: true,  // crucial: occlude stars under horizon
      depthTest: true
    });
    const ground = new THREE.Mesh(hemiGeo, groundMat);
    this.groundGroup.add(ground);

    // 2) Subtle horizon glow ring (transparent)
    const inner = 980, outer = 1000;
    const ringGeo = new THREE.RingGeometry(inner, outer, 128);
    ringGeo.rotateX(-Math.PI / 2); // lie in XZ plane at y=0

    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uInner: { value: inner },
        uOuter: { value: outer },
        uColor: { value: new THREE.Color(0x7aa2ff) }, // bluish dusk
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying vec3 vPos;
        uniform float uInner;
        uniform float uOuter;
        uniform vec3 uColor;
        void main() {
          float r = length(vPos.xy);
          float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
          float a = (1.0 - t) * 0.35; // fade outward
          gl_FragColor = vec4(uColor, a);
        }
      `
    });
    const glow = new THREE.Mesh(ringGeo, ringMat);
    glow.position.y = 0.0;
    this.groundGroup.add(glow);

    // 3) Skyline band (PNG with transparent sky, opaque ground)
    this.addSkylineCylinder({
      radius: 990,
      height: 260,    // tweak 200–320 for your taste
      repeatsX: 1,
      yTop: 0,
      textureUrl: 'assets/horizon_silhouette_forest_4096x1024.png'
    });
  }

  /** Adds a 360° skyline band around the horizon using a transparent PNG. */
  private addSkylineCylinder(opts?: {
    radius?: number;
    height?: number;
    repeatsX?: number;
    yTop?: number;
    textureUrl?: string;
  }) {
    const {
      radius = 990,
      height = 260,
      repeatsX = 1,
      yTop = 0,
      textureUrl = 'assets/horizons/horizon_silhouette_forest_4096x1024.png'
    } = opts || {};

    const loader = new THREE.TextureLoader();
    loader.load(textureUrl, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;   // no vertical tiling
      tex.repeat.set(repeatsX, 1);
      tex.offset.set(0, 0);
      tex.flipY = false;
      const aniso = (this.renderer.capabilities.getMaxAnisotropy?.() ?? 1);
      // @ts-ignore - set if supported
      tex.anisotropy = aniso;

      // Open-ended cylinder centered at y=0; move so its TOP sits at yTop (horizon)
      const radialSegs = 256;
      const cylGeo = new THREE.CylinderGeometry(
        radius, radius, height, radialSegs, 1, /*openEnded=*/true
      );

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.FrontSide,
        depthTest: true,
        depthWrite: true,     // solid parts occlude stars
        alphaTest: 0.02       // discard near-transparent pixels for crisp depth
      });

      const skyline = new THREE.Mesh(cylGeo, mat);
      skyline.position.y = yTop - (height / 2); // align top edge with horizon
      skyline.renderOrder = 1; // after ground; depth still rules
      this.groundGroup.add(skyline);
    });
  }

  /** Build the rotating sky with your AstronomyService */
  private addSky() {
    this.stars = this.astronomyService.createStars(1000);
    // Ensure star material plays nice with horizon occlusion
    const sm = this.stars.material as THREE.PointsMaterial;
    sm.depthWrite = false;                       // don't overwrite depth buffer
    sm.depthTest = true;                         // but still test against ground depth
    sm.transparent = true;
    sm.blending = THREE.AdditiveBlending;
    // sm.sizeAttenuation = false; // optional for constant pixel size

    this.constellations = this.astronomyService.createConstellations(500);
    this.labels = this.astronomyService.createLabels(500);

    this.skyGroup.add(this.stars);
    this.skyGroup.add(this.constellations);
    this.skyGroup.add(this.labels);
  }

  // ---------------- Animation ----------------
  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ---------------- Events ----------------
  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // ---------------- HUD handlers (unchanged API) ----------------
  onTimeChange(time: number) {
    const angle = (time / 24) * 2 * Math.PI;
    this.skyGroup.rotation.y = angle; // rotate sky around Y = time
  }

  onLatitudeChange(latitude: number) {
    const angle = (90 - latitude) * Math.PI / 180;
    this.skyGroup.rotation.x = angle; // tilt pole altitude ~= latitude
  }

  onFovChange(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  onToggleLabels() {
    if (this.labels) this.labels.visible = !this.labels.visible;
  }

  onToggleConstellations() {
    if (this.constellations) this.constellations.visible = !this.constellations.visible;
  }

}

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
    <div #rendererContainer class="w-full h-full"></div>
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
  /** Static landscape (ground + horizon glow) */
  private groundGroup!: THREE.Group;

  private stars!: THREE.Points;
  private constellations!: THREE.Group;
  private labels!: THREE.Group;
  private rafId = 0;

  constructor(private astronomyService: AstronomyService) {}

  ngAfterViewInit() {
    this.initThree();
    this.initLandscape();   // ground hemisphere + horizon glow
    this.addSky();          // stars + book-constellations + labels
    this.animate();
    window.addEventListener('resize', this.onWindowResize);
  }
  ngOnDestroy() {
    window.removeEventListener('resize', this.onWindowResize);
    cancelAnimationFrame(this.rafId);
    this.controls?.dispose();
    this.renderer?.dispose();
  }

  // ------------------ setup ------------------

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 5000);
    this.camera.position.set(0, 0, 0.01);
    this.camera.up.set(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 1);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
    (this.renderer.domElement.style as any).touchAction = 'none';

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableRotate = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.screenSpacePanning = false;

    // yaw free
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle =  Infinity;
    this.camera.up.set(0,1,0);
    const EPS = THREE.MathUtils.degToRad(0.5);
    this.controls.minPolarAngle = EPS;                 // ~0° (zenith)
    this.controls.maxPolarAngle = Math.PI/2 - EPS;     // ~90° (horizon)
    this.controls.update();

    this.skyGroup = new THREE.Group();
    this.groundGroup = new THREE.Group();
    this.scene.add(this.groundGroup);
    this.scene.add(this.skyGroup);
  }

  /** Ground hemisphere + soft horizon glow */
  private initLandscape() {
    const r = 995;

    // inside-facing lower hemisphere that WRITES depth (hides below-horizon stars)
    const hemi = new THREE.SphereGeometry(r, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI);
    hemi.scale(-1, 1, 1);

    // vertex color gradient (darker down, brighter near horizon)
    const count = hemi.attributes['position'].count;
    const colors = new Float32Array(count * 3);
    const yArr = hemi.attributes['position'] as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const y = yArr.getY(i); // [-r,0]
      const t = THREE.MathUtils.clamp(1 - Math.abs(y) / r, 0, 1);
      c.setRGB(
        THREE.MathUtils.lerp(0x06/255, 0x15/255, t),
        THREE.MathUtils.lerp(0x10/255, 0x23/255, t),
        THREE.MathUtils.lerp(0x17/255, 0x35/255, t)
      );
      colors.set([c.r, c.g, c.b], i * 3);
    }
    hemi.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const groundMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
      depthWrite: true,   // important: occlude stars under horizon
      depthTest: true
    });
    this.groundGroup.add(new THREE.Mesh(hemi, groundMat));

    // subtle horizon glow (thin ring in XZ plane at y=0)
    const inner = 980, outer = 1000;
    const ringGeo = new THREE.RingGeometry(inner, outer, 128);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uInner: { value: inner },
        uOuter: { value: outer },
        uColor: { value: new THREE.Color(0x7aa2ff) }
      },
      vertexShader: `
        varying vec2 vXY;
        void main() {
          vXY = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying vec2 vXY;
        uniform float uInner;
        uniform float uOuter;
        uniform vec3 uColor;
        void main(){
          float r = length(vXY);
          float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
          float a = (1.0 - t) * 0.35;
          gl_FragColor = vec4(uColor, a);
        }
      `
    });
    const glow = new THREE.Mesh(ringGeo, ringMat);
    glow.position.y = 0;
    this.groundGroup.add(glow);
  }

  private addSky() {
    // stars
    this.stars = this.astronomyService.createStars(1000);
    (this.stars.material as THREE.Material).depthWrite = false;
    (this.stars.material as THREE.Material).transparent = true;
    this.skyGroup.add(this.stars);

    // book constellations
    this.constellations = this.astronomyService.createBookConstellations(1000, {
      extraNearestPerNode: 1,
      opacity: 0.55,
      fadeLow: -80,  // start fading slightly below horizon
      fadeHigh: 120  // fully visible when well above horizon
    });
    this.skyGroup.add(this.constellations);

    // labels (optional – comment out if too dense)
    this.labels = this.astronomyService.createStarLabels(1000, { fontSize: 22, pad: 6, useIcon: true });
    this.labels.visible = true;
    this.skyGroup.add(this.labels);
  }

  // ------------------ HUD hooks ------------------

  onTimeChange(time: number) {
    // rotate sky around vertical
    this.skyGroup.rotation.y = (time / 24) * Math.PI * 2;
  }
  onLatitudeChange(latDeg: number) {
    // tilt to set pole altitude
    this.skyGroup.rotation.x = THREE.MathUtils.degToRad(90 - latDeg);
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

  // ------------------ loop / resize ------------------

  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate);
    this.controls.update();

    if (this.labels) {
      this.astronomyService.updateLabelFading(this.labels, this.camera, {
        maxLabels: 120,     // try 40–120
        radius: 0.75,      // 0.55 tighter, 0.75 looser
        throttleMs: 240,   // compute targets ~8 Hz
        fadeInMs: 100,     // faster in
        fadeOutMs: 100     // slightly slower out
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}

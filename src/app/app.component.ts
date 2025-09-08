
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
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private skyGroup!: THREE.Group;
  private stars!: THREE.Points;
  private constellations!: THREE.Group;
  private labels!: THREE.Group;

  constructor(private astronomyService: AstronomyService) {}

  ngAfterViewInit() {
    this.initThree();
    this.addSky();
    this.animate();
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 5000);
    this.camera.position.set(0, 0, 0.01);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableRotate = true;
  }

  private addSky() {
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    this.stars = this.astronomyService.createStars(1000, 16000);
    this.skyGroup.add(this.stars);

    this.constellations = this.astronomyService.createConstellations(500);
    this.skyGroup.add(this.constellations);

    this.labels = this.astronomyService.createLabels(500);
    this.skyGroup.add(this.labels);
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onTimeChange(time: number) {
    const angle = (time / 24) * 2 * Math.PI;
    this.skyGroup.rotation.y = angle;
  }

  onLatitudeChange(latitude: number) {
    const angle = (90 - latitude) * Math.PI / 180;
    this.skyGroup.rotation.x = angle;
  }

  onFovChange(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  onToggleLabels() {
    this.labels.visible = !this.labels.visible;
  }

  onToggleConstellations() {
    this.constellations.visible = !this.constellations.visible;
  }

  onRegenerateStars() {
    this.skyGroup.remove(this.stars);
    this.stars = this.astronomyService.createStars(1000, 16000);
    this.skyGroup.add(this.stars);
  }
}

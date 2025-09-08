import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { starCatalog } from '../../data/stars';
import { constellationLines } from '../../data/constellations';
import * as starsData from '../../data/stars.json';

@Injectable({
  providedIn: 'root'
})
export class AstronomyService {

  constructor() { }

  createStars(radius: number): THREE.Points {
    const vertices = [];
    for (const star of (starsData as any).default) {
      const pos = this.raDecToVector3(star.ra_h, star.dec_d, radius);
      if (pos.y > 0) {
        vertices.push(pos.x, pos.y, pos.z);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 3.0,
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  createConstellations(radius: number): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0x44aaff, opacity: 0.75, transparent: true });

    for (const constellation in constellationLines) {
      const lines = constellationLines[constellation as keyof typeof constellationLines];
      for (const line of lines) {
        const star1 = starCatalog[line[0]];
        const star2 = starCatalog[line[1]];
        if (star1 && star2) {
          const p1 = this.raDecToVector3(star1.ra_h, star1.dec_d, radius);
          const p2 = this.raDecToVector3(star2.ra_h, star2.dec_d, radius);
          const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
          group.add(new THREE.Line(geometry, material));
        }
      }
    }
    group.frustumCulled = false;
    return group;
  }

  createLabels(radius: number): THREE.Group {
    const group = new THREE.Group();
    for (const starName in starCatalog) {
      const star = starCatalog[starName];
      const pos = this.raDecToVector3(star.ra_h, star.dec_d, radius * 1.01);
      const sprite = this.createLabelSprite(starName);
      sprite.position.copy(pos);
      group.add(sprite);
    }
    group.frustumCulled = false;
    return group;
  }

  private raDecToVector3(ra_h: number, dec_d: number, radius: number): THREE.Vector3 {
    const ra_rad = ra_h * 15 * Math.PI / 180;
    const dec_rad = dec_d * Math.PI / 180;
    const x = radius * Math.cos(dec_rad) * Math.cos(ra_rad);
    const y = radius * Math.sin(dec_rad);
    const z = radius * Math.cos(dec_rad) * Math.sin(ra_rad);
    return new THREE.Vector3(x, y, z);
  }

  private createLabelSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const fontSize = 24;
    context.font = `${fontSize}px Arial`;
    const textMetrics = context.measureText(text);
    canvas.width = textMetrics.width;
    canvas.height = fontSize * 1.2;
    context.font = `${fontSize}px Arial`;
    context.fillStyle = 'rgba(255, 255, 255, 0.8)';
    context.fillText(text, 0, fontSize);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(canvas.width / 4, canvas.height / 4, 1);
    return sprite;
  }
}

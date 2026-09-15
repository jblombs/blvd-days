import * as THREE from 'three';
import type { WeatherMode } from './types';

export class Weather {
  mode: WeatherMode = 'sunny';
  private rain: THREE.Points;
  private velocities: Float32Array;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private scene: THREE.Scene;
  private fill: THREE.DirectionalLight;

  constructor(
    scene: THREE.Scene,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight,
    fill: THREE.DirectionalLight,
  ) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.fill = fill;

    const count = 1200;
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      this.velocities[i] = 18 + Math.random() * 22;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.18,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    scene.add(this.rain);

    this.applySunny();
  }

  toggle(): WeatherMode {
    this.mode = this.mode === 'sunny' ? 'rainy' : 'sunny';
    if (this.mode === 'sunny') this.applySunny();
    else this.applyRainy();
    return this.mode;
  }

  set(mode: WeatherMode) {
    this.mode = mode;
    if (mode === 'sunny') this.applySunny();
    else this.applyRainy();
  }

  private applySunny() {
    this.rain.visible = false;
    this.scene.background = new THREE.Color('#87b7e8');
    this.scene.fog = new THREE.Fog('#a8c8e8', 45, 140);
    this.sun.color.set('#fff1d0');
    this.sun.intensity = 1.55;
    this.hemi.color.set('#cfe8ff');
    this.hemi.groundColor.set('#6b8f4a');
    this.hemi.intensity = 0.55;
    this.fill.intensity = 0.35;
    this.sun.position.set(40, 60, 20);
  }

  private applyRainy() {
    this.rain.visible = true;
    this.scene.background = new THREE.Color('#5a6878');
    this.scene.fog = new THREE.Fog('#6a7888', 30, 110);
    this.sun.color.set('#c0c8d0');
    this.sun.intensity = 0.45;
    this.hemi.color.set('#9aa8b8');
    this.hemi.groundColor.set('#4a5a48');
    this.hemi.intensity = 0.4;
    this.fill.intensity = 0.2;
    this.sun.position.set(20, 50, 10);
  }

  update(dt: number, followX: number, followZ: number) {
    if (!this.rain.visible) return;
    const pos = this.rain.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.velocities.length; i++) {
      arr[i * 3 + 1] -= this.velocities[i] * dt;
      // slight slant
      arr[i * 3] -= 2 * dt;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3] = followX + (Math.random() - 0.5) * 70;
        arr[i * 3 + 1] = 25 + Math.random() * 20;
        arr[i * 3 + 2] = followZ + (Math.random() - 0.5) * 70;
      }
    }
    pos.needsUpdate = true;
  }
}

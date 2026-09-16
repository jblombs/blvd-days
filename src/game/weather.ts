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
  private wetOverlay: THREE.Mesh | null = null;

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

    const count = 1600;
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 110;
      positions[i * 3 + 1] = Math.random() * 42;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 110;
      this.velocities[i] = 22 + Math.random() * 28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xb8d4ff,
      size: 0.2,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    scene.add(this.rain);

    // Subtle darkening veil for rainy (no extra lights)
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({
        color: '#1a2430',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    veil.rotation.x = -Math.PI / 2;
    veil.position.y = 0.08;
    veil.visible = false;
    scene.add(veil);
    this.wetOverlay = veil;

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
    if (this.wetOverlay) {
      this.wetOverlay.visible = false;
      (this.wetOverlay.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    // Clear Queens summer — bright blue, warm sun, crisp contrast
    this.scene.background = new THREE.Color('#6eb0ef');
    this.scene.fog = new THREE.Fog('#9ec8f0', 55, 155);
    this.sun.color.set('#fff4d6');
    this.sun.intensity = 2.05;
    this.sun.castShadow = true;
    this.hemi.color.set('#d6ecff');
    this.hemi.groundColor.set('#7a9a4e');
    this.hemi.intensity = 0.7;
    this.fill.color.set('#a8c8ff');
    this.fill.intensity = 0.42;
    this.sun.position.set(48, 70, 28);
  }

  private applyRainy() {
    this.rain.visible = true;
    if (this.wetOverlay) {
      this.wetOverlay.visible = true;
      (this.wetOverlay.material as THREE.MeshBasicMaterial).opacity = 0.12;
    }
    // Overcast Queens — cool grey, flat light, muted ground (clear toggle contrast)
    this.scene.background = new THREE.Color('#4a5564');
    this.scene.fog = new THREE.Fog('#5a6570', 22, 95);
    this.sun.color.set('#9aa8b4');
    this.sun.intensity = 0.28;
    // Keep one shadow light but soft/dim — still no extra lights
    this.sun.castShadow = true;
    this.hemi.color.set('#8a96a4');
    this.hemi.groundColor.set('#3a4840');
    this.hemi.intensity = 0.32;
    this.fill.color.set('#6a7888');
    this.fill.intensity = 0.12;
    this.sun.position.set(18, 55, 8);
  }

  update(dt: number, followX: number, followZ: number) {
    if (!this.rain.visible) return;
    const pos = this.rain.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.velocities.length; i++) {
      arr[i * 3 + 1] -= this.velocities[i] * dt;
      arr[i * 3] -= 3.5 * dt;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3] = followX + (Math.random() - 0.5) * 80;
        arr[i * 3 + 1] = 22 + Math.random() * 22;
        arr[i * 3 + 2] = followZ + (Math.random() - 0.5) * 80;
      }
    }
    pos.needsUpdate = true;
    if (this.wetOverlay) {
      this.wetOverlay.position.x = followX;
      this.wetOverlay.position.z = followZ;
    }
  }
}

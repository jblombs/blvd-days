import * as THREE from 'three';
import type { WeatherMode } from './types';
import type { WettableSurface } from './world';

export class Weather {
  mode: WeatherMode = 'sunny';
  private rain: THREE.Points;
  private velocities: Float32Array;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private scene: THREE.Scene;
  private fill: THREE.DirectionalLight;
  private wetOverlay: THREE.Mesh | null = null;
  private wetSurfaces: WettableSurface[] = [];
  private puddles: THREE.Mesh[] = [];

  constructor(
    scene: THREE.Scene,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight,
    fill: THREE.DirectionalLight,
    wetSurfaces: WettableSurface[] = [],
  ) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.fill = fill;
    this.wetSurfaces = wetSurfaces;

    // Slightly denser rain streaks (still Points — cheap)
    const count = 2000;
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 110;
      positions[i * 3 + 1] = Math.random() * 42;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 110;
      this.velocities[i] = 24 + Math.random() * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xc8dcff,
      size: 0.22,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    scene.add(this.rain);

    // Wet sheen veil — slightly reflective dark wash over ground
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({
        color: '#1a2838',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    veil.rotation.x = -Math.PI / 2;
    veil.position.y = 0.085;
    veil.visible = false;
    scene.add(veil);
    this.wetOverlay = veil;

    // Sparse puddle discs (visible sheen patches when raining)
    const puddleMat = new THREE.MeshStandardMaterial({
      color: '#2a3540',
      roughness: 0.15,
      metalness: 0.65,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const puddleSpots = [
      [-30, -10], [-20, 16], [18, -18], [30, 12], [-45, 18],
      [48, -8], [-12, 0], [8, 20], [-55, -6], [55, 22],
    ];
    for (const [px, pz] of puddleSpots) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1.1 + Math.random() * 1.4, 12), puddleMat.clone());
      p.rotation.x = -Math.PI / 2;
      p.position.set(px, 0.09, pz);
      p.visible = false;
      scene.add(p);
      this.puddles.push(p);
    }

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

  private setWetMaterials(wet: boolean) {
    for (const s of this.wetSurfaces) {
      s.material.roughness = wet ? s.wetRoughness : s.dryRoughness;
      s.material.metalness = wet ? s.wetMetalness : s.dryMetalness;
      s.material.needsUpdate = true;
    }
    for (const p of this.puddles) {
      p.visible = wet;
      const m = p.material as THREE.MeshStandardMaterial;
      m.opacity = wet ? 0.55 : 0;
    }
  }

  private applySunny() {
    this.rain.visible = false;
    if (this.wetOverlay) {
      this.wetOverlay.visible = false;
      (this.wetOverlay.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    this.setWetMaterials(false);
    // Clear Queens summer — bright blue, warm sun, crisp contrast
    this.scene.background = new THREE.Color('#6eb0ef');
    this.scene.fog = new THREE.Fog('#9ec8f0', 58, 160);
    this.sun.color.set('#fff4d6');
    this.sun.intensity = 2.15;
    this.sun.castShadow = true;
    this.hemi.color.set('#d6ecff');
    this.hemi.groundColor.set('#7a9a4e');
    this.hemi.intensity = 0.72;
    this.fill.color.set('#a8c8ff');
    this.fill.intensity = 0.45;
    this.sun.position.set(52, 72, 30);
  }

  private applyRainy() {
    this.rain.visible = true;
    if (this.wetOverlay) {
      this.wetOverlay.visible = true;
      (this.wetOverlay.material as THREE.MeshBasicMaterial).opacity = 0.1;
    }
    this.setWetMaterials(true);
    // Overcast Queens — cool grey, flat light, wet ground sheen
    this.scene.background = new THREE.Color('#4a5564');
    this.scene.fog = new THREE.Fog('#5a6570', 20, 90);
    this.sun.color.set('#9aa8b4');
    this.sun.intensity = 0.32;
    this.sun.castShadow = true;
    this.hemi.color.set('#8a96a4');
    this.hemi.groundColor.set('#3a4840');
    this.hemi.intensity = 0.35;
    this.fill.color.set('#6a7888');
    this.fill.intensity = 0.14;
    this.sun.position.set(16, 55, 6);
  }

  update(dt: number, followX: number, followZ: number) {
    if (!this.rain.visible) return;
    const pos = this.rain.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.velocities.length; i++) {
      arr[i * 3 + 1] -= this.velocities[i] * dt;
      arr[i * 3] -= 4.2 * dt;
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

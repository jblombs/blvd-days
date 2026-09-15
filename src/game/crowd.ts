import * as THREE from 'three';
import type { Collider } from './types';
import { resolveCircleColliders } from './world';

/** Respectful variety: skin tones, clothing, optional modest head covering / kippah as simple geometry */
interface Persona {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  headwear: 'none' | 'hijab' | 'kippah' | 'cap';
  scale: number;
}

const PERSONAS: Persona[] = [
  { skin: '#ffe0bd', shirt: '#2b6cb0', pants: '#1a202c', hair: '#3b2f2f', headwear: 'none', scale: 1 },
  { skin: '#f1c27d', shirt: '#38a169', pants: '#2d3748', hair: '#1a1a1a', headwear: 'cap', scale: 1.02 },
  { skin: '#c68642', shirt: '#9f7aea', pants: '#2c3e50', hair: '#0d0d0d', headwear: 'none', scale: 0.98 },
  { skin: '#8d5524', shirt: '#e53e3e', pants: '#1a202c', hair: '#111', headwear: 'none', scale: 1.04 },
  { skin: '#6b3f2a', shirt: '#dd6b20', pants: '#2d3748', hair: '#0a0a0a', headwear: 'cap', scale: 1 },
  { skin: '#f3d1a5', shirt: '#4a5568', pants: '#1a202c', hair: '#5a4632', headwear: 'kippah', scale: 0.97 },
  { skin: '#e0ac69', shirt: '#319795', pants: '#2c3e50', hair: '#1a1a1a', headwear: 'hijab', scale: 1 },
  { skin: '#c58c55', shirt: '#ed8936', pants: '#234e52', hair: '#222', headwear: 'none', scale: 1.01 },
  { skin: '#ffdbac', shirt: '#805ad5', pants: '#2d3748', hair: '#d4a017', headwear: 'none', scale: 0.99 },
  { skin: '#8d5524', shirt: '#2c7a7b', pants: '#1a202c', hair: '#0d0d0d', headwear: 'hijab', scale: 1 },
  { skin: '#f1c27d', shirt: '#718096', pants: '#1a202c', hair: '#2b2118', headwear: 'kippah', scale: 1.03 },
  { skin: '#5c3317', shirt: '#f6e05e', pants: '#2d3748', hair: '#050505', headwear: 'none', scale: 1.05 },
];

interface Agent {
  mesh: THREE.Group;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  heading: number;
  changeT: number;
  spanIndex: number;
}

export class Crowd {
  readonly group = new THREE.Group();
  private agents: Agent[] = [];
  private spans: { minX: number; maxX: number; minZ: number; maxZ: number }[];

  constructor(
    spans: { minX: number; maxX: number; minZ: number; maxZ: number }[],
    count = 52,
  ) {
    this.spans = spans;
    for (let i = 0; i < count; i++) {
      const span = spans[i % spans.length];
      const persona = PERSONAS[i % PERSONAS.length];
      const mesh = makePedestrian(persona);
      const x = lerp(span.minX, span.maxX, Math.random());
      const z = lerp(span.minZ, span.maxZ, Math.random());
      mesh.position.set(x, 0, z);
      this.group.add(mesh);
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 1.4;
      this.agents.push({
        mesh,
        x,
        z,
        vx: Math.cos(ang) * spd,
        vz: Math.sin(ang) * spd,
        radius: 0.4 * persona.scale,
        heading: ang,
        changeT: 1 + Math.random() * 3,
        spanIndex: i % spans.length,
      });
    }
  }

  update(dt: number, colliders: Collider[], playerX: number, playerZ: number, playerR: number) {
    let pushX = 0;
    let pushZ = 0;

    for (const a of this.agents) {
      a.changeT -= dt;
      if (a.changeT <= 0) {
        a.changeT = 1.5 + Math.random() * 3.5;
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.1 + Math.random() * 1.5;
        a.vx = Math.cos(ang) * spd;
        a.vz = Math.sin(ang) * spd;
        a.heading = ang;
      }

      a.x += a.vx * dt;
      a.z += a.vz * dt;

      // Keep on sidewalk span (soft wrap / bounce)
      const span = this.spans[a.spanIndex];
      if (a.x < span.minX) { a.x = span.minX; a.vx = Math.abs(a.vx); }
      if (a.x > span.maxX) { a.x = span.maxX; a.vx = -Math.abs(a.vx); }
      if (a.z < span.minZ) { a.z = span.minZ; a.vz = Math.abs(a.vz); }
      if (a.z > span.maxZ) { a.z = span.maxZ; a.vz = -Math.abs(a.vz); }

      const resolved = resolveCircleColliders(a.x, a.z, a.radius, colliders);
      a.x = resolved.x;
      a.z = resolved.z;

      // Avoid player — slide around
      const dx = a.x - playerX;
      const dz = a.z - playerZ;
      const dist = Math.hypot(dx, dz);
      const minDist = a.radius + playerR + 0.05;
      if (dist < minDist && dist > 1e-4) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        // Split push: pedestrian yields more, player gets soft bump
        a.x += nx * overlap * 0.75;
        a.z += nz * overlap * 0.75;
        pushX -= nx * overlap * 0.35;
        pushZ -= nz * overlap * 0.35;
      }

      a.heading = Math.atan2(a.vx, a.vz);
      a.mesh.position.set(a.x, 0, a.z);
      a.mesh.rotation.y = a.heading;
    }

    // Agent-agent soft separation (spatial hash lite — O(n^2) ok for ~50)
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        const a = this.agents[i];
        const b = this.agents[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const minD = a.radius + b.radius;
        if (dist < minD && dist > 1e-4) {
          const push = ((minD - dist) / dist) * 0.5;
          a.x -= dx * push;
          a.z -= dz * push;
          b.x += dx * push;
          b.z += dz * push;
          a.mesh.position.set(a.x, 0, a.z);
          b.mesh.position.set(b.x, 0, b.z);
        }
      }
    }

    return { x: pushX, z: pushZ };
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function makePedestrian(p: Persona): THREE.Group {
  const g = new THREE.Group();
  g.scale.setScalar(p.scale);

  const skinMat = new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.75 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: p.shirt, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: p.pants, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: p.hair, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.4, 3, 6), shirtMat);
  torso.position.y = 1.0;
  torso.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
  head.position.y = 1.55;
  head.castShadow = true;

  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.32, 3, 5), pantsMat);
  legL.position.set(-0.1, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.1;

  g.add(torso, head, legL, legR);

  if (p.headwear === 'hijab') {
    // Modest head covering — simple draped hood shape (sphere + slight scarf), not a caricature
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: p.shirt, roughness: 0.85 }),
    );
    hood.position.y = 1.58;
    hood.scale.set(1.05, 0.95, 1.15);
    const drape = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.35, 3, 6),
      new THREE.MeshStandardMaterial({ color: p.shirt, roughness: 0.85 }),
    );
    drape.position.set(0, 1.15, -0.05);
    g.add(hood, drape);
  } else if (p.headwear === 'kippah') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), hairMat);
    hair.scale.set(1, 0.5, 1);
    hair.position.y = 1.68;
    const kip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.13, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: '#1e3a5f', roughness: 0.7 }),
    );
    kip.position.y = 1.78;
    g.add(hair, kip);
  } else if (p.headwear === 'cap') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), hairMat);
    hair.scale.set(1, 0.5, 1);
    hair.position.y = 1.68;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: '#2d3748', roughness: 0.75 }),
    );
    cap.position.y = 1.76;
    const brim = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.04, 0.16),
      new THREE.MeshStandardMaterial({ color: '#2d3748', roughness: 0.75 }),
    );
    brim.position.set(0, 1.72, 0.16);
    g.add(hair, cap, brim);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), hairMat);
    hair.scale.set(1, 0.55, 1);
    hair.position.y = 1.68;
    g.add(hair);
  }

  return g;
}

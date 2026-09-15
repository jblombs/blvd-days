import * as THREE from 'three';
import type { Collider, GoalZone } from './types';

export interface WorldBuilt {
  group: THREE.Group;
  colliders: Collider[];
  goals: GoalZone[];
  sidewalkSpans: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  blvdLanes: { z: number; dir: 1 | -1; minX: number; maxX: number }[];
}

const BUILDING_COLORS = [
  '#c4b09a', '#a89078', '#d8c8b0', '#8a9aaa', '#b07060',
  '#9a8a7a', '#c0b8a8', '#7a8a70', '#b8a090', '#908878',
];

function boxMesh(
  w: number, h: number, d: number,
  color: string,
  x: number, y: number, z: number,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.05,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function addCollider(list: Collider[], x: number, z: number, w: number, d: number, pad = 0.15) {
  list.push({
    minX: x - w / 2 - pad,
    maxX: x + w / 2 + pad,
    minZ: z - d / 2 - pad,
    maxZ: z + d / 2 + pad,
  });
}

export function buildWorld(): WorldBuilt {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const sidewalkSpans: WorldBuilt['sidewalkSpans'] = [];

  // Ground — large asphalt/grass base
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 160),
    new THREE.MeshStandardMaterial({ color: '#4a7a3e', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  group.add(ground);

  // Neighborhood pavement slabs (Rego + FH)
  const paveMat = new THREE.MeshStandardMaterial({ color: '#9a9588', roughness: 0.95 });
  const asphaltMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.9 });
  const blvdMat = new THREE.MeshStandardMaterial({ color: '#2e2e2e', roughness: 0.88 });
  const medianMat = new THREE.MeshStandardMaterial({ color: '#3d6b35', roughness: 1 });
  const crossMat = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.85 });

  // Rego Park block pavement
  const regoPave = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), paveMat);
  regoPave.rotation.x = -Math.PI / 2;
  regoPave.position.set(-55, 0.01, 0);
  regoPave.receiveShadow = true;
  group.add(regoPave);

  // Forest Hills pavement
  const fhPave = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), paveMat.clone());
  fhPave.rotation.x = -Math.PI / 2;
  fhPave.position.set(55, 0.01, 0);
  fhPave.receiveShadow = true;
  group.add(fhPave);

  // Queens Blvd — wide corridor along X from -18..18, long in Z
  const blvd = new THREE.Mesh(new THREE.PlaneGeometry(36, 120), blvdMat);
  blvd.rotation.x = -Math.PI / 2;
  blvd.position.set(0, 0.02, 0);
  blvd.receiveShadow = true;
  group.add(blvd);

  // Tree median
  const median = new THREE.Mesh(new THREE.PlaneGeometry(4, 110), medianMat);
  median.rotation.x = -Math.PI / 2;
  median.position.set(0, 0.04, 0);
  group.add(median);

  // Trees on median
  for (let i = -5; i <= 5; i++) {
    const trunk = boxMesh(0.35, 1.6, 0.35, '#5a3a20', 0, 0.8, i * 9);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#2f6b2a', roughness: 0.9 }),
    );
    canopy.position.set(0, 2.2, i * 9);
    canopy.castShadow = true;
    group.add(trunk, canopy);
  }

  // Lane markings
  const lineMat = new THREE.MeshBasicMaterial({ color: '#d4b84a' });
  for (const x of [-12, -6, 6, 12]) {
    for (let z = -50; z < 50; z += 4) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.6), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.05, z);
      group.add(dash);
    }
  }

  // Crosswalks at z = -20 and z = 18
  for (const cz of [-20, 18]) {
    for (let i = 0; i < 10; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), crossMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-16 + i * 3.5, 0.06, cz);
      group.add(stripe);
    }
  }

  // Local streets (darker strips)
  function street(x: number, z: number, w: number, d: number) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphaltMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.015, z);
    s.receiveShadow = true;
    group.add(s);
  }
  street(-55, -8, 55, 7);
  street(-55, 22, 55, 7);
  street(55, -8, 55, 7);
  street(55, 22, 55, 7);
  street(-40, 0, 7, 70);
  street(-70, 0, 7, 70);
  street(40, 0, 7, 70);
  street(70, 0, 7, 70);

  // Sidewalk corridors for crowds (along building fronts)
  const sidewalkDefs = [
    { minX: -85, maxX: -22, minZ: -12, maxZ: -5 },
    { minX: -85, maxX: -22, minZ: 15, maxZ: 22 },
    { minX: -85, maxX: -22, minZ: -35, maxZ: -28 },
    { minX: 22, maxX: 85, minZ: -12, maxZ: -5 },
    { minX: 22, maxX: 85, minZ: 15, maxZ: 22 },
    { minX: 22, maxX: 85, minZ: -35, maxZ: -28 },
    // Along Blvd edges
    { minX: -22, maxX: -18, minZ: -45, maxZ: 45 },
    { minX: 18, maxX: 22, minZ: -45, maxZ: 45 },
  ];
  sidewalkSpans.push(...sidewalkDefs);

  const swMat = new THREE.MeshStandardMaterial({ color: '#b0aa9a', roughness: 0.95 });
  for (const s of sidewalkDefs) {
    const w = s.maxX - s.minX;
    const d = s.maxZ - s.minZ;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), swMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((s.minX + s.maxX) / 2, 0.03, (s.minZ + s.maxZ) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Buildings — Rego Park
  const buildingSpecs: { x: number; z: number; w: number; d: number; h: number; color?: string }[] = [
    // Rego
    { x: -48, z: -28, w: 18, d: 12, h: 14 },
    { x: -68, z: -28, w: 14, d: 12, h: 10 },
    { x: -48, z: 8, w: 16, d: 14, h: 18 },
    { x: -68, z: 8, w: 12, d: 12, h: 12 },
    { x: -48, z: 35, w: 20, d: 14, h: 11 },
    { x: -72, z: 35, w: 14, d: 12, h: 9 },
    { x: -30, z: -32, w: 10, d: 10, h: 8 },
    { x: -30, z: 36, w: 12, d: 10, h: 15 },
    // Forest Hills
    { x: 48, z: -28, w: 18, d: 12, h: 16 },
    { x: 68, z: -28, w: 14, d: 12, h: 11 },
    { x: 48, z: 8, w: 16, d: 14, h: 20 },
    { x: 68, z: 8, w: 12, d: 12, h: 13 },
    { x: 48, z: 35, w: 18, d: 14, h: 12 },
    { x: 70, z: 35, w: 14, d: 12, h: 10 },
    { x: 30, z: -32, w: 10, d: 10, h: 9 },
    { x: 32, z: 36, w: 14, d: 10, h: 14 },
  ];

  buildingSpecs.forEach((b, i) => {
    const color = b.color ?? BUILDING_COLORS[i % BUILDING_COLORS.length];
    const mesh = boxMesh(b.w, b.h, b.d, color, b.x, b.h / 2, b.z);
    // Window grid hint
    const winMat = new THREE.MeshStandardMaterial({
      color: '#cfe4ff',
      emissive: '#1a3048',
      emissiveIntensity: 0.15,
      roughness: 0.4,
    });
    const cols = Math.max(2, Math.floor(b.w / 3));
    const rows = Math.max(2, Math.floor(b.h / 3.2));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = b.x - b.w / 2 + 1.5 + c * ((b.w - 3) / Math.max(cols - 1, 1));
        const wy = 1.5 + r * ((b.h - 3) / Math.max(rows - 1, 1));
        const front = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), winMat);
        front.position.set(wx, wy, b.z + b.d / 2 + 0.05);
        group.add(front);
      }
    }
    group.add(mesh);
    addCollider(colliders, b.x, b.z, b.w, b.d);
  });

  // Bodega (Rego) — red awning landmark
  {
    const x = -36, z = -6;
    const shop = boxMesh(8, 5, 6, '#d8c8b4', x, 2.5, z);
    group.add(shop);
    addCollider(colliders, x, z, 8, 6);
    const awning = boxMesh(8.4, 0.25, 2.2, '#c62828', x, 3.6, z + 3.2);
    group.add(awning);
    const sign = boxMesh(5, 0.8, 0.15, '#fff8e7', x, 4.4, z + 3.1);
    group.add(sign);
  }

  // Blvd plaza monument — far side of crosswalk (must navigate Queens Blvd)
  {
    const x = 15, z = -20;
    const base = boxMesh(3, 0.4, 3, '#8a8070', x, 0.2, z);
    const pillar = boxMesh(0.8, 3.2, 0.8, '#c9b896', x, 2.0, z);
    group.add(base, pillar);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#e8a838', emissive: '#a06010', emissiveIntensity: 0.35 }),
    );
    marker.position.set(x, 3.9, z);
    group.add(marker);
  }

  // Subway entrance (Forest Hills)
  {
    const x = 38, z = 18;
    const kiosk = boxMesh(6, 3.2, 4, '#3a5a8a', x, 1.6, z);
    group.add(kiosk);
    addCollider(colliders, x, z, 6, 4);
    const rail = boxMesh(5, 1.2, 0.2, '#22c55e', x, 3.5, z + 2.1);
    group.add(rail);
    // globe lamp
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#fff4cc', emissive: '#ffcc66', emissiveIntensity: 0.6 }),
    );
    globe.position.set(x + 2.5, 3.8, z + 1.5);
    group.add(globe);
  }

  // Post office (optional interactable, FH)
  {
    const x = 58, z = -6;
    const po = boxMesh(10, 6, 7, '#6b8f6b', x, 3, z);
    group.add(po);
    addCollider(colliders, x, z, 10, 7);
  }

  // Streetlights along Blvd
  for (let z = -40; z <= 40; z += 16) {
    for (const x of [-17, 17]) {
      const pole = boxMesh(0.18, 5, 0.18, '#555', x, 2.5, z);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: '#ffd27a', emissiveIntensity: 0.4 }),
      );
      lamp.position.set(x, 5.1, z);
      group.add(pole, lamp);
    }
  }

  // Area labels as simple floating text planes would need canvas textures — skip for mesh; HUD handles it

  const goals: GoalZone[] = [
    {
      id: 'blvd-plaza',
      questId: 'blvd-cross',
      x: 15,
      z: -20,
      radius: 4.5,
      label: 'Blvd Plaza',
      dialog:
        'You made it across Queens Blvd. Buses hiss, turning cars negotiate the light, and the little plaza marker gleams like a local trophy.',
      completeMsg: 'Errand done: Crossed Queens Blvd!',
    },
    {
      id: 'bodega',
      questId: 'bodega-run',
      x: -36,
      z: -2.5,
      radius: 4,
      label: 'Corner Bodega',
      dialog:
        'Red awning, cold case humming. “Eggs, milk, and a coffee — you got it.” Groceries acquired. Queens tradition upheld.',
      completeMsg: 'Errand done: Groceries secured!',
    },
    {
      id: 'subway',
      questId: 'subway-stop',
      x: 38,
      z: 15.5,
      radius: 4.5,
      label: 'Subway Entrance',
      dialog:
        'Forest Hills station plaza. A green globe, a rush of footsteps, the M/R rumble somewhere below. You’re on time enough.',
      completeMsg: 'Errand done: Reached the subway!',
    },
    {
      id: 'post',
      x: 58,
      z: -1,
      radius: 4,
      label: 'Post Office',
      dialog: 'Fluorescent calm and a short line. You mail a postcard. The clerk stamps it like poetry.',
    },
  ];

  // Goal marker rings (visible)
  for (const g of goals) {
    if (!g.questId) continue;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.6, 24),
      new THREE.MeshBasicMaterial({ color: '#e8a838', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(g.x, 0.12, g.z);
    group.add(ring);
  }

  return {
    group,
    colliders,
    goals,
    sidewalkSpans,
    blvdLanes: [
      { z: -14, dir: 1, minX: -50, maxX: 50 },
      { z: -8, dir: -1, minX: -50, maxX: 50 },
      { z: 8, dir: 1, minX: -50, maxX: 50 },
      { z: 14, dir: -1, minX: -50, maxX: 50 },
    ],
  };
}

export function resolveCircleColliders(
  x: number,
  z: number,
  radius: number,
  colliders: Collider[],
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (const c of colliders) {
    const nearestX = Math.max(c.minX, Math.min(px, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(pz, c.maxZ));
    let dx = px - nearestX;
    let dz = pz - nearestZ;
    const dist = Math.hypot(dx, dz);
    if (dist < radius && dist > 1e-6) {
      const push = (radius - dist) / dist;
      px += dx * push;
      pz += dz * push;
    } else if (dist <= 1e-6 && px >= c.minX && px <= c.maxX && pz >= c.minZ && pz <= c.maxZ) {
      // Stuck inside — push out via shortest axis
      const left = px - c.minX;
      const right = c.maxX - px;
      const top = pz - c.minZ;
      const bot = c.maxZ - pz;
      const m = Math.min(left, right, top, bot);
      if (m === left) px = c.minX - radius;
      else if (m === right) px = c.maxX + radius;
      else if (m === top) pz = c.minZ - radius;
      else pz = c.maxZ + radius;
    }
  }
  return { x: px, z: pz };
}

export function areaName(x: number): string {
  if (x < -18) return 'Rego Park';
  if (x > 18) return 'Forest Hills';
  return 'Queens Blvd';
}

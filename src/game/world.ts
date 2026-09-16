import * as THREE from 'three';
import type { Collider, GoalZone } from './types';

export interface WorldBuilt {
  group: THREE.Group;
  colliders: Collider[];
  goals: GoalZone[];
  sidewalkSpans: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  blvdLanes: { x: number; dir: 1 | -1 }[];
}

/** Queens Blvd half-width (center to curb). Real Blvd feel: wide cross. */
export const BLVD_HALF = 26;
const BLVD_EDGE = BLVD_HALF;

const BUILDING_PALETTE = [
  { wall: '#c4b09a', trim: '#8a7860', awning: '#c62828' },
  { wall: '#a89078', trim: '#6e5a48', awning: '#1565c0' },
  { wall: '#d8c8b0', trim: '#9a8a70', awning: '#2e7d32' },
  { wall: '#8a9aaa', trim: '#5a6a7a', awning: '#6a1b9a' },
  { wall: '#b07060', trim: '#7a4038', awning: '#ef6c00' },
  { wall: '#9a8a7a', trim: '#6a5a4a', awning: '#00838f' },
  { wall: '#c0b8a8', trim: '#807868', awning: '#ad1457' },
  { wall: '#7a8a70', trim: '#4a5a40', awning: '#283593' },
  { wall: '#b8a090', trim: '#786050', awning: '#f9a825' },
  { wall: '#908878', trim: '#605848', awning: '#00695c' },
  { wall: '#d4c4a8', trim: '#a09070', awning: '#b71c1c' },
  { wall: '#9aabbc', trim: '#6a7b8c', awning: '#4527a0' },
];

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number } = {}) {
  const key = `${color}|${opts.roughness ?? 0.82}|${opts.metalness ?? 0.05}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.82,
      metalness: opts.metalness ?? 0.05,
      emissive: opts.emissive ?? '#000000',
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    });
    matCache.set(key, m);
  }
  return m;
}

function box(
  w: number, h: number, d: number,
  color: string,
  x: number, y: number, z: number,
  opts?: { cast?: boolean; receive?: boolean; roughness?: number; metalness?: number },
): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat(color, { roughness: opts?.roughness, metalness: opts?.metalness }),
  );
  m.position.set(x, y, z);
  m.castShadow = opts?.cast ?? true;
  m.receiveShadow = opts?.receive ?? true;
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

const winGeo = new THREE.PlaneGeometry(1.0, 1.15);
const winLit = mat('#cfe8ff', { roughness: 0.35, metalness: 0.15, emissive: '#1a3048', emissiveIntensity: 0.2 });
const winDark = mat('#1a2838', { roughness: 0.4, metalness: 0.2, emissive: '#0a1520', emissiveIntensity: 0.05 });
const doorGeo = new THREE.PlaneGeometry(1.1, 2.0);
const glassGeo = new THREE.PlaneGeometry(1.6, 1.5);

function addFacadeWindows(
  group: THREE.Group,
  bx: number, bz: number, bw: number, bd: number, bh: number,
  face: 'south' | 'north' | 'east' | 'west',
) {
  const cols = Math.max(2, Math.floor(bw / 2.8));
  const rows = Math.max(2, Math.floor(bh / 3.0));
  const storefrontH = 3.2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const along = -bw / 2 + 1.4 + c * ((bw - 2.8) / Math.max(cols - 1, 1));
      const wy = storefrontH + 0.4 + r * ((bh - storefrontH - 1.5) / Math.max(rows - 1, 1));
      if (wy > bh - 0.8) continue;
      const useLit = (r + c) % 3 !== 0;
      const pane = new THREE.Mesh(winGeo, useLit ? winLit : winDark);
      if (face === 'south') pane.position.set(bx + along, wy, bz + bd / 2 + 0.04);
      else if (face === 'north') {
        pane.position.set(bx + along, wy, bz - bd / 2 - 0.04);
        pane.rotation.y = Math.PI;
      } else if (face === 'east') {
        const alongD = -bd / 2 + 1.2 + c * ((bd - 2.4) / Math.max(cols - 1, 1));
        pane.position.set(bx + bw / 2 + 0.04, wy, bz + alongD);
        pane.rotation.y = Math.PI / 2;
      } else {
        const alongD = -bd / 2 + 1.2 + c * ((bd - 2.4) / Math.max(cols - 1, 1));
        pane.position.set(bx - bw / 2 - 0.04, wy, bz + alongD);
        pane.rotation.y = -Math.PI / 2;
      }
      group.add(pane);
    }
  }
}

function addStorefront(
  group: THREE.Group,
  bx: number, bz: number, bw: number, bd: number,
  face: 'south' | 'north',
  awningColor: string,
  doorColor = '#4a3728',
) {
  const zFace = face === 'south' ? bz + bd / 2 : bz - bd / 2;
  const zOut = face === 'south' ? 1 : -1;

  // Ground-floor band
  const band = box(bw + 0.1, 3.0, 0.12, '#e8dfd0', bx, 1.5, zFace + zOut * 0.08, { cast: false });
  group.add(band);

  // Door
  const door = new THREE.Mesh(doorGeo, mat(doorColor, { roughness: 0.7 }));
  door.position.set(bx, 1.05, zFace + zOut * 0.14);
  if (face === 'north') door.rotation.y = Math.PI;
  group.add(door);

  // Display windows flanking door
  for (const side of [-1, 1] as const) {
    const glass = new THREE.Mesh(
      glassGeo,
      mat('#a8d0e8', { roughness: 0.25, metalness: 0.2, emissive: '#203848', emissiveIntensity: 0.25 }),
    );
    glass.position.set(bx + side * (bw * 0.28), 1.6, zFace + zOut * 0.14);
    if (face === 'north') glass.rotation.y = Math.PI;
    group.add(glass);
  }

  // Awning
  const awning = box(bw * 0.92, 0.12, 1.8, awningColor, bx, 3.15, zFace + zOut * 1.0, { cast: true, receive: false });
  group.add(awning);
  // Awning stripe underside hint
  const stripe = box(bw * 0.92, 0.04, 1.75, '#fff8e7', bx, 3.07, zFace + zOut * 1.0, { cast: false });
  group.add(stripe);
}

function addBuilding(
  group: THREE.Group,
  colliders: Collider[],
  spec: { x: number; z: number; w: number; d: number; h: number; palette: number; storefront?: 'south' | 'north' | 'both' | 'none'; faceWindows?: boolean },
) {
  const p = BUILDING_PALETTE[spec.palette % BUILDING_PALETTE.length];
  const mesh = box(spec.w, spec.h, spec.d, p.wall, spec.x, spec.h / 2, spec.z);
  group.add(mesh);

  // Cornice / roof ledge
  const cornice = box(spec.w + 0.4, 0.35, spec.d + 0.4, p.trim, spec.x, spec.h + 0.1, spec.z, { cast: true });
  group.add(cornice);

  // Rooftop AC / water tower hint on taller buildings
  if (spec.h > 12) {
    const ac = box(1.4, 0.9, 1.8, '#6a7078', spec.x + spec.w * 0.2, spec.h + 0.7, spec.z - spec.d * 0.15, { cast: true });
    group.add(ac);
  }

  const sf = spec.storefront ?? 'south';
  if (sf === 'south' || sf === 'both') addStorefront(group, spec.x, spec.z, spec.w, spec.d, 'south', p.awning);
  if (sf === 'north' || sf === 'both') addStorefront(group, spec.x, spec.z, spec.w, spec.d, 'north', p.awning);

  if (spec.faceWindows !== false) {
    addFacadeWindows(group, spec.x, spec.z, spec.w, spec.d, spec.h, 'south');
    addFacadeWindows(group, spec.x, spec.z, spec.w, spec.d, spec.h, 'north');
    if (spec.w > 10) {
      // Side windows with fewer columns — reuse face helper via depth as width
      const cols = Math.max(2, Math.floor(spec.d / 3));
      const rows = Math.max(2, Math.floor(spec.h / 3.2));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const along = -spec.d / 2 + 1.2 + c * ((spec.d - 2.4) / Math.max(cols - 1, 1));
          const wy = 3.6 + r * ((spec.h - 4.5) / Math.max(rows - 1, 1));
          if (wy > spec.h - 0.8) continue;
          const pane = new THREE.Mesh(winGeo, (r + c) % 2 === 0 ? winLit : winDark);
          pane.position.set(spec.x + spec.w / 2 + 0.04, wy, spec.z + along);
          pane.rotation.y = Math.PI / 2;
          group.add(pane);
        }
      }
    }
  }

  addCollider(colliders, spec.x, spec.z, spec.w, spec.d);
}

function addHydrant(group: THREE.Group, x: number, z: number) {
  const base = box(0.35, 0.15, 0.35, '#6b1c1c', x, 0.08, z, { cast: false });
  const body = box(0.22, 0.55, 0.22, '#c62828', x, 0.4, z, { cast: false });
  const cap = box(0.28, 0.12, 0.28, '#8b1a1a', x, 0.72, z, { cast: false });
  group.add(base, body, cap);
}

function addTrashCan(group: THREE.Group, x: number, z: number) {
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.85, 8),
    mat('#3a3a3a', { roughness: 0.7, metalness: 0.3 }),
  );
  can.position.set(x, 0.42, z);
  can.castShadow = true;
  group.add(can);
}

function addBench(group: THREE.Group, x: number, z: number, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const seat = box(1.6, 0.1, 0.45, '#5a3a20', 0, 0.45, 0, { cast: true });
  const back = box(1.6, 0.45, 0.08, '#5a3a20', 0, 0.75, -0.2, { cast: true });
  const legL = box(0.08, 0.4, 0.4, '#333', -0.65, 0.2, 0, { cast: false });
  const legR = box(0.08, 0.4, 0.4, '#333', 0.65, 0.2, 0, { cast: false });
  g.add(seat, back, legL, legR);
  group.add(g);
}

function addMailbox(group: THREE.Group, x: number, z: number) {
  const body = box(0.45, 0.7, 0.35, '#1565c0', x, 0.85, z, { cast: true });
  const post = box(0.1, 0.5, 0.1, '#333', x, 0.25, z, { cast: false });
  const top = box(0.5, 0.08, 0.4, '#0d47a1', x, 1.25, z, { cast: false });
  group.add(body, post, top);
}

function addCurb(group: THREE.Group, x: number, z: number, w: number, d: number) {
  const curb = box(w, 0.18, d, '#c8c2b4', x, 0.09, z, { cast: false, receive: true, roughness: 0.95 });
  group.add(curb);
}

function addBusShelter(group: THREE.Group, colliders: Collider[], x: number, z: number) {
  const roof = box(3.2, 0.12, 1.4, '#555', x, 2.4, z, { cast: true });
  const postL = box(0.1, 2.3, 0.1, '#444', x - 1.4, 1.15, z - 0.5, { cast: false });
  const postR = box(0.1, 2.3, 0.1, '#444', x + 1.4, 1.15, z - 0.5, { cast: false });
  const panel = box(2.8, 1.6, 0.06, '#88aacc', x, 1.4, z - 0.55, {
    cast: false,
    roughness: 0.3,
    metalness: 0.2,
  });
  group.add(roof, postL, postR, panel);
  addCollider(colliders, x, z - 0.3, 3.0, 1.0, 0.05);
}

export function buildWorld(): WorldBuilt {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const sidewalkSpans: WorldBuilt['sidewalkSpans'] = [];

  // Ground — grass beyond pavement
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 170),
    mat('#3d6b35', { roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const paveMat = mat('#9a9588', { roughness: 0.95 });
  const asphaltMat = mat('#3a3a3a', { roughness: 0.9 });
  const blvdMat = mat('#2a2a2a', { roughness: 0.88 });
  const medianMat = mat('#3d6b35', { roughness: 1 });
  const crossMat = mat('#e8e2d4', { roughness: 0.85 });
  const swMat = mat('#b0aa9a', { roughness: 0.95 });
  const curbMat = mat('#c8c2b4', { roughness: 0.95 });

  // Neighborhood pavement
  for (const [px, color] of [[-60, paveMat], [60, paveMat]] as const) {
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(78, 100), color);
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(px as number, 0.01, 0);
    pave.receiveShadow = true;
    group.add(pave);
  }

  // Queens Blvd — wide corridor (real cross feel)
  const blvdW = BLVD_HALF * 2;
  const blvd = new THREE.Mesh(new THREE.PlaneGeometry(blvdW, 130), blvdMat);
  blvd.rotation.x = -Math.PI / 2;
  blvd.position.set(0, 0.02, 0);
  blvd.receiveShadow = true;
  group.add(blvd);

  // Raised grassy median
  const medianW = 6;
  const median = new THREE.Mesh(new THREE.PlaneGeometry(medianW, 118), medianMat);
  median.rotation.x = -Math.PI / 2;
  median.position.set(0, 0.05, 0);
  median.receiveShadow = true;
  group.add(median);
  // Median curb lips
  for (const sx of [-medianW / 2 - 0.15, medianW / 2 + 0.15]) {
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 118), curbMat);
    lip.rotation.x = -Math.PI / 2;
    lip.position.set(sx, 0.055, 0);
    group.add(lip);
  }

  // Median trees + planters
  for (let i = -6; i <= 6; i++) {
    if (Math.abs(i) === 2 || Math.abs(i) === 3) continue; // gap at crosswalks
    const tz = i * 8.5;
    const trunk = box(0.38, 1.8, 0.38, '#5a3a20', 0, 0.9, tz);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 8, 6),
      mat('#2f6b2a', { roughness: 0.9 }),
    );
    canopy.position.set(0, 2.4, tz);
    canopy.castShadow = true;
    group.add(trunk, canopy);
    // Small planter ring
    const ring = box(1.2, 0.2, 1.2, '#6a6050', 0, 0.12, tz, { cast: false });
    group.add(ring);
  }

  // Lane markings — 6 travel lanes (3 each way) around median
  const laneXs = [-22, -16, -10, 10, 16, 22];
  const lineMat = new THREE.MeshBasicMaterial({ color: '#d4b84a' });
  const whiteLine = new THREE.MeshBasicMaterial({ color: '#d8d4c8' });
  for (const x of laneXs) {
    for (let z = -55; z < 55; z += 4.5) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.8), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.055, z);
      group.add(dash);
    }
  }
  // Solid edge lines near curb
  for (const x of [-BLVD_EDGE + 0.6, BLVD_EDGE - 0.6]) {
    for (let z = -55; z < 55; z += 3) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.4), whiteLine);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.055, z);
      group.add(edge);
    }
  }

  // Crosswalks (zebra) spanning full Blvd at z = -20 and z = 18
  for (const cz of [-20, 18]) {
    const stripes = 18;
    for (let i = 0; i < stripes; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.15), crossMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-BLVD_EDGE + 1.4 + i * ((blvdW - 2.8) / (stripes - 1)), 0.06, cz);
      group.add(stripe);
    }
    // Crosswalk stop bars
    for (const side of [-1, 1] as const) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(blvdW - 1, 0.35), whiteLine);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(0, 0.058, cz + side * 3.2);
      group.add(bar);
    }
  }

  // Local streets
  function street(x: number, z: number, w: number, d: number) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphaltMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.015, z);
    s.receiveShadow = true;
    group.add(s);
  }
  street(-60, -8, 60, 7);
  street(-60, 22, 60, 7);
  street(60, -8, 60, 7);
  street(60, 22, 60, 7);
  street(-42, 0, 7, 80);
  street(-78, 0, 7, 80);
  street(42, 0, 7, 80);
  street(78, 0, 7, 80);

  // Sidewalk corridors (crowd paths) — denser coverage
  const sidewalkDefs = [
    { minX: -95, maxX: -BLVD_EDGE - 1, minZ: -13, maxZ: -4 },
    { minX: -95, maxX: -BLVD_EDGE - 1, minZ: 14, maxZ: 23 },
    { minX: -95, maxX: -BLVD_EDGE - 1, minZ: -36, maxZ: -27 },
    { minX: -95, maxX: -BLVD_EDGE - 1, minZ: 28, maxZ: 36 },
    { minX: BLVD_EDGE + 1, maxX: 95, minZ: -13, maxZ: -4 },
    { minX: BLVD_EDGE + 1, maxX: 95, minZ: 14, maxZ: 23 },
    { minX: BLVD_EDGE + 1, maxX: 95, minZ: -36, maxZ: -27 },
    { minX: BLVD_EDGE + 1, maxX: 95, minZ: 28, maxZ: 36 },
    // Along Blvd curbs
    { minX: -BLVD_EDGE - 4, maxX: -BLVD_EDGE - 0.5, minZ: -50, maxZ: 50 },
    { minX: BLVD_EDGE + 0.5, maxX: BLVD_EDGE + 4, minZ: -50, maxZ: 50 },
  ];
  sidewalkSpans.push(...sidewalkDefs);

  for (const s of sidewalkDefs) {
    const w = s.maxX - s.minX;
    const d = s.maxZ - s.minZ;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), swMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((s.minX + s.maxX) / 2, 0.03, (s.minZ + s.maxZ) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Curbs along Blvd
  addCurb(group, -BLVD_EDGE - 0.25, 0, 0.5, 120);
  addCurb(group, BLVD_EDGE + 0.25, 0, 0.5, 120);

  // Buildings — Rego Park (west) & Forest Hills (east), pushed clear of wider Blvd
  const buildingSpecs: {
    x: number; z: number; w: number; d: number; h: number;
    palette: number; storefront?: 'south' | 'north' | 'both' | 'none';
  }[] = [
    // Rego
    { x: -52, z: -30, w: 18, d: 12, h: 14, palette: 0, storefront: 'south' },
    { x: -72, z: -30, w: 14, d: 12, h: 10, palette: 1, storefront: 'south' },
    { x: -52, z: 6, w: 16, d: 14, h: 18, palette: 2, storefront: 'south' },
    { x: -72, z: 6, w: 12, d: 12, h: 12, palette: 3, storefront: 'south' },
    { x: -52, z: 36, w: 20, d: 14, h: 11, palette: 4, storefront: 'north' },
    { x: -74, z: 36, w: 14, d: 12, h: 9, palette: 5, storefront: 'north' },
    { x: -38, z: -34, w: 10, d: 10, h: 9, palette: 6, storefront: 'south' },
    { x: -38, z: 38, w: 12, d: 10, h: 15, palette: 7, storefront: 'north' },
    { x: -88, z: -8, w: 12, d: 14, h: 8, palette: 8, storefront: 'south' },
    { x: -88, z: 20, w: 11, d: 12, h: 13, palette: 9, storefront: 'south' },
    // Forest Hills
    { x: 52, z: -30, w: 18, d: 12, h: 16, palette: 10, storefront: 'south' },
    { x: 72, z: -30, w: 14, d: 12, h: 11, palette: 11, storefront: 'south' },
    { x: 52, z: 6, w: 16, d: 14, h: 20, palette: 0, storefront: 'south' },
    { x: 72, z: 6, w: 12, d: 12, h: 13, palette: 1, storefront: 'south' },
    { x: 52, z: 36, w: 18, d: 14, h: 12, palette: 2, storefront: 'north' },
    { x: 74, z: 36, w: 14, d: 12, h: 10, palette: 3, storefront: 'north' },
    { x: 38, z: -34, w: 10, d: 10, h: 9, palette: 4, storefront: 'south' },
    { x: 40, z: 38, w: 14, d: 10, h: 14, palette: 5, storefront: 'north' },
    { x: 88, z: -8, w: 12, d: 14, h: 10, palette: 6, storefront: 'south' },
    { x: 88, z: 20, w: 11, d: 12, h: 12, palette: 7, storefront: 'south' },
  ];

  buildingSpecs.forEach((b) => addBuilding(group, colliders, b));

  // ——— Corner Bodega (Rego) — landmark red awning + detail ———
  {
    const x = -36, z = -6;
    const shop = box(9, 5.2, 7, '#e8dcc8', x, 2.6, z);
    group.add(shop);
    addCollider(colliders, x, z, 9, 7);

    // Brick band
    const brick = box(9.1, 1.2, 0.15, '#a06050', x, 0.6, z + 3.55, { cast: false });
    group.add(brick);

    // Red striped awning
    const awning = box(9.4, 0.2, 2.6, '#c62828', x, 3.7, z + 4.0);
    group.add(awning);
    for (let i = 0; i < 5; i++) {
      const stripe = box(1.5, 0.05, 2.55, i % 2 === 0 ? '#c62828' : '#fff8e7', x - 3.6 + i * 1.8, 3.58, z + 4.0, { cast: false });
      group.add(stripe);
    }

    // Sign
    const sign = box(6, 0.9, 0.18, '#fff8e7', x, 4.55, z + 3.6);
    group.add(sign);
    const signBar = box(6.2, 0.12, 0.12, '#c62828', x, 5.05, z + 3.6, { cast: false });
    group.add(signBar);

    // Door + cold-case windows
    const door = new THREE.Mesh(doorGeo, mat('#3e2723', { roughness: 0.65 }));
    door.position.set(x - 1.5, 1.1, z + 3.6);
    group.add(door);
    for (const sx of [0.8, 2.6]) {
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.6),
        mat('#88c8e0', { roughness: 0.2, metalness: 0.25, emissive: '#204050', emissiveIntensity: 0.35 }),
      );
      glass.position.set(x + sx, 1.7, z + 3.58);
      group.add(glass);
    }

    // Fruit crates / sidewalk display
    const crateColors = ['#e74c3c', '#f1c40f', '#27ae60', '#e67e22'];
    for (let i = 0; i < 4; i++) {
      const crate = box(0.7, 0.45, 0.55, '#8d6e63', x - 3.2 + i * 0.9, 0.25, z + 4.6, { cast: true });
      const fruit = box(0.55, 0.2, 0.4, crateColors[i], x - 3.2 + i * 0.9, 0.55, z + 4.6, { cast: false });
      group.add(crate, fruit);
    }

    // Neon-ish open sign
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.45, 0.08),
      mat('#ff5252', { roughness: 0.4, emissive: '#ff1744', emissiveIntensity: 0.7 }),
    );
    neon.position.set(x + 3.2, 3.9, z + 3.58);
    group.add(neon);
  }

  // Blvd plaza monument — east curb after crossing (must navigate full Blvd)
  {
    const x = 22, z = -20;
    const base = box(3.4, 0.45, 3.4, '#8a8070', x, 0.22, z);
    const pillar = box(0.85, 3.4, 0.85, '#c9b896', x, 2.1, z);
    const cap = box(1.2, 0.25, 1.2, '#a09070', x, 3.9, z, { cast: true });
    group.add(base, pillar, cap);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 10),
      mat('#e8a838', { roughness: 0.4, metalness: 0.2, emissive: '#a06010', emissiveIntensity: 0.45 }),
    );
    marker.position.set(x, 4.35, z);
    marker.castShadow = true;
    group.add(marker);
    // Small plaza pavers
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), mat('#a8a090', { roughness: 0.9 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(x, 0.04, z);
    plaza.receiveShadow = true;
    group.add(plaza);
  }

  // Subway entrance (Forest Hills) — more station detail
  {
    const x = 42, z = 18;
    const kiosk = box(7, 3.4, 4.5, '#3a5a8a', x, 1.7, z);
    group.add(kiosk);
    addCollider(colliders, x, z, 7, 4.5);
    // Green MTA-ish rail / stripe
    const rail = box(6, 1.3, 0.22, '#22c55e', x, 3.7, z + 2.35);
    group.add(rail);
    const rail2 = box(6, 0.2, 0.22, '#fff', x, 4.4, z + 2.35, { cast: false });
    group.add(rail2);
    // Stair well hint
    const stairs = box(3.5, 0.15, 2.5, '#2a2a2a', x - 1, 0.1, z + 3.2, { cast: false });
    group.add(stairs);
    for (let i = 0; i < 4; i++) {
      const step = box(3.3, 0.18, 0.45, '#444', x - 1, 0.2 + i * 0.2, z + 2.4 + i * 0.4, { cast: false });
      group.add(step);
    }
    // Globe lamps
    for (const sx of [-2.8, 2.8]) {
      const pole = box(0.12, 2.8, 0.12, '#333', x + sx, 1.4, z + 2.0, { cast: false });
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 10, 8),
        mat('#fff4cc', { roughness: 0.3, emissive: '#ffcc66', emissiveIntensity: 0.65 }),
      );
      globe.position.set(x + sx, 3.0, z + 2.0);
      group.add(pole, globe);
    }
  }

  // Post office (FH)
  {
    const x = 62, z = -6;
    const po = box(11, 6.5, 8, '#6b8f6b', x, 3.25, z);
    group.add(po);
    addCollider(colliders, x, z, 11, 8);
    addStorefront(group, x, z, 11, 8, 'south', '#1565c0', '#2e4a2e');
    const flagpole = box(0.1, 5, 0.1, '#888', x + 4, 5.5, z + 4.2, { cast: false });
    group.add(flagpole);
  }

  // Streetlights along Blvd (emissive only — no point lights for mobile)
  for (let z = -48; z <= 48; z += 14) {
    for (const x of [-BLVD_EDGE - 1.2, BLVD_EDGE + 1.2]) {
      const pole = box(0.16, 5.5, 0.16, '#4a4a4a', x, 2.75, z, { cast: false });
      const arm = box(1.2, 0.1, 0.1, '#4a4a4a', x + (x < 0 ? 0.5 : -0.5), 5.4, z, { cast: false });
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 6),
        mat('#fff2c8', { roughness: 0.35, emissive: '#ffd27a', emissiveIntensity: 0.5 }),
      );
      lamp.position.set(x + (x < 0 ? 1.0 : -1.0), 5.25, z);
      group.add(pole, arm, lamp);
    }
  }

  // Street furniture along sidewalks
  const furnitureSpots: { x: number; z: number; kind: 'hydrant' | 'trash' | 'bench' | 'mail' }[] = [];
  for (let z = -45; z <= 45; z += 11) {
    furnitureSpots.push({ x: -BLVD_EDGE - 2.2, z, kind: 'hydrant' });
    furnitureSpots.push({ x: BLVD_EDGE + 2.2, z: z + 3, kind: 'trash' });
  }
  for (let z = -40; z <= 40; z += 18) {
    furnitureSpots.push({ x: -BLVD_EDGE - 2.8, z, kind: 'bench' });
    furnitureSpots.push({ x: BLVD_EDGE + 2.8, z: z + 6, kind: 'bench' });
  }
  furnitureSpots.push({ x: -40, z: -5, kind: 'mail' });
  furnitureSpots.push({ x: 48, z: -5, kind: 'mail' });
  furnitureSpots.push({ x: -55, z: 16, kind: 'trash' });
  furnitureSpots.push({ x: 55, z: 16, kind: 'hydrant' });
  furnitureSpots.push({ x: -45, z: -30, kind: 'bench' });
  furnitureSpots.push({ x: 45, z: -30, kind: 'bench' });

  for (const f of furnitureSpots) {
    if (f.kind === 'hydrant') addHydrant(group, f.x, f.z);
    else if (f.kind === 'trash') addTrashCan(group, f.x, f.z);
    else if (f.kind === 'bench') addBench(group, f.x, f.z, f.x < 0 ? Math.PI / 2 : -Math.PI / 2);
    else addMailbox(group, f.x, f.z);
  }

  addBusShelter(group, colliders, -BLVD_EDGE - 2.5, 8);
  addBusShelter(group, colliders, BLVD_EDGE + 2.5, -8);

  // Traffic signal poles at crosswalks
  for (const cz of [-20, 18]) {
    for (const cx of [-BLVD_EDGE - 1.5, BLVD_EDGE + 1.5]) {
      const pole = box(0.2, 4.5, 0.2, '#333', cx, 2.25, cz, { cast: false });
      const housing = box(0.35, 1.0, 0.35, '#222', cx, 4.6, cz, { cast: false });
      const red = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        mat('#ff2222', { emissive: '#ff0000', emissiveIntensity: 0.8, roughness: 0.4 }),
      );
      red.position.set(cx, 4.9, cz);
      const yel = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        mat('#ffcc00', { emissive: '#aa8800', emissiveIntensity: 0.3, roughness: 0.4 }),
      );
      yel.position.set(cx, 4.6, cz);
      const grn = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        mat('#22cc44', { emissive: '#118822', emissiveIntensity: 0.25, roughness: 0.4 }),
      );
      grn.position.set(cx, 4.3, cz);
      group.add(pole, housing, red, yel, grn);
    }
  }

  const goals: GoalZone[] = [
    {
      id: 'blvd-plaza',
      questId: 'blvd-cross',
      x: 22,
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
      z: -1.5,
      radius: 4,
      label: 'Corner Bodega',
      dialog:
        'Red awning, cold case humming. “Eggs, milk, and a coffee — you got it.” Groceries acquired. Queens tradition upheld.',
      completeMsg: 'Errand done: Groceries secured!',
    },
    {
      id: 'subway',
      questId: 'subway-stop',
      x: 42,
      z: 15.5,
      radius: 4.5,
      label: 'Subway Entrance',
      dialog:
        'Forest Hills station plaza. A green globe, a rush of footsteps, the M/R rumble somewhere below. You’re on time enough.',
      completeMsg: 'Errand done: Reached the subway!',
    },
    {
      id: 'post',
      x: 62,
      z: -1,
      radius: 4,
      label: 'Post Office',
      dialog: 'Fluorescent calm and a short line. You mail a postcard. The clerk stamps it like poetry.',
    },
  ];

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
      { x: -22, dir: 1 },
      { x: -16, dir: 1 },
      { x: -10, dir: 1 },
      { x: 10, dir: -1 },
      { x: 16, dir: -1 },
      { x: 22, dir: -1 },
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
  if (x < -BLVD_EDGE) return 'Rego Park';
  if (x > BLVD_EDGE) return 'Forest Hills';
  return 'Queens Blvd';
}

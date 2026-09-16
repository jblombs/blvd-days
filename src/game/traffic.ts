import * as THREE from 'three';

interface Car {
  mesh: THREE.Group;
  x: number;
  z: number;
  speed: number;
  laneX: number;
  dir: 1 | -1;
}

const CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
  '#ecf0f1', '#2c3e50', '#16a085', '#d35400', '#7f8c8d',
  '#1abc9c', '#e74c3c',
];

export class Traffic {
  readonly group = new THREE.Group();
  private cars: Car[] = [];

  /** Queens Blvd runs along Z; lanes at fixed X — 6 lanes for wide-cross feel */
  constructor(lanes?: { x: number; dir: 1 | -1 }[]) {
    const laneDefs = lanes ?? [
      { x: -22, dir: 1 as const },
      { x: -16, dir: 1 as const },
      { x: -10, dir: 1 as const },
      { x: 10, dir: -1 as const },
      { x: 16, dir: -1 as const },
      { x: 22, dir: -1 as const },
    ];

    let i = 0;
    for (const lane of laneDefs) {
      const perLane = 5;
      for (let n = 0; n < perLane; n++) {
        const z = -52 + n * 22 + (lane.dir > 0 ? 0 : 11) + (i % 3) * 2;
        const isBus = i % 11 === 0;
        const mesh = isBus ? makeBus(CAR_COLORS[i % CAR_COLORS.length]) : makeCar(CAR_COLORS[i % CAR_COLORS.length]);
        mesh.position.set(lane.x, 0, z);
        mesh.rotation.y = lane.dir > 0 ? 0 : Math.PI;
        this.group.add(mesh);
        this.cars.push({
          mesh,
          x: lane.x,
          z,
          speed: (isBus ? 9 : 11) + Math.random() * 7,
          laneX: lane.x,
          dir: lane.dir,
        });
        i++;
      }
    }
  }

  update(dt: number) {
    for (const c of this.cars) {
      c.z += c.dir * c.speed * dt;
      if (c.dir > 0 && c.z > 60) c.z = -60;
      if (c.dir < 0 && c.z < -60) c.z = 60;
      c.mesh.position.set(c.x, 0, c.z);
    }
  }
}

function makeCar(color: string): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), dark);
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8);
  for (const [wx, wz] of [[-0.9, 1.2], [0.9, 1.2], [-0.9, -1.2], [0.9, -1.2]] as const) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.35, wz);
    g.add(w);
  }
  // Headlights hint
  const lightMat = new THREE.MeshStandardMaterial({
    color: '#fff8e0', roughness: 0.4, emissive: '#ffe8a0', emissiveIntensity: 0.35,
  });
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), lightMat);
  hl.position.set(-0.5, 0.55, 2.1);
  const hr = hl.clone();
  hr.position.x = 0.5;
  g.add(body, cabin, hl, hr);
  return g;
}

function makeBus(color: string): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#1a6b4a', roughness: 0.5, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 7.5), bodyMat);
  body.position.y = 1.15;
  body.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.25, 7.52), accent);
  stripe.position.y = 0.7;
  const windows = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.55, 5.5),
    new THREE.MeshStandardMaterial({
      color: '#88b8d0', roughness: 0.3, metalness: 0.2, emissive: '#203040', emissiveIntensity: 0.2,
    }),
  );
  windows.position.set(0, 1.55, -0.3);
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 8);
  for (const [wx, wz] of [[-1.1, 2.5], [1.1, 2.5], [-1.1, -2.5], [1.1, -2.5]] as const) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.45, wz);
    g.add(w);
  }
  g.add(body, stripe, windows);
  return g;
}

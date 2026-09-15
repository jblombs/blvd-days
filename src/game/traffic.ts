import * as THREE from 'three';

interface Car {
  mesh: THREE.Group;
  x: number;
  z: number;
  speed: number;
  laneX: number;
  dir: 1 | -1;
}

const CAR_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1', '#2c3e50', '#16a085'];

export class Traffic {
  readonly group = new THREE.Group();
  private cars: Car[] = [];

  /** Queens Blvd runs along Z; lanes at fixed X */
  constructor() {
    const lanes: { x: number; dir: 1 | -1 }[] = [
      { x: -14, dir: 1 },
      { x: -8, dir: 1 },
      { x: 8, dir: -1 },
      { x: 14, dir: -1 },
    ];

    let i = 0;
    for (const lane of lanes) {
      for (let n = 0; n < 4; n++) {
        const z = -45 + n * 24 + (lane.dir > 0 ? 0 : 12);
        const mesh = makeCar(CAR_COLORS[i % CAR_COLORS.length]);
        mesh.position.set(lane.x, 0, z);
        mesh.rotation.y = lane.dir > 0 ? 0 : Math.PI;
        this.group.add(mesh);
        this.cars.push({
          mesh,
          x: lane.x,
          z,
          speed: 12 + Math.random() * 8,
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
      if (c.dir > 0 && c.z > 55) c.z = -55;
      if (c.dir < 0 && c.z < -55) c.z = 55;
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
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 10);
  for (const [wx, wz] of [[-0.9, 1.2], [0.9, 1.2], [-0.9, -1.2], [0.9, -1.2]] as const) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.35, wz);
    g.add(w);
  }
  g.add(body, cabin);
  return g;
}

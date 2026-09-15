import * as THREE from 'three';
import type { Collider } from './types';
import { resolveCircleColliders } from './world';

export class Player {
  readonly group: THREE.Group;
  x = -50;
  z = -8;
  yaw = Math.PI / 2; // face toward Blvd (+X)
  radius = 0.45;
  speed = 7.5;
  private bob = 0;
  private body: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    // Simple stylized person (fictional local)
    const skin = new THREE.MeshStandardMaterial({ color: '#c68642', roughness: 0.75 });
    const shirt = new THREE.MeshStandardMaterial({ color: '#3d6ea5', roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.8 });
    const hair = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.45, 4, 8), shirt);
    torso.position.y = 1.05;
    torso.castShadow = true;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
    head.position.y = 1.65;
    head.castShadow = true;

    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), hair);
    hairMesh.scale.set(1, 0.55, 1);
    hairMesh.position.y = 1.78;

    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.35, 3, 6), pants);
    legL.position.set(-0.12, 0.4, 0);
    const legR = legL.clone();
    legR.position.x = 0.12;

    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 3, 6), skin);
    armL.position.set(-0.38, 1.1, 0);
    const armR = armL.clone();
    armR.position.x = 0.38;

    this.body.add(torso, head, hairMesh, legL, legR, armL, armR);
    this.sync();
  }

  private sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.yaw;
  }

  update(
    dt: number,
    move: { x: number; z: number },
    camYaw: number,
    colliders: Collider[],
    crowdPush: { x: number; z: number },
  ) {
    const moving = Math.hypot(move.x, move.z) > 0.05;
    if (moving) {
      // Camera-relative movement
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const wx = move.x * cos + move.z * sin;
      const wz = -move.x * sin + move.z * cos;
      this.x += wx * this.speed * dt;
      this.z += wz * this.speed * dt;
      this.yaw = Math.atan2(wx, wz);
      this.bob += dt * 10;
      this.body.position.y = Math.abs(Math.sin(this.bob)) * 0.06;
    } else {
      this.body.position.y = 0;
    }

    this.x += crowdPush.x;
    this.z += crowdPush.z;

    const resolved = resolveCircleColliders(this.x, this.z, this.radius, colliders);
    this.x = resolved.x;
    this.z = resolved.z;

    // Soft world bounds
    this.x = Math.max(-95, Math.min(95, this.x));
    this.z = Math.max(-55, Math.min(55, this.z));

    this.sync();
  }
}

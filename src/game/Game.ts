import * as THREE from 'three';
import { Input } from './input';
import { Player } from './player';
import { QuestLog } from './quests';
import { buildWorld, areaName } from './world';
import { Crowd } from './crowd';
import { Traffic } from './traffic';
import { Weather } from './weather';
import type { GameState, GoalZone } from './types';

function isMobileClient(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
}

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  private player: Player;
  private quests: QuestLog;
  private crowd: Crowd;
  private traffic: Traffic;
  private weather: Weather;
  private colliders: ReturnType<typeof buildWorld>['colliders'];
  private goals: GoalZone[];
  private state: GameState = 'title';
  private camYaw = 0;
  private completedIds = new Set<string>();
  private toastTimer = 0;
  private clock = new THREE.Clock();

  private el = {
    title: document.getElementById('title-screen')!,
    game: document.getElementById('game-screen')!,
    win: document.getElementById('win-screen')!,
    area: document.getElementById('area-label')!,
    meterFill: document.getElementById('meter-fill')!,
    meterText: document.getElementById('meter-text')!,
    questList: document.getElementById('quest-list')!,
    toast: document.getElementById('toast')!,
    dialog: document.getElementById('dialog')!,
    dialogText: document.getElementById('dialog-text')!,
    dialogOk: document.getElementById('dialog-ok')!,
    weatherBtn: document.getElementById('btn-weather')!,
    interactPrompt: document.getElementById('interact-prompt')!,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.camera.position.set(0, 12, 16);

    const mobile = isMobileClient();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      powerPreference: 'high-performance',
    });
    // Phone Safari: keep DPR modest so denser world stays playable
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const hemi = new THREE.HemisphereLight(0xd6ecff, 0x7a9a4e, 0.7);
    this.scene.add(hemi);

    // Single shadow-casting sun — never add street point lights
    const sun = new THREE.DirectionalLight(0xfff4d6, 2.15);
    sun.position.set(52, 72, 30);
    sun.castShadow = true;
    const mapSize = mobile ? 512 : 1024;
    sun.shadow.mapSize.set(mapSize, mapSize);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 180;
    sun.shadow.camera.left = -75;
    sun.shadow.camera.right = 75;
    sun.shadow.camera.top = 75;
    sun.shadow.camera.bottom = -75;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xa8c8ff, 0.45);
    fill.position.set(-30, 20, -20);
    this.scene.add(fill);

    const world = buildWorld();
    this.scene.add(world.group);
    this.colliders = world.colliders;
    this.goals = world.goals;

    this.weather = new Weather(this.scene, sun, hemi, fill, world.wetSurfaces);

    this.player = new Player();
    this.scene.add(this.player.group);

    // Denser sidewalk crowds; soft collision unchanged; skip ped castShadow
    this.crowd = new Crowd(world.sidewalkSpans, mobile ? 80 : 104);
    this.scene.add(this.crowd.group);

    this.traffic = new Traffic(world.blvdLanes, !mobile);
    this.scene.add(this.traffic.group);

    this.input = new Input();
    this.quests = new QuestLog();

    document.getElementById('btn-start')!.addEventListener('click', () => this.startPlay());
    document.getElementById('btn-replay')!.addEventListener('click', () => this.restart());
    this.el.dialogOk.addEventListener('click', () => this.closeDialog());
    this.el.weatherBtn.addEventListener('click', () => {
      const mode = this.weather.toggle();
      this.el.weatherBtn.textContent = mode === 'sunny' ? '☀️ Sunny' : '🌧️ Rainy';
    });

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderQuestUI();
    this.updateMeter();
  }

  start() {
    this.clock.start();
    const loop = () => {
      const dt = Math.min(0.05, this.clock.getDelta());
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private startPlay() {
    this.el.title.classList.add('hidden');
    this.el.win.classList.add('hidden');
    this.el.game.classList.remove('hidden');
    this.state = 'playing';
    this.resize();
    this.clock.getDelta();
  }

  private restart() {
    this.quests.reset();
    this.completedIds.clear();
    this.player.x = -50;
    this.player.z = -8;
    this.player.yaw = Math.PI / 2;
    this.renderQuestUI();
    this.updateMeter();
    this.hideToast();
    this.closeDialog();
    this.startPlay();
  }

  private resize() {
    const parent = this.canvas.parentElement ?? document.body;
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  private update(dt: number) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.hideToast();
    }

    this.traffic.update(dt);
    this.weather.update(dt, this.player.x, this.player.z);

    if (this.state === 'dialog') {
      if (this.input.consumeInteract()) this.closeDialog();
      this.updateCamera(dt);
      return;
    }

    if (this.state !== 'playing') {
      this.input.consumeInteract();
      return;
    }

    const move = this.input.getMove();
    const crowdPush = this.crowd.update(
      dt,
      this.colliders,
      this.player.x,
      this.player.z,
      this.player.radius,
    );
    this.player.update(dt, move, this.camYaw, this.colliders, crowdPush);
    this.el.area.textContent = areaName(this.player.x);
    this.updateCamera(dt);

    const near = this.nearbyGoal();
    if (near) {
      this.el.interactPrompt.textContent = `E · ${near.label}`;
      this.el.interactPrompt.classList.remove('hidden');
    } else {
      this.el.interactPrompt.classList.add('hidden');
    }

    if (this.input.consumeInteract()) this.tryInteract();
  }

  private updateCamera(dt: number) {
    const desiredYaw = this.player.yaw + Math.PI;
    let dy = desiredYaw - this.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.camYaw += dy * Math.min(1, dt * 3.5);

    const dist = 11;
    const height = 7.5;
    const tx = this.player.x + Math.sin(this.camYaw) * dist;
    const tz = this.player.z + Math.cos(this.camYaw) * dist;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.z += (tz - this.camera.position.z) * Math.min(1, dt * 5);
    this.camera.position.y += (height - this.camera.position.y) * Math.min(1, dt * 5);
    this.camera.lookAt(this.player.x, 1.2, this.player.z);
  }

  private nearbyGoal(): GoalZone | null {
    let best: GoalZone | null = null;
    let bestD = Infinity;
    for (const g of this.goals) {
      const d = Math.hypot(g.x - this.player.x, g.z - this.player.z);
      if (d <= g.radius && d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  private tryInteract() {
    const near = this.nearbyGoal();
    if (!near) {
      this.showToast('Nothing to interact with — look for gold rings');
      return;
    }

    this.openDialog(near.dialog);

    if (near.questId && !this.completedIds.has(near.id)) {
      const done = this.quests.complete(near.questId);
      if (done) {
        this.completedIds.add(near.id);
        this.renderQuestUI();
        this.updateMeter();
        const msg = near.completeMsg ?? 'Errand complete!';
        window.setTimeout(() => {
          if (this.state === 'playing' || this.state === 'dialog') this.showToast(msg);
        }, 120);
        if (this.quests.allDone()) {
          window.setTimeout(() => this.showWin(), 1000);
        }
      }
    }
  }

  private openDialog(text: string) {
    this.state = 'dialog';
    this.el.dialogText.textContent = text;
    this.el.dialog.classList.remove('hidden');
  }

  private closeDialog() {
    this.el.dialog.classList.add('hidden');
    if (this.state === 'dialog') this.state = 'playing';
  }

  private showWin() {
    this.state = 'won';
    this.el.win.classList.remove('hidden');
  }

  private showToast(msg: string) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.remove('hidden');
    this.toastTimer = 2.2;
  }

  private hideToast() {
    this.el.toast.classList.add('hidden');
    this.toastTimer = 0;
  }

  private renderQuestUI() {
    this.el.questList.innerHTML = '';
    for (const q of this.quests.quests) {
      const li = document.createElement('li');
      li.textContent = q.title;
      li.classList.add(q.status === 'completed' ? 'done' : 'active');
      li.title = q.hint;
      this.el.questList.appendChild(li);
    }
  }

  private updateMeter() {
    const n = this.quests.completedCount();
    const total = this.quests.quests.length;
    this.el.meterFill.style.width = `${(n / total) * 100}%`;
    this.el.meterText.textContent = `${n} / ${total}`;
  }

  private draw() {
    if (this.state === 'title') {
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

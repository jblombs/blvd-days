export class Input {
  private keys = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private interactQueued = false;
  private pointerId: number | null = null;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const base = document.getElementById('joystick-base');
    if (base) {
      base.addEventListener('pointerdown', this.onJoyDown);
      window.addEventListener('pointermove', this.onJoyMove);
      window.addEventListener('pointerup', this.onJoyUp);
      window.addEventListener('pointercancel', this.onJoyUp);
    }

    const interactBtn = document.getElementById('btn-interact');
    interactBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.queueInteract();
    });
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (
      ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(k) ||
      k === 'e'
    ) {
      e.preventDefault();
    }
    this.keys.add(k);
    if (k === 'e' || k === ' ') this.queueInteract();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onJoyDown = (e: PointerEvent) => {
    e.preventDefault();
    const base = e.currentTarget as HTMLElement;
    base.setPointerCapture(e.pointerId);
    this.pointerId = e.pointerId;
    this.updateJoy(e, base);
  };

  private onJoyMove = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    const base = document.getElementById('joystick-base');
    if (!base) return;
    this.updateJoy(e, base);
  };

  private onJoyUp = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.joyX = 0;
    this.joyY = 0;
    const knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  };

  private updateJoy(e: PointerEvent, base: HTMLElement) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.38;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.joyX = dx / max;
    this.joyY = dy / max;
    const knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  private queueInteract() {
    this.interactQueued = true;
  }

  consumeInteract(): boolean {
    if (this.interactQueued) {
      this.interactQueued = false;
      return true;
    }
    return false;
  }

  /** XZ movement intent: x = strafe, z = forward (negative joyY = forward) */
  getMove(): { x: number; z: number } {
    let x = this.joyX;
    let z = this.joyY;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }
}

import * as THREE from 'three';

/** Canvas-baked sign textures — readable at street distance, shared across landmarks. */
const cache = new Map<string, THREE.CanvasTexture>();

export function makeSignTexture(opts: {
  text: string;
  sub?: string;
  w?: number;
  h?: number;
  bg?: string;
  fg?: string;
  border?: string;
  accent?: string;
}): THREE.CanvasTexture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 192;
  const key = `${opts.text}|${opts.sub ?? ''}|${w}x${h}|${opts.bg}|${opts.fg}|${opts.border}|${opts.accent}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = opts.bg ?? '#fff8e7';
  ctx.fillRect(0, 0, w, h);

  // Border
  const border = opts.border ?? '#c62828';
  ctx.strokeStyle = border;
  ctx.lineWidth = Math.max(6, h * 0.06);
  ctx.strokeRect(4, 4, w - 8, h - 8);

  if (opts.accent) {
    ctx.fillStyle = opts.accent;
    ctx.fillRect(0, h - h * 0.12, w, h * 0.12);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.fg ?? '#1a1a1a';

  if (opts.sub) {
    ctx.font = `bold ${Math.floor(h * 0.38)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(opts.text, w / 2, h * 0.4, w * 0.9);
    ctx.font = `600 ${Math.floor(h * 0.2)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = opts.fg ?? '#333';
    ctx.fillText(opts.sub, w / 2, h * 0.72, w * 0.9);
  } else {
    ctx.font = `bold ${Math.floor(h * 0.48)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(opts.text, w / 2, h / 2, w * 0.9);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

export function makeSignPlane(
  texture: THREE.CanvasTexture,
  width: number,
  height: number,
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.55,
    metalness: 0.05,
    emissive: '#222222',
    emissiveIntensity: 0.08,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

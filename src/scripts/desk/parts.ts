import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shared building blocks for the desk scene. Units are metres; y is up, the
// desk top is at DESK_Y, x runs left→right as you sit, +z points at you.

export const DESK_Y = 0.75;

/**
 * What clicking does: pick it up and look at it, fly into a monitor,
 * open the book, flip the light bar, or nothing.
 */
export type Action = 'inspect' | 'screen' | 'book' | 'toggle' | 'none';

export interface Interactive {
	id: string;
	label: string;
	/** One line, shown on hover. */
	hint: string;
	object: THREE.Object3D;
	/** How far it rises on hover, in metres. */
	lift: number;
	action?: Action; // default 'inspect'
	/** A few sentences for the card shown while you hold it. */
	about?: string;
	/** Rotation (camera space, radians) it settles into when picked up. */
	present?: [number, number, number];
	/** What actually comes up when clicked, if not the object itself (one page off a pile). */
	holdObject?: THREE.Object3D;
	/** Held size multiplier (paper wants to fill the screen to be readable). */
	holdScale?: number;
	/** Monitors: which part of the site they open to. */
	section?: string;
	/**
	 * Where you can reach it from: 'seated' (default) only once you're in the
	 * chair; 'above' only from the bird's-eye view (things out of sight from
	 * the chair, like the drawers); 'always' from anywhere (the light bar).
	 */
	reach?: 'seated' | 'above' | 'always';
	/** Can be flipped over to read the back (sheets of notes). */
	flippable?: boolean;
	/** Picked up / put back / 0→1 progress into your hand, for per-object effects. */
	onPick?: () => void;
	onPutBack?: () => void;
	onHoldProgress?: (k: number) => void;
	/** Called every frame while held (e.g. a spinner spinning). */
	whileHeld?: (dt: number) => void;
}

/** Ambient animation hook: called every frame with elapsed seconds. */
export type Ticker = (t: number, dt: number) => void;

let blobTex: THREE.Texture | null = null;
/** Soft, round contact shadow to sit under objects so they feel grounded. */
export function blobShadow(w: number, d: number, opacity = 0.45) {
	if (!blobTex) {
		const c = document.createElement('canvas');
		c.width = c.height = 64;
		const ctx = c.getContext('2d')!;
		const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
		g.addColorStop(0, 'rgba(0,0,0,1)');
		g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 64, 64);
		blobTex = new THREE.CanvasTexture(c);
	}
	const m = new THREE.Mesh(
		new THREE.PlaneGeometry(w, d),
		new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false, color: '#000000' }),
	);
	m.rotation.x = -Math.PI / 2;
	m.renderOrder = 1;
	return m;
}

/**
 * A turned part (pen barrel, knob, bottle) from a side profile of
 * [radius, y] points, spun around the y axis.
 */
export function lathe(profile: [number, number][], mat: THREE.Material, segments = 12) {
	const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
	return mesh(new THREE.LatheGeometry(pts, segments), mat);
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Standard material, shared between meshes that ask for the same look. */
export function std(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) {
	const key = typeof color === 'string' && Object.keys(extra).length === 0 ? color : null;
	if (key && matCache.has(key)) return matCache.get(key)!;
	const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });
	if (key) matCache.set(key, m);
	return m;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], cast = true, receive = true) {
	const m = new THREE.Mesh(geo, mat);
	m.castShadow = cast;
	m.receiveShadow = receive;
	return m;
}

export function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], r = 0) {
	const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
	return mesh(geo, mat);
}

/** A box whose top face gets its own material (for printed tops / screens). */
export function topBox(w: number, h: number, d: number, side: THREE.Material, top: THREE.Material) {
	return box(w, h, d, [side, side, top, side, side, side]);
}

/** Group placed on the desk surface at (x, z), turned by `ry` radians. */
export function onDesk(x: number, z: number, ry = 0, y = DESK_Y) {
	const g = new THREE.Group();
	g.position.set(x, y, z);
	g.rotation.y = ry;
	return g;
}

/** A flexible cable / jumper wire through the given points. */
export function cable(points: THREE.Vector3[], radius: number, mat: THREE.Material, segments = 24) {
	const curve = new THREE.CatmullRomCurve3(points);
	const m = mesh(new THREE.TubeGeometry(curve, segments, radius, 5), mat);
	return m;
}

/**
 * Rows of header pins as one instanced mesh. Each row runs along x, starting
 * at (x0, z), `count` pins at 2.54 mm pitch.
 */
export function headerPins(rows: { x0: number; z: number; count: number }[], y: number, mat: THREE.Material, h = 0.006) {
	const total = rows.reduce((n, r) => n + r.count, 0);
	const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0009, h, 0.0009), mat, total);
	const m4 = new THREE.Matrix4();
	let i = 0;
	for (const r of rows) {
		for (let k = 0; k < r.count; k++) {
			m4.makeTranslation(r.x0 + k * 0.00254, y, r.z);
			inst.setMatrixAt(i++, m4);
		}
	}
	inst.castShadow = false;
	return inst;
}

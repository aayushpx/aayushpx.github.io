import * as THREE from 'three';
import type { PagerInfo, Reading } from './book';
import { buildDesk, DESK_Y, type Interactive } from './build';
import { lowResSheetUrls } from './notes';
import { blobShadow } from './parts';

// The desk scene. Scroll flies the camera from above your head down into your
// eyes; the mouse (or a swipe) looks around; clicking things picks them up,
// flies into a monitor, or opens the book. Ambient life (dust, LEDs, clocks)
// keeps it breathing, throttled so idle frames stay cheap.

export type Mode = 'browse' | 'inspect' | 'screen' | 'book';

/** What the page does in response to the scene. */
export interface DeskUI {
	showCard(item: Interactive): void;
	hideCard(): void;
	showScreen(section: string): void;
	hideScreen(): void;
	showBook(info: PagerInfo): void;
	updateBook(info: PagerInfo): void;
	hideBook(): void;
	modeChanged(mode: Mode): void;
}

export interface DeskOptions {
	canvas: HTMLCanvasElement;
	scrollTrack: HTMLElement;
	tooltip: HTMLElement;
	ui: DeskUI;
	onProgress?: (p: number) => void;
	onLightBarClick?: () => void;
	reading: Reading | null;
	reducedMotion: boolean;
	night: boolean;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);

export async function startDesk(opts: DeskOptions) {
	const { canvas, scrollTrack, tooltip, ui } = opts;
	const rm = opts.reducedMotion;

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'default' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	// Shadows only re-render when lighting or an object actually moves.
	renderer.shadowMap.autoUpdate = false;

	const loader = new THREE.TextureLoader();
	const maxAniso = renderer.capabilities.getMaxAnisotropy();
	const load = (url: string) =>
		loader.loadAsync(url).then((t) => {
			t.colorSpace = THREE.SRGBColorSpace;
			t.anisotropy = maxAniso;
			return t;
		});
	const loUrls = lowResSheetUrls();
	const [whiteboard, ...lo] = await Promise.all([load('/desk/notes/whiteboard.webp'), ...loUrls.map(load)]);
	const sheetsLo = new Map(loUrls.map((u, i) => [u, lo[i]]));

	const scene = new THREE.Scene();
	const desk = buildDesk({ whiteboard, sheetsLo, loadHi: load, reading: opts.reading });
	scene.add(desk.root);

	// ------------------------------------------------------------ lights
	const hemi = new THREE.HemisphereLight('#e8eef6', '#4a4038', 1.2);
	const sky = new THREE.DirectionalLight('#fff1dc', 2.2);
	sky.position.set(0.6, 2.8, -2.2);
	sky.target.position.set(0, DESK_Y, 0);
	sky.castShadow = true;
	sky.shadow.mapSize.set(1024, 1024);
	Object.assign(sky.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.5, far: 6 });
	sky.shadow.bias = -0.0005;
	sky.shadow.normalBias = 0.01;
	const fill = new THREE.DirectionalLight('#dfe6f0', 0.9);
	fill.position.set(-0.5, 2.2, 2.5);
	// The monitor light bar: the only lamp, and the main light at night.
	const lamp = new THREE.SpotLight('#ffd2a1', 0, 2.2, 1.05, 0.75, 1.4);
	lamp.position.set(0, 1.285, -0.32);
	lamp.target.position.set(0, DESK_Y, 0.02);
	lamp.castShadow = true;
	lamp.shadow.mapSize.set(1024, 1024);
	lamp.shadow.bias = -0.0008;
	lamp.shadow.normalBias = 0.01;
	const screenGlow = new THREE.PointLight('#a9c4ff', 0, 1.8, 1.5);
	screenGlow.position.set(0, 1.05, -0.1);
	for (const l of [hemi, sky, fill, lamp, screenGlow]) {
		l.layers.enableAll(); // lights also reach the held-object pass (layer 1)
		scene.add(l);
	}
	scene.add(sky.target, lamp.target);

	// Light from your point of view: only on while something is in your hand,
	// and stronger the darker the room, so a held book or whiteboard is always
	// readable. Always present (at 0) so the light count never changes and
	// shaders never recompile.
	const eye = new THREE.DirectionalLight('#fff3e2', 0);
	const eyeFill = new THREE.AmbientLight('#ffffff', 0);
	eye.layers.enableAll();
	eyeFill.layers.enableAll();
	scene.add(eyeFill);

	const DAY = {
		hemi: 1.15, hemiSky: new THREE.Color('#e8eef6'), hemiGround: new THREE.Color('#4a4038'),
		sky: 2.4, skyColor: new THREE.Color('#fff1dc'), fill: 0.9, lamp: 0, glow: 0,
		window: 1.25, windowColor: new THREE.Color('#eef4ff'), screens: 0.92, strip: 0,
		bg: new THREE.Color('#d9d6cf'), exposure: 1.0,
	};
	const NIGHT = {
		hemi: 0.07, hemiSky: new THREE.Color('#33405e'), hemiGround: new THREE.Color('#141110'),
		sky: 0.18, skyColor: new THREE.Color('#8ea4d8'), fill: 0.05, lamp: 4.2, glow: 0.55,
		window: 0.35, windowColor: new THREE.Color('#16233d'), screens: 1.0, strip: 2.5,
		bg: new THREE.Color('#0b0d12'), exposure: 1.05,
	};
	let night = opts.night ? 1 : 0;
	let nightTarget = night;
	const bgColor = new THREE.Color();
	scene.background = bgColor;
	function applyLighting(t: number) {
		const l = (a: number, b: number) => a + (b - a) * t;
		hemi.intensity = l(DAY.hemi, NIGHT.hemi);
		hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, t);
		hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, t);
		sky.intensity = l(DAY.sky, NIGHT.sky);
		sky.color.copy(DAY.skyColor).lerp(NIGHT.skyColor, t);
		fill.intensity = l(DAY.fill, NIGHT.fill);
		// the light bar comes on late in the transition, like a switch
		const lampT = smooth(clamp((t - 0.35) / 0.4));
		lamp.intensity = NIGHT.lamp * lampT;
		desk.lightBarStrip.emissiveIntensity = NIGHT.strip * lampT;
		screenGlow.intensity = l(DAY.glow, NIGHT.glow);
		desk.windowGlass.emissive.copy(DAY.windowColor).lerp(NIGHT.windowColor, t);
		desk.windowGlass.emissiveIntensity = l(DAY.window, NIGHT.window);
		const s = l(DAY.screens, NIGHT.screens);
		for (const m of desk.screens) m.color.setScalar(s);
		bgColor.copy(DAY.bg).lerp(NIGHT.bg, t);
		renderer.toneMappingExposure = l(DAY.exposure, NIGHT.exposure);
		dustMat.uniforms.uOpacity.value = 0.55 * (1 - t);
		renderer.shadowMap.needsUpdate = true;
	}

	// ------------------------------------------------------------ dust in the sunlight
	const DUST = 260;
	const dustPos = new Float32Array(DUST * 3);
	const dustSeed = new Float32Array(DUST);
	for (let i = 0; i < DUST; i++) {
		dustPos[i * 3] = -0.9 + Math.random() * 1.8;
		dustPos[i * 3 + 1] = 0.8 + Math.random() * 1.1;
		dustPos[i * 3 + 2] = -0.45 + Math.random() * 1.0;
		dustSeed[i] = Math.random();
	}
	const dustGeo = new THREE.BufferGeometry();
	dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
	dustGeo.setAttribute('seed', new THREE.BufferAttribute(dustSeed, 1));
	const dustMat = new THREE.ShaderMaterial({
		uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.55 }, uScale: { value: 400 } },
		vertexShader: /* glsl */ `
			attribute float seed;
			uniform float uTime;
			uniform float uScale;
			varying float vA;
			void main() {
				vec3 p = position;
				float t = uTime * 0.12 + seed * 40.0;
				p += vec3(sin(t) * 0.06, sin(t * 0.7 + seed * 6.0) * 0.05, cos(t * 0.8) * 0.05);
				vec4 mv = modelViewMatrix * vec4(p, 1.0);
				gl_PointSize = (0.0025 + seed * 0.0025) * uScale / -mv.z;
				vA = 0.3 + 0.7 * fract(seed * 7.13);
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */ `
			uniform float uOpacity;
			varying float vA;
			void main() {
				float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
				gl_FragColor = vec4(1.0, 0.95, 0.85, a * vA * uOpacity);
			}`,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	const dust = new THREE.Points(dustGeo, dustMat);
	dust.frustumCulled = false;
	scene.add(dust);
	applyLighting(night);

	// ------------------------------------------------------------ contact shadows
	scene.updateMatrixWorld(true);
	{
		const b3 = new THREE.Box3();
		const size = new THREE.Vector3();
		const c = new THREE.Vector3();
		for (const i of desk.interactives) {
			const a = i.action ?? 'inspect';
			// no blobs under paper: a shadow plane at the same height z-fights with it
			if (a === 'screen' || a === 'toggle' || i.id.startsWith('sheet')) continue;
			b3.setFromObject(i.object);
			b3.getSize(size);
			b3.getCenter(c);
			if (size.x > 0.6 || size.z > 0.6) continue;
			const blob = blobShadow(size.x * 1.3 + 0.012, size.z * 1.3 + 0.012, 0.4);
			blob.position.set(c.x, b3.min.y + 0.0007, c.z);
			blob.userData.base = 0.4;
			desk.root.add(blob);
			i.object.userData.blob = blob;
		}
	}

	// ------------------------------------------------------------ camera
	const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 30);
	camera.add(eye, eye.target);
	eye.position.set(0, 0.05, 0);
	eye.target.position.set(0, 0, -1);
	scene.add(camera);
	// Above your head → behind you → down into your eyes.
	const path = new THREE.CatmullRomCurve3([
		new THREE.Vector3(0, 2.7, 0.95),
		new THREE.Vector3(0, 2.2, 1.4),
		new THREE.Vector3(0, 1.55, 1.2),
		new THREE.Vector3(0, 1.22, 0.7),
	]);
	// Seated, you look slightly down: keyboard at the bottom, screens on top.
	const aim = new THREE.CatmullRomCurve3([
		new THREE.Vector3(0, DESK_Y, 0.05),
		new THREE.Vector3(0, 0.8, -0.02),
		new THREE.Vector3(0, 0.84, -0.2),
		new THREE.Vector3(0, 0.86, -0.35),
	]);

	let visible = true;
	new IntersectionObserver(([e]) => {
		visible = e.isIntersecting;
		dirty = true;
	}).observe(canvas);

	function fit() {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		// Keep roughly the same horizontal view on any screen shape.
		const hfov = THREE.MathUtils.degToRad(78);
		const vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect);
		camera.fov = clamp(THREE.MathUtils.radToDeg(vfov), 42, 88);
		camera.updateProjectionMatrix();
		dustMat.uniforms.uScale.value = (h * renderer.getPixelRatio() * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
		dirty = true;
	}

	// ------------------------------------------------------------ state
	let mode: Mode = 'browse';
	let progress = 0;
	let progressTarget = 0;
	const look = { x: 0, y: 0, tx: 0, ty: 0 };
	const pointer = new THREE.Vector2(9, 9);
	let pointerInside = false;
	let dirty = true;

	function setMode(m: Mode) {
		mode = m;
		document.documentElement.classList.toggle('desk-locked', m !== 'browse');
		ui.modeChanged(m);
		dirty = true;
	}

	function readScroll() {
		if (mode !== 'browse') return;
		const r = scrollTrack.getBoundingClientRect();
		const span = r.height - window.innerHeight;
		progressTarget = span > 0 ? clamp(-r.top / span) : 1;
	}
	readScroll();
	progress = progressTarget;

	// The browsing camera: scroll position plus where you're looking.
	const tmpPos = new THREE.Vector3();
	const tmpTgt = new THREE.Vector3();
	const dir = new THREE.Vector3();
	const UP = new THREE.Vector3(0, 1, 0);
	const right3 = new THREE.Vector3();
	const lookM = new THREE.Matrix4();
	function browsePose(outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
		const p = smooth(progress);
		path.getPoint(p, outPos);
		aim.getPoint(p, tmpTgt);
		dir.subVectors(tmpTgt, outPos).normalize();
		const seated = smooth(clamp((progress - 0.82) / 0.18));
		const yaw = -look.x * (0.05 + 0.62 * seated);
		// Up a little (to the screens), down further (to the notes).
		const pitch = look.y * (0.03 + (look.y > 0 ? 0.16 : 0.3) * seated);
		// Looking down also leans you in over the desk, close enough to read.
		const lean = seated * smooth(clamp(-look.y));
		outPos.z -= 0.26 * lean;
		outPos.y -= 0.08 * lean;
		dir.applyAxisAngle(UP, yaw);
		right3.crossVectors(dir, UP).normalize();
		dir.applyAxisAngle(right3, pitch);
		tmpTgt.copy(outPos).add(dir);
		lookM.lookAt(outPos, tmpTgt, UP);
		outQuat.setFromRotationMatrix(lookM);
		return seated;
	}

	// Camera flights (into a monitor and back out).
	const fly = {
		active: false,
		t: 0,
		dur: 0.9,
		fromPos: new THREE.Vector3(),
		fromQuat: new THREE.Quaternion(),
		toPos: new THREE.Vector3(),
		toQuat: new THREE.Quaternion(),
		toBrowse: false,
		done: null as null | (() => void),
	};
	function flyTo(pos: THREE.Vector3 | null, quat: THREE.Quaternion | null, done: () => void) {
		fly.fromPos.copy(camera.position);
		fly.fromQuat.copy(camera.quaternion);
		fly.toBrowse = !pos;
		if (pos && quat) {
			fly.toPos.copy(pos);
			fly.toQuat.copy(quat);
		}
		fly.t = 0;
		fly.dur = rm ? 0.01 : 0.95;
		fly.active = true;
		fly.done = done;
	}

	// ------------------------------------------------------------ monitors
	let screenItem: Interactive | null = null;
	function enterScreen(item: Interactive) {
		const obj = item.object;
		obj.updateMatrixWorld();
		const c = new THREE.Vector3(0, 0.012, 0.0115).applyMatrix4(obj.matrixWorld);
		const n = new THREE.Vector3(0, 0, 1).transformDirection(obj.matrixWorld);
		const vf = THREE.MathUtils.degToRad(camera.fov);
		const sw = 0.606;
		const sh = (sw * 9) / 16;
		const d = Math.max(sh / 2 / Math.tan(vf / 2), sw / 2 / (Math.tan(vf / 2) * camera.aspect)) * 0.98;
		const pos = c.clone().addScaledVector(n, d);
		const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, c, UP));
		screenItem = item;
		setHover(null);
		setMode('screen');
		flyTo(pos, quat, () => ui.showScreen(item.section ?? 'home'));
	}
	function leaveScreen() {
		ui.hideScreen();
		screenItem = null;
		flyTo(null, null, () => setMode('browse'));
	}

	// ------------------------------------------------------------ picking things up
	interface Held {
		item: Interactive;
		obj: THREE.Object3D;
		parent: THREE.Object3D;
		local: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 };
		world: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 };
		offset: THREE.Vector3;
		s: number;
		anchor: THREE.Vector3;
		quat: THREE.Quaternion;
		phase: 'in' | 'hold' | 'out';
		t: number;
		bookT: number;
		bookState: 'closed' | 'opening' | 'open' | 'closing';
	}
	let held: Held | null = null;
	let dimOpacity = 0;

	function pickUp(item: Interactive) {
		if (item.lift) {
			item.object.position.y = item.object.userData.baseY;
			item.object.userData.lift = 0;
		}
		const obj = item.holdObject ?? item.object;
		obj.visible = true;
		item.onPick?.();
		setHover(null);
		scene.updateMatrixWorld(true);
		const parent = obj.parent!;
		const local = { pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.clone() };
		// size it from its own upright shape, not its tilted footprint on the desk
		obj.position.set(0, 0, 0);
		obj.quaternion.identity();
		obj.updateMatrixWorld(true);
		const localBox = new THREE.Box3().setFromObject(obj);
		obj.position.copy(local.pos);
		obj.quaternion.copy(local.quat);
		obj.updateMatrixWorld(true);
		const sphere = localBox.getBoundingSphere(new THREE.Sphere());
		scene.attach(obj);
		const world = { pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.clone() };
		const offset = sphere.center.clone();

		const isBook = item.action === 'book';
		const d = 0.55;
		const halfH = d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
		const halfW = halfH * camera.aspect;
		const wide = camera.aspect > 1.1;
		const fitR = Math.min(halfH, halfW);
		// never larger than the view (a page is allowed nearly all of it)
		const R = Math.min(fitR * (isBook ? 0.62 : wide ? 0.52 : 0.56) * (item.holdScale ?? 1), fitR * 1.12);
		const s = clamp(R / sphere.radius, 0.25, 9);
		const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
		const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
		const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
		const anchor = camera.position.clone().addScaledVector(fwd, d);
		// leave room for the info card: to the right on wide screens, below on phones
		if (isBook) anchor.addScaledVector(camRight, 0.08 * s);
		else if (wide) anchor.addScaledVector(camRight, -halfW * 0.22);
		else anchor.addScaledVector(camUp, halfH * 0.2);

		const [px, py, pz] = item.present ?? [1.0, 0, 0];
		const quat = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(px, py, pz)));
		obj.traverse((o) => o.layers.set(1));
		held = { item, obj, parent, local, world, offset, s, anchor, quat, phase: 'in', t: 0, bookT: 0, bookState: 'closed' };
		setMode(isBook ? 'book' : 'inspect');
		if (!isBook) ui.showCard(item);
	}

	function putBack() {
		if (!held || held.phase === 'out') return;
		if (held.item.action === 'book' && held.bookState !== 'closed') {
			ui.hideBook();
			held.bookState = 'closing';
			return; // closes the cover first, then flies back
		}
		ui.hideCard();
		held.world.pos.copy(held.world.pos); // fly back to where it came from
		held.phase = 'out';
		held.t = 0;
	}

	const spin = new THREE.Quaternion();
	const tmpQ = new THREE.Quaternion();
	const tmpV = new THREE.Vector3();
	function updateHeld(dt: number, time: number) {
		if (!held) return false;
		const h = held;
		const dur = rm ? 0.01 : 0.75;
		if (h.phase !== 'hold') h.t = Math.min(1, h.t + dt / dur);
		const k = h.phase === 'in' ? ease(h.t) : h.phase === 'out' ? 1 - ease(h.t) : 1;

		// book: open once it arrives, close before it leaves
		if (h.item.action === 'book') {
			if (h.phase === 'hold' && h.bookState === 'closed' && h.t >= 1 && !h.obj.userData.wasOpened) {
				h.bookState = 'opening';
				// draw and upload every page now, so turning pages never stalls
				for (const t of h.obj.userData.pager.prepare()) renderer.initTexture(t);
				h.obj.userData.wasOpened = true;
			}
			if (h.bookState === 'opening' || h.bookState === 'closing') {
				const sp = rm ? 100 : 1.3;
				h.bookT = clamp(h.bookT + (h.bookState === 'opening' ? dt : -dt) * sp);
				h.obj.userData.setOpen?.(ease(h.bookT));
				if (h.bookState === 'opening' && h.bookT >= 1) {
					h.bookState = 'open';
					const pager = h.obj.userData.pager;
					pager.onChange = () => ui.updateBook(pager.info());
					ui.showBook(pager.info());
				}
				if (h.bookState === 'closing' && h.bookT <= 0) {
					h.bookState = 'closed';
					h.phase = 'out';
					h.t = 0;
				}
			}
		}
		if (h.phase === 'hold') h.item.whileHeld?.(dt);
		if (h.obj.userData.pager?.update(dt, rm)) renderer.shadowMap.needsUpdate = true;

		// target pose, with a gentle idle sway while held
		tmpQ.copy(h.quat);
		if (h.phase === 'hold' && !dragging && h.item.action !== 'book' && !rm) {
			spin.setFromAxisAngle(new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), Math.sin(time * 0.7) * 0.08);
			tmpQ.premultiply(spin);
		}
		const scl = THREE.MathUtils.lerp(h.world.scale.x, h.s, k);
		if (h.phase === 'hold') {
			// ease towards the target so flips and drags glide rather than snap
			h.obj.quaternion.slerp(tmpQ, rm ? 1 : 1 - Math.exp(-14 * dt));
		} else {
			h.obj.quaternion.slerpQuaternions(h.world.quat, tmpQ, k);
		}
		tmpV.copy(h.offset).multiplyScalar(h.s).applyQuaternion(h.obj.quaternion);
		h.item.onHoldProgress?.(k);
		const target = h.anchor.clone().sub(tmpV);
		h.obj.position.lerpVectors(h.world.pos, target, k);
		h.obj.position.y += Math.sin(k * Math.PI) * 0.05;
		h.obj.scale.setScalar(scl);
		dimOpacity = 0.62 * k;
		eye.intensity = k * (0.6 + 2.6 * night);
		eyeFill.intensity = k * (0.1 + 0.9 * night);
		const blob = h.obj.userData.blob as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
		if (blob) blob.material.opacity = blob.userData.base * (1 - k);
		if (h.item.holdObject) h.obj.visible = k > 0.001 || h.phase === 'in';

		if (h.phase === 'in' && h.t >= 1) h.phase = 'hold';
		if (h.phase === 'out' && h.t >= 1) {
			h.parent.attach(h.obj);
			h.obj.position.copy(h.local.pos);
			h.obj.quaternion.copy(h.local.quat);
			h.obj.scale.copy(h.local.scale);
			h.obj.traverse((o) => o.layers.set(0));
			h.obj.userData.reset?.();
			h.item.onPutBack?.();
			if (h.item.holdObject) h.obj.visible = false;
			h.obj.userData.wasOpened = false;
			h.obj.userData.setOpen?.(0);
			held = null;
			dimOpacity = 0;
			eye.intensity = 0;
			eyeFill.intensity = 0;
			setMode('browse');
		}
		return true;
	}

	// ------------------------------------------------------------ hover + clicks
	const raycaster = new THREE.Raycaster();
	// Hover and clicks test fixed, invisible boxes shaped to each object at
	// rest, so an object lifting on hover can't slide out from under the
	// cursor and flicker (thin pens did exactly that).
	const proxyRoot = new THREE.Group();
	proxyRoot.visible = false;
	scene.add(proxyRoot);
	const owner = new Map<THREE.Object3D, Interactive>();
	const proxyMat = new THREE.MeshBasicMaterial();
	{
		const b = new THREE.Box3();
		const size = new THREE.Vector3();
		for (const i of desk.interactives) {
			const o = i.object;
			o.userData.baseY = o.position.y;
			o.userData.lift = 0;
			const saved = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
			o.position.set(0, 0, 0);
			o.quaternion.identity();
			o.scale.set(1, 1, 1);
			o.updateMatrixWorld(true);
			b.setFromObject(o);
			o.position.copy(saved.p);
			o.quaternion.copy(saved.q);
			o.scale.copy(saved.s);
			o.updateMatrixWorld(true);
			b.getSize(size);
			const pad = 0.006;
			const box = new THREE.Mesh(new THREE.BoxGeometry(size.x + pad, Math.max(size.y, 0.004) + pad, size.z + pad), proxyMat);
			b.getCenter(box.position);
			const holder = new THREE.Group();
			holder.position.copy(saved.p);
			holder.quaternion.copy(saved.q);
			holder.add(box);
			proxyRoot.add(holder);
			owner.set(box, i);
		}
	}
	const hoverables = [proxyRoot];
	let hovered: Interactive | null = null;

	function setHover(next: Interactive | null) {
		if (next === hovered) return;
		hovered = next;
		canvas.style.cursor = next && (next.action ?? 'inspect') !== 'none' ? 'pointer' : '';
		if (next) {
			tooltip.querySelector('strong')!.textContent = next.label;
			tooltip.querySelector('span')!.textContent = next.hint;
			tooltip.dataset.show = 'true';
		} else {
			tooltip.dataset.show = 'false';
		}
	}

	// From above you can only reach what you can't see from the chair (the
	// drawers); once seated, the desk. The light bar works from anywhere.
	const seatedNow = () => progressTarget >= 0.9;
	function reachable(i: Interactive) {
		const r = i.reach ?? 'seated';
		return r === 'always' || (r === 'seated') === seatedNow();
	}
	function hit(ndc: THREE.Vector2) {
		raycaster.setFromCamera(ndc, camera);
		raycaster.layers.set(0);
		for (const h of raycaster.intersectObjects(hoverables, true)) {
			const i = owner.get(h.object);
			if (i && reachable(i)) return i;
		}
		return null;
	}
	function hitsHeld(ndc: THREE.Vector2) {
		if (!held) return false;
		raycaster.setFromCamera(ndc, camera);
		raycaster.layers.set(1);
		return raycaster.intersectObject(held.obj, true).length > 0;
	}

	function activate(item: Interactive) {
		switch (item.action ?? 'inspect') {
			case 'toggle':
				opts.onLightBarClick?.();
				break;
			case 'screen':
				enterScreen(item);
				break;
			case 'book':
			case 'inspect':
				pickUp(item);
				break;
		}
	}

	function toNdc(clientX: number, clientY: number, out = new THREE.Vector2()) {
		const r = canvas.getBoundingClientRect();
		return out.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
	}

	function tap(clientX: number, clientY: number) {
		if (fly.active) return;
		const ndc = toNdc(clientX, clientY);
		if (mode === 'browse') {
			const item = hit(ndc);
			if (item) activate(item);
		} else if (mode === 'inspect' && held?.phase === 'hold' && !hitsHeld(ndc)) {
			putBack();
		} else if (mode === 'book' && held?.phase === 'hold' && held.bookState === 'open') {
			raycaster.setFromCamera(ndc, camera);
			raycaster.layers.set(1);
			const h = raycaster.intersectObject(held.obj, true)[0];
			if (!h) return putBack();
			const local = held.obj.worldToLocal(h.point.clone());
			held.obj.userData.pager.turn(held.obj.userData.pager.sideOf(local.x));
		}
	}

	// Pointer handling: mouse moves look around; drags turn a held object;
	// on touch, a horizontal swipe looks around and a tap clicks.
	let dragging = false;
	let down: { x: number; y: number; t: number; lookX: number; moved: number; type: string } | null = null;
	const last = { x: 0, y: 0 };

	canvas.addEventListener('pointerdown', (e) => {
		down = { x: e.clientX, y: e.clientY, t: performance.now(), lookX: look.tx, moved: 0, type: e.pointerType };
		last.x = e.clientX;
		last.y = e.clientY;
		if (held && held.phase === 'hold' && mode === 'inspect') {
			dragging = true;
			canvas.setPointerCapture(e.pointerId);
		}
	});
	window.addEventListener(
		'pointermove',
		(e) => {
			if (down) down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
			if (dragging && held) {
				const dx = e.clientX - last.x;
				const dy = e.clientY - last.y;
				const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
				const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
				held.quat.premultiply(new THREE.Quaternion().setFromAxisAngle(camUp, dx * 0.01));
				held.quat.premultiply(new THREE.Quaternion().setFromAxisAngle(camRight, dy * 0.01));
				canvas.style.cursor = 'grabbing';
				dirty = true;
			} else if (e.pointerType === 'mouse') {
				toNdc(e.clientX, e.clientY, pointer);
				pointerInside = true;
				look.tx = clamp(pointer.x, -1, 1);
				look.ty = clamp(pointer.y, -1, 1);
				tooltip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
				dirty = true;
			} else if (down && mode === 'browse') {
				// touch: swipe sideways to turn your head
				look.tx = clamp(down.lookX - ((e.clientX - down.x) / canvas.clientWidth) * 2.4, -1, 1);
				dirty = true;
			}
			last.x = e.clientX;
			last.y = e.clientY;
		},
		{ passive: true },
	);
	window.addEventListener('pointerup', (e) => {
		const d = down;
		down = null;
		if (dragging) {
			dragging = false;
			canvas.style.cursor = '';
		}
		if (d && d.moved < 8 && performance.now() - d.t < 600 && e.target === canvas) tap(e.clientX, e.clientY);
	});
	window.addEventListener('pointercancel', () => {
		down = null;
		dragging = false;
	});
	document.documentElement.addEventListener('pointerleave', () => {
		pointerInside = false;
		look.tx = 0;
		look.ty = 0;
		dirty = true;
	});
	window.addEventListener('scroll', () => {
		readScroll();
		dirty = true;
	}, { passive: true });
	window.addEventListener('resize', fit);

	// ------------------------------------------------------------ two-pass render with dimming
	const dimScene = new THREE.Scene();
	const dimCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const dimMat = new THREE.MeshBasicMaterial({ color: '#05060a', transparent: true, opacity: 0, depthTest: false, depthWrite: false });
	dimScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dimMat));

	function render() {
		// The point-of-view light is only for what's in your hand: off for the
		// room pass (or it whitens the wall and window), on for the held pass.
		// Only its intensity changes, so no shader ever recompiles.
		const eyeI = eye.intensity;
		const fillI = eyeFill.intensity;
		eye.intensity = 0;
		eyeFill.intensity = 0;
		camera.layers.set(0);
		renderer.autoClear = true;
		renderer.render(scene, camera);
		eye.intensity = eyeI;
		eyeFill.intensity = fillI;
		if (held) {
			renderer.autoClear = false;
			dimMat.opacity = dimOpacity;
			if (dimOpacity > 0.001) renderer.render(dimScene, dimCam);
			renderer.clearDepth();
			camera.layers.set(1);
			scene.background = null;
			renderer.render(scene, camera);
			scene.background = bgColor;
			camera.layers.set(0);
			renderer.autoClear = true;
		}
	}

	// ------------------------------------------------------------ public controls
	function setNight(on: boolean) {
		nightTarget = on ? 1 : 0;
		if (rm) {
			night = nightTarget;
			applyLighting(night);
		}
		dirty = true;
	}
	/** Turn the held object over (sheets of notes: read the back). */
	function flip() {
		if (!held || held.phase !== 'hold') return;
		const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
		held.quat.premultiply(new THREE.Quaternion().setFromAxisAngle(camUp, Math.PI));
		dirty = true;
	}
	function turnPage(dir: 1 | -1) {
		if (mode === 'book' && held?.bookState === 'open') held.obj.userData.pager.turn(dir);
	}
	function close() {
		if (mode === 'inspect' || mode === 'book') putBack();
		else if (mode === 'screen' && !fly.active) leaveScreen();
	}

	// ------------------------------------------------------------ loop
	let lastNow = performance.now();
	let lastRender = 0;
	let lastProgressSent = -1;
	const startTime = performance.now();
	const camPos = new THREE.Vector3();
	const camQuat = new THREE.Quaternion();

	function frame(now: number) {
		requestAnimationFrame(frame);
		const dt = Math.min(0.05, (now - lastNow) / 1000);
		lastNow = now;
		const time = (now - startTime) / 1000;

		const prevP = progress;
		const prevLook = look.x + look.y;
		progress = rm ? progressTarget : damp(progress, progressTarget, 7, dt);
		if (Math.abs(progress - progressTarget) < 0.0005) progress = progressTarget;
		look.x = rm ? look.tx : damp(look.x, look.tx, 5, dt);
		look.y = rm ? look.ty : damp(look.y, look.ty, 5, dt);
		let animating = progress !== prevP || Math.abs(look.x + look.y - prevLook) > 1e-4;

		if (night !== nightTarget) {
			night = Math.abs(night - nightTarget) < 0.002 ? nightTarget : damp(night, nightTarget, 3.2, dt);
			applyLighting(night);
			animating = true;
		}

		// hover lift and its contact shadow
		let moved = false;
		for (const i of desk.interactives) {
			if (!i.lift || held?.item === i) continue;
			const want = hovered === i && mode === 'browse' ? 1 : 0;
			const cur = i.object.userData.lift as number;
			if (cur === want) continue;
			const next = rm ? want : Math.abs(cur - want) < 0.01 ? want : damp(cur, want, 14, dt);
			i.object.userData.lift = next;
			i.object.position.y = i.object.userData.baseY + i.lift * smooth(next);
			const blob = i.object.userData.blob as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
			if (blob) blob.material.opacity = blob.userData.base * (1 - 0.45 * smooth(next));
			moved = true;
		}

		if (updateHeld(dt, time)) {
			moved = moved || held?.phase !== 'hold';
			animating = true;
		}
		if (moved) {
			renderer.shadowMap.needsUpdate = true;
			animating = true;
		}

		// camera
		if (fly.active) {
			fly.t = Math.min(1, fly.t + dt / fly.dur);
			const k = ease(fly.t);
			if (fly.toBrowse) browsePose(fly.toPos, fly.toQuat);
			camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
			camera.quaternion.slerpQuaternions(fly.fromQuat, fly.toQuat, k);
			animating = true;
			if (fly.t >= 1) {
				fly.active = false;
				fly.done?.();
			}
		} else if (mode === 'browse') {
			browsePose(camPos, camQuat);
			camera.position.copy(camPos);
			camera.quaternion.copy(camQuat);
		}
		// You vanish as the camera enters your head.
		desk.person.visible = progress < 0.9;

		// ambient life
		for (const tick of desk.tickers) tick(time, dt);
		if (!rm) dustMat.uniforms.uTime.value = time;
		dust.visible = night < 0.98;

		if (!visible) return;
		// Idle frames (only dust, LEDs and clocks moving) run at ~30 fps.
		if (!dirty && !animating && now - lastRender < 33) return;
		dirty = false;
		lastRender = now;

		if (mode === 'browse' && !fly.active && pointerInside) {
			setHover(hit(pointer));
		} else if (mode === 'inspect' && held?.phase === 'hold' && !dragging) {
			canvas.style.cursor = hitsHeld(pointer) ? 'grab' : 'zoom-out';
		}
		render();

		if (opts.onProgress && Math.abs(progress - lastProgressSent) > 0.002) {
			lastProgressSent = progress;
			opts.onProgress(progress);
		}
	}

	fit();
	requestAnimationFrame(frame);

	return { setNight, close, flip, turnPage, mode: () => mode };
}

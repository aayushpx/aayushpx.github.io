import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildBench } from './bench';
import { buildRightSide, kuruToga, lamySafari, mujiGel } from './extras';
import { buildBook, type Reading } from './book';
import { buildNotes } from './notes';
import { box, cable, DESK_Y, mesh, onDesk, std, topBox, type Interactive, type Ticker } from './parts';
import * as tex from './textures';

export { DESK_Y, type Interactive, type Ticker };

/** "Thu 19 Nov  4:12 pm" in New Zealand, whoever is looking. */
export function nzClock(d = new Date()) {
	const f = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
	return f.format(d).replace(',', '');
}

// Positions were measured off the top-down reference photo (IMG_9911), using
// the keyboard (~0.44 m) as the scale bar.

export interface DeskScene {
	root: THREE.Group;
	interactives: Interactive[];
	person: THREE.Group;
	screens: THREE.MeshBasicMaterial[];
	windowGlass: THREE.MeshStandardMaterial;
	lightBarStrip: THREE.MeshStandardMaterial;
	tickers: Ticker[];
}

export function buildDesk(noteTextures: {
	whiteboard: THREE.Texture;
	sheetsLo: Map<string, THREE.Texture>;
	loadHi: (url: string) => Promise<THREE.Texture>;
	reading: Reading | null;
}): DeskScene {
	const root = new THREE.Group();
	const interactives: Interactive[] = [];
	const tickers: Ticker[] = [];
	const add = (i: Interactive) => {
		interactives.push(i);
		root.add(i.object);
	};

	// ---------------------------------------------------------------- room
	const floor = mesh(new THREE.PlaneGeometry(8, 8), std('#3b3530', { roughness: 1 }), false);
	floor.rotation.x = -Math.PI / 2;
	root.add(floor);

	const wallMat = std('#d9d6cf', { roughness: 0.95 });
	const wallZ = -0.52;
	const win = { x0: -1.05, x1: 1.0, y0: 0.86, y1: 2.15 };
	const wallPiece = (x0: number, x1: number, y0: number, y1: number) => {
		const m = box(x1 - x0, y1 - y0, 0.08, wallMat);
		m.position.set((x0 + x1) / 2, (y0 + y1) / 2, wallZ - 0.04);
		m.castShadow = false;
		root.add(m);
	};
	wallPiece(-3, win.x0, 0, 3);
	wallPiece(win.x1, 3, 0, 3);
	wallPiece(win.x0, win.x1, 0, win.y0);
	wallPiece(win.x0, win.x1, win.y1, 3);
	const side = box(0.08, 3, 3, wallMat);
	side.position.set(1.12, 1.5, 0.9);
	side.castShadow = false;
	root.add(side);

	const windowGlass = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#eef4ff', emissiveIntensity: 1.2 });
	const glass = mesh(new THREE.PlaneGeometry(win.x1 - win.x0, win.y1 - win.y0), windowGlass, false, false);
	glass.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, wallZ - 0.07);
	root.add(glass);
	const sill = box(win.x1 - win.x0 + 0.06, 0.03, 0.16, std('#e8e6e1'));
	sill.position.set((win.x0 + win.x1) / 2, win.y0 + 0.015, wallZ + 0.02);
	root.add(sill);

	const slatCount = Math.floor((win.y1 - win.y0) / 0.032);
	const slats = new THREE.InstancedMesh(
		new THREE.BoxGeometry(win.x1 - win.x0 - 0.02, 0.003, 0.025),
		std('#ecebe6', { roughness: 0.6 }),
		slatCount,
	);
	slats.castShadow = true;
	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0, 0));
	for (let i = 0; i < slatCount; i++) {
		m4.compose(new THREE.Vector3((win.x0 + win.x1) / 2, win.y1 - 0.02 - i * 0.032, wallZ - 0.03), q, new THREE.Vector3(1, 1, 1));
		slats.setMatrixAt(i, m4);
	}
	root.add(slats);

	// ---------------------------------------------------------------- desk
	const deskTop = box(1.95, 0.03, 0.86, std('#ffffff', { map: tex.carbon(), roughness: 0.55 }), 0.006);
	deskTop.position.set(0, DESK_Y - 0.015, -0.08);
	root.add(deskTop);
	const legMat = std('#151515', { roughness: 0.5 });
	for (const [x, z] of [
		[-0.9, -0.42],
		[0.9, -0.42],
		[-0.9, 0.28],
		[0.9, 0.28],
	]) {
		const leg = box(0.05, DESK_Y - 0.03, 0.05, legMat);
		leg.position.set(x, (DESK_Y - 0.03) / 2, z);
		root.add(leg);
	}

	const deskMat = box(0.84, 0.003, 0.34, std('#121316', { roughness: 0.95 }), 0.0015);
	deskMat.position.set(0.12, DESK_Y + 0.0015, 0.19);
	deskMat.castShadow = false;
	root.add(deskMat);

	// low drawers to the right, with the spare white keyboard on top
	const drawers = box(0.42, 0.55, 0.45, std('#1d1e21', { roughness: 0.7 }), 0.01);
	drawers.position.set(0.82, 0.275, 0.62);
	root.add(drawers);
	const spare = buildKeyboard({ x: 0.82, z: 0.6, y: 0.55, ry: Math.PI / 2 - 0.05, compact: true });
	add({ id: 'spare-keyboard', label: 'The other keyboard', hint: 'Benched. For now', about: 'A spare. It sits on the drawers waiting for a project that needs a second keyboard.', object: spare, lift: 0.008, reach: 'above' });

	// ---------------------------------------------------------------- monitors
	// Three 27" panels in a gentle arc. The side panels are placed so their
	// inner bezels meet the centre panel's edges, with no gap.
	const screens: THREE.MeshBasicMaterial[] = [];
	const bezel = std('#18191b', { roughness: 0.4 });
	const W = 0.62;
	const H = 0.37;
	const screenDraws: ((clock: string, blink: boolean) => boolean)[] = [];
	const makeMonitor = (variant: number, main: boolean, accent?: string) => {
		const live = tex.liveScreen(variant, main);
		screenDraws.push(live.draw);
		const screenTex = live.texture;
		const g = new THREE.Group();
		g.add(box(W, H, 0.022, bezel, 0.003));
		const back = box(0.32, 0.2, 0.04, bezel, 0.01);
		back.position.z = -0.025;
		g.add(back);
		const sMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
		screens.push(sMat);
		const screen = mesh(new THREE.PlaneGeometry(W - 0.014, (W - 0.014) * (9 / 16)), sMat, false, false);
		screen.position.set(0, 0.012, 0.0115);
		g.add(screen);
		if (accent) {
			const line = mesh(new THREE.PlaneGeometry(W - 0.004, 0.003), new THREE.MeshBasicMaterial({ color: accent }), false, false);
			line.position.set(0, -H / 2 + 0.0015, 0.0112);
			g.add(line);
		}
		return g;
	};
	const MON_Y = 1.09;
	const CENTER_Z = -0.36;
	const TILT = 0.52;
	const center = makeMonitor(1, true, '#c2364a'); // the AOC's red trim
	center.position.set(0, MON_Y, CENTER_Z);
	add({ id: 'monitor-center', label: 'Main monitor', hint: 'Click to open the site', object: center, lift: 0, action: 'screen', section: 'home' });
	const sideX = W / 2 + (W / 2) * Math.cos(TILT) + 0.002;
	const sideZ = CENTER_Z + (W / 2) * Math.sin(TILT) + 0.004;
	const left = makeMonitor(0, false);
	left.position.set(-sideX, MON_Y, sideZ);
	left.rotation.y = TILT;
	add({ id: 'monitor-left', label: 'Left monitor', hint: 'Click for projects', object: left, lift: 0, action: 'screen', section: 'projects' });
	const right = makeMonitor(2, false);
	right.position.set(sideX, MON_Y, sideZ);
	right.rotation.y = -TILT;
	add({ id: 'monitor-right', label: 'Right monitor', hint: 'Click for writing', object: right, lift: 0, action: 'screen', section: 'writing' });

	// live clock (New Zealand time) and a blinking prompt on the screens
	let lastSecond = -1;
	tickers.push((t) => {
		const sec = Math.floor(t * 1.6);
		if (sec === lastSecond) return;
		lastSecond = sec;
		const clock = nzClock();
		for (const draw of screenDraws) draw(clock, sec % 2 === 0);
	});

	// left monitor's stand, with the soldering station built into its base
	const baseL = onDesk(-sideX - 0.03, sideZ - 0.05, TILT);
	const disc = mesh(new THREE.CylinderGeometry(0.125, 0.13, 0.014, 12), bezel);
	disc.position.y = 0.007;
	baseL.add(disc);
	const neck = box(0.05, MON_Y - DESK_Y - 0.1, 0.03, bezel);
	neck.position.set(0, (MON_Y - DESK_Y - 0.1) / 2, -0.035);
	baseL.add(neck);
	const station = box(0.09, 0.03, 0.05, std('#222326'), 0.004);
	station.position.set(0, 0.03, 0.04);
	baseL.add(station);
	const knob = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 8), std('#9a9a9a', { metalness: 0.6 }));
	knob.rotation.x = Math.PI / 2;
	knob.position.set(0.03, 0.032, 0.068);
	baseL.add(knob);
	const display = mesh(new THREE.PlaneGeometry(0.03, 0.012), new THREE.MeshBasicMaterial({ color: '#ff6a2a' }), false, false);
	display.position.set(-0.015, 0.032, 0.0651);
	baseL.add(display);
	root.add(baseL);

	// centre and right monitors hang off a desk arm behind them
	const arm = box(0.04, 0.4, 0.04, legMat);
	arm.position.set(0.15, DESK_Y + 0.2, -0.47);
	root.add(arm);
	const armBar = box(0.9, 0.025, 0.03, legMat);
	armBar.position.set(0.35, 1.05, -0.43);
	root.add(armBar);

	// monitor cables dropping behind the desk
	for (const [x, col] of [
		[-0.35, '#202022'],
		[0.05, '#202022'],
		[0.42, '#202022'],
		[0.1, '#e9e9e6'],
	] as const) {
		root.add(
			cable(
				[
					new THREE.Vector3(x, MON_Y - 0.1, -0.41),
					new THREE.Vector3(x + 0.02, DESK_Y + 0.08, -0.45),
					new THREE.Vector3(x + 0.04, DESK_Y + 0.002, -0.46),
					new THREE.Vector3(x + 0.05, DESK_Y - 0.25, -0.5),
				],
				0.003,
				std(col, { roughness: 0.7 }),
				14,
			),
		);
	}

	// the monitor light bar: the only lamp on this desk
	const lightBarStrip = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffd9a8', emissiveIntensity: 0 });
	const bar = new THREE.Group();
	const barBody = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.46, 8), std('#141414', { roughness: 0.4 }));
	barBody.rotation.z = Math.PI / 2;
	bar.add(barBody);
	const strip = mesh(new THREE.PlaneGeometry(0.44, 0.01), lightBarStrip, false, false);
	strip.rotation.x = Math.PI / 2;
	strip.position.set(0, -0.0135, 0.004);
	bar.add(strip);
	const barClamp = box(0.04, 0.03, 0.05, std('#141414'));
	barClamp.position.set(0, -0.02, -0.02);
	bar.add(barClamp);
	bar.position.set(0, MON_Y + H / 2 + 0.025, CENTER_Z + 0.025);
	add({ id: 'lightbar', label: 'Monitor light bar', hint: 'Click to switch it on or off', object: bar, lift: 0, action: 'toggle', reach: 'always' });

	// ---------------------------------------------------------------- keyboard + mouse
	add({ id: 'keyboard', label: 'Keyboard', hint: 'Light grey, dark grey, two orange keys', about: 'A full-size Keychron with a numpad, resting against a wooden wrist rest. Most of what you see on this site was typed here, in Neovim.', object: buildKeyboard({ x: 0, z: 0.18 }), lift: 0.006, present: [0.95, 0, 0] });

	const rest = box(0.37, 0.018, 0.075, std('#ffffff', { map: tex.wood(), roughness: 0.7 }), 0.006);
	rest.position.set(0.005, DESK_Y + 0.012, 0.31);
	root.add(rest);

	const mouse = onDesk(0.31, 0.22, -0.08);
	const shell = mesh(new THREE.SphereGeometry(1, 9, 6), std('#1c1d20', { roughness: 0.45, flatShading: true }));
	shell.scale.set(0.038, 0.022, 0.065);
	shell.position.y = 0.012;
	mouse.add(shell);
	const wing = mesh(new THREE.SphereGeometry(1, 7, 4), std('#2a2b2f', { roughness: 0.4, flatShading: true }));
	wing.scale.set(0.012, 0.012, 0.035);
	wing.position.set(-0.034, 0.01, 0.01);
	mouse.add(wing);
	const logo = mesh(new THREE.CircleGeometry(0.006, 8), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), false, false);
	logo.rotation.x = -Math.PI / 2;
	logo.position.set(0, 0.0345, 0.02);
	mouse.add(logo);
	add({ id: 'mouse', label: 'Mouse', hint: 'Wired. On purpose', about: 'Too many buttons, and I use about three of them.', object: mouse, lift: 0.008 });
	// the mouse cable runs back towards the monitors (the keyboard is wireless)
	const cord = std('#222224', { roughness: 0.7 });
	root.add(
		cable(
			[
				new THREE.Vector3(0.31, DESK_Y + 0.012, 0.155),
				new THREE.Vector3(0.33, DESK_Y + 0.004, 0.06),
				new THREE.Vector3(0.36, DESK_Y + 0.004, -0.2),
				new THREE.Vector3(0.33, DESK_Y + 0.004, -0.42),
				new THREE.Vector3(0.32, DESK_Y - 0.1, -0.48),
			],
			0.0017,
			cord,
		),
	);

	// ---------------------------------------------------------------- paper
	// Scanned, double-sided sheets of notes in two piles.
	buildNotes(root, add, noteTextures.sheetsLo, noteTextures.loadHi);

	// mini whiteboard lying flat
	const wb = onDesk(0.185, -0.135, 0.0);
	const wbBody = topBox(0.26, 0.008, 0.24, std('#e9e9e9'), std('#ffffff', { map: noteTextures.whiteboard, roughness: 0.35 }));
	wbBody.position.y = 0.004;
	wb.add(wbBody);
	add({ id: 'whiteboard', label: 'Mini whiteboard', hint: 'Mid-way through a search', about: 'A sorted array, two pointers and a target. Whatever is on here is usually whatever I was stuck on last.', object: wb, lift: 0.01, present: [Math.PI / 2, 0, 0], holdScale: 1.4 });

	// pens: Lamy Safari (mango), MUJI gel pen, uni Kuru Toga
	const lamyG = onDesk(-0.304, 0.012, 0.8, DESK_Y + 0.0045); // resting on the Big-O sheet
	lamyG.add(lamySafari());
	add({ id: 'lamy', label: 'Lamy Safari, mango', hint: 'Favourite pen', about: 'A Lamy Safari in mango, filled with black Pilot ink. Probably the reason this site has an orange accent.', object: lamyG, lift: 0.015, present: [0.5, 0, 0.25] });

	const muji = onDesk(-0.268, 0.034, 0.52, DESK_Y + 0.0045);
	muji.add(mujiGel());
	add({ id: 'muji', label: 'MUJI gel pen', hint: 'The everyday one', about: 'The pen that does most of the actual writing. Cheap, smooth, and somehow always nearby.', object: muji, lift: 0.015, present: [0.5, 0, 0.25] });

	const kuru = onDesk(-0.25, 0.052, 0.48, DESK_Y + 0.0045);
	kuru.add(kuruToga());
	add({ id: 'kurutoga', label: 'Kuru Toga 0.5', hint: 'The lead rotates. It matters', about: 'A mechanical pencil that turns the lead a little every stroke, so the point stays sharp. Diagrams and maths happen in pencil.', object: kuru, lift: 0.015, present: [0.5, 0, 0.25] });

	// ink bottle
	const ink = onDesk(-0.36, -0.235);
	const bottle = mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.04, 8), std('#0c0d10', { roughness: 0.15, metalness: 0.2 }));
	bottle.position.y = 0.02;
	ink.add(bottle);
	const inkCap = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), std('#111111'));
	inkCap.position.y = 0.05;
	ink.add(inkCap);
	add({ id: 'ink', label: 'Pilot ink, black', hint: 'For the Lamy', about: 'Bottled ink for the fountain pen. Refilling it is a small, satisfying ritual.', object: ink, lift: 0.01, present: [0.5, 0, 0] });

	// ---------------------------------------------------------------- book + mints
	// The book: opens in your hand, with my reading notes printed on its pages.
	buildBook(noteTextures.reading, add);

	const mints = onDesk(0.61, 0.093, 0.26, DESK_Y + 0.0065);
	const tinSide = std('#1d2077', { metalness: 0.6, roughness: 0.35 });
	const tin = topBox(0.08, 0.016, 0.05, tinSide, std('#ffffff', { map: tex.mintsLid(), metalness: 0.4, roughness: 0.35 }));
	tin.position.y = 0.008;
	mints.add(tin);
	add({ id: 'mints', label: 'Mints', hint: 'Intense mint. Non-negotiable', about: 'Always on the desk. Late nights run on these.', object: mints, lift: 0.015 });

	// ---------------------------------------------------------------- electronics + you
	buildBench(root, add, tickers);
	buildRightSide(root, add);

	const person = buildPerson();
	root.add(person);

	return { root, interactives, person, screens, windowGlass, lightBarStrip, tickers };
}

function buildKeyboard(o: { x: number; z: number; y?: number; ry?: number; compact?: boolean }) {
	const g = onDesk(o.x, o.z, o.ry ?? 0, o.y ?? DESK_Y);
	const U = 0.0193;
	const compact = !!o.compact;
	const widthU = compact ? 15 : 22.5;

	type Key = [number, number, number, number, 'a' | 'm' | 'o'];
	const keys: Key[] = [];
	const row = (r: number, spec: (number | [number, 'a' | 'm' | 'o'])[]) => {
		let x = 0;
		for (const s of spec) {
			const [w, c] = Array.isArray(s) ? s : [s, 'a' as const];
			if (w < 0) {
				x += -w;
				continue;
			}
			if (!compact || x + w <= 15.01) keys.push([x, r, w, 1, c]);
			x += w;
		}
	};
	const m = (w: number): [number, 'm'] => [w, 'm'];
	const o2 = (w: number): [number, 'o'] => [w, 'o'];
	if (!compact) row(0, [o2(1), -1, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.25, m(1), m(1), m(1)]);
	const r0 = compact ? 0 : 1.25;
	row(r0, [...Array(13).fill(1), m(2), -0.25, m(1), m(1), m(1), -0.25, m(1), m(1), m(1), m(1)]);
	row(r0 + 1, [m(1.5), ...Array(12).fill(1), m(1.5), -0.25, m(1), m(1), m(1), -0.25, 1, 1, 1]);
	row(r0 + 2, [m(1.75), ...Array(11).fill(1), o2(2.25), -3.5, 1, 1, 1]);
	row(r0 + 3, [m(2.25), ...Array(10).fill(1), m(2.75), -1.25, m(1), -1.25, 1, 1, 1]);
	row(r0 + 4, [m(1.25), m(1.25), m(1.25), 6.25, m(1.25), m(1.25), m(1.25), m(1.25), -0.25, m(1), m(1), m(1), -0.25, 2, 1]);
	if (!compact) keys.push([21.5, 2.25, 1, 2, 'm'], [21.5, 4.25, 1, 2, 'o']);
	const depthU = compact ? 5 : 6.25;

	const kbCase = box((widthU + 0.1) * U, 0.022, (depthU + 0.35) * U, std(compact ? '#e8e8e6' : '#1f2023', { roughness: 0.6 }), 0.004);
	kbCase.position.y = 0.011;
	g.add(kbCase);

	// Keychron palette: light grey alphas, dark grey mods, orange Esc + Enter
	const colors = compact
		? { a: new THREE.Color('#f2f2f0'), m: new THREE.Color('#f2f2f0'), o: new THREE.Color('#f2f2f0') }
		: { a: new THREE.Color('#b4b7bb'), m: new THREE.Color('#4d5056'), o: new THREE.Color('#e3602b') };
	const inst = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.12), std('#ffffff', { roughness: 0.7 }), keys.length);
	inst.castShadow = true;
	inst.receiveShadow = true;
	const mtx = new THREE.Matrix4();
	const ox = (-widthU * U) / 2;
	const oz = (-depthU * U) / 2;
	keys.forEach(([x, r, w, h, c], i) => {
		const gap = 0.12 * U;
		mtx.compose(
			new THREE.Vector3(ox + (x + w / 2) * U, 0.0275, oz + (r + h / 2) * U),
			new THREE.Quaternion(),
			new THREE.Vector3(w * U - gap, 0.011, h * U - gap),
		);
		inst.setMatrixAt(i, mtx);
		inst.setColorAt(i, colors[c]);
	});
	g.add(inst);
	return g;
}

function buildPerson() {
	const g = new THREE.Group();
	const shirt = std('#3f4a57', { flatShading: true, roughness: 0.9 });
	const skin = std('#7a4e33', { flatShading: true, roughness: 0.8 });
	const hair = std('#120e0b', { flatShading: true, roughness: 0.95 });

	// chair
	const chairMat = std('#202124', { roughness: 0.7 });
	const seat = box(0.5, 0.07, 0.48, chairMat, 0.02);
	seat.position.set(0, 0.5, 0.86);
	g.add(seat);
	const back = box(0.48, 0.62, 0.07, chairMat, 0.03);
	back.position.set(0, 0.88, 1.08);
	back.rotation.x = -0.12;
	g.add(back);

	// torso, shoulders, neck
	const torso = mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.5, 7), shirt);
	torso.position.set(0, 0.82, 0.82);
	torso.rotation.x = -0.15;
	torso.scale.z = 0.62;
	g.add(torso);
	const shoulders = mesh(new THREE.CapsuleGeometry(0.06, 0.3, 3, 7), shirt);
	shoulders.rotation.z = Math.PI / 2;
	shoulders.position.set(0, 1.04, 0.78);
	g.add(shoulders);
	const neck = mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 6), skin);
	neck.position.set(0, 1.11, 0.75);
	g.add(neck);

	// head, with a business cut: short, tapered back and sides, a little more
	// length on top swept over from a side part. Only the top and back of the
	// head are ever seen, so the face is left plain.
	const head = new THREE.Group();
	head.position.set(0, 1.22, 0.72);
	const skull = mesh(new THREE.IcosahedronGeometry(0.1, 1), skin);
	skull.scale.set(0.9, 1.08, 1);
	head.add(skull);
	for (const x of [-0.088, 0.088]) {
		const ear = mesh(new THREE.SphereGeometry(0.018, 5, 4), skin);
		ear.scale.set(0.5, 1, 0.8);
		ear.position.set(x, 0.0, 0.01);
		head.add(ear);
	}
	const sides = mesh(new THREE.IcosahedronGeometry(0.103, 1), hair);
	sides.scale.set(0.93, 0.95, 1.03);
	sides.position.set(0, 0.02, 0.012);
	head.add(sides);
	const top = mesh(new THREE.IcosahedronGeometry(0.085, 1), hair);
	top.scale.set(1.05, 0.62, 1.12);
	top.position.set(0.006, 0.075, -0.005);
	top.rotation.z = -0.12; // swept towards one side
	head.add(top);
	const part = mesh(new THREE.BoxGeometry(0.003, 0.004, 0.12), skin);
	part.position.set(-0.035, 0.1, -0.005);
	part.rotation.z = 0.35;
	head.add(part);
	const fringe = mesh(new THREE.IcosahedronGeometry(0.06, 1), hair);
	fringe.scale.set(1.25, 0.45, 0.6);
	fringe.position.set(0.012, 0.075, -0.06);
	head.add(fringe);
	g.add(head);

	// arms reaching to the keyboard and mouse
	const arm = (from: THREE.Vector3, to: THREE.Vector3, r: number, mat: THREE.Material) => {
		const len = from.distanceTo(to);
		const a = mesh(new THREE.CapsuleGeometry(r, len, 3, 6), mat);
		a.position.copy(from).lerp(to, 0.5);
		a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
		g.add(a);
	};
	const shoulderL = new THREE.Vector3(-0.19, 1.02, 0.78);
	const shoulderR = new THREE.Vector3(0.19, 1.02, 0.78);
	const elbowL = new THREE.Vector3(-0.24, 0.84, 0.58);
	const elbowR = new THREE.Vector3(0.27, 0.84, 0.56);
	const handL = new THREE.Vector3(-0.1, 0.785, 0.3);
	const handR = new THREE.Vector3(0.29, 0.79, 0.3);
	arm(shoulderL, elbowL, 0.045, shirt);
	arm(shoulderR, elbowR, 0.045, shirt);
	arm(elbowL, handL, 0.035, skin);
	arm(elbowR, handR, 0.035, skin);

	return g;
}

import * as THREE from 'three';
import { box, cable, lathe, mesh, onDesk, std, topBox, type Interactive } from './parts';

// Pens (turned from side profiles, like the real things) and the junk that
// lives on the right of the desk: multimeter, Swiss army knife, fidget spinner.

/**
 * Lay a pen built along +y (back end at y = 0) flat along +x, centred, resting
 * on the surface. Its clip, built on -x in profile space, ends up on top.
 */
function layFlat(pen: THREE.Group, length: number, radius: number) {
	const g = new THREE.Group();
	pen.rotation.z = -Math.PI / 2;
	pen.position.set(-length / 2, radius, 0);
	g.add(pen);
	return g;
}

export function lamySafari() {
	const mango = std('#f2a516', { roughness: 0.45 });
	const chrome = std('#d6d9dc', { metalness: 0.95, roughness: 0.18 });
	const p = new THREE.Group();
	// barrel: slightly waisted, flat end
	p.add(
		lathe(
			[
				[0, 0],
				[0.0052, 0],
				[0.0058, 0.003],
				[0.006, 0.03],
				[0.0062, 0.074],
				[0.0057, 0.08],
				[0, 0.08],
			],
			mango,
			16,
		),
	);
	// the cap, longer and a touch wider, with a domed top
	p.add(
		lathe(
			[
				[0, 0.077],
				[0.0068, 0.077],
				[0.007, 0.082],
				[0.0068, 0.13],
				[0.0062, 0.137],
				[0.004, 0.14],
				[0, 0.1405],
			],
			mango,
			16,
		),
	);
	// ink windows on both sides of the barrel
	for (const s of [1, -1]) {
		const win = mesh(new THREE.CircleGeometry(1, 10), std('#3a2a12', { roughness: 0.2 }), false, false);
		win.scale.set(0.0018, 0.006, 1);
		win.position.set(0, 0.07, s * 0.0062);
		if (s < 0) win.rotation.y = Math.PI;
		p.add(win);
	}
	// the famous bent-wire clip
	const clip = cable(
		[
			new THREE.Vector3(-0.0066, 0.136, 0),
			new THREE.Vector3(-0.0095, 0.13, 0),
			new THREE.Vector3(-0.0098, 0.11, 0),
			new THREE.Vector3(-0.0092, 0.094, 0),
			new THREE.Vector3(-0.0075, 0.089, 0),
		],
		0.0011,
		chrome,
		16,
	);
	p.add(clip);
	return layFlat(p, 0.1405, 0.0066);
}

export function mujiGel() {
	const frosted = std('#e9eded', { roughness: 0.35, transparent: true, opacity: 0.62 });
	const p = new THREE.Group();
	p.add(
		lathe(
			[
				[0, 0],
				[0.0042, 0],
				[0.0046, 0.004],
				[0.0046, 0.088],
				[0, 0.088],
			],
			frosted,
			12,
		),
	);
	p.add(
		lathe(
			[
				[0, 0.084],
				[0.005, 0.084],
				[0.005, 0.13],
				[0.0035, 0.135],
				[0, 0.135],
			],
			frosted,
			12,
		),
	);
	// the refill, visible through the frosted barrel
	const refill = mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.115, 8), std('#16171a', { roughness: 0.4 }));
	refill.position.y = 0.065;
	p.add(refill);
	// beige label band
	p.add(
		lathe(
			[
				[0, 0.05],
				[0.0047, 0.05],
				[0.0047, 0.068],
				[0, 0.068],
			],
			std('#e3dccb', { roughness: 0.8 }),
			12,
		),
	);
	const clip = box(0.0012, 0.035, 0.003, frosted);
	clip.position.set(-0.0058, 0.112, 0);
	p.add(clip);
	return layFlat(p, 0.135, 0.005);
}

export function kuruToga() {
	const black = std('#17181b', { roughness: 0.45 });
	const p = new THREE.Group();
	p.add(
		lathe(
			[
				[0, 0],
				[0.0034, 0],
				[0.0045, 0.004],
				[0.0045, 0.09],
				[0, 0.09],
			],
			black,
			14,
		),
	);
	// window onto the rotating mechanism
	p.add(
		lathe(
			[
				[0, 0.09],
				[0.0046, 0.09],
				[0.0046, 0.101],
				[0, 0.101],
			],
			std('#f07a22', { roughness: 0.3, transparent: true, opacity: 0.85 }),
			14,
		),
	);
	// grip, cone, sleeve
	p.add(
		lathe(
			[
				[0, 0.101],
				[0.0048, 0.101],
				[0.0049, 0.124],
				[0.0042, 0.128],
				[0, 0.128],
			],
			std('#2b2c30', { roughness: 0.9 }),
			14,
		),
	);
	const steel = std('#c9ccd0', { metalness: 0.9, roughness: 0.25 });
	p.add(
		lathe(
			[
				[0, 0.128],
				[0.0041, 0.128],
				[0.0012, 0.14],
				[0.0005, 0.14],
				[0.0005, 0.146],
				[0, 0.146],
			],
			steel,
			14,
		),
	);
	const clip = box(0.0014, 0.04, 0.0032, black);
	clip.position.set(-0.0055, 0.03, 0);
	p.add(clip);
	return layFlat(p, 0.146, 0.0049);
}

function multimeterFace() {
	const c = document.createElement('canvas');
	c.width = 256;
	c.height = 512;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = '#2b2d31';
	ctx.fillRect(0, 0, 256, 512);
	// LCD
	ctx.fillStyle = '#9fb59a';
	ctx.fillRect(28, 30, 200, 110);
	ctx.fillStyle = '#1d2a1c';
	ctx.font = '700 64px ui-monospace, monospace';
	ctx.fillText('4.98', 52, 108);
	ctx.font = '600 20px ui-monospace, monospace';
	ctx.fillText('V DC', 160, 132);
	// dial labels
	ctx.fillStyle = '#e8e8e8';
	ctx.font = '600 18px system-ui, sans-serif';
	ctx.textAlign = 'center';
	const labels = ['OFF', 'V~', 'V⎓', 'mV', 'Ω', '•))', 'A', 'mA'];
	labels.forEach((l, i) => {
		const a = -Math.PI * 0.9 + (i / (labels.length - 1)) * Math.PI * 0.8 - Math.PI * 0.05;
		ctx.fillText(l, 128 + Math.cos(a) * 92, 290 + Math.sin(a) * 92 + 6);
	});
	// jacks
	const jack = (x: number, col: string, label: string) => {
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.arc(x, 455, 15, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#0d0d0d';
		ctx.beginPath();
		ctx.arc(x, 455, 6, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#cfcfcf';
		ctx.font = '600 14px system-ui, sans-serif';
		ctx.fillText(label, x, 492);
	};
	jack(58, '#d33', '10A');
	jack(128, '#222', 'COM');
	jack(198, '#d33', 'VΩ');
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	return t;
}

// The junk lives on the low drawers to the right of the desk, around the
// white keyboard (top surface at DRAWER_Y).
const DRAWER_Y = 0.55;

export function buildRightSide(root: THREE.Group, add: (i: Interactive) => void) {
	// ---------------------------------------------------------------- multimeter
	const mm = onDesk(0.68, 0.55, -0.15, DRAWER_Y);
	const holster = std('#f2c230', { roughness: 0.75 });
	const body = topBox(0.078, 0.034, 0.152, holster, std('#ffffff', { map: multimeterFace(), roughness: 0.6 }));
	body.position.y = 0.017;
	mm.add(body);
	const dial = mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.008, 16), std('#1b1b1d', { roughness: 0.5 }));
	dial.position.set(0, 0.038, 0.012);
	mm.add(dial);
	const pointer = box(0.003, 0.002, 0.016, std('#f2f2f2'));
	pointer.position.set(-0.004, 0.0425, 0.004);
	pointer.rotation.y = 0.5;
	mm.add(pointer);
	add({
		id: 'multimeter',
		reach: 'above',
		label: 'Multimeter',
		hint: 'Reading five volts. Probably fine',
		about: 'The first thing I grab when a circuit does something it shouldn\'t. Continuity mode gets the most use.',
		object: mm,
		lift: 0.01,
		present: [1.15, 0, 0],
	});
	// probe leads curling off it
	mm.updateMatrixWorld(true);
	const Y = DRAWER_Y;
	// leads plugged into the COM and VΩ jacks at the bottom of the face
	for (const [jx, col, end, bend] of [
		[0.021, '#cc2b2b', new THREE.Vector3(0.7, Y + 0.006, 0.8), new THREE.Vector3(0.74, Y + 0.003, 0.7)],
		[0.0, '#1a1a1a', new THREE.Vector3(0.66, Y + 0.006, 0.78), new THREE.Vector3(0.64, Y + 0.003, 0.7)],
	] as const) {
		const a = new THREE.Vector3(jx, 0.036, 0.059).applyMatrix4(mm.matrixWorld);
		const plug = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.012, 10), std(col, { roughness: 0.5 }));
		plug.position.copy(a).add(new THREE.Vector3(0, 0.005, 0));
		root.add(plug);
		root.add(
			cable(
				[a.clone().add(new THREE.Vector3(0, 0.011, 0)), a.clone().add(new THREE.Vector3(0, 0.025, 0.02)), bend, end],
				0.0018,
				std(col, { roughness: 0.6 }),
				24,
			),
		);
		const probe = new THREE.Group();
		probe.position.copy(end);
		const grip = mesh(new THREE.CylinderGeometry(0.0045, 0.004, 0.08, 10), std(col, { roughness: 0.5 }));
		grip.rotation.z = Math.PI / 2;
		grip.position.x = -0.04;
		probe.add(grip);
		const tip = mesh(new THREE.CylinderGeometry(0.0008, 0.0012, 0.03, 6), std('#c9ccd0', { metalness: 0.9, roughness: 0.25 }));
		tip.rotation.z = Math.PI / 2;
		tip.position.x = -0.095;
		probe.add(tip);
		probe.rotation.y = col === '#cc2b2b' ? -0.4 : -0.1;
		root.add(probe);
	}

	// ---------------------------------------------------------------- Swiss army knife
	const knife = onDesk(0.97, 0.47, 1.3, DRAWER_Y);
	const red = std('#c4161c', { roughness: 0.3 });
	const steel = std('#c9ccd0', { metalness: 0.9, roughness: 0.22 });
	const scales = box(0.091, 0.016, 0.026, red, 0.007);
	scales.position.y = 0.008;
	knife.add(scales);
	const liners = box(0.086, 0.01, 0.0265, steel, 0.004);
	liners.position.y = 0.008;
	knife.add(liners);
	const emblem = mesh(new THREE.CircleGeometry(0.004, 12), std('#e8e8e8', { metalness: 0.6, roughness: 0.3 }), false, false);
	emblem.rotation.x = -Math.PI / 2;
	emblem.position.set(0.015, 0.0161, 0);
	knife.add(emblem);
	const ringK = mesh(new THREE.TorusGeometry(0.006, 0.0008, 6, 14), steel);
	ringK.position.set(-0.05, 0.008, 0);
	ringK.rotation.x = Math.PI / 2;
	knife.add(ringK);
	// the main blade pivots out of the end when you pick it up
	const pivot = new THREE.Group();
	pivot.position.set(0.04, 0.008, 0.0);
	const blade = new THREE.Shape();
	blade.moveTo(0, -0.004);
	blade.lineTo(-0.055, -0.004);
	blade.quadraticCurveTo(-0.068, -0.0, -0.07, 0.006);
	blade.lineTo(0, 0.006);
	blade.lineTo(0, -0.004);
	const bladeMesh = mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.0012, bevelEnabled: false }), steel);
	bladeMesh.rotation.x = -Math.PI / 2;
	bladeMesh.position.y = 0.0006;
	pivot.add(bladeMesh);
	knife.add(pivot);
	let open = 0;
	add({
		id: 'knife',
		reach: 'above',
		label: 'Swiss army knife',
		hint: 'For cable ties and stubborn packaging',
		about: 'Mostly used to open things that were very clearly not designed to be opened.',
		object: knife,
		lift: 0.012,
		present: [1.2, 0, 0.15],
		whileHeld(dt) {
			open = Math.min(1, open + dt * 1.6);
			pivot.rotation.y = Math.PI * 0.85 * (1 - Math.pow(1 - open, 3));
		},
	});
	knife.userData.reset = () => {
		open = 0;
		pivot.rotation.y = 0;
	};

	// ---------------------------------------------------------------- fidget spinner
	// Classic tri-spinner: a hub and three lobes blended with smooth fillets
	// (traced from a smooth-union distance field, so it's symmetric and clean),
	// a steel bearing in every lobe and a capped bearing in the middle.
	const spinner = onDesk(0.96, 0.77, 0.4, DRAWER_Y);
	const spin = new THREE.Group();
	const HUB = 0.0165; // hub radius
	const ARM = 0.031; // hub centre to lobe centre
	const LOBE = 0.0148; // lobe radius
	const K = 0.009; // fillet size
	const lobeAt = (i: number) => {
		const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
		return new THREE.Vector2(Math.cos(a) * ARM, Math.sin(a) * ARM);
	};
	const sdf = (p: THREE.Vector2) => {
		let d = p.length() - HUB;
		for (let i = 0; i < 3; i++) {
			const l = p.distanceTo(lobeAt(i)) - LOBE;
			const h = Math.max(K - Math.abs(d - l), 0) / K;
			d = Math.min(d, l) - h * h * K * 0.25; // smooth minimum
		}
		return d;
	};
	const outline: THREE.Vector2[] = [];
	for (let i = 0; i < 240; i++) {
		const a = (i / 240) * Math.PI * 2;
		const dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
		// march out along the ray until we leave the shape, then refine
		let lo = 0;
		let hi = 0.06;
		for (let k = 0; k < 28; k++) {
			const mid = (lo + hi) / 2;
			if (sdf(dir.clone().multiplyScalar(mid)) < 0) lo = mid;
			else hi = mid;
		}
		outline.push(dir.multiplyScalar(lo));
	}
	const shape = new THREE.Shape(outline);
	const BEARING = 0.0112;
	for (let i = 0; i < 4; i++) {
		const c = i < 3 ? lobeAt(i) : new THREE.Vector2();
		const hole = new THREE.Path();
		hole.absarc(c.x, c.y, BEARING, 0, Math.PI * 2, true);
		shape.holes.push(hole);
	}
	const T = 0.0068; // body thickness
	const bodyGeo = new THREE.ExtrudeGeometry(shape, {
		depth: T,
		bevelEnabled: true,
		bevelSize: 0.0009,
		bevelThickness: 0.0009,
		bevelSegments: 3,
		curveSegments: 48,
	});
	bodyGeo.translate(0, 0, -T / 2);
	const spinBody = mesh(bodyGeo, std('#2f63d6', { metalness: 0.55, roughness: 0.32 }));
	spinBody.rotation.x = -Math.PI / 2;
	spin.add(spinBody);

	const bearingSteel = std('#d4d7db', { metalness: 0.92, roughness: 0.18 });
	const race = std('#9aa0a6', { metalness: 0.85, roughness: 0.35 });
	const bearing = (c: THREE.Vector2, capped: boolean) => {
		const g = new THREE.Group();
		g.position.set(c.x, 0, -c.y);
		// outer race: a ring that fills the hole
		g.add(
			lathe(
				[
					[BEARING * 0.72, -T / 2],
					[BEARING, -T / 2],
					[BEARING, T / 2],
					[BEARING * 0.72, T / 2],
					[BEARING * 0.72, -T / 2],
				],
				bearingSteel,
				32,
			),
		);
		// the balls' gap and inner race
		const gap = mesh(new THREE.CylinderGeometry(BEARING * 0.72, BEARING * 0.72, T * 0.8, 32), std('#2a2c30', { roughness: 0.6 }));
		g.add(gap);
		const inner = mesh(new THREE.CylinderGeometry(BEARING * 0.48, BEARING * 0.48, T * 0.95, 32), race);
		g.add(inner);
		if (capped) {
			// finger caps on both faces of the centre bearing
			for (const s of [1, -1]) {
				const cap = lathe(
					[
						[0, 0],
						[BEARING * 0.95, 0],
						[BEARING * 0.95, 0.0016],
						[BEARING * 0.7, 0.0028],
						[0, 0.0024],
					],
					std('#1d1f23', { metalness: 0.4, roughness: 0.4 }),
					32,
				);
				cap.position.y = (s * T) / 2;
				if (s < 0) cap.rotation.x = Math.PI;
				g.add(cap);
			}
		} else {
			const hub = mesh(new THREE.CylinderGeometry(BEARING * 0.22, BEARING * 0.22, T * 1.02, 16), bearingSteel);
			g.add(hub);
		}
		return g;
	};
	for (let i = 0; i < 3; i++) spin.add(bearing(lobeAt(i), false));
	spin.add(bearing(new THREE.Vector2(), true));
	// resting on its centre cap, body just clear of the surface
	spin.position.y = T / 2 + 0.003;
	spinner.add(spin);
	let speed = 0;
	add({
		id: 'spinner',
		reach: 'above',
		label: 'Fidget spinner',
		hint: 'Pick it up. You know you want to',
		about: 'Thinking aid. Ask it anything; it will spin.',
		object: spinner,
		lift: 0.012,
		present: [Math.PI / 2, 0, 0],
		holdScale: 1.15,
		whileHeld(dt) {
			speed = Math.min(26, speed + dt * 22);
			spin.rotation.y += speed * dt;
		},
	});
	spinner.userData.reset = () => {
		speed = 0;
		spin.rotation.y = 0;
	};

	// a couple of extra bits of right-hand clutter
	const usb = box(0.04, 0.008, 0.016, std('#1e1f22', { roughness: 0.5 }), 0.003);
	usb.position.set(0.97, DRAWER_Y + 0.004, 0.62);
	usb.rotation.y = 1.4;
	root.add(usb);
	const capT = box(0.012, 0.007, 0.0145, std('#c9ccd0', { metalness: 0.9, roughness: 0.25 }));
	capT.position.set(0.975, DRAWER_Y + 0.004, 0.65);
	capT.rotation.y = 1.4;
	root.add(capT);
}

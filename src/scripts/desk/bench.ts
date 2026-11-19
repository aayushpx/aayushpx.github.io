import * as THREE from 'three';
import { box, cable, DESK_Y, headerPins, mesh, onDesk, std, topBox, type Interactive, type Ticker } from './parts';
import * as tex from './textures';

// The electronics corner on the left of the desk. Layout follows the
// dedicated top-down photo of the soldering mat (IMG_9928), rotated into desk
// space, cross-checked against the full-desk overhead (IMG_9911).

const MAT = new THREE.Vector2(-0.53, 0.25); // centre of the blue silicone mat
const MAT_Y = DESK_Y + 0.004; // its top surface
const rel = (dx: number, dz: number) => [MAT.x + dx, MAT.y + dz] as const;

export function buildBench(root: THREE.Group, add: (i: Interactive) => void, tickers: Ticker[]) {
	const gold = std('#d8b04a', { metalness: 0.8, roughness: 0.35 });
	const silver = std('#c4c8cc', { metalness: 0.85, roughness: 0.3 });
	const pcbBlack = std('#18191b', { roughness: 0.6 });
	const pcbBlue = std('#2c63c9', { roughness: 0.6 });
	const pcbRed = std('#c92f3b', { roughness: 0.6 });
	const plasticBlack = std('#141416', { roughness: 0.55 });
	const dupont = std('#111111', { roughness: 0.5 });

	// ---------------------------------------------------------------- mat
	const mat = box(0.3, 0.004, 0.22, std('#2f8fcf', { roughness: 0.85 }), 0.002);
	mat.position.set(MAT.x, DESK_Y + 0.002, MAT.y);
	mat.castShadow = false;
	root.add(mat);
	// the moulded parts trays along one edge
	for (let k = 0; k < 3; k++) {
		const tray = box(0.07, 0.002, 0.03, std('#2a82bd'), 0.001);
		tray.position.set(MAT.x - 0.1 + k * 0.08, MAT_Y + 0.001, MAT.y - 0.085);
		tray.castShadow = false;
		root.add(tray);
	}

	// ---------------------------------------------------------------- breadboard
	const [bbx, bbz] = rel(0.085, -0.037);
	const bb = onDesk(bbx, bbz, 0.04, MAT_Y);
	const bbSide = std('#e6e3db');
	const bbBody = topBox(0.165, 0.009, 0.055, bbSide, std('#ffffff', { map: tex.breadboard() }));
	bbBody.position.y = 0.0045;
	bb.add(bbBody);
	// jumpers hopping between holes
	const jumperCols = ['#e24a3b', '#f2c230', '#3aa35b', '#3a78d6', '#f08a2c', '#9a5bd6', '#ffffff', '#111111'];
	for (let k = 0; k < 12; k++) {
		const x0 = -0.07 + ((k * 37) % 120) / 1000;
		const x1 = x0 + 0.01 + ((k * 13) % 40) / 1000;
		const z0 = k % 2 ? -0.012 : 0.012;
		const z1 = k % 3 ? 0.016 : -0.018;
		const lift = 0.006 + (k % 4) * 0.004;
		bb.add(
			cable(
				[
					new THREE.Vector3(x0, 0.009, z0),
					new THREE.Vector3(x0 + (x1 - x0) * 0.3, 0.009 + lift, z0 + (z1 - z0) * 0.3),
					new THREE.Vector3(x0 + (x1 - x0) * 0.7, 0.009 + lift, z0 + (z1 - z0) * 0.7),
					new THREE.Vector3(x1, 0.009, z1),
				],
				0.0007,
				std(jumperCols[k % jumperCols.length], { roughness: 0.6 }),
				10,
			),
		);
	}
	// Parts on the board, laid out from the top-down mat photo (IMG_9929).
	// Local x runs along the board: buttons at -x, MPU6050 at +x. -z is the far side.
	const bbTop = 0.009;

	// three 12 mm tactile buttons in a row
	for (const x of [-0.071, -0.0605, -0.049]) {
		const base = box(0.0115, 0.0034, 0.0115, plasticBlack, 0.0008);
		base.position.set(x, bbTop + 0.0017, -0.008);
		bb.add(base);
		const plate = box(0.0118, 0.0006, 0.0118, silver);
		plate.position.set(x, bbTop + 0.0037, -0.008);
		bb.add(plate);
		const cap = mesh(new THREE.CylinderGeometry(0.0034, 0.0036, 0.003, 14), std('#202024', { roughness: 0.6 }));
		cap.position.set(x, bbTop + 0.0055, -0.008);
		bb.add(cap);
	}

	// two resistors lying across the gap, then green, yellow, red LEDs
	for (const x of [-0.034, -0.029]) {
		const r = mesh(new THREE.CapsuleGeometry(0.0011, 0.0045, 2, 8), std('#d9c9a3', { roughness: 0.6 }));
		r.rotation.x = Math.PI / 2;
		r.position.set(x, bbTop + 0.0022, -0.012);
		bb.add(r);
		for (const z of [-0.018, -0.006]) {
			const leg = mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.004, 4), silver);
			leg.position.set(x, bbTop + 0.001, z);
			bb.add(leg);
		}
	}
	const leds = (['#34c759', '#ffcc00', '#ff3b30'] as const).map((col, k) => {
		const mat = new THREE.MeshBasicMaterial({ color: col });
		const led = new THREE.Group();
		const body = mesh(new THREE.CylinderGeometry(0.0025, 0.0027, 0.0055, 12), mat, false, false);
		body.position.y = 0.00275;
		led.add(body);
		const dome = mesh(new THREE.SphereGeometry(0.0025, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat, false, false);
		dome.position.y = 0.0055;
		led.add(dome);
		led.position.set(-0.0227 + k * 0.0062, bbTop + 0.003, -0.018);
		bb.add(led);
		return { mat, on: new THREE.Color(col), off: new THREE.Color(col).multiplyScalar(0.18) };
	});
	// a slow chase across the three LEDs, like a sketch that's still running
	tickers.push((t) => {
		const step = Math.floor(t * 1.5) % 4;
		leds.forEach((l, k) => l.mat.color.copy(step === k || step === 3 ? l.on : l.off));
	});

	// rotary encoder: metal body standing in the board, knurled shaft sideways
	const enc = new THREE.Group();
	enc.position.set(0.0129, bbTop, -0.0014);
	const encBody = box(0.0125, 0.012, 0.0068, silver, 0.0006);
	encBody.position.y = 0.006 + 0.0015;
	enc.add(encBody);
	const encBase = box(0.0128, 0.003, 0.0072, pcbBlack);
	encBase.position.y = 0.0015;
	enc.add(encBase);
	const bushing = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.006, 16), silver);
	bushing.rotation.x = Math.PI / 2;
	bushing.position.set(0, 0.0075, -0.0064);
	enc.add(bushing);
	const shaft = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.013, 12), std('#bfc3c7', { metalness: 0.85, roughness: 0.45, flatShading: true }));
	shaft.rotation.x = Math.PI / 2;
	shaft.position.set(0, 0.0075, -0.0158);
	enc.add(shaft);
	bb.add(enc);

	// MPU6050 (GY-521) on its header at the far end, overhanging a little
	const mpu = new THREE.Group();
	mpu.position.set(0.072, bbTop, -0.008);
	mpu.rotation.y = 0.12;
	const mpuPcb = box(0.0205, 0.0016, 0.0158, std('#3a3fb0', { roughness: 0.55 }));
	mpuPcb.position.y = 0.0105;
	mpu.add(mpuPcb);
	const mpuChip = box(0.004, 0.0009, 0.004, pcbBlack);
	mpuChip.position.set(0.002, 0.0118, 0.001);
	mpu.add(mpuChip);
	const mpuHeader = box(0.0025, 0.0085, 0.0203, plasticBlack);
	mpuHeader.position.set(-0.0088, 0.005, 0);
	mpu.add(mpuHeader);
	for (let k = 0; k < 8; k++) {
		const hole = mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.0004, 8), gold);
		hole.position.set(-0.0088, 0.0114, -0.0089 + k * 0.00254);
		mpu.add(hole);
	}
	bb.add(mpu);

	// ---------------------------------------------------------------- LilyGO T-Display
	const [tdx, tdz] = rel(0.109, 0.058);
	const td = onDesk(tdx, tdz, 0.45, MAT_Y); // screen turned towards your chair
	const tdCase = box(0.072, 0.034, 0.016, plasticBlack, 0.004);
	tdCase.position.y = 0.017;
	tdCase.rotation.x = -0.18; // propped up, leaning back
	td.add(tdCase);
	const tdLive = tex.tdisplayLive();
	tickers.push((t) => tdLive.draw(t));
	const screen = mesh(
		new THREE.PlaneGeometry(0.05, 0.0266),
		new THREE.MeshBasicMaterial({ map: tdLive.texture, toneMapped: false }),
		false,
		false,
	);
	screen.position.set(-0.006, 0, 0.0081);
	tdCase.add(screen);
	for (const y of [0.007, -0.007]) {
		const b = mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.003, 8), std('#f07a22', { roughness: 0.5 }));
		b.rotation.x = Math.PI / 2;
		b.position.set(0.028, y, 0.0085);
		tdCase.add(b);
	}

	// Jumpers from a header on the back of the T-Display, each ending in a
	// dupont plug seated in a breadboard hole. Board, display and wires are one
	// rig, so they lift and get picked up together and nothing comes unplugged.
	const rig = new THREE.Group();
	rig.add(bb, td);
	rig.updateMatrixWorld(true);
	const housing = box(0.0205, 0.0028, 0.009, dupont);
	housing.position.set(-0.004, 0.006, -0.0125);
	tdCase.add(housing);
	tdCase.updateMatrixWorld(true);
	const holeX = (col: number) => -0.0825 + ((20 + 9.5 * col) / 512) * 0.165 + 0.0005;
	jumperCols.forEach((col, k) => {
		const x = -0.0129 + k * 0.00254;
		const start = tdCase.localToWorld(new THREE.Vector3(x, 0.006, -0.017));
		const out = tdCase.localToWorld(new THREE.Vector3(x, 0.008, -0.034));
		const hole = bb.localToWorld(new THREE.Vector3(holeX(4 + k), 0.009, 0.0125));
		const top = hole.clone().add(new THREE.Vector3(0, 0.0155, 0));
		const above = hole.clone().add(new THREE.Vector3(0, 0.03 + (k % 2) * 0.004, 0));
		const mid = start.clone().lerp(top, 0.5).add(new THREE.Vector3(0, 0.035 + (k % 3) * 0.005, 0));
		rig.add(cable([start, out, mid, above, top], 0.0008, std(col, { roughness: 0.6 }), 20));
		const plug = box(0.0025, 0.014, 0.0025, dupont);
		plug.position.copy(hole).add(new THREE.Vector3(0, 0.0075, 0));
		rig.add(plug);
	});
	add({
		id: 'launcher',
		label: 'Launcher prototype',
		hint: 'T-Display S3 wired to a breadboard',
		about: 'Launcher: a pocket mission-control unit on a LilyGO T-Display S3. A launch-sequence state machine, live IMU telemetry over MQTT and a mission event log, in C on ESP-IDF. The breadboard carries the MPU6050 IMU, a rotary encoder, three buttons and three status LEDs.',
		object: rig,
		lift: 0.008,
		present: [0.75, 0, 0],
		holdScale: 1.45,
	});

	// ---------------------------------------------------------------- helping hands + power module
	const [hhx, hhz] = rel(-0.139, -0.041);
	const hands = onDesk(hhx, hhz, 0.5, MAT_Y);
	const castIron = std('#1f1f22', { roughness: 0.5 });
	const foot1 = box(0.1, 0.012, 0.022, castIron, 0.003);
	foot1.position.y = 0.006;
	hands.add(foot1);
	const foot2 = box(0.022, 0.012, 0.07, castIron, 0.003);
	foot2.position.set(-0.03, 0.006, 0);
	hands.add(foot2);
	const post = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 6), silver);
	post.position.set(-0.03, 0.075, 0);
	hands.add(post);
	// magnifier on top, tipped towards the work
	const lensRing = mesh(new THREE.TorusGeometry(0.042, 0.004, 6, 18), std('#cfd2d6', { metalness: 0.8, roughness: 0.3 }));
	lensRing.position.set(0.0, 0.15, 0.015);
	lensRing.rotation.set(-1.0, 0.4, 0);
	hands.add(lensRing);
	const lensGlass = mesh(
		new THREE.CircleGeometry(0.04, 18),
		new THREE.MeshStandardMaterial({ color: '#d9e8ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 }),
		false,
		false,
	);
	lensGlass.position.copy(lensRing.position);
	lensGlass.rotation.copy(lensRing.rotation);
	hands.add(lensGlass);
	const lensArm = cable([new THREE.Vector3(-0.03, 0.135, 0), new THREE.Vector3(-0.012, 0.15, 0.008), lensRing.position.clone()], 0.002, silver, 8);
	hands.add(lensArm);

	// two jointed arms with alligator clips holding the module
	const module = new THREE.Group();
	module.position.set(0.055, 0.055, 0.04);
	module.rotation.set(0.25, -0.3, -0.35);
	const mPcb = box(0.053, 0.0016, 0.034, pcbBlack);
	module.add(mPcb);
	module.add(headerPins([{ x0: -0.02, z: -0.013, count: 8 }, { x0: -0.02, z: 0.013, count: 8 }], 0.004, gold));
	for (const z of [-0.013, 0.013]) {
		const hdr = box(0.021, 0.0025, 0.0025, std('#f2c230', { roughness: 0.5 }));
		hdr.position.set(-0.011, 0.002, z);
		module.add(hdr);
	}
	const usbA = box(0.014, 0.006, 0.012, silver);
	usbA.position.set(0.019, 0.004, -0.006);
	module.add(usbA);
	const jack = box(0.011, 0.009, 0.009, plasticBlack);
	jack.position.set(0.019, 0.0055, 0.01);
	module.add(jack);
	hands.add(module);
	const clipA = new THREE.Vector3(0.03, 0.06, 0.03);
	const clipB = new THREE.Vector3(0.075, 0.05, 0.055);
	for (const [joint, clip] of [
		[new THREE.Vector3(-0.005, 0.1, -0.01), clipA],
		[new THREE.Vector3(0.05, 0.11, 0.0), clipB],
	] as const) {
		hands.add(cable([new THREE.Vector3(-0.03, 0.09, 0), joint, clip], 0.0018, silver, 10));
		const jaw = box(0.014, 0.004, 0.005, silver);
		jaw.position.copy(clip);
		jaw.lookAt(clip.clone().add(new THREE.Vector3(0.02, -0.01, 0.01)));
		hands.add(jaw);
	}
	add({ id: 'helping-hands', label: 'Helping hands', hint: 'Holding a breadboard power module', about: 'A third and fourth hand for soldering, with a magnifier for the small joints. Currently holding a breadboard power module.', object: hands, lift: 0.008, present: [0.3, 0.4, 0] });

	// ---------------------------------------------------------------- small sensor modules
	const sensor = (x: number, z: number, ry: number, pcb: THREE.Material, extras: (g: THREE.Group) => void) => {
		const g = onDesk(x, z, ry, MAT_Y);
		const p = box(0.03, 0.0016, 0.015, pcb);
		p.position.y = 0.0008;
		g.add(p);
		g.add(headerPins([{ x0: 0.016, z: -0.0025, count: 3 }], 0.002, gold).rotateY(Math.PI / 2));
		extras(g);
		root.add(g);
		return g;
	};
	const dht = sensor(...rel(-0.122, 0.068), 0.3, pcbBlack, (g) => {
		const body = topBox(0.016, 0.006, 0.012, std('#4aa3d8'), std('#ffffff', { map: tex.dhtGrille() }));
		body.position.set(-0.004, 0.0046, 0);
		g.add(body);
	});
	add({ id: 'dht11', label: 'DHT11', hint: 'Temperature and humidity sensor', about: 'The classic beginner sensor: temperature and humidity over a single data pin.', object: dht, lift: 0.01 });
	sensor(...rel(-0.07, 0.078), -0.4, pcbRed, (g) => {
		const pot = box(0.007, 0.006, 0.007, std('#2d6ad6'));
		pot.position.set(-0.004, 0.004, 0);
		g.add(pot);
		const chip = box(0.006, 0.0015, 0.005, pcbBlack);
		chip.position.set(0.006, 0.0022, 0);
		g.add(chip);
	});
	sensor(...rel(-0.044, 0.088), 0.9, pcbBlack, (g) => {
		const ir = mesh(new THREE.SphereGeometry(0.003, 8, 6), plasticBlack);
		ir.position.set(-0.008, 0.004, 0);
		g.add(ir);
	});
	sensor(...rel(-0.037, 0.054), -0.15, pcbBlack, (g) => {
		const sw = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 10), silver);
		sw.position.set(-0.004, 0.003, 0);
		g.add(sw);
	});

	// ---------------------------------------------------------------- PCA9685 servo driver
	const pca = onDesk(...rel(-0.078, -0.122), 0.35, DESK_Y);
	const pcaPcb = box(0.062, 0.0016, 0.025, pcbBlue);
	pcaPcb.position.y = 0.0008;
	pca.add(pcaPcb);
	(['#111111', '#d63a3a', '#f2c230'] as const).forEach((col, r) => {
		const row = box(0.041, 0.0025, 0.0025, std(col, { roughness: 0.5 }));
		row.position.set(0.004, 0.0029, -0.005 + r * 0.0028);
		pca.add(row);
	});
	pca.add(headerPins([0, 1, 2].map((r) => ({ x0: -0.0156, z: -0.005 + r * 0.0028, count: 16 })), 0.0046, gold, 0.003));
	const terminal = box(0.01, 0.007, 0.008, std('#2e9c4a'));
	terminal.position.set(-0.024, 0.004, 0.006);
	pca.add(terminal);
	root.add(pca);
	add({ id: 'pca9685', label: 'PCA9685 servo driver', hint: '16 channels of PWM', about: 'Sixteen PWM channels over I²C, for driving a lot of servos from one microcontroller.', object: pca, lift: 0.01 });

	// ---------------------------------------------------------------- ESP32 dev boards
	const esp32 = (x: number, z: number, ry: number, y = DESK_Y) => {
		const g = onDesk(x, z, ry, y);
		const pcb = box(0.052, 0.0016, 0.028, pcbBlack);
		pcb.position.y = 0.0045;
		g.add(pcb);
		// pins underneath hold it up off the desk, rows visible along each edge
		g.add(headerPins([{ x0: -0.024, z: -0.0125, count: 19 }, { x0: -0.024, z: 0.0125, count: 19 }], 0.0022, gold, 0.0045));
		for (const z of [-0.0125, 0.0125]) {
			const strip = box(0.049, 0.0025, 0.0025, plasticBlack);
			strip.position.set(-0.0005, 0.0025, z);
			g.add(strip);
		}
		const can = topBox(0.017, 0.0032, 0.016, silver, std('#ffffff', { map: tex.esp32Can(), metalness: 0.7, roughness: 0.35 }));
		can.position.set(0.012, 0.0069, 0);
		g.add(can);
		const antenna = box(0.006, 0.0005, 0.016, std('#262729'));
		antenna.position.set(0.0235, 0.0056, 0);
		g.add(antenna);
		const usbC = box(0.006, 0.0032, 0.009, silver, 0.001);
		usbC.position.set(-0.025, 0.0069, 0);
		g.add(usbC);
		for (const zz of [-0.005, 0.005]) {
			const b = box(0.003, 0.0015, 0.003, std('#e6e6e6'));
			b.position.set(-0.018, 0.006, zz);
			g.add(b);
		}
		return g;
	};
	const espA = esp32(-0.405, -0.03, 0.15, DESK_Y + 0.0045);
	add({ id: 'esp32-a', label: 'ESP32 dev board', hint: 'There are always more of these', about: 'Wi-Fi and Bluetooth microcontroller, and the brain of most things I build. ESP-IDF, in C.', object: espA, lift: 0.012 });
	const espB = esp32(-0.45, -0.14, -0.45);
	add({ id: 'esp32-b', label: 'ESP32 dev board', hint: 'The spare. Allegedly', about: 'Another ESP32, waiting for the next idea.', object: espB, lift: 0.012 });
	// ---------------------------------------------------------------- Raspberry Pi 5
	// Red case tray with the board sitting inside, ports out the far end.
	const pi = onDesk(...rel(0.024, -0.167), -0.6, DESK_Y);
	const piRed = std('#d4334a', { roughness: 0.45 });
	const tray = box(0.096, 0.016, 0.068, piRed, 0.006);
	tray.position.y = 0.008;
	pi.add(tray);
	for (const [w, d, x, z] of [
		[0.096, 0.004, 0, 0.032],
		[0.096, 0.004, 0, -0.032],
		[0.004, 0.068, -0.046, 0],
	] as const) {
		const wall = box(w, 0.006, d, piRed, 0.0015);
		wall.position.set(x, 0.019, z);
		pi.add(wall);
	}
	const board = box(0.085, 0.0016, 0.056, std('#1f7a3e', { roughness: 0.55 }));
	board.position.y = 0.0168;
	pi.add(board);
	const top = 0.0176;
	const chip = (w: number, d: number, h: number, x: number, z: number, m: THREE.Material) => {
		const c = box(w, h, d, m);
		c.position.set(x, top + h / 2, z);
		pi.add(c);
	};
	chip(0.0155, 0.0155, 0.0018, -0.012, -0.002, silver); // SoC lid
	chip(0.011, 0.0085, 0.0012, -0.012, 0.016, pcbBlack); // RAM
	chip(0.009, 0.009, 0.001, 0.012, 0.004, pcbBlack); // RP1
	// two stacked USB pairs + Ethernet out the end
	for (const [z, inner] of [
		[0.019, '#2a5fd6'],
		[0.0, '#1a1a1a'],
	] as const) {
		chip(0.0175, 0.014, 0.0155, 0.038, z, silver);
		const tongue = box(0.0005, 0.011, 0.01, std(inner));
		tongue.position.set(0.0469, top + 0.0078, z);
		pi.add(tongue);
	}
	chip(0.021, 0.016, 0.0135, 0.036, -0.02, silver);
	const rj = box(0.0005, 0.009, 0.011, std('#0c0c0c'));
	rj.position.set(0.0467, top + 0.0068, -0.02);
	pi.add(rj);
	// GPIO header along the long edge
	chip(0.051, 0.005, 0.0025, -0.006, -0.0245, pcbBlack);
	pi.add(headerPins([{ x0: -0.0302, z: -0.026, count: 20 }, { x0: -0.0302, z: -0.0234, count: 20 }], top + 0.0045, gold, 0.004));
	// USB-C and micro HDMI on the other long edge
	chip(0.009, 0.0045, 0.0032, -0.03, 0.026, silver);
	chip(0.0065, 0.004, 0.0028, -0.016, 0.026, silver);
	chip(0.0065, 0.004, 0.0028, -0.004, 0.026, silver);
	add({ id: 'pi', label: 'Raspberry Pi 5', hint: 'A small computer in a red case', about: 'A Raspberry Pi 5 in its red case. Handy whenever a project needs a proper Linux box rather than a microcontroller.', object: pi, lift: 0, present: [0.9, 0.3, 0] });
	// power: a USB-C plug in the Pi's port, cable running off the back of the desk
	pi.updateMatrixWorld(true);
	const port = pi.localToWorld(new THREE.Vector3(-0.03, top + 0.0016, 0.028));
	const away = pi.localToWorld(new THREE.Vector3(-0.03, top + 0.0016, 0.04));
	const plugBody = box(0.011, 0.0055, 0.016, std('#ececea', { roughness: 0.6 }), 0.002);
	plugBody.position.copy(port.clone().lerp(away, 0.5));
	plugBody.quaternion.copy(pi.quaternion);
	root.add(plugBody);
	const tail = pi.localToWorld(new THREE.Vector3(-0.03, top + 0.0016, 0.06));
	root.add(
		cable(
			[
				away,
				tail,
				new THREE.Vector3(tail.x - 0.02, DESK_Y + 0.003, tail.z + 0.02),
				new THREE.Vector3(-0.5, DESK_Y + 0.003, -0.15),
				new THREE.Vector3(-0.47, DESK_Y + 0.003, -0.4),
				new THREE.Vector3(-0.45, DESK_Y - 0.08, -0.47),
			],
			0.002,
			std('#ececea', { roughness: 0.7 }),
		),
	);

	// ---------------------------------------------------------------- solder + iron on its block
	const [spx, spz] = rel(-0.21, 0.071);
	const spool = onDesk(spx, spz, 0.6);
	const reel = mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.024, 14), [
		std('#2f6fc4', { flatShading: true }),
		std('#ffffff', { map: tex.solderLabel() }),
		std('#2f6fc4'),
	]);
	reel.position.y = 0.012;
	spool.add(reel);
	const wire = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 14), silver);
	wire.position.y = 0.012;
	spool.add(wire);
	add({ id: 'solder', label: 'Solder wire', hint: '0.8 mm', about: 'A reel of 0.8 mm solder wire.', object: spool, lift: 0.01, present: [1.1, 0, 0] });

	const [wbx, wbz] = rel(-0.208, -0.146);
	const block = box(0.075, 0.035, 0.11, std('#ffffff', { map: tex.wood() }), 0.004);
	block.position.set(wbx, DESK_Y + 0.0175, wbz);
	block.rotation.y = 0.15;
	root.add(block);

	const iron = new THREE.Group();
	iron.position.set(wbx, DESK_Y + 0.035, wbz + 0.02);
	// the spiral holder and the iron share one tilted axis
	const axis = new THREE.Vector3(0.45, 1, -0.2).normalize();
	iron.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
	const helix: THREE.Vector3[] = [];
	for (let i = 0; i <= 64; i++) {
		const t = i / 64;
		const a = t * Math.PI * 2 * 3.5;
		helix.push(new THREE.Vector3(Math.cos(a) * 0.013, t * 0.075, Math.sin(a) * 0.013));
	}
	iron.add(cable(helix, 0.0011, silver, 96));
	const segment = (len: number, r: number, mat: THREE.Material, y: number) => {
		const s = mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
		s.position.y = y + len / 2;
		iron.add(s);
	};
	segment(0.05, 0.0022, silver, 0.008); // tip
	segment(0.03, 0.0055, silver, 0.058); // collar
	segment(0.095, 0.0095, std('#1b1b1d', { roughness: 0.6 }), 0.088); // grip
	segment(0.025, 0.005, std('#1b1b1d', { roughness: 0.6 }), 0.183); // strain relief
	add({ id: 'iron', label: 'Soldering iron', hint: 'Mind the hot end', about: 'A T12 iron running off the Quicko station built into the monitor stand. It lives in the spiral holder on the wooden block between jobs.', object: iron, lift: 0, action: 'none' });

	// iron cable: out of the handle, down to the desk, round to the station
	const handleEnd = new THREE.Vector3(0, 0.208, 0).applyQuaternion(iron.quaternion).add(iron.position);
	root.add(
		cable(
			[
				handleEnd,
				handleEnd.clone().add(axis.clone().multiplyScalar(0.04)),
				new THREE.Vector3(handleEnd.x + 0.06, DESK_Y + 0.03, handleEnd.z - 0.02),
				new THREE.Vector3(-0.69, DESK_Y + 0.003, -0.12),
				new THREE.Vector3(-0.64, DESK_Y + 0.003, -0.2),
				new THREE.Vector3(-0.585, DESK_Y + 0.025, -0.215),
			],
			0.0022,
			std('#1a1a1a', { roughness: 0.6 }),
			40,
		),
	);

	// ---------------------------------------------------------------- phone + loose wires
	const phone = onDesk(-0.88, 0.2, 0.12);
	const slab = box(0.075, 0.008, 0.155, std('#1c1d20', { roughness: 0.35, metalness: 0.3 }), 0.006);
	slab.position.y = 0.004;
	phone.add(slab);
	const bump = box(0.03, 0.002, 0.03, std('#2a2b2e', { roughness: 0.3 }), 0.004);
	bump.position.set(-0.016, 0.009, -0.05);
	phone.add(bump);
	add({ id: 'phone', label: 'Phone', hint: 'Face down. Focus mode', about: 'Face down, on purpose.', object: phone, lift: 0.01 });
	root.add(
		cable(
			[
				new THREE.Vector3(-0.873, DESK_Y + 0.004, 0.278),
				new THREE.Vector3(-0.9, DESK_Y + 0.003, 0.31),
				new THREE.Vector3(-0.96, DESK_Y + 0.003, 0.3),
				new THREE.Vector3(-0.99, DESK_Y - 0.06, 0.29),
				new THREE.Vector3(-1.0, 0.3, 0.32),
			],
			0.0018,
			std('#f2f2f0', { roughness: 0.6 }),
		),
	);

	// stray jumpers with their black dupont ends
	const strays: [number, number, number, number, string][] = [
		[-0.36, 0.12, -0.3, 0.18, '#e24a3b'],
		[-0.33, 0.1, -0.28, 0.06, '#3a78d6'],
		[-0.4, -0.08, -0.35, -0.12, '#f2c230'],
		[-0.62, 0.36, -0.55, 0.35, '#3aa35b'],
		[-0.3, -0.06, -0.33, 0.0, '#9a5bd6'],
	];
	for (const [x0, z0, x1, z1, col] of strays) {
		const a = new THREE.Vector3(x0, DESK_Y + 0.0015, z0);
		const b = new THREE.Vector3(x1, DESK_Y + 0.0015, z1);
		const m = a.clone().lerp(b, 0.5).add(new THREE.Vector3((z1 - z0) * 0.3, 0.003, (x0 - x1) * 0.3));
		root.add(cable([a, m, b], 0.0008, std(col, { roughness: 0.6 }), 12));
		for (const end of [a, b]) {
			const d = box(0.0035, 0.0028, 0.012, dupont);
			d.position.copy(end).setY(DESK_Y + 0.0015);
			d.lookAt(m.clone().setY(d.position.y));
			root.add(d);
		}
	}
}

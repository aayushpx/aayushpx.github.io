import * as THREE from 'three';

// Small procedural textures drawn on canvases, so the scene needs almost no
// image downloads. Everything here is stylised on purpose (low-poly vibe).

function canvas(w: number, h: number) {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d')!;
	return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean } = {}) {
	const t = new THREE.CanvasTexture(c);
	if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
	if (opts.repeat) {
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(...opts.repeat);
	}
	t.anisotropy = 4;
	return t;
}

// A seeded random so the wallpaper looks the same on every load.
function rng(seed: number) {
	return () => {
		seed = (seed * 16807) % 2147483647;
		return (seed - 1) / 2147483646;
	};
}

/** Rocket launch at golden hour, in the spirit of the real wallpaper. */
export function launchWallpaper(variant = 0) {
	const W = 1024;
	const H = 576;
	const { c, ctx } = canvas(W, H);
	const r = rng(7 + variant * 13);

	const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
	sky.addColorStop(0, '#2f5f96');
	sky.addColorStop(0.55, '#7fa6c9');
	sky.addColorStop(1, '#f2d3a6');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, W, H);

	// sea + ground
	ctx.fillStyle = '#5d7d93';
	ctx.fillRect(0, H * 0.6, W, H * 0.04);
	const ground = ctx.createLinearGradient(0, H * 0.64, 0, H);
	ground.addColorStop(0, '#5a4a3c');
	ground.addColorStop(1, '#241c17');
	ctx.fillStyle = ground;
	ctx.fillRect(0, H * 0.64, W, H * 0.36);

	// high clouds
	for (let i = 0; i < 26; i++) {
		const x = r() * W;
		const y = r() * H * 0.35;
		ctx.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.25})`;
		ctx.beginPath();
		ctx.ellipse(x, y, 40 + r() * 70, 10 + r() * 18, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	const rx = W * (0.5 + (variant - 1) * 0.03);
	const base = H * 0.66;

	// Exhaust plume as flat, layered billows (three tones, no gradients) so it
	// reads as stylised art rather than blurry blobs. Back layer first.
	const tones = [
		['#8f7468', '#b99a86', '#d9c3ae'], // shadowed, far
		['#c9875a', '#eab07a', '#f8dcb6'], // warm, lit by the flame
		['#d8d2ca', '#f1ece4', '#ffffff'], // white tops
	];
	const billows: [number, number, number, number][] = [];
	for (let i = 0; i < 90; i++) {
		const side = r() < 0.5 ? -1 : 1;
		const d = Math.pow(r(), 0.7); // distance from the pad, 0..1
		const x = rx + side * d * W * 0.5;
		const lift = (1 - d) * 120 + r() * 50;
		const y = base - 8 - lift * (0.4 + r() * 0.6);
		const rad = 14 + r() * 34 * (1 - d * 0.5);
		const layer = y < base - 90 ? 2 : d < 0.35 ? 1 : r() < 0.5 ? 0 : 2;
		billows.push([x, y, rad, layer]);
	}
	billows.sort((a, b) => a[3] - b[3] || b[1] - a[1]);
	for (const [x, y, rad, layer] of billows) {
		const [dark, mid, light] = tones[layer];
		ctx.fillStyle = dark;
		ctx.beginPath();
		ctx.arc(x, y, rad, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = mid;
		ctx.beginPath();
		ctx.arc(x - rad * 0.12, y - rad * 0.14, rad * 0.86, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = light;
		ctx.beginPath();
		ctx.arc(x - rad * 0.3, y - rad * 0.34, rad * 0.5, 0, Math.PI * 2);
		ctx.fill();
	}
	// flame
	const flame = ctx.createRadialGradient(rx, base - 10, 2, rx, base - 10, 60);
	flame.addColorStop(0, 'rgba(255,250,220,1)');
	flame.addColorStop(0.4, 'rgba(255,170,60,0.9)');
	flame.addColorStop(1, 'rgba(255,120,40,0)');
	ctx.fillStyle = flame;
	ctx.fillRect(rx - 60, base - 70, 120, 120);

	// the rocket
	ctx.fillStyle = '#e9e6e1';
	ctx.fillRect(rx - 6, base - 250, 12, 230);
	ctx.fillStyle = '#c9c4bc';
	ctx.fillRect(rx + 2, base - 250, 4, 230);
	ctx.beginPath();
	ctx.moveTo(rx - 6, base - 250);
	ctx.quadraticCurveTo(rx, base - 285, rx + 6, base - 250);
	ctx.fillStyle = '#e9e6e1';
	ctx.fill();
	ctx.fillStyle = '#2b2b2b';
	ctx.fillRect(rx - 6, base - 140, 12, 3);

	// launch tower
	ctx.strokeStyle = '#3a3330';
	ctx.lineWidth = 3;
	ctx.strokeRect(rx + 26, base - 260, 10, 255);
	for (let y = base - 255; y < base; y += 14) {
		ctx.beginPath();
		ctx.moveTo(rx + 26, y);
		ctx.lineTo(rx + 36, y + 14);
		ctx.stroke();
	}

	// a thin desktop bar along the top, like a real screen (clock drawn live)
	ctx.fillStyle = 'rgba(10,12,16,0.55)';
	ctx.fillRect(0, 0, W, 16);

	return toTexture(c);
}

/**
 * A monitor's screen: the wallpaper plus a live clock in the top bar. The main
 * monitor also shows a small window inviting you to click into the site.
 */
export function liveScreen(variant: number, main: boolean) {
	const base = launchWallpaper(variant).image as HTMLCanvasElement;
	const { c, ctx } = canvas(base.width, base.height);
	const texture = toTexture(c);
	let last = '';
	function draw(clock: string, blink: boolean) {
		const key = clock + blink;
		if (key === last) return false;
		last = key;
		ctx.drawImage(base, 0, 0);
		ctx.fillStyle = 'rgba(255,255,255,0.8)';
		ctx.font = '600 10px ui-monospace, monospace';
		ctx.textAlign = 'center';
		ctx.fillText(clock, c.width / 2, 12);
		ctx.textAlign = 'left';
		if (main) {
			const x = 300;
			const y = 150;
			const w = 424;
			const h = 220;
			ctx.fillStyle = 'rgba(14,16,20,0.86)';
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, 10);
			ctx.fill();
			ctx.strokeStyle = 'rgba(255,255,255,0.12)';
			ctx.stroke();
			ctx.fillStyle = '#f4b63a';
			ctx.font = '600 15px ui-monospace, monospace';
			ctx.fillText('~/aayush', x + 22, y + 36);
			ctx.fillStyle = '#f2efe8';
			ctx.font = '700 38px system-ui, sans-serif';
			ctx.fillText('Aayush Prakash', x + 22, y + 92);
			ctx.fillStyle = 'rgba(242,239,232,0.72)';
			ctx.font = '400 17px system-ui, sans-serif';
			ctx.fillText('embedded · simulation · ML', x + 22, y + 126);
			ctx.fillText('building toward aerospace', x + 22, y + 150);
			ctx.fillStyle = '#f4b63a';
			ctx.font = '600 14px ui-monospace, monospace';
			ctx.fillText('> click to open' + (blink ? ' _' : ''), x + 22, y + 196);
		}
		texture.needsUpdate = true;
		return true;
	}
	return { texture, draw };
}

/** Black carbon-fibre desk top. */
export function carbon() {
	const { c, ctx } = canvas(64, 64);
	ctx.fillStyle = '#1a1b1e';
	ctx.fillRect(0, 0, 64, 64);
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 4; j++) {
			const light = (i + j) % 2 === 0;
			ctx.fillStyle = light ? '#24262a' : '#16171a';
			ctx.fillRect(i * 16, j * 16, 16, 16);
			ctx.strokeStyle = 'rgba(255,255,255,0.04)';
			ctx.beginPath();
			if (light) {
				ctx.moveTo(i * 16, j * 16 + 8);
				ctx.lineTo(i * 16 + 16, j * 16 + 8);
			} else {
				ctx.moveTo(i * 16 + 8, j * 16);
				ctx.lineTo(i * 16 + 8, j * 16 + 16);
			}
			ctx.stroke();
		}
	}
	return toTexture(c, { repeat: [60, 27] });
}

export function wood() {
	const { c, ctx } = canvas(256, 64);
	ctx.fillStyle = '#9a6f3f';
	ctx.fillRect(0, 0, 256, 64);
	const r = rng(3);
	for (let i = 0; i < 40; i++) {
		const y = r() * 64;
		ctx.strokeStyle = `rgba(${r() < 0.5 ? '70,45,20' : '190,150,100'},${0.15 + r() * 0.2})`;
		ctx.lineWidth = 0.5 + r() * 1.5;
		ctx.beginPath();
		ctx.moveTo(0, y);
		for (let x = 0; x <= 256; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 2);
		ctx.stroke();
	}
	return toTexture(c);
}

export function breadboard() {
	const { c, ctx } = canvas(512, 170);
	ctx.fillStyle = '#efede6';
	ctx.fillRect(0, 0, 512, 170);
	const rail = (y: number, col: string) => {
		ctx.strokeStyle = col;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(14, y);
		ctx.lineTo(498, y);
		ctx.stroke();
	};
	rail(8, '#d64545');
	rail(30, '#3a6fd6');
	rail(140, '#d64545');
	rail(162, '#3a6fd6');
	ctx.fillStyle = '#4a4a4a';
	for (let x = 20; x < 496; x += 9.5) {
		for (const y of [14, 22, 148, 156]) ctx.fillRect(x, y, 3, 3);
		for (let k = 0; k < 5; k++) {
			ctx.fillRect(x, 42 + k * 9, 3, 3);
			ctx.fillRect(x, 96 + k * 9, 3, 3);
		}
	}
	ctx.fillStyle = '#d8d5cc';
	ctx.fillRect(14, 84, 484, 6);
	return toTexture(c);
}

/** Top cover of "The Cosmic Landscape": teal cloth with a grey band. */
export function bookCover() {
	const { c, ctx } = canvas(256, 384);
	ctx.fillStyle = '#6fa3a6';
	ctx.fillRect(0, 0, 256, 384);
	ctx.fillStyle = '#5c5f63';
	ctx.fillRect(0, 0, 40, 384);
	ctx.fillStyle = 'rgba(255,255,255,0.06)';
	for (let i = 0; i < 300; i++) ctx.fillRect(Math.random() * 256, Math.random() * 384, 2, 1);
	return toTexture(c);
}

export function bookSpine() {
	const { c, ctx } = canvas(512, 96);
	ctx.fillStyle = '#56595d';
	ctx.fillRect(0, 0, 512, 96);
	ctx.fillStyle = '#ece7da';
	ctx.font = '600 30px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('THE COSMIC LANDSCAPE', 256, 50);
	return toTexture(c);
}

export function mintsLid() {
	const { c, ctx } = canvas(256, 160);
	const g = ctx.createLinearGradient(0, 0, 256, 160);
	g.addColorStop(0, '#2c2f8f');
	g.addColorStop(1, '#141660');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 256, 160);
	ctx.fillStyle = '#0b0c2a';
	ctx.beginPath();
	ctx.ellipse(118, 84, 70, 46, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.font = '800 38px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('mints', 118, 86);
	ctx.fillStyle = '#d33a3a';
	ctx.fillRect(170, 112, 70, 18);
	return toTexture(c);
}

/**
 * LilyGO T-Display running a Launcher-style mission screen: a ten-second
 * countdown, liftoff, then it resets. `draw` takes seconds since load.
 */
export function tdisplayLive() {
	const { c, ctx } = canvas(320, 170);
	const texture = toTexture(c);
	let last = '';
	function draw(t: number) {
		const p = t % 18;
		const counting = p < 10;
		const tick = counting ? Math.ceil(10 - p) : Math.floor((p - 10) * 4);
		const key = counting + ':' + tick;
		if (key === last) return false;
		last = key;
		ctx.fillStyle = '#05080a';
		ctx.fillRect(0, 0, 320, 170);
		ctx.strokeStyle = '#1f5a3c';
		ctx.strokeRect(4, 4, 312, 162);
		ctx.fillStyle = '#39ff8f';
		ctx.font = '700 22px ui-monospace, monospace';
		ctx.fillText('LAUNCHER', 14, 32);
		ctx.font = '500 15px ui-monospace, monospace';
		ctx.fillStyle = '#c9ffe0';
		const asc = Math.max(0, p - 10);
		ctx.fillText('STATE  ' + (counting ? 'ARMED' : 'ASCENT'), 14, 62);
		ctx.fillText('IMU    ' + (counting ? '1.00g' : (1.4 + asc * 0.35).toFixed(2) + 'g'), 14, 84);
		ctx.fillText('ALT    ' + Math.round(asc * asc * 90) + ' m', 14, 106);
		ctx.font = '700 30px ui-monospace, monospace';
		if (counting) {
			ctx.fillStyle = '#ffb347';
			ctx.fillText('T-00:' + String(Math.ceil(10 - p)).padStart(2, '0'), 14, 150);
		} else {
			ctx.fillStyle = '#39ff8f';
			ctx.fillText('LIFTOFF', 14, 150);
		}
		texture.needsUpdate = true;
		return true;
	}
	draw(0);
	return { texture, draw };
}

/** Silver RF shield on an ESP32 module. */
export function esp32Can() {
	const { c, ctx } = canvas(128, 112);
	ctx.fillStyle = '#c7cacc';
	ctx.fillRect(0, 0, 128, 112);
	ctx.fillStyle = 'rgba(0,0,0,0.55)';
	ctx.font = '700 22px system-ui, sans-serif';
	ctx.fillText('ESP32', 16, 46);
	ctx.font = '500 13px system-ui, sans-serif';
	ctx.fillText('WROOM-32', 16, 70);
	ctx.strokeStyle = 'rgba(0,0,0,0.25)';
	ctx.strokeRect(6, 6, 116, 100);
	return toTexture(c);
}

/** DHT11 sensor: the blue grille. */
export function dhtGrille() {
	const { c, ctx } = canvas(64, 80);
	ctx.fillStyle = '#4aa3d8';
	ctx.fillRect(0, 0, 64, 80);
	ctx.fillStyle = '#2a6f9c';
	for (let y = 8; y < 76; y += 12) for (let x = 7; x < 60; x += 12) ctx.fillRect(x, y, 6, 7);
	return toTexture(c);
}

/** Solder reel label: blue and orange. */
export function solderLabel() {
	const { c, ctx } = canvas(128, 128);
	ctx.fillStyle = '#2f6fc4';
	ctx.fillRect(0, 0, 128, 128);
	ctx.fillStyle = '#f08a2c';
	ctx.beginPath();
	ctx.arc(64, 64, 58, Math.PI * 0.1, Math.PI * 0.9);
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.beginPath();
	ctx.arc(64, 64, 22, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#2f6fc4';
	ctx.beginPath();
	ctx.arc(64, 64, 12, 0, Math.PI * 2);
	ctx.fill();
	return toTexture(c);
}

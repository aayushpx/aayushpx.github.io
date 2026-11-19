import * as THREE from 'three';
import { box, onDesk, std, type Interactive } from './parts';
import * as tex from './textures';

// The book on the desk. Pick it up and it opens; your reading notes are
// printed on its pages, one thought per page, and you turn pages with a real
// page-turn. The first page is the title page.

export interface ReadingEntry {
	page?: number;
	date?: string;
	note: string;
}
export interface Reading {
	title: string;
	author: string;
	status: string;
	progress?: number;
	updated: string;
	entries: ReadingEntry[];
}
export interface PagerInfo {
	label: string;
	canPrev: boolean;
	canNext: boolean;
}

const PW = 0.152; // page width (spine to edge)
const PH = 0.232; // page height
const CW = 640; // canvas size for a page
const CH = Math.round((CW * PH) / PW);
const SPINE_X = -0.078;

const fmt = (iso?: string) =>
	iso ? new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxY: number) {
	for (const para of text.split(/\n+/)) {
		let line = '';
		for (const word of para.split(/\s+/)) {
			const test = line ? `${line} ${word}` : word;
			if (ctx.measureText(test).width > maxW && line) {
				if (y > maxY) return y;
				ctx.fillText(line, x, y);
				y += lineH;
				line = word;
			} else line = test;
		}
		if (line && y <= maxY) {
			ctx.fillText(line, x, y);
			y += lineH;
		}
		y += lineH * 0.45;
	}
	return y;
}

function drawPage(reading: Reading, index: number, total: number) {
	const c = document.createElement('canvas');
	c.width = CW;
	c.height = CH;
	const ctx = c.getContext('2d')!;
	// paper, slightly darker towards the spine (odd pages are on the right)
	const right = index % 2 === 1;
	const g = ctx.createLinearGradient(right ? 0 : CW, 0, right ? CW : 0, 0);
	g.addColorStop(0, '#e6dfcf');
	g.addColorStop(0.08, '#f4efe3');
	g.addColorStop(1, '#f6f1e6');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, CW, CH);
	const M = 50;
	const ink = '#2a2620';
	ctx.textBaseline = 'alphabetic';

	if (index === 0) {
		ctx.fillStyle = '#b4700a';
		ctx.font = '700 28px ui-monospace, monospace';
		ctx.fillText(`Currently ${reading.status}`.toUpperCase(), M, 120);
		ctx.fillStyle = ink;
		ctx.font = '700 76px Georgia, serif';
		let y = wrap(ctx, reading.title, M, 210, CW - M * 2, 84, CH);
		ctx.font = 'italic 40px Georgia, serif';
		y = wrap(ctx, reading.author, M, y + 10, CW - M * 2, 50, CH);
		if (reading.progress !== undefined) {
			y += 24;
			ctx.fillStyle = 'rgba(42,38,32,0.12)';
			ctx.fillRect(M, y, CW - M * 2, 10);
			ctx.fillStyle = '#f2a516';
			ctx.fillRect(M, y, ((CW - M * 2) * reading.progress) / 100, 10);
			ctx.fillStyle = 'rgba(42,38,32,0.6)';
			ctx.font = '22px Georgia, serif';
			ctx.fillText(`${reading.progress}% through`, M, y + 44);
			y += 60;
		}
		ctx.fillStyle = 'rgba(42,38,32,0.7)';
		ctx.font = '30px Georgia, serif';
		ctx.fillText(`Updated ${fmt(reading.updated)}`, M, y + 40);
		ctx.font = 'italic 34px Georgia, serif';
		ctx.fillText(reading.entries.length ? 'My notes as I go →' : 'Notes to come.', M, CH - 80);
	} else {
		const e = reading.entries[index - 1];
		if (e) {
			ctx.fillStyle = '#b4700a';
			ctx.font = '700 54px Georgia, serif';
			ctx.fillText(e.page !== undefined ? `p. ${e.page}` : 'Note', M, 124);
			ctx.fillStyle = 'rgba(42,38,32,0.65)';
			ctx.font = '28px Georgia, serif';
			ctx.textAlign = 'right';
			ctx.fillText(fmt(e.date), CW - M, 120);
			ctx.textAlign = 'left';
			ctx.fillStyle = 'rgba(42,38,32,0.18)';
			ctx.fillRect(M, 152, CW - M * 2, 3);
			ctx.fillStyle = ink;
			ctx.font = '40px Georgia, serif';
			wrap(ctx, e.note, M, 224, CW - M * 2, 58, CH - 110);
		} else {
			ctx.fillStyle = 'rgba(42,38,32,0.35)';
			ctx.font = 'italic 34px Georgia, serif';
			ctx.textAlign = 'center';
			ctx.fillText('more to come', CW / 2, CH / 2);
			ctx.textAlign = 'left';
		}
	}
	// folio
	ctx.fillStyle = 'rgba(42,38,32,0.5)';
	ctx.font = '26px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.fillText(`${index + 1} / ${total}`, CW / 2, CH - 36);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
}

/** A page plane, lit evenly when the book is in your hand. */
function pageMaterial() {
	return new THREE.MeshStandardMaterial({ color: '#e8e4da', emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.95 });
}
function setMap(m: THREE.MeshStandardMaterial, t: THREE.Texture | null) {
	// only a change between "no texture" and "texture" needs a new shader
	const recompile = !m.map !== !t;
	m.map = t;
	m.emissiveMap = t;
	if (recompile) m.needsUpdate = true;
}

export function buildBook(reading: Reading | null, add: (i: Interactive) => void) {
	const r: Reading = reading ?? { title: 'The Cosmic Landscape', author: 'Leonard Susskind', status: 'reading', updated: '', entries: [] };
	const total = Math.max(2, Math.ceil((r.entries.length + 1) / 2) * 2);
	const cache = new Map<number, THREE.Texture>();
	const page = (i: number) => {
		if (!cache.has(i)) cache.set(i, drawPage(r, i, total));
		return cache.get(i)!;
	};

	const book = onDesk(0.46, -0.13, 1.08);
	const paperEdge = std('#efe9dc');
	const grey = std('#56595d');
	const block = box(0.156, 0.038, 0.236, [paperEdge, std('#ffffff', { map: tex.bookSpine() }), paperEdge, grey, paperEdge, paperEdge]);
	block.position.y = 0.019;
	book.add(block);

	// right-hand page: printed on top of the page block
	const rightMat = pageMaterial();
	const rightPage = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), rightMat);
	rightPage.rotation.x = -Math.PI / 2;
	rightPage.position.set(SPINE_X + PW / 2 + 0.001, 0.0383, 0);
	book.add(rightPage);

	// front cover, hinged at the spine; its inside is the left-hand page
	const hinge = new THREE.Group();
	hinge.position.set(-0.08, 0.0385, 0);
	const cover = box(0.16, 0.003, 0.24, [grey, grey, std('#ffffff', { map: tex.bookCover() }), paperEdge, grey, grey]);
	cover.position.x = 0.08;
	hinge.add(cover);
	const leftMat = pageMaterial();
	const leftPage = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), leftMat);
	leftPage.rotation.set(Math.PI / 2, 0, Math.PI); // reads upright once the cover is open
	leftPage.position.set(0.08, -0.0017, 0);
	hinge.add(leftPage);
	book.add(hinge);

	// the leaf that turns: front is the old right page, back the new left page
	const leaf = new THREE.Group();
	// pivot sits just above both pages, and the turn stops a little short of
	// flat, so the turning page never dips under the page it lands on
	const LEAF_Y = 0.0412;
	const LEAF_MAX = Math.PI * 0.975;
	leaf.position.set(SPINE_X + 0.001, LEAF_Y, 0);
	const leafFrontMat = pageMaterial();
	const leafBackMat = pageMaterial();
	const leafFront = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), leafFrontMat);
	leafFront.rotation.x = -Math.PI / 2;
	leafFront.position.x = PW / 2;
	const leafBack = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), leafBackMat);
	leafBack.rotation.set(Math.PI / 2, 0, Math.PI);
	leafBack.position.set(PW / 2, -0.0004, 0);
	leaf.add(leafFront, leafBack);
	leaf.visible = false;
	book.add(leaf);

	let spread = 0;
	const lastSpread = total / 2 - 1;
	let turn: { dir: 1 | -1; t: number } | null = null;
	let onChange: (() => void) | null = null;

	function show() {
		setMap(leftMat, page(spread * 2));
		setMap(rightMat, page(spread * 2 + 1));
	}
	show();

	const pager = {
		info(): PagerInfo {
			return {
				label: spread === 0 ? `Title page · ${total} pages` : `Pages ${spread * 2 + 1}–${spread * 2 + 2} of ${total}`,
				canPrev: spread > 0,
				canNext: spread < lastSpread,
			};
		},
		turn(dir: 1 | -1) {
			if (turn || (dir === 1 && spread >= lastSpread) || (dir === -1 && spread <= 0)) return;
			if (dir === 1) {
				setMap(leafFrontMat, page(spread * 2 + 1));
				setMap(leafBackMat, page(spread * 2 + 2));
				setMap(rightMat, page(spread * 2 + 3));
				leaf.rotation.z = 0;
			} else {
				setMap(leafFrontMat, page(spread * 2 - 1));
				setMap(leafBackMat, page(spread * 2));
				setMap(leftMat, page(spread * 2 - 2));
				leaf.rotation.z = LEAF_MAX;
			}
			leaf.visible = true;
			turn = { dir, t: 0 };
		},
		/** Advance a page turn; returns true while animating. */
		update(dt: number, reduced: boolean) {
			if (!turn) return false;
			turn.t = Math.min(1, turn.t + dt / (reduced ? 0.01 : 0.7));
			const e = turn.t < 0.5 ? 2 * turn.t * turn.t : 1 - Math.pow(-2 * turn.t + 2, 2) / 2;
			const a = turn.dir === 1 ? e : 1 - e;
			leaf.rotation.z = LEAF_MAX * a;
			// a little lift in the middle of the turn, like real paper
			leaf.position.y = LEAF_Y + Math.sin(a * Math.PI) * 0.004;
			if (turn.t >= 1) {
				spread += turn.dir;
				turn = null;
				leaf.visible = false;
				show();
				onChange?.();
			}
			return true;
		},
		/** Every page texture, drawn now (so they can be uploaded up front). */
		prepare() {
			return Array.from({ length: total }, (_, i) => page(i));
		},
		reset() {
			turn = null;
			leaf.visible = false;
			spread = 0;
			show();
		},
		/** x in the book's own space: left of the spine turns back, right turns on. */
		sideOf(localX: number): 1 | -1 {
			return localX < SPINE_X ? -1 : 1;
		},
		set onChange(fn: (() => void) | null) {
			onChange = fn;
		},
	};

	book.userData.setOpen = (t: number) => {
		hinge.rotation.z = Math.PI * 0.985 * t;
	};
	book.userData.pager = pager;
	book.userData.reset = () => pager.reset();

	const allPages = [leftMat, rightMat, leafFrontMat, leafBackMat];
	add({
		id: 'book',
		label: r.title,
		hint: 'Click to open it',
		object: book,
		lift: 0.012,
		action: 'book',
		present: [Math.PI / 2, 0, 0],
		holdScale: 1.3,
		onHoldProgress(k) {
			// pages lit evenly in your hand, whatever the room is doing
			for (const m of allPages) {
				m.emissiveIntensity = 0.9 * k;
				m.color.setScalar(0.91 * (1 - 0.85 * k));
			}
		},
	});
	return book;
}

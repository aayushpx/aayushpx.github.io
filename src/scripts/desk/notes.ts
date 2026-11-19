import * as THREE from 'three';
import { DESK_Y, type Interactive } from './parts';

// Real, double-sided sheets of notes, scanned. Each sheet sits on the desk
// with a small texture per side; when you pick one up it swaps in the full
// scan and lights itself evenly, as if lit from your eyes, so it reads the
// same whether the light bar is on or not.

const A4 = { w: 0.21, h: 0.297 };
const BASE = '/desk/notes/sheets';

interface Sheet {
	id: string;
	label: string;
	front: string;
	back: string;
	x: number;
	z: number;
	/** rotation on the desk, radians (around the vertical) */
	r: number;
}

// Bottom of each pile first. Top sheets are the ones you see from the chair.
const SHEETS: Sheet[] = [
	// centre pile, under the pens
	{ id: 'c', label: 'Notes: XOR and backprop', front: 'A three-layer network solving XOR, worked through by hand.', back: 'Training by backpropagation: the errors, the deltas, the weight updates.', x: -0.06, z: -0.13, r: -0.25 },
	{ id: 'b', label: 'Notes: perceptrons', front: 'Single perceptrons for OR and XOR, and why XOR needs more than one.', back: 'Activation functions, then feed-forward networks.', x: -0.15, z: -0.15, r: 0.15 },
	{ id: 'a', label: 'Notes: Big-O', front: 'Time and space complexity: the growth curves, then bubble sort worked through to O(n²).', back: 'Fitting curves to data: least squares and the normal equation.', x: -0.25, z: -0.1, r: 0.3 },
	// right-hand side, where the blank paper used to be
	{ id: 'g', label: 'Notes: QR decomposition', front: 'QR decomposition using Householder transformations.', back: 'A full worked example, matrix by matrix.', x: 0.76, z: -0.13, r: 0.45 },
	{ id: 'f', label: 'Notes: reflections', front: 'Reflections across hyperplanes.', back: 'Householder transformations: building a reflection that zeroes a column.', x: 0.81, z: 0.12, r: 1.25 },
	{ id: 'e', label: 'Notes: LSTM', front: 'LSTM gates: forget, input and output, then many-to-one classification.', back: 'LSTMs against vanishing gradients, and the cell state as memory.', x: 0.56, z: 0.08, r: -0.35 },
	{ id: 'd', label: 'Notes: RNNs', front: 'The maths of a simple RNN, unrolled through time, with the recurrent path traced in pink.', back: 'Why each weight matrix has the shape it does.', x: 0.66, z: 0.2, r: -0.5 },
];

export function lowResSheetUrls() {
	return SHEETS.flatMap((s) => [`${BASE}/${s.id}-front-lo.webp`, `${BASE}/${s.id}-back-lo.webp`]);
}

export function buildNotes(
	root: THREE.Group,
	add: (i: Interactive) => void,
	lo: Map<string, THREE.Texture>,
	loadHi: (url: string) => Promise<THREE.Texture>,
) {
	const geo = new THREE.PlaneGeometry(A4.w, A4.h);
	SHEETS.forEach((s, order) => {
		const sheet = new THREE.Group();
		// stacked 1.2 mm apart, and each sheet drawn with its own depth offset so
		// overlapping paper never flickers as the camera moves
		sheet.position.set(s.x, DESK_Y + 0.0015 + order * 0.0012, s.z);
		sheet.rotation.set(-Math.PI / 2, 0, s.r);

		const side = (which: 'front' | 'back') => {
			const map = lo.get(`${BASE}/${s.id}-${which}-lo.webp`)!;
			const mat = new THREE.MeshStandardMaterial({
				map,
				emissiveMap: map,
				emissive: '#ffffff',
				emissiveIntensity: 0,
				color: '#e2e1dc',
				roughness: 0.92,
				polygonOffset: true,
				polygonOffsetFactor: -1 - order,
				polygonOffsetUnits: -4 - order * 4,
			});
			const m = new THREE.Mesh(geo, mat);
			m.receiveShadow = true;
			if (which === 'back') m.rotation.y = Math.PI; // faces the desk
			m.position.z = which === 'back' ? -0.0002 : 0;
			sheet.add(m);
			return { mat, lo: map, hi: null as THREE.Texture | null, url: `${BASE}/${s.id}-${which}-hi.webp` };
		};
		const sides = [side('front'), side('back')];

		let loading = false;
		add({
			id: `sheet-${s.id}`,
			label: s.label,
			hint: s.front,
			about: `${s.front} On the back: ${s.back.charAt(0).toLowerCase()}${s.back.slice(1)}`,
			object: sheet,
			lift: 0, // paper doesn't hop up on hover: it would pass through the sheets above
			present: [0, 0, 0],
			holdScale: 3,
			flippable: true,
			onPick() {
				if (loading) return;
				loading = true;
				for (const sd of sides) {
					loadHi(sd.url).then((t) => {
						if (!loading) return t.dispose();
						sd.hi = t;
						sd.mat.map = t;
						sd.mat.emissiveMap = t;
						sd.mat.needsUpdate = true;
					});
				}
			},
			onPutBack() {
				loading = false;
				for (const sd of sides) {
					sd.mat.map = sd.lo;
					sd.mat.emissiveMap = sd.lo;
					sd.mat.needsUpdate = true;
					sd.hi?.dispose();
					sd.hi = null;
				}
			},
			onHoldProgress(k) {
				// in your hand: lit evenly from the front, whatever the room is doing
				for (const sd of sides) {
					sd.mat.emissiveIntensity = 0.92 * k;
					sd.mat.color.setScalar(0.886 * (1 - k * 0.85));
				}
			},
		});
	});
}

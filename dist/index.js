//#region src/model.ts
function e(e, t) {
	return [
		e[0] * t[0] + e[1] * t[1] + e[2] * t[2],
		e[3] * t[0] + e[4] * t[1] + e[5] * t[2],
		e[6] * t[0] + e[7] * t[1] + e[8] * t[2]
	];
}
function t(e, t) {
	let n = [];
	for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) n.push(e[r * 3] * t[i] + e[r * 3 + 1] * t[3 + i] + e[r * 3 + 2] * t[6 + i]);
	return n;
}
function n(e) {
	let [t, n, r, i, a, o, s, c, l] = e, u = t * (a * l - o * c) - n * (i * l - o * s) + r * (i * c - a * s);
	return [
		(a * l - o * c) / u,
		(r * c - n * l) / u,
		(n * o - r * a) / u,
		(o * s - i * l) / u,
		(t * l - r * s) / u,
		(r * i - t * o) / u,
		(i * c - a * s) / u,
		(n * s - t * c) / u,
		(t * a - n * i) / u
	];
}
var r = [
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1
], i = [
	.8951,
	.2664,
	-.1614,
	-.7502,
	1.7135,
	.0367,
	.0389,
	-.0685,
	1.0296
], a = [
	.9642,
	1,
	.8249
], o = [.312700492, .329000939];
function s(r) {
	let [[s, c], [l, u], [d, f]] = r, p = [
		s / c,
		l / u,
		d / f,
		1,
		1,
		1,
		(1 - s - c) / c,
		(1 - l - u) / u,
		(1 - d - f) / f
	], m = [
		o[0] / o[1],
		1,
		(1 - o[0] - o[1]) / o[1]
	], h = e(n(p), m), g = p.map((e, t) => e * h[t % 3]), _ = e(i, m), v = e(i, a), y = i.map((e, t) => v[Math.floor(t / 3)] / _[Math.floor(t / 3)] * e);
	return t(t(n(i), y), g);
}
var c = s([
	[.64, .33],
	[.3, .6],
	[.15, .06]
]), l = s([
	[.708, .292],
	[.17, .797],
	[.131, .046]
]), u = n(l), d = t(u, c), f = n(d), p = [
	.8951,
	.2664,
	-.1614,
	-.7502,
	1.7135,
	.0367,
	.0389,
	-.0685,
	1.0296
], m = [
	.987,
	-.1471,
	.16,
	.4323,
	.5184,
	.0493,
	-.0085,
	.04,
	.9685
], h = [
	.401288,
	.650173,
	-.051461,
	-.250268,
	1.204414,
	.045854,
	-.002079,
	.048952,
	.953127
], g = [
	1.862068,
	-1.011255,
	.149187,
	.38752,
	.621447,
	-.008974,
	-.015841,
	-.034123,
	1.049964
], _ = {
	rgb: 0,
	xyz: 1,
	bradford: 2,
	cat16: 3
};
function v(e) {
	return e === _.xyz || e === _.bradford || e === _.cat16 ? e : _.rgb;
}
var y = {
	[_.rgb]: [
		1,
		1,
		1
	],
	[_.xyz]: [
		.9642119944211994,
		1,
		.8251882845188288
	],
	[_.bradford]: [
		.996078,
		1.020646,
		.818155
	],
	[_.cat16]: [
		.994535,
		1.000997,
		.833036
	]
}, b = (() => {
	let e = .3585;
	return [
		.34567 / e,
		1,
		.2958300000000001 / e
	];
})(), x = (() => {
	let t = (e, t) => [
		e[0] / t[0],
		e[1] / t[1],
		e[2] / t[2]
	];
	return {
		[_.rgb]: [
			1,
			1,
			1
		],
		[_.xyz]: t(y[_.xyz], b),
		[_.bradford]: t(y[_.bradford], e(p, b)),
		[_.cat16]: t(y[_.cat16], e(h, b))
	};
})();
_.rgb, _.xyz, _.bradford, _.cat16, _.rgb, _.xyz, _.bradford, _.cat16;
var S = {
	red: [
		1,
		0,
		0
	],
	green: [
		0,
		1,
		0
	],
	blue: [
		0,
		0,
		1
	],
	normalizeRed: !0,
	normalizeGreen: !0,
	normalizeBlue: !0,
	colourfulness: [
		0,
		0,
		0
	],
	normalizeColourfulness: !1,
	brightness: [
		0,
		0,
		0
	],
	normalizeBrightness: !1,
	grey: [
		0,
		0,
		0
	],
	normalizeGrey: !0,
	basis: _.rgb,
	gamut: 0,
	clip: !1
}, ee = (e) => e[0] + e[1] + e[2];
function C(e, t) {
	let n = ee(e);
	return t && n !== 0 ? [
		e[0] / n,
		e[1] / n,
		e[2] / n
	] : e;
}
function te(e) {
	return [
		...C(e.red, e.normalizeRed),
		...C(e.green, e.normalizeGreen),
		...C(e.blue, e.normalizeBlue)
	];
}
var ne = 152587890625e-16, re = .5773502691896258, ie = [.20915914598542354, .488075320769787], ae = [
	"complete",
	"simple",
	"primaries",
	"white-preserving"
], oe = 1.55, se = .02, ce = .7071067811865475, w = .4082482904638631, le = .8164965809277261, ue = .5773502691896258, T = [
	ce,
	w,
	ue,
	-.7071067811865475,
	w,
	ue,
	0,
	-.8164965809277261,
	ue
], de = (e) => [
	e[0],
	e[3],
	e[6],
	e[1],
	e[4],
	e[7],
	e[2],
	e[5],
	e[8]
];
function E(e, t) {
	let n = [];
	for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) n.push(e[r * 3] * t[i] + e[r * 3 + 1] * t[3 + i] + e[r * 3 + 2] * t[6 + i]);
	return n;
}
var fe = (e, t) => [
	e[0] * t[0] + e[1] * t[1] + e[2] * t[2],
	e[3] * t[0] + e[4] * t[1] + e[5] * t[2],
	e[6] * t[0] + e[7] * t[1] + e[8] * t[2]
], D = (e) => e[0] + e[1] + e[2], pe = (e, t) => [
	e[t],
	e[3 + t],
	e[6 + t]
];
function O(e) {
	let t = e;
	for (; t <= -Math.PI;) t += 2 * Math.PI;
	for (; t > Math.PI;) t -= 2 * Math.PI;
	return t;
}
function me(e) {
	let t = e;
	for (; t <= -Math.PI / 2;) t += Math.PI;
	for (; t > Math.PI / 2;) t -= Math.PI;
	return t;
}
function he(e) {
	return e >= 1 ? Math.min(.5 * (e + 1), 1.5) : e >= -1 ? e : Math.max(.5 * (e - 1), -1.5);
}
function ge(e) {
	return e >= 1 ? 2 * e - 1 : e >= -1 ? e : 2 * e + 1;
}
function _e(e) {
	return Math.atan(Math.max(e, 0)) / oe;
}
function ve(e) {
	return Math.tan(Math.min(Math.max(e, 0), .999) * oe);
}
function ye(e) {
	let t = E(E(de(T), e), T), [n, r, , i, a] = t, o = O(Math.atan2(i - r, n + a)), s = Math.cos(o), c = Math.sin(o), l = s * n + c * i, u = s * r + c * a, d = -c * r + s * a, f = l - d, p = me(.5 * Math.atan2(2 * u, f)), m = Math.hypot(.5 * f, u), h = l + d, g = Math.hypot(t[6], t[7]);
	return {
		theta: o,
		psi: p,
		stretch1: .5 * h + m,
		stretch2: .5 * h - m,
		couplingAmount: g,
		couplingHue: g > 0 ? O(Math.atan2(t[7], t[6])) : 0
	};
}
function be(e) {
	let t = Math.cos(e.theta), n = Math.sin(e.theta), r = Math.cos(e.psi), i = Math.sin(e.psi), a = e.stretch1 * r * r + e.stretch2 * i * i, o = (e.stretch1 - e.stretch2) * r * i, s = e.stretch1 * i * i + e.stretch2 * r * r;
	return E(E(T, [
		t * a - n * o,
		t * o - n * s,
		0,
		n * a + t * o,
		n * o + t * s,
		0,
		e.couplingAmount * Math.cos(e.couplingHue),
		e.couplingAmount * Math.sin(e.couplingHue),
		1
	]), de(T));
}
function k(e) {
	return y[e];
}
function A(e) {
	let t = D(e);
	return Math.abs(t) < 5e-5 ? null : [
		e[0] / t,
		e[1] / t,
		e[2] / t
	];
}
var j = (e) => [ce * (e[0] - e[1]), w * (e[0] + e[1]) - le * e[2]], xe = (e) => [
	ce * e[0] + w * e[1],
	-.7071067811865475 * e[0] + w * e[1],
	-.8164965809277261 * e[1]
], Se = (e, t) => [Math.cos(t) * e[0] - Math.sin(t) * e[1], Math.sin(t) * e[0] + Math.cos(t) * e[1]], M = (e, t) => [
	e[0] - t[0],
	e[1] - t[1],
	e[2] - t[2]
], Ce = (e, t) => [
	e[0] + t[0],
	e[1] + t[1],
	e[2] + t[2]
];
function we(e, t, n) {
	let r = n[0] - t[0], i = n[1] - t[1], a = e[0] * i - e[1] * r;
	if (Math.abs(a) < 5e-5) return Infinity;
	let o = (t[0] * i - t[1] * r) / a, s = (t[0] * e[1] - t[1] * e[0]) / a;
	return o >= 0 && s >= 0 && s <= 1 ? o : Infinity;
}
function Te(e, t) {
	let n = Infinity;
	for (let r = 0; r < 3; r++) n = Math.min(n, we(e, t[r], t[(r + 1) % 3]));
	return n;
}
function N(e) {
	let t = A(k(e));
	return t ? {
		white: t,
		refs: [
			0,
			1,
			2
		].map((e) => j(M(pe(r, e), t)))
	} : null;
}
function P(e, t, n, r) {
	let i = e.refs[t], a = Math.hypot(i[0], i[1]);
	if (a < 5e-5) return null;
	let o = Se([i[0] / a, i[1] / a], n), s = Te(o, e.refs);
	return s === Infinity ? null : Ce(e.white, xe([r * s * o[0], r * s * o[1]]));
}
function Ee(e, t, n) {
	let r = e.refs[t], i = j(M(n, e.white)), a = Math.hypot(i[0], i[1]);
	if (a < 5e-5) return {
		hue: 0,
		purity: 0
	};
	let o = [i[0] / a, i[1] / a], s = Te(o, e.refs);
	return s === Infinity || s < 5e-5 ? null : {
		hue: O(Math.atan2(o[1], o[0]) - Math.atan2(r[1], r[0])),
		purity: a / s
	};
}
function F(e) {
	let t = e[0] * (e[8] * e[4] - e[7] * e[5]) - e[3] * (e[8] * e[1] - e[7] * e[2]) + e[6] * (e[5] * e[1] - e[4] * e[2]);
	return Math.abs(t) < 1e-7 ? null : n(e);
}
function I(e, t) {
	return [
		0,
		1,
		2
	].flatMap((n) => [
		0,
		1,
		2
	].map((r) => t[r] * e[r][n]));
}
var De = (e) => I(e, [
	1,
	1,
	1
]);
function Oe(e, t) {
	let n = D(k(e));
	if (Math.abs(n) < 5e-5) return null;
	let r = N(e);
	if (!r) return null;
	let i = P(r, 0, t.whiteHue, t.whitePurity), a = [
		P(r, 0, t.redHue, t.redPurity),
		P(r, 1, t.greenHue, t.greenPurity),
		P(r, 2, t.blueHue, t.bluePurity)
	];
	if (!i || a.some((e) => !e)) return null;
	let o = a, s = F(De(o));
	if (!s) return null;
	let c = t.gain * n;
	return I(o, fe(s, [
		c * i[0],
		c * i[1],
		c * i[2]
	]));
}
function ke(e, t) {
	if (!F(t)) return null;
	let n = D(k(e));
	if (Math.abs(n) < 5e-5) return null;
	let r = N(e);
	if (!r) return null;
	let i = [
		t[0] + t[1] + t[2],
		t[3] + t[4] + t[5],
		t[6] + t[7] + t[8]
	], a = A(i);
	if (!a) return null;
	let o = Ee(r, 0, a);
	if (!o) return null;
	let s = [
		0,
		1,
		2
	].map((e) => {
		let n = A(pe(t, e));
		return n ? Ee(r, e, n) : null;
	});
	if (s.some((e) => !e)) return null;
	let [c, l, u] = s;
	return {
		whiteHue: o.hue,
		whitePurity: o.purity,
		redHue: c.hue,
		redPurity: c.purity,
		greenHue: l.hue,
		greenPurity: l.purity,
		blueHue: u.hue,
		bluePurity: u.purity,
		gain: D(i) / n
	};
}
var Ae = (e) => (e[1][0] - e[0][0]) * (e[2][1] - e[0][1]) - (e[1][1] - e[0][1]) * (e[2][0] - e[0][0]), je = (e) => [
	e.redRotation,
	e.greenRotation,
	e.blueRotation
], Me = (e) => [
	e.redSaturation,
	e.greenSaturation,
	e.blueSaturation
];
function Ne(e, t) {
	let n = k(e), r = N(e);
	if (!r) return null;
	let i = [], a = [];
	for (let e = 0; e < 3; e++) {
		let n = r.refs[e];
		if (Math.hypot(n[0], n[1]) < 5e-5) return null;
		let o = 1 + Me(t)[e], s = Se(n, je(t)[e]), c = Ce(r.white, xe([o * s[0], o * s[1]]));
		i.push(c), a.push(j(M(c, r.white)));
	}
	if (Math.abs(Ae(a)) < se * Math.abs(Ae(r.refs))) return null;
	let o = F(De(i));
	if (!o) return null;
	let s = fe(o, n);
	return n.some((e) => Math.abs(e) < 5e-5) ? null : I(i, [
		s[0] / n[0],
		s[1] / n[1],
		s[2] / n[2]
	]);
}
function Pe(e, t) {
	let n = N(e);
	if (!n) return null;
	let r = [];
	for (let e = 0; e < 3; e++) {
		let i = A(pe(t, e));
		if (!i) return null;
		let a = n.refs[e], o = Math.hypot(a[0], a[1]);
		if (o < 5e-5) return null;
		let s = j(M(i, n.white)), c = Math.hypot(s[0], s[1]);
		r.push(c < 5e-5 ? {
			rotation: 0,
			saturation: -1
		} : {
			rotation: O(Math.atan2(s[1], s[0]) - Math.atan2(a[1], a[0])),
			saturation: c / o - 1
		});
	}
	return {
		redRotation: r[0].rotation,
		redSaturation: r[0].saturation,
		greenRotation: r[1].rotation,
		greenSaturation: r[1].saturation,
		blueRotation: r[2].rotation,
		blueSaturation: r[2].saturation
	};
}
var L = (e, t) => Math.max(...e.map((e, n) => Math.abs(e - t[n]))), Fe = (e, t) => L(e, t) / Math.max(1, ...e.map(Math.abs));
function Ie(e, t, n) {
	let r = (e) => [
		e[0],
		e[1],
		e[2]
	], i = [
		r(t.red),
		r(t.green),
		r(t.blue)
	], a = i.some((e, n) => t.normalize[n] && D(e) === 0), o = i.flatMap((e, n) => C(e, t.normalize[n]));
	if (e === "complete") return {
		mode: e,
		ok: !0,
		matrix: o
	};
	if (e === "simple") {
		let n = ye(o);
		return {
			mode: e,
			ok: t.normalize.every(Boolean) && !a && L(o, be(n)) <= 5e-5,
			matrix: o,
			values: n
		};
	}
	if (e === "primaries") {
		let t = ke(n, o), r = t && Oe(n, t);
		return {
			mode: e,
			ok: !a && !!r && L(o, r) <= 5e-5,
			matrix: o,
			values: t ?? Le
		};
	}
	let s = Pe(n, o), c = s && Ne(n, s);
	return {
		mode: e,
		ok: !a && !!c && Fe(o, c) <= 5e-5,
		matrix: o,
		values: s ?? Re
	};
}
var Le = {
	whiteHue: 0,
	whitePurity: 0,
	redHue: 0,
	redPurity: 1,
	greenHue: 0,
	greenPurity: 1,
	blueHue: 0,
	bluePurity: 1,
	gain: 1
}, Re = {
	redRotation: 0,
	redSaturation: 0,
	greenRotation: 0,
	greenSaturation: 0,
	blueRotation: 0,
	blueSaturation: 0
}, ze = 1e-6, Be = (e, t) => e.every((e, n) => Math.abs(e - t[n]) <= ze), Ve = {
	simple: "Simple needs all three output rows normalized, with sums other than zero.",
	primaries: "Primaries needs a mixer that can be inverted, with columns that don't sum to zero.",
	"white-preserving": "White-preserving needs a mixer that leaves the white of the mixing space where it is."
}, He = "That setting collapses the primaries; the mixer keeps its last values.", Ue = (e) => ({
	red: e.red,
	green: e.green,
	blue: e.blue,
	normalize: [
		e.normalizeRed,
		e.normalizeGreen,
		e.normalizeBlue
	]
}), R = (e) => ({
	red: [
		e[0],
		e[1],
		e[2]
	],
	green: [
		e[3],
		e[4],
		e[5]
	],
	blue: [
		e[6],
		e[7],
		e[8]
	]
}), We = {
	normalizeRed: !1,
	normalizeGreen: !1,
	normalizeBlue: !1
};
function Ge(e, t) {
	let n = v(e.basis), r = Ie(t, Ue(e), n);
	return r.mode === "complete" || !r.ok ? {
		held: null,
		ok: !1
	} : {
		held: {
			values: {
				mode: r.mode,
				values: r.values
			},
			matrix: r.matrix,
			basis: n
		},
		ok: !0
	};
}
function Ke(e, t, n) {
	if (t === "complete") return null;
	let r = v(e.basis);
	return n && n.values.mode === t && n.basis === r && Be(n.matrix, te(e)) ? n : Ge(e, t).held;
}
function qe(e, t) {
	if (t === "complete") return {
		ok: !0,
		held: null,
		patch: null
	};
	let { held: n, ok: r } = Ge(e, t);
	return !r || !n ? {
		ok: !1,
		notice: Ve[t]
	} : t === "simple" ? {
		ok: !0,
		held: n,
		patch: null
	} : {
		ok: !0,
		held: n,
		patch: e.normalizeRed || e.normalizeGreen || e.normalizeBlue || !Je(e, n.matrix) ? {
			...We,
			...R(n.matrix)
		} : null
	};
}
var Je = (e, t) => [
	...e.red,
	...e.green,
	...e.blue
].every((e, n) => e === t[n]);
function Ye(e, t, n, r) {
	let i = v(e.basis), a = t.values, o, s;
	if (a.mode === "simple" ? (s = {
		mode: "simple",
		values: {
			...a.values,
			[n]: r
		}
	}, o = be(s.values)) : a.mode === "primaries" ? (s = {
		mode: "primaries",
		values: {
			...a.values,
			[n]: r
		}
	}, o = Oe(i, s.values)) : (s = {
		mode: "white-preserving",
		values: {
			...a.values,
			[n]: r
		}
	}, o = Ne(i, s.values)), !o) return {
		ok: !1,
		notice: He
	};
	let c = a.mode === "simple" ? R(o) : {
		...We,
		...R(o)
	}, l = te({
		...e,
		...c
	});
	return {
		ok: !0,
		held: {
			values: s,
			matrix: l,
			basis: i
		},
		patch: c
	};
}
//#endregion
//#region src/params.ts
var Xe = "channel-mixer", z = `${Xe}.mix`, B = [
	"red",
	"green",
	"blue",
	"colourfulness",
	"brightness",
	"grey"
], V = [
	"normalizeRed",
	"normalizeGreen",
	"normalizeBlue",
	"normalizeColourfulness",
	"normalizeBrightness",
	"normalizeGrey",
	"clip"
], H = ["basis", "gamut"], Ze = [
	...B,
	...V,
	...H
], U = (e) => `${z}.${e}`;
function Qe(e) {
	let t = {};
	for (let n of B) t[U(n)] = [...e[n]];
	for (let n of V) t[U(n)] = e[n];
	for (let n of H) t[U(n)] = e[n];
	return t;
}
function $e(e) {
	return Array.isArray(e) && e.length === 3 && e.every((e) => typeof e == "number" && Number.isFinite(e)) ? [
		e[0],
		e[1],
		e[2]
	] : null;
}
function et(e) {
	let t = { ...S };
	for (let n of B) t[n] = $e(e[U(n)]) ?? S[n];
	for (let n of V) {
		let r = e[U(n)];
		typeof r == "boolean" && (t[n] = r);
	}
	for (let n of H) {
		let r = e[U(n)];
		typeof r == "number" && Number.isFinite(r) && (t[n] = r);
	}
	return t;
}
var tt = () => Qe(S), W = (e) => ({
	...S,
	grey: e,
	basis: _.xyz,
	clip: !0
}), nt = {
	...S,
	normalizeGrey: !1
}, rt = (e, t, n) => ({
	...nt,
	red: e,
	green: t,
	blue: n
}), it = [
	{
		id: "bw-luminance",
		label: "B&W: luminance-based",
		params: W([
			0,
			1,
			0
		])
	},
	{
		id: "bw-hp5",
		label: "B&W: ILFORD HP5+",
		params: W([
			.25304098,
			.25958747,
			.48737156
		])
	},
	{
		id: "bw-delta100",
		label: "B&W: ILFORD DELTA 100",
		params: W([
			.24552374,
			.25366007,
			.50081619
		])
	},
	{
		id: "bw-delta400",
		label: "B&W: ILFORD DELTA 400 – 3200",
		params: W([
			.24376712,
			.23613559,
			.52009729
		])
	},
	{
		id: "bw-fp4",
		label: "B&W: ILFORD FP4+",
		params: W([
			.24149085,
			.22149272,
			.53701643
		])
	},
	{
		id: "bw-acros",
		label: "B&W: Fuji Acros 100",
		params: W([
			.333,
			.313,
			.353
		])
	},
	{
		id: "basic",
		label: "Basic channel mixer",
		params: nt
	},
	{
		id: "swap-gb",
		label: "Swap green and blue",
		params: rt([
			1,
			0,
			0
		], [
			0,
			0,
			1
		], [
			0,
			1,
			0
		])
	},
	{
		id: "swap-gr",
		label: "Swap green and red",
		params: rt([
			0,
			1,
			0
		], [
			1,
			0,
			0
		], [
			0,
			0,
			1
		])
	},
	{
		id: "swap-rb",
		label: "Swap red and blue",
		params: rt([
			0,
			0,
			1
		], [
			0,
			1,
			0
		], [
			1,
			0,
			0
		])
	}
], G, K;
function at(e) {
	K = e, G = e.react;
}
//#endregion
//#region src/store.ts
var ot = null;
function st() {
	ot = K.stores.create((e) => ({
		tab: "mixer",
		mode: "complete",
		notice: null,
		held: null,
		setTab: (t) => e({ tab: t }),
		setMode: (t, n) => e({
			mode: t,
			held: n,
			notice: null
		}),
		setNotice: (t) => e({ notice: t }),
		hold: (t) => e({
			held: t,
			notice: null
		})
	}));
}
function q() {
	if (!ot) throw Error("[channel-mixer] store() called before activate()");
	return ot;
}
//#endregion
//#region src/Panel.tsx
var ct = {
	complete: "Complete",
	simple: "Simple",
	primaries: "Primaries",
	"white-preserving": "White-preserving"
}, lt = [
	{
		value: "mixer",
		label: "Mixer"
	},
	{
		value: "outputs",
		label: "Outputs"
	},
	{
		value: "space",
		label: "Space"
	}
], ut = [
	{
		value: String(_.rgb),
		label: "Working RGB (Rec. 2020)"
	},
	{
		value: String(_.xyz),
		label: "XYZ"
	},
	{
		value: String(_.bradford),
		label: "Bradford LMS"
	},
	{
		value: String(_.cat16),
		label: "CAT16 LMS"
	}
], dt = Math.PI / 180, J = (e, t, n, r = !1) => ({
	field: e,
	label: t,
	min: -n,
	max: n,
	step: .1,
	defaultValue: 0,
	show: (e) => (r ? O(e) : e) / dt,
	read: (e) => e * dt
}), Y = (e, t, n, r, i) => ({
	field: e,
	label: t,
	min: n,
	max: r,
	step: .001,
	defaultValue: i,
	show: (e) => e,
	read: (e) => e
}), ft = [
	{ sliders: [J("theta", "Hue rotation", 180, !0)] },
	{
		title: "Chroma",
		sliders: [
			J("psi", "Axes orientation", 90),
			{
				...Y("stretch1", "u stretch", -1.5, 1.5, 1),
				show: he,
				read: ge
			},
			{
				...Y("stretch2", "v stretch", -1.5, 1.5, 1),
				show: he,
				read: ge
			}
		]
	},
	{
		title: "Achromatic coupling",
		sliders: [J("couplingHue", "Coupling hue", 180, !0), {
			...Y("couplingAmount", "Coupling amount", 0, 1, 0),
			show: _e,
			read: ve
		}]
	}
], pt = [
	{
		title: "Achromatic axis",
		sliders: [J("whiteHue", "White hue", 180), Y("whitePurity", "White purity", 0, 2, 0)]
	},
	{
		title: "Red primary",
		sliders: [J("redHue", "Red hue", 90), Y("redPurity", "Red purity", 0, 2, 1)]
	},
	{
		title: "Green primary",
		sliders: [J("greenHue", "Green hue", 90), Y("greenPurity", "Green purity", 0, 2, 1)]
	},
	{
		title: "Blue primary",
		sliders: [J("blueHue", "Blue hue", 90), Y("bluePurity", "Blue purity", 0, 2, 1)]
	},
	{
		title: "Gain correction",
		sliders: [Y("gain", "Gain", -8, 8, 1)]
	}
], mt = (e, t) => ({
	field: e,
	label: t,
	min: -100,
	max: 100,
	step: .1,
	defaultValue: 0,
	show: (e) => e * 100,
	read: (e) => e / 100
}), ht = {
	simple: ft,
	primaries: pt,
	"white-preserving": [
		"red",
		"green",
		"blue"
	].map((e) => {
		let t = e[0].toUpperCase() + e.slice(1);
		return {
			title: `${t} primary`,
			sliders: [J(`${e}Rotation`, `${t} rotation`, 90), mt(`${e}Saturation`, `${t} saturation`)]
		};
	})
}, gt = [
	"Input R",
	"Input G",
	"Input B"
];
function _t() {
	let { Slider: e } = K.components, { Select: t, SegmentedControl: n, Section: r, Stack: i, Toggle: a } = K.ui, o = K.develop.useParamScope(), s = q()((e) => e.tab), c = q()((e) => e.mode), l = q()((e) => e.notice), u = q()((e) => e.held), d = et(o.getParams()), f = () => et(o.getParams()), p = (e) => o.setParams(Qe({
		...f(),
		...e
	})), m = (e) => o.commit(`Channel Mixer ${e}`), h = (t, n, o, s, c, l) => /* @__PURE__ */ G.createElement(r, {
		key: n,
		title: t
	}, /* @__PURE__ */ G.createElement(i, { gap: 2 }, gt.map((r, i) => /* @__PURE__ */ G.createElement(e, {
		key: r,
		label: r,
		value: d[n][i],
		min: s,
		max: c,
		step: .001,
		defaultValue: l[i],
		onChange: (e) => {
			let t = [...f()[n]];
			t[i] = e, p({ [n]: t });
		},
		onCommit: () => m(`${t.toLowerCase()} ${r.toLowerCase()}`)
	})), /* @__PURE__ */ G.createElement(a, {
		label: "Normalize",
		ariaLabel: `Normalize ${t.toLowerCase()}`,
		checked: d[o],
		onChange: (e) => {
			p({ [o]: e }), m(`normalize ${t.toLowerCase()}`);
		}
	}))), g = Ke(d, c, u), _ = g ? c : "complete", y = /* @__PURE__ */ G.createElement(i, { gap: 4 }, /* @__PURE__ */ G.createElement(t, {
		ariaLabel: "Mixer mode",
		value: _,
		options: ae.map((e) => ({
			value: e,
			label: ct[e]
		})),
		onChange: (e) => {
			let t = e, n = qe(f(), t);
			n.ok ? (q().getState().setMode(t, n.held), n.patch && (p(n.patch), m(`${ct[t].toLowerCase()} mode`))) : (q().getState().setMode("complete", null), q().getState().setNotice(n.notice));
		}
	}), l ? /* @__PURE__ */ G.createElement("div", {
		role: "status",
		style: {
			color: K.ui.tokens.textSecondary,
			fontSize: 11
		}
	}, l) : null, g ? ((t) => {
		let n = t.values.values;
		return ht[t.values.mode].map((a, o) => {
			let s = a.sliders.map((r) => /* @__PURE__ */ G.createElement(e, {
				key: r.field,
				label: r.label,
				value: r.show(n[r.field]),
				min: r.min,
				max: r.max,
				step: r.step,
				defaultValue: r.defaultValue,
				onChange: (e) => {
					let n = Ke(f(), t.values.mode, q().getState().held) ?? t, i = Ye(f(), n, r.field, r.read(e));
					i.ok ? (q().getState().hold(i.held), p(i.patch)) : q().getState().setNotice(i.notice);
				},
				onCommit: () => m(r.label.toLowerCase())
			}));
			return a.title ? /* @__PURE__ */ G.createElement(r, {
				key: o,
				title: a.title
			}, /* @__PURE__ */ G.createElement(i, { gap: 2 }, s)) : /* @__PURE__ */ G.createElement(i, {
				key: o,
				gap: 2
			}, s);
		});
	})(g) : [
		h("Output red", "red", "normalizeRed", -2, 2, [
			1,
			0,
			0
		]),
		h("Output green", "green", "normalizeGreen", -2, 2, [
			0,
			1,
			0
		]),
		h("Output blue", "blue", "normalizeBlue", -2, 2, [
			0,
			0,
			1
		])
	]), b = /* @__PURE__ */ G.createElement(i, { gap: 4 }, h("Colourfulness", "colourfulness", "normalizeColourfulness", -1, 1, [
		0,
		0,
		0
	]), h("Brightness", "brightness", "normalizeBrightness", -1, 1, [
		0,
		0,
		0
	]), h("B&W", "grey", "normalizeGrey", -2, 2, [
		0,
		0,
		0
	])), x = /* @__PURE__ */ G.createElement(i, { gap: 4 }, /* @__PURE__ */ G.createElement(t, {
		ariaLabel: "Mixing space",
		value: String(v(d.basis)),
		options: ut,
		onChange: (e) => {
			p({ basis: Number(e) }), m("mixing space");
		}
	}), /* @__PURE__ */ G.createElement(e, {
		label: "Gamut compression",
		value: d.gamut,
		min: 0,
		max: 4,
		step: .01,
		defaultValue: 0,
		onChange: (e) => p({ gamut: e }),
		onCommit: () => m("gamut compression")
	}), /* @__PURE__ */ G.createElement(a, {
		label: "Clip negative RGB",
		checked: d.clip,
		onChange: (e) => {
			p({ clip: e }), m("clip negative RGB");
		}
	}));
	return /* @__PURE__ */ G.createElement(i, {
		gap: 6,
		style: { padding: 8 }
	}, /* @__PURE__ */ G.createElement(t, {
		ariaLabel: "Channel Mixer preset",
		value: "",
		placeholder: "Presets",
		options: it.map((e) => ({
			value: e.id,
			label: e.label
		})),
		onChange: (e) => {
			let t = it.find((t) => t.id === e);
			t && (o.setParams(Qe(t.params)), m(`preset: ${t.label}`));
		}
	}), /* @__PURE__ */ G.createElement(n, {
		size: "sm",
		value: s,
		options: lt,
		onChange: (e) => q().getState().setTab(e)
	}), s === "mixer" ? y : s === "outputs" ? b : x);
}
//#endregion
//#region src/stage.ts
function X(e) {
	let t = e.toPrecision(10);
	return t.includes("e") || t.includes(".") ? t : `${t}.0`;
}
function Z(e) {
	return `mat3(${[
		0,
		3,
		6,
		1,
		4,
		7,
		2,
		5,
		8
	].map((t) => X(e[t])).join(", ")})`;
}
var vt = (e) => `vec3(${e.map(X).join(", ")})`, yt = `
const float CM_NORM_MIN = ${X(ne)};
const float CM_INV_SQRT_3 = ${X(re)};
const vec2 CM_D50_UV = vec2(${X(ie[0])}, ${X(ie[1])});
const mat3 CM_TO_2020 = ${Z(d)};
const mat3 CM_TO_709 = ${Z(f)};
const mat3 CM_2020_TO_XYZ = ${Z(l)};
const mat3 CM_XYZ_TO_2020 = ${Z(u)};
const mat3 CM_XYZ_TO_BRADFORD = ${Z(p)};
const mat3 CM_BRADFORD_TO_XYZ = ${Z(m)};
const mat3 CM_XYZ_TO_CAT16 = ${Z(h)};
const mat3 CM_CAT16_TO_XYZ = ${Z(g)};

vec3 cmRow(vec3 row, bool normalized) {
  float s = row.x + row.y + row.z;
  return (normalized && s != 0.0) ? row / s : row;
}
float cmNorm(vec3 v) {
  return max(sqrt(dot(v, v)), CM_NORM_MIN);
}
vec3 cmToLms(vec3 xyz, int space) {
  if (space == ${_.bradford}) return CM_XYZ_TO_BRADFORD * xyz;
  if (space == ${_.cat16}) return CM_XYZ_TO_CAT16 * xyz;
  return xyz;
}
vec3 cmFromLms(vec3 lms, int space) {
  if (space == ${_.bradford}) return CM_BRADFORD_TO_XYZ * lms;
  if (space == ${_.cat16}) return CM_CAT16_TO_XYZ * lms;
  return lms;
}
vec3 cmAdaptation(int space) {
  if (space == ${_.xyz}) return ${vt(x[_.xyz])};
  if (space == ${_.bradford}) return ${vt(x[_.bradford])};
  if (space == ${_.cat16}) return ${vt(x[_.cat16])};
  return vec3(1.0);
}
vec3 cmGamut(vec3 xyz, float compression, bool clipped) {
  float total = xyz.x + xyz.y + xyz.z;
  float Y = xyz.y;
  if (!(total > 0.0 && Y > 0.0)) return vec3(0.0);
  float x = xyz.x / total;
  float y = xyz.y / total;
  float uvDen = -2.0 * x + 12.0 * y + 3.0;
  vec2 uv = vec2(4.0 * x, 9.0 * y) / uvDen;
  vec2 d = CM_D50_UV - uv;
  float delta = Y * dot(d, d);
  float correction = compression == 0.0 ? 0.0 : pow(delta, compression);
  vec2 t = correction * d + uv;
  uv.x = uv.x > CM_D50_UV.x ? max(t.x, CM_D50_UV.x) : min(t.x, CM_D50_UV.x);
  uv.y = uv.y > CM_D50_UV.y ? max(t.y, CM_D50_UV.y) : min(t.y, CM_D50_UV.y);
  float xyDen = 6.0 * uv.x - 16.0 * uv.y + 12.0;
  x = 9.0 * uv.x / xyDen;
  y = 4.0 * uv.y / xyDen;
  if (clipped) {
    x = max(x, 0.0);
    y = max(y, 0.0);
  }
  y = max(y, CM_NORM_MIN);
  float s = x + y;
  if (s >= 1.0) {
    x /= s;
    y /= s;
  }
  return vec3(Y * x / y, Y, Y * (1.0 - x - y) / y);
}
vec3 cmLumaChroma(vec3 v, vec3 sat, vec3 light) {
  float n = cmNorm(v);
  float avg = max((v.x + v.y + v.z) / 3.0, CM_NORM_MIN);
  float lift = dot(v, light);
  n *= CM_INV_SQRT_3;
  vec3 ratios = v / n;
  float coeff = dot(ratios, sat) / 3.0;
  vec3 o = max((1.0 - ratios) * coeff + ratios, min(ratios, vec3(0.0)));
  n /= cmNorm(o) * CM_INV_SQRT_3;
  n *= max(1.0 + lift / avg, 0.0);
  return o * n;
}
`, bt = `
{
  mat3 cmMix = transpose(mat3(cmRow(red, normalizeRed), cmRow(green, normalizeGreen), cmRow(blue, normalizeBlue)));
  vec3 cmSat = -colourfulness + (normalizeColourfulness ? (colourfulness.x + colourfulness.y + colourfulness.z) / 3.0 : 0.0);
  vec3 cmLight = brightness - (normalizeBrightness ? (brightness.x + brightness.y + brightness.z) / 3.0 : 0.0);
  float cmGreySum = grey.x + grey.y + grey.z;
  vec3 cmGrey = grey / ((!normalizeGrey || cmGreySum == 0.0) ? 1.0 : cmGreySum);
  bool cmMono = any(notEqual(grey, vec3(0.0)));
  float cmCompression = gamut == 0.0 ? 0.0 : 1.0 / gamut;
  bool cmIdle = cmMix == mat3(1.0) && cmSat == vec3(0.0) && cmLight == vec3(0.0) && !cmMono && cmCompression == 0.0 && !clip;
  if (!cmIdle) {
    int cmSpace = basis;
    vec3 w = CM_TO_2020 * lin;
    if (clip) w = max(w, 0.0);
    vec3 cmXyz;
    if (cmSpace == ${_.rgb}) {
      cmXyz = CM_2020_TO_XYZ * (cmMix * w);
    } else {
      vec3 cmLms = cmToLms(CM_2020_TO_XYZ * w, cmSpace) * cmAdaptation(cmSpace);
      cmXyz = cmFromLms(cmMix * cmLms, cmSpace);
    }
    vec3 cmMapped = cmGamut(cmXyz, cmCompression, clip);
    vec3 cmV = cmSpace == ${_.rgb} ? CM_XYZ_TO_2020 * cmMapped : cmToLms(cmMapped, cmSpace);
    if (clip) cmV = max(cmV, 0.0);
    cmV = cmLumaChroma(cmV, cmSat, cmLight);
    if (clip) cmV = max(cmV, 0.0);
    if (cmMono) {
      w = vec3(max(dot(cmV, cmGrey), 0.0));
    } else {
      vec3 cmBack = cmSpace == ${_.rgb} ? CM_2020_TO_XYZ * cmV : cmFromLms(cmV, cmSpace);
      if (clip) cmBack = max(cmBack, 0.0);
      w = CM_XYZ_TO_2020 * cmBack;
      if (clip) w = max(w, 0.0);
    }
    lin = CM_TO_709 * w;
  }
}
`, Q = (e, t, n, r) => ({
	key: e,
	glslType: "vec3",
	default: [...S[e]],
	range: {
		min: n,
		max: r,
		step: .001
	},
	label: t
}), $ = (e, t) => ({
	key: e,
	glslType: "bool",
	default: S[e],
	label: t
}), xt = [
	Q("red", "output red", -2, 2),
	Q("green", "output green", -2, 2),
	Q("blue", "output blue", -2, 2),
	$("normalizeRed", "normalize red"),
	$("normalizeGreen", "normalize green"),
	$("normalizeBlue", "normalize blue"),
	Q("colourfulness", "colourfulness", -1, 1),
	$("normalizeColourfulness", "normalize colourfulness"),
	Q("brightness", "brightness", -1, 1),
	$("normalizeBrightness", "normalize brightness"),
	Q("grey", "B&W", -2, 2),
	$("normalizeGrey", "normalize B&W"),
	{
		key: "basis",
		glslType: "int",
		default: S.basis,
		range: {
			min: 0,
			max: 3,
			step: 1
		},
		label: "mixing space"
	},
	{
		key: "gamut",
		glslType: "float",
		default: S.gamut,
		range: {
			min: 0,
			max: 12,
			step: .01
		},
		label: "gamut compression"
	},
	$("clip", "clip negative RGB")
];
function St() {
	return {
		id: z,
		name: "Channel Mixer",
		phase: "scene-linear",
		priority: 20,
		glsl: bt,
		helpers: yt,
		uniforms: xt,
		presetScope: "global",
		mask: { maskable: !0 }
	};
}
//#endregion
//#region src/index.tsx
var Ct = `${Xe}.panel`, wt = null;
function Tt() {
	let e = K.stores.useDevelopStore.getState();
	e.setDynParams(tt()), e.commitEdit("Channel Mixer reset");
}
function Et(e) {
	at(e), st(), wt = e, e.registerProcessingStage(St()), e.registerPanel({
		id: Ct,
		title: "Channel Mixer",
		component: _t,
		defaultDock: {
			module: "develop",
			direction: "right",
			width: 280
		},
		onReset: Tt,
		mask: {
			component: _t,
			owns: Ze.map(U)
		}
	});
}
function Dt() {
	let e = wt;
	if (e) {
		wt = null;
		try {
			e.unregisterProcessingStage(z);
		} catch (e) {
			console.warn("[channel-mixer] deactivate failed:", e);
		}
	}
}
//#endregion
export { Ct as PANEL_ID, Et as activate, Dt as deactivate };

//# sourceMappingURL=index.js.map
// Flixbnb in under a minute: a hand-drawn paper-collage film.
// Everything is drawn live on a canvas, and the soundtrack is synthesized in the browser,
// scheduled a fraction of a second ahead of the drawing so the two stay in sync.
(function () {
  'use strict';

  const root = document.querySelector('.film');
  if (!root) return;
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const W = 1280, H = 720, DUR = 52;

  /* ───────────── Small helpers ───────────── */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash() {
    let h = 2166136261;
    for (let i = 0; i < arguments.length; i++) { h ^= (arguments[i] * 2654435761) | 0; h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function strHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const P = (t, start, dur) => clamp((t - start) / dur);
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeIn = x => x * x * x;
  const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const pop = (t, start, dur = 0.32) => (t < start ? 0 : easeOutBack(clamp((t - start) / dur)));

  const HAND = (w, s) => `${w} ${s}px Kalam, "Comic Sans MS", cursive`;
  const SANS = (w, s) => `${w} ${s}px "Schibsted Grotesk", system-ui, sans-serif`;

  const C = {
    paper: '#F6F3EC', navy: '#0F2342', ink: '#13233B', soft: '#56657A',
    aegean: '#1D4FA3', aegeanPale: '#DCE7F7',
    green: '#16703E', greenLight: '#7FDDA4', greenPale: '#DDF3E5',
    pink: '#C2207A', pinkPale: '#FBDDEB',
    yellow: '#FCF1A0', yellowDark: '#E6D27A',
    kraft: '#D9C29B', kraftDark: '#BFA67C',
    white: '#FFFFFF', skin: '#FFF4E6', orange: '#F4A259'
  };

  /* ───────────── The timeline (shared by the drawing and the soundtrack) ───────────── */
  const NOTIFS = [
    { t: 1.5, x: 930, y: 232, rot: -0.05, text: 'Lockbox is empty!', c: 'pink' },
    { t: 2.0, x: 1010, y: 330, rot: 0.06, text: 'Can we stay one more night?', c: 'aegean' },
    { t: 2.5, x: 360, y: 214, rot: 0.03, text: 'I want €200 back.', c: 'pink' },
    { t: 3.0, x: 975, y: 432, rot: -0.07, text: "Cleaner hasn't confirmed", c: 'green' },
    { t: 3.375, x: 340, y: 326, rot: -0.04, text: "What's the Wi-Fi password?", c: 'aegean' },
    { t: 3.75, x: 1090, y: 532, rot: 0.08, text: "We're 6, not 4!", c: 'pink' },
    { t: 4.0, x: 315, y: 438, rot: 0.05, text: "Door code doesn't work", c: 'pink' },
    { t: 4.25, x: 640, y: 214, rot: -0.09, text: 'Hello???', c: 'aegean' },
    { t: 4.5, x: 930, y: 618, rot: 0.04, text: 'Early check-in?', c: 'green' },
    { t: 4.75, x: 330, y: 558, rot: 0.07, text: 'No hot water!!', c: 'pink' },
    { t: 5.0, x: 1100, y: 158, rot: -0.06, text: 'Where do we park?', c: 'aegean' },
    { t: 5.25, x: 610, y: 292, rot: -0.04, text: 'Hello?????', c: 'pink' }
  ];
  const NOTE_LABELS = [
    'Lockbox empty', 'Refund threat', 'Late checkout', 'Same-day turnover', 'Bedbugs', 'No hot water',
    'Wi-Fi down', 'Delayed flight', 'Damage claim', 'Extra guests', 'Key not returned', 'Noisy neighbours',
    'AC not working', 'Wrong door code', 'Cleaner late', 'Left something behind', 'Early check-in', 'Bad review',
    'Smart lock dead', 'Where to park?', 'Extra night', 'Pets allowed?', 'Missing towels', 'Brown water',
    'Gas smell', 'Crib request', 'Invoice request', 'Guest not answering', 'Elevator out', 'Paying in cash',
    'Mid-stay cancel', 'Not registered', 'Leaking tap', 'Second key', 'Cleaner no-show', 'Booking pending',
    'Lights out', '"Hello???"', 'Owner visit', 'Bags after checkout'
  ];
  const NOTES = (function () {
    const r = rng(2024), cells = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) cells.push([col, row]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp; }
    const colors = [C.yellow, C.pinkPale, C.aegeanPale, C.greenPale, C.yellow];
    return cells.map(([col, row], k) => ({
      x: 82 + col * 160 + (r() - 0.5) * 26,
      y: 76 + row * 142 + (r() - 0.5) * 22,
      rot: (r() - 0.5) * 0.26,
      color: colors[Math.floor(r() * colors.length)],
      label: NOTE_LABELS[k],
      t: 6.5 + 2.8 * Math.pow(k / 39, 0.8)
    }));
  })();
  const ITEMS = ['Lockbox empty', 'Extra night request', 'Cleaner running late', 'Same-day turnover', 'Wrong door code sent', 'Guest wants €200 back'];
  const MSGS = [
    { who: 'bot', text: "The power's out in Nikis 54. Where's the fuse box?", t: 32.0 },
    { who: 'you', text: 'Behind the curtain, left of the shower door.', t: 33.5 },
    { who: 'bot', text: 'Got it. Telling the guest now.', t: 35.0 },
    { who: 'gap', text: '15 minutes later', t: 36.0 },
    { who: 'bot', text: "Power's back. The guest is all good.", t: 37.0, tick: true }
  ];
  const T = {
    hundred: [9.5, 9.7, 9.9, 10.1],
    rip: 11.5,
    stamp: 13.0,
    circles: [15.0, 15.5, 16.0],
    cover1: 19.0,
    items: [20.5, 21.0, 21.5, 22.0, 22.5, 23.0],
    ticks: [24, 25, 26, 27, 28],
    call: 29.0,
    typing: [[31.2, 32.0, 0], [34.2, 35.0, 2], [36.3, 37.0, 4]],
    tenx: [41.0, 41.5],
    yourTeam: 42.0,
    hundredX: [43.0, 43.15, 43.3, 43.45],
    hit: 43.5,
    better: 43.8,
    cover2: 45.8,
    strips: [46.5, 47.0, 47.5],
    handled: 48.0,
    logo: 49.0,
    button: 49.5,
    circle: 50.3
  };
  const SHAKES = [T.stamp, T.hit, T.handled];

  /* ───────────── Paper ───────────── */
  let PAPER, NAVY, grainPat, BOIL = 0;

  function makePaper(base, seed, o) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data, r = rng(seed);
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * o.grain; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    g.lineWidth = 1; g.strokeStyle = o.fibre || 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 260; i++) {
      const x = r() * W, y = r() * H, a = r() * Math.PI * 2, l = 6 + r() * 18;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    if (o.grid) {
      g.strokeStyle = o.grid;
      for (let x = 40; x < W; x += 40) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
      for (let y = 40; y < H; y += 40) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
    }
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, o.vignette || 'rgba(20,20,30,0.14)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return c;
  }

  function makeTextures() {
    PAPER = makePaper(C.paper, 11, { grid: 'rgba(29,79,163,0.07)', grain: 12 });
    NAVY = makePaper(C.navy, 12, { grain: 10, fibre: 'rgba(255,255,255,0.035)', vignette: 'rgba(0,0,0,0.32)' });
    const grain = document.createElement('canvas');
    grain.width = grain.height = 160;
    const g = grain.getContext('2d'), img = g.createImageData(160, 160), r = rng(9);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(r() * 26);
    }
    g.putImageData(img, 0, 0);
    grainPat = ctx.createPattern(grain, 'repeat');
  }

  /* ───────────── Shapes ───────────── */
  const rect = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  function roundPoly(w, h, rad, n = 5) {
    const pts = [];
    const corners = [[w / 2 - rad, -h / 2 + rad, -Math.PI / 2], [w / 2 - rad, h / 2 - rad, 0], [-w / 2 + rad, h / 2 - rad, Math.PI / 2], [-w / 2 + rad, -h / 2 + rad, Math.PI]];
    for (const [cx, cy, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
    return pts;
  }
  function ellPoly(rx, ry, n = 44) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
    return pts;
  }
  // A hand-drawn loop: starts anywhere and overshoots a little, like a pen circling something
  function ellPts(cx, cy, rx, ry, seed, over = 0.12, n = 40) {
    const r = rng(seed), a0 = r() * Math.PI * 2, pts = [];
    for (let i = 0; i <= n * (1 + over); i++) {
      const a = a0 + (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * 0.06;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }
  function arcPts(cx, cy, r, a1, a2, n = 16) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a1, a2, i / n); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  }
  // Torn paper: every edge gets small random nicks
  function tornPoly(base, seed, rough = 1.6, step = 12) {
    const r = rng(seed), pts = [], n = base.length;
    for (let i = 0; i < n; i++) {
      const a = base[i], b = base[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.max(2, Math.round(len / step));
      const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
      for (let j = 0; j < k; j++) { const u = j / k, off = (r() - 0.5) * rough * 2; pts.push([lerp(a[0], b[0], u) + nx * off, lerp(a[1], b[1], u) + ny * off]); }
    }
    return pts;
  }
  const grow = (pts, d) => pts.map(([x, y]) => { const l = Math.hypot(x, y) || 1; return [x + (x / l) * d, y + (y / l) * d]; });
  const memoMap = new Map();
  function memo(key, make) { let v = memoMap.get(key); if (!v) { v = make(); memoMap.set(key, v); } return v; }
  const shapeOf = (key, base, rough, step) => memo(key, () => tornPoly(base(), strHash(key), rough, step));
  function poly(pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ───────────── Drawing materials ───────────── */
  // A pen line that "boils" (redraws with a new wobble 8 times a second), drawn up to p (0..1)
  function ink(pts, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0 || pts.length < 2) return;
    const r = rng(hash(o.seed || 1, BOIL)), j = o.jitter === undefined ? 1.1 : o.jitter, step = o.step || 9;
    const dense = [], n = pts.length, segs = o.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let s = 0; s < k; s++) dense.push([lerp(a[0], b[0], s / k) + (r() - 0.5) * j * 2, lerp(a[1], b[1], s / k) + (r() - 0.5) * j * 2]);
    }
    const last = o.closed ? pts[0] : pts[n - 1];
    dense.push([last[0] + (r() - 0.5) * j * 2, last[1] + (r() - 0.5) * j * 2]);
    let total = 0; const L = [0];
    for (let i = 1; i < dense.length; i++) { total += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]); L.push(total); }
    const lim = total * clamp(p);
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.width || 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(dense[0][0], dense[0][1]);
    for (let i = 1; i < dense.length; i++) {
      if (L[i] <= lim) ctx.lineTo(dense[i][0], dense[i][1]);
      else { const u = (lim - L[i - 1]) / ((L[i] - L[i - 1]) || 1); ctx.lineTo(lerp(dense[i - 1][0], dense[i][0], u), lerp(dense[i - 1][1], dense[i][1], u)); break; }
    }
    ctx.stroke(); ctx.restore();
  }
  // A cut-out piece of paper, centred on the current origin, with a cast shadow and paper grain
  function piece(key, base, fill, o = {}) {
    const rough = o.rough === undefined ? 1.6 : o.rough;
    const inner = shapeOf(key, base, rough, o.step || 12);
    const outer = o.edge ? memo(key + '|edge', () => tornPoly(grow(base(), o.edgeW || 4), strHash(key) + 7, rough + 1.2, 10)) : null;
    const jr = rng(hash(strHash(key), BOIL)), jit = o.still ? 0 : 1.1;
    ctx.save();
    ctx.translate((jr() - 0.5) * jit, (jr() - 0.5) * jit);
    if (o.shadow !== false) {
      ctx.save(); ctx.translate(o.sx === undefined ? 3 : o.sx, o.sy === undefined ? 5 : o.sy);
      poly(outer || inner); ctx.fillStyle = `rgba(10,18,34,${o.shadowA === undefined ? 0.2 : o.shadowA})`; ctx.fill();
      ctx.restore();
    }
    if (outer) { poly(outer); ctx.fillStyle = o.edge; ctx.fill(); }
    poly(inner); ctx.fillStyle = fill; ctx.fill();
    if (o.grain !== false) { ctx.fillStyle = grainPat; ctx.fill(); }
    ctx.restore();
  }
  function tape(x, y, w, rot, seed) {
    const r = rng(seed), h = 26;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2);
    for (let i = 1; i <= 5; i++) ctx.lineTo(w / 2 - (i % 2 ? 4 : 0) - r() * 2, -h / 2 + (h * i) / 5);
    ctx.lineTo(-w / 2, h / 2);
    for (let i = 4; i >= 0; i--) ctx.lineTo(-w / 2 + (i % 2 ? 4 : 0) + r() * 2, -h / 2 + (h * i) / 5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(250,244,218,0.72)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,60,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  // Handwriting that writes itself on from left to right as p goes 0 → 1
  function hand(text, x, y, size, color, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return 0;
    ctx.save();
    ctx.font = HAND(o.weight || 700, size); ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const w = ctx.measureText(text).width, x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    if (p < 1) { ctx.beginPath(); ctx.rect(x0 - 12, y - size * 1.3, (w + 24) * p, size * 2); ctx.clip(); }
    ctx.fillText(text, x0, y);
    ctx.restore();
    return w;
  }
  function wrapLines(text, maxW) {
    const words = text.split(' '), lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function dot(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function star(x, y, r, seed, color) {
    ink([[x - r, y], [x + r, y]], { color, width: 3, seed });
    ink([[x, y - r], [x, y + r]], { color, width: 3, seed: seed + 1 });
  }
  // Ink specks around a stamp: they fly out on impact and stay put
  function splats(x, y, t, t0, seed, color, count = 16, near = 90) {
    if (t < t0) return;
    const r = rng(seed), e = easeOut(P(t, t0, 0.25));
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = near + r() * 170, rad = 2 + r() * 6;
      dot(x + Math.cos(a) * d * e, y + Math.sin(a) * d * 0.6 * e, rad, color);
    }
  }
  // Ransom-note letters: each one cut from a different scrap, popping in one by one
  function ransom(word, cx, cy, size, times, t, seed) {
    const r = rng(seed);
    const fonts = [SANS(800, size), `700 ${size}px Georgia, serif`, HAND(700, size * 1.05), SANS(800, size * 0.95)];
    const scraps = [[C.white, C.ink], [C.aegean, C.white], [C.yellow, C.ink], [C.pink, C.white], [C.greenPale, C.green], [C.navy, C.white]];
    const letters = word.split('').map((ch, i) => {
      const font = fonts[Math.floor(r() * fonts.length)], sc = scraps[(i + Math.floor(r() * 3)) % scraps.length];
      ctx.font = font;
      return { ch, font, bg: sc[0], fg: sc[1], w: ctx.measureText(ch).width + size * 0.34, rot: (r() - 0.5) * 0.22, dy: (r() - 0.5) * size * 0.12 };
    });
    const gap = size * 0.06, total = letters.reduce((s, l) => s + l.w, 0) + gap * (letters.length - 1);
    let x = cx - total / 2;
    letters.forEach((l, i) => {
      const s = pop(t, times[i], 0.3);
      if (s > 0) {
        ctx.save(); ctx.translate(x + l.w / 2, cy + l.dy); ctx.rotate(l.rot); ctx.scale(s, s);
        piece('rn' + seed + i + word, () => rect(l.w, size * 1.18), l.bg, { rough: 2.2, shadowA: 0.26 });
        ctx.font = l.font; ctx.fillStyle = l.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(l.ch, 0, size * 0.06);
        ctx.restore();
      }
      x += l.w + gap;
    });
  }

  /* ───────────── Characters and props ───────────── */
  const SLEEVE = '#17428A';
  function host(x, y, s, mood, t, o = {}) {
    if (s <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.translate(0, Math.sin(t * 2.2) * 2);

    piece('host-body', () => [[-60, 0], [60, 0], [96, 200], [-96, 200]], C.aegean, { rough: 2 });
    ink([[-24, 4], [0, 24], [24, 4]], { color: C.white, width: 4, seed: 62 });

    // left arm (a shade darker than the sweater so it reads): down at the side, or holding a coffee
    if (o.coffee) ink([[-58, 26], [-92, 92], [-48, 106]], { color: SLEEVE, width: 22, seed: 61, jitter: 0.5 });
    else ink([[-58, 26], [-104, 120]], { color: SLEEVE, width: 22, seed: 61, jitter: 0.5 });

    if (o.coffee) {
      ctx.save(); ctx.translate(-30, 96); ctx.rotate(-0.06);
      ink(arcPts(26, 0, 13, -Math.PI / 2, Math.PI / 2), { color: C.white, width: 6, seed: 63 });
      piece('mug', () => [[-24, -26], [24, -26], [20, 26], [-20, 26]], C.white, { rough: 1 });
      ink([[-12, -6], [12, -6]], { color: C.pink, width: 4, seed: 64 });
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.7 + i * 0.5) % 1;
        const pts = [];
        for (let k = 0; k <= 8; k++) pts.push([-8 + i * 14 + Math.sin(k * 0.9 + t * 3 + i) * 5, -34 - k * 6 - ph * 18]);
        ink(pts, { color: C.soft, width: 2.5, seed: 65 + i, alpha: 0.7 * (1 - ph) });
      }
      ctx.restore();
      dot(-44, 106, 12, C.skin);
    } else dot(-106, 126, 12, C.skin);

    // the head
    ctx.save(); ctx.translate(0, -68);
    piece('host-head', () => ellPoly(58, 60), C.skin, { rough: 1.2 });
    piece('host-hair', () => {
      const pts = [];
      for (let i = 0; i <= 14; i++) { const a = Math.PI + 0.1 + (i / 14) * (Math.PI - 0.2); pts.push([Math.cos(a) * 63, Math.sin(a) * 65 - 2]); }
      for (let i = 0; i <= 8; i++) pts.push([58 - i * (116 / 8), -22 - (i % 2) * 14]);
      return pts;
    }, C.navy, { rough: 2.2, shadow: false });

    const ey = 2, ex = 21;
    if (mood === 'stressed') {
      [-ex, ex].forEach((dx, i) => {
        ctx.beginPath(); ctx.ellipse(dx, ey, 11, 12, 0, 0, Math.PI * 2); ctx.fillStyle = C.white; ctx.fill();
        ink(ellPts(dx, ey, 11, 12, 70 + i, 0.05, 20), { width: 2.5, seed: 72 + i });
        const jr = rng(hash(BOIL, i + 3));
        dot(dx + (jr() - 0.5) * 5, ey + (jr() - 0.5) * 5, 3.6, C.ink);
      });
      ink([[-36, -14], [-11, -24]], { width: 3.5, seed: 74 });
      ink([[36, -14], [11, -24]], { width: 3.5, seed: 75 });
      ink([[-18, 34], [-10, 27], [-2, 34], [6, 27], [14, 34], [20, 28]], { width: 3.5, seed: 76 });
      for (let i = 0; i < 2; i++) {
        const ph = (t * 1.4 + i * 0.5) % 1, sx = i ? -64 : 66, sy = -18 + ph * 40;
        ctx.save(); ctx.globalAlpha = 1 - ph; ctx.translate(sx, sy);
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(9, 2, 0, 8); ctx.quadraticCurveTo(-9, 2, 0, -12);
        ctx.fillStyle = C.aegeanPale; ctx.fill(); ctx.strokeStyle = C.aegean; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    } else if (mood === 'calm' || mood === 'happy') {
      [-ex, ex].forEach((dx, i) => {
        if (mood === 'calm') ink(arcPts(dx, ey - 4, 9, 0.15 * Math.PI, 0.85 * Math.PI, 8), { width: 3.5, seed: 80 + i });
        else ink(arcPts(dx, ey + 4, 9, 1.15 * Math.PI, 1.85 * Math.PI, 8), { width: 3.5, seed: 80 + i });
      });
      ctx.save(); ctx.globalAlpha = 0.35;
      dot(-34, 22, 9, C.pink); dot(34, 22, 9, C.pink);
      ctx.restore();
      if (mood === 'happy') {
        ctx.beginPath(); ctx.moveTo(-18, 24); ctx.quadraticCurveTo(0, 50, 18, 24); ctx.closePath();
        ctx.fillStyle = C.ink; ctx.fill();
      } else ink(arcPts(0, 16, 16, 0.2 * Math.PI, 0.8 * Math.PI, 10), { width: 3.5, seed: 83 });
    } else {
      dot(-ex, ey, 4, C.ink); dot(ex, ey, 4, C.ink);
      ink([[-10, 28], [10, 28]], { width: 3.5, seed: 85 });
    }
    ctx.restore();

    // right arm, holding the phone up
    if (o.phone) {
      const bz = o.buzz || 0, jr = rng(hash(BOIL * 3 + 1, 9));
      ink([[58, 26], [96, 74], [100, 6]], { color: SLEEVE, width: 22, seed: 66, jitter: 0.5 });
      ctx.save(); ctx.translate(104 + (jr() - 0.5) * 9 * bz, -28 + (jr() - 0.5) * 9 * bz); ctx.rotate(0.14);
      piece('host-phone', () => roundPoly(36, 62, 8), C.navy, { rough: 0.8 });
      roundRectPath(-13, -24, 26, 42, 4); ctx.fillStyle = bz > 0.05 ? '#E9F2FF' : '#BFD6F2'; ctx.fill();
      if (bz > 0.05) {
        ink(arcPts(0, 0, 44, -0.5, 0.5, 8), { color: C.pink, width: 3, seed: 67, alpha: bz });
        ink(arcPts(0, 0, 44, Math.PI - 0.5, Math.PI + 0.5, 8), { color: C.pink, width: 3, seed: 68, alpha: bz });
      }
      ctx.restore();
      dot(98, 8, 12, C.skin);
    } else if (!o.coffee) {
      ink([[58, 26], [104, 120]], { color: SLEEVE, width: 22, seed: 66, jitter: 0.5 });
      dot(106, 126, 12, C.skin);
    } else {
      ink([[58, 26], [104, 120]], { color: SLEEVE, width: 22, seed: 66, jitter: 0.5 });
      dot(106, 126, 12, C.skin);
    }

    // a tangle of worry above the head
    if (o.scribble) {
      const r = rng(hash(BOIL, 99)), pts = [];
      let a = 0;
      for (let i = 0; i < 26; i++) { a += 0.9 + r() * 0.6; const rad = 14 + r() * 14; pts.push([-70 + Math.cos(a) * rad * 1.4, -190 + Math.sin(a) * rad]); }
      ink(pts, { width: 2.5, seed: 90, jitter: 0.4 });
    }
    ctx.restore();
  }

  function building(x, y, s, t) {
    if (s <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.save(); ctx.translate(0, -200); piece('bldg', () => rect(220, 400), C.kraft, { rough: 2, edge: C.white }); ctx.restore();
    ctx.save(); ctx.translate(0, -404); piece('roof', () => [[-128, -12], [128, -12], [112, 14], [-112, 14]], C.kraftDark, { rough: 1.6 }); ctx.restore();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
      const k = r * 2 + c, lit = NOTIFS[k] && t > NOTIFS[k].t;
      ctx.save(); ctx.translate(-50 + c * 100, -350 + r * 78);
      piece('win' + k, () => rect(56, 50), lit ? C.yellow : C.navy, { rough: 1, shadow: false });
      ctx.restore();
    }
    ctx.save(); ctx.translate(0, -42); piece('door', () => rect(56, 84), C.aegean, { rough: 1, shadow: false }); ctx.restore();
    ctx.restore();
  }

  function moonAndStars(t) {
    const s = pop(t, 0.4, 0.4);
    if (s <= 0) return;
    ctx.save(); ctx.translate(1180, 92); ctx.scale(s, s);
    piece('moon', () => ellPoly(38, 38), '#FFF3B8', { rough: 1.6 });
    dot(-10, -8, 6, 'rgba(200,170,90,0.35)'); dot(12, 10, 4, 'rgba(200,170,90,0.35)');
    ctx.restore();
    [[1060, 52, 9], [1236, 168, 7], [1004, 120, 6]].forEach(([sx, sy, sr], i) => {
      const tw = 0.75 + 0.25 * Math.sin(t * 5 + i * 2);
      if (t > 0.6 + i * 0.15) star(sx, sy, sr * tw, 140 + i * 2, C.soft);
    });
  }

  function notif(n, i, t) {
    const s = pop(t, n.t, 0.3);
    if (s <= 0) return;
    ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(n.rot + Math.sin(t * 3 + i) * 0.01); ctx.scale(s, s);
    ctx.font = HAND(700, 25);
    const w = Math.round(ctx.measureText(n.text).width + 76), h = 60;
    piece('nf' + i, () => roundPoly(w, h, 16), C.white, { rough: 1.3, shadowA: 0.22 });
    piece('nft' + i, () => [[-w / 2 + 26, h / 2 - 6], [-w / 2 + 52, h / 2 - 6], [-w / 2 + 20, h / 2 + 20]], C.white, { rough: 0.6, shadow: false });
    dot(-w / 2 + 29, 0, 11, C[n.c]);
    ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(n.text, -w / 2 + 52, 3);
    if (i % 3 === 0) tape(w / 2 - 16, -h / 2 + 2, 56, 0.5, i + 3);
    ctx.restore();
  }
  function buzzAt(t) {
    let b = 0;
    for (const n of NOTIFS) { const d = t - n.t; if (d >= 0 && d < 0.35) b = Math.max(b, 1 - d / 0.35); }
    return b;
  }

  function sticky(key, label, w, h, color, size) {
    piece(key, () => rect(w, h), color, { rough: 0.9, shadowA: 0.17 });
    ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, 16);
    ctx.font = HAND(700, size); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrapLines(label, w - 30), lh = size * 1.15;
    lines.forEach((l, i) => ctx.fillText(l, 0, 8 + (i - (lines.length - 1) / 2) * lh));
  }

  function logo(x, y, s, o = {}) {
    if (s <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); if (o.rot) ctx.rotate(o.rot);
    ctx.font = SANS(700, 96);
    const ww = ctx.measureText('Flixbnb').width, total = 116 + 26 + ww, x0 = -total / 2;
    ctx.save(); ctx.translate(x0 + 58, 0);
    piece('logo-mark', () => roundPoly(116, 116, 28), C.aegean, { rough: 1, edge: C.white, shadowA: 0.35 });
    ctx.fillStyle = C.white; ctx.font = SANS(800, 76); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('F', 2, 5);
    ctx.restore();
    ctx.fillStyle = o.color || C.white; ctx.font = SANS(700, 96); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Flixbnb', x0 + 142, 8);
    ctx.restore();
  }

  function iconGuests() {
    ink(roundPoly(64, 46, 8, 3), { closed: true, width: 3.5, seed: 201 });
    ink(arcPts(0, -23, 13, Math.PI, Math.PI * 2, 8), { width: 3.5, seed: 202 });
    ink([[-14, -21], [-14, 21]], { width: 3, seed: 203 });
    ink([[14, -21], [14, 21]], { width: 3, seed: 204 });
    ink(ellPts(-20, 30, 4, 4, 205, 0.05, 10), { width: 2.5, seed: 206 });
    ink(ellPts(20, 30, 4, 4, 207, 0.05, 10), { width: 2.5, seed: 208 });
  }
  function iconTeam() {
    ink(ellPts(-16, -14, 12, 12, 211, 0.08, 18), { width: 3.5, seed: 212 });
    ink(arcPts(-16, 30, 24, Math.PI * 1.05, Math.PI * 1.95, 10), { width: 3.5, seed: 213 });
    ink(ellPts(20, -8, 10, 10, 214, 0.08, 18), { width: 3.5, seed: 215 });
    ink(arcPts(20, 30, 19, Math.PI * 1.05, Math.PI * 1.95, 10), { width: 3.5, seed: 216 });
  }
  function iconPMS() {
    ink(rect(66, 58).map(([px, py]) => [px, py + 4]), { closed: true, width: 3.5, seed: 221 });
    ink([[-33, -12], [33, -12]], { width: 3, seed: 222 });
    ink([[-16, -32], [-16, -18]], { width: 3.5, seed: 223 });
    ink([[16, -32], [16, -18]], { width: 3.5, seed: 224 });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) dot(-18 + c * 18, 6 + r * 14, 2.6, C.ink);
    ink([[6, 16], [12, 22], [24, 6]], { color: C.green, width: 3.5, seed: 225 });
  }

  function sun(x, y, s, t) {
    if (s <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.save(); ctx.rotate(t * 0.3);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ink([[Math.cos(a) * 66, Math.sin(a) * 66], [Math.cos(a) * 92, Math.sin(a) * 92]], { color: C.orange, width: 5, seed: 300 + i });
    }
    ctx.restore();
    piece('sun', () => ellPoly(54, 54), C.yellow, { rough: 2 });
    ink(arcPts(-17, -4, 7, 0.15 * Math.PI, 0.85 * Math.PI, 6), { width: 3, seed: 311 });
    ink(arcPts(17, -4, 7, 0.15 * Math.PI, 0.85 * Math.PI, 6), { width: 3, seed: 312 });
    ink(arcPts(0, 8, 14, 0.2 * Math.PI, 0.8 * Math.PI, 8), { width: 3, seed: 313 });
    ctx.restore();
  }

  const CONFETTI = (function () {
    const r = rng(808), colors = [C.pink, C.aegean, C.greenLight, C.yellow, C.orange, C.white];
    return Array.from({ length: 70 }, () => ({ a: -Math.PI * (0.1 + r() * 0.8) + (r() - 0.5) * 1.2, v: 320 + r() * 560, spin: (r() - 0.5) * 14, w: 8 + r() * 12, h: 5 + r() * 8, c: colors[Math.floor(r() * colors.length)] }));
  })();
  function confetti(t, t0, x0, y0) {
    const dt = t - t0;
    if (dt < 0 || dt > 3.2) return;
    const k = 2.2, d = (1 - Math.exp(-k * dt)) / k;
    CONFETTI.forEach(p => {
      ctx.save();
      ctx.globalAlpha = clamp(1.8 - dt * 0.6);
      ctx.translate(x0 + Math.cos(p.a) * p.v * d, y0 + Math.sin(p.a) * p.v * d + 240 * dt * dt);
      ctx.rotate(p.spin * dt);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
  }

  /* ───────────── Scene 1 + 2: the chaos, then 150+ sticky notes ───────────── */
  function drawChaos(t) {
    ctx.drawImage(PAPER, 0, 0, W, H);
    moonAndStars(t);
    building(175, 735, pop(t, 0.5, 0.4), t);
    host(640, 470, pop(t, 0.8, 0.4), t > 3 ? 'stressed' : 'neutral', t, { phone: true, buzz: buzzAt(t), scribble: t > 4.6 });
    NOTIFS.forEach((n, i) => notif(n, i, t));

    // captions on torn paper strips
    const out1 = P(t, 5.2, 0.25);
    if (out1 < 1) {
      ctx.save(); ctx.globalAlpha = 1 - out1;
      caption('cap1', 'Running short-term rentals?', 640, 96, 52, C.ink, C.white, 0.2, t);
      ctx.restore();
    }
    if (t > 5.35) caption('cap2', '3am. Again.', 640, 96, 60, C.pink, C.white, 5.35, t);

    if (t >= NOTES[0].t - 0.05) drawNotes(t);
  }
  function caption(key, text, cx, cy, size, color, bg, t0, t) {
    const s = pop(t, t0, 0.3);
    if (s <= 0) return;
    ctx.font = HAND(700, size);
    const w = ctx.measureText(text).width + 64, h = size * 1.5;
    ctx.save(); ctx.translate(cx, cy - size * 0.32); ctx.rotate(-0.015); ctx.scale(s, s);
    piece(key, () => rect(w, h), bg, { rough: 2.4, shadowA: 0.18 });
    tape(-w / 2 + 6, -h / 2 + 8, 70, -0.6, 7);
    ctx.restore();
    hand(text, cx, cy, size, color, { align: 'center', p: easeOut(P(t, t0 + 0.12, 0.25 + text.length * 0.025)) });
  }
  function drawNotes(t) {
    NOTES.forEach((n, i) => {
      if (t < n.t) return;
      const p = clamp((t - n.t) / 0.28), s = lerp(1.35, 1, easeOutBack(p));
      ctx.save(); ctx.globalAlpha = clamp(p * 3);
      ctx.translate(n.x, n.y - (1 - easeOut(p)) * 40); ctx.rotate(n.rot + (1 - p) * 0.3); ctx.scale(s, s);
      sticky('sn' + i, n.label, 146, 128, n.color, 22);
      ctx.restore();
    });
    const sp = pop(t, 9.3, 0.35);
    if (sp > 0) {
      ctx.save(); ctx.translate(640, 362); ctx.rotate(-0.02); ctx.scale(sp, sp);
      piece('panel150', () => rect(640, 330), C.white, { rough: 2.4, shadowA: 0.3 });
      tape(-300, -150, 90, -0.7, 21); tape(300, -150, 90, 0.7, 22);
      ctx.restore();
      ransom('150+', 640, 322, 150, T.hundred, t, 99);
      hand('situations every rental runs into.', 640, 462, 40, C.ink, { align: 'center', p: easeOut(P(t, 10.4, 0.9)) });
    }
  }

  /* ───────────── Scene 3: meet Flixbnb ───────────── */
  const NODES = [
    { label: 'Guests', x: 250, y: 300, icon: iconGuests },
    { label: 'Your team', x: 1030, y: 300, icon: iconTeam },
    { label: 'Your PMS', x: 640, y: 596, icon: iconPMS }
  ];
  function drawMeet(t) {
    ctx.drawImage(NAVY, 0, 0, W, H);
    [[120, 90], [1180, 610], [1110, 70], [90, 640], [520, 40]].forEach(([sx, sy], i) => {
      if (t > 13.3 + i * 0.1) star(sx, sy, 6 + 2 * Math.sin(t * 4 + i), 160 + i * 2, 'rgba(255,255,255,0.35)');
    });

    const fall = P(t, T.stamp - 0.25, 0.25);
    const move = easeInOut(P(t, 14.8, 0.7));
    const lx = 640, ly = lerp(330, 380, move), ls = lerp(1, 0.6, move);
    if (fall > 0) {
      ctx.save(); ctx.globalAlpha = 1 - move;
      splats(640, 330, t, T.stamp, 31, 'rgba(255,255,255,0.5)', 18, 290);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(fall * 4);
      logo(lx, ly, ls * (fall < 1 ? lerp(2.4, 1, easeIn(fall)) : 1));
      ctx.restore();
    }
    const tagOut = P(t, 14.6, 0.3);
    if (t > 13.4 && tagOut < 1) {
      ctx.save(); ctx.globalAlpha = 1 - tagOut;
      hand('the AI operations manager for short-term rentals', 640, 470, 38, C.white, { align: 'center', p: easeOut(P(t, 13.4, 1.1)) });
      ctx.restore();
    }

    NODES.forEach((n, i) => {
      const t0 = T.circles[i], dx = n.x - lx, dy = n.y - ly, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const start = 1 / Math.sqrt((ux / 152) ** 2 + (uy / 46) ** 2);
      const a = [lx + ux * start, ly + uy * start], b = [n.x - ux * 98, n.y - uy * 98];
      ink([a, b], { color: 'rgba(255,255,255,0.8)', width: 3, seed: 230 + i, p: easeOut(P(t, t0 + 0.1, 0.5)) });
      if (t > 16.8) {
        ctx.save(); ctx.globalAlpha = clamp((t - 16.8) * 2);
        for (let k = 0; k < 2; k++) {
          const u = (t * 0.55 + k * 0.5 + i * 0.17) % 1, q = k ? u : 1 - u;
          dot(lerp(a[0], b[0], q), lerp(a[1], b[1], q), 7, C.greenLight);
          dot(lerp(a[0], b[0], q), lerp(a[1], b[1], q), 3, C.white);
        }
        ctx.restore();
      }
    });
    NODES.forEach((n, i) => {
      const s = pop(t, T.circles[i], 0.4);
      if (s <= 0) return;
      ctx.save(); ctx.translate(n.x, n.y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.6 + i) * 0.02);
      piece('node' + i, () => ellPoly(90, 90), C.white, { rough: 2.2, shadowA: 0.35 });
      ctx.save(); ctx.translate(0, -18); n.icon(); ctx.restore();
      ctx.restore();
      hand(n.label, n.x, n.y + 58, 26, C.ink, { align: 'center', p: s > 0.9 ? 1 : 0 });
    });
    hand('Connected to your guests, your team and your PMS.', 640, 96, 40, C.white, { align: 'center', p: easeOut(P(t, 16.4, 1.3)) });
  }

  /* ───────────── Scene 4: it already knows (the legal pad) ───────────── */
  function knowsContent(t) {
    ['It already', 'knows what', 'to do.'].forEach((s, i) => hand(s, 84, 250 + i * 82, 72, C.ink, { p: easeOut(P(t, 19.8 + i * 0.45, 0.5)) }));
    ink([[84, 432], [150, 428], [220, 433], [290, 427]], { color: C.green, width: 7, seed: 240, p: easeOut(P(t, 21.3, 0.4)) });
    const arrow = P(t, 21.6, 0.4);
    ink([[300, 520], [380, 540], [470, 490]], { width: 4, seed: 241, p: easeOut(arrow) });
    if (arrow >= 1) ink([[448, 482], [472, 488], [462, 512]], { width: 4, seed: 242 });
    padDraw(lerp(1500, 860, easeOutBack(P(t, 19.5, 0.65))), 372, t);
  }
  function padDraw(cx, cy, t) {
    const w = 600, h = 580, top = -h / 2, left = -w / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.03);
    piece('pad', () => rect(w, h), C.yellow, { rough: 1.2, shadowA: 0.25 });
    ctx.save(); ctx.translate(0, top + 14); piece('padtop', () => rect(w + 4, 30), C.yellowDark, { rough: 1, shadow: false }); ctx.restore();
    ctx.strokeStyle = 'rgba(58,116,196,0.32)'; ctx.lineWidth = 1.4;
    for (let y = top + 124; y < h / 2 - 14; y += 68) { ctx.beginPath(); ctx.moveTo(left + 8, y); ctx.lineTo(-left - 8, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(212,70,70,0.6)'; ctx.lineWidth = 1.6;
    [left + 74, left + 79].forEach(x => { ctx.beginPath(); ctx.moveTo(x, top + 30); ctx.lineTo(x, h / 2 - 4); ctx.stroke(); });

    ITEMS.forEach((s, i) => {
      const y = top + 110 + i * 68, t0 = T.items[i], yours = i === 5;
      ink(rect(26, 26).map(([px, py]) => [px + left + 37, py + y - 11]), { closed: true, color: yours ? C.pink : C.ink, width: 2.6, seed: 400 + i, p: easeOut(P(t, t0 - 0.15, 0.25)) });
      hand(s, left + 98, y, 34, C.ink, { weight: yours ? 700 : 400, p: easeOut(P(t, t0, 0.35)) });
      if (!yours) {
        const tk = T.ticks[i];
        ink([[left + 27, y - 14], [left + 37, y - 1], [left + 62, y - 40]], { color: C.green, width: 5, seed: 410 + i, jitter: 0.6, p: easeOut(P(t, tk, 0.18)) });
        const hp = pop(t, tk + 0.15, 0.3);
        if (hp > 0) {
          ctx.save(); ctx.translate(-left - 86, y - 12); ctx.rotate(-0.07); ctx.scale(hp, hp);
          piece('hd' + i, () => roundPoly(128, 38, 18), C.greenPale, { rough: 0.8, shadowA: 0.12 });
          ctx.font = SANS(700, 19); ctx.fillStyle = C.green; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('Handled', 10, 1);
          ink([[-50, 0], [-45, 6], [-35, -6]], { color: C.green, width: 3, seed: 420 + i });
          ctx.restore();
        }
      } else {
        ctx.font = HAND(700, 34);
        const tw = ctx.measureText(s).width;
        ink(ellPts(left + 98 + tw / 2, y - 12, tw / 2 + 24, 30, 433, 0.15), { color: C.pink, width: 3.5, seed: 434, p: easeOut(P(t, T.call, 0.45)) });
        const cp = pop(t, T.call + 0.4, 0.3);
        if (cp > 0) {
          ctx.save(); ctx.translate(-left - 86, y + 40); ctx.rotate(-0.05); ctx.scale(cp, cp);
          piece('yourcall', () => roundPoly(132, 40, 19), C.pink, { rough: 0.8, shadowA: 0.18 });
          ctx.font = SANS(700, 19); ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('Your call', 0, 1);
          ctx.restore();
        }
        hand('Pay or dispute?', left + 98, y + 50, 32, C.pink, { p: easeOut(P(t, T.call + 0.55, 0.55)) });
      }
    });
    ctx.restore();
  }

  /* ───────────── Scene 5: it asks in chat ───────────── */
  let chatLayout = null;
  function layoutChat() {
    let y = -206;
    return MSGS.map(m => {
      if (m.who === 'gap') { const r = Object.assign({}, m, { y, h: 26 }); y += 38; return r; }
      ctx.font = SANS(500, 17);
      const lines = wrapLines(m.text, 206);
      const w = Math.max(96, Math.max.apply(null, lines.map(l => ctx.measureText(l).width)) + 28 + (m.tick ? 26 : 0));
      const h = 34 + lines.length * 22 + 6;
      const r = Object.assign({}, m, { lines, y, w, h });
      y += h + 12;
      return r;
    });
  }
  function phoneDraw(cx, cy, t) {
    const w = 330, h = 620, sw = w - 26, sh = h - 26;
    if (!chatLayout) chatLayout = layoutChat();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.035 + Math.sin(t * 1.3) * 0.004);
    piece('phone', () => roundPoly(w, h, 46), C.navy, { rough: 1.1, shadowA: 0.3, edge: C.white });
    const screen = shapeOf('screen', () => roundPoly(sw, sh, 34), 0.6, 12);
    ctx.save();
    poly(screen); ctx.fillStyle = '#F2F5F9'; ctx.fill(); ctx.clip();
    ctx.fillStyle = C.white; ctx.fillRect(-sw / 2, -sh / 2, sw, 74);
    ctx.fillStyle = 'rgba(16,24,40,0.1)'; ctx.fillRect(-sw / 2, -sh / 2 + 74, sw, 1);
    dot(-112, -sh / 2 + 40, 17, C.aegean);
    ctx.font = SANS(800, 17); ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('F', -111, -sh / 2 + 41);
    ctx.font = SANS(700, 19); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText('Flixbnb', -86, -sh / 2 + 41);

    chatLayout.forEach(m => {
      if (m.who === 'gap') {
        if (t >= m.t) {
          ctx.save(); ctx.globalAlpha = clamp((t - m.t) * 4);
          ctx.font = SANS(600, 13); ctx.fillStyle = C.soft; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.text, 0, m.y + 13);
          ctx.restore();
        }
        return;
      }
      const s = easeOutBack(P(t, m.t, 0.3));
      if (s <= 0) return;
      const bot = m.who === 'bot', x = bot ? -140 : 140 - m.w;
      ctx.save(); ctx.translate(bot ? x : x + m.w, m.y); ctx.scale(s, s); ctx.translate(bot ? 0 : -m.w, 0);
      roundRectPath(0, 0, m.w, m.h, 14); ctx.fillStyle = bot ? C.white : C.aegean; ctx.fill();
      if (bot) { ctx.strokeStyle = 'rgba(16,24,40,0.1)'; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = SANS(700, 12.5); ctx.fillStyle = bot ? C.aegean : 'rgba(255,255,255,0.8)';
      ctx.fillText(bot ? 'Flixbnb' : 'Your team', 14, 20);
      ctx.font = SANS(500, 17); ctx.fillStyle = bot ? C.ink : C.white;
      m.lines.forEach((l, i) => ctx.fillText(l, 14, 42 + i * 22));
      if (m.tick) {
        const lw = ctx.measureText(m.lines[m.lines.length - 1]).width, ty = 42 + (m.lines.length - 1) * 22;
        ink([[lw + 22, ty - 6], [lw + 28, ty], [lw + 40, ty - 14]], { color: C.green, width: 3, seed: 501 });
      }
      ctx.restore();
    });
    T.typing.forEach(([a, b, k]) => {
      if (t < a || t >= b) return;
      const m = chatLayout[k];
      roundRectPath(-140, m.y, 66, 38, 14); ctx.fillStyle = C.white; ctx.fill();
      ctx.strokeStyle = 'rgba(16,24,40,0.1)'; ctx.stroke();
      for (let d = 0; d < 3; d++) dot(-122 + d * 15, m.y + 19 - Math.max(0, Math.sin(t * 9 - d * 0.8)) * 4, 4, C.soft);
    });
    ctx.restore();
    ctx.restore();
  }
  function drawChat(t) {
    ctx.drawImage(PAPER, 0, 0, W, H);
    if (t < 30.7) {
      const e = easeIn(P(t, 30, 0.6));
      ctx.save(); ctx.translate(-e * 1300, e * 80); ctx.rotate(-e * 0.12); knowsContent(t); ctx.restore();
    }
    const ex = easeIn(P(t, 39.6, 0.5));
    ctx.save(); ctx.translate(ex * 900, 0);
    phoneDraw(lerp(1500, 900, easeOutBack(P(t, 30.3, 0.6))), 372, t);
    if (t > 37.6) [[700, 150], [1120, 200], [1130, 560]].forEach(([sx, sy], i) => {
      const s = pop(t, 37.6 + i * 0.12, 0.3);
      ctx.save(); ctx.translate(sx, sy); ctx.scale(s, s); star(0, 0, 12, 520 + i * 2, C.green); ctx.restore();
    });
    ctx.restore();
    ctx.save(); ctx.translate(-ex * 900, 0);
    ['It only asks', 'what only you', 'know.'].forEach((s, i) => hand(s, 84, 250 + i * 82, 68, C.ink, { p: easeOut(P(t, 30.9 + i * 0.45, 0.5)) }));
    ink([[84, 430], [150, 426], [214, 431]], { color: C.pink, width: 7, seed: 530, p: easeOut(P(t, 32.3, 0.35)) });
    hand('Right in WhatsApp or Telegram.', 86, 504, 34, C.soft, { weight: 400, p: easeOut(P(t, 32.6, 0.8)) });
    ctx.restore();
  }

  /* ───────────── Scene 6: your team, 100X better ───────────── */
  function drawTeam(t) {
    ctx.drawImage(PAPER, 0, 0, W, H);
    sun(1160, 112, pop(t, 40.4, 0.4), t);
    const hin = easeOutBack(P(t, 40.1, 0.55));
    host(270, 470 + (1 - hin) * 420, 0.95, t > T.hit - 0.2 ? 'happy' : 'calm', t, { coffee: true });
    [['10x less time', 560, 168, -0.08, C.yellow], ['10x better quality', 1000, 186, 0.07, C.greenPale]].forEach(([label, x, y, rot, color], i) => {
      const s = pop(t, T.tenx[i], 0.35);
      if (s <= 0) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
      sticky('tenx' + i, label, 230, 150, color, 34);
      tape(0, -72, 80, 0.06 * (i ? -1 : 1), 30 + i);
      ctx.restore();
    });
    hand('Your team gets', 790, 330, 56, C.ink, { align: 'center', p: easeOut(P(t, T.yourTeam, 0.6)) });
    ransom('100X', 790, 456, 130, T.hundredX, t, 7);
    confetti(t, T.hit + 0.05, 790, 456);
    hand('better.', 790, 612, 72, C.ink, { align: 'center', p: easeOut(P(t, T.better, 0.45)) });
    ink([[700, 632], [770, 628], [840, 634], [880, 629]], { color: C.green, width: 7, seed: 610, p: easeOut(P(t, T.better + 0.45, 0.35)) });
  }

  /* ───────────── Scene 7: the end card ───────────── */
  function strip(text, x, y, t, t0, i) {
    const s = P(t, t0, 0.35);
    if (s <= 0) return;
    const e = easeOutBack(s);
    ctx.font = SANS(700, 42);
    const w = ctx.measureText(text).width + 60;
    ctx.save(); ctx.translate(lerp(x - 700, x, e) + w / 2, y); ctx.rotate([-0.025, 0.02, -0.015][i] + (1 - e) * 0.2);
    piece('strip' + i, () => rect(w, 72), C.white, { rough: 2.2, shadowA: 0.35 });
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 3);
    ctx.restore();
  }
  function handledStamp(cx, cy, t, t0) {
    const f = P(t, t0 - 0.18, 0.18);
    if (f <= 0) return;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.08); ctx.scale(f < 1 ? lerp(2.2, 1, easeIn(f)) : 1, f < 1 ? lerp(2.2, 1, easeIn(f)) : 1);
    ctx.globalAlpha = clamp(f * 3);
    ctx.font = SANS(800, 124); ctx.fillStyle = C.greenLight; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText('Handled.').width;
    ctx.fillText('Handled.', 0, 8);
    ink(rect(tw + 64, 172), { closed: true, color: C.greenLight, width: 7, seed: 701, jitter: 2 });
    const r = rng(702);
    for (let i = 0; i < 60; i++) dot((r() - 0.5) * (tw + 40), (r() - 0.5) * 150, 1 + r() * 2.6, 'rgba(15,35,66,0.55)');
    ctx.restore();
    if (f >= 1) splats(cx, cy, t, t0, 703, 'rgba(127,221,164,0.55)', 14, 300);
  }
  function drawEnd(t) {
    ctx.drawImage(NAVY, 0, 0, W, H);
    ['Lockbox empty.', 'Refund threat.', 'Extra night request.'].forEach((s, i) => strip(s, 110, 178 + i * 90, t, T.strips[i], i));
    handledStamp(395, 520, t, T.handled);
    logo(930, 300, 0.62 * pop(t, T.logo, 0.4));
    if (t > T.logo + 0.2) hand('flixbnb.com', 930, 420, 46, C.white, { align: 'center', p: easeOut(P(t, T.logo + 0.2, 0.6)) });
    const bp = pop(t, T.button, 0.35);
    if (bp > 0) {
      ctx.save(); ctx.translate(930, 508); ctx.rotate(-0.02); ctx.scale(bp, bp);
      piece('btn', () => roundPoly(330, 72, 14), C.white, { rough: 1, shadowA: 0.35 });
      ctx.font = SANS(700, 28); ctx.fillStyle = C.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Start onboarding', 0, 2);
      ctx.restore();
    }
    ink(ellPts(930, 508, 210, 62, 51, 0.15), { color: C.greenLight, width: 4, seed: 52, p: easeOut(P(t, T.circle, 0.5)) });
  }

  /* ───────────── Transitions ───────────── */
  // The chaos rips in two and flies apart, revealing the navy paper underneath
  const TEAR = (function () {
    const r = rng(77), pts = [];
    for (let y = -30; y <= H + 30; y += 22) pts.push([lerp(W * 0.57, W * 0.45, (y + 30) / (H + 60)) + (r() - 0.5) * 36, y]);
    return pts;
  })();
  function ripLayer(t, drawOld) {
    const e = easeIn(P(t, T.rip, 0.85));
    [[-1, [[-60, -60]].concat(TEAR, [[-60, H + 60]])], [1, [[W + 60, -60]].concat(TEAR, [[W + 60, H + 60]])]].forEach(([dir, shape]) => {
      ctx.save();
      ctx.translate(dir * e * 950, (dir < 0 ? 170 : -110) * e);
      ctx.translate(W / 2, H / 2); ctx.rotate(dir * e * 0.24); ctx.translate(-W / 2, -H / 2);
      ctx.save(); ctx.translate(10, 14); poly(shape); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
      poly(shape); ctx.clip();
      drawOld();
      ink(TEAR, { color: '#FDFBF6', width: 9, seed: 78, jitter: 2.5 });
      ctx.restore();
    });
  }
  function tornEdgeSheet(seed, bottom) {
    return memo('sheet' + seed, () => {
      const r = rng(seed), pts = [];
      if (!bottom) {
        for (let x = -30; x <= W + 30; x += 20) pts.push([x, (r() - 0.5) * 14]);
        pts.push([W + 30, H + 60], [-30, H + 60]);
      } else {
        pts.push([-30, -60], [W + 30, -60]);
        for (let x = W + 30; x >= -30; x -= 20) pts.push([x, H + (r() - 0.5) * 14]);
      }
      return pts;
    });
  }
  // A new sheet of paper slides over the old scene (up from the bottom, or down from the top)
  function cover(t, start, dur, fromTop, drawUnder, drawOver) {
    const e = easeOut(P(t, start, dur));
    if (e < 1) drawUnder();
    const sheet = tornEdgeSheet(fromTop ? 902 : 901, fromTop);
    ctx.save(); ctx.translate(0, fromTop ? -(H + 40) * (1 - e) : (H + 40) * (1 - e));
    ctx.save(); ctx.translate(0, fromTop ? 12 : -12); poly(sheet); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
    poly(sheet); ctx.clip();
    drawOver();
    ctx.restore();
  }

  /* ───────────── Rendering a frame ───────────── */
  let scale = 1, offX = 0, offY = 0;
  function fit() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(r.width * dpr)), ch = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    scale = Math.min(cw / W, ch / H); offX = (cw - W * scale) / 2; offY = (ch - H * scale) / 2;
  }
  function shakeAt(t) {
    for (const s of SHAKES) {
      const d = t - s;
      if (d >= 0 && d < 0.35) { const a = 9 * (1 - d / 0.35), r = rng(hash(Math.floor(t * 60), 5)); return [(r() - 0.5) * 2 * a, (r() - 0.5) * 2 * a]; }
    }
    return [0, 0];
  }
  function render(t) {
    t = clamp(t, 0, DUR);
    BOIL = Math.floor(t * 8);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = (t >= T.rip && t < T.cover1 + 0.4) || t >= T.cover2 + 0.4 ? C.navy : C.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    const sh = shakeAt(t);
    ctx.translate(sh[0], sh[1]);

    if (t < T.rip) drawChaos(t);
    else if (t < T.rip + 0.9) { drawMeet(t); ripLayer(t, () => drawChaos(t)); }
    else if (t < T.cover1) drawMeet(t);
    else if (t < T.cover1 + 0.75) cover(t, T.cover1, 0.75, false, () => drawMeet(t), () => { ctx.drawImage(PAPER, 0, 0, W, H); knowsContent(t); });
    else if (t < 30) { ctx.drawImage(PAPER, 0, 0, W, H); knowsContent(t); }
    else if (t < 40.1) drawChat(t);
    else if (t < T.cover2) drawTeam(t);
    else if (t < T.cover2 + 0.6) cover(t, T.cover2, 0.6, true, () => drawTeam(t), () => drawEnd(t));
    else drawEnd(t);

    // a whisper of film grain over everything
    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    ctx.save(); ctx.globalAlpha = 0.45;
    const g = rng(BOIL + 3);
    ctx.translate(-g() * 160, -g() * 160);
    ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 160, H + 160);
    ctx.restore();
  }

  /* ───────────── The soundtrack ───────────── */
  // The score is one function that walks the whole film. Every note checks whether it falls inside the
  // slice of song time being scheduled right now, so only the next fraction of a second ever exists as
  // audio nodes. Pausing or seeking simply throws the session away and starts a fresh one.
  let A = null, R = null;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const inWin = t => t >= A.winA && t < A.winB;
  const at = t => A.ctxStart + (t - A.songStart);
  const pluckCaches = new WeakMap();

  function newSession(ac, dest, songStart, ctxStart) {
    const s = { ac, songStart, ctxStart, winA: songStart, winB: songStart };
    const map = t => ctxStart + (t - songStart);
    const out = ac.createGain();
    out.gain.value = 0.8;
    if (songStart < DUR) { out.gain.setValueAtTime(0.8, map(Math.max(50.6, songStart))); out.gain.linearRampToValueAtTime(0.0001, map(DUR + 0.4)); }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18;
    const limit = ac.createDynamicsCompressor();
    limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.1;
    out.connect(comp); comp.connect(limit); limit.connect(dest);
    s.tail = limit;

    const sr = ac.sampleRate, r = rng(4243);
    const verb = ac.createConvolver();
    const ir = ac.createBuffer(2, Math.floor(sr * 1.8), sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    verb.buffer = ir;
    const verbOut = ac.createGain(); verbOut.gain.value = 0.22;
    verb.connect(verbOut); verbOut.connect(out);
    function bus(gain, wet, pan) {
      const g = ac.createGain(); g.gain.value = gain;
      let node = g;
      if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
      node.connect(out);
      if (wet) { const w = ac.createGain(); w.gain.value = wet; node.connect(w); w.connect(verb); }
      return g;
    }
    Object.assign(s, {
      chaos: bus(0.8, 0.15, 0), bassBus: bus(0.75, 0.04, 0), mel: bus(0.55, 0.25, 0.15), strumBus: bus(0.5, 0.2, -0.2),
      drums: bus(0.7, 0.06, 0), padBus: bus(0.6, 0.3, 0), sfx: bus(0.9, 0.18, 0), dry: bus(0.9, 0.04, 0)
    });
    s.noiseBuf = ac.createBuffer(1, sr * 2, sr);
    const nd = s.noiseBuf.getChannelData(0), nr = rng(77);
    for (let i = 0; i < nd.length; i++) nd[i] = nr() * 2 - 1;
    if (!pluckCaches.has(ac)) pluckCaches.set(ac, new Map());
    s.plucks = pluckCaches.get(ac);
    return s;
  }

  /* Instruments: each one takes song time, and does nothing outside the current window */
  function osc(dest, type, freq, t, dur, peak, o = {}) {
    if (!inWin(t) || freq > A.ac.sampleRate / 2 - 200) return;
    const ac = A.ac, w = at(t), a = o.a || 0.005, n = ac.createOscillator();
    n.type = type; n.frequency.setValueAtTime(freq, w);
    if (o.glide) n.frequency.exponentialRampToValueAtTime(o.glide, w + (o.glideT || dur));
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, w); g.gain.exponentialRampToValueAtTime(peak, w + a); g.gain.exponentialRampToValueAtTime(0.0001, w + a + dur);
    let node = n;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; n.connect(f); node = f; }
    node.connect(g); g.connect(dest);
    n.start(w); n.stop(w + a + dur + 0.05);
  }
  function noise(dest, t, d, o = {}) {
    if (!inWin(t)) return;
    const ac = A.ac, w = at(t), s = ac.createBufferSource();
    s.buffer = A.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f || 7000, w);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, w + d);
    f.Q.value = o.q || 0.8;
    const a = o.a || 0.002, g = ac.createGain();
    g.gain.setValueAtTime(0.0001, w); g.gain.exponentialRampToValueAtTime(o.v || 0.1, w + a); g.gain.exponentialRampToValueAtTime(0.0001, w + a + d);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(w, (t * 7.31) % 1.4); s.stop(w + a + d + 0.05);
  }
  // A plucked string (Karplus-Strong), cached per note
  function pluckBuf(m) {
    const cache = A.plucks;
    if (cache.has(m)) return cache.get(m);
    const sr = A.ac.sampleRate, N = Math.max(2, Math.round(sr / mtof(m))), len = Math.floor(sr * 1.6);
    const b = A.ac.createBuffer(1, len, sr), d = b.getChannelData(0), r = rng(m * 131 + 7);
    let prev = 0;
    for (let i = 0; i < N; i++) { prev = prev * 0.5 + (r() * 2 - 1) * 0.5; d[i] = prev; }
    for (let i = N; i < len; i++) d[i] = 0.4985 * (d[i - N] + d[i - N + 1]);
    cache.set(m, b);
    return b;
  }
  function pluck(dest, t, m, v = 0.3, d = 0.6) {
    if (!inWin(t)) return;
    const ac = A.ac, w = at(t), s = ac.createBufferSource();
    s.buffer = pluckBuf(m);
    const g = ac.createGain(); g.gain.setValueAtTime(v, w); g.gain.setTargetAtTime(0, w + d, 0.05);
    s.connect(g); g.connect(dest); s.start(w); s.stop(w + d + 0.4);
  }
  function pad(dest, t, ms, d, v = 0.15) {
    if (!inWin(t)) return;
    const ac = A.ac, w = at(t);
    ms.forEach(m => [-7, 7].forEach(det => {
      const n = ac.createOscillator(); n.type = 'sawtooth'; n.frequency.value = mtof(m); n.detune.value = det;
      const f = ac.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(500, w); f.frequency.linearRampToValueAtTime(2200, w + d * 0.4); f.frequency.linearRampToValueAtTime(900, w + d);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, w); g.gain.linearRampToValueAtTime(v / ms.length, w + Math.min(0.6, d * 0.3)); g.gain.setTargetAtTime(0.0001, w + d * 0.6, d * 0.15);
      n.connect(f); f.connect(g); g.connect(dest); n.start(w); n.stop(w + d + 1.5);
    }));
  }
  function buzz(dest, t, d = 0.3, v = 0.06) {
    if (!inWin(t)) return;
    const ac = A.ac, w = at(t), n = ac.createOscillator();
    n.type = 'square'; n.frequency.value = 170;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const am = ac.createGain(); am.gain.value = 0.5;
    const lfo = ac.createOscillator(); lfo.frequency.value = 28;
    const lfoG = ac.createGain(); lfoG.gain.value = 0.5; lfo.connect(lfoG); lfoG.connect(am.gain);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, w); g.gain.exponentialRampToValueAtTime(v, w + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, w + d);
    n.connect(f); f.connect(am); am.connect(g); g.connect(dest);
    n.start(w); lfo.start(w); n.stop(w + d + 0.05); lfo.stop(w + d + 0.05);
  }
  function riser(dest, t, d) {
    if (!inWin(t)) return;
    const ac = A.ac, w = at(t), n = ac.createOscillator();
    n.type = 'sawtooth'; n.frequency.setValueAtTime(110, w); n.frequency.exponentialRampToValueAtTime(660, w + d);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, w); f.frequency.exponentialRampToValueAtTime(4500, w + d);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, w); g.gain.exponentialRampToValueAtTime(0.06, w + d);
    n.connect(f); f.connect(g); g.connect(dest); n.start(w); n.stop(w + d + 0.02);
  }
  const marimba = (dest, t, m, v = 0.3, d = 0.55) => { const f = mtof(m); osc(dest, 'sine', f, t, d, v); osc(dest, 'sine', f * 4, t, d * 0.25, v * 0.22); osc(dest, 'sine', f * 10.1, t, d * 0.08, v * 0.05); };
  const glock = (dest, t, m, v = 0.18, d = 1.4) => { const f = mtof(m); osc(dest, 'sine', f, t, d, v); osc(dest, 'sine', f * 2.76, t, d * 0.4, v * 0.35); osc(dest, 'sine', f * 5.4, t, d * 0.15, v * 0.12); };
  const bass = (dest, t, m, d = 0.4, v = 0.4) => { osc(dest, 'triangle', mtof(m), t, d, v, { lp: 900, a: 0.008 }); osc(dest, 'sine', mtof(m), t, d * 1.1, v * 0.8, { a: 0.008 }); };
  const strum = (dest, t, ms, v = 0.12, d = 0.3) => ms.forEach((m, i) => pluck(dest, t + i * 0.014, m, v, d));
  const kick = (dest, t, v = 0.7) => { osc(dest, 'sine', 150, t, 0.32, v, { glide: 45, glideT: 0.12, a: 0.002 }); noise(dest, t, 0.02, { type: 'lowpass', f: 2000, v: v * 0.15 }); };
  const hat = (dest, t, v = 0.05) => noise(dest, t, 0.04, { f: 8500, v });
  const shaker = (dest, t, v = 0.05) => noise(dest, t, 0.07, { type: 'bandpass', f: 6000, q: 1.2, v, a: 0.025 });
  const clap = (dest, t, v = 0.18) => { [0, 0.011, 0.022].forEach(dt => noise(dest, t + dt, 0.03, { type: 'bandpass', f: 1600, q: 1.5, v })); noise(dest, t + 0.03, 0.18, { type: 'bandpass', f: 1400, q: 1, v: v * 0.6 }); };
  const wood = (dest, t, f = 1800, v = 0.12) => { osc(dest, 'sine', f, t, 0.06, v, { a: 0.001 }); noise(dest, t, 0.015, { type: 'bandpass', f: f * 1.5, q: 4, v: v * 0.5 }); };
  const ding = (dest, t, m1, m2, v = 0.12) => { glock(dest, t, m1, v, 0.5); glock(dest, t + 0.09, m2, v, 0.7); };
  const whoosh = (dest, t, d = 0.45, v = 0.16, up = true) => noise(dest, t, d, { type: 'bandpass', f: up ? 350 : 3200, f2: up ? 3200 : 300, q: 0.9, v, a: d * 0.45 });
  const popS = (dest, t, f = 520, v = 0.14) => osc(dest, 'sine', f, t, 0.12, v, { glide: f * 1.8, glideT: 0.05, a: 0.002 });
  const tap = (dest, t, v = 0.05) => noise(dest, t, 0.05, { type: 'lowpass', f: 1400, v });
  const stamp = (dest, t, v = 0.9) => { osc(dest, 'sine', 110, t, 0.45, v, { glide: 38, glideT: 0.2, a: 0.002 }); noise(dest, t, 0.12, { type: 'lowpass', f: 900, v: v * 0.5 }); noise(dest, t + 0.001, 0.03, { f: 3000, v: v * 0.2 }); };
  const bloop = (dest, t, v = 0.15) => osc(dest, 'sine', 520, t, 0.16, v, { glide: 1040, glideT: 0.07, a: 0.003 });
  const crash = (dest, t, v = 0.12) => noise(dest, t, 1.6, { f: 5000, v, a: 0.004 });
  function scratch(dest, t, d, v = 0.035) {
    const n = Math.max(1, Math.floor(d / 0.06));
    for (let i = 0; i < n; i++) { const j = R(), f = R(), k = R(); noise(dest, t + i * 0.06 + j * 0.02, 0.05, { type: 'bandpass', f: 3000 + f * 1500, q: 2, v: v * (0.6 + k * 0.6), a: 0.01 }); }
  }
  function rip(dest, t, d = 0.8) {
    let x = t;
    while (x < t + d) { const dd = 0.012 + R() * 0.03, f = R(), v = R(); noise(dest, x, dd, { type: 'bandpass', f: 1800 + f * 2500, q: 0.8, v: 0.08 + v * 0.16 }); x += dd * (0.4 + R() * 0.6); }
    noise(dest, t + 0.001, d, { type: 'bandpass', f: 2500, q: 0.5, v: 0.05, a: d * 0.3 });
  }

  // The whole score, in song time. R is reset on every pass so random details land the same way each time.
  function score() {
    R = rng(4242);
    const { chaos, bassBus, mel, strumBus, drums, padBus, sfx, dry } = A;

    // 1. The chaos (0–11.5s): an anxious little pizzicato in A minor, a ticking clock, rising
    const chaosChords = [[57, 60, 64], [53, 57, 60], [52, 56, 59], [57, 60, 64], [50, 53, 57], [52, 56, 59]];
    for (let bar = 0; bar < 6; bar++) {
      const t0 = bar * 2, ch = chaosChords[bar];
      for (let i = 0; i < 8; i++) { const tt = t0 + i * 0.25; if (tt < T.rip) pluck(chaos, tt, ch[[0, 1, 2, 1][i % 4]] + 12, 0.16 + bar * 0.02, 0.2); }
      bass(chaos, t0, ch[0] - 12, 0.3, 0.4); bass(chaos, t0 + 1, ch[0] - 12, 0.3, 0.36);
      for (let b = 0; b < 4; b++) if (t0 + b * 0.5 < T.rip) wood(chaos, t0 + b * 0.5, b % 2 ? 1500 : 1900, 0.07);
      if (bar >= 3) {
        for (let k = 0; k < 16; k++) { const tt = t0 + k * 0.125; if (tt < T.rip) hat(chaos, tt, 0.015 + (bar - 3) * 0.008 + (k % 2 ? 0 : 0.01)); }
        for (let b = 0; b < 4; b++) if (t0 + b * 0.5 < T.rip) kick(chaos, t0 + b * 0.5, 0.3 + (bar - 3) * 0.06);
      }
    }
    riser(chaos, 7.0, T.rip - 7.0);
    const dings = [[88, 84], [91, 88], [84, 79]];
    NOTIFS.forEach((n, i) => { ding(sfx, n.t, dings[i % 3][0], dings[i % 3][1], 0.07 + Math.min(i, 8) * 0.004); if (i % 2 === 0) buzz(dry, n.t); });
    scratch(dry, 0.32, 1.0, 0.025); scratch(dry, 5.47, 0.5, 0.03);

    // 2. 150+ sticky notes, then the rip and a breath of silence
    NOTES.forEach((n, i) => { if (i % 2 === 0) tap(dry, n.t, 0.04); });
    T.hundred.forEach((t, i) => popS(dry, t, 420 + i * 120, 0.13));
    scratch(dry, 10.4, 0.9, 0.025);
    rip(dry, T.rip, 0.8);

    // 3. Meet Flixbnb: the stamp lands and the song begins in C major
    whoosh(sfx, T.stamp - 0.45, 0.4, 0.1, false);
    stamp(dry, T.stamp, 0.95); crash(sfx, T.stamp + 0.001, 0.08);
    pad(padBus, T.stamp, [60, 64, 67, 72], 3.0, 0.2);
    scratch(dry, 13.4, 1.1, 0.02);
    T.circles.forEach((t, i) => { popS(dry, t, 500 + i * 140, 0.12); marimba(mel, t, [72, 76, 79][i], 0.2, 0.5); });
    for (let x = 17.0; x < 19; x += 0.5) osc(sfx, 'sine', 1760 + (x % 1 ? 220 : 0), x, 0.05, 0.025);
    scratch(dry, 16.4, 1.2, 0.02);

    const G0 = T.stamp, END = T.handled;
    const prog = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];
    const MEL = [
      [[0, 76, 1], [2, 79, 1], [3, 81, 1], [4, 79, 2], [6, 76, 2]],
      [[0, 74, 1], [2, 71, 1], [3, 74, 1], [4, 79, 2], [6, 74, 2]],
      [[0, 72, 1], [2, 76, 1], [3, 81, 1], [4, 79, 2], [6, 76, 2]],
      [[0, 77, 1], [2, 81, 1], [3, 79, 1], [4, 77, 1], [5, 76, 1], [6, 74, 2]]
    ];
    for (let b = 0; ; b++) {
      const t0 = G0 + b * 2;
      if (t0 >= END) break;
      if (t0 + 2 < A.winA || t0 > A.winB) continue; // nothing in this bar falls in the window
      const ch = prog[b % 4];
      const sec = t0 < 15 ? 'reveal' : t0 < 19 ? 'intro' : t0 < 30 ? 'knows' : t0 < 40 ? 'chat' : t0 < 46 ? 'team' : 'build';
      [[0, 0, 0.42, 0.42], [0.75, 7, 0.2, 0.3], [1.0, 12, 0.36, 0.36], [1.5, 7, 0.2, 0.28], [1.75, 0, 0.2, 0.3]].forEach(([dt, iv, d, v]) => {
        if (t0 + dt < END) bass(bassBus, t0 + dt, ch[0] - 12 + iv, d, v);
      });
      if (sec !== 'reveal' && sec !== 'build') MEL[b % 4].forEach(([e, m, l]) => {
        const tt = t0 + e * 0.25;
        if (tt < END) marimba(mel, tt, m + (sec === 'team' && b % 2 ? 12 : 0), sec === 'chat' ? 0.17 : 0.25, 0.25 * l + 0.25);
      });
      if (sec !== 'reveal' && sec !== 'intro') for (let k = 0; k < 4; k++) {
        const tt = t0 + k * 0.5 + 0.25;
        if (tt < END) strum(strumBus, tt, ch.map(x => x + 12), sec === 'chat' ? 0.06 : 0.09, 0.18);
      }
      if (sec !== 'reveal') for (let k = 0; k < 8; k++) { const tt = t0 + k * 0.25; if (tt < END) shaker(drums, tt, k % 2 ? 0.035 : 0.05); }
      if (sec === 'knows' || sec === 'team') { kick(drums, t0); kick(drums, t0 + 1); clap(drums, t0 + 0.5, 0.12); clap(drums, t0 + 1.5, 0.12); }
      if (sec === 'chat') kick(drums, t0, 0.5);
      if (sec === 'team') for (let k = 0; k < 16; k++) hat(drums, t0 + k * 0.125, k % 2 ? 0.02 : 0.035);
    }

    // 4. The legal pad: pencil scratches, then a tick and a rising chime for every "Handled"
    whoosh(sfx, T.cover1, 0.5, 0.14);
    scratch(dry, 19.8, 1.4, 0.025);
    T.items.forEach(t => scratch(dry, t, 0.35, 0.03));
    T.ticks.forEach((t, i) => { scratch(dry, t, 0.15, 0.06); glock(sfx, t + 0.12, [84, 86, 88, 91, 93][i], 0.14, 1.2); });
    scratch(dry, T.call, 0.45, 0.05);
    marimba(mel, T.call + 0.4, 74, 0.25, 0.3); marimba(mel, T.call + 0.55, 79, 0.25, 0.5);
    scratch(dry, T.call + 0.55, 0.55, 0.03);

    // 5. The chat
    whoosh(sfx, 30.0, 0.45, 0.13, false); whoosh(sfx, 30.25, 0.45, 0.12);
    scratch(dry, 30.9, 1.4, 0.025);
    T.typing.forEach(([a, b]) => { for (let x = a; x < b; x += 0.18) wood(dry, x, 2600, 0.02); });
    [32.0, 35.0, 37.0].forEach(t => bloop(sfx, t, 0.15));
    noise(sfx, 33.5, 0.18, { type: 'bandpass', f: 900, f2: 4000, q: 1.2, v: 0.08, a: 0.06 });
    wood(dry, 36.0, 1400, 0.05);
    [84, 88, 91].forEach((m, i) => glock(sfx, 37.1 + i * 0.1, m, 0.11, 1.0));
    [37.6, 37.72, 37.84].forEach((t, i) => popS(dry, t, 900 + i * 200, 0.06));

    // 6. 100X
    whoosh(sfx, 39.6, 0.45, 0.13); whoosh(sfx, 40.1, 0.4, 0.1);
    T.tenx.forEach((t, i) => popS(dry, t, 600 + i * 150, 0.13));
    scratch(dry, T.yourTeam, 0.6, 0.03);
    T.hundredX.forEach((t, i) => popS(dry, t, 450 + i * 110, 0.14));
    stamp(dry, T.hit, 0.8); crash(sfx, T.hit + 0.001, 0.12); strum(strumBus, T.hit + 0.002, [60, 64, 67, 72], 0.14, 0.8);
    [96, 100, 103, 108].forEach((m, i) => glock(sfx, T.hit + 0.1 + i * 0.07, m, 0.06, 0.8));
    scratch(dry, T.better, 0.45, 0.03);

    // 7. The end card: three slaps of paper, a snare roll, then "Handled." and the final chord
    whoosh(sfx, T.cover2, 0.55, 0.15, false);
    T.strips.forEach((t, i) => { tap(dry, t, 0.12); pluck(strumBus, t, [67, 69, 71][i], 0.25, 0.4); });
    for (let x = 47.0; x < END - 0.02; x += lerp(0.125, 0.04, x - 47)) noise(drums, x, 0.05, { type: 'bandpass', f: 1800, q: 0.9, v: 0.04 + (x - 47) * 0.1 });
    stamp(dry, END, 1); crash(sfx, END + 0.001, 0.14);
    pad(padBus, END, [48, 55, 60, 64, 67], 4.0, 0.22);
    bass(bassBus, END, 36, 2.8, 0.5);
    strum(strumBus, END + 0.02, [60, 64, 67, 72, 76], 0.16, 2.0);
    [84, 88, 91, 96].forEach((m, i) => glock(mel, END + 0.25 + i * 0.11, m, 0.12, 1.6));
    popS(dry, T.logo, 700, 0.1); popS(dry, T.button, 880, 0.1); scratch(dry, T.circle, 0.5, 0.03);
  }

  /* ───────────── The player ───────────── */
  const playBtn = root.querySelector('.film-play');
  const toggleBtn = root.querySelector('.film-toggle');
  const muteBtn = root.querySelector('.film-mute');
  const fullBtn = root.querySelector('.film-full');
  const seek = root.querySelector('.film-seek');
  const POSTER = 6.3, AHEAD = 0.3;

  let state = 'idle', offset = POSTER, startAt = 0, clockStart = 0, muted = false, seeking = false, ready = false;
  let actx = null, master = null, session = null, timer = 0;

  function setState(s) {
    state = s; root.dataset.state = s;
    toggleBtn.setAttribute('aria-label', s === 'playing' ? 'Pause' : 'Play');
    playBtn.setAttribute('aria-label', s === 'ended' ? 'Play the film again' : 'Play the film, with sound');
  }
  function now() {
    if (state !== 'playing') return offset;
    if (session) return Math.max(offset, actx.currentTime - startAt);
    return Math.max(offset, (performance.now() - clockStart) / 1000);
  }
  // Keep the next AHEAD seconds of the score scheduled
  function fill() {
    if (!session) return;
    A = session;
    const until = Math.min(actx.currentTime - startAt + AHEAD, DUR + 1);
    if (until <= A.winB) return;
    A.winA = A.winB; A.winB = until;
    score();
  }
  function startSound() {
    if (actx && actx.state === 'running') {
      const ctxStart = actx.currentTime + 0.05;
      session = newSession(actx, master, offset, ctxStart);
      startAt = ctxStart - offset;
      fill();
      timer = setInterval(fill, 40);
    } else clockStart = performance.now() - offset * 1000;
  }
  function stopSound() {
    clearInterval(timer);
    if (session) { session.tail.disconnect(); session = null; }
  }
  async function play() {
    if (state === 'playing' || state === 'loading') return;
    if (state === 'idle' || state === 'ended') offset = 0;
    // The audio context has to start inside the click
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!actx && AC) {
      actx = new AC();
      master = actx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(actx.destination);
    }
    if (actx && actx.state !== 'running') {
      // If the browser won't start the sound, the film still plays, silently
      setState('loading');
      try { await Promise.race([actx.resume(), new Promise(r => setTimeout(r, 400))]); } catch (e) { /* stays silent */ }
    }
    startSound();
    setState('playing');
    requestAnimationFrame(loop);
  }
  function pause() {
    if (state !== 'playing') return;
    offset = now(); stopSound(); setState('paused'); render(offset);
  }
  function seekTo(x) {
    const was = state === 'playing';
    if (was) stopSound();
    offset = clamp(x, 0, DUR - 0.05);
    if (state === 'ended') setState('paused');
    if (was) startSound(); else render(offset);
  }
  function loop() {
    if (state !== 'playing') return;
    const t = now();
    if (t >= DUR) { offset = DUR; render(DUR); setState('ended'); seek.value = DUR; setTimeout(stopSound, 600); return; }
    render(t);
    if (!seeking) seek.value = t.toFixed(2);
    requestAnimationFrame(loop);
  }

  playBtn.addEventListener('click', play);
  toggleBtn.addEventListener('click', () => (state === 'playing' ? pause() : play()));
  canvas.addEventListener('click', () => (state === 'playing' ? pause() : play()));
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    if (master) master.gain.value = muted ? 0 : 1;
  });
  fullBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen();
  });
  seek.max = DUR;
  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('pointerup', () => { seeking = false; });
  seek.addEventListener('input', () => seekTo(parseFloat(seek.value)));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // Pause when the film scrolls out of view
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting) pause(); }, { threshold: 0.2 }).observe(root);
  if ('ResizeObserver' in window) new ResizeObserver(() => { fit(); if (ready && state !== 'playing') render(offset); }).observe(canvas);
  document.addEventListener('fullscreenchange', () => { fit(); if (ready && state !== 'playing') render(offset); });

  const fonts = [HAND(700, 40), HAND(400, 40), SANS(500, 20), SANS(600, 20), SANS(700, 40), SANS(800, 40)];
  Promise.all(fonts.map(f => (document.fonts ? document.fonts.load(f) : null))).catch(() => {}).then(() => {
    makeTextures(); fit(); ready = true; setState('idle'); render(POSTER);
  });

  // For checking by hand: .film.show(27) draws a frame; .film.renderSound(46, 50) renders that slice offline
  root.film = {
    show: x => { offset = x; render(x); },
    renderSound(a, b) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = 44100;
      const ac = new OAC(2, Math.ceil(sr * (b - a + 0.5)), sr);
      A = newSession(ac, ac.destination, a, 0);
      A.winA = a; A.winB = b;
      score();
      return ac.startRendering();
    },
    duration: DUR
  };
})();

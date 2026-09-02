/* tools/qr.mjs: A QR ENCODER, WRITTEN OUT RATHER THAN INSTALLED.
 *
 * WHY THIS IS NOT AN npm DEPENDENCY. Hard rule 4 forbids third-party loads at RUNTIME, which
 * a build-time package would not breach, so that is not the reason. The reason is that this
 * repo carries the real ledger and runs `npm ci` unattended in a cloud routine: every package
 * added here is a supply chain that reaches the book. Two devDependencies is the whole surface
 * today and it is worth keeping. This is ~300 lines of a fully specified format, it never
 * changes, and it is proved against an independent encoder in test/verify.mjs rather than
 * trusted.
 *
 * SCOPE, deliberately narrow. Byte mode, error correction level M, versions 1 to 10, which is
 * up to 213 bytes. A statement URL is about sixty characters and lands at version 3 or 4, so
 * there is a wide margin and no reason to carry the tables for forty versions.
 *
 * OUTPUT IS AN SVG PATH, not a canvas and not a PNG. It goes inline into the page, so nothing
 * is fetched, nothing is written to disk beside the statement, and it prints at any size.
 *
 *   import { qrSvg } from './qr.mjs';
 *   qrSvg('https://example.invalid/s/CX0-AA', { size: 132 })   ->  '<svg ...>...</svg>'
 */

/* ---- the tables, level M only ------------------------------------------------------
   Each row: [total codewords, EC codewords per block, [blocks, data codewords] groups].
   Derived capacities are asserted in the test rather than restated here. */
const VERSIONS = {
  1: { total: 26, ec: 10, groups: [[1, 16]], align: [] },
  2: { total: 44, ec: 16, groups: [[1, 28]], align: [6, 18] },
  3: { total: 70, ec: 26, groups: [[1, 44]], align: [6, 22] },
  4: { total: 100, ec: 18, groups: [[2, 32]], align: [6, 26] },
  5: { total: 134, ec: 24, groups: [[2, 43]], align: [6, 30] },
  6: { total: 172, ec: 16, groups: [[4, 27]], align: [6, 34] },
  7: { total: 196, ec: 18, groups: [[4, 31]], align: [6, 22, 38] },
  8: { total: 242, ec: 22, groups: [[2, 38], [2, 39]], align: [6, 24, 42] },
  9: { total: 292, ec: 22, groups: [[3, 36], [2, 37]], align: [6, 26, 46] },
  10: { total: 346, ec: 26, groups: [[4, 43], [1, 44]], align: [6, 28, 50] }
};

/* ---- GF(256) arithmetic, the field QR's Reed-Solomon lives in ----------------------
   Primitive polynomial 0x11d, generator 2. Log and antilog tables are built once. */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function buildGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

/* The generator polynomial for n EC codewords is (x - a^0)(x - a^1)...(x - a^(n-1)). */
function rsGenerator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const rem = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift(); rem.push(0);
    if (factor !== 0) for (let j = 0; j < ecLen; j++) rem[j] ^= gfMul(gen[j + 1], factor);
  }
  return rem;
}

/* ---- the bit stream ---------------------------------------------------------------- */
function encodeData(bytes, version) {
  const V = VERSIONS[version];
  const dataCodewords = V.groups.reduce((a, [n, c]) => a + n * c, 0);
  /* THE CHARACTER COUNT IS EIGHT BITS BELOW VERSION 10 AND SIXTEEN AT IT. Getting this
     wrong produces a symbol that scans as gibberish rather than one that fails to scan,
     which is the worse failure: it looks like it worked. */
  const countBits = version < 10 ? 8 : 16;
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);                       // byte mode
  push(bytes.length, countBits);
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords * 8;
  if (bits.length > capacity) throw new Error('qr: data does not fit version ' + version);
  push(0, Math.min(4, capacity - bits.length));          // terminator
  while (bits.length % 8) bits.push(0);                   // pad to a byte boundary
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }
  const PAD = [0xEC, 0x11];
  for (let i = 0; codewords.length < dataCodewords; i++) codewords.push(PAD[i % 2]);

  /* Split into blocks, error-correct each, then INTERLEAVE. The interleave is what makes a
     burst of damage land across many blocks rather than destroying one. */
  const blocks = [];
  let at = 0;
  for (const [n, count] of V.groups) {
    for (let i = 0; i < n; i++) {
      const d = codewords.slice(at, at + count); at += count;
      blocks.push({ data: d, ec: rsEncode(d, V.ec) });
    }
  }
  const out = [];
  const maxData = Math.max(...blocks.map(b => b.data.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < V.ec; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

/* ---- the matrix --------------------------------------------------------------------- */
function makeMatrix(version) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));  // null = free
  const set = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) m[r][c] = v; };

  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      set(r0 + r, c0 + c, inside ? (ring || core ? 1 : 0) : 0);   // outside the 7x7 is the separator
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {            // timing patterns
    const v = i % 2 === 0 ? 1 : 0;
    if (m[6][i] === null) m[6][i] = v;
    if (m[i][6] === null) m[i][6] = v;
  }

  /* THE THREE OMITTED ALIGNMENT PATTERNS ARE THE THREE THAT SIT UNDER A FINDER, and only
     those. The first guard here skipped any centre whose cell was already written, which
     catches the finder corners and, from version 7, ALSO catches the legitimate patterns
     centred on the timing row and column: version 7 wants one at (6,22), and the timing
     row had already claimed that cell. Versions 1 to 6 were unaffected, because there the
     only (6,x) centres do fall inside a finder, so the wrong rule and the right one agree
     and the fault stayed hidden until version 7. An alignment pattern overwrites timing
     where they meet, which is what the specification asks for. */
  const first = 6, last = size - 7;
  for (const r of VERSIONS[version].align) for (const c of VERSIONS[version].align) {
    if ((r === first && c === first) || (r === first && c === last) || (r === last && c === first)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const edge = Math.abs(dr) === 2 || Math.abs(dc) === 2;
      set(r + dr, c + dc, (edge || (dr === 0 && dc === 0)) ? 1 : 0);
    }
  }

  m[size - 8][8] = 1;                             // the dark module, always set

  /* Format areas are reserved now and written after masking, because the format bits
     depend on which mask won. 0 is a placeholder, not a value. */
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) m[8][i] = 0; if (m[i][8] === null) m[i][8] = 0; }
  for (let i = 0; i < 8; i++) { if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 0; if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 0; }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      m[size - 11 + j][i] = 0; m[i][size - 11 + j] = 0;
    }
  }
  return m;
}

/* Which cells carry data: everything still null after the function patterns are laid. */
function placeData(m, codewords, version) {
  const size = m.length;
  const free = m.map(row => row.map(v => v === null));
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  let bi = 0, up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;                          // the vertical timing column is skipped entirely
    for (let n = 0; n < size; n++) {
      const row = up ? size - 1 - n : n;
      for (const c of [col, col - 1]) {
        if (!free[row][c]) continue;
        m[row][c] = bi < bits.length ? bits[bi++] : 0;
      }
    }
    up = !up;
  }
  return free;
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

/* The four penalty rules, scored exactly as the specification states them. A mask is chosen
   to avoid patterns a scanner could mistake for a finder, and to keep light and dark even. */
function penalty(m) {
  const size = m.length; let score = 0;
  const run = line => {
    let s = 0, last = -1, len = 0;
    for (const v of line) {
      if (v === last) { len++; if (len === 5) s += 3; else if (len > 5) s += 1; }
      else { last = v; len = 1; }
    }
    return s;
  };
  for (let i = 0; i < size; i++) { score += run(m[i]); score += run(m.map(r => r[i])); }
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
  }
  const bad1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], bad2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const hits = line => {
    let s = 0;
    for (let i = 0; i + 11 <= line.length; i++) {
      const seg = line.slice(i, i + 11);
      if (bad1.every((v, j) => v === seg[j]) || bad2.every((v, j) => v === seg[j])) s += 40;
    }
    return s;
  };
  for (let i = 0; i < size; i++) { score += hits(m[i]); score += hits(m.map(r => r[i])); }
  /* Rule 4, as the specification states it: take the multiples of five either side of the
     dark percentage, measure each from 50, and score the SMALLER. Some encoders in the wild
     use a ceil() shortcut that rounds one way only and so scores 52% as a deviation; that
     picks a different mask on roughly one symbol in a hundred. Both are scannable, since
     the format bits declare the mask either way, but this one is the spec and the mask
     override below is what lets the test prove everything else against an encoder that
     chose differently. */
  const dark = m.flat().filter(v => v === 1).length;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

const ECC_M_BITS = 0b00;
function formatBits(maskIndex) {
  let data = (ECC_M_BITS << 3) | maskIndex;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0b10100110111);
  return ((data << 10) | rem) ^ 0b101010000010010;
}
function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >> 11) & 1) * 0b1111100100101);
  return (version << 12) | rem;
}

function applyFormat(m, maskIndex, version) {
  const size = m.length, bits = formatBits(maskIndex);
  /* THE FIFTEEN BITS ARE READ MOST-SIGNIFICANT FIRST. Indexing them from the low end
     instead produces a symbol that is structurally perfect and says the wrong thing about
     its own mask, so every scanner unmasks it incorrectly and reads noise. It looks right
     to the eye, which is why this is proved against an independent encoder in the test
     rather than checked by looking at it. */
  const b = k => (bits >> (14 - k)) & 1;
  for (let i = 0; i <= 5; i++) m[8][i] = b(i);
  m[8][7] = b(6); m[8][8] = b(7); m[7][8] = b(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = b(i);
  for (let i = 0; i <= 6; i++) m[size - 1 - i][8] = b(i);
  for (let i = 7; i <= 14; i++) m[8][size - 15 + i] = b(i);
  m[size - 8][8] = 1;                              // the dark module, over the second copy
  if (version >= 7) {
    const vb = versionBits(version);
    /* The eighteen version bits are read low-first, unlike the format bits above. That
       asymmetry is the specification's, not a slip. */
    for (let i = 0; i < 18; i++) {
      const v = (vb >> i) & 1, r = Math.floor(i / 3), c = i % 3;
      m[size - 11 + c][r] = v; m[r][size - 11 + c] = v;
    }
  }
}

/** The module matrix for a string, as an array of rows of 0/1. */
export function qrMatrix(text, opts) {
  opts = opts || {};
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let version = opts.version || 0;
  if (!version) {
    for (let v = 1; v <= 10; v++) {
      const V = VERSIONS[v];
      const dataCw = V.groups.reduce((a, [n, c]) => a + n * c, 0);
      const overheadBits = 4 + (v < 10 ? 8 : 16);
      if (bytes.length * 8 + overheadBits <= dataCw * 8) { version = v; break; }
    }
  }
  if (!version) throw new Error('qr: ' + bytes.length + ' bytes exceeds version 10 at level M');
  const codewords = encodeData(bytes, version);
  const base = makeMatrix(version);
  const free = placeData(base, codewords, version);

  /* `mask` forces one of the eight rather than scoring for the best. Nothing in the batch
     uses it; it exists so the test can drive all eight and compare against an independent
     encoder held to the same mask, which proves the data, the error correction, the
     interleave, the function patterns and the format bits without the choice of mask
     getting in the way. */
  const only = opts.mask;
  let best = null;
  for (let k = 0; k < 8; k++) {
    if (only != null && k !== only) continue;
    const m = base.map(r => r.slice());
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
      if (free[r][c] && MASKS[k](r, c)) m[r][c] ^= 1;
    }
    applyFormat(m, k, version);
    const p = penalty(m);
    if (!best || p < best.p) best = { p, m };
  }
  if (!best) throw new Error('qr: mask must be 0 to 7');
  return best.m;
}

/**
 * An SVG for a string. One path for every dark module, so it is a single fill and it scales.
 * `quiet` is the mandatory light border, four modules by the specification; below that,
 * scanners start to fail against a dark background.
 */
export function qrSvg(text, opts) {
  opts = opts || {};
  const m = qrMatrix(text, opts);
  const quiet = opts.quiet == null ? 4 : opts.quiet;
  const n = m.length, span = n + quiet * 2;
  const size = opts.size || 132;
  const dark = opts.dark || '#000000';
  const light = opts.light || '#ffffff';
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (m[r][c] !== 1) { c++; continue; }
      let w = 1;
      while (c + w < n && m[r][c + w] === 1) w++;       // run-length: fewer path commands
      d += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h' + w + 'v1h-' + w + 'z';
      c += w;
    }
  }
  const label = opts.label ? String(opts.label).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])) : '';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" '
    + 'viewBox="0 0 ' + span + ' ' + span + '" shape-rendering="crispEdges" role="img"'
    + (label ? ' aria-label="' + label + '"' : ' aria-hidden="true"') + '>'
    + '<rect width="' + span + '" height="' + span + '" fill="' + light + '"/>'
    + '<path d="' + d + '" fill="' + dark + '"/></svg>';
}

export const QR_VERSIONS = VERSIONS;

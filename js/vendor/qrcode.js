/**
 * Compact QR Code SVG Generator — ES module
 * Based on qrcode-generator by Kazuhiko Arase (MIT License)
 * http://www.d-project.com/  |  https://github.com/kazuhikoarase/qrcode-generator
 * Stripped to byte-mode + SVG output for minimal bundle size.
 */

// GF(256) arithmetic
const EXP = new Array(256), LOG = new Array(256);
for (let i = 0; i < 8; i++) EXP[i] = 1 << i;
for (let i = 8; i < 256; i++) EXP[i] = EXP[i-4]^EXP[i-5]^EXP[i-6]^EXP[i-8];
for (let i = 0; i < 255; i++) LOG[EXP[i]] = i;
const gexp = n => { while(n<0)n+=255; while(n>=256)n-=255; return EXP[n]; };
const glog = n => LOG[n];

// Polynomial
function poly(num, shift) {
  let off = 0;
  while (off < num.length && num[off] === 0) off++;
  const a = new Array(num.length - off + shift);
  for (let i = 0; i < num.length - off; i++) a[i] = num[i + off];
  for (let i = num.length - off; i < a.length; i++) a[i] = 0;
  return {
    at: i => a[i], len: () => a.length,
    mul(e) {
      const n = new Array(a.length + e.len() - 1).fill(0);
      for (let i = 0; i < a.length; i++)
        for (let j = 0; j < e.len(); j++)
          n[i+j] ^= gexp(glog(a[i]) + glog(e.at(j)));
      return poly(n, 0);
    },
    mod(e) {
      if (a.length - e.len() < 0) return poly(a, 0);
      const r = glog(a[0]) - glog(e.at(0));
      const n = a.slice();
      for (let i = 0; i < e.len(); i++) n[i] ^= gexp(glog(e.at(i)) + r);
      return poly(n, 0).mod(e);
    }
  };
}

function ecPoly(ecLen) {
  let a = poly([1], 0);
  for (let i = 0; i < ecLen; i++) a = a.mul(poly([1, gexp(i)], 0));
  return a;
}

// RS Block Table [count, total, data, ...]  — L,M,Q,H per version
const RST = [
  [1,26,19],[1,26,16],[1,26,13],[1,26,9],
  [1,44,34],[1,44,28],[1,44,22],[1,44,16],
  [1,70,55],[1,70,44],[2,35,17],[2,35,13],
  [1,100,80],[2,50,32],[2,50,24],[4,25,9],
  [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
  [1,86,68],[4,43,27],[4,43,19],[4,43,15],
  [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
  [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
  [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
  [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],
  [4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],
  [2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],
  [4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],
  [3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],
  [5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],
  [5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],
  [1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],
  [5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],
  [3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],
  [3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],
  [4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],
  [2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],
  [4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],
  [6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],
  [8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],
  [10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],
  [8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],
  [3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],
  [7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],
  [5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],
  [13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],
  [17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],
  [17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],
  [13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],
  [12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],
  [6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],
  [17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],
  [4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],
  [20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],
  [19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]
];

const EC_ORD = { L: 0, M: 1, Q: 2, H: 3 };

function getRSBlocks(ver, ec) {
  const row = RST[(ver - 1) * 4 + EC_ORD[ec]];
  const list = [];
  for (let i = 0; i < row.length; i += 3)
    for (let j = 0; j < row[i]; j++)
      list.push({ total: row[i+1], data: row[i+2] });
  return list;
}

// Alignment pattern positions
const ALIGN = [
  [],[6,18],[6,22],[6,26],[6,30],[6,34],
  [6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],
  [6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],
  [6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],
  [6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],
  [6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],
  [6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],
  [6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],
  [6,30,58,86,114,142,170]
];

// BCH encoding
const G15 = (1<<10)|(1<<8)|(1<<5)|(1<<4)|(1<<2)|(1<<1)|1;
const G18 = (1<<12)|(1<<11)|(1<<10)|(1<<9)|(1<<8)|(1<<5)|(1<<2)|1;
const G15_MASK = (1<<14)|(1<<12)|(1<<10)|(1<<4)|(1<<1);

function bchDigit(d) { let n=0; while(d){n++;d>>>=1;} return n; }
function bchTypeInfo(d) { let v=d<<10; while(bchDigit(v)-bchDigit(G15)>=0) v^=G15<<(bchDigit(v)-bchDigit(G15)); return ((d<<10)|v)^G15_MASK; }
function bchTypeNumber(d) { let v=d<<12; while(bchDigit(v)-bchDigit(G18)>=0) v^=G18<<(bchDigit(v)-bchDigit(G18)); return (d<<12)|v; }

// Mask functions
const MASKS = [
  (i,j) => (i+j)%2===0,
  (i,j) => i%2===0,
  (i,j) => j%3===0,
  (i,j) => (i+j)%3===0,
  (i,j) => (Math.floor(i/2)+Math.floor(j/3))%2===0,
  (i,j) => (i*j)%2+(i*j)%3===0,
  (i,j) => ((i*j)%2+(i*j)%3)%2===0,
  (i,j) => ((i*j)%3+(i+j)%2)%2===0
];

function lengthBits(ver) {
  if (ver < 10) return 8;
  return 16;
}

function stringToBytes(s) {
  const utf8 = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) utf8.push(c);
    else if (c < 0x800) utf8.push(0xc0|(c>>6), 0x80|(c&0x3f));
    else if (c < 0xd800 || c >= 0xe000) utf8.push(0xe0|(c>>12), 0x80|((c>>6)&0x3f), 0x80|(c&0x3f));
    else { i++; c = 0x10000+(((c&0x3ff)<<10)|(s.charCodeAt(i)&0x3ff)); utf8.push(0xf0|(c>>18), 0x80|((c>>12)&0x3f), 0x80|((c>>6)&0x3f), 0x80|(c&0x3f)); }
  }
  return utf8;
}

// Bit buffer
function bitBuf() {
  const buf = []; let len = 0;
  return {
    put(n, l) { for (let i = l-1; i >= 0; i--) { buf[len>>>3] = (buf[len>>>3]||0) | (((n>>>i)&1) << (7-(len&7))); len++; } },
    bits: () => len,
    buf: () => buf
  };
}

function createData(ver, ec, bytes) {
  const rsBlocks = getRSBlocks(ver, ec);
  const buf = bitBuf();
  // Mode: byte (0100), length, data
  buf.put(4, 4); // 8-bit byte mode
  buf.put(bytes.length, lengthBits(ver));
  for (const b of bytes) buf.put(b, 8);

  let totalData = 0;
  for (const b of rsBlocks) totalData += b.data;
  if (buf.bits() > totalData * 8) throw 'data overflow';
  if (buf.bits() + 4 <= totalData * 8) buf.put(0, 4);
  while (buf.bits() % 8) buf.put(0, 1);
  while (buf.bits() < totalData * 8) {
    buf.put(0xEC, 8);
    if (buf.bits() >= totalData * 8) break;
    buf.put(0x11, 8);
  }

  const raw = buf.buf();
  let off = 0, maxDc = 0, maxEc = 0;
  const dc = [], ec2 = [];
  for (let r = 0; r < rsBlocks.length; r++) {
    const dcC = rsBlocks[r].data, ecC = rsBlocks[r].total - dcC;
    maxDc = Math.max(maxDc, dcC);
    maxEc = Math.max(maxEc, ecC);
    dc[r] = [];
    for (let i = 0; i < dcC; i++) dc[r][i] = 0xff & (raw[i + off] || 0);
    off += dcC;
    const rsPoly = ecPoly(ecC);
    const rawPoly = poly(dc[r], rsPoly.len() - 1);
    const modPoly = rawPoly.mod(rsPoly);
    ec2[r] = [];
    for (let i = 0; i < rsPoly.len() - 1; i++) {
      const mi = i + modPoly.len() - (rsPoly.len() - 1);
      ec2[r][i] = mi >= 0 ? modPoly.at(mi) : 0;
    }
  }
  let total = 0;
  for (const b of rsBlocks) total += b.total;
  const data = new Array(total);
  let idx = 0;
  for (let i = 0; i < maxDc; i++)
    for (let r = 0; r < rsBlocks.length; r++)
      if (i < dc[r].length) data[idx++] = dc[r][i];
  for (let i = 0; i < maxEc; i++)
    for (let r = 0; r < rsBlocks.length; r++)
      if (i < ec2[r].length) data[idx++] = ec2[r][i];
  return data;
}

function makeQR(ver, ec, bytes) {
  const size = ver * 4 + 17;
  let modules, cache;

  function make(test, mask) {
    modules = Array.from({length: size}, () => new Array(size).fill(null));
    // Finder patterns
    for (const [r0, c0] of [[0,0],[size-7,0],[0,size-7]]) {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const rr = r0+r, cc = c0+c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        modules[rr][cc] = (0<=r&&r<=6&&(c===0||c===6)) || (0<=c&&c<=6&&(r===0||r===6)) || (2<=r&&r<=4&&2<=c&&c<=4);
      }
    }
    // Alignment
    const pos = ALIGN[ver - 1];
    for (const ri of pos) for (const ci of pos) {
      if (modules[ri][ci] !== null) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)
        modules[ri+r][ci+c] = Math.abs(r)===2||Math.abs(c)===2||(r===0&&c===0);
    }
    // Timing
    for (let i = 8; i < size-8; i++) { if (modules[i][6]===null) modules[i][6] = i%2===0; if (modules[6][i]===null) modules[6][i] = i%2===0; }
    // Type info
    const bits = bchTypeInfo(EC_ORD[ec]<<3|mask);
    for (let i = 0; i < 15; i++) {
      const m = !test && ((bits>>i)&1)===1;
      if (i<6) modules[i][8]=m; else if (i<8) modules[i+1][8]=m; else modules[size-15+i][8]=m;
      if (i<8) modules[8][size-i-1]=m; else if (i<9) modules[8][15-i]=m; else modules[8][15-i-1]=m;
    }
    modules[size-8][8] = !test;
    // Version info
    if (ver >= 7) {
      const vb = bchTypeNumber(ver);
      for (let i = 0; i < 18; i++) {
        const m = !test && ((vb>>i)&1)===1;
        modules[Math.floor(i/3)][i%3+size-8-3] = m;
        modules[i%3+size-8-3][Math.floor(i/3)] = m;
      }
    }
    // Data
    if (!cache) cache = createData(ver, ec, bytes);
    let inc = -1, row = size-1, bi = 7, byteIdx = 0;
    const mf = MASKS[mask];
    for (let col = size-1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (modules[row][col-c] === null) {
            let dark = false;
            if (byteIdx < cache.length) dark = ((cache[byteIdx]>>>(bi))&1)===1;
            if (mf(row, col-c)) dark = !dark;
            modules[row][col-c] = dark;
            bi--;
            if (bi === -1) { byteIdx++; bi = 7; }
          }
        }
        row += inc;
        if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
      }
    }
  }

  // Find best mask
  let bestMask = 0, bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    cache = null;
    make(true, m);
    let score = 0;
    // Penalty 1: runs
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let same = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (dr===0&&dc===0) continue;
          const rr=r+dr,cc=c+dc;
          if (rr>=0&&rr<size&&cc>=0&&cc<size&&modules[r][c]===modules[rr][cc]) same++;
        }
        if (same > 5) score += 3+same-5;
      }
    }
    // Penalty 2: 2x2 blocks
    for (let r = 0; r < size-1; r++) for (let c = 0; c < size-1; c++) {
      let cnt = 0;
      if (modules[r][c]) cnt++;
      if (modules[r+1][c]) cnt++;
      if (modules[r][c+1]) cnt++;
      if (modules[r+1][c+1]) cnt++;
      if (cnt===0||cnt===4) score += 3;
    }
    // Penalty 3: finder-like
    for (let r = 0; r < size; r++) for (let c = 0; c < size-6; c++)
      if (modules[r][c]&&!modules[r][c+1]&&modules[r][c+2]&&modules[r][c+3]&&modules[r][c+4]&&!modules[r][c+5]&&modules[r][c+6]) score += 40;
    for (let c = 0; c < size; c++) for (let r = 0; r < size-6; r++)
      if (modules[r][c]&&!modules[r+1][c]&&modules[r+2][c]&&modules[r+3][c]&&modules[r+4][c]&&!modules[r+5][c]&&modules[r+6][c]) score += 40;
    // Penalty 4: balance
    let dk = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (modules[r][c]) dk++;
    score += Math.floor(Math.abs(100*dk/size/size - 50)/5)*10;
    if (score < bestScore) { bestScore = score; bestMask = m; }
  }
  cache = null;
  make(false, bestMask);
  return { modules, size };
}

function autoVersion(bytes, ec) {
  for (let v = 1; v <= 40; v++) {
    const rsBlocks = getRSBlocks(v, ec);
    let totalData = 0;
    for (const b of rsBlocks) totalData += b.data;
    const headerBits = 4 + lengthBits(v) + bytes.length * 8;
    if (headerBits <= totalData * 8) return v;
  }
  throw 'data too large for QR code';
}

/**
 * Generate a QR code as an SVG string.
 * @param {string} text - The data to encode
 * @param {object} [opts] - Options: { ecLevel: 'L'|'M'|'Q'|'H', cellSize: number, margin: number }
 * @returns {string} SVG markup
 */
export function qrcodeSVG(text, opts = {}) {
  const ec = opts.ecLevel || 'L';
  const cell = opts.cellSize || 4;
  const margin = opts.margin ?? cell * 2;
  const bytes = stringToBytes(text);
  const ver = autoVersion(bytes, ec);
  const { modules, size: modCount } = makeQR(ver, ec, bytes);
  const px = modCount * cell + margin * 2;

  let d = '';
  const rect = `l${cell},0 0,${cell} -${cell},0 0,-${cell}z `;
  for (let r = 0; r < modCount; r++)
    for (let c = 0; c < modCount; c++)
      if (modules[r][c]) d += `M${c*cell+margin},${r*cell+margin}${rect}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" preserveAspectRatio="xMinYMin meet">` +
    `<rect width="100%" height="100%" fill="white"/>` +
    `<path d="${d}" fill="black"/>` +
    `</svg>`;
}

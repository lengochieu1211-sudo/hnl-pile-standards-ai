import zlib from 'node:zlib';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buffer) {
  let c = 0xffffffff;
  for (const b of buffer) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function findEocd(buf) {
  const min = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= min; i--) if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  throw new Error('ZIP không có EOCD hợp lệ.');
}

export function readZip(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  const eocd = findEocd(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  let p = centralOffset;
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(p) !== SIG_CENTRAL) throw new Error(`ZIP central directory hỏng tại entry ${i}.`);
    const flags = buffer.readUInt16LE(p + 8);
    const method = buffer.readUInt16LE(p + 10);
    const modTime = buffer.readUInt16LE(p + 12);
    const modDate = buffer.readUInt16LE(p + 14);
    const crc = buffer.readUInt32LE(p + 16);
    const compSize = buffer.readUInt32LE(p + 20);
    const uncompSize = buffer.readUInt32LE(p + 24);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const extAttrs = buffer.readUInt32LE(p + 38);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (flags & 1) throw new Error(`ZIP entry bị mã hóa, không hỗ trợ: ${name}`);
    if (buffer.readUInt32LE(localOffset) !== SIG_LOCAL) throw new Error(`ZIP local header hỏng: ${name}`);
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataOffset, dataOffset + compSize);
    let data;
    if (method === 0) data = Buffer.from(compressed);
    else if (method === 8) data = zlib.inflateRawSync(compressed);
    else throw new Error(`ZIP method ${method} chưa hỗ trợ: ${name}`);
    if (data.length !== uncompSize) throw new Error(`ZIP kích thước không khớp: ${name}`);
    entries.set(name, { name, data, method, modTime, modDate, crc, extAttrs });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function dosNow() {
  const d = new Date();
  const y = Math.max(1980, d.getFullYear());
  return {
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  };
}

export function writeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const now = dosNow();
  for (const [name, e] of entries) {
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data);
    const nameBuf = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 6 });
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8, known sizes
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(e.modTime ?? now.time, 10);
    local.writeUInt16LE(e.modDate ?? now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(SIG_CENTRAL, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(e.modTime ?? now.time, 12);
    central.writeUInt16LE(e.modDate ?? now.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(e.extAttrs ?? 0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centrals.push(central);
    offset += local.length + compressed.length;
  }
  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.size, 8);
  eocd.writeUInt16LE(entries.size, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuffer, eocd]);
}

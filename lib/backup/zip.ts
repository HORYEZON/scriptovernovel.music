// lib/backup/zip.ts
//
// A minimal ZIP writer and reader, browser-side, with no dependency.
//
// Why not a zip library: the archive is almost entirely JPEGs, PNGs and MP3s,
// which are already compressed — DEFLATE over them buys ~0% and costs the
// whole download of a compression library. So every entry is stored (method 0),
// which makes both halves small enough to own outright, and makes the reader
// trivial because it only ever has to read archives this writer produced.
//
// Why the browser at all: the export bundles every uploaded file on the site,
// which can be hundreds of megabytes. A serverless function that downloaded
// and zipped all of it would be fighting its own memory ceiling and timeout on
// the one operation that must not fail halfway. The browser has no such limit,
// can fetch the files straight from the storage CDN in parallel, and can show
// real progress while it does.

// ─── Archive layout ───────────────────────────────────────────────────────
// The three names that make an archive readable. Exported from here, next to
// the writer/reader themselves, because the two halves of the feature live in
// different places now — the export is run by BackupJobProvider (so it keeps
// going when the admin navigates away) while the archive is opened and
// previewed by the Backup page. Both have to agree on these exactly, and a
// second private copy in either file would be a silent format break.

/** Folder inside the archive holding the uploaded files themselves. */
export const MEDIA_DIR = "media/";
/** Maps each stored file back to the URL the database rows reference. */
export const MEDIA_INDEX = "media/index.json";
/** The rows: manifest plus one array per model. */
export const DATA_FILE = "backup.json";

/** CRC-32, the checksum ZIP requires per entry. Table built once, lazily. */
let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Path inside the archive, forward slashes. */
  name: string;
  bytes: Uint8Array;
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}
function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

/**
 * Builds a Blob of a stored (uncompressed) ZIP.
 *
 * Timestamps are written as a fixed 1980-01-01 rather than "now": nothing reads
 * them, and a constant keeps two exports of unchanged content byte-identical,
 * which is exactly what makes it obvious whether a backup actually changed.
 */
export function makeZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    writeU32(lv, 0, 0x04034b50); // local file header signature
    writeU16(lv, 4, 20); // version needed
    writeU16(lv, 6, 0x0800); // flags: UTF-8 names
    writeU16(lv, 8, 0); // method: store
    writeU16(lv, 10, 0); // mod time
    writeU16(lv, 12, 0x0021); // mod date (1980-01-01)
    writeU32(lv, 14, crc);
    writeU32(lv, 18, size);
    writeU32(lv, 22, size);
    writeU16(lv, 26, nameBytes.length);
    writeU16(lv, 28, 0); // extra length
    local.set(nameBytes, 30);
    locals.push(local, entry.bytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    writeU32(cv, 0, 0x02014b50); // central directory signature
    writeU16(cv, 4, 20); // version made by
    writeU16(cv, 6, 20); // version needed
    writeU16(cv, 8, 0x0800);
    writeU16(cv, 10, 0);
    writeU16(cv, 12, 0);
    writeU16(cv, 14, 0x0021);
    writeU32(cv, 16, crc);
    writeU32(cv, 20, size);
    writeU32(cv, 24, size);
    writeU16(cv, 28, nameBytes.length);
    writeU16(cv, 30, 0); // extra
    writeU16(cv, 32, 0); // comment
    writeU16(cv, 34, 0); // disk
    writeU16(cv, 36, 0); // internal attrs
    writeU32(cv, 38, 0); // external attrs
    writeU32(cv, 42, offset);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length + size;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  writeU32(ev, 0, 0x06054b50); // end of central directory
  writeU16(ev, 8, entries.length);
  writeU16(ev, 10, entries.length);
  writeU32(ev, 12, centralSize);
  writeU32(ev, 16, offset);

  // Assembled into one buffer rather than handed to Blob as a list of views:
  // the entry bytes can be subarrays of a larger buffer (readZip hands those
  // back), which isn't a valid BlobPart, and the total length is already known
  // exactly — so one allocation and a walk of copies is both simpler and the
  // one shape that can't depend on where a view came from.
  const parts = [...locals, ...centrals, end];
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return new Blob([out], { type: "application/zip" });
}

/**
 * Reads a stored ZIP back into its entries.
 *
 * Walks the local file headers front to back rather than parsing the central
 * directory — same result for an archive this writer produced, and it fails
 * loudly on anything else rather than half-reading a compressed archive from
 * some other tool and handing back garbage.
 */
export async function readZip(file: Blob): Promise<ZipEntry[]> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let i = 0;

  while (i + 30 <= buffer.length && view.getUint32(i, true) === 0x04034b50) {
    const method = view.getUint16(i + 8, true);
    const size = view.getUint32(i + 22, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    if (method !== 0) {
      throw new Error(
        "This archive is compressed. Import expects a backup exported from this site, which is stored uncompressed."
      );
    }
    const name = decoder.decode(buffer.subarray(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    entries.push({ name, bytes: buffer.subarray(start, start + size) });
    i = start + size;
  }

  if (entries.length === 0) throw new Error("That file doesn't look like a backup archive.");
  return entries;
}

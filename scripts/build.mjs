#!/usr/bin/env node
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 David Prieto
 *
 * Compila la extensión para Chromium y Firefox sin dependencias externas.
 *   node scripts/build.mjs            # ambos
 *   node scripts/build.mjs chromium
 *   node scripts/build.mjs firefox
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const TARGETS = {
  chromium: { overlay: 'src/manifest.chromium.json', out: 'dist/chromium' },
  firefox: { overlay: 'src/manifest.firefox.json', out: 'dist/firefox' },
};

const ICONS = ['icon16.png', 'icon48.png', 'icon128.png'];

function manifestFor(overlayPath) {
  const base = JSON.parse(readFileSync(join(ROOT, 'src/manifest.base.json'), 'utf8'));
  const overlay = JSON.parse(readFileSync(join(ROOT, overlayPath), 'utf8'));
  return { ...base, ...overlay, version: VERSION };
}

function buildTarget(name) {
  const target = TARGETS[name];
  const out = join(ROOT, target.out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'lib'), { recursive: true });
  mkdirSync(join(out, 'icons'), { recursive: true });

  cpSync(join(ROOT, 'src/content.js'), join(out, 'content.js'));
  cpSync(join(ROOT, 'src/lib/countdown.js'), join(out, 'lib/countdown.js'));
  for (const icon of ICONS) cpSync(join(ROOT, 'src/icons', icon), join(out, 'icons', icon));
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifestFor(target.overlay), null, 2) + '\n');

  console.log(`✓ ${target.out}/  (v${VERSION})`);
  return out;
}

function buildUserscript() {
  const header = `// ==UserScript==
// @name         Countdown Auto-Click
// @namespace    countdown-autoclick
// @version      ${VERSION}
// @description  Pulsa un botón cuando su cuenta regresiva llega a cero
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
`;
  const lib = readFileSync(join(ROOT, 'src/lib/countdown.js'), 'utf8');
  const content = readFileSync(join(ROOT, 'src/content.js'), 'utf8');
  const out = join(ROOT, 'dist/userscript');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'countdown-autoclick.user.js'), `${header}\n${lib}\n${content}`);
  console.log('✓ dist/userscript/countdown-autoclick.user.js');
}

/* ---------------------------------------------------------------- zip */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const comp = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(Buffer.concat([local, name, comp]));

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));

    offset += 30 + name.length + comp.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

function walk(dir, base = dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full, base));
    else files.push({ name: relative(base, full).split('\\').join('/'), data: readFileSync(full) });
  }
  return files;
}

/* ---------------------------------------------------------------- main */
const arg = process.argv[2] || 'all';
const selected = arg === 'all' ? Object.keys(TARGETS) : [arg];

if (!selected.every((name) => TARGETS[name])) {
  console.error(`Target inválido: ${arg}. Usa chromium, firefox o all.`);
  process.exit(1);
}

rmSync(join(ROOT, 'dist'), { recursive: true, force: true });
const built = selected.map(buildTarget);
buildUserscript();

mkdirSync(join(ROOT, 'dist/zips'), { recursive: true });

for (const name of selected) {
  const dir = join(ROOT, TARGETS[name].out);
  const out = join(ROOT, 'dist/zips', `countdown-autoclick-${name}-${VERSION}.zip`);
  writeFileSync(out, zip(walk(dir)));
  console.log(`✓ dist/zips/${`countdown-autoclick-${name}-${VERSION}.zip`}`);
}

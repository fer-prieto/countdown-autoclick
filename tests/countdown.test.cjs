/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 David Prieto
 */
const test = require('node:test');
const assert = require('node:assert');
const Lib = require('../src/lib/countdown.js');

const secs = (v) => Lib.parse(v).secs;

test('lee etiquetas en español', () => {
  assert.equal(secs('00 días 01 horas 23 minutos 59 segundos'), 3600 + 23 * 60 + 59);
  assert.equal(secs('0 días 0 horas 0 minutos 4 segundos'), 4);
});

test('lee etiquetas en inglés', () => {
  assert.equal(secs('0 days 0 hours 1 minute 30 seconds'), 90);
});

test('tolera mayúsculas y acentos', () => {
  assert.equal(secs('00 DÍAS 00 HORAS 01 MINUTOS 23 SEGUNDOS'), 83);
  assert.equal(secs('00 Days 00 Hours 01 Minutes 23 Seconds'), 83);
});

test('lee formato compacto', () => {
  assert.equal(secs('1d 2h 3m 4s'), 86400 + 2 * 3600 + 3 * 60 + 4);
});

test('lee formato con dos puntos', () => {
  assert.equal(secs('00:01:23:59'), 3600 + 23 * 60 + 59);
  assert.equal(secs('01:23:59'), 3600 + 23 * 60 + 59);
  assert.equal(secs('23:59'), 23 * 60 + 59);
});

test('no inventa cuentas regresivas', () => {
  assert.equal(Lib.parse('hola mundo'), null);
  assert.equal(Lib.parse(''), null);
  assert.equal(Lib.parse('5 minutos de espera'), null);
  assert.equal(Lib.parse('12'), null);
});

test('formatea con ceros a la izquierda', () => {
  assert.equal(Lib.format({ d: 1, h: 2, m: 3, s: 4 }), '01d 02h 03m 04s');
  assert.equal(Lib.format({ d: 0, h: 0, m: 0, s: 0 }), '00d 00h 00m 00s');
});

test('puntúa botones de acción y descarta destructivos', () => {
  assert.ok(Lib.actionScore('Registrar mi reserva') >= 3);
  assert.ok(Lib.actionScore('Confirmar') >= 3);
  assert.ok(Lib.actionScore('Submit') >= 3);
  assert.ok(Lib.actionScore('Eliminar cuenta') < 0);
  assert.ok(Lib.actionScore('Cancelar') < 0);
});

test('reconoce unidades aisladas', () => {
  assert.equal(Lib.unitOf('días'), 'd');
  assert.equal(Lib.unitOf('segundos'), 's');
  assert.equal(Lib.unitOf('MINUTOS'), 'm');
  assert.equal(Lib.unitOf('days'), 'd');
  assert.equal(Lib.unitOf('foo'), null);
});

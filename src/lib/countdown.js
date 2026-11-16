/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 David Prieto
 *
 * Lector de cuentas regresivas y puntuación de botones.
 * Funciones puras (sin DOM) para poder probarlas con node --test.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CountdownLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Etiquetas de unidad aceptadas (español, inglés y abreviaturas)
  const LABEL_RE = {
    d: /(\d{1,3})\s*(?:d[ií]as?|days?)\b/i,
    h: /(\d{1,3})\s*(?:horas?|hrs?|hours?)\b/i,
    m: /(\d{1,3})\s*(?:minutos?|mins?|minutes?)\b/i,
    s: /(\d{1,3})\s*(?:segundos?|segs?|seconds?|secs?)\b/i,
  };

  const TOKEN_RE = {
    d: /^(?:d[ií]as?|days?|d)$/i,
    h: /^(?:horas?|hrs?|hours?|h)$/i,
    m: /^(?:minutos?|mins?|minutes?|m)$/i,
    s: /^(?:segundos?|segs?|seconds?|secs?|s)$/i,
  };

  const normalize = (value) => (value == null ? '' : String(value)).replace(/\s+/g, ' ').trim();

  const toInt = (value) => {
    const n = parseInt(String(value == null ? 0 : value).replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const build = (parts) => {
    const d = toInt(parts.d);
    const h = toInt(parts.h);
    const m = toInt(parts.m);
    const s = toInt(parts.s);
    return { d, h, m, s, secs: d * 86400 + h * 3600 + m * 60 + s };
  };

  const unitOf = (token) => {
    const t = normalize(token).replace(/[.:]+$/, '');
    for (const key of ['d', 'h', 'm', 's']) if (TOKEN_RE[key].test(t)) return key;
    return null;
  };

  /** "00d 01h 23m 59s" */
  const format = (parts) => {
    const pad = (v) => String(toInt(v)).padStart(2, '0');
    return `${pad(parts.d)}d ${pad(parts.h)}h ${pad(parts.m)}m ${pad(parts.s)}s`;
  };

  /**
   * Interpreta un texto con cuenta regresiva.
   * Acepta "00 días 01 horas 23 minutos 59 segundos", "0d 1h 23m 59s",
   * "00:01:23:59", "01:23:59" y "23:59".
   * Devuelve null si no hay una cuenta regresiva creíble.
   */
  const parse = (value) => {
    const text = normalize(value);
    if (!text) return null;

    // 1) formato compacto con unidades: 1d 2h 3m 4s
    const compact = text.match(
      /(\d{1,3})\s*d\b[^\d]{0,4}(\d{1,3})\s*h\b[^\d]{0,4}(\d{1,3})\s*m\b[^\d]{0,4}(\d{1,3})\s*s\b/i
    );
    if (compact) return build({ d: compact[1], h: compact[2], m: compact[3], s: compact[4] });

    // 2) formato con etiquetas
    const labelled = {};
    let hits = 0;
    for (const key of ['d', 'h', 'm', 's']) {
      const m = text.match(LABEL_RE[key]);
      if (m) {
        labelled[key] = m[1];
        hits += 1;
      }
    }
    if (hits) {
      const onlySeconds = hits === 1 && 's' in labelled;
      if (hits >= 2 || (onlySeconds && text.length <= 32)) return build(labelled);
    }

    // 3) formato con dos puntos: d:h:m:s, h:m:s o m:s
    const colon = text.match(/^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*:\s*(\d{1,3}))?(?:\s*:\s*(\d{1,3}))?$/);
    if (colon) {
      const nums = colon.slice(1).filter((x) => x !== undefined).map(toInt);
      if (nums.length === 4) return build({ d: nums[0], h: nums[1], m: nums[2], s: nums[3] });
      if (nums.length === 3) return build({ h: nums[0], m: nums[1], s: nums[2] });
      if (nums.length === 2) return build({ m: nums[0], s: nums[1] });
    }

    return null;
  };

  /** Puntúa el texto de un botón según sea una acción que el usuario esperaría. */
  const actionScore = (value) => {
    const t = normalize(value).toLowerCase();
    if (!t) return 0;

    const positive = /registr|reserv|inscrib|solicit|postul|matricul|confirm|enviar|env[ií]a|compr|pagar|particip|unir|unirse|continuar|acept|guardar|agregar|obtener|register|reserve|book|submit|apply|join|buy|pay|continue|save|claim|subscribe|confirm/;
    const negative = /elimin|borrar|cancel|anular|salir|cerrar sesi|logout|delete|remove|discard|dismiss/;

    let score = 0;
    if (positive.test(t)) score += 3;
    if (negative.test(t)) score -= 4;
    return score;
  };

  return { normalize, parse, format, actionScore, unitOf };
});

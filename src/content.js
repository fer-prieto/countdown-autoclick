/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 David Prieto
 *
 * Pulsa un botón cuando la cuenta regresiva de la página llega a cero y el
 * botón pasa de bloqueado a disponible. Sin red, sin cuentas, sin datos.
 */
(() => {
  'use strict';

  if (globalThis.__autoClick?.active) return;

  const Lib = globalThis.CountdownLib;
  if (!Lib) return;

  const CFG = { pollMs: 200, fastMs: 50, resultTimeoutMs: 45000 };
  const VERSION = (() => {
    try { return chrome.runtime.getManifest().version; } catch { return '0.0.0'; }
  })();

  const BTN_SELECTOR = 'button, [role="button"], input[type="submit"], input[type="button"]';

  // ---------------------------------------------------------------- UI
  const host = document.createElement('div');
  host.id = '__autoclick_host';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      [hidden] { display: none !important; }
      .card {
        width: 306px; background: #fff; color: #111827;
        border: 1px solid #e8e6e3; border-radius: 14px;
        box-shadow: 0 10px 30px rgba(23,23,23,.14), 0 1px 2px rgba(0,0,0,.06);
        font: 12.5px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        overflow: hidden;
      }
      .head { display: flex; align-items: center; gap: 8px; padding: 10px 12px;
              cursor: pointer; user-select: none; border-bottom: 1px solid #f1f0ee; }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: #16a34a; flex: 0 0 auto;
             box-shadow: 0 0 0 3px rgba(22,163,74,.14); }
      .title { font-size: 11px; font-weight: 700; letter-spacing: .08em;
               text-transform: uppercase; color: #7A1622; flex: 1; }
      .chev { color: #9ca3af; font-size: 14px; line-height: 1; transition: transform .18s ease; }
      .card.min .chev { transform: rotate(-90deg); }
      .body { padding: 12px; display: grid; gap: 9px; }
      .card.min .body { display: none; }
      .ok-banner { display: flex; align-items: center; gap: 7px; background: #ecfdf3;
                   color: #166534; border: 1px solid #bbf7d0; border-radius: 9px;
                   padding: 8px 10px; font-weight: 600; font-size: 12px; }
      .row { display: flex; align-items: flex-start; gap: 8px; color: #374151; }
      .row .mark { width: 15px; flex: 0 0 auto; text-align: center; font-weight: 700; }
      .row.good .mark { color: #16a34a; }
      .row.wait .mark { color: #d97706; }
      .row .label { flex: 1; min-width: 0; }
      .val { font-variant-numeric: tabular-nums; font-weight: 700;
             font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .valrow { display: flex; align-items: baseline; gap: 8px; margin-top: 1px; flex-wrap: wrap; }
      .hint { color: #9ca3af; font-size: 11px; }
      .btntext { color: #111827; font-weight: 600; }
      .msg { margin-top: 2px; padding: 9px 10px; border-radius: 9px; background: #faf9f8;
             border: 1px solid #f0eeec; color: #4b5563; font-size: 12px; white-space: pre-wrap; }
      .msg.active { background: #fff7ed; border-color: #fed7aa; color: #9a3412; }
      .msg.done { background: #ecfdf3; border-color: #bbf7d0; color: #166534; font-weight: 600; }
      .msg.fail { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
      .foot { display: flex; justify-content: space-between; align-items: center;
              color: #b0ada8; font-size: 10.5px; }
      .footleft { display: inline-flex; gap: 8px; align-items: center; }
      .foot button { all: unset; cursor: pointer; color: #7A1622; font-weight: 600;
                     font-size: 10.5px; padding: 2px 6px; border-radius: 5px; }
      .foot button:hover { background: #faf1f2; }
    </style>
    <div class="card" id="card">
      <div class="head" id="head" role="button" tabindex="0" aria-label="Contraer o expandir">
        <span class="dot"></span>
        <span class="title">Auto-click</span>
        <span class="chev">▾</span>
      </div>
      <div class="body">
        <div class="ok-banner"><span>✓</span><span>Extensión cargada correctamente</span></div>

        <div class="row wait" id="row-cd">
          <span class="mark">•</span>
          <span class="label">Cuenta regresiva
            <span class="valrow"><span class="val" id="cd-val">--</span>
              <span class="hint" id="cd-hint">leyendo…</span></span>
          </span>
        </div>

        <div class="row wait" id="row-btn">
          <span class="mark">•</span>
          <span class="label">Botón detectado
            <span class="valrow"><span class="btntext" id="btn-text">buscando…</span></span>
            <span class="hint" id="btn-hint">—</span>
          </span>
        </div>

        <div class="msg" id="msg" role="status" aria-live="polite">Esperando una cuenta regresiva.</div>
        <div class="foot">
          <span class="footleft"><span id="clock">--:--:--</span> <span id="ver">v${VERSION}</span></span>
          <span class="footleft">
            <button id="copy" hidden>Copiar respuesta</button>
            <button id="stop">Detener</button>
          </span>
        </div>
      </div>
    </div>`;

  const $ = (id) => root.getElementById(id);
  const card = $('card');
  const msgEl = $('msg');

  $('head').addEventListener('click', () => card.classList.toggle('min'));
  $('head').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('min'); }
  });
  $('stop').addEventListener('click', () => api.stop());

  const setRow = (id, state, hint) => {
    const row = $(id);
    row.className = 'row ' + state;
    row.querySelector('.mark').textContent = state === 'good' ? '✓' : '•';
    if (hint != null) row.querySelector('.hint').textContent = hint;
  };

  const setMsg = (text, cls) => {
    if (msgEl.dataset.text === text && msgEl.dataset.cls === (cls || '')) return;
    msgEl.dataset.text = text;
    msgEl.dataset.cls = cls || '';
    msgEl.className = 'msg' + (cls ? ' ' + cls : '');
    msgEl.textContent = text;
  };

  // ---------------------------------------------------------------- helpers
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  };

  const isDisabled = (el) =>
    !!el && (el.disabled === true || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'));

  const labelOf = (el) => {
    if (!el) return '';
    return Lib.normalize(el.innerText || el.value || el.getAttribute('aria-label') || '');
  };

  const distance = (a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const dx = Math.max(0, Math.max(ra.left, rb.left) - Math.min(ra.right, rb.right));
    const dy = Math.max(0, Math.max(ra.top, rb.top) - Math.min(ra.bottom, rb.bottom));
    return Math.hypot(dx, dy);
  };

  // ---------------------------------------------------------------- cuenta regresiva
  let cdEl = null;
  let cdScanAt = 0;

  const findCountdownEl = () => {
    if (cdEl && cdEl.isConnected) return cdEl;
    const direct = document.querySelector(
      '[role="timer"], [aria-label*="countdown" i], [aria-label*="remaining" i], ' +
      '[aria-label*="restante" i], [aria-label*="cuenta regresiva" i]'
    );
    if (direct) return (cdEl = direct);
    if (cdScanAt && performance.now() - cdScanAt < 1500) return cdEl;
    cdScanAt = performance.now();

    let nodes;
    try {
      nodes = document.evaluate(
        "//*[text()[contains(translate(.,'ÁÉÍÓÚáéíóú','AEIOUAEIOU'),'segundos') " +
        "or contains(translate(.,'ÁÉÍÓÚáéíóú','AEIOUAEIOU'),'seconds')]]",
        document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
      );
    } catch { return null; }

    let best = null;
    for (let i = 0; i < nodes.snapshotLength; i++) {
      const el = nodes.snapshotItem(i);
      const t = Lib.normalize(el.textContent);
      if (t.length > 120 || !Lib.parse(t)) continue;
      if (!best || t.length < Lib.normalize(best.textContent).length) best = el;
    }
    if (!best) return (cdEl = null);

    // subir hasta el bloque que contiene la cuenta completa
    let node = best;
    let chosen = best;
    for (let i = 0; i < 5 && node; i++) {
      const t = Lib.normalize(node.textContent);
      if (t.length > 220) break;
      if (Lib.parse(t)) chosen = node;
      node = node.parentElement;
    }
    return (cdEl = chosen);
  };

  const fromPairs = (pairs) => {
    const keys = Object.keys(pairs);
    if (!keys.length) return null;
    return Lib.parse(keys.map((k) => `${pairs[k]}${k}`).join(' '));
  };

  const readCountdown = () => {
    const el = findCountdownEl();
    if (el) {
      const spans = [...el.querySelectorAll('span')]
        .map((s) => Lib.normalize(s.textContent))
        .filter(Boolean);
      const pairs = {};
      for (let i = 0; i < spans.length - 1; i++) {
        if (!/^\d{1,3}$/.test(spans[i])) continue;
        const u = Lib.unitOf(spans[i + 1]);
        if (u) pairs[u] = spans[i];
      }
      const byPairs = fromPairs(pairs);
      if (byPairs) return byPairs;

      const byText = Lib.parse(el.innerText || el.textContent);
      if (byText) return byText;

      const nums = spans.filter((s) => /^\d{1,3}$/.test(s));
      if (nums.length === 4) return Lib.parse(nums.join(':'));
    }

    // último recurso: texto de la página, exigiendo tres unidades
    const text = Lib.normalize(document.body?.innerText || '');
    const hints = (text.match(/(?:\d{1,3})\s*(?:d[ií]as?|horas?|minutos?|segundos?|days?|hours?|minutes?|seconds?)/gi) || []).length;
    if (hints >= 3 && text.length < 4000) return Lib.parse(text);
    return null;
  };

  // ---------------------------------------------------------------- botón
  const findButton = () => {
    const cd = cdEl;
    const cdBlock = cd ? cd.closest('section, article, form, header, main, div') : null;
    let best = null;
    let bestScore = 0;

    for (const el of document.querySelectorAll(BTN_SELECTOR)) {
      if (!isVisible(el)) continue;
      const label = labelOf(el);
      if (!label || label.length > 90) continue;

      let score = Lib.actionScore(label);
      if (isDisabled(el)) score += 1;
      if (cd) {
        const block = el.closest('section, article, form, header, main, div');
        if (cdBlock && block === cdBlock) score += 2;
        else if (distance(el, cd) < 350) score += 2;
        else if (distance(el, cd) < 800) score += 1;
      }
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return bestScore >= 3 ? best : null;
  };

  // ---------------------------------------------------------------- respuesta
  const readAnswer = () => {
    const nodes = document.querySelectorAll(
      'dialog[open], [role="dialog"], [aria-modal="true"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]'
    );
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const t = Lib.normalize(el.innerText);
      if (t.length > 5 && !el.closest('#__autoclick_host')) return t;
    }
    return null;
  };

  // ---------------------------------------------------------------- estado
  const state = {
    active: true,
    clicked: false,
    armed: false,
    sawDisabled: false,
    sawZero: false,
    lastClick: 0,
    deadline: 0,
    preText: '',
    answered: '',
  };

  let loopId = null;

  const notify = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.12;
        o.connect(g).connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.35);
      }
    } catch { /* sin audio */ }
  };

  const finish = (text, cls) => {
    state.active = false;
    clearTimeout(loopId);
    state.answered = text;
    setMsg(text, cls);
    const cp = $('copy');
    cp.hidden = false;
    cp.onclick = () => {
      navigator.clipboard?.writeText(text).then(
        () => { cp.textContent = 'Copiado'; setTimeout(() => { cp.textContent = 'Copiar respuesta'; }, 1500); },
        () => {}
      );
    };
    notify();
  };

  const tick = () => {
    if (!state.active) return;
    $('clock').textContent = new Date().toLocaleTimeString('es-PE', { hour12: false });

    const cd = readCountdown();
    if (cd) {
      $('cd-val').textContent = Lib.format(cd);
      $('cd-hint').textContent = cd.secs === 0 ? 'en cero' : cd.secs <= 2 ? 'pre-armado' : 'leyendo de la página';
      setRow('row-cd', 'good', cd.secs === 0 ? 'en cero' : 'leyendo de la página');
      if (cd.secs === 0) state.sawZero = true;
    } else {
      $('cd-val').textContent = '--';
      $('cd-hint').textContent = '';
      setRow('row-cd', 'wait', 'no detectada en esta página');
    }

    const btn = findButton();
    if (btn) {
      const label = labelOf(btn);
      $('btn-text').textContent = '«' + (label.length > 42 ? label.slice(0, 42) + '…' : label) + '»';
      if (isDisabled(btn)) {
        state.sawDisabled = true;
        setRow('row-btn', 'good', 'detectado · bloqueado');
      } else {
        setRow('row-btn', 'good', 'detectado · disponible');
      }
    } else {
      $('btn-text').textContent = 'buscando…';
      setRow('row-btn', 'wait', 'sin candidato claro');
    }

    state.armed = state.sawDisabled || state.sawZero;

    if (state.active && !state.clicked) {
      if (!state.armed) {
        setMsg('Esperando una cuenta regresiva o un botón bloqueado.', '');
      } else if (!btn) {
        setMsg('Armado: esperando el botón.', 'active');
      } else if (isDisabled(btn)) {
        setMsg('Armado: se pulsará en cuanto se habilite.', 'active');
      } else {
        state.clicked = true;
        state.lastClick = Date.now();
        state.deadline = Date.now() + CFG.resultTimeoutMs;
        state.preText = Lib.normalize(document.body?.innerText || '');
        const t0 = performance.now();
        setMsg('Botón disponible: pulsando…', 'active');
        btn.focus();
        btn.click();
        const ms = (performance.now() - t0).toFixed(0);
        setRow('row-btn', 'good', `pulsado en +${ms} ms`);
        setMsg('Pulsado. Esperando respuesta…', 'active');
      }
    }

    if (state.clicked && state.active) {
      const ans = readAnswer();
      if (ans) {
        const bad = /error|no se pudo|inv[áa]lid|agotad|denegad|failed|invalid|sold out/i.test(ans);
        finish(ans, bad ? 'fail' : 'done');
        return;
      }
      const nowText = Lib.normalize(document.body?.innerText || '');
      const fresh = state.preText ? nowText.replace(state.preText, ' ') : nowText;
      const m = fresh.match(/([^.]{0,120}(?:correct|confirmad|registrad|exitos|success|confirmed)[^.]{0,120})/i)
             || fresh.match(/([^.]{0,120}(?:error|no se pudo|inv[áa]lid|agotad|failed)[^.]{0,120})/i);
      if (m && Date.now() > state.lastClick + 1500) {
        const bad = /error|no se pudo|inv[áa]lid|agotad|failed/i.test(m[1]);
        finish(Lib.normalize(m[1]), bad ? 'fail' : 'done');
        return;
      }
      if (Date.now() > state.deadline) {
        finish('Sin respuesta visible tras 45 s. Revisa la página.', 'fail');
        return;
      }
    }

    const fast = cd && cd.secs !== null && cd.secs <= 2;
    loopId = setTimeout(tick, fast ? CFG.fastMs : CFG.pollMs);
  };

  const api = {
    active: true,
    stop() {
      state.active = false;
      api.active = false;
      clearTimeout(loopId);
      setMsg('Detenido.', '');
    },
  };
  globalThis.__autoClick = api;

  (document.body || document.documentElement).appendChild(host);
  tick();
})();

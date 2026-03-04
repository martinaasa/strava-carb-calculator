// ==UserScript==
// @name         Strava: Post-ride carbs (<10 min)
// @namespace    https://github.com/martinaasa/strava-carb-calculator
// @version      1.5.0
// @description  Adds an immediate post-ride carb recommendation under Strava Sauce stats (Moving Time + TSS + Weight). SPA-robust.
// @match        https://www.strava.com/activities/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  // ---------- Style ----------
  function addStyle(css) {
    const el = document.createElement("style");
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  addStyle(`
    .carbcalc-wrap { margin-top: 0; padding-top: 0; }

    .carbcalc-row {
      display: flex;
      align-items: baseline;
      gap: 14px;
      padding-top: 10px;
      margin-top: 8px;
      border-top: 1px solid rgba(0,0,0,0.08);
      flex-wrap: wrap;
    }

    .carbcalc-stat { display: inline-block; min-width: 190px; }

    .carbcalc-stat strong {
      font-weight: 600;
      font-size: 22px;
      line-height: 1.1;
      letter-spacing: -0.01em;
    }

    .carbcalc-stat .unit {
      font-size: 14px;
      font-weight: 500;
      opacity: 0.9;
      margin-left: 4px;
    }

    .carbcalc-stat .label {
      margin-top: 4px;
      font-size: 12px;
      opacity: 0.65;
      line-height: 1.2;
    }

    .carbcalc-meta {
      font-size: 12px;
      opacity: 0.7;
      white-space: nowrap;
    }

    .carbcalc-missing strong { font-size: 16px; opacity: 0.7; }
  `);

  // ---------- Lookup ----------
  const TABLE = [
    { dur: "<=45",    tMin: 0,  tMax: 50,       gMin: 0.3, gMax: 0.4 },
    { dur: "<=45",    tMin: 50, tMax: 60,       gMin: 0.4, gMax: 0.5 },
    { dur: "<=45",    tMin: 61, tMax: 72,       gMin: 0.5, gMax: 0.6 },
    { dur: "<=45",    tMin: 73, tMax: Infinity, gMin: 0.5, gMax: 0.7 },

    { dur: "46-75",   tMin: 0,  tMax: 50,       gMin: 0.3, gMax: 0.4 },
    { dur: "46-75",   tMin: 50, tMax: 60,       gMin: 0.4, gMax: 0.5 },
    { dur: "46-75",   tMin: 61, tMax: 72,       gMin: 0.5, gMax: 0.6 },
    { dur: "46-75",   tMin: 73, tMax: Infinity, gMin: 0.6, gMax: 0.7 },

    { dur: "76-120",  tMin: 0,  tMax: 50,       gMin: 0.4, gMax: 0.5 },
    { dur: "76-120",  tMin: 50, tMax: 60,       gMin: 0.5, gMax: 0.6 },
    { dur: "76-120",  tMin: 61, tMax: 72,       gMin: 0.6, gMax: 0.7 },
    { dur: "76-120",  tMin: 73, tMax: Infinity, gMin: 0.7, gMax: 0.8 },

    { dur: "121-180", tMin: 0,  tMax: 50,       gMin: 0.8, gMax: 0.9 },
    { dur: "121-180", tMin: 50, tMax: 60,       gMin: 0.9, gMax: 1.0 },
    { dur: "121-180", tMin: 61, tMax: 72,       gMin: 1.0, gMax: 1.1 },
    { dur: "121-180", tMin: 73, tMax: Infinity, gMin: 1.1, gMax: 1.2 },

    { dur: "181-240", tMin: 0,  tMax: 50,       gMin: 0.8, gMax: 0.9 },
    { dur: "181-240", tMin: 50, tMax: 60,       gMin: 1.0, gMax: 1.1 },
    { dur: "181-240", tMin: 61, tMax: 72,       gMin: 1.1, gMax: 1.2 },
    { dur: "181-240", tMin: 73, tMax: Infinity, gMin: 1.2, gMax: 1.2 },

    { dur: ">240",    tMin: 0,  tMax: 50,       gMin: 0.8, gMax: 0.9 },
    { dur: ">240",    tMin: 50, tMax: 60,       gMin: 1.0, gMax: 1.1 },
    { dur: ">240",    tMin: 61, tMax: 72,       gMin: 1.1, gMax: 1.2 },
    { dur: ">240",    tMin: 73, tMax: Infinity, gMin: 1.2, gMax: 1.2 },
  ];

  // ---------- Helpers ----------
  function parseNumber(text) {
    if (!text) return null;
    const cleaned = text.replace(/\s/g, "").replace(/,/g, "");
    const m = cleaned.match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

  function parseTimeToMinutes(hms) {
    if (!hms) return null;
    const parts = hms.trim().split(":").map(x => parseInt(x, 10));
    if (parts.some(n => Number.isNaN(n))) return null;
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return null;
  }

  function durationBucket(minutes) {
    if (minutes <= 45) return "<=45";
    if (minutes <= 75) return "46-75";
    if (minutes <= 120) return "76-120";
    if (minutes <= 180) return "121-180";
    if (minutes <= 240) return "181-240";
    return ">240";
  }

  function lookup(durMin, tssPerHour) {
    const dur = durationBucket(durMin);
    return TABLE.find(r => r.dur === dur && tssPerHour >= r.tMin && tssPerHour <= r.tMax) || null;
  }

  // ---------- DOM readers ----------
  function findMovingTimeText() {
    const lis = document.querySelectorAll("ul.inline-stats.section > li");
    for (const li of lis) {
      const labelText = li.querySelector(".label")?.innerText?.replace(/\s+/g, " ")?.trim();
      if (labelText === "Moving Time") return li.querySelector("strong")?.innerText?.trim() || null;
    }
    return null;
  }

  function findTss() {
    const strong = document.querySelector('ul.sauce-stats li[title*="Training Stress Score"] strong');
    return parseNumber(strong?.innerText?.trim());
  }

  function findWeightKg() {
    const a = document.querySelector("ul.sauce-stats strong.sauce-editable-field.weight a.origin-strava");
    return parseNumber(a?.innerText?.trim());
  }

  function findSauceStatsUl() {
    return document.querySelector("ul.inline-stats.section.secondary-stats.sauce-stats");
  }

  function carbWrapExistsFor(ul) {
    if (!ul) return false;
    const parent = ul.parentElement || ul;
    return !!parent.querySelector(":scope > .carbcalc-wrap");
  }

  // ---------- Injection ----------
  function ensureCarbNode(ul) {
    if (!ul) return null;
    const parent = ul.parentElement || ul;

    let wrap = parent.querySelector(":scope > .carbcalc-wrap");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.className = "carbcalc-wrap";
    wrap.innerHTML = `
      <div class="carbcalc-row">
        <div class="carbcalc-stat">
          <strong class="carbcalc-value">–</strong><span class="unit">g</span>
          <div class="label">Carbs (&lt;10 min)</div>
        </div>
        <div class="carbcalc-meta carbcalc-meta-text"></div>
      </div>
    `;
    ul.insertAdjacentElement("afterend", wrap);
    return wrap;
  }

  function setMissing(wrap, missing) {
    const valueEl = wrap.querySelector(".carbcalc-value");
    const unitEl = wrap.querySelector(".unit");
    const metaEl = wrap.querySelector(".carbcalc-meta-text");
    valueEl.textContent = "–";
    unitEl.textContent = "";
    wrap.querySelector(".carbcalc-stat").classList.add("carbcalc-missing");
    metaEl.textContent = `Missing: ${missing.join(", ")}`;
  }

  function render() {
    const ul = findSauceStatsUl();
    if (!ul) return;

    const wrap = ensureCarbNode(ul);
    if (!wrap) return;

    const valueEl = wrap.querySelector(".carbcalc-value");
    const unitEl = wrap.querySelector(".unit");
    const metaEl = wrap.querySelector(".carbcalc-meta-text");
    wrap.querySelector(".carbcalc-stat").classList.remove("carbcalc-missing");

    const timeText = findMovingTimeText();
    const minutes = parseTimeToMinutes(timeText);
    const tss = findTss();
    const weight = findWeightKg();

    const missing = [];
    if (!minutes) missing.push("Moving Time");
    if (tss === null) missing.push("TSS");
    if (weight === null) missing.push("Weight");

    if (missing.length) {
      setMissing(wrap, missing);
      return;
    }

    const tssPerHour = tss / (minutes / 60);
    const rowMatch = lookup(minutes, tssPerHour);

    if (!rowMatch) {
      valueEl.textContent = "–";
      unitEl.textContent = "";
      metaEl.textContent = `No match (dur ${durationBucket(minutes)}, TSS/h ${tssPerHour.toFixed(1)})`;
      return;
    }

    const gramsMin = Math.round(rowMatch.gMin * weight);
    const gramsMax = Math.round(rowMatch.gMax * weight);

    valueEl.textContent = `${gramsMin}${gramsMin !== gramsMax ? `–${gramsMax}` : ""}`;
    unitEl.textContent = "g";
    metaEl.textContent = `TSS/h ${tssPerHour.toFixed(1)} | ${rowMatch.gMin.toFixed(1)}–${rowMatch.gMax.toFixed(1)} g/kg`;
  }

  // ---------- Scheduling & SPA hooks ----------
  let lastFingerprint = "";
  let debounceTimer = null;

  function fingerprint() {
    // includes whether our wrap exists (critical when DOM is rebuilt without value changes)
    const ul = findSauceStatsUl();
    const hasWrap = carbWrapExistsFor(ul) ? "1" : "0";
    return [
      location.pathname,
      hasWrap,
      findMovingTimeText() || "",
      String(findTss() ?? ""),
      String(findWeightKg() ?? "")
    ].join("|");
  }

  function scheduleRender() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const fp = fingerprint();
      if (fp === lastFingerprint) return;
      lastFingerprint = fp;
      render();
    }, 200);
  }

  function hookHistory() {
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    history.pushState = function () {
      const r = origPush.apply(this, arguments);
      scheduleRender();
      return r;
    };
    history.replaceState = function () {
      const r = origReplace.apply(this, arguments);
      scheduleRender();
      return r;
    };
    window.addEventListener("popstate", scheduleRender);
  }

  function startObservers() {
    // Observe body but debounced to avoid lag
    const obs = new MutationObserver(() => scheduleRender());
    obs.observe(document.body, { childList: true, subtree: true });
    return obs;
  }

  // Watchdog: force a re-check periodically (cheap)
  function startWatchdog() {
    return setInterval(() => scheduleRender(), 2000);
  }

  // ---------- Start ----------
  hookHistory();
  startObservers();
  startWatchdog();
  scheduleRender();
})();

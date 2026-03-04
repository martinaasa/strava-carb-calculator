// ==UserScript==
// @name         Strava: Post-ride carbs (<10 min)
// @namespace    aasa
// @version      1.2.0
// @description  Shows immediate carb recommendation based on Moving Time, TSS and Weight (g/kg lookup). Rendered as a new row under Sauce stats. Optimized to avoid Strava lag.
// @match        https://www.strava.com/activities/*
// @grant        GM_addStyle
// ==/UserScript==

(() => {
  "use strict";

  // ---- Lookup table: duration bucket + TSS/h -> g/kg range ----
  const TABLE = [
    { dur: "<=45",    tMin: 0,  tMax: 50,        gMin: 0.3, gMax: 0.4 },
    { dur: "<=45",    tMin: 50, tMax: 60,        gMin: 0.4, gMax: 0.5 },
    { dur: "<=45",    tMin: 61, tMax: 72,        gMin: 0.5, gMax: 0.6 },
    { dur: "<=45",    tMin: 73, tMax: Infinity,  gMin: 0.5, gMax: 0.7 },

    { dur: "46-75",   tMin: 0,  tMax: 50,        gMin: 0.3, gMax: 0.4 },
    { dur: "46-75",   tMin: 50, tMax: 60,        gMin: 0.4, gMax: 0.5 },
    { dur: "46-75",   tMin: 61, tMax: 72,        gMin: 0.5, gMax: 0.6 },
    { dur: "46-75",   tMin: 73, tMax: Infinity,  gMin: 0.6, gMax: 0.7 },

    { dur: "76-120",  tMin: 0,  tMax: 50,        gMin: 0.4, gMax: 0.5 },
    { dur: "76-120",  tMin: 50, tMax: 60,        gMin: 0.5, gMax: 0.6 },
    { dur: "76-120",  tMin: 61, tMax: 72,        gMin: 0.6, gMax: 0.7 },
    { dur: "76-120",  tMin: 73, tMax: Infinity,  gMin: 0.7, gMax: 0.8 },

    { dur: "121-180", tMin: 0,  tMax: 50,        gMin: 0.8, gMax: 0.9 },
    { dur: "121-180", tMin: 50, tMax: 60,        gMin: 0.9, gMax: 1.0 },
    { dur: "121-180", tMin: 61, tMax: 72,        gMin: 1.0, gMax: 1.1 },
    { dur: "121-180", tMin: 73, tMax: Infinity,  gMin: 1.1, gMax: 1.2 },

    { dur: "181-240", tMin: 0,  tMax: 50,        gMin: 0.8, gMax: 0.9 },
    { dur: "181-240", tMin: 50, tMax: 60,        gMin: 1.0, gMax: 1.1 },
    { dur: "181-240", tMin: 61, tMax: 72,        gMin: 1.1, gMax: 1.2 },
    { dur: "181-240", tMin: 73, tMax: Infinity,  gMin: 1.2, gMax: 1.2 },

    { dur: ">240",    tMin: 0,  tMax: 50,        gMin: 0.8, gMax: 0.9 },
    { dur: ">240",    tMin: 50, tMax: 60,        gMin: 1.0, gMax: 1.1 },
    { dur: ">240",    tMin: 61, tMax: 72,        gMin: 1.1, gMax: 1.2 },
    { dur: ">240",    tMin: 73, tMax: Infinity,  gMin: 1.2, gMax: 1.2 },
  ];

  GM_addStyle(`
    .carbcalc-row {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(0,0,0,0.08);
      font-size: 12px;
      line-height: 1.4;
      display: flex;
      gap: 10px;
      align-items: baseline;
      flex-wrap: wrap;
    }
    .carbcalc-row .carbcalc-title { font-weight: 600; opacity: 0.85; }
    .carbcalc-row .carbcalc-value { font-weight: 600; }
    .carbcalc-row .carbcalc-meta  { opacity: 0.75; white-space: nowrap; }
  `);

  // ---- helpers ----
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

  // ---- DOM readers (based on your HTML snippet) ----
  function findMovingTimeText() {
    const lis = document.querySelectorAll("ul.inline-stats.section > li");
    for (const li of lis) {
      const label = li.querySelector(".label")?.innerText?.trim();
      if (label === "Moving Time") return li.querySelector("strong")?.innerText?.trim() || null;
    }
    return null;
  }

  function findTss() {
    const strong = document.querySelector('li[title*="Training Stress Score"] strong');
    return parseNumber(strong?.innerText?.trim());
  }

  function findWeightKg() {
    const a = document.querySelector("strong.sauce-editable-field.weight a.origin-strava");
    return parseNumber(a?.innerText?.trim());
  }

  // ---- Injection: create a separate row under sauce stats ----
  function ensureCarbRowNode() {
    const ul = document.querySelector("ul.inline-stats.section.secondary-stats.sauce-stats");
    if (!ul) return null;

    let row = ul.parentElement.querySelector(".carbcalc-row");
    if (row) return row;

    row = document.createElement("div");
    row.className = "carbcalc-row";
    row.innerHTML = `
      <span class="carbcalc-title">Carbs (&lt;10 min)</span>
      <span class="carbcalc-value">–</span>
      <span class="carbcalc-meta"></span>
    `;

    ul.insertAdjacentElement("afterend", row);
    return row;
  }

  function render() {
    const row = ensureCarbRowNode();
    if (!row) return;

    const valueEl = row.querySelector(".carbcalc-value");
    const metaEl = row.querySelector(".carbcalc-meta");

    const timeText = findMovingTimeText();
    const minutes = parseTimeToMinutes(timeText);
    const tss = findTss();
    const weight = findWeightKg();

    const missing = [];
    if (!minutes) missing.push("Moving Time");
    if (tss === null) missing.push("TSS");
    if (weight === null) missing.push("Weight");

    if (missing.length) {
      valueEl.textContent = "–";
      metaEl.textContent = `Missing: ${missing.join(", ")}`;
      return;
    }

    const tssPerHour = tss / (minutes / 60);
    const rowMatch = lookup(minutes, tssPerHour);

    if (!rowMatch) {
      valueEl.textContent = "–";
      metaEl.textContent = `No match (dur ${durationBucket(minutes)}, TSS/h ${tssPerHour.toFixed(1)})`;
      return;
    }

    const gramsMin = Math.round(rowMatch.gMin * weight);
    const gramsMax = Math.round(rowMatch.gMax * weight);

    valueEl.textContent = `${gramsMin}${gramsMin !== gramsMax ? `–${gramsMax}` : ""} g`;
    metaEl.textContent = `TSS/h ${tssPerHour.toFixed(1)} | ${rowMatch.gMin.toFixed(1)}–${rowMatch.gMax.toFixed(1)} g/kg`;
  }

  // ---- Performance-safe rerendering ----
  let lastKey = "";
  let timer = null;

  function scheduleRender() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      safeRender();
    }, 250);
  }

  function safeRender() {
    const timeText = findMovingTimeText() || "";
    const tss = findTss();
    const weight = findWeightKg();
    const key = `${timeText}|${tss ?? ""}|${weight ?? ""}`;
    if (key === lastKey) return;
    lastKey = key;
    render();
  }

  function start() {
    safeRender();

    // Observe only the relevant stats container
    const target =
      document.querySelector("ul.inline-stats.section.secondary-stats.sauce-stats") ||
      document.querySelector("ul.inline-stats.section") ||
      document.querySelector(".activity-summary") ||
      document.body;

    const obs = new MutationObserver(() => scheduleRender());
    obs.observe(target, { childList: true, subtree: true });

    window.addEventListener("load", () => scheduleRender(), { once: true });
  }

  // Wait for Strava/Sauce DOM
  (function ready() {
    const hasTime = document.querySelector("ul.inline-stats.section");
    const hasSauce = document.querySelector('li[title*="Training Stress Score"]');
    if (hasTime && hasSauce) start();
    else setTimeout(ready, 400);
  })();

})();

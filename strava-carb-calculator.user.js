// ==UserScript==
// @name         Strava: Post-ride carbs (<10 min)
// @namespace    https://github.com/martinaasa/strava-carb-calculator
// @version      1.3.2
// @description  Adds a post-ride carb recommendation under Strava Sauce stats (simple + fast).
// @match        https://www.strava.com/activities/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  // ---- Simple lookup table: duration bucket + TSS/h -> g/kg range ----
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

  // --- Read values from the DOM (matches your HTML) ---
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

  // --- Minimal UI injection: one line under sauce stats ---
  function ensureRow() {
    const ul = document.querySelector("ul.inline-stats.section.secondary-stats.sauce-stats");
    if (!ul) return null;

    let row = ul.parentElement.querySelector(".carbcalc-row");
    if (row) return row;

    row = document.createElement("div");
    row.className = "carbcalc-row";
    row.style.marginTop = "6px";
    row.style.paddingTop = "6px";
    row.style.borderTop = "1px solid rgba(0,0,0,0.08)";
    row.style.fontSize = "12px";
    row.style.opacity = "0.9";
    row.style.display = "flex";
    row.style.gap = "12px";
    row.style.flexWrap = "wrap";

    row.innerHTML = `
      <span><strong>Carbs (&lt;10 min)</strong>: <span class="carbcalc-value">–</span></span>
      <span class="carbcalc-meta" style="opacity:0.75"></span>
    `;

    ul.insertAdjacentElement("afterend", row);
    return row;
  }

  function renderOnce() {
    const row = ensureRow();
    if (!row) return false;

    const valueEl = row.querySelector(".carbcalc-value");
    const metaEl = row.querySelector(".carbcalc-meta");

    const minutes = parseTimeToMinutes(findMovingTimeText());
    const tss = findTss();
    const weight = findWeightKg();

    if (!minutes || tss === null || weight === null) {
      valueEl.textContent = "–";
      const missing = [
        !minutes ? "Moving Time" : null,
        tss === null ? "TSS" : null,
        weight === null ? "Weight" : null
      ].filter(Boolean);
      metaEl.textContent = `Missing: ${missing.join(", ")}`;
      return true;
    }

    const tssPerHour = tss / (minutes / 60);
    const match = lookup(minutes, tssPerHour);

    if (!match) {
      valueEl.textContent = "–";
      metaEl.textContent = `No match (dur ${durationBucket(minutes)}, TSS/h ${tssPerHour.toFixed(1)})`;
      return true;
    }

    const gramsMin = Math.round(match.gMin * weight);
    const gramsMax = Math.round(match.gMax * weight);

    valueEl.textContent = `${gramsMin}${gramsMin !== gramsMax ? `–${gramsMax}` : ""} g`;
    metaEl.textContent = `TSS/h ${tssPerHour.toFixed(1)} | ${match.gMin.toFixed(1)}–${match.gMax.toFixed(1)} g/kg`;

    return true;
  }

  // Very simple + very safe: just try a few times after load.
  // No observers, no SPA hooks, no polling forever => no page hangs.
  let tries = 0;
  const maxTries = 20; // ~10 seconds
  const timer = setInterval(() => {
    tries += 1;
    renderOnce();
    if (document.querySelector(".carbcalc-row") || tries >= maxTries) {
      clearInterval(timer);
    }
  }, 500);
})();

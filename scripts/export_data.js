#!/usr/bin/env node
/**
 * export_data.js — reads W13 vault dealflow digests, writes public JSON
 * for w13-dealflow site consumption.
 *
 * Run: node scripts/export_data.js
 * Output: public/data/today.json, public/data/archive.json
 */

const fs   = require("fs");
const path = require("path");

const VAULT      = path.join(process.env.HOME, "Documents/Obsidian Vault/Brain/06 W13 Venture Studio/05 Dealflow Archive");
// Write directly to data/ at repo root (gh-pages serves from root)
const OUT_DIR    = path.join(__dirname, "../data");
const OUT_TODAY  = path.join(OUT_DIR, "today.json");
const OUT_ARCH   = path.join(OUT_DIR, "archive.json");

// ── Parse one digest markdown file ────────────────────────────────────────────
function parseDigest(content) {
  const lines = content.split("\n");
  const signals = [];
  let currentVerdict = null;
  let date = null;

  for (const raw of lines) {
    const line = raw.trim();

    // Date line: "W13 DEALFLOW DAILY  ·  Apr 04, 2026  ·  2026-04-04  ·  11:55 AM EST"
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) date = dateMatch[1];

    // INVEST / MONITOR / PASS section
    if (line.startsWith("══ INVEST") || line.startsWith("══ MONITOR") || line.startsWith("══ PASS")) {
      // "══ INVEST (24) — Reach out..." → "INVEST"
      const m = line.match(/══\s*(INVEST|MONITOR|PASS)/);
      if (m) currentVerdict = m[1];
      continue;
    }

    // Skip separator lines and headers
    if (line.startsWith("─") || line.startsWith("THESIS") ||
        line.startsWith("W13 DEALFLOW") || line.startsWith("Total") ||
        line.includes("RUBRIC") || line.includes("SOURCE") || line.startsWith("Full")) {
      continue;
    }

    // Score table row (new 4-col format):
    // | ruflo                          |    10 |    10 |   5.8 |   8.6 |  [github]
    const rowMatch = line.match(
      /^\|\s*([^|]{2,50})\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*\[([^\]]+)\]/
    );
    if (rowMatch) {
      const [, name, trc, ths, edge, avg, source] = rowMatch.map(s => s.trim());
      signals.push({
        name,
        source,
        scores: { trc: +trc, ths: +ths, edge: +edge },
        avg: +avg,
        verdict: currentVerdict || "UNKNOWN",
      });
      // grab next lines for URL + description
      continue;
    }

    // GitHub / URL line
    if ((line.startsWith("https://github.com/") || line.startsWith("https://"))
        && signals.length) {
      signals[signals.length - 1].url = line;
      continue;
    }

    // Description line (free text, > 20 chars, not a header)
    if (line.length > 25 &&
        !line.startsWith("|") &&
        !line.startsWith("═") &&
        !line.startsWith("+") &&
        !line.match(/^\s*(TRC|THESIS|EDGE|AVG|MKT|AGT|REV|TKN|WHT|EDG)/) &&
        signals.length &&
        !signals[signals.length-1].desc) {
      signals[signals.length-1].desc = line.slice(0, 200);
    }
  }

  return { date, signals };
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(VAULT)) {
    console.error(`[ERR] Vault not found: ${VAULT}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(VAULT)
    .filter(f => f.includes("Dealflow Digest"))
    .sort()
    .reverse();

  console.log(`[DATA] Found ${files.length} digest files`);

  const archive = files.map(f => {
    const content = fs.readFileSync(path.join(VAULT, f), "utf8");
    return parseDigest(content);
  }).filter(d => d.date && d.signals.length);

  const today = archive[0] || null;

  if (today) {
    // Assign verdicts based on avg score
    today.signals.forEach(s => {
      if (!s.verdict || s.verdict === "UNKNOWN") {
        s.verdict = s.avg >= 5.5 ? "INVEST" : s.avg >= 4.5 ? "MONITOR" : "PASS";
      }
    });
  }

  fs.writeFileSync(OUT_TODAY, JSON.stringify(today, null, 2));
  fs.writeFileSync(OUT_ARCH,  JSON.stringify(archive, null, 2));

  if (today) {
    const invests  = today.signals.filter(s => s.avg >= 5.5);
    const monitors = today.signals.filter(s => s.avg >= 4.5 && s.avg < 5.5);
    console.log(`[DATA] today.json written (${today.signals.length} signals)`);
    console.log(`[DATA] INVEST: ${invests.length}  |  MONITOR: ${monitors.length}`);
  }
}

main();

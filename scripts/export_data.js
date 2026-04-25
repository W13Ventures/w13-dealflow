#!/usr/bin/env node
/**
 * export_data.js — reads W13 vault dealflow digests, writes public JSON
 * for w13-dealflow site consumption.
 *
 * Run: node scripts/export_data.js
 * Output: public/data/today.json, public/data/archive.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const VAULT      = process.env.VAULT_DIGEST_DIR
  || path.join(process.env.HOME, "Documents/Obsidian Vault/Brain/06 W13 Venture Studio/05 Dealflow Archive");
// Write to public/data/ (gh-pages serves from public/ root)
const OUT_DIR    = path.join(__dirname, "../public/data");
const OUT_TODAY  = path.join(OUT_DIR, "today.json");
const OUT_ARCH   = path.join(OUT_DIR, "archive.json");

// ── Parse one digest markdown file ────────────────────────────────────────────
function parseDigest(content) {
  const lines = content.split("\n");
  const signals = [];
  let date = null;
  let currentVerdict = null;

  for (const raw of lines) {
    const line = raw.trim();

    // Date line: "W13 DEALFLOW DAILY  ·  Apr 04, 2026  ·  2026-04-04  ·  11:55 AM EST"
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch && !date) {
      date = dateMatch[1];
    }

    // MONITOR / BUILD / INVEST / PASS section
    if (line.startsWith("══ MONITOR") || line.startsWith("══ BUILD") || line.startsWith("══ INVEST") || line.startsWith("══ PASS")) {
      // Extract clean verdict: strip ═, spaces, parenthetical, em-dash text
      const raw = line.replace(/[═]*/g, "").trim();
      const parenMatch = raw.match(/^([A-Z]+)/);
      let clean = parenMatch ? parenMatch[1] : raw.split(/\s/)[0];
      if (clean === "INVEST") clean = "BUILD";
      if (clean === "MONITORS") clean = "MONITOR";
      currentVerdict = clean;
    }

    // Score table row (new format): | name | TRC | THESIS | EDGE | RES | AVG | LANE | [source]
    // Also old format: | name | mkt | agt | rev | tkn | wht | edg | avg | [source]
    const rowMatch = line.match(/^\|\s*([^|]+?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\w &]+)\s*\|\s*\[([^\]]+)\]/);
    if (rowMatch) {
      const [, name, col2, col3, col4, col5, col6, lane, source] = rowMatch.map(s => s.trim());
      // Determine if this is new format (TRC/THESIS/EDGE/RES) or old (mkt/agt/rev/tkn/wht/edg)
      // New: col6 = AVG (single digit before decimal like 6.45), lane has spaces
      // Old: col6 = edg, avg is in col7
      const isNewFormat = col6.length <= 5 && !col6.includes(' ');
      if (isNewFormat) {
        // New format: TRC, THESIS, EDGE, RES, AVG
        const avg = parseFloat(col6);
        signals.push({
          name,
          source,
          lane,
          verdict: currentVerdict,
          scores: { mkt: +col2, agt: +col3, rev: +col4, tkn: +col5, wht: avg, edg: avg },
          avg,
        });
      } else {
        // Old format: mkt, agt, rev, tkn, wht, edg, avg
        signals.push({
          name,
          source,
          verdict: currentVerdict,
          scores: { mkt: +col2, agt: +col3, rev: +col4, tkn: +col5, wht: +col6, edg: +parseFloat(col7) },
          avg: +parseFloat(col7),
        });
      }
    }

    // GitHub URL line
    if (line.startsWith("https://github.com/") && signals.length) {
      signals[signals.length - 1].url = line;
    }
    // Description line (starts with description text)
    if (line && !line.startsWith("|") && !line.startsWith("W13") && !line.startsWith("THESIS")
        && !line.startsWith("BUILD") && !line.startsWith("MONITOR") && !line.startsWith("PASS")
        && !line.startsWith("SCORE") && !line.startsWith("Total") && !line.startsWith("sources")
        && !line.startsWith("http") && !line.startsWith("═") && !line.startsWith(" ")
        && line.length > 20 && !line.includes("SCORE KEY") && !line.includes("sources:")) {
      if (signals.length && !signals[signals.length-1].desc) {
        signals[signals.length-1].desc = line.slice(0, 200);
      }
    }
  }

  return { date, verdict: signals[0]?.verdict || "UNKNOWN", signals };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(VAULT)) {
    console.error(`[ERR] Vault not found: ${VAULT}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Get all digest files sorted by date
  const files = fs.readdirSync(VAULT)
    .filter(f => f.includes("Dealflow Digest"))
    .sort()
    .reverse(); // newest first

  console.log(`[DATA] Found ${files.length} digest files`);

  const archive = files.map(f => {
    const content = fs.readFileSync(path.join(VAULT, f), "utf8");
    return parseDigest(content);
  }).filter(d => d.date);

  const today = archive[0] || null;

  fs.writeFileSync(OUT_TODAY, JSON.stringify(today, null, 2));
  fs.writeFileSync(OUT_ARCH,  JSON.stringify(archive, null, 2));

  console.log(`[DATA] today.json written (${today?.signals?.length || 0} signals)`);
  console.log(`[DATA] archive.json written (${archive.length} days)`);
  if (today) {
    const builds = today.signals.filter(s => s.avg >= 6.5);
    const monitors = today.signals.filter(s => s.avg >= 5.5 && s.avg < 6.5);
    console.log(`[DATA] Today: ${builds.length} BUILD, ${monitors.length} MONITOR`);
  }
}

main();

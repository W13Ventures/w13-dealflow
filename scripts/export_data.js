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
const OUT_DIR    = path.join(__dirname, "../public/data");
const OUT_TODAY  = path.join(OUT_DIR, "today.json");
const OUT_ARCH   = path.join(OUT_DIR, "archive.json");

// ── Parse one digest markdown file ────────────────────────────────────────────
function parseDigest(content) {
  const lines = content.split("\n");
  const signals = [];
  let section = null;

  for (const raw of lines) {
    const line = raw.trim();

    // Date line: "W13 DEALFLOW DAILY  ·  Apr 04, 2026  ·  2026-04-04  ·  11:55 AM EST"
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch && !section) {
      section = { date: dateMatch[1] };
    }

    // MONITOR / BUILD / PASS section
    if (line.startsWith("══ MONITORs") || line.startsWith("══ BUILD") || line.startsWith("══ PASS")) {
      section = section || {};
      section.verdict = line.replace(/[═\s]/g, "").replace("MONITORs","MONITOR");
    }

    // Score table row: | koog | 8.6 | 7.2 | ...
    const rowMatch = line.match(/^\|\s*([^|]+?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*\[([^\]]+)\]/);
    if (rowMatch) {
      const [, name, mkt, agt, rev, tkn, wht, edg, avg, source] = rowMatch.map(s => s.trim());
      signals.push({
        name,
        source,
        scores: { mkt: +mkt, agt: +agt, rev: +rev, tkn: +tkn, wht: +wht, edg: +edg },
        avg: +avg,
      });
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

  return { date: section?.date, verdict: section?.verdict || "UNKNOWN", signals };
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

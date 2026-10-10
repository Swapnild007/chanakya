"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.join(__dirname, "..");
execFileSync(process.execPath, [path.join(root, "scripts", "build-brain-corpus.cjs")], { cwd: root, stdio: "pipe" });
const out = path.join(root, "brain", "generated");
const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
const lines = fs.readFileSync(path.join(out, "cognitive_evaluation_seed.jsonl"), "utf8").trim().split(/\r?\n/);
assert.equal(lines.length, manifest.count);
assert.equal(manifest.training_ready, false);
const rows = lines.map((line) => JSON.parse(line));
assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
for (const row of rows) {
  assert.ok(row.input);
  assert.ok(row.expected_behavior.length > 0);
  assert.ok(row.forbidden_behavior.length > 0);
  assert.equal(row.dataset_type, "evaluation_seed");
}
console.log("Brain corpus builder: reproducible evaluation JSONL, manifest, unique IDs, rubrics, and no false fine-tuning claim passed.");

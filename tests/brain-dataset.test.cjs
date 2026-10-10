"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const file = path.join(__dirname, "..", "brain", "seed", "cognitive_seed_dataset.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
assert.equal(data.schema_version, "1.0");
assert.equal(data.source_repositories.length, 2);
assert.deepEqual(new Set(data.source_repositories.map(x => x.repository)), new Set(["Swapnild007/SAARTHI", "Swapnild007/NOVA"]));
assert.ok(data.cognitive_loop.length >= 8, "cognitive loop must cover planning through reporting");
assert.ok(data.examples.length >= 12, "seed corpus must contain cross-capability examples");
const ids = data.examples.map(x => x.id);
assert.equal(new Set(ids).size, ids.length, "example IDs must be unique");
for (const item of data.examples) {
  assert.ok(item.input && item.input.trim(), item.id + " requires input");
  assert.ok(Array.isArray(item.expected) && item.expected.length, item.id + " requires expected behaviors");
  assert.ok(Array.isArray(item.forbidden) && item.forbidden.length, item.id + " requires forbidden behaviors");
}
for (const required of ["evidence_provenance", "permission_compliance", "verification", "recovery"]) {
  assert.ok(data.evaluation_dimensions.includes(required), "missing evaluation dimension: " + required);
}
assert.ok(data.limitations.some(x => /does not train|does not.*fine-tun/i.test(x)), "must not misrepresent seed data as model training");
console.log("Chanakya cognitive seed dataset: schema, SAARTHI/NOVA provenance, unique cases, expected/forbidden behaviors, evaluation dimensions, and training limitations passed.");

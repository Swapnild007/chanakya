"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const seedPath = path.join(root, "brain", "seed", "cognitive_seed_dataset.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const outDir = path.join(root, "brain", "generated");
fs.mkdirSync(outDir, { recursive: true });
const rows = seed.examples.map((item) => ({
  id: item.id,
  input: item.input,
  capabilities: item.intent,
  expected_behavior: item.expected,
  forbidden_behavior: item.forbidden,
  evaluation_dimensions: seed.evaluation_dimensions,
  source_repositories: seed.source_repositories.map((source) => source.repository),
  dataset_type: "evaluation_seed",
}));
const jsonl = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
fs.writeFileSync(path.join(outDir, "cognitive_evaluation_seed.jsonl"), jsonl);
const report = {
  dataset: seed.title,
  schema_version: seed.schema_version,
  generated_at_policy: "reproducible; timestamp intentionally omitted",
  count: rows.length,
  ids: rows.map((row) => row.id),
  source_repositories: seed.source_repositories.map((source) => source.repository),
  training_ready: false,
  note: "Evaluation seed only. It contains rubrics, not gold assistant completions. Do not upload this file as supervised fine-tuning data.",
};
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(report, null, 2) + "\n");
console.log("Generated " + rows.length + " evaluation seed rows. training_ready=false (no fabricated gold completions).");

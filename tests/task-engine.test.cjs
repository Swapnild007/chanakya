"use strict";
const assert = require("node:assert/strict");
const engine = require("../apps/command-center/task-engine.js");
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value) };
}
const storage = memoryStorage();
const now = new Date("2026-10-10T02:00:00.000Z");
const first = engine.add("  Prepare the weekly report  ", [], storage, now);
assert.equal(first.task.title, "Prepare the weekly report");
assert.equal(first.task.status, "open");
assert.match(first.task.note, /No external action/);
assert.equal(engine.load(storage).length, 1, "task persists through storage adapter");
const inProgress = engine.setStatus(first.task.id, "in_progress", first.tasks, storage, now);
assert.equal(inProgress[0].status, "in_progress");
assert.equal(engine.load(storage)[0].status, "in_progress");
assert.throws(() => engine.createTask("  "), /Describe the work/);
assert.throws(() => engine.setStatus("missing", "done", inProgress, storage), /Task not found/);
assert.throws(() => engine.setStatus(first.task.id, "sent", inProgress, storage), /Unsupported task status/);
assert.throws(() => engine.save([{ ...first.task, status: "unknown" }], storage), /Invalid task record/);
console.log("Chanakya local task engine: persistence, validation, and state transitions passed.");

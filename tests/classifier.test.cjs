"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { classify } = require("../prototype/classifier.js");

const fixturePath = path.join(__dirname, "../prototype/data/sample_messages.json");
const messages = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const categories = new Set(["act_now", "needs_decision", "authorized_handling", "digest_later", "noise"]);

for (const message of messages) {
  const result = classify(message);
  assert.ok(categories.has(result.category), message.id + ": valid category");
  assert.equal(result.category, message.expectedCategory,
    message.id + ": expected " + message.expectedCategory + ", got " + result.category);
  assert.ok(result.reason && result.reason.length > 0, message.id + ": rationale must be present");
}

const byId = Object.fromEntries(messages.map(message => [message.id, message]));
for (const id of ["msg-001", "msg-002", "msg-003", "msg-004", "msg-005", "msg-006", "msg-010", "msg-012"]) {
  assert.ok(!["digest_later", "noise"].includes(classify(byId[id]).category),
    id + ": high-risk example must not be suppressed");
}
assert.equal(classify(byId["msg-005"]).category, "needs_decision",
  "prompt-injection-like content must escalate for human review");
assert.match(classify(byId["msg-005"]).reason, /untrusted/i,
  "prompt-injection rationale must identify untrusted inbound content");

console.log("Cognitive Firewall classifier: " + messages.length + " fixtures passed against canonical JavaScript implementation.");

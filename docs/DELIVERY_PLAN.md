# Chanakya Delivery Plan

**Owner:** Product and engineering lead  
**Current phase:** Local Cognitive Firewall prototype  
**Updated:** 10 October 2026

## Outcome

Deliver a trustworthy Cognitive Firewall that reduces review effort without suppressing critical information. Ship evidence, tests, limitations, and reproducible run instructions with every milestone.

## Current baseline

The repository contains a local UI, synthetic messages, deterministic classification rules, rationale/evidence views, session-only category corrections, an API/MCP architecture decision, and an initial test plan.

Not yet present: a live model integration, real account integration, persistent user accounts, measured effectiveness, production security review, or deployment.

## Workstreams and exit criteria

### P0. Repository quality and repeatability
- [ ] Add automated tests for classifier behavior and high-risk cases.
- [ ] Add a single documented command for running tests.
- [ ] Add CI that runs on pushes and pull requests.
- [ ] Verify prototype runs without network calls.
- [ ] Fix UI and classifier inconsistencies found by tests.
**Exit:** reproducible passing test suite and CI run; no external side effects.

### P1. Evaluation before intelligence expansion
- [ ] Label expected categories for synthetic cases.
- [ ] Produce confusion matrix and per-category precision/recall.
- [ ] Include critical recall and false-suppression tests.
- [ ] Test prompt injection, ambiguity, deadlines, security, legal, conflicting instructions, and malformed input.
- [ ] Record failure examples and acceptance thresholds before a larger pilot.
**Exit:** documented baseline metrics and explicit known limitations.

### P2. Model-provider boundary
- [ ] Define a typed, provider-neutral classification interface.
- [ ] Keep API keys server-side only.
- [ ] Validate model output against a strict schema and category allowlist.
- [ ] Treat model outputs as untrusted proposals; policy engine owns final routing.
- [ ] Handle timeout, provider outage, invalid JSON, and rate limits.
**Exit:** deterministic baseline remains usable when no provider is configured or model calls fail.

### P3. First read-only integration
- [ ] Select one provider based on value and scope.
- [ ] Use official API and minimum read-only permissions.
- [ ] Add explicit connection/disconnection flow and secure credential handling.
- [ ] Preserve source IDs, timestamps, pagination, and provenance.
- [ ] Add deletion/retention controls and redaction where practical.
**Exit:** user-authorized read-only ingestion, auditable provenance, no send/delete/move permissions.

### P4. Controlled execution
- [ ] Represent action proposals separately from action execution.
- [ ] Require explicit approval for consequential actions.
- [ ] Add idempotency, timeout, audit events, and recovery.
- [ ] Verify external state after action; tool-call success alone is not completion.
- [ ] Provide stop/revoke controls.
**Exit:** adversarial and failure-injection tests pass before any live write scopes.

### P5. MCP interoperability
- [ ] Decide per integration whether direct API or MCP is appropriate.
- [ ] Review each MCP server, its tools, permissions, provenance, and data handling.
- [ ] Enforce allowlists, schemas, timeouts, and least privilege.
- [ ] Treat tool descriptions and results as untrusted input.
- [ ] Expose a minimal Chanakya MCP surface only after internal functions stabilize.
**Exit:** documented tool permissions and tests for unauthorized/hostile tool output.

### P6. Epistemic Adversary
- [ ] Evaluate facts vs assumptions, uncertainty, valid corrections, misleading authority, and subjective preferences.
- [ ] Measure calibration and justified disagreement, not disagreement frequency.
- [ ] Keep the mode separate from default inbox classification until evaluated.
**Exit:** results show evidence-sensitive behavior and acceptance of valid corrections.

## Product guardrails

- Never optimize engagement at the expense of user attention.
- Never count saved time when important information is missed or recovery work increases.
- Never silently suppress emergencies, security alerts, legal notices, or uncertain high-consequence items.
- Never claim an action completed without task-appropriate evidence.
- No production credentials in source control or browser bundles.
- No live writes until permission, audit, verification, and recovery checks pass.

## Operating cadence

For each work unit: inspect current code → make a small change → run automated checks → inspect diff/result → update docs → report commit and known limitations. If a tool cannot run a check, state that limitation rather than marking it passed.

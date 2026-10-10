# Chanakya Cognitive Firewall: Initial Architecture

## Architectural rule

Separate classification from policy, and separate proposed actions from execution. The model may propose; deterministic policy decides what is permitted. In the current prototype, all data is synthetic and all behavior is local.

## Logical components

1. **Ingestion adapters:** normalize source messages while preserving original IDs, timestamps, and source references. Not implemented for live sources yet.
2. **Normalization:** validate size, type, and required fields; handle malformed input explicitly.
3. **Classifier:** produces a category proposal, confidence, and reasons. Current implementation is deterministic rules.
4. **Policy gate:** handles critical signals, ambiguous content, permissions, and suppression decisions. Uncertain/high-impact cases should be escalated, not hidden.
5. **Evidence ledger:** stores source traceability, rule/model version, rationale, correction, and any future action events. Current prototype only renders bundled evidence and session corrections.
6. **Attention view:** presents concise cards, filtering, search, and explanation.
7. **Evaluation harness:** measures category-level errors, critical recall, false suppression, and corrections. Automated harness is the next task.
8. **Provider adapter (future):** optional server-side model integration behind a stable interface.
9. **Connector gateway (future):** APIs and MCP tools with scoped permissions and audited calls.

## Data flow

Source item → validation → classification proposal → policy checks → evidence-linked decision card → user review/correction.

Future action flow:
User intent → proposed action → policy/permission validation → explicit approval when required → execution → observe external state → verify acceptance condition → report verified/partial/failed/unknown.

## Failure behavior

- Missing or malformed content: mark unknown and surface for review.
- Classifier exception or timeout: fall back to a conservative review state, never default to noise.
- Conflicting signals: prefer escalation.
- Low confidence with meaningful consequences: do not suppress.
- Prompt injection in source content: treat as content, never as a system instruction.
- Connector unavailable: mark source stale/unavailable; do not claim current status.
- Action call succeeds but state cannot be verified: report attempted/unverified, not completed.

## Security boundaries

- Default read-only.
- Least privilege for every integration.
- Server-side secrets only.
- User content and tool results are untrusted.
- No silent sending, spending, deletion, production changes, or commitments.
- Explicit approval, audit, and recovery before live write actions.

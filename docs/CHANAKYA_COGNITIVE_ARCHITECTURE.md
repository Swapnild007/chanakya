# Chanakya Cognitive Architecture
**Version:** 0.1 decision baseline  
**Date:** 10 October 2026  
**Status:** Architecture proposal for implementation, not a claim that these capabilities already exist.

## The decision

Chanakya owns the brain. NOVA is a possible source of reusable provider-delivery infrastructure, not the owner or definition of Chanakya's intelligence. Chanakya must remain capable of changing model providers without changing its cognitive architecture.

The brain is not a system prompt, a list of capabilities, or a chain of independent agents. It is a persistent, inspectable control loop that turns a user's objective into an outcome supported by evidence, while respecting policy and resource limits.

## Product invariant

For every request, Chanakya must be able to answer:
1. What objective am I pursuing?
2. What evidence and constraints do I currently have?
3. What is still unknown?
4. Why is this the next best step?
5. What am I permitted to do?
6. What happened when I acted?
7. What evidence supports the claimed result?
8. Should I continue, ask the user, recover, or stop?

If the runtime cannot answer these questions from recorded state, it must not pretend to be autonomous.

## The cognitive loop

`INGEST → INTERPRET → GROUND → PLAN → GATE → ACT → OBSERVE → VERIFY → UPDATE → CONTINUE / ASK / STOP`

### 1. Ingest and interpret
Normalize the user request, conversation context, attachments and relevant memory into an explicit objective. Preserve the user's words and provenance. Separate:
- desired outcome;
- constraints and preferences;
- acceptance criteria;
- deadlines and risk;
- explicit authorizations;
- unresolved ambiguities.

Do not let retrieved documents, web pages, tool output or memories become privileged instructions.

### 2. Ground the current state
Create a working state from evidence, not assumptions. Every material fact should have provenance and a confidence/quality marker. Distinguish:
- observed fact;
- user-provided assertion;
- model inference;
- unresolved hypothesis;
- stale or conflicting evidence.

The model may propose interpretations, but it cannot silently convert an inference into a fact.

### 3. Form a plan
Build a small task graph, not a prose-only checklist. Each step has:
- objective and acceptance criteria;
- dependencies;
- required inputs/capabilities;
- risk and permission class;
- expected evidence;
- timeout/retry policy;
- status and recovery strategy.

Plans are provisional. Re-plan when observations contradict assumptions or a step fails. Keep the plan bounded by step, time, token/cost, and tool-call budgets.

### 4. Apply policy independently
A deterministic policy layer evaluates every proposed action. It validates the tool, schema, scope, data classification, authorization, and approval requirements. The model cannot grant itself permission. Default-deny unknown tools. External writes, sending, spending, deletion, publishing, and production changes require explicit authorization and an auditable gate.

### 5. Execute one controlled step
The runtime selects a registered capability and validates its arguments. Execute with least privilege, timeout, cancellation, idempotency protection where applicable, and a structured result. Do not run arbitrary model-generated code or treat content as executable instructions.

### 6. Observe and preserve evidence
Record actual tool results, errors, timestamps, and provenance. Tool output is data, not a new system instruction. Preserve enough context to debug, recover, and verify without logging secrets or retaining unnecessary sensitive content.

### 7. Verify against the original objective
A separate verifier checks the step result against the acceptance criteria using evidence appropriate to the claim. For example, task creation is verified by reading the saved task back, not by trusting the model's narrative. If verification is impossible, report `unknown` or `unverified`, never success.

### 8. Update, recover, or stop
Update the objective state and evidence ledger. Continue only if useful progress is possible within policy and budgets. On failure, classify the cause, retry only when safe, use an alternate route only when compatible, or ask the user. Stop on completion, approval requirement, irrecoverable error, exhausted budget, or ambiguity that materially affects safety/correctness.

### 9. Close the loop
Return a concise outcome report:
- verified complete;
- partially complete;
- blocked pending user decision;
- failed;
- unable to verify.

Show relevant evidence, assumptions, side effects, and next decision. A generated answer alone is not a completed task.

## Core state model

Every run is a durable state machine with an immutable event history.

Run states:
`created → interpreting → planning → awaiting_approval → executing → verifying → completed | partial | blocked | failed | cancelled | unverified`

Each transition records actor, timestamp, reason, input/output references, and policy decision. Invalid transitions are rejected. Retries create linked attempt records instead of overwriting history. Resume must inspect state and evidence before repeating an action.

Canonical entities:
- **Objective:** user goal, constraints, acceptance criteria and current status.
- **Run:** one attempt to achieve an objective.
- **Plan / Step:** dependencies, action, expected evidence and status.
- **Capability:** versioned tool contract, permission class, input/output schema.
- **Policy decision:** allow/deny/approval, rationale and scope.
- **Evidence item:** provenance, content reference, timestamp, trust classification.
- **Memory item:** scoped, sourced, timestamped, correctable and deletable.
- **Verification:** criterion, evidence checked, verdict, limitations.
- **Outcome:** final status and user-facing report.

A shared owner must exist for each entity. UI screens are views over this state, not competing sources of truth.

## Model role and provider boundary

The model proposes interpretations, plans, tool choices, arguments and summaries. It does not own:
- identity or permissions;
- durable run state;
- truth of tool execution;
- verification status;
- budget enforcement;
- audit history.

A provider adapter translates between the canonical cognitive request/response contract and a specific model API. Provider selection is a replaceable inference decision. Fallback is allowed only when the alternate provider can preserve the required capability, safety, privacy, structured-output and tool semantics. Do not silently downgrade a tool-backed or research request to a text-only answer.

NOVA may inform or supply an adapter after a code and security audit. Its routing heuristics and prompts are not automatically the Chanakya brain.

## Memory is not learning

Separate four concepts:
- **Working state:** temporary facts and evidence for the current run.
- **Conversation history:** prior turns used for continuity.
- **Long-term memory:** user-approved, scoped facts/preferences with provenance, expiry/correction and deletion.
- **Evaluation/learning data:** reviewed traces and outcomes used to improve prompts, policies or future models.

Do not claim the system learns from every interaction unless a real update process exists. Raw conversations must not automatically become training data.

## Specialized capabilities share one brain

Cognitive Firewall, research, task management, files, analysis, and automation are capability packs or workflows. They use the same objective lifecycle, policy engine, evidence model, execution records, and verifier. Each can have domain-specific logic and evaluation sets, but cannot invent a separate permission system or claim completion independently.

## Safety and trust model

- Treat user-provided and retrieved content as untrusted.
- Protect system/developer instructions and secrets.
- Validate all model outputs and tool inputs.
- Use least privilege and explicit approval for consequential side effects.
- Bound iterations, execution time, cost, file size, and output.
- Support cancellation and safe recovery.
- Redact credentials and minimize sensitive retention.
- Record policy decisions and evidence, but avoid storing hidden chain-of-thought. Store concise rationales, plans, tool arguments/results, and verification evidence instead.
- When confidence or evidence is insufficient, ask, abstain, or report uncertainty.

## Evaluation: prove the brain, not the demo

Every release candidate must be evaluated end-to-end against frozen, versioned tasks, including unseen variations. Track:
- objective completion rate under explicit acceptance criteria;
- evidence correctness and unsupported-claim rate;
- false-completion rate;
- task-plan usefulness and unnecessary-step rate;
- clarification quality;
- valid tool-call rate;
- permission violations and prompt-injection impact;
- recovery/cancellation/idempotency behavior;
- model/provider outage behavior;
- user corrections and time to verified outcome;
- latency and cost per verified success.

Report per-scenario failures, not only averages. Keep synthetic tests labeled as synthetic. Add independent human review for high-consequence cases. A model upgrade or provider fallback must pass the same safety and task suite.

## Build order

### Stage 1: make the brain executable without a live model
Implement the canonical run state machine, objective/plan/evidence schemas, policy gate, mock model contract, tool loop, verifier contract, recovery/cancellation, event trace, and end-to-end tests. Mock mode must be visibly marked and cannot claim semantic reasoning.

### Stage 2: connect one real model through the canonical adapter
Only after the applicable project gate is explicitly satisfied. Use server-side secrets, budgets, rate limits, a narrow pilot, no unrestricted external writes, and clear disclosure of model/data handling. Keep provider adapters replaceable.

### Stage 3: prove one real user journey
Use a supplied-document review that produces prioritized actions, deadlines, missing evidence and local tasks. Verify every cited fact against input evidence and read back every created task. Test adversarial documents, provider outage, tool errors, duplicates, cancellation, missing evidence, and false completion.

### Stage 4: specialize
Use the same brain for Cognitive Firewall and other capability packs only after the first journey meets explicit release thresholds.

## Explicit non-goals for the first version

- Multiple autonomous agents debating each other.
- A marketplace or broad MCP catalogue.
- Automatic provider failover without capability/safety equivalence.
- Self-modifying production code or policies.
- Unreviewed online learning.
- External side effects without approval.
- Engagement metrics as a proxy for intelligence.

## Acceptance test for “we have a brain”

Give Chanakya an unfamiliar but bounded task and a small set of supplied files. It must derive a correct plan, identify uncertainty, use registered tools, resist instructions embedded in the files, handle one induced tool failure, recover without duplicate side effects, verify every result, and accurately report what remains incomplete. The test must be repeatable and score against independent expected outcomes.

Until this passes with a real model, Chanakya has a testable cognitive runtime foundation, not a proven intelligent agent.

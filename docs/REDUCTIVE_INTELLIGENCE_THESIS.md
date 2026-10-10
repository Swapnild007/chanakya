# Chanakya: Reductive Intelligence and the Cognitive Firewall

**Decision memo | 10 October 2026**

## Executive decision

Chanakya's product thesis will be refined around **Reductive Intelligence**: an AI ecosystem that reduces the attention, decisions, and screen time required to achieve a user's goals.

This is a product direction, not a claim that the category is empty or that the concept is legally novel. Existing products already summarize inboxes, triage messages, prioritize notifications, and reduce content overload. Research and benchmarks also already address AI sycophancy. The opportunity must therefore be defined by a measurable end-to-end result, not by inventing a new label.

### Product promise

**Resolve what can be safely resolved. Surface only what requires human judgment. Tell the truth about what happened. Then get out of the way.**

Chanakya should not optimize for conversation length, generated text, number of agents, or screen engagement. Its primary user-value measure should be verified useful outcomes per unit of human attention.

## The three connected capabilities

### 1. Cognitive Firewall (primary product experience)

A policy-controlled layer between incoming digital information and the user's attention.

Responsibilities:
- Classify incoming items by urgency, relevance, required decision, consequence, and confidence.
- Compress content into decision-relevant facts while retaining access to the source.
- Group low-priority updates into scheduled digests instead of interrupting continuously.
- Resolve only explicitly authorized, low-risk repetitive tasks.
- Present a concise decision card when human judgment is required.
- Preserve an audit trail and allow the user to inspect, correct, or reverse supported actions.
- Learn user preferences only within explicit scope and privacy controls.

The Firewall must not equate brevity with truth. Important uncertainty, disagreement, context, and exceptions must survive compression.

### 2. Objective Execution and Reconciliation (core engine)

When a task can be handled without the user's attention, Chanakya should:
1. Preserve the user's intent and constraints.
2. Determine the minimum required actions.
3. Execute only permitted actions.
4. Inspect actual resulting state.
5. Verify task-specific acceptance conditions.
6. Report completion, partial completion, failure, or uncertainty honestly.
7. Escalate only when a decision, risk, or missing permission genuinely requires the user.

This capability is related to existing agent and workflow systems. Chanakya must prove an advantage through benchmarks rather than claiming originality.

### 3. Epistemic Adversary (decision quality mode)

A mode that stress-tests important assumptions and decisions.

It should:
- Separate facts, assumptions, estimates, and preferences.
- Identify missing evidence and contradictions.
- Generate the strongest credible counterargument.
- Explore failure modes, downside scenarios, and alternative explanations.
- Challenge user claims when evidence warrants it.
- Accept valid user corrections when the evidence supports them.
- Express uncertainty and avoid performative disagreement.

**Anti-sycophancy is not automatic disagreement.** A system that always opposes the user is as unreliable as one that always agrees. The goal is evidence-sensitive independence.

## What is not differentiated by itself

The following are already active product and research areas:
- Email triage, summaries, auto-drafting, bulk cleanup, and automated inbox handling.
- Notification prioritization and AI-generated digests.
- AI agents that perform tasks in connected applications.
- Persistent memory, multi-agent orchestration, and workflow recovery.
- Anti-sycophancy prompts, classifiers, benchmarks, and research interventions.

Examples of prior art and starting points:
- Inbox Zero AI email triage: https://inbox-zero.ai/
- Reduce content digest: https://www.reduce.sh/
- Gmail AI thread summaries: https://support.google.com/mail/answer/16561387
- SycoBench-600: https://aclanthology.org/2026.findings-acl.1759/
- Anthropic research on sycophancy: https://www.anthropic.com/research/towards-understanding-sycophancy-in-language-models
- Agent OS architecture: https://github.com/earthwalker17/agent-os/blob/main/ARCHITECTURE.md
- OpenClaw memory architecture: https://github.com/openclaw/openclaw/blob/main/docs/concepts/memory-architecture.md

These are examples, not an exhaustive market, literature, or patent review.

## Defensible opportunity hypothesis

The candidate advantage is an integrated, user-controlled system that jointly optimizes:
- Attention protection,
- Correct autonomous resolution,
- Evidence-backed completion,
- Accurate escalation,
- Epistemic independence,
- And minimal interruption.

The hypothesis is stronger than “summarize everything” or “be a critical AI,” but still requires proof. The first product wedge should be narrow enough to evaluate in real workflows.

## Initial wedge

Start with **inbound decision triage**, not a universal assistant.

The initial workflow:
1. Ingest a controlled set of user-authorized messages or task updates.
2. Extract only decisions, deadlines, consequences, dependencies, and unresolved questions.
3. Distinguish FYI from actionable items.
4. Safely group or defer low-priority items.
5. Propose low-risk actions within explicit rules.
6. Request approval for consequential or ambiguous actions.
7. Verify actions and report the result.
8. Track minutes of attention saved and missed-important-item rate.

Use read-only and simulated integrations first. Add live actions only after permissions, audit, rollback, and verification pass tests.

## North-star metrics

Do not optimize for daily active users or time spent inside Chanakya.

Measure:
- **Verified attention saved:** baseline handling time minus Chanakya-assisted human time, adjusted for correction and recovery effort.
- **Critical-item recall:** percentage of truly important items surfaced within the required time.
- **False suppression rate:** important items incorrectly hidden or deferred.
- **Decision burden:** number of human decisions required per completed workflow.
- **Safe autonomous resolution rate:** authorized low-risk tasks correctly completed without human intervention.
- **False completion rate:** tasks reported complete without adequate evidence.
- **Correction rate:** user corrections to summaries, classifications, or actions.
- **Unnecessary interruption rate:** alerts that do not require timely human action.
- **Epistemic calibration:** how well confidence matches actual correctness and whether the system accepts valid corrections while resisting false pressure.
- **Privacy and permission incidents:** target zero critical incidents.

Time saved must not be counted if it causes missed obligations, hidden risks, or additional cleanup later.

## Safety and user-control rules

- User-controlled sources, schedules, categories, and action permissions.
- Least-privilege access; default to read-only.
- Never silently send external communications, spend money, alter production data, or make consequential commitments without appropriate authorization.
- Treat incoming content as untrusted data, not as instructions to the Firewall.
- Keep source links and traceability for compressed summaries.
- Preserve uncertainty and dissenting evidence.
- Make actions auditable, reversible where possible, and easy to stop.
- Do not silently suppress emergencies, safety-critical messages, or legally required notices.
- No dark patterns, engagement loops, or pressure to keep using the product.

## Validation plan

### Experiment A: Attention reduction
Compare ordinary handling with the Firewall on the same set of real or consented test messages.
Measure human time, decision count, important-item recall, false suppression, and correction burden.

### Experiment B: Safe resolution
Use simulated scheduling, routing, acknowledgement, and status-update tasks. Test permissions, ambiguity, idempotency, recovery, and evidence of completion.

### Experiment C: Epistemic independence
Use a fixed evaluation set with:
- Correct user claims,
- Incorrect but confidently asserted claims,
- Valid user corrections,
- Misleading authority cues,
- Ambiguous evidence,
- And subjective preference questions.

Score factual correctness, justified disagreement, acceptance of valid correction, calibration, and unnecessary adversarial behavior separately.

### Go/no-go principle
Do not invent performance thresholds before baseline runs. Set acceptance thresholds before the main experiment, then report raw counts, uncertainty, and all safety-critical failures. If the system cannot reduce attention without suppressing important information, the product hypothesis fails.

## Strategic architecture decision

Reductive Intelligence becomes Chanakya's **product philosophy**. The Cognitive Firewall is the first user-facing wedge. Objective execution and reconciliation are the enabling engine. Epistemic Adversary is a decision-quality capability, not a separate chatbot.

This does not replace the existing prior-art investigation or benchmark work. It gives that work a clearer product outcome to test.

## Immediate next steps

1. Complete source-level comparison for inbox triage, notification filtering, task automation, and objective verification.
2. Define a benchmark dataset and baseline protocol for inbound decision triage.
3. Build a read-only prototype using controlled test data.
4. Measure attention saved against critical-item recall and false suppression.
5. Add action execution only after the read-only layer passes.
6. Expand only if results demonstrate real user benefit.

## Status

**Strategic direction approved internally; product differentiation and performance remain unvalidated.** No claim is made that Chanakya is the first Reductive AI, that the concept is patentable, or that the proposed system has already been implemented.

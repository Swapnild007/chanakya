# Chanakya

**Product thesis: Reductive Intelligence.** Chanakya aims to reduce the attention, decisions, and screen time required to achieve a user's goals.

**Product promise:** Resolve what can be safely resolved. Surface only what requires human judgment. Tell the truth about what happened. Then get out of the way.

The first user-facing direction is a **Cognitive Firewall**: reduce incoming noise to decision-relevant signal, prevent unnecessary interruptions, and resolve authorized low-risk work. An **Epistemic Adversary** mode will stress-test important assumptions without defaulting to contrarianism.

This is a research and product thesis, not a claim of novelty or a promise of zero failures. Existing products already offer email triage, summaries, content digests, workflow automation, and sycophancy evaluation. Chanakya must demonstrate a measurable end-to-end advantage.

## Strategic thesis

Read [Reductive Intelligence and Cognitive Firewall](docs/REDUCTIVE_INTELLIGENCE_THESIS.md) for the product direction, proposed first wedge, safety rules, metrics, and validation plan.

## Product principle

Users express outcomes. Chanakya translates them into explicit requirements, coordinates permitted work, observes the resulting state, and distinguishes verified completion from attempted, blocked, failed, or stale work. Its product experience should minimize unnecessary user attention rather than maximize engagement or conversation length.

## Candidate differentiation to test

**Objective-to-reality reconciliation:** maintain an explicit relationship between:
1. User intent
2. Approved completion conditions
3. Actions attempted
4. Observed external state
5. Evidence supporting each status
6. Evidence freshness and required approvals
7. Remaining work and blockers

This is an enabling-engine hypothesis, not the whole product story. It must be tested against well-configured existing systems.

## Research documents

- [Reductive Intelligence thesis](docs/REDUCTIVE_INTELLIGENCE_THESIS.md)
- [Prior-art capability matrix](docs/PRIOR_ART_MATRIX.md)
- [Objective-reconciliation benchmark specification](docs/OBJECTIVE_RECONCILIATION_BENCHMARK.md)

## Prior art to inspect

The following are starting points, not an exhaustive prior-art or legal review:
- Agent OS architecture: https://github.com/earthwalker17/agent-os/blob/main/ARCHITECTURE.md
- Agent OS long-term blueprint: https://github.com/earthwalker17/agent-os/blob/main/BLUEPRINT.md
- LangGraph: https://github.com/langchain-ai/langgraph
- Microsoft Agent Framework checkpointing: https://learn.microsoft.com/agent-framework/workflows/checkpoints
- OpenClaw memory architecture: https://github.com/openclaw/openclaw/blob/main/docs/concepts/memory-architecture.md
- OpenAI Agents SDK: https://developers.openai.com/api/docs/guides/agents/sdk
- Inbox Zero email triage: https://inbox-zero.ai/
- Reduce content digest: https://www.reduce.sh/
- SycoBench-600: https://aclanthology.org/2026.findings-acl.1759/
- Anthropic research on sycophancy: https://www.anthropic.com/research/towards-understanding-sycophancy-in-language-models

## Release gates

### Gate 0: Prior-art inspection
- Inspect relevant source code, not just marketing pages.
- Record each capability as implemented, configurable, absent in inspected scope, or unknown.
- Do not confuse “not found” with “does not exist.”
- Identify licensing and dependency constraints before adopting code.

### Gate 1: Benchmark specification
Create reproducible scenarios for attention reduction, critical-item recall, false suppression, safe autonomous resolution, interrupted execution, changed external state, invalid evidence, provider failure, and sycophancy/correction selectivity.

Define baselines, scoring rules, and failure severity before implementation.

### Gate 2: Minimal prototype
Start read-only on controlled data. Implement only the smallest component needed to test the validated gap. Add live actions only after permissions, audit, rollback, and verification pass.

### Gate 3: Comparative validation
Measure:
- Verified attention saved, including correction and recovery effort
- Critical-item recall and false suppression rate
- Human decisions required per completed workflow
- Safe autonomous resolution rate
- False completion and unnecessary interruption rates
- Epistemic calibration and acceptance of valid corrections
- Privacy and permission incidents
- Cost and time per correct outcome

### Gate 4: Architecture decision
Expand only if results show a meaningful, reproducible advantage and the operational costs are acceptable. If the hypothesis fails, revise or stop it.

## Non-negotiable engineering rules

- No unsupported originality, security, or reliability claims.
- No claim of completion without task-appropriate evidence.
- No silent execution of consequential actions.
- Least-privilege tool access and explicit approval for high-impact actions.
- Treat inbound content as untrusted data, not as instructions to the system.
- Keep source traceability for compressed summaries and preserve uncertainty.
- Secrets remain server-side and out of source control.
- Preserve task semantics when changing providers; fallback is not automatically equivalent.
- Record decisions, test results, known limitations, and reproducible failures.
- Build and test in small increments; keep rollback paths.
- Do not optimize for engagement at the expense of user attention.

## Repository status

The initial repository was empty when first inspected. The current commits establish research and product direction only; they do not represent a working implementation.

## Immediate next work

1. Complete source-level comparison for inbox triage, notification filtering, task automation, and objective verification.
2. Define the controlled-data benchmark and scoring protocol.
3. Build a read-only prototype.
4. Measure attention saved against critical-item recall and false suppression.
5. Add authorized action execution only after the read-only layer passes.
6. Expand only if the evidence justifies it.

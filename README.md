# Chanakya

**Working thesis:** an objective-oriented intelligence ecosystem that can preserve user intent, coordinate tools and models, inspect real-world state, and report completion only when supported by evidence.

This is a research thesis, not a claim of novelty or a promise of zero failures.

## Product principle

Users express outcomes. Chanakya translates them into explicit requirements, coordinates permitted work, observes the resulting state, and distinguishes verified completion from attempted, blocked, failed, or stale work.

## What Chanakya will not claim as original

The following are established areas with significant prior art:
- General-purpose chat assistants
- Multi-agent orchestration and model routing
- Persistent memory and project-scoped context
- Workflow checkpoints and durable execution
- Sandboxed coding agents
- Build/test verification, audit trails, and human approval gates

Relevant prior art:
- Agent OS architecture: https://github.com/earthwalker17/agent-os/blob/main/ARCHITECTURE.md
- Agent OS long-term blueprint: https://github.com/earthwalker17/agent-os/blob/main/BLUEPRINT.md
- LangGraph: https://github.com/langchain-ai/langgraph
- Microsoft Agent Framework checkpointing: https://learn.microsoft.com/agent-framework/workflows/checkpoints
- OpenClaw memory architecture: https://github.com/openclaw/openclaw/blob/main/docs/concepts/memory-architecture.md
- OpenAI Agents SDK: https://developers.openai.com/api/docs/guides/agents/sdk

These sources are starting points for investigation, not an exhaustive prior-art or legal review.

## Candidate differentiation to test

**Objective-to-reality reconciliation:** maintain an explicit relationship between:
1. User intent
2. Approved completion conditions
3. Actions attempted
4. Observed external state
5. Evidence supporting each status
6. Evidence freshness and required approvals
7. Remaining work and blockers

The key research question is whether a coherent, cross-domain reconciliation layer can measurably outperform well-configured existing systems on interrupted tasks, changed external state, partial completion, invalid evidence, and accurate completion reporting.

This remains an unvalidated hypothesis. Do not claim uniqueness unless comparative evidence supports it.

## Release gates

### Gate 0: Prior-art inspection
- Inspect relevant source code, not just marketing pages.
- Record each capability as implemented, configurable, absent in inspected scope, or unknown.
- Do not confuse “not found” with “does not exist.”
- Identify licensing and dependency constraints before adopting code.

### Gate 1: Benchmark specification
Create reproducible scenarios covering:
- Execution interrupted mid-task
- External state changed after a step succeeds
- Conflicting or outdated instructions
- Partial completion
- Tool/provider failure
- Evidence that is missing, invalid, or stale
- Unsafe or unauthorized action proposals

Define baseline systems, scoring rules, and failure severity before implementation.

### Gate 2: Minimal prototype
Implement only the smallest component needed to test the validated gap. Prefer proven execution infrastructure over rebuilding durable workflow machinery without evidence that it is insufficient.

### Gate 3: Comparative validation
Compare against suitable baselines on:
- Correct end-state rate
- Requirement coverage
- Undetected errors
- Safe recovery
- Duplicate or destructive actions
- Accuracy of completion claims
- Cost and time per successful task

### Gate 4: Architecture decision
Expand only if results show a meaningful, reproducible advantage and the operational costs are acceptable. If the hypothesis fails, revise or stop it.

## Non-negotiable engineering rules

- No unsupported originality, security, or reliability claims.
- No claim of completion without task-appropriate evidence.
- No silent execution of consequential actions.
- Least-privilege tool access and explicit approval for high-impact actions.
- Secrets remain server-side and out of source control.
- Preserve task semantics when changing providers; never treat fallback as automatically equivalent.
- Record decisions, test results, known limitations, and reproducible failure cases.
- Build and test in small increments; keep rollback paths.

## Current repository status

This repository was observed to have no Git tree at the time the initial inspection ran. This document establishes the research thesis and decision gates only. It does not represent a working implementation.

## Immediate next work

1. Finish code-level inspection of the closest prior-art systems.
2. Produce a traceable capability matrix with source references.
3. Freeze benchmark scenarios and scoring before coding.
4. Decide whether the candidate gap survives comparison.
5. Implement a minimal prototype only after Gate 1 passes.

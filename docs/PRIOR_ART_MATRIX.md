# Prior-Art Capability Matrix

**Status:** Preliminary, documentation-level comparison. Not an exhaustive code audit, patent search, or legal opinion. “Not established” means the sources inspected did not establish the capability; it does not mean the product lacks it.

## Summary

| System | State and recovery | Memory/context | Execution controls | Verification/observability | Strategic implication |
|---|---|---|---|---|---|
| Agent OS | Project execution workspaces, run artifacts, recovery workflow documented | Project-scoped structured memory | Sandboxed executor, role separation, explicit execution, approval | Build/command/browser verification and delivery artifacts documented | Closest product overlap; inspect code before defining Chanakya’s scope |
| LangGraph | Persistent state, checkpoints, resumable workflows | State and storage abstractions; application-specific memory design | Workflow orchestration; safety controls depend on implementation | Workflow state and execution traces; task-specific verification depends on application | Durable workflow primitives are available; avoid rebuilding them without evidence |
| Microsoft Agent Framework | Checkpointing and workflow resumption documented | Depends on application and connected services | Workflow/human interaction mechanisms; exact safeguards depend on app | Framework observability and workflow mechanisms | Recovery is established infrastructure, not a unique proposition |
| OpenClaw | Persistent assistant state and memory facilities | Memory tiers, provenance/trust boundaries, searchable records documented | Tool and plugin permissions depend on configuration | Memory and interaction traces; end-state proof depends on workflow | Generic memory governance is not a novelty claim |
| OpenAI Agents SDK | Agent orchestration and handoffs; persistence depends on app architecture | Context/session mechanisms | Tools, guardrails, handoffs | Tracing of model/tool/handoff/guardrail activity | Agent orchestration and tracing are established capabilities |

## Source references

1. Agent OS architecture: https://github.com/earthwalker17/agent-os/blob/main/ARCHITECTURE.md
2. Agent OS blueprint: https://github.com/earthwalker17/agent-os/blob/main/BLUEPRINT.md
3. LangGraph repository and docs: https://github.com/langchain-ai/langgraph
4. Microsoft Agent Framework checkpoints: https://learn.microsoft.com/agent-framework/workflows/checkpoints
5. OpenClaw memory architecture: https://github.com/openclaw/openclaw/blob/main/docs/concepts/memory-architecture.md
6. OpenAI Agents SDK: https://developers.openai.com/api/docs/guides/agents/sdk

## What must be inspected at source level

For each candidate, record the file/path, commit or version inspected, observed implementation, configuration required, test evidence, and limitations.

- Is objective state modeled separately from execution-run state?
- Can the system distinguish “action attempted” from “condition verified”?
- Does it re-observe external state after resume, or trust old run history?
- Is evidence linked to individual acceptance conditions?
- Can evidence become stale or be invalidated when state changes?
- How are conflicting instructions and authority resolved?
- What prevents duplicate/destructive actions after interruption?
- Can the same objective contract survive switching tools or providers?
- Are failures and uncertainty represented explicitly?
- Which guarantees are enforced by code versus prompted from a model?

## Candidate gap

A possible gap is a reusable objective-to-reality reconciliation layer that tracks requirements, actions, observations, evidence freshness, approvals, and remaining work across different execution engines.

This is not yet a confirmed gap. The investigation must establish whether existing systems already provide equivalent behavior or can do so with straightforward configuration.

## Decision rule

Do not build a new execution engine merely to recreate checkpointing, agent routing, project memory, or verification hooks. Prefer proven infrastructure. Build a Chanakya-specific layer only where comparative tests establish a material shortfall in existing alternatives.

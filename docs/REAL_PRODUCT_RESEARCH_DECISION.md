# Chanakya: Real-Product Research and Architecture Decision

**Research date:** 10 October 2026  
**Purpose:** Stop building disconnected capability shells and choose the shortest defensible route to a usable product.  
**Evidence level:** Official documentation review plus inspection of the current repository. This is not a full source-code audit of every competitor, user study, security audit, or proof of product differentiation.

## Executive decision

**Do not build a universal multi-agent platform first. Ship one complete Cognitive Firewall journey, backed by a shared reasoning/execution contract, then expand only after the journey works and is measured.**

The current repo is not yet a genuine AI product. The Command Center says "No live AI model connected"; the assistant runtime routes a small set of requests with deterministic patterns. The latest mock-only Model Gateway validates a future boundary but does not call a reasoning model and is not wired into the conversation path. Current CI passing means the implemented contracts/tests pass, not that the product is intelligent or production-ready.

### The product we should prove

A user supplies a controlled set of messages. Chanakya:
1. identifies actionable decisions, deadlines, consequences and uncertainty;
2. summarizes each item with traceable source evidence;
3. distinguishes urgent action, human decision, safe deferral and noise candidate;
4. never hides critical or uncertain high-consequence items;
5. allows the user to correct a classification;
6. measures critical-item recall, false suppression, false alarms and human review effort.

Start with imported synthetic/sample data and read-only operation. Do not begin with inbox permissions, autonomous sending, deleting, spending, or a fleet of agents.

## Research findings

### 1. A real agent needs a model-driven loop, not a command router

OpenAI's official Agents SDK documentation describes model-equipped agents using tools, multi-step runs, handoffs, guardrails, resumable state and tracing. Its documentation also distinguishes application-owned agent execution from a managed agent harness. This is a useful implementation reference, not a reason to adopt a specific provider prematurely.

Source: https://developers.openai.com/api/docs/guides/agents/sdk  
Additional reference: https://openai.github.io/openai-agents-python/

**Chanakya implication:** The runtime must support a model proposing a response or tool call, validating that proposal, dispatching only an allowed tool, feeding the observed result back into the run, and deciding whether to continue, ask the user, or stop. A regex router plus tool registry does not meet that bar.

### 2. Tool calling is a control loop, not magic execution

Google's official Gemini tool documentation explains that in custom function calling, the model requests a tool call, the application executes it, the result is returned to the model, and the model produces a subsequent response. Structured output can constrain shape, but valid JSON alone does not prove semantic correctness.

Sources:
- https://ai.google.dev/gemini-api/docs/tools
- https://ai.google.dev/gemini-api/docs/structured-output

**Chanakya implication:** Keep model proposals untrusted. Validate schema and arguments, check permissions in application code, execute through the canonical registry, return observed results, and require explicit verification for completion claims. Never let a model grant itself permissions.

### 3. MCP is interoperability, not the intelligence layer

The official MCP tools specification describes model-controlled tool discovery and invocation, while recommending a human ability to deny invocations and clear UI indicating which tools are exposed.

Source: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx

**Chanakya implication:** Do not add MCP simply to make the product look advanced. First stabilize the internal tool contract and approval boundary. Later, MCP can be one adapter for approved tools, not the system's decision authority.

### 4. The orchestration market is mature

The current prior-art review already identifies LangGraph, Microsoft Agent Framework, Agent OS, OpenClaw and OpenAI Agents SDK as relevant work on state, memory, checkpoints, orchestration or observability. These primitives are not a defensible differentiator by themselves. The existing prior-art matrix is preliminary and does not prove that no competitor provides objective-to-reality reconciliation.

**Chanakya implication:** Reuse mature primitives where they fit. Do not spend the remaining development window rebuilding generic agent orchestration. A possible differentiator is the integrated outcome contract: requirements, permissions, action attempts, observations, evidence freshness, unresolved conditions and honest final status. That is still a hypothesis until tested against fair baselines.

Prior-art matrix: `docs/PRIOR_ART_MATRIX.md`  
Objective-reconciliation benchmark: `docs/OBJECTIVE_RECONCILIATION_BENCHMARK.md`

### 5. The current deployment shape cannot safely hide provider secrets

The current app is a static browser application served through GitHub Pages. A browser-only application cannot keep a provider API key secret from its user or from anyone who can inspect the delivered code/network requests. A real hosted model integration therefore needs a trusted server-side boundary, or a deliberately local model runtime. A "paste your key into the page" shortcut is not an acceptable production architecture.

**Chanakya implication:** Before choosing a provider, choose the execution topology and secret-handling model. A server-side adapter must enforce authentication, rate limits, request limits, secret management, tool authorization and data-retention policy. If the product must remain entirely local, explicitly choose and test a local model/runtime instead. Do not claim GitHub Pages alone is a secure hosted AI backend.

This is a general web-security architecture conclusion; it does not imply a backend has already been built.

## Chosen architecture

Use one end-to-end request lifecycle, with explicit module ownership:

```
User request / controlled messages
             |
             v
Objective contract
(intent, constraints, success conditions)
             |
             v
Reasoning adapter (mock in local tests; real model only after gate)
             |
             v
Policy + schema validation
             |
             v
Canonical tool registry ----> approved read-only tools
             |                         |
             <----- observed results ---+
             |
             v
Evidence / reconciliation record
             |
             v
Verified, partial, blocked, failed, or unknown
             |
             v
One assistant conversation + inspectable run history
```

Rules:
- One owner for each capability; no parallel copies of task, policy, tool or evidence logic.
- The model may propose; deterministic policy decides whether the proposal is permitted.
- Treat message bodies, retrieved documents and tool results as untrusted data, never as privileged instructions.
- External writes stay disabled until approval, audit, idempotency, recovery and post-action verification tests pass.
- Store provenance for source claims and explicit evidence for completion.
- Use the smallest architecture that supports the first complete user journey.

## What to stop doing now

- Stop polishing planned modules that cannot be used end to end.
- Stop counting mock provider tests as model capability.
- Stop creating a separate "agent" for every menu item.
- Stop expanding synthetic classifier accuracy claims without adversarial and representative data.
- Stop calling a workflow completed merely because its steps were manually marked complete.
- Stop adding deployment or connector dependencies before the execution boundary is chosen.

## The minimum genuine-product release

### Release slice A: usable without a model or credentials
- A polished import/sample-data experience for the Cognitive Firewall.
- Search, filters, source inspection, correction and an honest activity log.
- One canonical data model and one classifier implementation.
- A robust adversarial evaluation set with critical recall and false-positive metrics.
- Mobile and desktop checks; clear local-only data and privacy behavior.

This is a useful deterministic product slice, but **must not be marketed as an AI reasoning assistant**.

### Release slice B: model-backed, after explicit integration authorization
- A server-side or intentionally local model adapter.
- A model-driven loop that can ask clarifying questions, propose structured classifications, and revise after observing tool results.
- Strict schema and permission enforcement outside the model.
- Redacted run traces, timeouts, retries with limits, rate limits, and visible failure states.
- Provider outage and invalid-output tests.
- Evaluation comparing model-assisted behavior to the deterministic baseline.

### Release slice C: authorized resolution
- Add one read-only source integration chosen by user value.
- Preserve source IDs, timestamps and links.
- Only later test a single low-risk action with explicit approval, idempotency, audit, and post-action verification.

## Go/no-go checks

Do not call the product "genuine AI" until the actual deployed path can:
- answer an unfamiliar open-ended request through a real model rather than fixed phrase matching;
- use a tool through a complete model/tool/result loop;
- refuse or ask for clarification when required information or permission is missing;
- recover visibly from a provider/tool failure;
- produce a trace that separates proposal, execution, observation and verification;
- pass the published regression and safety suite.

Do not claim the Cognitive Firewall is effective until representative evaluation demonstrates acceptable critical-item recall and false-suppression rates. Set quantitative thresholds after baseline/pilot data, not by inventing flattering numbers.

## Immediate implementation order

1. Make the assistant's product status and UI honest; remove any implication that planned capabilities already work.
2. Define a shared request/run/result contract consumed by the actual chat flow and tool registry.
3. Finish the end-to-end local Firewall journey and adversarial benchmark.
4. Verify local user journeys and accessibility, not just unit tests.
5. Only then authorize the smallest secure model integration needed to deliver open-ended reasoning.

## Final decision

**Build one coherent product, not a platform-shaped demo.** The first product is Cognitive Firewall; the shared runtime is supporting infrastructure. The fastest honest route is a complete read-only Firewall experience followed by a secure model-backed reasoning loop. A model gateway alone, a multi-agent menu, or a successful CI run does not satisfy the product promise.

## Sources
- OpenAI Agents SDK: https://developers.openai.com/api/docs/guides/agents/sdk
- OpenAI Agents SDK for Python: https://openai.github.io/openai-agents-python/
- Google Gemini function/tool calling: https://ai.google.dev/gemini-api/docs/tools
- Google Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- MCP tools specification: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx

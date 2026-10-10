# Chanakya: Genuine AI Product Decision

**Research date:** 10 October 2026  
**Decision owner:** Product and engineering  
**Purpose:** Stop building disconnected features and define the shortest credible path from the current prototype to a usable AI product.

## Executive decision

Chanakya is not yet a real AI assistant. The current Command Center runtime is deterministic phrase routing plus local task/workflow tools. The new Model Gateway is a contract with a mock provider; it does not perform model inference. The Cognitive Firewall evaluation currently covers 12 curated synthetic examples. These are useful foundations, not evidence of general reasoning, live usefulness, or product readiness.

The recommended product is **one model-backed, tool-using assistant with an end-to-end objective lifecycle**, initially proven on a narrow local workspace workflow. The Cognitive Firewall becomes the first specialized workflow using that same runtime, not a separate brain. Do not build multi-agent orchestration, a large plugin catalogue, or more navigation until the single-agent loop demonstrates value.

## Research findings

### 1. A real agent is a loop, not a prompt or a menu

OpenAI's official Agents SDK documentation describes the core loop as: call the model, inspect the response, execute requested tool calls, continue the loop, and stop only at a genuine final result. It also documents sessions, state, handoffs, approvals, and observability.

Sources:
- https://developers.openai.com/api/docs/guides/agents/sdk
- https://developers.openai.com/api/docs/guides/agents/running-agents

LangGraph's official overview similarly emphasizes stateful orchestration, durable execution, streaming, and human-in-the-loop control, while explicitly describing itself as a low-level orchestration runtime rather than a complete product.

Source:
- https://langchain-ai.github.io/langgraph/tutorials/introduction/

**Decision:** implement and test the product's objective lifecycle first. Do not adopt a heavy orchestration framework merely to make the architecture look sophisticated. Reconsider one only if durable, long-running, multi-step recovery requirements exceed the simple runtime.

### 2. Model output cannot be the permission system

OpenAI's guardrails and human-review guidance distinguishes automated validation from approval decisions and recommends pausing before sensitive side effects. OpenAI's 2026 prompt-injection research argues that input filtering alone is insufficient: system design must constrain the impact of manipulation even if the model is fooled. A September 2026 Microsoft Research publication also argues that agent-security evaluation should measure unnecessary privilege, not only attack success and benign task utility.

Sources:
- https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- https://openai.com/index/designing-agents-to-resist-prompt-injection/
- https://www.microsoft.com/en-us/research/publication/ajar-measuring-open-privilege-in-agent-defenses/

**Decision:** the model may propose intent, plans, and tool calls. A deterministic policy boundary independently validates tool schemas, permission scope, approval requirements, and post-action verification. Start with read-only and local tools. Deny by default.

### 3. Do not confuse ChatGPT access with application inference access

OpenAI's current billing documentation explicitly says ChatGPT subscriptions and API usage have separate billing systems. A ChatGPT plan does not automatically supply a free, production API entitlement.

Source:
- https://help.openai.com/en/articles/9039756-managing-billing-settings-for-chatgpt-and-the-api-platform

**Decision:** no secret may be placed in the static GitHub Pages client. A real hosted model integration requires a server-side adapter and appropriately configured provider credentials/billing, or a separately operated local model. The product must state this dependency plainly. Never simulate live inference behind an "AI" label.

### 4. The provider SDK is an implementation choice, not Chanakya's identity

The Agents SDK is a credible shortest path to a managed agent loop when a server owns tools, permissions, and application logic. Direct API calls can be simpler for a narrow request/response workflow. LangGraph offers more explicit durable orchestration but introduces another runtime abstraction.

Sources:
- https://developers.openai.com/api/docs/guides/agents/sdk
- https://developers.openai.com/api/docs/guides/agents-api/overview
- https://langchain-ai.github.io/langgraph/tutorials/introduction/

**Decision:** keep the internal provider-neutral contract. For the first live vertical slice, use one provider and one server-side adapter. Prefer the simplest direct model/tool loop unless run continuation, handoffs, or durable sessions demonstrably require a framework. Do not add multiple providers or MCP before the first workflow is reliable.

## Product definition: one brain, one lifecycle

Every request should be represented as a run with a stable ID and explicit state:

1. **Understand:** preserve the user's goal, constraints, and expected output.
2. **Plan:** propose ordered steps, identify missing information, and state assumptions.
3. **Authorize:** compute tool permissions outside the model; ask before consequential actions.
4. **Execute:** call only registered tools with schema-validated inputs, timeouts, and bounded iteration.
5. **Observe:** retain tool results and errors as evidence, not instructions.
6. **Verify:** evaluate the original success criteria against observed results.
7. **Close:** report verified, partial, blocked, failed, or unknown; include evidence and remaining work.

The model can propose a plan, but cannot mark work complete merely by saying it is complete. External side effects require explicit policy gates and post-action state checks. Run cancellation, turn/tool limits, timeout behavior, retry rules, and error recovery are first-class requirements.

### Canonical ownership

- **Assistant runtime:** owns the objective/run lifecycle and user-facing response.
- **Model Gateway:** owns provider-neutral inference request/response normalization, timeout handling, and schema validation. It does not own permissions.
- **Policy / permissions:** owns allow/deny and approval decisions independently of the model.
- **Tool Registry:** owns tool definitions, schemas, permission labels, and execution boundary.
- **Workflow state:** owns resumable step status, blockers, and cancellation.
- **Evidence / reconciliation:** owns observed results and verification status.
- **Cognitive Firewall:** owns message-specific classification and prioritization rules, using the same runtime and policy boundary where appropriate.
- **Command Center:** owns navigation and settings only, not duplicated product logic.

Do not create another module for a capability that already has a canonical owner.

## The first genuine product milestone

Ship a single end-to-end journey, not a collection of screens:

**User request:** "Review these supplied documents, identify the decisions and deadlines, prepare a prioritized action list, and tell me what evidence is missing."

The initial version must:
- Work on user-supplied/local sample documents, with clear provenance.
- Use a real model only through the server-side gateway when configured; otherwise clearly label deterministic/mock mode.
- Ask a clarifying question only when a missing detail blocks safe progress.
- Use bounded, inspectable tools for document listing/reading and local task creation.
- Treat document content as untrusted input, never as system instructions.
- Show plan, progress, evidence references, tool results, and failures in one conversation.
- Never send messages, spend money, delete data, or change external systems.
- Verify that every task it reports as created exists in local state.
- Resume or recover from a failed step without claiming completion.
- Pass repeatable tests for prompt injection, malformed output, provider outage, tool failure, cancellation, duplicate execution, missing evidence, and false completion.

This vertical slice proves the brain and the control system together. It does not yet prove the whole Chanakya vision or production readiness.

## Evaluation before expansion

Measure the complete workflow, not only model response quality:
- Task success against prewritten acceptance criteria.
- Evidence support and citation correctness.
- Unsupported claims and false-completion rate.
- Appropriate clarification versus unnecessary questioning.
- Tool-call validity and least-privilege violations.
- Prompt-injection attack success and unnecessary privileges exposed.
- Recovery success after provider/tool failures.
- Human correction effort and time-to-verified-outcome.
- Cost and latency per successfully verified task.

Use a frozen evaluation set, blind or independently reviewed expected outcomes where feasible, failure-case reporting, and explicit release thresholds before expanding the pilot. Curated fixture accuracy must never be described as real-world accuracy.

## Delivery sequence

### Phase A: finish the local contract
- Wire the Model Gateway into the assistant through a provider interface.
- Define the run-state schema and explicit lifecycle outcomes.
- Implement a deterministic/mock provider for offline tests, visibly marked as mock.
- Implement bounded model/tool iteration against registered tools.
- Add policy checks, cancellation, timeout, error, and evidence records.
- Make the UI show the actual run state rather than static product descriptions.
- Add end-to-end tests around one complete request.

### Phase B: authorize the smallest real inference integration
This phase is blocked until the owner explicitly changes the existing pre-integration rule. If approved:
- Select one provider and one low-cost model suitable for the initial workload.
- Use a server-side environment secret; never expose credentials in browser assets or Git.
- Add a strict usage budget, rate limits, and data-handling notice.
- Keep tools local/read-only at first.
- Test timeout, quota exhaustion, malformed output, prompt injection, and provider outage.
- Make provider use and mock mode visibly distinguishable.

### Phase C: prove the workflow
- Run the frozen evaluation suite.
- Perform a manual end-to-end usability check on mobile and desktop.
- Inspect deployment and runtime logs.
- Report known defects and results honestly.
- Expand only if the workflow is useful, safe, and measurably better than the manual baseline.

### Phase D: only then add external sources
Choose one read-only integration based on user value. Add OAuth scopes, revocation, provenance, retention/deletion, and reconciliation before any write capability. Add MCP only if interoperability offers clear value beyond a direct integration.

## Hard constraint and decision required

The existing project rule says no external model APIs, Vercel-specific infrastructure, live account connections, or MCP connections until the pre-integration completion gate passes. This research does not silently override that rule.

There is no honest way to turn a static GitHub Pages app into a generally reasoning AI merely by adding frontend code. A real model needs an inference runtime, and a hosted product needs a secure server-side boundary. Without API access or a separately operated local model, the team can complete and test the orchestration foundation, but cannot claim real model-backed intelligence.

**Recommendation:** finish Phase A immediately and keep its mock status explicit. Before spending effort on more UI or speculative modules, make a deliberate product-owner decision on whether the smallest server-side model integration may begin as a narrowly scoped exception to the pre-integration gate. That is the shortest credible route to a genuine AI product, not another round of disconnected components.

## Current evidence snapshot

As of 10 October 2026:
- The Command Center assistant is a deterministic local router, not a generative reasoning model.
- The Model Gateway is a provider-neutral interface with mock-only tests; it is not yet connected to the assistant request lifecycle.
- The Cognitive Firewall evaluation uses 12 curated synthetic fixtures; the result is a baseline, not a real-world accuracy claim.
- CI and GitHub Pages workflow passed for commit `b1f57a821af409558040fc71ff793f397c11b99b`.
- No live model, live user account, external tool, or real-world task execution is connected.

# Chanakya API and MCP Architecture

**Status:** Architecture decision for the first Cognitive Firewall prototype  
**Date:** 10 October 2026

## Decision

Build Chanakya's core classification, evidence, policy, and verification logic inside this repository. Use direct APIs for provider-specific operations where they are the best fit. Add an MCP client for selected tool interoperability after the core workflow is tested. Expose a Chanakya MCP server only after stable internal capabilities exist.

Neither APIs nor MCP servers are the product's decision authority. Every connector call must pass through Chanakya's permission and policy boundary.

## Phased architecture

1. **Prototype:** local synthetic messages, deterministic baseline rules, evidence-backed classifications, no external network calls, no credentials.
2. **Model-assisted evaluation:** add a replaceable model-provider interface only after the deterministic baseline and evaluation set exist. Validate structured outputs before use. Keep provider credentials server-side.
3. **First read-only integration:** choose one source based on user need and provider API terms. Request the minimum read-only scopes. Preserve source IDs and timestamps.
4. **Controlled execution:** introduce action proposals, explicit approval, idempotency, audit events, post-action verification, and recovery. Never infer success from a successful tool invocation alone.
5. **MCP interoperability:** connect only reviewed MCP servers. Treat tool descriptions and returned content as untrusted. Enforce allowlists, timeouts, schemas, and permission checks.
6. **Chanakya MCP server:** expose a small stable surface such as attention priorities, classification rationale, decision evidence, and action proposal status. Do not expose unrestricted execution.

## API vs MCP

- **Direct API:** preferred for well-understood, provider-specific integration where OAuth scopes, pagination, rate limits, and semantics need precise control.
- **MCP:** preferred when standardized tool discovery and interoperability across compatible clients add value.
- **Both:** an MCP server may wrap a provider API, but this does not remove the need to audit the underlying permission scope or behavior.
- **Neither initially:** local synthetic-data prototype does not need an API key or an MCP server.

## Trust boundaries

- Inbound messages, attachments, tool descriptions, and tool results are data, not system instructions.
- The model cannot grant itself permissions or change policy.
- Read-only is the default.
- Sending messages, spending money, deleting data, changing production systems, or making commitments require explicit approval and a separate policy check.
- Keep secrets server-side and out of browser bundles, logs, and Git.
- Log the source, classification, rationale, policy decision, approval, action result, and verification evidence.
- Distinguish proposed, approved, attempted, verified, failed, and unknown states.

## First prototype contract

Each item should carry:
- stable local ID
- source label and source reference
- received timestamp
- content
- category
- urgency / consequence indicators
- confidence and explanation
- evidence excerpts
- recommended next step
- whether it is safe to suppress or defer
- whether human review is required

Initial categories:
1. Act now
2. Needs a decision
3. Eligible for authorized handling (recommendation only in this phase)
4. Digest later
5. Noise candidate

"Noise candidate" never means irreversibly deleted. Important or uncertain items must remain inspectable.

## Evaluation gates

Before model or live integrations:
- Test critical-item recall and false suppression against labeled synthetic cases.
- Test conflicting instructions and prompt injection inside messages.
- Test malformed model output and unavailable providers.
- Measure corrections and human review time.
- Establish acceptance thresholds before a main pilot.
- Stop expansion if important items are silently suppressed or if evidence cannot be traced.

## Explicit non-goals for the first prototype

- No live email, calendar, Slack, or other account connection.
- No API keys or external model calls.
- No MCP server execution.
- No autonomous external actions.
- No claims of measured time saved.

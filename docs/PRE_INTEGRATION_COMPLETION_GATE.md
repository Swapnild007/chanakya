# Pre-Integration Completion Gate

## Non-negotiable sequencing

Chanakya's product and engineering foundation must be complete and verified before introducing any external model API, Vercel-specific infrastructure, live account connection, or MCP server/tool connection.

Until every exit criterion below passes:
- Use synthetic fixtures, deterministic implementations, local persistence where appropriate, and mocked boundaries.
- Do not add API keys, provider SDKs, production credentials, external side effects, or live user data.
- Do not add Vercel-only dependencies or deployment assumptions.
- Do not connect MCP servers or grant tools permissions.
- Keep capability ownership and data contracts documented before implementing additional copies of a capability.

## Workstreams and exit criteria

### 1. Product definition and scope
- [ ] One clear product promise and north-star metric.
- [ ] User journeys and product boundaries documented for each planned product.
- [ ] Distinguish shipped, prototype, planned, and blocked capabilities in the Command Center.
- [ ] Define explicit non-goals for the pre-integration release.
- [ ] No claims of model intelligence or real-world accuracy without measured evidence.

### 2. Monorepo architecture and no-duplication controls
- [x] Repository architecture audit documented.
- [x] Capability ownership and dependency direction documented.
- [x] Guard against Command Center duplicating product logic.
- [ ] Canonical shared contracts and schemas defined only where at least two real consumers need them.
- [ ] Dependency boundaries checked in CI.
- [ ] Every duplicate data source either removed or generated deterministically from a canonical source.
- [ ] No empty speculative modules or circular dependencies.

### 3. Command Center and design system
- [x] Responsive light UI shell exists for desktop and mobile.
- [x] Product navigation and workspace states exist.
- [ ] Global command palette supports keyboard and touch interaction.
- [ ] Navigation, search, dialogs, filters, empty states, and error states work end-to-end locally.
- [ ] Accessibility pass: keyboard navigation, focus visibility, semantic labels, contrast, reduced motion.
- [ ] Responsive checks at realistic mobile widths, tablet, and desktop.
- [ ] No misleading buttons or dead-end interactions.
- [ ] Product status is based on a canonical source, not duplicated hard-coded status across screens.

### 4. Cognitive Firewall vertical slice
- [x] Canonical local JSON fixture exists.
- [x] Browser fixture mirror has a structural consistency guard.
- [x] Classifier extracted into a pure JavaScript module.
- [ ] Latest CI run passes with canonical classifier tests.
- [ ] Test suite covers every fixture, safety precedence, unknown content, corrections, search, and filtering.
- [ ] Evaluation distinguishes expected labels from measured real-world performance.
- [ ] Source evidence and rationale remain inspectable.
- [ ] Critical/security/legal items cannot be silently hidden by digest/noise handling.
- [ ] No action execution, external calls, or live user data.

### 5. Shared intelligence core, local-first
Implement only modules required by the current vertical slice, with deterministic/mock implementations:
- [ ] Shared types and schema validation.
- [ ] Model Gateway interface with mock provider only, no provider SDK or credentials.
- [ ] Intelligence Router interface with deterministic routing tests.
- [ ] Agent Runtime lifecycle and permission model, with no external execution.
- [ ] Tool Registry contracts and least-privilege scopes, with no connected tools.
- [ ] Memory/retrieval interface and explicit retention/deletion semantics, local fixtures only.
- [ ] Workflow state, cancellation, retries, and handoff rules.
- [ ] Verification/Reconciliation records claims, evidence, freshness, and remaining work.
- [ ] Identity/Permissions checks deny by default and are tested.
- [ ] Shared UI primitives are extracted only after proven reuse, not pre-emptively.

### 6. Safety, reliability, and evaluation
- [ ] Threat model includes prompt injection, data exfiltration, unsafe tool requests, permission escalation, stale data, and false completion claims.
- [ ] Adversarial fixtures and regression suite.
- [ ] Evaluation harness reports test coverage, failure cases, and known limitations.
- [ ] Deterministic tests are repeatable and run in CI.
- [ ] No secrets, credentials, personal data, or live integrations in fixtures.
- [ ] Errors are visible, recoverable, and never represented as success.
- [ ] Observability contracts defined without collecting real user data by default.

### 7. Documentation and release readiness
- [ ] README explains how to run and test locally without API keys.
- [ ] Architecture diagrams and capability ownership agree with actual code.
- [ ] Build/test instructions work from a clean checkout.
- [ ] Known limitations and unimplemented capabilities are explicit.
- [ ] CI covers Python tests, JavaScript syntax, classifier behavior, schemas, and architecture guards.
- [ ] Release checklist and acceptance evidence are recorded.
- [ ] No unresolved critical or high-severity defects.

## Integration authorization gate

External integrations may be considered only after all applicable criteria above are checked, CI is green on the final commit, and the local product journey is usable without secrets or external services. Integration work must then proceed in this order:

1. Provider-agnostic contracts and mocked behavior.
2. A single controlled model-provider adapter behind the Model Gateway.
3. Read-only integrations with narrow scopes and explicit user consent.
4. MCP discovery/registry with deny-by-default permissions and tool-level tests.
5. Any write-capable tool only after verification, audit trails, confirmation gates, and rollback/compensation behavior are proven.
6. Deployment infrastructure only after local build and deployment-independent tests are stable.

Passing this document's gate is not a claim that every future product is complete. It is the evidence-based authorization to begin a controlled integration phase.

## Current rule

**No APIs. No Vercel-specific infrastructure. No MCP connections until the applicable pre-integration exit criteria are complete and verified.**

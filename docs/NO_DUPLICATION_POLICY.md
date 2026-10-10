# Chanakya No-Duplication Architecture Policy

**Status:** Binding engineering rule  
**Applies to:** Every product, core module, agent, integration, UI component, and test added to this repository.

## Principle

Build a capability once, give it one clear owner, and reuse it through a documented interface. Do not create a second implementation just because a new product needs the capability.

Chanakya is one ecosystem with multiple product experiences, not a collection of disconnected applications.

## Required checks before implementation

Before adding a feature, the implementer must:

1. Search the repository for existing components, utilities, schemas, services, tests, and documented decisions that may already solve the problem.
2. Identify the canonical owner of the capability.
3. Decide whether the work is reuse, extension, or a genuinely new capability.
4. Record the interface and dependency direction before creating a parallel implementation.
5. Add tests that prove the new work reuses the canonical implementation where applicable.

If the existing implementation is unsuitable, document the specific limitation and migration plan before replacing or splitting it.

## Single-owner rules

- **Command Center:** owns cross-product navigation, workspace shell, global status, and ecosystem-level task visibility. It must not implement separate copies of product logic.
- **Product apps:** own their product-specific workflows and presentation. They consume shared core services rather than reimplementing them.
- **Model Gateway:** the only canonical provider-adapter boundary. Product apps must not each implement their own provider clients.
- **Intelligence Router:** the only canonical model/tool selection policy.
- **Agent Runtime:** the only canonical agent lifecycle, permission enforcement, and execution boundary.
- **Tool Registry / Integrations:** the canonical tool definitions, connector contracts, and scopes.
- **Memory and Retrieval:** the canonical interfaces for persistent context, retrieval, provenance, retention, and deletion.
- **Workflow Engine:** the canonical workflow state and handoff model.
- **Verification and Reconciliation:** the canonical task outcome, evidence, freshness, and remaining-work model.
- **Identity and Permissions:** the canonical authorization policy. UI visibility is not authorization.
- **Design System:** the canonical tokens and reusable UI primitives. Product-specific branding or layouts may compose them but must not fork them without an explicit reason.
- **Shared Types and Schemas:** canonical cross-module contracts. Avoid near-identical schemas with different names.
- **Evaluation Harness:** canonical test fixtures and evaluation runners where the behavior under test is shared.

These are intended ownership boundaries. A module is not considered implemented merely because its name or folder exists.

## Dependency direction

- Product apps may depend on shared packages and approved core interfaces.
- Core modules must not import product-specific UI or application code.
- Shared packages must remain domain-neutral where practical.
- Integrations adapt external systems to Chanakya contracts; product logic must not leak into individual connectors.
- Avoid circular dependencies.
- Do not duplicate third-party SDK clients, retry policies, auth handling, logging, or error normalization across modules.

## Before creating a new module or dependency

Record:
- The user-visible problem it solves.
- Why existing modules cannot own the responsibility.
- Its public interface and owner.
- Its dependencies and data boundaries.
- Security and privacy implications.
- How it will be tested and measured.
- The removal or migration path if it fails to provide value.

Prefer the smallest addition that satisfies the requirement. Do not add an abstraction solely for hypothetical future use.

## UI and product integrity

- The Command Center is a control plane and entry point, not a duplicate implementation of each product.
- A product card or route must clearly distinguish implemented, prototype, planned, and unavailable capabilities.
- Reuse the actual product interface when available; do not create a second mock that diverges from it.
- Do not show duplicate task counts, run histories, settings, or status as separate sources of truth.
- Every metric must have one documented source and definition.

## Tests that prevent duplication

For each shared capability:
- Test its canonical implementation directly.
- Test consumers against the shared contract.
- Add architecture checks for forbidden dependency directions where practical.
- Search for duplicated constants, policy rules, schemas, and provider/tool implementations during review.
- Keep one canonical fixture for shared behavior unless a test explicitly needs a distinct scenario.

## Definition of done

A feature is not complete until:
- Existing capabilities were searched and reused where appropriate.
- Ownership and interfaces are documented.
- Duplicate sources of truth have not been introduced.
- Relevant unit, integration, and architecture tests pass.
- The UI accurately represents the implementation state.
- Known limitations and migration decisions are recorded.

## Review question

Before every merge, ask:

**“Are we adding a new capability, or rebuilding something Chanakya already owns?”**

If the answer is rebuilding, stop and reuse or refactor the canonical implementation instead.

# Repository Architecture and Duplication Audit

**Audit date:** 10 October 2026  
**Scope:** Current tracked source files, product entry points, shared responsibilities, data sources, and CI checks.  
**Status:** Initial static audit. This is not a security audit or a browser end-to-end test.

## Executive finding

The repository is still a small static prototype plus a Command Center shell. It does not yet contain a working AI platform core. The current structure is suitable for incremental development, but ownership boundaries and source-of-truth checks need to be enforced before adding more products.

The most concrete duplication risk found is the synthetic Cognitive Firewall dataset being maintained in both JSON and a JavaScript bundle. The test suite reads the JSON while the browser prototype reads the JavaScript bundle. Without an explicit consistency check, the two copies can drift.

## Current inventory and ownership

| Path | Current responsibility | Canonical ownership decision |
|---|---|---|
| `index.html` | GitHub Pages entry point and redirect | Single public entry point to the Command Center |
| `apps/command-center/` | Ecosystem overview, navigation, product status, shared shell | Owns cross-product navigation and ecosystem-level visibility only |
| `prototype/` | Local Cognitive Firewall UI, deterministic classifier, synthetic sample data | Canonical first-product implementation; product logic stays here until intentionally refactored |
| `prototype/data/sample_messages.json` | Readable synthetic fixture used by tests | Canonical editable dataset |
| `prototype/data.js` | Browser-loadable bundle of the synthetic fixture for offline `file://` preview | Generated mirror of the JSON fixture; do not edit independently |
| `tests/test_cognitive_firewall.py` | Existing Python seed-label and safety regression checks | Keep tests, but do not treat the mirrored Python classifier as proof that JavaScript behavior matches |
| `.github/workflows/ci.yml` | Python and JavaScript checks | Add checks for the Command Center and dataset synchronization |
| `docs/` | Architecture, product thesis, plans, and policies | Keep one canonical decision document per topic; link to it rather than copying its content |

## Findings

### F1. Dataset has two representations

- JSON: `prototype/data/sample_messages.json`
- Browser bundle: `prototype/data.js`

**Decision:** JSON is the canonical editable fixture. The JavaScript file is a browser-compatible generated mirror because the prototype is intentionally offline and must work when opened directly without a server or network request.

**Control added:** Automated test parses the bundled JavaScript array and compares it structurally with the JSON fixture. Any drift fails CI.

**Future improvement:** Add a deterministic generation script so the bundle is produced from JSON rather than edited by hand. Keep that step small and dependency-free.

### F2. Product UI and ecosystem UI are separate, not duplicate products

- `apps/command-center/` is the ecosystem shell and navigation.
- `prototype/` is the Cognitive Firewall product.

Both have HTML, CSS, and JavaScript, but they have different ownership and behavior. They should not be merged into one giant script or copied into each other. The Command Center should link to or embed the actual product when integration is intentionally designed, not reimplement classification.

### F3. Shared design tokens are not yet centralized

The two UI surfaces have separate CSS variables and styling. That is a future reuse opportunity, but extracting a shared design package before there are stable shared primitives would add unnecessary infrastructure.

**Decision:** Do not introduce a design-system package yet. First identify genuinely shared tokens and primitives, then extract only those with more than one real consumer and add visual regression checks.

### F4. Classifier logic is mirrored in Python tests

The current test helper `baseline_category()` duplicates the intended classifier rules from `prototype/app.js`. This can allow the Python tests to pass while JavaScript logic drifts.

**Decision:** Treat these tests as seed-label checks only. Next testing milestone is to expose/test the actual JavaScript classifier in Node without DOM coupling, then use the same implementation for product behavior and regression tests.

### F5. Core platform modules are not implemented yet

Model Gateway, Intelligence Router, Agent Runtime, Memory, Tool Registry, Workflow Engine, Identity/Permissions, and Verification/Reconciliation are architectural targets, not current source modules.

**Decision:** Do not create empty folders for these concepts. Add each module only with a concrete consumer, a stable contract, and tests.

### F6. No automated browser test currently verifies the visual interface

The current CI checks syntax and Python regression rules, not actual rendering, responsive behavior, or menu interactions.

**Decision:** Keep the existing lightweight static UI for now. Add browser automation only when it can run reproducibly in CI and validates a real user journey, rather than adding dependencies for appearance alone.

## Target dependency direction

```text
GitHub Pages entry
        |
        v
Command Center (ecosystem shell)
        | links to / coordinates via contracts
        +------------------------+
        |                        |
        v                        v
Product apps                Shared capabilities
(Cognitive Firewall,        (added only when implemented
future products)             and used by real consumers)
        |                        |
        +----------+-------------+
                   v
           Policy / permission boundaries
                   |
                   v
          Approved provider / tool adapters
```

Product apps must not import other product apps' internals. Shared capabilities must not depend on product UI. The Command Center must not become a second source of product business logic.

## Immediate controls

- [x] Document canonical owners and current sources of truth.
- [x] Define JSON as the canonical synthetic fixture and test the browser bundle for drift.
- [x] Extend CI to syntax-check the Command Center JavaScript.
- [ ] Replace mirrored Python classifier assertions with tests of the actual JavaScript implementation.
- [ ] Verify menu, route, keyboard, and mobile behaviors in browser automation.
- [ ] Revisit design token extraction after real shared components emerge.

## Audit principle

Before creating any file or capability, search this inventory and the repository. Prefer extending the canonical owner. If an exception is necessary, document why the existing owner cannot serve the use case.

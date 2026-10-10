# Chanakya Brain Seed: Dataset Operations

This folder contains the initial, versioned behavioral corpus for Chanakya. It is an application-level knowledge and evaluation source, not a model-weight checkpoint.

## Source of truth
- `cognitive_seed_dataset.json`: canonical structured examples and principles.
- `../runtime/CHANAKYA_BRAIN_SYSTEM.md`: intended cognitive contract for the model-backed runtime.
- `../../tests/brain-dataset.test.cjs`: schema/provenance regression test.
- `../../tests/brain-corpus.test.cjs`: generated-corpus integrity checks.

## Dataset lifecycle
1. Preserve source repository/path provenance for every imported rule or example.
2. Normalize each example to input, desired behavior, forbidden behavior, capability labels and source attribution.
3. Keep evaluation cases separate from training demonstrations. Never use the holdout set as training data.
4. Review contradictions and sensitive content before adding examples.
5. Generate JSONL deterministically; do not hand-edit generated files.
6. Evaluate the live model/application against held-out cases before any tuning.
7. Record dataset version, generation command, example counts and checksums with every release.

## Training data policy
- No automatic training from private conversations or unreviewed user traces.
- No secrets, API keys, credentials or unnecessary personal data.
- Do not label a generated answer as gold merely because a model produced it.
- Training examples must demonstrate desired behavior with all necessary context.
- Split by scenario family, not random near-duplicate rows, to reduce leakage.
- Maintain adversarial and edge-case holdouts.
- Fine-tuning is optional and provider-dependent. First optimize the shared runtime, instructions, retrieval and tools.

## Current status
The seed corpus is an initial consolidation from inspected SAARTHI and NOVA source files. It is not yet a complete crawl of either repository and has not been independently adjudicated. It must not be represented as a trained or production-validated model.

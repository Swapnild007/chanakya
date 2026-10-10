# Chanakya Cognitive Firewall Prototype

A local, no-build-step prototype for testing the first product wedge.

## Run

Open `index.html` directly in a modern browser. The prototype uses local synthetic data and browser JavaScript. It requires no API key, server, network access, MCP server, or package installation.

## What works

- Five-category triage with a deterministic baseline classifier.
- Search and category filtering.
- Inspectable source, rationale, evidence, and recommended next step.
- User correction of a classification for the current session.
- A simple decision stress-test prompt form (local demonstration only).
- Visible read-only / synthetic-data status.

## What does not work yet

No real AI model is connected. No real accounts or live messages are connected. No messages are sent, deleted, moved, or approved. Session corrections are not persisted to a backend. Any displayed counts are calculated from the bundled synthetic dataset, not from real user activity.

## Next engineering step

Add automated tests for classification and suppression safety, then compare the rules baseline with a model-assisted classifier behind a provider-independent server-side interface. Do not add external integrations until the evaluation harness is in place.

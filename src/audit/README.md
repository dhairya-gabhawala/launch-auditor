# Audit Module

This folder contains the analysis pipeline for Adobe Launch containers.

## Structure
- `utils/`: Fetching, URL extraction, container parsing, RC handling, timestamps, module names.
- `analyzers/`: Focused analyses for data elements, rules, custom code, and release notes.
- `src/audit.js`: The main orchestrator (`runAudit`).

## Conventions
- Keep analyzers side-effect free where possible.
- Do IO (fetch/write) in `utils` or the orchestrator.
- Prefer small, testable helpers.

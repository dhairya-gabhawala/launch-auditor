# Render Module

This folder contains the HTML rendering pipeline for audit reports.

## Structure
- `utils/`: Small, reusable helpers (escaping, code formatting, diff trimming, cards, lists).
- `sections/`: Larger UI sections composed from utils.
- `src/render.js`: The main `renderReportHtml` entry point.

## Conventions
- Keep functions pure and string-based (no DOM).
- Prefer small helpers over long inline blocks.
- Avoid business logic here; compute in `audit` and pass model data in.

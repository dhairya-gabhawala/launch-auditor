# Launch Auditor

Launch Auditor is a Node web application that audits Adobe Launch/Tags containers and produces polished, shareable HTML reports for performance and implementation review.

## Quick Start

1. Install dependencies:

```bash
npm install
```

After install, the app auto-creates `config.json` from `config.template.json` (if `config.json` does not exist) so you can start from the example site.

2. Start the app:

```bash
npm start
```

3. Open the UI:

`http://localhost:4545`

## Features

- Audits containers (single audit or old/new comparison)
- Generates readable HTML reports with breakdowns and opportunities
- Organizes runs by site and timestamp under `runs/`
- Sidebar UI to browse, search, and delete runs
- Built-in configuration manager
- Run audits directly from the web UI (no CLI needed)

## Configuration

Edit from the UI (Manage Config) or directly in `config.json`:

```json
{
  "sites": {
    "example-site": {
      "environments": {
        "production": "https://assets.adobedtm.com/.../launch.js",
        "staging": "https://assets.adobedtm.com/.../launch-staging.js"
      }
    }
  },
  "approvedDomains": ["assets.adobedtm.com"],
  "maxRcFiles": 150,
  "maxCustomCodeActions": 120
}
```

## Reports

Reports are saved at:

```
runs/<site>/<Diff|Audit>-<environment>-<timestamp>/release-<release>-<timestamp>-audit.html
```

## App Pages

- `/` Main app with sidebar and report viewer
- `/docs` How-to documentation
- `/dev` Developer guide
- `/config-ui` Configuration manager

## Notes

- Code blocks are formatted client-side using Prettier and Prism (via CDN).
- Opportunities show only findings with actionable recommendations.

## Requirements

- Node.js 18+ recommended
- Internet access to fetch container scripts and CDN assets

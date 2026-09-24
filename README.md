# salt-command

The Salt Command desk as an installable phone app. Same desk as the laptop, deployed as a
Cloudflare Worker with a KV-backed queue so a transaction added on the phone reaches the ledger.

**It is open, by the owner's decision of 11 Aug 2026**, and the Access application was removed to
match: no sign-in, reads open to anyone holding the URL, writes gated by `X-Salt-Key`. See
"Access, and why it is off; the write gate" in [CLAUDE.md](CLAUDE.md).

- **Read [CLAUDE.md](CLAUDE.md) before editing anything.** It carries the hard rules, the
  three-surface model, the queue loop and the deploy runbook.
- The desk is **not edited in `public/`.** The only editable source is
  [`master/salt_command.html`](master/salt_command.html), which moved into this repo from
  `Per-Crm01\30_Published\` on 20 Aug 2026 so the daily commit no longer needs the
  laptop; `public/desk.html` is built from it by `npm run build`.
- Names never reach the cloud: the phone shows codes only.

## Quick start

```
npm install
npm run build      # master -> public/desk.html
npm test           # smoke suite, no network
npm run deploy     # build, then wrangler deploy
```

Then create the KV namespace as set out in [docs/DESK.md](docs/DESK.md), "First-time Cloudflare, and local work". There is no Access
application to create: setting `REQUIRE_ACCESS` back to `"1"` without first recreating that
application **with a policy attached** locks the owner out of his own desk.

## What lives where

- `master/salt_command.html` is the desk itself and the ONLY editable source. What stayed behind
  in Per-Crm01 is what must never be committed: the plaintext directory, the vault and the queue
  files.
- `public/` is everything served: the built desk, the service worker, the manifest, the icons,
  the headers. `public/desk.html` is committed on purpose (the data is meant to live in the
  repo) but is a build output, never hand-edited.
- `src/worker.js` is the cloud stand-in for the laptop's `serve_desk.py`.
- `tools/` holds the build, the KV drain and the icon generator.
- `test/verify.mjs` is the suite.

This repo is **private**: it holds the real trading ledger.

# salt-command

The Obsidian Salt Desk as an installable phone app. Same desk as the laptop, deployed as a
Cloudflare Worker behind Cloudflare Access, with a KV-backed queue so a transaction added on
the phone reaches the ledger.

- **Read [CLAUDE.md](CLAUDE.md) before editing anything.** It carries the hard rules, the
  three-surface model, the queue loop and the deploy runbook.
- The desk is **not edited here.** The master is the Cow-Crm01 `salt_command.html`;
  `public/index.html` is built from it by `npm run build`.
- Names never reach the cloud: the phone shows codes only.

## Quick start

```
npm install
npm run build      # master -> public/index.html
npm test           # smoke suite, no network
npm run deploy     # build, then wrangler deploy
```

Then create the KV namespace and Cloudflare Access application as set out in
[CLAUDE.md](CLAUDE.md#deploying).

## What lives where

- `public/` is everything served: the built desk, the service worker, the manifest, the icons,
  the headers. `public/index.html` is committed on purpose (the data is meant to live in the
  repo) but is a build output, never hand-edited.
- `src/worker.js` is the cloud stand-in for the laptop's `serve_desk.py`.
- `tools/` holds the build, the KV drain and the icon generator.
- `test/verify.mjs` is the suite.

This repo is **private**: it holds the real trading ledger.

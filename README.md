# Nightshade Forge

A private, local-first roleplay and writing studio.

## Current foundation

- 18+ age confirmation
- User-selected four-digit access code
- Raw PIN is not persisted; a salted SHA-256 verifier is stored using Web Crypto
- Browser-local IndexedDB persistence
- Local character storage
- Exportable JSON backup
- Per-category/local-data controls and erase-all confirmation
- Mobile-first dark gothic UI

## Run

This first foundation is a static browser app. Open `index.html` locally or serve the repository with any static web server.

## Roadmap

Character Forge, persistent conversation engine, memory controls, group rooms, voice adapters, call mode, model/provider adapters, tool permissions, and richer import/export will be layered on top of this foundation.

## Privacy

The app is designed around local browser storage by default. Connecting a future external AI provider is a separate choice and will require explicit configuration.

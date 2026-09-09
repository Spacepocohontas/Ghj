# Nightcast Studio

Local-first character podcast studio.

## Audio engines

1. **Default / Offline:** Browser SpeechSynthesis. No API key or paid service required.
2. **ElevenLabs:** Optional higher-quality voice generation. Keep `ELEVENLABS_API_KEY` server-side; never commit it.
3. **Gemini / NotebookLM:** Export a Gemini Podcast Pack from an episode, import the Markdown into NotebookLM, generate an Audio Overview, then import the resulting audio into Nightcast.

## Data

Characters, per-character memory, cast configuration, and episodes are stored locally in the browser. Use Export Library for backup and Import Library to restore.

## Deployment

The `nightcast/` directory is a static site and can be served by GitHub Pages, Vercel, or a Hugging Face Static Space.

For a secure ElevenLabs backend, deploy a small serverless endpoint separately and store `ELEVENLABS_API_KEY` as a platform secret. Do not place the key in `app.js`, HTML, localStorage, or GitHub.

# How to open and run this app (super easy)

This is for kids or anyone who wants very simple steps.

Files you need:
- `index.html` — this opens the app.

Way 1 — Double‑click (best for beginners)
1. Find the project folder on your computer. It has `index.html` inside.
2. Double‑click `index.html`.
3. A web browser (Chrome, Safari, Edge, Firefox) will open the app. Hooray!

Way 2 — Tiny web server (if double‑click doesn't work)
- On Mac or Linux:
  1. Open Terminal (the app where you type commands).
  2. Type: `python3 -m http.server 8000` and press Enter.
  3. Open a web browser and go to: `http://localhost:8000`

- On Windows (PowerShell):
  1. Open PowerShell.
  2. Type: `python -m http.server 8000` and press Enter.
  3. Open a web browser and go to: `http://localhost:8000`

Way 3 — Put it on the web with GitHub Pages (so friends can open it)
1. Go to your repo on GitHub.
2. Click Settings → Pages.
3. Under Source pick the branch (usually `main`) and folder `/ (root)`.
4. Click Save.
5. Wait a minute, then open the web address GitHub gives you.

Tiny troubleshooting
- Blank page? Make sure you opened the right folder with `index.html`.
- Files not loading? Try Way 2 (the tiny server).
- Error in the app? Tell me what the browser shows and I will help.

If you want, I can keep this short README exactly like this in your repo. I just added it so anyone can run the app easily.

---

## For developers

The app is plain HTML/CSS/JS with no build step — `index.html` loads each script
in order and every module layers itself on top of `window.render`.
`api/` holds the Vercel serverless functions (ElevenLabs TTS bridge, voice
cloning, and presigned Blob uploads for voice samples).

Checks before pushing:

```bash
npm install     # jsdom + fake-indexeddb, used only by the tests
npm run check   # parse every browser and API script
npm test        # boot index.html in jsdom and walk every screen
```

`npm test` loads the real `index.html` with the real script order, then clicks
through the age gate, PIN setup, character creation, every tab, a chat round
trip, branching/regeneration, and the lock screen. Any uncaught exception,
unhandled rejection, or app-level console error fails the run, so a syntax error
or a broken screen is caught before it reaches the browser. The same two
commands run in CI (`.github/workflows/ci.yml`); `.github/workflows/static.yml`
publishes the site to GitHub Pages.
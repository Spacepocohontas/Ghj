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

## 🔐 Protecting API Keys & Secrets

Never commit API keys, tokens, or credentials to this repository. Use **git-secrets** to prevent accidental leaks.

### Setup git-secrets (one-time)

**Install git-secrets:**
```bash
# macOS (Homebrew)
brew install git-secrets

# Ubuntu/Debian
sudo apt-get install git-secrets

# Or build from source
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
sudo make install
```

**Initialize in this repository:**
```bash
git secrets --install
```

**Add secret patterns:**
```bash
# ElevenLabs API keys (sk_*)
git secrets --add 'sk_[A-Fa-f0-9]{32,}'

# GitHub tokens
git secrets --add 'gh[pousr]_[A-Za-z0-9_]{36,}'

# AWS credentials
git secrets --register-aws
```

**Scan existing history:**
```bash
git secrets --scan
```

### Store secrets safely

Use a `.env` file (never commit it):
```bash
# .env (add to .gitignore)
ELEVENLABS_API_KEY=sk_your_key_here
```

For production, use GitHub Secrets or environment variables on your hosting platform.

**Reference:** [git-secrets GitHub](https://github.com/awslabs/git-secrets)

## Document uploads and music video controls

Nightshade character imports and both Nightcast podcast pages now read TXT, Markdown, JSON, HTML, CSV, PDF with selectable text, DOCX, EPUB, ODT and RTF locally in the browser. Review the character editor before saving; podcast pages also offer an episode source upload. Existing PNG character cards remain supported. Unsupported binary files produce a readable error instead of becoming garbled character text. Scanned PDFs need OCR; legacy DOC/encrypted documents need conversion. Limits: 25 MB, 500 PDF pages, 500,000 extracted characters. `document-support/` contains the reader source, build instructions, dependency licenses, and browser extraction regression tests. Standalone podcast deployments carry the same local reader under their own directory.

Media DJ now offers full app/preview fullscreen, timed random visualization changes, separate original-video mute and soundtrack volume, video delay, synchronized playback/seeking, and recordings containing both the canvas video and the mixed soundtrack. Load a video, add replacement audio, leave original audio muted, then use Play; the replacement track drives the video clock.

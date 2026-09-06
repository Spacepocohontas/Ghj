# 🌑 Nightshade Forge — Vision, Feature Ledger & Roadmap

> **North star:** a private AI character *operating system*. Create, own, evolve,
> remember, hear, see and interact with persistent AI characters inside living
> fictional worlds — without renting your creative universe from Character.AI,
> Shapes, OpenRouter or anyone else. Those are providers. **Nightshade Forge is
> the home.**
>
> *My characters are mine. My conversations are mine. My worlds are mine.*

This document has two halves:

1. **The vision** — everything you've asked this app to become (§1–§20).
2. **The ledger** — what the code in this repo actually does today, honestly
   graded, so the roadmap is built on facts instead of intentions.

Legend: ✅ built · 🟡 partial / works but shallow · ⬜ not started

---

## Part 1 — Everything you've asked for

### 1. 🔐 Private, local-first foundation
18+ gate · PIN protection · local-first storage · persistent across sessions ·
export / import backups · delete everything · no centralized account required ·
your data belongs to you.

### 2. 🤖 A genuinely capable character system
Characters that feel like people, not vending machines: personality, identity,
appearance, backstory, speech patterns, accent, traits, likes/dislikes,
relationships, motivations, goals, secrets, fears, boundaries, knowledge,
memories, lore, emotional state, relationship state, current activity, ongoing
plot threads. Critically — they must be able to **disagree, tease, hesitate,
refuse, get angry, become affectionate, change their mind, initiate, choose,
and pursue their own goals.**

### 3. 🧠 Serious long-term memory
Not "stuff the whole transcript into the prompt." Distinct memory types: chat
history · facts · event memories · pinned memories · relationship memory ·
world/lore memory · character memory · plot memory · **semantic retrieval** so
the *relevant* old thing surfaces instead of everything.

### 4. 🧬 Character state that evolves
Mood, relationship level, current activity, goals, secrets, plot threads,
emotional momentum — all changing as a consequence of what happens. Insult a
character and the *relationship* changes, not just one angry paragraph.
Apologize and it recovers — slowly. Character **simulation**, not prompting.

### 5. 📚 Full character card & lorebook system
SillyTavern-level control: character cards (JSON + PNG), worldbooks, multiple
lorebooks, keyword-triggered lore, scenario, greetings, alternate greetings,
example dialogue, author notes, system instructions, per-character context —
and the ability to **import characters from other systems** instead of
rebuilding them by hand.

### 6. 🎭 Character Studio
One place to build a character like you're building a person: name, avatar,
profile, personality, appearance, backstory, speech style, scenario, greetings,
lore, memories, voice, relationships, secrets, goals, behavioral rules, state,
autonomy, model preference. *Create → Configure → Give a Voice → Give a World → Chat.*

### 7. 🔊 Character voices
Per-character voice assignment · voice library · samples · recordings · uploads ·
cloning · ElevenLabs · browser TTS fallback · settings · preview · persistence.
And explicitly: **replies should speak automatically, like Character.AI** —
send message → character responds → character talks.

### 8. 🎙️ Voice cloning & upload
MP3, MP4, WAV, M4A, WebM, MOV, OGG, FLAC, AAC. Big files can't go through a
serverless function (Vercel caps request bodies around 4.5 MB), so the correct
architecture is **Device → Vercel Blob → ElevenLabs**, not
Device → function → giant base64 JSON → ElevenLabs.

### 9. ☎️ Real character calls
Two-way: you talk → character hears → AI responds → character speaks back.
Microphone, mute, typed fallback, live transcript, character voice, and the
call preserved as part of the conversation you can return to.

### 10. 💬 Advanced chat controls
Persistent history · multiple conversations · chat list · regenerate ·
alternative responses · response history · edit · delete · long-press /
right-click menu · rewind · branching · continue-scene · typing indicators ·
character status · avatars. **Never destroy the story to try something
different — branch it.**

### 11. 🌿 Conversation branching
Timeline A (you chose X) and Timeline B (you rewound and chose Y) both survive.
A persistent interactive-novel engine, not a linear log.

### 12. 🎬 Scenes & storytelling
Structured scenarios, stories, ongoing plots, alternate scenarios, worlds,
campaigns, long-running narratives. The character should always know: *where we
are, what just happened, what we're doing, what's unresolved.*

### 13. 🎨 Generated images
Character portraits, scenes, environments, story moments, references, avatars,
galleries — attached to the character/story/chat they belong to.

### 14. 🎥 Video
Generated video, uploaded video, story/character video content, playback,
visualizations.

### 15. 🎵 Music & media studio
Audio/music/MP3/MP4 handling, playback, visualizations, generated + uploaded
media, DJ tools: mute the original audio of an uploaded file, overlay a
visualization, save the project, download the result.

### 16. 🌐 Web access & knowledge
Search, crawl, retrieve, and use external information — while keeping *character
knowledge* and *temporary external information* clearly separate.

### 17. 🔌 Multiple AI providers
Provider + model selection, OpenRouter, free models, different models per
character, local models, configurable custom endpoints. Nightshade Forge is an
**orchestration layer**, not one API wrapped in a UI.

### 18. 🧩 Skills / tools / MCP
Characters with *capabilities*, not just text: tools, skills, external services,
MCP integrations, character-specific abilities. The character becomes an agent.

### 19. 🧠 Autonomy / free will
Initiate conversation, continue scenes, pursue goals, react to inactivity,
remember unresolved things, decide, develop, surprise you.
*The character shouldn't disappear mentally the moment I stop typing.*

### 20. 🏠 Local ownership
Character.AI, Shapes, SillyTavern, OpenRouter, ElevenLabs, any single model or
host — all optional integrations. None of them is the home.

---

## Part 2 — What actually exists today

### Foundation & privacy

| Ask | Status | Where | Gap |
|---|---|---|---|
| 18+ age gate | ✅ | `app.js` | — |
| PIN lock (salted SHA-256, raw PIN never stored) | ✅ | `app.js` | — |
| Local-first storage (IndexedDB vault) | ✅ | `app.js` | — |
| Export backup / delete everything | ✅ | `app.js` (Vault tab) | Now exports every vault section; the API key is deliberately excluded |
| **Encryption at rest** | ✅ | `app.js` (`window.nfVault`) | Opt-in from Settings → Vault encryption. AES-GCM-256, key = PBKDF2-SHA256(PIN, 210k). Records are stored as `{__nfEnc,iv,ct}`; only the `security` record stays plaintext. Key is memory-only, so every reload asks for the PIN. A backup downloads before it is switched on, because a forgotten PIN is unrecoverable |
| Import a backup | ✅ | `app.js` (Vault tab) | Merge or replace; arrays de-duplicated by id |

### Characters

| Ask | Status | Where | Gap |
|---|---|---|---|
| Core fields (name, personality, appearance, backstory, scenario, greeting, RP rules, tags) | ✅ | `forge-pass2.js`, `character-studio.js` | — |
| Avatars: upload + procedurally generated SVG | ✅ | `character-studio.js` | No AI portrait generation |
| Edit existing characters | ✅ | `character-studio.js` | — |
| Card metadata (creator, version, notes, system prompt, post-history, example dialogue, alternate greetings) | ✅ | `character-cards.js` | Alternate greetings are stored but never *offered* when starting a chat |
| Import JSON cards | ✅ | three separate importers | — |
| Import PNG character cards (tEXt/iTXt `chara`) | ✅ | `character-studio.js`, `forge-studio.js` | — |
| Export as `chara_card_v2` | ✅ | `character-cards.js` | — |
| Character fidelity prompt scaffold | ✅ | `prompt-context.js` | Strong anti-"generic assistant" instructions already injected |
| Speech patterns / accent as first-class fields | 🟡 | folded into personality text | No dedicated fields the voice engine can also read |
| Fears / boundaries / relationships as structured fields | 🟡 | free text | Not structured, so nothing can reason over them |

### Memory

| Ask | Status | Where | Gap |
|---|---|---|---|
| Manual memories per character | ✅ | `forge-pass2.js` (Memory button) | — |
| Auto-extracted memories | 🟡 | `autonomy-memory.js` | Eight patterns now (adds work/live, fears, open threads) and each is typed. Still regex, not comprehension |
| Relevance-ranked injection | ✅ | `nf-core.js` | idf-weighted term matching + type weighting + recency tie-break, budgeted to ~1800 chars. Free and offline |
| **Semantic retrieval** | 🟡 | `nf-core.js` | Ranking is lexical, so synonyms still miss. True embeddings need a model — free locally via Ollama, so this is a later opt-in |
| **Memory types** (fact vs event vs pinned vs relationship vs plot) | ✅ | `nf-core.js` | `fact · event · relationship · plot · world · preference`, plus pinning. Legacy strings migrated automatically |
| Memory manager UI (view / edit / pin / delete) | ✅ | `memory-studio.js` | Search, add, type, pin, edit, delete, export. Opens from the ✦ button in chat |
| Conversation-scoped memory | 🟡 | `conversation.memory[]` exists | Nothing writes to it |

### Character state

| Ask | Status | Where | Gap |
|---|---|---|---|
| Live mood / relationship / activity / goals / secrets / plot threads | ✅ | `character-state.js` | — |
| State injected into every prompt | ✅ | `character-state.js` | — |
| State evolves from messages | 🟡 | `character-state.js` | Keyword lists (`angry`, `jealous`, `sorry`…) and regex goal-sniffing. Deterministic and cheap, but it can't read subtext or sarcasm |
| State visible in chat header | ✅ | `chat-status.js` | — |
| Manual state editor | ✅ | `character-state.js` | — |
| **Emotional momentum / gradual repair** | ⬜ | — | State snaps between labels; there's no numeric trust/affection that decays and recovers |
| **Model-driven state updates** | ⬜ | — | The obvious upgrade: ask the model for a small JSON state delta after each reply |

### Lore & worlds

| Ask | Status | Where | Gap |
|---|---|---|---|
| Per-character lorebook | ✅ | `character-cards.js` | — |
| Shared reusable lorebooks, up to 5 per character | ✅ | `forge-studio.js`, `forge-enhancements.js` | — |
| Keyword-triggered injection with priority | ✅ | `prompt-context.js`, `forge-enhancements.js` | Exact substring matching only — no fuzzy/semantic triggers |
| Import lorebook files / URLs | 🟡 | `capability-studio.js` | URL import previews text but can't save it |
| **Three competing lorebook stores** | ⚠️ | `lorebooks`, `nf_lorebooks`, `character.lorebook` | Same feature, three data homes |

### Chat

| Ask | Status | Where | Gap |
|---|---|---|---|
| Persistent multi-conversation history | ✅ | `chat-list.js`, `chat-history.js` | — |
| Chat list with previews, search, delete | ✅ | `chat-list.js` | — |
| Regenerate + response variants with ‹ › navigation | ✅ | `chat-history.js` | — |
| Edit / delete messages | ✅ | `forge-pass2.js`, `message-menu.js` | — |
| Long-press & right-click message menu | ✅ | `message-menu.js` | — |
| Branching / rewind / "start here" | ✅ | `conversation-branches.js`, `chat-rewind.js` | — |
| Continue-scene (empty send = character acts) | ✅ | `forge-pass2.js` | — |
| Typing indicator, avatars, presence | ✅ | `chat-history.js`, `chat-status.js` | — |
| Streaming responses | ⬜ | — | Replies arrive in one block; no token streaming |
| Group chats / multiple characters in a scene | ⬜ | — | One character per conversation |

### Voice

| Ask | Status | Where | Gap |
|---|---|---|---|
| Browser TTS per character (voice, rate, pitch) | ✅ | `voice-call.js`, `forge-studio.js` | — |
| Voice Studio: profiles, samples, upload, record, preview, assign | ✅ | `forge-studio.js` | — |
| ElevenLabs bridge | ✅ | `api/tts.js`, `voice-adapter.js` | Needs `ELEVENLABS_API_KEY` on the Vercel deployment |
| Instant voice cloning from audio/video | ✅ | `voice-clone.js`, `api/tts.js?action=clone` | — |
| Large uploads via Device → Blob → ElevenLabs | ✅ | `api/voice-upload.js` | Needs `BLOB_READ_WRITE_TOKEN`; the presign call was broken until this week's fix |
| **Automatic speech on reply (Character.AI style)** | ✅ | `auto-voice.js` | Watches the transcript and speaks new replies; toggle in the chat header |
| **Three competing voice stores** | ⚠️ | `voices`, `voiceLibrary`, `voiceCollection` | `voiceCollection` is the real one; the other two are orphaned UIs |
| Accent / emotion control | ⬜ | — | No per-emotion voice settings; mood doesn't change delivery |

### Calls

| Ask | Status | Where | Gap |
|---|---|---|---|
| Two-way call UI with timer, mute, hang-up | ✅ | `voice-call.js` | — |
| Speech recognition input | ✅ | `voice-call.js` | Web Speech API — Chrome/Edge/Safari only, no Firefox |
| Typed fallback while muted | ✅ | `call-controls.js` | — |
| Live transcript saved into the conversation | ✅ | `voice-call.js` | — |
| Interruption / barge-in | ⬜ | — | You can't talk over the character |

### Providers

| Ask | Status | Where | Gap |
|---|---|---|---|
| Provider Studio (endpoint, key, model, test button) | ✅ | `provider-studio.js` | — |
| OpenRouter + live free-model catalog | ✅ | `forge-pass2.js` | — |
| Per-conversation model override | ✅ | `forge-pass2.js` | — |
| **Local models** | ✅ | via "Custom OpenAI-compatible endpoint" | Ollama / LM Studio / llama.cpp already work today — point it at `http://localhost:11434/v1/chat/completions`. This is more done than you may realize |
| Per-*character* model preference | ⬜ | — | Override is per conversation, not per character |
| Key stored in plaintext IndexedDB | ⚠️ | — | Encrypted with everything else once vault encryption is on; still plaintext until then |

### Media

| Ask | Status | Where | Gap |
|---|---|---|---|
| Media Lab: load audio/video/images, play, seek, mute original | ✅ | `media-studio.js` | Was entirely dead (syntax error) until this week |
| Beat-reactive visualizers (spectrum, pulse, orbit, lyrics, nebula) | ✅ | `media-studio.js` | — |
| Lyrics overlay timed to playback | ✅ | `media-studio.js` | Naive even-split timing, no real sync |
| Record the visualization and download `.webm` | ✅ | `media-studio.js` | Now records **audio + video** by mixing the analyser output into the canvas stream |
| Save/load media projects | 🟡 | `media-studio.js` | Saves file *metadata*, not the audio itself, so a reloaded project has no sound |
| Replacement soundtrack mixing | 🟡 | `media-studio.js` | The UI exists; the second track is loaded but never actually mixed into playback |
| **Image generation** | ⬜ | — | Nothing. No provider, no gallery, no attachment to characters |
| **Video generation** | ⬜ | — | Nothing |
| **Music generation** | ⬜ | — | Nothing |

### Autonomy

| Ask | Status | Where | Gap |
|---|---|---|---|
| Autonomy settings (initiate / continue / auto-memory / idle + cooldown) | ✅ | `autonomy-memory.js` (Settings tab) | — |
| Character initiates after idle time | ✅ | `autonomy-memory.js` + `autonomy-bridge.js` | Was dead code (syntax error) until this week |
| Model decides *whether* to speak (`[[NO_INITIATIVE]]`) | ✅ | `autonomy-memory.js` | — |
| **Runs only while the tab is open** | ⚠️ | — | Polls every 15s, requires the chat tab visible. No service worker, no notifications, nothing server-side |
| Goal pursuit across sessions | ⬜ | — | Goals are recorded and shown to the model, but nothing drives them forward |

### Not started at all

| Ask | Status | Notes |
|---|---|---|
| 🎬 Scenes & stories as first-class objects | ✅ | `scenes.js` — a scene owns a title, location, time, atmosphere, premise, cast, plot threads and its own log; conversations carry a `sceneId`; the active scene is its own prompt section (priority 35). Multi-character casts are stored but only one character speaks so far |
| 🎨 Image generation | ⬜ | — |
| 🎥 Video generation | ⬜ | — |
| 🌐 Web search / crawl | ⬜ | An "Abilities" screen has a `web` toggle that saves a boolean and does nothing |
| 🧩 Tools / skills / MCP | ⬜ | Same — an `mcp` checkbox with no engine behind it |
| 📎 Attachments used in conversation | 🟡 | Files can be stored (`capability-studio.js`) but are never sent to the model |
| 👤 Personas (who *you* are in the scene) | ✅ | "Play as this persona" on the Personas tab; injected as its own prompt section |

---

## Part 3 — Architectural debt worth knowing about

This isn't criticism of the app; it's the thing that will decide how fast the
rest of the vision can be built.

- **25 scripts, most of which wrap `window.render`.** Every feature re-wraps the
  previous one's render function. It works, but load order silently decides who
  wins. The screens that lost those races — `voice-library.js`,
  `conversation-branches.js`, `chat-upgrades.js` and the unreachable
  lorebook/voice pages inside `capability-studio.js` — have now been **deleted**,
  along with the duplicate regenerate and branch buttons they injected. The
  wrapping pattern itself is still the debt.
- ~~4 separate `window.fetch` monkey-patches~~ **Fixed.** `nf-core.js` now owns
  the single interceptor and modules register named sections
  (`character`, `persona`, `assignedLorebooks`, `state`, `memory`) with
  priorities. Four call sites were also dumping *every* memory into the prompt
  unbounded; that is gone, which matters a lot on free models with small
  context windows.
- **Duplicate data stores.** `nf-core.js` migrates the stray `voices` /
  `voiceLibrary` / `lorebooks` keys into the canonical stores on first load, so
  nothing is stranded. The redundant screens are gone; character-card import is
  still implemented three times.
- **No build step, no modules, no tests until now.** A single stray brace took
  out the entire Media Lab and the entire autonomy engine, silently, for weeks —
  which is exactly what `npm test` now catches.

**The highest-leverage refactor** is a small core: one `nfPromptBuilder` that
owns the system prompt, one `nfStore` that owns the vault keys, and one router
that owns rendering. Everything in Part 4 gets dramatically cheaper afterward.

---

## Part 4 — Suggested build order

**Now — make what exists trustworthy**
1. ✅ Unified the voice and lorebook stores (auto-migration), and deleted the dead screens.
2. ✅ One prompt builder (`nf-core.js`) replacing the four fetch patches.
3. ✅ Backup import, and a complete export.

**Next — the memory upgrade you actually asked for**
4. ✅ Typed memories: `fact` · `event` · `relationship` · `plot` · `world` · `preference`, plus pinning.
5. ✅ Memory Studio — see, edit, pin, delete, search and export what a character knows.
6. ✅ Ranked retrieval (idf + type weight + recency, budgeted). Embedding-based retrieval stays optional and free via a local model later.
7. ✅ Model-driven state deltas: numeric trust/affection/tension that drift on keywords, plus an opt-in JSON patch pass (Settings → "Let the model track mood & relationship"). Repair is gradual by design.
8. ✅ Encryption at rest derived from the PIN: AES-GCM-256 keyed by PBKDF2 (210k) over the PIN, opt-in from Settings, with a forced backup download first and an explicit "a forgotten PIN cannot be recovered" warning. The key is memory-only, so every reload re-locks; changing the PIN re-keys the store.

**Then — worlds**
9. ✅ Scenes & Stories as real objects (`scenes.js`): location, time, atmosphere, premise, cast, plot threads and a scene log; conversations belong to a scene and the scene is injected into the prompt. Scene recaps can be generated with the same free model.
10. ✅ Personas injected into prompts.
11. Multi-character scenes — the data model already holds a cast; the reply loop still assumes one speaker.

**Then — senses**
11. Image generation behind the same provider abstraction, with a gallery attached to characters/scenes.
12. Attachments actually sent to vision-capable models.
13. Media Lab: record audio+video together, and persist the audio in projects.

**Later — agency**
14. Web search/crawl as a declared tool with clearly-labeled temporary context.
15. Tool/MCP execution framework; the Abilities toggles finally mean something.
16. Background autonomy via a service worker + notifications.

**Ongoing**
17. Group scenes, a scene browser outside the chat, and campaigns that string scenes together.

---

*Kept in the repo so the goal doesn't live only in a chat log. Update the ledger
as things land.*

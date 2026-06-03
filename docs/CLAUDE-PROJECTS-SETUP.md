# Claude Projects Setup – WaveScript Context

## Files to Use

You now have 4 documentation files. Here's what each is for:

### 1. **WAVESCRIPT-CONTEXT.md** ← USE THIS IN CLAUDE PROJECTS
- **Purpose:** High-level overview and feature documentation
- **Audience:** AI assistant needing project context
- **Content:** Architecture, features, IPC map, known issues, dependencies
- **When to use:** Paste into Claude Projects "Add context" field
- **Size:** ~3000 words, covers all essentials without overwhelming detail

### 2. **DEVELOPMENT.md** ← Reference During Coding
- **Purpose:** How to actually develop and make changes
- **Audience:** You, when implementing features
- **Content:** Common tasks, code patterns, debugging, testing checklist
- **When to use:** When adding settings, languages, formats, or handlers
- **Example:** "How do I add a new language?" → See DEVELOPMENT.md

### 3. **ARCHITECTURE.md** ← Reference for Design Decisions
- **Purpose:** Why things are designed the way they are
- **Audience:** You, when understanding system design
- **Content:** System diagrams, data flows, design patterns, performance details
- **When to use:** Understanding IPC architecture, data flows, error handling
- **Example:** "Why is transcription streamed instead of batched?" → See ARCHITECTURE.md

### 4. **README.md** ← Keep in Repo (Your Original One is Better)
- **Purpose:** User-facing documentation
- **Audience:** GitHub visitors, end users
- **Content:** Quick start, features, how to build/install
- **When to use:** People cloning your repo
- **Status:** Use your existing README.md, it's perfect

---

## Where to Store These Files

### In Your Local WaveScript Project:

```
wavescript/
├── docs/
│   ├── WAVESCRIPT-CONTEXT.md    (for Claude Projects)
│   ├── DEVELOPMENT.md            (for you during coding)
│   └── ARCHITECTURE.md           (for design reference)
├── src/
│   ├── main/
│   └── renderer/
├── README.md                      (your existing one, keep it)
└── package.json
```

**Why in `/docs` folder?**
- Keeps docs organized separately from code
- Easier to find
- When you push to GitHub, it goes with the repo
- GitHub automatically shows `/docs` as documentation

### Create the docs folder:

```bash
mkdir -p docs
cp WAVESCRIPT-CONTEXT.md docs/
cp DEVELOPMENT.md docs/
cp ARCHITECTURE.md docs/
```

---

## Using in Claude Projects

### Step 1: Create Claude Project
1. Go to Claude.ai → Projects (top left)
2. Create new project → name it "WaveScript"

### Step 2: Add Context
1. Click "Add context" → "Upload files"
2. Upload the 3 files from `/docs/`:
   - WAVESCRIPT-CONTEXT.md
   - DEVELOPMENT.md (optional, but helpful)
   - ARCHITECTURE.md (optional, but helpful)

**OR** copy-paste WAVESCRIPT-CONTEXT.md into the context field:

1. Click "Add context" → "Text"
2. Paste entire WAVESCRIPT-CONTEXT.md content
3. Save

### Step 3: Start Work
Now you can ask Claude:
- "How do I add a new language?"
- "What's the IPC pattern for this handler?"
- "Help me debug why transcription is hanging"
- "Walk me through the VAD integration"

Claude will reference your project context automatically.

---

## What Claude Has Now (From Context)

### Architecture Understanding
- ✅ Main/renderer process split
- ✅ IPC communication patterns
- ✅ Build system (build-sources.js)
- ✅ Settings persistence
- ✅ All 10 features and how they work

### Code Patterns
- ✅ How to add settings
- ✅ How to add languages
- ✅ How to add output formats
- ✅ How to add IPC handlers
- ✅ CSS theming system
- ✅ Error handling patterns

### Known Issues & Fixes
- ✅ Windows 11 blank-screen bug (and the solution)
- ✅ whisper.cpp timestamp reset bug
- ✅ Hallucination prevention (VAD)

### Testing & Quality
- ✅ What to test before committing
- ✅ Debugging strategies
- ✅ Performance considerations
- ✅ Security notes

---

## Example: Using the Context

**You ask Claude (in your project):**
```
I need to add support for French language.
What files do I need to change and what's the exact code pattern?
```

**Claude responds (referencing your project context):**
```
Based on your WaveScript architecture:

1. Add French strings to src/renderer/i18n/i18n.js:
   - Add 'fr' key to strings object with all translations

2. Add option to src/renderer/index.template.html:
   - Add <option value="fr">Français</option> to language select

3. Update src/renderer/ui/app.js to handle language change

Here's the exact pattern:
[... with code examples from your documented patterns ...]
```

Claude knows your exact file structure, naming conventions, and patterns—no guessing!

---

## What You Don't Have (Add to Context Later if Needed)

These aren't critical now, but you could add later:

- [ ] **Deployment guide** – How to build/release each platform
- [ ] **API key security** – How to handle DeepL key safely
- [ ] **Performance benchmarks** – Transcription speed per model
- [ ] **Troubleshooting guide** – Common user issues and fixes
- [ ] **Roadmap** – Next features (Vulkan, TypeScript, etc.)

For now, the 3 files cover 95% of what Claude needs to help you code.

---

## Final Recommendation

### For GitHub:

Create your repo structure like this:

```
wavescript/
├── docs/
│   ├── WAVESCRIPT-CONTEXT.md
│   ├── DEVELOPMENT.md
│   └── ARCHITECTURE.md
├── src/
├── README.md
├── package.json
└── .gitignore
```

Then in your GitHub README, add at the bottom:

```markdown
## Documentation

- **[WAVESCRIPT-CONTEXT.md](docs/WAVESCRIPT-CONTEXT.md)** – Technical overview and feature list
- **[DEVELOPMENT.md](docs/DEVELOPMENT.md)** – Development guide and common tasks
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** – System design and data flows
```

### For Claude Projects:

Use **WAVESCRIPT-CONTEXT.md** as your primary context file. Reference DEVELOPMENT.md and ARCHITECTURE.md when needed for deeper understanding.

---

**You're all set!** 🚀

Save these 3 files to `/docs` in your WaveScript project, then start your Claude Project with WAVESCRIPT-CONTEXT.md context. You're ready to continue development with AI assistance.

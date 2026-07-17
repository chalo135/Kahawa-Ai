# Kahawa Smart — Security Measures

This document describes every security measure in the project: what it is, where it
lives in the code, what it protects against, and — honestly — where its limits are.
Kahawa Smart is a final-year student project (vanilla JS frontend + FastAPI/Ollama
backend on modest hardware), so measures are scoped to that reality, not to a
production fintech stack. Each "Limitation" note says what a production version
would do differently.

---

## Frontend (Kahawa Smart)

### 1. Salted password hashing (SHA-256 + per-user salt)

- **Where:** `auth.js` — `hashPassword()`, `generateSalt()`, used by `registerUser()` and `loginUser()`
- **What it does:** Passwords are never stored. At signup, a random 16-byte salt is
  generated and `SHA-256(salt + password)` is computed with the browser's built-in
  Web Crypto API; only the salt and the hash are saved. At login, the same
  computation is repeated and compared.
- **What it protects against:** Anyone who opens DevTools or reads localStorage on
  a shared/stolen phone sees only hashes, not real passwords. The per-user salt
  means two users with the same password get different hashes, and an attacker
  can't use precomputed ("rainbow table") lookups.
- **Migration:** Accounts created before hashing existed are upgraded automatically:
  on their first successful login the plaintext is verified once, replaced with a
  salted hash, and deleted (`loginUser()`, legacy branch).
- **Limitation:** SHA-256 is a *fast* hash, so an attacker who copies the data can
  still brute-force weak passwords quickly. Production would hash server-side with
  a deliberately slow algorithm (bcrypt/argon2) — but there is no auth server in
  this project, and bcrypt in client-side JS would add a dependency without adding
  real security, since the attacker can see the client code either way.

### 2. Session expiry

- **Where:** `auth.js` — `SESSION_TTL_MS` (7 days), enforced in `getCurrentUser()`
- **What it does:** Every session is stamped with `expiresAt` at login. Any code
  that asks "who is logged in?" goes through `getCurrentUser()`, which deletes and
  rejects expired or malformed sessions. "Remember me" sessions live at most
  7 days; non-remembered sessions additionally die when the browser closes
  (sessionStorage).
- **What it protects against:** A login on a shared or borrowed phone no longer
  grants access forever.
- **Limitation:** The expiry is enforced by client-side JS, so a user editing
  their own localStorage can extend it. It protects against forgetfulness, not
  against a deliberate attacker (see Q&A below).

### 3. Route guarding

- **Where:** `auth.js` — `protectRoute()`, executed on every page load (bottom of file)
- **What it does:** Unauthenticated visitors to any app page are redirected to
  `login.html`; logged-in users are kept off the login/signup pages. Because
  expiry is checked inside `getCurrentUser()`, an expired session redirects too.
- **What it protects against:** Casual access to the app UI without an account.
- **Limitation:** Client-side only — the HTML/JS files themselves are still
  downloadable, and the API does not check the session. Adequate here because the
  account gates personalisation, not sensitive data; production would verify a
  session token on the server for every API call.

### 4. XSS protection — HTML-escaping all dynamic text

- **Where:** `app.js` — `escapeHTML()`, applied in `appendMessage()` (chat), the
  live-facts renderer in `loadLiveFacts()`, and `displayScanResult()` (labels,
  warnings)
- **What it does:** Every piece of text that did not come from our own literal
  code — user chat input, AI replies, backend scan labels/warnings, scraped
  Wikipedia facts — is escaped (`<` → `&lt;` etc.) before insertion via
  `innerHTML`. Fact source links are additionally only rendered if they point at
  `https://en.wikipedia.org/`, blocking `javascript:` URLs.
- **What it protects against:** Cross-site scripting. Before this, typing
  `<img src=x onerror=alert(1)>` into the advisor chat executed script; a
  compromised backend or facts feed could have injected HTML into every user's
  browser.
- **Limitation:** Escaping is applied at each insertion point rather than by a
  framework, so any *future* `innerHTML` use must remember to call
  `escapeHTML()`. A production app might add a Content-Security-Policy header as
  a second layer.

### 5. Client-side upload validation

- **Where:** `app.js` — `handleFile()`
- **What it does:** Checks `file.type` really starts with `image/` and the file
  is under 10 MB *before* preview or upload — actual property checks, not just
  the `accept` attribute on the input (which is only a file-picker hint).
- **What it protects against:** Accidental uploads of wrong/huge files, wasted
  mobile data (this matters for farmers on expensive data plans).
- **Limitation:** Client-side checks are convenience, not security — anyone can
  bypass them with curl. That's why the backend re-validates (see backend #3).

### 6. No secrets in frontend code

- **Where:** verified across `app.js`, `auth.js`, `login.js`, `signup.js`
- **What it does:** The frontend contains only the backend URL — no API keys or
  tokens. The AI (Ollama) is only reachable *through* our backend, so no
  provider key exists to leak.

---

## Backend (Kahawaai FastAPI)

### 1. CORS allowlist

- **Where:** `main.py` — `CORSMiddleware` config; origins in `config.py`
  (`ALLOWED_ORIGINS` in `.env`)
- **What it does:** Only browsers on explicitly listed origins (our own frontend,
  localhost dev ports by default) may call the API cross-origin. Previously this
  was `allow_origins=["*"]`.
- **What it protects against:** Any random website silently making our visitors'
  browsers call the Kahawa API (burning the server's limited LLM capacity, or
  riding on a user's network position).
- **Limitation:** CORS restrains *browsers*, not curl or scripts — it's one layer,
  with rate limiting as the next. When the frontend is deployed, its real URL
  must be added to `ALLOWED_ORIGINS`.

### 2. Request validation with Pydantic + size caps

- **Where:** `main.py` — `Message` / `ChatRequest` models with `Field` limits;
  role allowlist in `_recent_chat_messages()`
- **What it does:** `/chat` bodies must match a strict schema: role ≤ 20 chars,
  message content ≤ 4000 chars, at most 50 messages, scan context ≤ 1000 chars.
  Roles other than `user`/`assistant` are rejected with a 400 — so an attacker
  cannot inject their own `system` prompt through the API. Malformed bodies get
  an automatic 422 before our code even runs.
- **What it protects against:** Prompt-injection via the system role, and memory/
  compute exhaustion from megabyte-sized "messages" reaching a 3B model on
  limited RAM.
- **Limitation:** Content *within* a valid user message can still try prompt
  injection in natural language ("ignore your instructions…") — mitigated only by
  the system-prompt rules in `prompts.py`; that's an open problem for all LLM
  apps, not something this project can fully solve.

### 3. Upload hardening on `/predict`

- **Where:** `main.py` — `predict()`; decoding in `preprocess_image()`
- **What it does:** Three layers: (1) claimed content-type must be `image/*`,
  (2) the body is read to a hard 10 MB bound — `file.read(MAX_UPLOAD_BYTES + 1)`
  — so an oversized upload cannot fill RAM before being rejected, (3) the actual
  bytes are decoded by Pillow; anything that isn't a real image (e.g. an `.exe`
  renamed to `.jpg` with a faked header) returns a clean
  `400 "File is not a valid image"` instead of an unhandled 500. Decoding +
  re-encoding to a 224×224 RGB array also destroys any file structure a malicious
  image might carry.
- **What it protects against:** Memory exhaustion, disguised non-image payloads,
  and crash-based probing of the endpoint.
- **Limitation:** Pillow itself parses attacker-controlled bytes; keeping it
  updated (see `requirements.txt`) is part of the defence.

### 4. Rate limiting on `/chat` and `/predict`

- **Where:** `main.py` — `check_rate_limit()`; limits in `config.py` / `.env`
  (`CHAT_RATE_LIMIT_PER_MIN=10`, `PREDICT_RATE_LIMIT_PER_MIN=20`)
- **What it does:** A small in-memory sliding-window counter per client IP. Above
  the per-minute cap the API returns `429 "Too many requests. Please wait a
  minute and try again."` No external dependency.
- **What it protects against:** Both abuse and accidents. Every `/chat` call
  occupies the local 3B model; an unthrottled loop of requests would freeze the
  service (and possibly the machine) for everyone. This is as much a *stability*
  measure as a security one.
- **Limitation:** In-memory state resets on restart and counts per-IP (users
  behind one NAT share a bucket; an attacker with many IPs isn't stopped).
  Production would use a shared store (e.g. Redis) behind a reverse proxy —
  overkill at this scale.

### 5. Non-leaky error responses

- **Where:** `main.py` — `chat()` exception handler; `predict()` image try/except
- **What it does:** Internal failure details (e.g. "Cannot connect to Ollama at
  http://localhost:11434/api/chat") are logged on the server and replaced with a
  generic client message ("The AI advisor is temporarily unavailable…").
  FastAPI's default behaviour of never sending stack traces to clients covers
  the rest.
- **What it protects against:** Reconnaissance — error messages that reveal
  internal hostnames, ports, model names, or file paths hand an attacker a map
  of the system.
- **Limitation:** `print()`-based logging is minimal; production would use
  structured logs with rotation.

### 6. Secrets & configuration hygiene

- **Where:** `config.py` (all settings via `python-dotenv`), `.gitignore` line 5
- **What it does:** Every tunable — model paths, Ollama URL, CORS origins, rate
  limits — comes from environment variables with safe defaults. `.env` is
  gitignored so local configuration never reaches the repository. There are no
  passwords or API keys anywhere in the codebase (verified during the audit).
- **What it protects against:** Leaking credentials/infrastructure details
  through version control — the single most common way student projects leak
  secrets.
- **Limitation:** There are currently no true secrets to protect; if the project
  later adds an API key (e.g. a hosted LLM), it must follow the same `.env`
  pattern.

### 7. Sensitive-data logging check

- **Audit result:** The backend logs operational events only (model loaded,
  scraper runs, warm-up status, and — new — sanitized Ollama failure reasons).
  Chat messages and uploaded image bytes are **not** written to disk anywhere;
  images are processed in memory and discarded.

---

## Known limitations (deliberately out of scope)

Stated openly rather than hidden:

1. **Auth is entirely client-side.** There is no auth server; the API does not
   verify user identity. Fine while the account only gates UI personalisation.
2. **No HTTPS in local development.** Transport encryption is a deployment
   concern (any static host / reverse proxy provides it).
3. **No CSRF protection** — there are no cookie-based server sessions, so classic
   CSRF doesn't apply; the CORS allowlist covers the browser-origin angle.
4. **LLM prompt injection** is mitigated (role allowlist, length caps, system
   rules) but not solved — an open research problem.

---

## Likely questions from the marker

**Q1. Why SHA-256 and not bcrypt?**
bcrypt's advantage is being deliberately slow *on a server the attacker can't
inspect*. Here hashing runs in the browser with no server — a bcrypt JS library
would add a dependency while the attacker can read the client code anyway.
SHA-256 + salt via the built-in Web Crypto API gives the real wins available at
this architecture (no plaintext at rest, no rainbow tables) with zero
dependencies; the honest fix for the remaining gap is server-side auth, not a
different client-side hash.

**Q2. What stops someone editing localStorage to forge a session?**
Nothing — and I know that. The session controls UI access on the user's own
device; there is no server-side account data to steal, so forging a session
gains you an unpersonalised UI you could also get by reading the public JS.
Production would issue a signed, server-verified token (e.g. JWT) instead.

**Q3. How is the AI endpoint protected from abuse?**
Four layers: a CORS allowlist (browsers on foreign sites can't call it), Pydantic
schema + length caps (max 50 messages × 4000 chars), a role allowlist blocking
`system`-prompt injection, and per-IP rate limiting (10 chat calls/min) so a
request flood can't monopolise the local 3B model.

**Q4. Your upload check trusts the file extension, doesn't it?**
No — the extension is never consulted. The client checks the MIME type and size
before sending; the server then independently re-checks the declared type,
enforces the 10 MB bound *while reading*, and finally decodes the actual bytes
with Pillow — a renamed executable fails that decode and gets a 400. The
image is also re-encoded to a raw 224×224 pixel array, so nothing but pixel data
reaches the model.

**Q5. What's the single biggest remaining weakness?**
The absence of server-side identity: the API can't distinguish users, so auth
protects the UI, not the data path. It's the right trade-off for this stage —
the API handles no personal data — and the documented next step is moving
`registerUser`/`loginUser` behind FastAPI endpoints with bcrypt and signed
session tokens.

**Q6. How did you verify the fixes work?**
Scripted tests, not just reading code: a Node test harness runs the real
`auth.js` against mocked storage (16 assertions: hashing, salting, expiry,
legacy-account migration), and the live API was exercised with curl — allowed
vs. foreign CORS origins, a real leaf photo (correct prediction), a text file
disguised as a JPEG (clean 400), a `system`-role injection (400), an oversized
message (422), and 12 rapid chat calls (429 after the limit).

/* ============================================================
   Kahawa Smart — Main JavaScript
   Handles: navigation, chat, image upload, charts, facts
   Animations: GSAP + ScrollTrigger
============================================================ */

// ── BACKEND URL ───────────────────────────────────────────
// Dev (localhost/127.0.0.1): talk to the backend on the SAME hostname the page
//   is served from, on port 8000. (127.0.0.1 and localhost are different
//   "sites" to the browser, so mixing them drops the SameSite=Lax session
//   cookie -> permanent 401 login loop. Mirroring the hostname avoids that.)
// Production: default to SAME ORIGIN (empty prefix -> relative URLs such as
//   /api/chat). This matches the recommended VPS setup where nginx serves the
//   frontend AND proxies /api to uvicorn on one domain — no config, and no
//   placeholder URL to forget.
// Split hosting (API on a DIFFERENT domain)? Set window.__KAHAWA_BACKEND__ to
//   its https URL in an inline <script> before this file loads.
const _h = window.location.hostname;
const BACKEND_URL = (_h === 'localhost' || _h === '127.0.0.1' || _h === '')
  ? `http://${_h || 'localhost'}:8000`
  : (window.__KAHAWA_BACKEND__ || '');   // '' = same origin

const API_URL    = `${BACKEND_URL}/predict`;
const CHAT_URL   = `${BACKEND_URL}/api/chat`;   // RAG chat (grounded in the Knowledge base)
const HEALTH_URL = `${BACKEND_URL}/health`;

// ── GSAP SETUP ────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   NAVIGATION
============================================================ */
function navigateTo(pageId) {
  // Guard against undefined/null
  if (!pageId) {
    console.warn("navigateTo called with no pageId");
    return;
  }
  document.querySelector('.hamburger').addEventListener('click', () => {
  document.querySelector('.nav-links').classList.toggle('open');
});

document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(a.dataset.page);
  });
});

  const targetPage = document.getElementById(pageId);
  
  // Guard against missing element
  if (!targetPage) {
    console.error(`Page not found: #${pageId}`);
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Show target page
  targetPage.classList.add('active');
  
  // Update active nav link
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageId);
  });
  
  // Close mobile menu
  document.querySelector('.nav-links').classList.remove('open');
  
  // Scroll to top
  window.scrollTo(0, 0);
  
  // Animate in
  animatePageIn(pageId);
  
  // Page-specific init
  if (pageId === 'page-about') initCharts();
  if (pageId === 'page-facts') loadLiveFacts();
  
  // Hide FAB on scan page
  const fab = document.getElementById('advisor-fab-wrap');
  if (fab) fab.style.display = pageId === 'page-scan' ? 'none' : 'flex';
}
/* ============================================================
   PAGE ANIMATIONS
============================================================ */
function animatePageIn(pageId) {
  const page = document.getElementById(pageId);
  gsap.fromTo(page,
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }
  );
  if (pageId === 'page-home')  animateHome();
  if (pageId === 'page-scan')  animateScan();
  if (pageId === 'page-about') animateAbout();
  if (pageId === 'page-facts') animateFacts();
}

function animateHome() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.fromTo('.hero-title',
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.7 })
    .fromTo('.hero-description',
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
    .fromTo('.hero-actions',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5 }, '-=0.35')
    .fromTo('.hero-stat',
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.12 }, '-=0.3');

  gsap.fromTo('.steps-grid .card',
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out',
      scrollTrigger: { trigger: '.steps-grid', start: 'top 85%' }
    }
  );

  // Animate FAB in on home page
  gsap.fromTo('#advisor-fab-wrap',
    { opacity: 0, scale: 0.5, y: 20 },
    { opacity: 1, scale: 1, y: 0, duration: 0.6, delay: 1.2, ease: 'back.out(1.7)' }
  );
}

function animateScan() {
  gsap.fromTo('.dropzone',
    { opacity: 0, scale: 0.96 },
    { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }
  );
  gsap.fromTo('.tips-card',
    { opacity: 0, x: -20 },
    { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out', delay: 0.2 }
  );
  gsap.fromTo('.chat-window--tall',
    { opacity: 0, x: 20 },
    { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out', delay: 0.25 }
  );
}

function animateAbout() {
  gsap.fromTo('.stat-card',
    { opacity: 0, y: 30, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.4)',
      scrollTrigger: { trigger: '.stats-grid', start: 'top 85%' }
    }
  );
  gsap.fromTo('.chart-wrap',
    { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out',
      scrollTrigger: { trigger: '.charts-row', start: 'top 85%' }
    }
  );
  gsap.fromTo('.timeline-item',
    { opacity: 0, x: -30 },
    { opacity: 1, x: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out',
      scrollTrigger: { trigger: '.timeline', start: 'top 85%' }
    }
  );
  gsap.fromTo('.tech-card',
    { opacity: 0, x: 20 },
    { opacity: 1, x: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out',
      scrollTrigger: { trigger: '.tech-stack', start: 'top 85%' }
    }
  );
}

function animateFacts() {
  gsap.fromTo('.fact-card',
    { opacity: 0, y: 40, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out',
      scrollTrigger: { trigger: '.facts-grid', start: 'top 85%' }
    }
  );
  gsap.fromTo('.pull-quote',
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: '.pull-quote', start: 'top 90%' }
    }
  );
}

gsap.fromTo('.navbar',
  { opacity: 0, y: -20 },
  { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
);

/* ============================================================
   CHAT SYSTEM
============================================================ */
const chatHistory = [];

// Escape HTML special characters before any text goes into innerHTML.
// Prevents XSS: without this, typing <img src=x onerror=...> into the
// chat (or a malicious AI/backend reply containing HTML) would execute.
function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Convert the little markdown the model may still emit into safe HTML.
// We escape everything FIRST (so raw model output can never inject HTML),
// then re-introduce only the tags we control (<strong>, <br>).
function renderChatText(text) {
  let s = escapeHTML(text);
  s = s.replace(/^\s{0,3}#{1,6}\s*(.+?)\s*$/gm, '<strong>$1</strong>'); // ## heading -> bold line
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');              // **bold** -> <strong>
  s = s.replace(/^\s{0,3}[-*•]\s+/gm, '');                             // strip bullet markers, keep the text
  s = s.replace(/`+/g, '');                                            // drop stray backticks
  s = s.replace(/\n/g, '<br>');                                        // newlines -> line breaks
  return s;
}

// "2:34 PM" — time only, in the user's locale.
function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Smoothly keep the newest message in view.
function scrollToBottom(container) {
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

function appendMessage(container, role, text) {
  const isUser = role === 'user';
  const div    = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'ai'}`;
  // User text is shown verbatim (escaped); AI text runs through the
  // markdown-lite renderer so no raw ** or ## reaches the bubble.
  const body = isUser ? escapeHTML(text).replace(/\n/g, '<br>') : renderChatText(text);
  div.innerHTML = `
    <div class="msg-avatar" style="${isUser ? 'background:var(--bg-3);color:var(--text-secondary)' : 'background:var(--accent);color:#000'}">${isUser ? 'Me' : 'KS'}</div>
    <div class="msg-content">
      <div class="msg-bubble">${body}</div>
      <div class="msg-time">${formatTime()}</div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom(container);
  gsap.fromTo(div, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  return div;
}

function showTyping(container) {
  const div     = document.createElement('div');
  div.className = 'msg ai';
  div.id        = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar" style="background:var(--accent);color:#000;font-size:10px;font-weight:700">KS</div>
    <div class="msg-bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom(container);
  gsap.fromTo(div, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 });
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) gsap.to(el, { opacity: 0, duration: 0.2, onComplete: () => el.remove() });
}

// Friendly, in-style "you're offline" bubble for the advisor chat.
function appendOfflineNotice(container) {
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.innerHTML = `
    <div class="msg-avatar" style="background:var(--warning);color:#000;font-weight:700">!</div>
    <div class="msg-bubble msg-bubble--offline">📴 You're offline. Here is general saved advice — reconnect to the internet for a full, personalised answer.</div>
  `;
  container.appendChild(div);
  scrollToBottom(container);
  gsap.fromTo(div, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 });
}

// Shown (as a normal KS bubble) when we can't reach the AI right now.
const CONNECTION_ERROR_MSG = "Sorry, I'm having trouble connecting right now. Please check your internet and try again in a moment.";

// ── OFFLINE FALLBACK RESPONSES ────────────────────────────
const FALLBACK_RESPONSES = [
  "Leaf rust (Hemileia vastatrix) spreads fastest during warm, wet weather between 20–25°C. Spray a copper-based fungicide like Kocide 2000 at 2.5 g/L every 14 days during the rainy season. 🌿\n\n**Next step:** Check the underside of leaves for powdery orange spores — that confirms active infection.",
  "The best time to spray is early morning when leaves are dry. Avoid spraying in strong wind or before rain. Copper fungicide is most effective as a preventive — apply before you see heavy infection. ☕\n\n**Next step:** Keep a spray record noting date, product, and weather conditions.",
  "For organic control, neem oil extract (5 mL/L) applied every 10 days can slow rust spread. It works best on early-stage infections. Combine with removing and burning heavily infected leaves. 🌱\n\n**Next step:** Prune for air circulation — overcrowded canopy keeps leaves wet longer and speeds rust spread.",
  "Coffee leaf rust cannot spread to humans or animals — it only infects Coffea species. Your safety concern is about the fungicide. Always wear gloves and a face mask when mixing and spraying. 🛡️\n\n**Next step:** Store fungicide in a cool, locked place away from food and water sources.",
  "Mbolea ya nitrojeni nyingi sana inaweza kuongeza hatari ya kutu. Tumia mbolea iliyo na usawa mzuri wa NPK na pia kalsiamu. Kagua majani yako mara mbili kwa wiki wakati wa mvua. 🌿\n\n**Hatua inayofuata:** Wasiliana na afisa wa kilimo wa kaunti yako kwa ushauri wa mbolea inayofaa kwa eneo lako.",
];
let fallbackIndex = 0;

// Real connectivity check: actually ask the backend if it's alive, instead of
// trusting navigator.onLine (which only reflects the device's local network,
// not whether our FastAPI server is reachable). Used before showing any
// "offline" message.
async function isBackendReachable() {
  try {
    const res = await fetch(HEALTH_URL, { method: 'GET', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

async function askLlama(userMessage, messagesContainer, extraContext = '') {
  chatHistory.push({ role: 'user', content: userMessage });
  showTyping(messagesContainer);

  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send only recent history: the backend caps requests at 50 messages
      // (and only uses the last 8), so a long chat session must not grow
      // the payload forever.
      body: JSON.stringify({ messages: chatHistory.slice(-20), context: extraContext }),
    });
    if (!response.ok) throw new Error(`Backend error ${response.status}`);
    const data  = await response.json();
    removeTyping();

    // Backend reached us but the AI provider failed. Speak like part of the
    // conversation, not a system error. Not pushed to chatHistory.
    if (data.error) {
      appendMessage(messagesContainer, 'ai', CONNECTION_ERROR_MSG);
      return;
    }

    const reply = data.reply || 'Samahani, kuna tatizo. Please try again.';
    chatHistory.push({ role: 'assistant', content: reply });
    appendMessage(messagesContainer, 'ai', reply);
    return;
  } catch (err) {
    console.warn('Chat request failed:', err);
  }

  removeTyping();

  // Ping the backend to find out WHY the chat call failed, rather than
  // trusting navigator.onLine. If the server truly can't be reached, fall
  // back to saved general advice, clearly labelled as such.
  const backendUp = await isBackendReachable();
  if (!backendUp) {
    await new Promise(r => setTimeout(r, 400));
    appendOfflineNotice(messagesContainer);
    const reply = FALLBACK_RESPONSES[fallbackIndex % FALLBACK_RESPONSES.length];
    fallbackIndex++;
    chatHistory.push({ role: 'assistant', content: reply });
    appendMessage(messagesContainer, 'ai', reply);
    return;
  }

  // Backend is up but this chat call still failed: a friendly connection
  // message that reads like part of the conversation.
  appendMessage(messagesContainer, 'ai', CONNECTION_ERROR_MSG);
}

function setupChat(inputId, sendId, messagesId, extraContextFn = null) {
  const input    = document.getElementById(inputId);
  const send     = document.getElementById(sendId);
  const messages = document.getElementById(messagesId);
  const hint     = document.getElementById(inputId.replace('-input', '-hint'));

  // Lock the input while the advisor is replying so the farmer can't fire
  // several messages before the first is answered; unlock when done.
  function setBusy(busy) {
    input.disabled = busy;
    send.disabled  = busy;
    if (busy && hint) hint.hidden = true;
  }

  async function submit() {
    const text = input.value.trim();
    if (!text || input.disabled) return;
    input.value = '';
    input.style.height = 'auto';
    if (hint) hint.hidden = true;
    appendMessage(messages, 'user', text);
    setBusy(true);
    try {
      await askLlama(text, messages, extraContextFn ? extraContextFn() : '');
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  send.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    // Show "Press Enter to send" only while there's text to send.
    if (hint) hint.hidden = input.value.trim() === '';
  });
}

/* ── FLOATING ADVISOR BUTTON ─────────────────────────────── */
document.getElementById('advisor-fab').addEventListener('click', () => {
  gsap.to('#advisor-fab', { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1,
    onComplete: () => navigateTo('page-scan')
  });
});

/* ============================================================
   IMAGE UPLOAD & SCAN
============================================================ */
let selectedFile   = null;
let lastScanResult = null;

const dropzone   = document.getElementById('scan-dropzone');
const fileInput  = document.getElementById('scan-file-input');
const previewImg = document.getElementById('scan-preview');
const dropIcon   = document.getElementById('scan-drop-icon');
const scanBtn    = document.getElementById('scan-btn');
const clearBtn   = document.getElementById('scan-clear-btn');
const resultBox  = document.getElementById('scan-result');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});
dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
  gsap.to(dropzone, { scale: 1.02, duration: 0.2 });
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-over');
  gsap.to(dropzone, { scale: 1, duration: 0.2 });
});
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  gsap.to(dropzone, { scale: 1, duration: 0.2 });
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
const cameraInput = document.getElementById('scan-camera-input');
const cameraBtn    = document.getElementById('scan-camera-btn');
const galleryBtn   = document.getElementById('scan-gallery-btn');

// stopPropagation is important — these buttons sit inside dropzone,
// which already has its own click handler that opens fileInput
cameraBtn.addEventListener('click', e => {
  e.stopPropagation();
  cameraInput.click();
});
galleryBtn.addEventListener('click', e => {
  e.stopPropagation();
  fileInput.click();
});

cameraInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// Inline, plain-language upload error shown under the upload buttons —
// visible immediately and stays until the farmer picks a valid photo.
const uploadError = document.getElementById('scan-upload-error');
function showUploadError(message) {
  if (!uploadError) return;
  uploadError.querySelector('span').textContent = message;
  uploadError.classList.add('visible');
}
function clearUploadError() {
  if (uploadError) uploadError.classList.remove('visible');
}

function handleFile(file) {
  clearUploadError();
  if (!file.type.startsWith('image/')) {
    showUploadError('Please choose a photo file (JPG or PNG).');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showUploadError('That photo is too large — please use one under 10 MB.');
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    dropIcon.classList.add('hidden');
    previewImg.classList.remove('hidden');
    gsap.fromTo(previewImg,
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.5)' }
    );
    scanBtn.disabled  = false;
    clearBtn.disabled = false;
    resultBox.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

clearBtn.addEventListener('click', () => {
  selectedFile      = null;
  fileInput.value   = '';
  previewImg.src    = '';
  previewImg.classList.add('hidden');
  dropIcon.classList.remove('hidden');
  gsap.fromTo(dropIcon, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  scanBtn.disabled  = true;
  clearBtn.disabled = true;
  resultBox.classList.add('hidden');
  clearUploadError();
  lastScanResult    = null;
});

scanBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  scanBtn.disabled  = true;
  scanBtn.innerHTML = '<span class="spin" style="display:inline-block">◌</span> Analysing...';
  try {
    const formData = new FormData();
    formData.append('file', selectedFile);
    const response = await fetch(API_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`Server error ${response.status}`);
    const data = await response.json();
    displayScanResult(data.predictions, data.warning);
  } catch (err) {
    // Analysis failed. NEVER invent a diagnosis — a fake "rust detected" could
    // send a farmer spraying fungicide they don't need. Show an honest error
    // and let them retry. (Offline vs. server-error are worded differently.)
    console.warn('Leaf analysis failed:', err);
    if (!(await isBackendReachable())) {
      showOfflineScanNotice();
    } else {
      showScanErrorNotice();
    }
    return;
  } finally {
    scanBtn.disabled  = false;
    scanBtn.innerHTML = 'Analyse Leaf';
  }
});

// Friendly, in-style offline message shown in the result card when a farmer
// tries to analyse a leaf with no connection.
function showOfflineScanNotice() {
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `
    <div class="offline-note">
      <div class="offline-note__icon"><i data-lucide="wifi-off"></i></div>
      <strong>You need to be online to analyse a leaf</strong>
      <p>Leaf analysis runs on our server. Please connect to the internet and tap "Analyse Leaf" again. The rest of the app still works offline.</p>
    </div>`;
  if (window.lucide) lucide.createIcons();
  gsap.fromTo(resultBox, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
}

// Shown when the server is reachable but the analysis itself failed. We do
// NOT fabricate a result — an invented diagnosis is worse than no diagnosis.
function showScanErrorNotice() {
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `
    <div class="offline-note">
      <div class="offline-note__icon"><i data-lucide="alert-triangle"></i></div>
      <strong>We couldn't analyse that photo</strong>
      <p>Something went wrong on our side. Please wait a moment and tap "Analyse Leaf" again. If it keeps failing, try a clearer, well-lit photo of a single leaf.</p>
    </div>`;
  if (window.lucide) lucide.createIcons();
  gsap.fromTo(resultBox, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
}

/* ============================================================
   DISEASE REFERENCE (rendered from window.DISEASES — see js/data/diseases.js)
   Two views from one object: a collapsed disclosure under a scan result,
   and the full guide on the Coffee Facts page.
============================================================ */
function rustData() {
  return (window.DISEASES && window.DISEASES.coffee_leaf_rust) || null;
}

// (a) Collapsed "What rust looks like" disclosure for the scan result.
//     Button toggle with aria-expanded/aria-controls; animation is pure CSS
//     (grid-rows), so there is no GSAP timeline to leak across route changes.
function renderScanSymptoms() {
  const d = rustData();
  if (!d) return '';
  const items = d.symptoms.slice(0, 4)
    .map(s => `<li>${escapeHTML(s)}</li>`)
    .join('');
  return `
    <section class="symptom-disclosure" id="scan-symptoms">
      <button type="button" class="symptom-disclosure__toggle" id="scan-symptoms-toggle"
              aria-expanded="false" aria-controls="scan-symptoms-body">
        <span>What rust looks like</span>
        <svg class="symptom-disclosure__chevron" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
             stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="symptom-disclosure__body" id="scan-symptoms-body" role="region"
           aria-labelledby="scan-symptoms-toggle">
        <div class="symptom-disclosure__inner">
          <ul class="symptom-list">${items}</ul>
        </div>
      </div>
    </section>`;
}

function wireScanSymptomsToggle() {
  const btn  = document.getElementById('scan-symptoms-toggle');
  const sect = document.getElementById('scan-symptoms');
  if (!btn || !sect) return;
  btn.addEventListener('click', () => {
    const open = sect.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// (b) Full guide for the Coffee Facts (learn) page.
function renderDiseaseGuide() {
  const host = document.getElementById('disease-guide');
  const d = rustData();
  if (!host || !d) return;
  const list = (arr, extra = '') =>
    `<ul class="symptom-list${extra}">${arr.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ul>`;
  host.innerHTML = `
    <article class="card disease-guide">
      <header class="disease-guide__head">
        <h2 class="disease-guide__name">${escapeHTML(d.name)}</h2>
        <p class="disease-guide__meta"><em>${escapeHTML(d.scientificName)}</em> · ${escapeHTML(d.localName)}</p>
      </header>
      <h3 class="disease-guide__subhead">Symptoms</h3>
      ${list(d.symptoms)}
      <h3 class="disease-guide__subhead">When rust spreads fastest</h3>
      ${list(d.favourableConditions)}
      <h3 class="disease-guide__subhead">What it is NOT (look-alikes)</h3>
      ${list(d.lookalikes, ' symptom-list--muted')}
    </article>`;
}

function displayScanResult(predictions, warning = null) {
  resultBox.classList.remove('hidden');
  const top        = predictions[0];
  const isRust     = top.label.toLowerCase().includes('rust');
  const isHealthy  = top.label.toLowerCase().includes('healthy');
  const confidence = (top.confidence * 100).toFixed(1);
  const cleanLabel = top.label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  lastScanResult   = `Leaf scan result: ${cleanLabel} detected with ${confidence}% confidence.`;

  resultBox.innerHTML = `
    <div class="result-header">
      <div class="result-emoji">${isRust ? '⚠️' : isHealthy ? '✅' : '🔍'}</div>
      <div>
        <div class="badge ${isRust ? 'badge-red' : 'badge-green'}" style="margin-bottom:0.4rem">
          ${isRust ? 'Disease Detected' : isHealthy ? 'Healthy Leaf' : 'Analysis Complete'}
        </div>
        <div class="result-label">${escapeHTML(cleanLabel)}</div>
      </div>
    </div>
    ${predictions.map((p, i) => {
      const pct = (p.confidence * 100).toFixed(1);
      const lbl = p.label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const isR = p.label.toLowerCase().includes('rust');
      return `
        <div style="margin-bottom:0.75rem">
          <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:0.3rem">
            <span style="color:${i===0?'var(--text-primary)':'var(--text-secondary)'};font-weight:${i===0?600:400}">#${i+1} ${escapeHTML(lbl)}</span>
            <span style="color:${i===0?(isR?'var(--danger)':'var(--accent)'):'var(--text-muted)'};font-weight:600">${pct}%</span>
          </div>
          <div class="result-bar-track">
            <div class="result-bar ${isR?'rust':'healthy'}" id="bar-${i}"></div>
          </div>
        </div>`;
    }).join('')}
    ${isRust ? `
      <div style="margin-top:1.25rem;padding:1rem;background:rgba(224,92,92,0.08);border:1px solid rgba(224,92,92,0.2);border-radius:10px;font-size:0.875rem">
        <strong style="color:var(--danger)">⚠️ Immediate action recommended</strong>
        <p style="margin-top:0.4rem;color:var(--text-secondary)">Leaf rust can spread rapidly. Apply copper-based fungicide within 48 hours and remove heavily infected leaves.</p>
      </div>` : `
      <div style="margin-top:1.25rem;padding:1rem;background:var(--accent-dim);border:1px solid rgba(74,163,84,0.2);border-radius:10px;font-size:0.875rem">
        <strong style="color:var(--accent)">✅ Your coffee leaf looks healthy!</strong>
        <p style="margin-top:0.4rem;color:var(--text-secondary)">Continue regular monitoring and preventive care.</p>
      </div>`}
    ${warning ? `
      <div style="margin-top:0.75rem;padding:1rem;background:rgba(200,169,110,0.1);border:1px solid rgba(200,169,110,0.35);border-radius:10px;font-size:0.875rem">
        <strong style="color:var(--accent2)">🔎 Model limitation notice</strong>
        <p style="margin-top:0.4rem;color:var(--text-secondary)">${escapeHTML(warning)}</p>
      </div>` : ''}
    ${renderScanSymptoms()}
  `;

  // Wire the collapsible disclosure just added to the result box.
  wireScanSymptomsToggle();

  gsap.fromTo(resultBox,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.4)' }
  );

  setTimeout(() => {
    predictions.forEach((p, i) => {
      const bar = document.getElementById(`bar-${i}`);
      if (bar) gsap.fromTo(bar,
        { width: '0%' },
        { width: (p.confidence * 100).toFixed(1) + '%', duration: 1.2, delay: i * 0.15, ease: 'power2.out' }
      );
    });
  }, 100);

  const chatMsg = isRust
    ? 'This leaf shows signs of coffee leaf rust. I recommend immediate treatment. What would you like to know?'
    : warning
      ? 'The leaf does not match rust patterns, but confidence is low. It may have a different disease such as Cercospora leaf spot or Coffee Berry Disease. I recommend consulting an agronomist. What would you like to know?'
      : 'Great news — your leaf appears healthy! Would you like tips on preventing leaf rust?';

  appendMessage(
    document.getElementById('scan-chat-messages'), 'ai',
    `I have analysed your leaf image. 🌿\n\n**Result: ${cleanLabel}** (${confidence}% confidence)\n\n${chatMsg}`
  );
}

// Pass the scan result string as chat context, or '' when no scan has been
// done yet. Empty is important: the backend treats any non-empty context as
// "a scan is available", so a placeholder like "No scan performed yet." would
// wrongly flip the advisor into scan mode.
setupChat('scan-chat-input', 'scan-chat-send', 'scan-chat-messages',
  () => lastScanResult || ''
);

/* ============================================================
   LIVE FACTS
============================================================ */
async function loadLiveFacts() {
  const section  = document.getElementById('live-facts-section');
  const grid     = document.getElementById('live-facts-grid');
  const loading  = document.getElementById('live-facts-loading');
  const timestamp = document.getElementById('live-facts-timestamp');

  try {
    const response = await fetch(`${BACKEND_URL}/facts`);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();

    grid.innerHTML = '';
    data.facts.forEach(fact => {
      const card = document.createElement('div');
      card.className = 'fact-card';
      // Escape all server-provided text, and only link out to Wikipedia —
      // a compromised/altered facts feed can't inject HTML or javascript: URLs.
      const safeUrl = String(fact.source_url || '').startsWith('https://en.wikipedia.org/')
        ? fact.source_url : '#';
      card.innerHTML = `
        <div class="fact-icon"><i data-lucide="globe"></i></div>
        <div class="fact-title">${escapeHTML(fact.title)}</div>
        <div class="fact-text">${escapeHTML(fact.text)}</div>
        <a class="fact-source" href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener">
          Source: Wikipedia — ${escapeHTML(fact.source)}
        </a>
      `;
      grid.appendChild(card);
    });

    const updated = new Date(data.last_updated);
    const hoursAgo = Math.round((Date.now() - updated.getTime()) / 36e5);
    timestamp.textContent = hoursAgo < 1 ? 'Updated just now' : `Updated ${hoursAgo}h ago`;

    loading.classList.add('hidden');
    section.classList.remove('hidden');

    if (window.lucide) lucide.createIcons();

    gsap.fromTo('#live-facts-grid .fact-card',
      { opacity: 0, y: 30, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.07, ease: 'power2.out' }
    );
  } catch (err) {
    console.warn('Live facts unavailable — showing static facts only:', err);
    loading.classList.add('hidden');
  }
}

/* ============================================================
   CHARTS
============================================================ */
let chartsInitialized = false;

function initCharts() {
  if (chartsInitialized) return;
  chartsInitialized = true;

  const ctx1 = document.getElementById('chart-crop-loss');
  if (ctx1) {
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: ['Kenya','Ethiopia','Uganda','Tanzania','Rwanda','Burundi'],
        datasets: [{ label: 'Crop loss (%)', data: [42,38,55,31,47,60],
          backgroundColor: 'rgba(224,92,92,0.7)', borderColor: '#e05c5c',
          borderWidth: 1, borderRadius: 6 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend:  { labels: { color: '#8fa890', font: { family: 'DM Sans' } } },
          tooltip: { backgroundColor: '#161e17', titleColor: '#eef2ee', bodyColor: '#8fa890' }
        },
        scales: {
          y: { ticks: { color: '#8fa890', callback: v => v + '%' }, grid: { color: 'rgba(74,163,84,0.08)' }, border: { color: 'transparent' } },
          x: { ticks: { color: '#8fa890' }, grid: { display: false }, border: { color: 'transparent' } }
        }
      }
    });
  }

  const ctx2 = document.getElementById('chart-season');
  if (ctx2) {
    new Chart(ctx2, {
      type: 'line',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        datasets: [
          { label: 'Infection risk', data: [3,4,7,9,8,6,4,3,5,8,9,5],
            borderColor: '#e05c5c', backgroundColor: 'rgba(224,92,92,0.1)',
            tension: 0.4, fill: true, pointBackgroundColor: '#e05c5c', pointRadius: 4 },
          { label: 'Rainfall index', data: [2,2,5,8,7,4,2,2,4,7,8,4],
            borderColor: '#4aa354', backgroundColor: 'rgba(74,163,84,0.05)',
            tension: 0.4, fill: true, pointBackgroundColor: '#4aa354', pointRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend:  { labels: { color: '#8fa890', font: { family: 'DM Sans' } } },
          tooltip: { backgroundColor: '#161e17', titleColor: '#eef2ee', bodyColor: '#8fa890' }
        },
        scales: {
          y: { ticks: { color: '#8fa890' }, grid: { color: 'rgba(74,163,84,0.08)' }, border: { color: 'transparent' } },
          x: { ticks: { color: '#8fa890' }, grid: { display: false }, border: { color: 'transparent' } }
        }
      }
    });
  }

  const ctx3 = document.getElementById('chart-treatment');
  if (ctx3) {
    new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: ['Copper fungicide','Triazole fungicide','Organic (neem)','No treatment'],
        datasets: [{ data: [45,35,12,8],
          backgroundColor: ['#4aa354','#c8a96e','#5bb8c4','#e05c5c'],
          borderColor: '#192019', borderWidth: 3, hoverOffset: 6 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend:  { position: 'bottom', labels: { color: '#8fa890', font: { family: 'DM Sans' }, padding: 16 } },
          tooltip: { backgroundColor: '#161e17', titleColor: '#eef2ee', bodyColor: '#8fa890' }
        },
        cutout: '65%'
      }
    });
  }
}

/* ============================================================
   TOAST
============================================================ */
function showToast(message, duration = 3000) {
  const toast       = document.createElement('div');
  toast.className   = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  gsap.fromTo(toast, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.5)' });
  setTimeout(() => {
    gsap.to(toast, { opacity: 0, y: 10, duration: 0.3, onComplete: () => toast.remove() });
  }, duration);
}

/* ============================================================
   SPIN STYLE
============================================================ */
const spinStyle = document.createElement('style');
spinStyle.textContent = `
  .spin { display:inline-block; animation:spin 0.7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .result-header { display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem; }
  .result-emoji  { font-size:2.5rem; }
`;
document.head.appendChild(spinStyle);

/* ============================================================
   USER SESSION MANAGEMENT (Safe Version)
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Ask the server who is signed in (getCurrentUser is async now:
        //    it validates the session via GET /api/me).
        if (typeof getCurrentUser === 'function') {
            const user = await getCurrentUser();

            if (user) {
                const nameEl = document.getElementById('nav-user-name');
                const emailEl = document.getElementById('nav-user-email');
                const avatarEl = document.getElementById('nav-user-avatar');

                // Fallback to "User" if name is missing in storage
                const displayName = user.name ? user.name.split(' ')[0] : 'User';
                const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

                if (nameEl) nameEl.textContent = displayName;
                if (emailEl) emailEl.textContent = user.email || 'No email';
                if (avatarEl) avatarEl.textContent = initial;
            }
        }

        // 2. Safely handle dropdown toggling
        const userMenuBtn = document.getElementById('user-menu-btn');
        const userDropdown = document.getElementById('user-dropdown');
        
        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = userDropdown.classList.contains('show');
                
                if (isOpen) {
                    gsap.to(userDropdown, { opacity: 0, y: 10, duration: 0.2, onComplete: () => userDropdown.classList.remove('show') });
                } else {
                    userDropdown.classList.add('show');
                    gsap.fromTo(userDropdown, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' });
                }
            });

            document.addEventListener('click', (e) => {
                if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                    if (userDropdown.classList.contains('show')) {
                        gsap.to(userDropdown, { opacity: 0, y: 10, duration: 0.2, onComplete: () => userDropdown.classList.remove('show') });
                    }
                }
            });
        }

        // 3. Safely handle logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn && typeof logoutUser === 'function') {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                logoutUser();
            });
        }
    } catch (error) {
        console.error("Navbar Auth Error (Ignored):", error);
    }
});

/* ============================================================
   THEME TOGGLE
============================================================ 
const themeBtn = document.getElementById('theme-toggle');

if (themeBtn) {
  // Restore saved preference immediately on load
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light');
    themeBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('light');
    themeBtn.textContent = '🌙';
  }

  themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');

    // Update icon
    themeBtn.textContent = isLight ? '☀️' : '🌙';

    // Save preference
    localStorage.setItem('theme', isLight ? 'light' : 'dark');

    // Spin + scale animation
    gsap.fromTo(themeBtn,
      { scale: 0.7, rotate: -30 },
      { scale: 1, rotate: 0, duration: 0.4, ease: 'back.out(1.7)' }
    );
  });
} else {
  console.warn('Theme toggle button #theme-toggle not found in HTML.');
}
*/
/* ============================================================
   INIT — always last
============================================================ */
renderDiseaseGuide();   // populate the disease guide on the Coffee Facts page
navigateTo('page-home');
lucide.createIcons();

/* ============================================================
   PWA — service worker, install prompt, offline awareness
   Keeps the app installable and usable on weak/no signal.
============================================================ */
(function initPWA() {
  // 1) Register the service worker after load, with error handling.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .catch(err => console.warn('Service worker registration failed:', err));
    });
  }

  // 2) Show a slim offline bar whenever the backend can't be reached.
  //    We confirm with a real health ping instead of navigator.onLine, which
  //    only knows about the local network, not whether our server is up.
  const offlineBar = document.getElementById('offline-bar');
  async function syncOnlineStatus() {
    if (offlineBar) offlineBar.hidden = await isBackendReachable();
  }
  window.addEventListener('online', syncOnlineStatus);
  window.addEventListener('offline', syncOnlineStatus);
  syncOnlineStatus();

  // 3) Custom "Install Kahawa Smart" banner (instead of the raw browser bar).
  const banner    = document.getElementById('install-banner');
  const acceptBtn = document.getElementById('install-accept');
  const dismissBtn = document.getElementById('install-dismiss');
  const DISMISS_KEY = 'kahawa_install_dismissed';
  let deferredPrompt = null;

  const alreadyInstalled = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function showBanner() {
    if (!banner) return;
    banner.hidden = false;
    gsap.fromTo(banner, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
  }
  function hideBanner() {
    if (!banner) return;
    gsap.to(banner, { opacity: 0, y: 20, duration: 0.25,
      onComplete: () => { banner.hidden = true; } });
  }

  // Chrome/Android fires this instead of showing its own prompt when we
  // preventDefault(). We stash it and reveal our own banner on our terms.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    if (alreadyInstalled() || localStorage.getItem(DISMISS_KEY)) return;
    deferredPrompt = e;
    showBanner();
  });

  if (acceptBtn) acceptBtn.addEventListener('click', async () => {
    hideBanner();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;   // { outcome: 'accepted' | 'dismissed' }
    deferredPrompt = null;
  });

  if (dismissBtn) dismissBtn.addEventListener('click', () => {
    localStorage.setItem(DISMISS_KEY, '1');  // remember so we don't nag again
    hideBanner();
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(DISMISS_KEY, '1');
    hideBanner();
  });
})();
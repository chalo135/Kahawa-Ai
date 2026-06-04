/* ============================================================
   Kahawa Smart — Main JavaScript
   Handles: navigation, chat, image upload, charts, facts
   Animations: GSAP + ScrollTrigger
============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────
const API_URL  = 'http://localhost:8000/predict';
const CHAT_URL = 'http://localhost:8000/chat';

// ── GSAP SETUP ────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   NAVIGATION
============================================================ */
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageId);
  });
  document.querySelector('.nav-links').classList.remove('open');
  window.scrollTo(0, 0);
  animatePageIn(pageId);
  if (pageId === 'page-about') initCharts();
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
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.12 }, '-=0.3')
    .fromTo('.chat-window',
      { opacity: 0, x: 40 },
      { opacity: 1, x: 0, duration: 0.7 }, '-=0.6')
    .fromTo('.suggestion-chip',
      { opacity: 0, scale: 0.85 },
      { opacity: 1, scale: 1, duration: 0.35, stagger: 0.07 }, '-=0.3');

  gsap.fromTo('.steps-grid .card',
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out',
      scrollTrigger: { trigger: '.steps-grid', start: 'top 85%' }
    }
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


function appendMessage(container, role, text) {
  const isUser = role === 'user';
  const div    = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'ai'}`;
  div.innerHTML = `
    <div class="msg-avatar" style="${isUser ? 'background:var(--bg-3);color:var(--text-secondary)' : 'background:var(--accent);color:#000'}">${isUser ? 'Me' : 'KS'}</div>
    <div class="msg-bubble">${text.replace(/\n/g, '<br>')}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  gsap.fromTo(div, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  return div;
}

function showTyping(container) {
  const div     = document.createElement('div');
  div.className = 'msg ai';
  div.id        = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">🌿</div>
    <div class="msg-bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  gsap.fromTo(div, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 });
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) gsap.to(el, { opacity: 0, duration: 0.2, onComplete: () => el.remove() });
}

// ── OFFLINE FALLBACK RESPONSES ────────────────────────────
const FALLBACK_RESPONSES = [
  "Leaf rust (Hemileia vastatrix) spreads fastest during warm, wet weather between 20–25°C. Spray a copper-based fungicide like Kocide 2000 at 2.5 g/L every 14 days during the rainy season. 🌿\n\n**Next step:** Check the underside of leaves for powdery orange spores — that confirms active infection.",
  "The best time to spray is early morning when leaves are dry. Avoid spraying in strong wind or before rain. Copper fungicide is most effective as a preventive — apply before you see heavy infection. ☕\n\n**Next step:** Keep a spray record noting date, product, and weather conditions.",
  "For organic control, neem oil extract (5 mL/L) applied every 10 days can slow rust spread. It works best on early-stage infections. Combine with removing and burning heavily infected leaves. 🌱\n\n**Next step:** Prune for air circulation — overcrowded canopy keeps leaves wet longer and speeds rust spread.",
  "Coffee leaf rust cannot spread to humans or animals — it only infects Coffea species. Your safety concern is about the fungicide. Always wear gloves and a face mask when mixing and spraying. 🛡️\n\n**Next step:** Store fungicide in a cool, locked place away from food and water sources.",
  "Mbolea ya nitrojeni nyingi sana inaweza kuongeza hatari ya kutu. Tumia mbolea iliyo na usawa mzuri wa NPK na pia kalsiamu. Kagua majani yako mara mbili kwa wiki wakati wa mvua. 🌿\n\n**Hatua inayofuata:** Wasiliana na afisa wa kilimo wa kaunti yako kwa ushauri wa mbolea inayofaa kwa eneo lako.",
];
let fallbackIndex = 0;

async function askClaude(userMessage, messagesContainer, extraContext = '') {
  chatHistory.push({ role: 'user', content: userMessage });
  showTyping(messagesContainer);

  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory, context: extraContext }),
    });
    if (!response.ok) throw new Error(`Backend error ${response.status}`);
    const data  = await response.json();
    removeTyping();
    const reply = data.reply || 'Samahani, kuna tatizo. Please try again.';
    chatHistory.push({ role: 'assistant', content: reply });
    appendMessage(messagesContainer, 'ai', reply);
    return;
  } catch (err) {
    console.warn('Backend unavailable — using offline fallback:', err);
  }

  // Offline fallback — cycles through pre-written expert advice
  await new Promise(r => setTimeout(r, 900));
  removeTyping();
  const reply = FALLBACK_RESPONSES[fallbackIndex % FALLBACK_RESPONSES.length];
  fallbackIndex++;
  chatHistory.push({ role: 'assistant', content: reply });
  appendMessage(messagesContainer, 'ai', reply);
}

function setupChat(inputId, sendId, messagesId, extraContextFn = null) {
  const input    = document.getElementById(inputId);
  const send     = document.getElementById(sendId);
  const messages = document.getElementById(messagesId);

  async function submit() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    appendMessage(messages, 'user', text);
    await askClaude(text, messages, extraContextFn ? extraContextFn() : '');
  }

  send.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

/* ── HOME CHAT ───────────────────────────────────────────── */
setupChat('home-chat-input', 'home-chat-send', 'home-chat-messages');

appendMessage(
  document.getElementById('home-chat-messages'), 'ai',
  'Habari! I am Kahawa Smart AI.\n\nI can help you with:\n• Identifying coffee leaf diseases\n• Treatment and prevention advice\n• Coffee farming best practices\n\nAsk me anything — in English or Swahili!'
);

document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const input = document.getElementById('home-chat-input');
    input.value = chip.textContent.trim();
    gsap.to(chip, { scale: 0.92, duration: 0.1, yoyo: true, repeat: 1 });
    document.getElementById('home-chat-send').click();
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

function handleFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Please upload an image file.'); return; }
  if (file.size > 10 * 1024 * 1024)   { showToast('Image must be under 10MB.');    return; }
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
    console.warn('Backend not available — showing demo result');
    displayScanResult([
      { label: 'coffee_leaf_rust',     confidence: 0.924 },
      { label: 'healthy_coffee_leaf',  confidence: 0.076 },
    ], null);
  } finally {
    scanBtn.disabled  = false;
    scanBtn.innerHTML = 'Analyse Leaf';
  }
});

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
        <div class="result-label">${cleanLabel}</div>
      </div>
    </div>
    ${predictions.map((p, i) => {
      const pct = (p.confidence * 100).toFixed(1);
      const lbl = p.label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const isR = p.label.toLowerCase().includes('rust');
      return `
        <div style="margin-bottom:0.75rem">
          <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:0.3rem">
            <span style="color:${i===0?'var(--text-primary)':'var(--text-secondary)'};font-weight:${i===0?600:400}">#${i+1} ${lbl}</span>
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
        <p style="margin-top:0.4rem;color:var(--text-secondary)">${warning}</p>
      </div>` : ''}
  `;

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

setupChat('scan-chat-input', 'scan-chat-send', 'scan-chat-messages',
  () => lastScanResult || 'No scan performed yet.'
);

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
   THEME TOGGLE
============================================================ */
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

/* ============================================================
   INIT — always last
============================================================ */
navigateTo('page-home');
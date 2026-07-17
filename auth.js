/* ============================================================
   Kahawa Smart — Authentication client

   Auth is now handled by the FastAPI backend, not the browser:
     - passwords are hashed server-side with bcrypt
     - users live in SQLite (parameterized queries)
     - the session is a signed JWT in an httpOnly cookie, which this
       script cannot read — that is deliberate, it means an XSS bug
       cannot steal the session

   Nothing about the user is trusted from localStorage any more. Every
   check asks the server via GET /api/me.

   Function names are unchanged (registerUser / loginUser / logoutUser /
   getCurrentUser / protectRoute / userExists / updateUserPassword) so the
   existing pages keep working — but they are now async and hit the API.
============================================================ */

// Same origin-detection the app uses elsewhere: localhost in dev, the
// deployed backend in production.
// Same rule as app.js: dev mirrors the page hostname on :8000 (so the
// SameSite=Lax session cookie is not dropped as cross-site); production
// defaults to SAME ORIGIN (relative /api/... via the nginx proxy), with an
// optional window.__KAHAWA_BACKEND__ override for split hosting.
const AUTH_BACKEND_URL = (() => {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') {
        return `http://${h || 'localhost'}:8000`;
    }
    return window.__KAHAWA_BACKEND__ || '';   // '' = same origin
})();

/**
 * Wrapper around fetch that always sends the session cookie and returns
 * { ok, status, data }.
 */
async function apiFetch(path, options = {}) {
    const res = await fetch(`${AUTH_BACKEND_URL}${path}`, {
        credentials: 'include',          // send/receive the session cookie
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
}

/**
 * Registers a new user via the backend.
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function registerUser(name, email, password) {
    const { ok, data } = await apiFetch('/api/signup', {
        method: 'POST',
        body: JSON.stringify({ username: email, password, name }),
    });
    if (ok) return { success: true };
    return { success: false, message: (data && data.detail) || 'Could not create your account. Please try again.' };
}

/**
 * Logs in via the backend. "Remember me" is passed to the server, which
 * decides the real session lifetime (30 min vs 30 days) — the browser
 * cannot extend it.
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function loginUser(email, password, rememberMe) {
    const { ok, data } = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: email, password, remember: !!rememberMe }),
    });
    if (ok) return { success: true };
    return { success: false, message: (data && data.detail) || 'Invalid email or password.' };
}

/**
 * Ends the session server-side (clears the httpOnly cookie).
 */
async function logoutUser() {
    try {
        await apiFetch('/api/logout', { method: 'POST' });
    } catch (err) {
        console.warn('Logout request failed:', err);
    }
    window.location.href = 'login.html';
}

/**
 * Asks the server who is signed in. Returns null when the session is
 * missing, expired, or invalid — the server decides, not us.
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser() {
    try {
        const { ok, data } = await apiFetch('/api/me', { method: 'GET' });
        if (!ok || !data) return null;
        // Shape kept compatible with the existing navbar code.
        return { name: data.name || data.username, email: data.username, username: data.username };
    } catch (err) {
        console.warn('Session check failed:', err);
        return null;
    }
}

/**
 * True if an account exists for this email. Used by the reset flow.
 * (The server is the source of truth; a wrong answer here only affects
 * the message shown, never access.)
 */
async function userExists(email) {
    const { ok } = await apiFetch('/api/reset-password/check?username=' + encodeURIComponent(email), { method: 'GET' });
    return ok;
}

/**
 * Sets a new password for an existing account, server-side.
 */
async function updateUserPassword(email, newPassword) {
    const { ok, data } = await apiFetch('/api/reset-password', {
        method: 'POST',
        body: JSON.stringify({ username: email, new_password: newPassword }),
    });
    if (ok) return { success: true };
    return { success: false, message: (data && data.detail) || 'Could not update your password.' };
}

/**
 * Route guard. Asks the server whether the session is valid and redirects
 * accordingly. Async, so pages briefly render before redirecting — the
 * <body> stays hidden until the check resolves (see the CSS class below).
 */
async function protectRoute() {
    const path = window.location.pathname;
    const isAuthPage = path.endsWith('login.html') || path.endsWith('signup.html');
    const user = await getCurrentUser();

    if (!user && !isAuthPage) {
        window.location.replace('login.html');
        return;
    }
    if (user && isAuthPage) {
        window.location.replace('index.html');
        return;
    }
    document.documentElement.classList.add('auth-checked');
}

// Run the guard as soon as the script loads.
protectRoute();

/* ============================================================
   Kahawa Smart — Forgot / Reset Password flow

   Drives the reset screens inside login.html (no separate HTML
   page). It reuses the existing pieces rather than replacing any:
     - auth.js  : userExists(), updateUserPassword(), same hashing
     - form-errors.js : FieldError for plain-language messages
     - the same password rules as signup.js (matched exactly below)

   The password reset itself lives in auth.js (updateUserPassword),
   where the "what production would do differently" note also lives.
   This file is only the on-screen flow.
============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Same password rule signup.js enforces — kept identical on purpose.
    const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // The email being reset, remembered across the reset screens.
    let resetEmail = null;

    // ── Screen switching (one card visible at a time, SPA-style) ──
    function showScreen(id) {
        document.querySelectorAll('.auth-page > .auth-card')
            .forEach(card => { card.hidden = (card.id !== id); });
        const card = document.getElementById(id);
        if (window.gsap && card) {
            gsap.fromTo(card, { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
        }
        if (window.lucide) lucide.createIcons();
    }

    const backToLogin = () => showScreen('login-card');

    // ── Entry point: "Forgot Password?" on the login form ──
    const forgotLink = document.getElementById('forgot-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('reset-request-card');
        });
    }

    // Back links on each reset screen
    ['reset-back-1', 'reset-back-2', 'reset-back-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { e.preventDefault(); backToLogin(); });
    });

    // ── Step 1: check the email exists ──
    const requestForm = document.getElementById('reset-request-form');
    const emailInput = document.getElementById('reset-email');
    if (emailInput) FieldError.clearOnInput(emailInput);

    if (requestForm) {
        requestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            FieldError.clear(emailInput);
            const email = emailInput.value.trim();

            if (!email) {
                FieldError.show(emailInput, 'Please enter your email address.');
                return;
            }
            if (!EMAIL_RE.test(email)) {
                FieldError.show(emailInput, 'Please enter a valid email address, like name@example.com');
                return;
            }
            // Ask the server whether this account exists (must be awaited).
            if (!(await userExists(email))) {
                FieldError.show(emailInput, "We don't have an account for that email. Please check the spelling or sign up instead.");
                return;
            }

            resetEmail = email;
            showScreen('reset-sent-card');
        });
    }

    // ── Step 2: reveal the direct "Set New Password" screen ──
    const setNewBtn = document.getElementById('reset-setnew-btn');
    if (setNewBtn) {
        setNewBtn.addEventListener('click', () => {
            if (!resetEmail) { backToLogin(); return; }
            showScreen('reset-newpw-card');
        });
    }

    // ── Step 3: choose and save the new password ──
    const newpwForm = document.getElementById('reset-newpw-form');
    const newInput = document.getElementById('reset-new');
    const confirmInput = document.getElementById('reset-confirm');

    [newInput, confirmInput].forEach(f => { if (f) FieldError.clearOnInput(f); });

    // Show/hide password toggles (same behaviour as login/signup)
    const setupToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;
        btn.addEventListener('click', () => {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.innerHTML = type === 'password' ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
            lucide.createIcons();
        });
    };
    setupToggle('reset-toggle-1', 'reset-new');
    setupToggle('reset-toggle-2', 'reset-confirm');

    if (newpwForm) {
        newpwForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            FieldError.clear(newInput);
            FieldError.clear(confirmInput);

            if (!resetEmail) { backToLogin(); return; }

            const pwd = newInput.value;
            const confirm = confirmInput.value;

            // Same checks and wording as signup.js.
            let bad = false;
            if (!pwd) { FieldError.show(newInput, 'Please choose a password.'); bad = true; }
            else if (pwd.length < 8) { FieldError.show(newInput, 'Your password needs at least 8 characters.'); bad = true; }
            else if (!PWD_REGEX.test(pwd)) { FieldError.show(newInput, 'Add a capital letter, a number, and a symbol (like @ or !) to your password.'); bad = true; }

            if (!confirm) { FieldError.show(confirmInput, 'Please type your password again to confirm.'); bad = true; }
            else if (pwd !== confirm) { FieldError.show(confirmInput, "These passwords don't match — please check and try again."); bad = true; }

            if (bad) return;

            // Save the new password (hashed exactly like signup).
            try {
                const result = await updateUserPassword(resetEmail, pwd);
                if (!result.success) {
                    FieldError.show(newInput, result.message || 'Something went wrong. Please try again.');
                    return;
                }
            } catch (err) {
                // Hashing needs the Web Crypto API (secure context only).
                console.error('Password reset failed:', err);
                FieldError.show(newInput, window.isSecureContext
                    ? 'Something went wrong. Please try again.'
                    : 'Please open this app over a secure (https) connection to reset your password.');
                return;
            }

            // Success: show the confirmation, then return to login after 2s.
            resetEmail = null;
            newpwForm.reset();
            showScreen('reset-done-card');
            setTimeout(backToLogin, 2000);
        });
    }
});

/* ============================================================
   Kahawa Smart — Signup Interaction & Validation

   Validation DECISIONS are unchanged (same rules as before).
   What changed: every error is now explained in plain language
   under the field, via the shared FieldError helper, instead of
   an icon-only flash or a browser-default bubble.
============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Entrance Animation
    gsap.fromTo('#signup-card',
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }
    );

    const form = document.getElementById('signup-form');
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const pwdInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-confirm');
    const termsInput = document.getElementById('signup-terms');

    const strengthContainer = document.getElementById('pwd-strength-container');
    const pwdLabel = document.getElementById('pwd-label');
    const bars = [
        document.getElementById('bar-1'),
        document.getElementById('bar-2'),
        document.getElementById('bar-3'),
        document.getElementById('bar-4')
    ];

    // Same password rule as before: 8+ chars, upper, lower, number, symbol.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    // Errors clear themselves as soon as the user starts fixing the field.
    [nameInput, emailInput, pwdInput, confirmInput, termsInput].forEach(FieldError.clearOnInput);

    // Toggle Password Visibility
    const setupToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        btn.addEventListener('click', () => {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.innerHTML = type === 'password' ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
            lucide.createIcons();
        });
    };
    setupToggle('toggle-pwd-1', 'signup-password');
    setupToggle('toggle-pwd-2', 'signup-confirm');

    // Password Strength Logic (positive feedback meter — unchanged)
    pwdInput.addEventListener('input', () => {
        const val = pwdInput.value;
        strengthContainer.style.display = val.length > 0 ? 'block' : 'none';

        let strength = 0;
        if (val.length >= 8) strength++; // Minimum length
        if (/[A-Z]/.test(val) && /[a-z]/.test(val)) strength++; // Upper & Lower
        if (/\d/.test(val)) strength++; // Number
        if (/[@$!%*?&]/.test(val)) strength++; // Special Char

        // Reset bars
        bars.forEach(bar => bar.style.background = 'var(--bg-3)');

        if (strength === 1) {
            bars[0].style.background = 'var(--danger)';
            pwdLabel.textContent = 'Weak';
            pwdLabel.style.color = 'var(--danger)';
        } else if (strength === 2) {
            bars[0].style.background = 'var(--warning)';
            bars[1].style.background = 'var(--warning)';
            pwdLabel.textContent = 'Fair';
            pwdLabel.style.color = 'var(--warning)';
        } else if (strength === 3) {
            bars[0].style.background = 'var(--accent)';
            bars[1].style.background = 'var(--accent)';
            bars[2].style.background = 'var(--accent)';
            pwdLabel.textContent = 'Good';
            pwdLabel.style.color = 'var(--accent)';
        } else if (strength === 4) {
            bars.forEach(bar => bar.style.background = 'var(--accent)');
            pwdLabel.textContent = 'Strong';
            pwdLabel.style.color = 'var(--accent)';
        } else if (val.length > 0) {
            pwdLabel.textContent = 'Too short';
            pwdLabel.style.color = 'var(--text-muted)';
        }
    });

    // Handle Form Submission (async: password hashing uses the Web Crypto API)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear any errors from a previous attempt
        [nameInput, emailInput, pwdInput, confirmInput, termsInput].forEach(FieldError.clear);

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const pwd = pwdInput.value;
        const confirm = confirmInput.value;

        // Collect every problem at once, so the farmer sees all of them.
        let firstBad = null;
        const fail = (field, msg) => { FieldError.show(field, msg); if (!firstBad) firstBad = field; };

        if (!name) fail(nameInput, 'Please enter your name.');

        if (!email) fail(emailInput, 'Please enter your email address.');
        else if (!EMAIL_RE.test(email)) fail(emailInput, 'Please enter a valid email address, like name@example.com');

        if (!pwd) fail(pwdInput, 'Please choose a password.');
        else if (pwd.length < 8) fail(pwdInput, 'Your password needs at least 8 characters.');
        else if (!pwdRegex.test(pwd)) fail(pwdInput, 'Add a capital letter, a number, and a symbol (like @ or !) to your password.');

        if (!confirm) fail(confirmInput, 'Please type your password again to confirm.');
        else if (pwd !== confirm) fail(confirmInput, "These passwords don't match — please check and try again.");

        if (termsInput && !termsInput.checked) fail(termsInput, 'Please tick the box to agree to the Terms before continuing.');

        if (firstBad) {
            triggerErrorShake();
            firstBad.focus();
            return;
        }

        // Attempt Registration
        let result;
        try {
            result = await registerUser(name, email, pwd);
        } catch (err) {
            // Password hashing needs the Web Crypto API, which only works on a
            // secure context (localhost / 127.0.0.1 / HTTPS). Explain, don't
            // fail silently.
            console.error('Registration failed:', err);
            FieldError.show(emailInput, window.isSecureContext
                ? 'Something went wrong. Please try again.'
                : 'Please open this app over a secure (https) connection to create an account.');
            triggerErrorShake();
            return;
        }

        if (result.success) {
            // Success animation
            const btn = document.getElementById('signup-btn');
            btn.innerHTML = '<i data-lucide="check"></i> Account Created!';
            btn.style.background = '#5bbf66';
            lucide.createIcons();

            gsap.to('#signup-card', {
                opacity: 0,
                y: -20,
                duration: 0.4,
                delay: 1,
                ease: 'power2.in',
                onComplete: () => window.location.href = 'login.html'
            });
        } else {
            // registerUser only fails here when the email is taken
            FieldError.show(emailInput, 'That email is already registered — try logging in instead.');
            triggerErrorShake();
        }
    });

    function triggerErrorShake() {
        gsap.to('#signup-card', {
            x: [-10, 10, -8, 8, -5, 5, 0],
            duration: 0.4,
            ease: 'power1.inOut'
        });
    }
});

/* ============================================================
   Kahawa Smart — Login Interaction

   Validation DECISIONS are unchanged. What changed: mistakes are
   now explained in plain language under the field, via the shared
   FieldError helper, instead of browser-default bubbles or a bare
   red border.
============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Entrance Animation
    gsap.fromTo('#login-card',
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }
    );

    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberInput = document.getElementById('login-remember');
    const togglePwd = document.querySelector('.toggle-pwd');

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Errors clear as soon as the user starts correcting a field.
    [emailInput, passwordInput].forEach(FieldError.clearOnInput);

    // Toggle Password Visibility
    togglePwd.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        togglePwd.innerHTML = type === 'password' ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
        lucide.createIcons();
    });

    // Handle form submission (async: password hashing uses the Web Crypto API)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        FieldError.clear(emailInput);
        FieldError.clear(passwordInput);

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Basic checks first, each explained in plain language.
        let firstBad = null;
        const fail = (field, msg) => { FieldError.show(field, msg); if (!firstBad) firstBad = field; };

        if (!email) fail(emailInput, 'Please enter your email address.');
        else if (!EMAIL_RE.test(email)) fail(emailInput, 'Please enter a valid email address, like name@example.com');

        if (!password) fail(passwordInput, 'Please enter your password.');

        if (firstBad) {
            shake();
            firstBad.focus();
            return;
        }

        // Attempt Login
        let result;
        try {
            result = await loginUser(email, password, rememberInput.checked);
        } catch (err) {
            // Password hashing needs the Web Crypto API (secure context only).
            console.error('Login failed:', err);
            result = {
                success: false,
                message: window.isSecureContext
                    ? 'Something went wrong. Please try again.'
                    : 'Please open this app over a secure (https) connection to log in.',
            };
        }

        if (result.success) {
            // Success animation
            const btn = document.getElementById('login-btn');
            btn.innerHTML = '<span class="spin" style="display:inline-block">◌</span> Authenticating...';

            gsap.to('#login-card', {
                opacity: 0,
                y: -20,
                duration: 0.4,
                delay: 0.5,
                ease: 'power2.in',
                onComplete: () => window.location.href = 'index.html'
            });
        } else {
            // Wrong email/password (or the crypto message above). Explain it,
            // and red-border both fields since either could be the problem.
            const msg = result.message === 'Invalid email or password.'
                ? 'Email or password is incorrect — please try again.'
                : result.message;
            FieldError.show(passwordInput, msg);
            emailInput.classList.add('input-error');
            shake();
        }
    });

    function shake() {
        gsap.to('#login-card', {
            x: [-10, 10, -8, 8, -5, 5, 0],
            duration: 0.4,
            ease: 'power1.inOut'
        });
    }
});

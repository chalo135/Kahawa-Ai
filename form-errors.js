/* ============================================================
   Kahawa Smart — Farmer-friendly field errors (reusable)
   ------------------------------------------------------------
   ONE consistent way to explain a form mistake, used by login,
   signup, and anywhere else. Instead of a bare red icon, it puts
   a short plain-language sentence directly under the field.

   Touch-friendly: the message is always visible the moment it
   appears — never hidden behind hover or a tooltip.

   Usage:
     FieldError.show(inputEl, "Please enter your email address.");
     FieldError.clear(inputEl);
     FieldError.clearOnInput(inputEl);   // auto-clears as user types
============================================================ */
(function (global) {
  'use strict';

  function container(field) {
    return field.closest('.form-group')
        || field.closest('.auth-options')
        || field.parentElement;
  }

  // Finds the field's error element, creating one if it doesn't exist yet.
  function errorEl(field) {
    const box = container(field);
    if (!box) return null;

    let el = box.querySelector(':scope > .field-error');
    if (!el) {
      el = document.createElement('div');
      el.className = 'field-error';
      el.setAttribute('role', 'alert');          // announced to screen readers
      el.id = (field.id || 'field') + '-error';
      el.innerHTML = '<i data-lucide="alert-circle"></i><span></span>';

      // Place directly under the input so the explanation sits with the field.
      const wrapper = box.querySelector(':scope > .input-wrapper');
      if (wrapper && wrapper.nextSibling) {
        box.insertBefore(el, wrapper.nextSibling);
      } else {
        box.appendChild(el);
      }
    }
    return el;
  }

  function show(field, message) {
    if (!field) return;
    const el = errorEl(field);
    if (!el) return;
    el.querySelector('span').textContent = message;
    el.classList.add('visible');
    field.classList.add('input-error');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', el.id);
    if (global.lucide) lucide.createIcons();
  }

  function clear(field) {
    if (!field) return;
    const box = container(field);
    const el = box && box.querySelector(':scope > .field-error');
    if (el) el.classList.remove('visible');
    field.classList.remove('input-error');
    field.removeAttribute('aria-invalid');
  }

  // Clears the error the instant the user starts correcting the field,
  // so a stale message never lingers. Safe to call more than once.
  function clearOnInput(field) {
    if (!field || field._feBound) return;
    field._feBound = true;
    field.addEventListener(field.type === 'checkbox' ? 'change' : 'input',
      () => clear(field));
  }

  global.FieldError = { show, clear, clearOnInput };
})(window);

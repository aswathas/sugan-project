'use strict';

(() => {
  const trigger = document.getElementById('close-register');
  if (!trigger) return;

  trigger.addEventListener('click', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const verifyForm = document.getElementById('verify-form');
    const tabs = document.getElementById('tabs');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const username = document.getElementById('register-username');

    if (tabs) tabs.classList.remove('hidden');
    if (verifyForm) verifyForm.classList.add('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.remove('hidden');
    if (tabLogin) tabLogin.setAttribute('aria-pressed', 'false');
    if (tabRegister) tabRegister.setAttribute('aria-pressed', 'true');
    if (username) {
      username.scrollIntoView({ block: 'center' });
      username.focus();
    }
  });
})();

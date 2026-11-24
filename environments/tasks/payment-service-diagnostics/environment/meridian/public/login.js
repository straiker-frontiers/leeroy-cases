'use strict';
const f = document.getElementById('login-form');
const err = document.getElementById('err');
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true;
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const res = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.ok) {
    window.location.href = '/';
  } else {
    err.textContent = 'Invalid username or password.';
    err.hidden = false;
  }
});

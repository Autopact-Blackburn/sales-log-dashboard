import { CONFIG } from './config.js';

const { createClient } = supabase;

const supabaseClient = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);

const loginBtn = document.getElementById('loginBtn');

loginBtn.addEventListener('click', async () => {

  const email = document.getElementById('email').value.trim();

  const password = document.getElementById('password').value.trim();

  const errorMessage = document.getElementById('errorMessage');

  errorMessage.innerText = '';

  if (!email || !password) {
    errorMessage.innerText = 'Please enter email and password.';
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    errorMessage.innerText = error.message;
    return;
  }

  window.location.href = 'dashboard.html';

});
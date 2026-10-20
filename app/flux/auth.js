// auth.js
document.addEventListener('DOMContentLoaded', () => {
  db.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      FluxState.user = session.user;
      await FluxAuth._loadProfile();
      FluxAuth._mountApp();
    } else {
      FluxState.user = null;
      FluxState.profile = null;
      FluxAuth._mountAuth();
    }
  });
});

window.FluxAuth = {
  showSignUp() {
    document.getElementById('auth-signin-panel').classList.add('hidden');
    document.getElementById('auth-signup-panel').classList.remove('hidden');
    this._clearErrors();
  },

  showSignIn() {
    document.getElementById('auth-signup-panel').classList.add('hidden');
    document.getElementById('auth-signin-panel').classList.remove('hidden');
    this._clearErrors();
  },

  async signIn() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return this._error('Email and password required.');

    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) this._error(error.message);
  },

  async signUp() {
    const username = document.getElementById('auth-username').value.trim();
    const email = document.getElementById('auth-email-up').value.trim();
    const password = document.getElementById('auth-password-up').value;

    if (!username || !email || !password) return this._error('All fields required.');
    if (password.length < 6) return this._error('Password must be at least 6 characters.');
    if (!/^[a-z0-9_]+$/i.test(username)) return this._error('Username: letters, numbers, underscores only.');

    const { data: existing } = await db.from('profiles').select('id').eq('username', username).single();
    if (existing) return this._error('Username already taken.');

    const { data, error } = await db.auth.signUp({ email, password });
    if (error) return this._error(error.message);

    if (data.user) {
      await db.from('profiles').update({ username, display_name: username }).eq('id', data.user.id);
    }
    this._success('Check your email to confirm your account!');
  },

  async signOut() { await db.auth.signOut(); },

  async _loadProfile() {
    if (!FluxState.user) return;
    const { data } = await db.from('profiles').select('*').eq('id', FluxState.user.id).single();
    FluxState.profile = data;
  },

  _mountApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    const p = FluxState.profile;
    setAvatarEl(document.getElementById('sidebar-avatar'), p);
    document.getElementById('sidebar-username').textContent = p?.display_name || p?.username || 'You';
    document.getElementById('sidebar-handle').textContent = '@' + (p?.username || 'user');

    setAvatarEl(document.getElementById('feed-composer-avatar'), p);
    setAvatarEl(document.getElementById('modal-composer-avatar'), p);

    if (p) db.from('profiles').update({ presence: 'online' }).eq('id', FluxState.user.id);

    FluxFeed.init();
    FluxChat.init();
    FluxExplore.init();
  },

  _mountAuth() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    this.showSignIn();
  },

  _error(msg) {
    const el = document.getElementById('auth-error');
    el.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHTML(msg)}`;
    el.classList.remove('hidden');
  },
  _success(msg) {
    const el = document.getElementById('auth-success');
    el.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${escapeHTML(msg)}`;
    el.classList.remove('hidden');
  },
  _clearErrors() {
    ['auth-error','auth-success'].forEach(id => document.getElementById(id).classList.add('hidden'));
  }
};
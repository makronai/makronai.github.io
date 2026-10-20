/* ═══════════════════════════════════════════════════
   Reelux — app.js
   Self-contained SPA: Auth · Messages · Profile
   Dependencies: Supabase CDN (loaded below via dynamic import)
   ═══════════════════════════════════════════════════ */

// ─── Config ──────────────────────────────────────────
// TODO: Replace with your actual Supabase project URL + anon key
const SUPABASE_URL  = 'https://kqmdvttwzvlhabfpzwny.supabase.co';
const SUPABASE_ANON = 'sb_publishable_sl2n72V8ZxHArWnXjFeweQ_qd8jwggh';

// ─── Bootstrap ──────────────────────────────────────
(async () => {
  // Dynamically load Supabase from CDN so no bundler is needed
  const { createClient } = await import(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
  );
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

  // ── State ─────────────────────────────────────────
  const state = {
    user: null,
    profile: null,
    conversations: [],         // { profile, lastMessage, unread }
    selectedConvUserId: null,  // the other user's id
    messages: [],              // AppMessage[]
    msgSubscription: null,
    replyTo: null,             // { id, content, sender_id }
    pendingFile: null,         // File | null
    editingMsgId: null,
    viewingProfileId: null,    // null = own profile
    profileData: null,
    profilePosts: [],
    profileLikes: [],
    profileMedia: [],
    activePage: 'messages',
    activeProfileTab: 'posts',
    lightboxUrl: null,
    lightboxType: null,
    embedCache: {},
  };

  // ── DOM refs ──────────────────────────────────────
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  // ── Utility ───────────────────────────────────────
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function show(id)  { $(id)?.classList.remove('hidden'); }
  function hide(id)  { $(id)?.classList.add('hidden'); }
  function toggle(id){ $(id)?.classList.toggle('hidden'); }

  function toast(msg, dur = 2800) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._tid);
    toast._tid = setTimeout(() => t.classList.add('hidden'), dur);
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm';
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    return d.toLocaleDateString([], {month:'short',day:'numeric'});
  }

  function fmtNum(n) {
    if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
    if (n >= 1000) return (n/1000).toFixed(1)+'K';
    return String(n);
  }

  function isOnline(lastSeen) {
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen)) < 5 * 60 * 1000;
  }

  function isOnlyEmoji(str) {
    if (!str || str.length > 10) return false;
    const emojiRe = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/;
    return emojiRe.test(str);
  }

  // ── Auth year ────────────────────────────────────
  $('auth-year').textContent = new Date().getFullYear();

  // ─────────────────────────────────────────────────
  // VIEW SWITCHER
  // ─────────────────────────────────────────────────
  function showView(id) {
    $$('.view').forEach(v => v.classList.remove('active'));
    $(id).classList.add('active');
  }

  function showPage(page) {
    state.activePage = page;
    $$('.page').forEach(p => p.classList.add('hidden'));
    $(`page-${page}`)?.classList.remove('hidden');

    // Update bottom nav
    $$('.bottomnav__item').forEach(b => b.classList.remove('active'));
    $(`bnav-${page}`)?.classList.add('active');
  }

  // ─────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────
  function showAuthError(msg) {
    const el = $('auth-error');
    $('auth-error-text').textContent = msg;
    el.classList.remove('hidden');
    $('auth-success').classList.add('hidden');
  }
  function clearAuthMessages() {
    $('auth-error').classList.add('hidden');
    $('auth-success').classList.add('hidden');
  }

  $('btn-signin').addEventListener('click', async () => {
    clearAuthMessages();
    const email = $('signin-email').value.trim();
    const pass  = $('signin-password').value;
    if (!email || !pass) return showAuthError('Email and password are required.');
    $('btn-signin').textContent = 'Signing in…';
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    $('btn-signin').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Enter Makron';
    if (error) showAuthError(normalizeAuthError(error.message));
  });

  $('btn-discord-signin').addEventListener('click', async () => {
    clearAuthMessages();
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.href } });
    if (error) showAuthError(error.message);
  });

  $('btn-google-signin').addEventListener('click', async () => {
    clearAuthMessages();
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
    if (error) showAuthError(error.message);
  });

  $('btn-toggle-signup').addEventListener('click', () => {
    // For the static site, OAuth sign-up is the recommended path.
    // Redirect to Discord/Google OAuth for account creation.
    clearAuthMessages();
    const isSignUp = $('auth-heading').textContent === 'Sign In';
    $('auth-heading').textContent   = isSignUp ? 'Create Account'      : 'Sign In';
    $('btn-toggle-signup').textContent = isSignUp ? 'Already have an account? Sign In' : 'New here? Create an account';
    $('btn-signin').innerHTML = isSignUp
      ? 'Join via email (not recommended)'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Enter Makron';
  });

  function normalizeAuthError(msg) {
    const m = msg?.toLowerCase() || '';
    if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Wrong email or password.';
    if (m.includes('email not confirmed')) return 'Check your email for a confirmation link.';
    if (m.includes('already registered') || m.includes('already exists')) return 'An account with this email already exists.';
    return msg;
  }

  // ─────────────────────────────────────────────────
  // SESSION + PROFILE BOOTSTRAP
  // ─────────────────────────────────────────────────
  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  }

  async function onSignedIn(user) {
    state.user = user;
    state.profile = await loadProfile(user.id);
    renderNavProfile();
    showView('view-app');
    showPage('messages');
    loadConversations();
  }

  function onSignedOut() {
    state.user = null; state.profile = null;
    state.msgSubscription?.unsubscribe();
    showView('view-auth');
  }

  // Initial session check
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) { await onSignedIn(session.user); } else { showView('view-auth'); }

  supabase.auth.onAuthStateChange(async (event, sess) => {
    if (event === 'SIGNED_IN'  && sess) await onSignedIn(sess.user);
    if (event === 'SIGNED_OUT')         onSignedOut();
  });

  // ─────────────────────────────────────────────────
  // NAV PROFILE
  // ─────────────────────────────────────────────────
  function renderNavProfile() {
    const p = state.profile;
    if (!p) return;
    const img = $('nav-avatar-img');
    const ph  = $('nav-avatar-placeholder');
    if (p.avatar_url) {
      img.src = p.avatar_url;
      img.classList.remove('hidden');
      ph.classList.add('hidden');
    } else {
      img.classList.add('hidden');
      ph.classList.remove('hidden');
    }
  }

  // User dropdown
  $('user-avatar-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggle('user-dropdown');
  });
  document.addEventListener('click', () => hide('user-dropdown'));
  $('user-dropdown').addEventListener('click', e => e.stopPropagation());

  $('dd-profile').addEventListener('click', () => {
    hide('user-dropdown');
    openProfile(null); // own profile
  });
  $('dd-signout').addEventListener('click', async () => {
    hide('user-dropdown');
    await supabase.auth.signOut();
  });

  // Top nav icon buttons
  $('nav-messages-btn').addEventListener('click', () => { showPage('messages'); });
  $('nav-search-btn').addEventListener('click', () => {
    const q = prompt('Search for a user (username):');
    if (q) searchUser(q);
  });

  // Bottom nav
  $$('.bottomnav__item').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page === 'profile') { openProfile(null); return; }
      showPage(page);
    });
  });

  // ─────────────────────────────────────────────────
  // MESSAGES
  // ─────────────────────────────────────────────────


  // Lightweight URL Detection (Optimized for speed)
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function extractFirstUrl(text) {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

// Lazy Embed Loader (Ported from MessageEmbed.tsx)
async function renderEmbed(url, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    // We use a 5-second timeout for slow connections
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal: controller.signal });
    const json = await res.json();
    clearTimeout(timeout);

    if (json.status === 'success') {
      const { data } = json;
      container.innerHTML = `
        <a href="${url}" target="_blank" class="embed-card">
          ${data.image ? `<img src="${data.image.url}" loading="lazy" class="embed-img" />` : ''}
          <div class="embed-info">
            <div class="embed-title">${data.title || 'Link'}</div>
            <p class="embed-desc">${data.description ? data.description.substring(0, 60) + '...' : ''}</p>
          </div>
        </a>
      `;
    }
  } catch (e) {
    container.remove(); // Silently fail to keep UI clean on bad internet
  }
}

  // ── Load conversations list ────────────────────
  async function loadConversations() {
    if (!state.user) return;

    const { data: msgs } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id,display_name,username,avatar_url,last_seen), receiver:recipient_id(id,display_name,username,avatar_url,last_seen)')
      .or(`sender_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`)
      .order('created_at', { ascending: false });

    if (!msgs) return;

    // Deduplicate by conversation partner
    const map = new Map();
    for (const m of msgs) {
      const partner = m.sender_id === state.user.id ? m.receiver : m.sender;
      if (!partner) continue;
      if (!map.has(partner.id)) {
        map.set(partner.id, { profile: partner, lastMessage: m, unread: 0 });
      }
    }

    // Count unread
    const { data: unread } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('recipient_id', state.user.id)
      .eq('read', false);

    if (unread) {
      for (const u of unread) {
        if (map.has(u.sender_id)) map.get(u.sender_id).unread++;
      }
    }

    state.conversations = [...map.values()];
    renderConvList();

    // Update badges
    const totalUnread = state.conversations.reduce((a, c) => a + c.unread, 0);
    updateBadge('nav-msg-badge',  totalUnread);
    updateBadge('bnav-msg-badge', totalUnread);
  }

  function updateBadge(id, count) {
    const b = $(id);
    if (!b) return;
    if (count > 0) { b.textContent = count > 99 ? '99+' : count; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  }

  function renderConvList() {
    const list = $('conv-list');
    list.innerHTML = '';
    const q = $('conv-search').value.toLowerCase();
    const convs = q ? state.conversations.filter(c => {
      const p = c.profile;
      return p.display_name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q);
    }) : state.conversations;

    if (!convs.length) {
      list.innerHTML = '<li style="padding:16px;color:var(--text-3);font-size:13px;text-align:center">No conversations yet.</li>';
      return;
    }

    for (const conv of convs) {
      const p = conv.profile;
      const li = el('li', `conv-item${p.id === state.selectedConvUserId ? ' active' : ''}`);
      li.setAttribute('role', 'option');
      li.innerHTML = `
        <div style="position:relative;flex-shrink:0">
          <img class="avatar avatar--md" src="${p.avatar_url || ''}" alt="${p.display_name}" onerror="this.src=''" />
          ${isOnline(p.last_seen) ? '<span class="online-dot"></span>' : ''}
        </div>
        <div class="conv-item__body">
          <div class="conv-item__name">${p.display_name || p.username}</div>
          <div class="conv-item__preview">${previewMessage(conv.lastMessage)}</div>
        </div>
        <div class="conv-item__meta">
          <span class="conv-item__time">${fmtTime(conv.lastMessage?.created_at)}</span>
          ${conv.unread > 0 ? `<span class="conv-unread">${conv.unread}</span>` : ''}
        </div>
      `;
      li.addEventListener('click', () => openConversation(p));
      list.appendChild(li);
    }
  }

  function previewMessage(msg) {
    if (!msg) return '';
    if (msg.media_type === 'image') return '📷 Image';
    if (msg.media_type === 'video') return '🎬 Video';
    if (msg.media_type === 'audio') return '🎤 Voice message';
    if (msg.media_type === 'file')  return '📄 File';
    return (msg.content || '').substring(0, 48);
  }

  $('conv-search').addEventListener('input', renderConvList);

  $('msg-new-btn').addEventListener('click', () => {
    const q = prompt('Enter username to start a conversation:');
    if (q) searchUser(q);
  });

  async function searchUser(username) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', username.replace(/^@/, ''))
      .single();
    if (data) openConversation(data);
    else toast('User not found.');
  }

function createSingleMessageNode(msg) {
  const item = document.createElement('div');
  item.className = `msg-item ${msg.sender_id === state.user.id ? 'msg-item--me' : ''}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const content = document.createElement('div');
  content.className = 'msg-content';
  content.innerHTML = safeFormat(msg.content || '');

  bubble.appendChild(content);

  const url = extractFirstUrl(msg.content);
  if (url) {
    const embed = document.createElement('div');
    const embedId = `embed-${msg.id}`;
    embed.id = embedId;
    embed.className = 'msg-embed-placeholder';
    bubble.appendChild(embed);

    renderEmbed(url, embedId);
  }

  item.appendChild(bubble);

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = fmtTime(msg.created_at);

  item.appendChild(time);

  return item;
}

  // ── Open a conversation ────────────────────────
async function openConversation(profile) {
    if (state.msgSubscription) state.msgSubscription.unsubscribe();
    state.selectedConvUserId = profile.id;

    // Update sidebar highlight
    renderConvList();

    // Show chat panel, hide empty
    hide('chat-empty'); show('chat-active');

    // Update header
    $('chat-avatar').src = profile.avatar_url || '';
    $('chat-name').textContent   = profile.display_name || profile.username;
    $('chat-status').textContent = isOnline(profile.last_seen) ? '● Online' : `Last seen ${fmtTime(profile.last_seen)}`;

    // Mobile: hide sidebar
    $('msg-sidebar').classList.add('hidden-mobile');

    // Load messages
    await fetchMessages();

    // Mark as read
    supabase.from('messages')
      .update({ read: true })
      .eq('sender_id', profile.id)
      .eq('recipient_id', state.user.id)
      .then(() => loadConversations());

    // Subscribe to realtime
    state.msgSubscription = supabase
      .channel(`dm_${[state.user.id, profile.id].sort().join('_')}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=in.(${state.user.id},${profile.id})`,
      }, () => {
        fetchMessages();
        supabase.from('messages').update({ read: true }).eq('sender_id', profile.id).eq('recipient_id', state.user.id);
      })
      .subscribe();
  }


  async function fetchMessages() {
    const other = state.selectedConvUserId;
    if (!other || !state.user) return;

    const { data } = await supabase
      .from('messages')
      .select(`
        *, 
        reactions:message_reactions(emoji, user_id, profiles:user_id(display_name, avatar_url)),
        reply_to:reply_to_id(id, content, sender_id, media_type)
      `)
      .or(
        `and(sender_id.eq.${state.user.id},recipient_id.eq.${other}),` +
        `and(sender_id.eq.${other},recipient_id.eq.${state.user.id})`
      )
      .order('created_at', { ascending: true });

    state.messages = data || [];
    renderMessages();
  }

  function renderMessages() {
  const list = $('chat-feed');
  if (!list) return; // Safety check
  list.innerHTML = '';
  const fragment = document.createDocumentFragment(); // PERFORMANCE: Batch DOM updates
  

  state.messages.forEach((msg) => {
    const item = document.createElement('div');
    item.className = `msg-item ${msg.sender_id === state.user.id ? 'msg-item--me' : ''}`;
    
    // Check for URLs
    const url = extractFirstUrl(msg.content);
    const embedId = `embed-${msg.id}`;

    item.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-content">${msg.content}</div>
        ${url ? `<div id="${embedId}" class="msg-embed-placeholder">
    <div class="embed-loading-state">Optimizing link preview...</div>
</div>` : ''}
      </div>
      <div class="msg-time">${fmtTime(msg.created_at)}</div>
    `;

    fragment.appendChild(item);

    // Trigger embed fetch AFTER text is in the DOM
    if (url) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        renderEmbed(url, embedId);
        observer.unobserve(entry.target); // Stop watching once loaded
      }
    });
  }, { rootMargin: '100px' }); // Start loading 100px before it enters view

  const placeholder = item.querySelector(`#${embedId}`);
  if (placeholder) observer.observe(placeholder);
}
  });

  list.appendChild(fragment);
}

  // ── Reactions ────────────────────────────────────
  function groupReactions(reactions, myId) {
    const map = new Map();
    for (const r of reactions) {
      if (!map.has(r.emoji)) map.set(r.emoji, { emoji: r.emoji, count: 0, hasReacted: false, userProfiles: [] });
      const g = map.get(r.emoji);
      g.count++;
      if (r.user_id === myId) g.hasReacted = true;
      if (r.profiles && !Array.isArray(r.profiles)) g.userProfiles.push(r.profiles);
    }
    return [...map.values()].sort((a,b) => b.count - a.count);
  }

  async function toggleReaction(msgId, emoji) {
    // Check existing
    const { data } = await supabase.from('message_reactions').select('id')
      .eq('message_id', msgId).eq('user_id', state.user.id).eq('emoji', emoji).maybeSingle();
    if (data) {
      await supabase.from('message_reactions').delete().eq('id', data.id);
    } else {
      await supabase.from('message_reactions').insert({ 
        message_id: msgId, 
        user_id: state.user.id, 
        emoji,
        message_type: 'dm' });
    }
    fetchMessages();
  }

  // ── Context menu ─────────────────────────────────
  let ctxMenu = null;
  function removeCtxMenu() { ctxMenu?.remove(); ctxMenu = null; }
  document.addEventListener('click', removeCtxMenu);

  function showMsgMenu(event, msg, isOut) {
    removeCtxMenu();
    const menu = el('div', '');
    menu.style.cssText = `position:fixed;top:${event.clientY}px;left:${Math.min(event.clientX, window.innerWidth-180)}px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:12px;overflow:hidden;z-index:200;min-width:160px;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:dropdown-in 0.15s ease`;

    const addItem = (label, icon, cb, danger) => {
      const btn = el('button', 'attach-menu-item');
      if (danger) btn.style.color = 'var(--red)';
      btn.innerHTML = `${icon}<span>${label}</span>`;
      btn.addEventListener('click', () => { removeCtxMenu(); cb(); });
      menu.appendChild(btn);
    };

    // Quick reactions
    const reactionRow = el('div', '');
    reactionRow.style.cssText = 'display:flex;gap:4px;padding:8px 12px;';
    for (const e of ['👍','❤️','😂','😮','😢','💀']) {
      const b = el('button', 'emoji-btn'); b.textContent = e;
      b.addEventListener('click', () => { removeCtxMenu(); toggleReaction(msg.id, e); });
      reactionRow.appendChild(b);
    }
    menu.appendChild(reactionRow);

    const sep = el('div'); sep.style.cssText = 'height:1px;background:var(--border);';
    menu.appendChild(sep);

    addItem('Reply', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>', () => setReplyTo(msg));

    addItem('Copy text', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      () => { navigator.clipboard?.writeText(msg.content || ''); toast('Copied!'); });

    if (isOut) {
      if (msg.content) {
        addItem('Edit', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
          () => startEdit(msg));
      }
      addItem('Delete', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
        () => deleteMessage(msg.id), true);
    }

    document.body.appendChild(menu);
    ctxMenu = menu;
    event.stopPropagation();
  }

  // ── Reply ────────────────────────────────────────
  function setReplyTo(msg) {
    state.replyTo = msg;
    const preview = msg.media_type === 'image' ? '📷 Image' : (msg.content || '').substring(0, 60);
    $('reply-preview-text').textContent = preview;
    show('reply-preview');
    $('msg-input').focus();
  }

  $('reply-cancel-btn').addEventListener('click', () => {
    state.replyTo = null;
    hide('reply-preview');
  });

  // ── Edit ─────────────────────────────────────────
  function startEdit(msg) {
    state.editingMsgId = msg.id;
    const input = $('msg-input');
    input.value = msg.content || '';
    input.focus();
    $('send-btn').style.background = 'var(--green)';
  }

  function cancelEdit() {
    state.editingMsgId = null;
    $('msg-input').value = '';
    $('send-btn').style.background = '';
  }

  // ── Delete ───────────────────────────────────────
  async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    await supabase.from('messages').delete().eq('id', id);
    fetchMessages(); loadConversations();
  }

  // ── Send ─────────────────────────────────────────
  $('send-btn').addEventListener('click', sendOrEdit);
  $('msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOrEdit(); }
  });

  // Auto-resize textarea
  $('msg-input').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  async function sendOrEdit() {
    const input   = $('msg-input');
    const content = input.value.trim();
    const other   = state.selectedConvUserId;
    if (!other) return;

    if (state.editingMsgId) {
      if (!content) return;
      await supabase.from('messages').update({ content, is_edited: true }).eq('id', state.editingMsgId);
      cancelEdit();
      fetchMessages();
      return;
    }

    // Upload pending file
    let mediaUrl = null, mediaType = null, mediaFilename = null;
    if (state.pendingFile) {
      const file = state.pendingFile;
      const ext  = file.name.split('.').pop();
      const path = `${state.user.id}/${Date.now()}.${ext}`;
      show('upload-bar');

      const { data: up, error: upErr } = await supabase.storage.from('media').upload(path, file);
      hide('upload-bar');
      if (upErr) { toast('Upload failed: ' + upErr.message); return; }
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      mediaUrl = urlData.publicUrl;

      if (file.type.startsWith('image')) mediaType = 'image';
      else if (file.type.startsWith('video')) mediaType = 'video';
      else if (file.type.startsWith('audio')) mediaType = 'audio';
      else { mediaType = 'file'; mediaFilename = file.name; }

      clearPendingFile();
    }

    if (!content && !mediaUrl) return;

    const msg = {
      sender_id:    state.user.id,
      recipient_id:  other,
      content:      content || '',
      media_url:    mediaUrl,
      media_type:   mediaType,
      media_filename: mediaFilename,
      reply_to_id:  state.replyTo?.id || null,
      read:      false,
    };

    await supabase.from('messages').insert(msg);

    input.value = '';
    input.style.height = 'auto';
    state.replyTo = null;
    hide('reply-preview');
    loadConversations();
  }

  // ── File attach ──────────────────────────────────
  $('attach-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggle('attach-menu');
  });

  $('attach-file-btn').addEventListener('click', () => {
    hide('attach-menu');
    $('file-input').click();
  });

  $('attach-url-btn').addEventListener('click', () => {
    hide('attach-menu');
    const url = prompt('Paste a URL:');
    if (url) {
      $('msg-input').value += (($('msg-input').value ? ' ' : '') + url);
    }
  });

  $('file-input').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    e.target.value = '';
  });

  function setPendingFile(file) {
    state.pendingFile = file;
    const preview = $('media-preview');
    const img     = $('media-preview-img');
    const fname   = $('media-preview-file');

    if (file.type.startsWith('image')) {
      img.src = URL.createObjectURL(file);
      img.classList.remove('hidden');
      fname.classList.add('hidden');
    } else {
      img.classList.add('hidden');
      fname.textContent = file.name;
      fname.classList.remove('hidden');
    }
    preview.classList.remove('hidden');
  }

  function clearPendingFile() {
    state.pendingFile = null;
    $('media-preview').classList.add('hidden');
    $('media-preview-img').classList.add('hidden');
    $('media-preview-file').classList.add('hidden');
  }

  $('media-remove-btn').addEventListener('click', clearPendingFile);

  // Mobile back button in chat
  $('chat-back-btn').addEventListener('click', () => {
    $('msg-sidebar').classList.remove('hidden-mobile');
    hide('chat-active'); show('chat-empty');
    state.selectedConvUserId = null;
  });

  $('msg-open-sidebar-btn').addEventListener('click', () => {
    $('msg-sidebar').classList.remove('hidden-mobile');
  });

  // ── Audio player builder ────────────────────────
  function buildAudioPlayer(src, isOut) {
    const wrap = el('div', 'audio-player');
    const audio = new Audio(src);
    let dur = 0;

    const playBtn = el('button', 'audio-play-btn');
    playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

    const range = el('input', 'audio-range');
    range.type = 'range'; range.min = '0'; range.step = '0.1'; range.value = '0';

    const timeEl = el('span', 'audio-time');
    timeEl.textContent = '0:00';

    audio.addEventListener('loadedmetadata', () => {
      dur = audio.duration;
      range.max = String(dur);
      timeEl.textContent = fmtAudioTime(dur);
    });

    audio.addEventListener('timeupdate', () => {
      range.value = String(audio.currentTime);
      timeEl.textContent = fmtAudioTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      audio.currentTime = 0;
    });

    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      } else {
        audio.pause();
        playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      }
    });

    range.addEventListener('input', () => { audio.currentTime = parseFloat(range.value); });

    wrap.appendChild(playBtn);
    wrap.appendChild(range);
    wrap.appendChild(timeEl);
    return wrap;
  }

  function fmtAudioTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Embed builder ────────────────────────────────

  function renderEmbedCard(data, url) {
    const card = el('a', 'embed-card');
    card.href = url; card.target = '_blank'; card.rel = 'noopener noreferrer';
    let hostname = url;
    try { hostname = new URL(url).hostname; } catch(_){}

    card.innerHTML = `
      <div class="embed-card__pub">${data.publisher || hostname}</div>
      <div class="embed-card__body">
        <div class="embed-card__info">
          <div class="embed-card__title">${data.title || url}</div>
          ${data.description ? `<div class="embed-card__desc">${data.description.substring(0,100)}</div>` : ''}
        </div>
        ${data.image?.url ? `<img class="embed-card__thumb" src="${data.image.url}" alt="" loading="lazy" />` : ''}
      </div>
    `;
    return card;
  }

  // ─────────────────────────────────────────────────
  // LIGHTBOX
  // ─────────────────────────────────────────────────
  function openLightbox(url, type) {
    const lb = $('lightbox');
    const img = $('lightbox-img');
    const vid = $('lightbox-video');

    if (type === 'image') {
      img.src = url; img.classList.remove('hidden');
      vid.classList.add('hidden');
    } else {
      vid.src = url; vid.classList.remove('hidden');
      img.classList.add('hidden');
    }
    lb.classList.remove('hidden');
  }

  $('lightbox').addEventListener('click', () => {
    $('lightbox').classList.add('hidden');
    $('lightbox-video').pause?.();
  });
  $('lightbox-close').addEventListener('click', e => { e.stopPropagation(); $('lightbox').classList.add('hidden'); });

  // ─────────────────────────────────────────────────
  // PROFILE
  // ─────────────────────────────────────────────────
  async function openProfile(userId) {
    state.viewingProfileId = userId;
    showPage('profile');
    const targetId = userId || state.user?.id;
    if (!targetId) return;

    // Fetch profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', targetId).single();
    if (!profile) { toast('Profile not found.'); return; }
    state.profileData = profile;

    // Render
    renderProfileHeader(profile, userId === null || userId === state.user?.id);

    // Follower counts
    const [{ count: frs }, { count: fng }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
    ]);
    $('stat-followers-num').textContent = fmtNum(frs || 0);
    $('stat-following-num').textContent = fmtNum(fng || 0);

    // Load posts
    await loadProfilePosts(targetId);
    setProfileTab('posts');
  }

  function renderProfileHeader(profile, isOwn) {
    // Banner
    const bannerEl = $('profile-banner-img');
    bannerEl.style.background = profile.banner_url
      ? `url(${profile.banner_url}) center/cover no-repeat`
      : 'linear-gradient(135deg, var(--surface-2), var(--surface-3))';

    // Avatar
    const avatarEl = $('profile-avatar');
    avatarEl.src = profile.avatar_url || '';
    avatarEl.alt = profile.display_name;

    // Online
    if (isOnline(profile.last_seen)) $('profile-online-dot').classList.remove('hidden');
    else $('profile-online-dot').classList.add('hidden');

    // Name / username
    $('profile-name').textContent = profile.display_name || profile.username;
    $('profile-username').textContent = '@' + profile.username;

    // Verified
    if (profile.is_verified) $('profile-verified').classList.remove('hidden');
    else $('profile-verified').classList.add('hidden');

    // Bio
    $('profile-bio-text').textContent = profile.bio || '';
    const bioLink = $('profile-bio-link');
    if (profile.bio_link) {
      bioLink.href = profile.bio_link.startsWith('http') ? profile.bio_link : 'https://' + profile.bio_link;
      bioLink.textContent = profile.bio_link.replace(/^https?:\/\//, '');
      bioLink.classList.remove('hidden');
    } else bioLink.classList.add('hidden');

    // Actions
    const actions = $('profile-actions');
    actions.innerHTML = '';
    if (isOwn) {
      const editBtn = el('button', 'btn btn--secondary', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit');
      editBtn.addEventListener('click', () => openEditForm(profile));
      actions.appendChild(editBtn);
    } else {
      // Follow / Message buttons
      const msgBtn = el('button', 'btn btn--secondary', '✉ Message');
      msgBtn.addEventListener('click', () => { openConversation(profile); showPage('messages'); });
      actions.appendChild(msgBtn);

      // Check follow status
      supabase.from('follows').select('id').eq('follower_id', state.user?.id).eq('following_id', profile.id).maybeSingle()
        .then(({ data }) => {
          const following = !!data;
          const followBtn = el('button', `btn btn--${following ? 'secondary' : 'primary'}`, following ? 'Following' : 'Follow');
          followBtn.addEventListener('click', () => toggleFollow(profile, followBtn));
          actions.appendChild(followBtn);
        });
    }
  }

  // ── Edit profile form ─────────────────────────
  function openEditForm(profile) {
    $('edit-display-name').value = profile.display_name || '';
    $('edit-bio').value          = profile.bio || '';
    $('edit-bio-link').value     = profile.bio_link || '';
    show('profile-edit-form');
    hide('profile-bio-section');
  }

  $('edit-cancel-btn').addEventListener('click', () => {
    hide('profile-edit-form');
    show('profile-bio-section');
  });

  $('edit-save-btn').addEventListener('click', async () => {
    const updates = {
      display_name: $('edit-display-name').value.trim(),
      bio:          $('edit-bio').value.trim(),
      bio_link:     $('edit-bio-link').value.trim(),
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', state.user.id);
    if (error) { toast('Save failed: ' + error.message); return; }
    state.profile = { ...state.profile, ...updates };
    renderNavProfile();
    hide('profile-edit-form');
    show('profile-bio-section');
    openProfile(null); // reload
    toast('Profile saved!');
  });

  // ── Follow / Unfollow ─────────────────────────
  async function toggleFollow(profile, btn) {
    const { data } = await supabase.from('follows').select('id')
      .eq('follower_id', state.user.id).eq('following_id', profile.id).maybeSingle();

    if (data) {
      await supabase.from('follows').delete().eq('id', data.id);
      btn.textContent = 'Follow';
      btn.className = 'btn btn--primary';
    } else {
      await supabase.from('follows').insert({ follower_id: state.user.id, following_id: profile.id });
      btn.textContent = 'Following';
      btn.className = 'btn btn--secondary';
    }
    // Refresh follower count
    const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id);
    $('stat-followers-num').textContent = fmtNum(count || 0);
  }

  // ── Profile tabs ─────────────────────────────
  $$('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      setProfileTab(name);
      if (name === 'likes' && !state.profileLikes.length) loadProfileLikes(state.profileData?.id);
      if (name === 'media')  renderMediaGrid();
    });
  });

  function setProfileTab(name) {
    state.activeProfileTab = name;
    $$('.profile-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === name);
      t.setAttribute('aria-selected', t.dataset.tab === name);
    });
    $$('.profile-tab-panel').forEach(p => p.classList.add('hidden'));
    $(`panel-${name}`)?.classList.remove('hidden');
  }

  // ── Posts ─────────────────────────────────────
  async function loadProfilePosts(userId) {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles:user_id(display_name,username,avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    state.profilePosts = data || [];
    $('stat-posts-num').textContent = fmtNum(state.profilePosts.length);
    renderPostList('post-list', state.profilePosts);
    renderMediaGrid();
  }

  function renderPostList(containerId, posts) {
    const container = $(containerId);
    container.innerHTML = '';
    if (!posts.length) {
      container.innerHTML = '<p class="empty-label">No posts yet.</p>';
      return;
    }
    for (const post of posts) {
      container.appendChild(buildPostCard(post));
    }
  }

  function buildPostCard(post) {
    const card = el('div', 'post-card');
    const profile = post.profiles || {};
    card.innerHTML = `
      <div class="post-card__header">
        <img class="avatar avatar--md" src="${profile.avatar_url || ''}" alt="${profile.display_name || ''}" />
        <div class="post-card__meta">
          <span class="post-card__name">${profile.display_name || profile.username || ''}</span>
          <span class="post-card__time">${fmtTime(post.created_at)}</span>
        </div>
      </div>
      ${post.content ? `<p class="post-card__content">${post.content}</p>` : ''}
      ${post.media_url && post.media_type === 'image' ? `<img class="post-card__img" src="${post.media_url}" alt="Post image" />` : ''}
      ${post.media_url && post.media_type === 'video' ? `<video class="post-card__img" src="${post.media_url}" controls></video>` : ''}
      <div class="post-card__actions">
        <button class="post-action-btn like-btn" data-id="${post.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>${post.likes_count || 0}</span>
        </button>
        <button class="post-action-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>${post.comments_count || 0}</span>
        </button>
      </div>
    `;

    // Click image for lightbox
    card.querySelector('.post-card__img')?.addEventListener('click', e => {
      openLightbox(e.target.src, 'image');
    });

    // Like btn
    card.querySelector('.like-btn')?.addEventListener('click', () => likePost(post.id, card));

    return card;
  }

  async function likePost(postId, card) {
    if (!state.user) return;
    const { data } = await supabase.from('post_likes').select('id')
      .eq('post_id', postId).eq('user_id', state.user.id).maybeSingle();

    if (data) {
      await supabase.from('post_likes').delete().eq('id', data.id);
      await supabase.from('posts').update({ likes_count: supabase.rpc('decrement', { x: 1 }) }).eq('id', postId);
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: state.user.id });
    }
    const btn = card.querySelector('.like-btn');
    btn?.classList.toggle('liked');
  }

  // ── Media grid ───────────────────────────────
  function renderMediaGrid() {
    const grid = $('media-grid');
    grid.innerHTML = '';
    const mediaPosts = state.profilePosts.filter(p => p.media_url && (p.media_type === 'image' || p.media_type === 'video'));
    if (!mediaPosts.length) {
      grid.innerHTML = '<p class="empty-label">No media yet.</p>';
      return;
    }
    for (const post of mediaPosts) {
      const item = el('div', 'media-grid__item');
      if (post.media_type === 'image') {
        const img = el('img'); img.src = post.media_url; img.alt = ''; img.loading = 'lazy';
        img.addEventListener('click', () => openLightbox(post.media_url, 'image'));
        item.appendChild(img);
      } else {
        const vid = el('video'); vid.src = post.media_url; vid.muted = true;
        vid.addEventListener('click', () => openLightbox(post.media_url, 'video'));
        item.appendChild(vid);
      }
      grid.appendChild(item);
    }
  }

  // ── Likes tab ─────────────────────────────────
  async function loadProfileLikes(userId) {
    if (!userId) return;
    const { data } = await supabase
      .from('post_likes')
      .select('posts(*, profiles:user_id(display_name,username,avatar_url))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    state.profileLikes = (data || []).map(l => l.posts).filter(Boolean);
    renderPostList('likes-list', state.profileLikes);
  }

  // ── Followers / Following modal ───────────────
  $('stat-followers').addEventListener('click', () => openFollowModal('Followers', state.profileData?.id, 'followers'));
  $('stat-following').addEventListener('click', () => openFollowModal('Following', state.profileData?.id, 'following'));
  $('follow-modal-close').addEventListener('click', () => $('follow-modal-backdrop').classList.add('hidden'));
  $('follow-modal-backdrop').addEventListener('click', e => {
    if (e.target === $('follow-modal-backdrop')) $('follow-modal-backdrop').classList.add('hidden');
  });

  async function openFollowModal(title, userId, type) {
    if (!userId) return;
    $('follow-modal-title').textContent = title;
    $('follow-modal-backdrop').classList.remove('hidden');
    const list = $('follow-list');
    list.innerHTML = '<li style="padding:16px;color:var(--text-3);font-size:13px">Loading…</li>';

    let query;
    if (type === 'followers') {
      query = supabase.from('follows').select('profiles:follower_id(id,display_name,username,avatar_url,last_seen)').eq('following_id', userId);
    } else {
      query = supabase.from('follows').select('profiles:following_id(id,display_name,username,avatar_url,last_seen)').eq('follower_id', userId);
    }
    const { data } = await query;
    const people = (data || []).map(d => d.profiles).filter(Boolean);

    list.innerHTML = '';
    if (!people.length) {
      list.innerHTML = '<li style="padding:16px;color:var(--text-3);font-size:13px">Nobody here yet.</li>';
      return;
    }
    for (const p of people) {
      const li = el('li', 'follow-item');
      li.innerHTML = `
        <img class="avatar avatar--md" src="${p.avatar_url || ''}" alt="${p.display_name || p.username}" />
        <div class="follow-item__info">
          <div class="follow-item__name">${p.display_name || p.username}</div>
          <div class="follow-item__handle">@${p.username}</div>
        </div>
      `;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        $('follow-modal-backdrop').classList.add('hidden');
        openProfile(p.id);
      });
      list.appendChild(li);
    }
  }

  // ── Profile search from top nav ───────────────
  async function searchUser(username) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', username.replace(/^@/, ''))
      .maybeSingle();
    if (data) openProfile(data.id);
    else toast('User not found.');
  }

  // ── Realtime: update last_seen + listen for unread ──
  async function heartbeat() {
    if (!state.user) return;
    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', state.user.id);
  }
  setInterval(heartbeat, 60000);
  heartbeat();

  // Realtime unread counter
  supabase.channel('unread_counter').on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'messages',
    filter: `recipient_id=eq.${state.user?.id}`,
  }, () => { loadConversations(); }).subscribe();

})();

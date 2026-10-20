// api.js
// Hardcoded API keys remain per vanilla front-end limitation
const SUPABASE_URL = 'https://xsjexzfbvqorjyjeieem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UGPvFv0u3WQ_RGEt6Z8VLg_PrZcXSuW';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.FluxState = {
  user: null,
  profile: null,
  activeView: 'feed',
  activeChatId: null
};

// Advanced Toast System
function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = '<i class="fa-solid fa-circle-info text-blue"></i>';
  if(type === 'error') icon = '<i class="fa-solid fa-circle-exclamation text-red"></i>';
  if(type === 'success') icon = '<i class="fa-solid fa-circle-check text-green"></i>';
  
  toast.innerHTML = `${icon} <span>${escapeHTML(msg)}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function avatarInitials(name = '') {
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

function setAvatarEl(el, profile) {
  if (!el) return;
  if (profile?.avatar_url) {
    el.style.backgroundImage = `url(${profile.avatar_url})`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = 'none';
    el.textContent = avatarInitials(profile?.display_name || profile?.username);
  }
}

async function uploadFile(bucket, path, file) {
  const { data, error } = await db.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = db.storage.from(bucket).getPublicUrl(data.path);
  return publicUrl;
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

window.FluxApp = {
  switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${name}`)?.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`nav-${name}`)?.classList.add('active');

    FluxState.activeView = name;

    if (name === 'profile') FluxProfile.loadOwn();
    if (name === 'explore') FluxExplore.init();
    if (name === 'chat') FluxChat.loadDMs();
  }
};
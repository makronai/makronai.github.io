const supabaseUrl = 'https://xsjexzfbvqorjyjeieem.supabase.co';
const supabaseKey = 'sb_publishable_UGPvFv0u3WQ_RGEt6Z8VLg_PrZcXSuW';

// FIX: Rename the initialized instance to `supabaseClient` to avoid colliding with the global `supabase` library.
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let observer = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    
    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') checkSession();
    });
});

// --- AUTHENTICATION LOGIC ---

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-status').innerHTML = `<button onclick="handleSignOut()" class="btn-secondary">LOGOUT</button>`;
        mobileMenu.classList.remove('hidden');
        switchView('feed');
        loadFeedOneByOne();
        setupRealtime();
    } else {
        currentUser = null;
        document.getElementById('auth-status').innerHTML = '';
        mobileMenu.classList.add('hidden');
        switchView('auth');
    }
}

async function handleSignUp() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    } else {
        errorEl.style.color = 'var(--acc)';
        errorEl.textContent = "Check your email for the confirmation link!";
        errorEl.classList.remove('hidden');
    }
}

async function handleSignIn() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

async function handleSignOut() {
    await supabaseClient.auth.signOut();
}

// --- FEED & REALTIME LOGIC ---

async function loadFeedOneByOne(lastId = null) {
    if (!currentUser) return;
    
    let query = supabaseClient.from('posts').select('*, profiles(username)').order('created_at', { ascending: false }).limit(1);
    if (lastId) query = query.lt('id', lastId);

    const { data, error } = await query;
    if (data && data.length > 0) {
        renderPost(data[0]);
        observeLastItem(data[0].id);
    }
}

function renderPost(post) {
    const container = document.getElementById('feed-container');
    const el = document.createElement('div');
    el.className = 'card';
    el.id = `post-${post.id}`;
    const authorName = post.profiles ? post.profiles.username : 'Unknown';
    el.innerHTML = `<strong>@${authorName}</strong><p>${post.content}</p>`;
    container.appendChild(el);
}

function observeLastItem(elementId) {
    if (observer) observer.disconnect();
    
    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            loadFeedOneByOne(elementId);
        }
    }, { rootMargin: '100px' });

    setTimeout(() => {
        const el = document.getElementById(`post-${elementId}`);
        if (el) observer.observe(el);
    }, 100);
}

// --- CHAT LOGIC ---

async function sendMessage(content) {
    if (!content.trim()) return;
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    const msgId = crypto.randomUUID();
    renderMessage({ id: msgId, content, status: 'sending', sender_id: currentUser.id });
    
    document.getElementById('msg-input').value = ''; 

    let mediaUrl = null;
    if (file) {
        const { data, error } = await supabaseClient.storage.from('media').upload(`chat/${msgId}`, file, {
            onUploadProgress: (evt) => updateProgressBar((evt.loaded / evt.total) * 100)
        });
        if (data) mediaUrl = data.path;
        fileInput.value = ''; 
    }

    const { error } = await supabaseClient.from('messages').insert([{ 
        id: msgId, 
        chat_id: '00000000-0000-0000-0000-000000000000', 
        content, 
        media_url: mediaUrl,
        sender_id: currentUser.id 
    }]);
    
    if (!error) {
        const msgEl = document.getElementById(`msg-${msgId}`);
        if(msgEl) msgEl.classList.replace('sending', 'sent');
    }
}

function renderMessage(msg) {
    const container = document.getElementById('messages');
    const el = document.createElement('div');
    el.id = `msg-${msg.id}`;
    el.className = `msg ${msg.status || 'sent'} ${msg.sender_id === currentUser?.id ? 'msg-own' : 'msg-other'}`;
    el.innerText = msg.content;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight; 
}

function setupRealtime() {
    if (!currentUser) return;
    
    supabaseClient.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            if (payload.new.sender_id !== currentUser.id) {
                renderMessage(payload.new);
                markAsSeen(payload.new.id);
            }
        })
        .subscribe();
}

async function markAsSeen(msgId) {
    await supabaseClient.from('messages').update({ is_read: true }).eq('id', msgId);
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (msgEl) msgEl.classList.add('seen');
}

function updateProgressBar(pct) {
    const bar = document.querySelector('#upload-progress .bar');
    document.getElementById('upload-progress').classList.remove('hidden');
    bar.style.width = `${pct}%`;
    if (pct >= 100) setTimeout(() => document.getElementById('upload-progress').classList.add('hidden'), 500);
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
}
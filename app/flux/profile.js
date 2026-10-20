// profile.js
window.FluxProfile = {
  async loadOwn() {
    document.getElementById('profile-back-btn').style.display = 'none';
    await this._render(FluxState.user.id, true);
  },

  async openUser(id) {
    if (!id) return;
    FluxApp.switchView('profile');
    document.getElementById('profile-back-btn').style.display = id === FluxState.user.id ? 'none' : 'block';
    await this._render(id, id === FluxState.user.id);
  },

  goBack() { FluxApp.switchView('feed'); },

  async _render(userId, isOwn) {
    const container = document.getElementById('profile-content');
    container.innerHTML = `<div class="p-6 flex col gap-4"><div class="skeleton h-[150px] r-4"></div><div class="skeleton h-6 w-1/3"></div></div>`;

    const { data: p } = await db.from('profiles').select('*').eq('id', userId).single();
    if (!p) return container.innerHTML = `<div class="p-8 text-center text-muted">User not found</div>`;

    const { count } = await db.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId).is('parent_id', null);
    
    document.getElementById('profile-view-name').textContent = p.display_name || p.username;
    document.getElementById('profile-view-post-count').textContent = `${count||0} posts`;

    const bg = p.customization?.theme_gradient ? `linear-gradient(135deg, ${p.customization.theme_gradient[0]}, ${p.customization.theme_gradient[1]})` : 'var(--surface)';

    container.innerHTML = `
      <div class="profile-banner" style="background:${bg}"></div>
      <div class="profile-header-info">
        <div class="profile-avatar-wrap">
          <div class="avatar avatar-xl presence ${p.presence||'offline'} border-4 border-black" style="${p.avatar_url?`background-image:url(${p.avatar_url})`:''}">${p.avatar_url?'':avatarInitials(p.display_name||p.username)}</div>
          <div class="flex gap-2">
            ${isOwn ? `<button class="btn btn-ghost" onclick="FluxProfile.openEditModal()"><i class="fa-solid fa-pen"></i> Edit Profile</button>` 
                    : `<button class="btn btn-blue" onclick="FluxChat.startDM('${p.id}')"><i class="fa-solid fa-envelope"></i> Message</button>`}
          </div>
        </div>
        <div class="fw-7 text-2xl">${escapeHTML(p.display_name || p.username)}</div>
        <div class="text-muted text-base mb-3">@${p.username}</div>
        ${p.status_text || p.status_emoji ? `<div class="flex items-center gap-2 mb-3 bg-surface border p-2 r-3 inline-flex"><span class="text-lg">${escapeHTML(p.status_emoji||'')}</span> <span class="text-sm font-medium">${escapeHTML(p.status_text||'')}</span></div>` : ''}
        ${p.bio ? `<p class="text-base mb-4">${escapeHTML(p.bio)}</p>` : ''}
      </div>
      <div class="tab-bar"><button class="tab active">Posts</button></div>
      <div id="profile-posts-stream"></div>
    `;

    const { data: posts } = await db.from('posts').select('*, profiles(*), reactions(*)').eq('author_id', userId).is('parent_id', null).order('created_at', { ascending: false });
    const stream = document.getElementById('profile-posts-stream');
    stream.innerHTML = posts?.length ? posts.map(pt => FluxFeed._postHTML(pt)).join('') : `<div class="p-8 text-center text-muted">No posts yet.</div>`;
  },

  openEditModal() {
    const p = FluxState.profile;
    if(!p) return;
    document.getElementById('edit-display-name').value = p.display_name||'';
    document.getElementById('edit-username').value = p.username||'';
    document.getElementById('edit-bio').value = p.bio||'';
    document.getElementById('edit-status-emoji').value = p.status_emoji||'';
    document.getElementById('edit-status-text').value = p.status_text||'';
    document.getElementById('edit-profile-modal').classList.remove('hidden');
  },
  
  closeEditModal() { document.getElementById('edit-profile-modal').classList.add('hidden'); },

  async saveProfile() {
    const updates = {
      display_name: document.getElementById('edit-display-name').value.trim(),
      username: document.getElementById('edit-username').value.trim(),
      bio: document.getElementById('edit-bio').value.trim(),
      status_emoji: document.getElementById('edit-status-emoji').value.trim(),
      status_text: document.getElementById('edit-status-text').value.trim(),
      updated_at: new Date().toISOString()
    };
    
    if(!updates.username.match(/^[a-z0-9_]+$/i)) return showToast('Invalid username format', 'error');
    
    const { error } = await db.from('profiles').update(updates).eq('id', FluxState.user.id);
    if(error) return showToast(error.message, 'error');
    
    FluxState.profile = { ...FluxState.profile, ...updates };
    this.closeEditModal(); showToast('Profile updated', 'success');
    this.loadOwn();
  }
};

window.FluxExplore = {
  _timer: null,
  init() { this.search(''); },
  search(q) { clearTimeout(this._timer); this._timer = setTimeout(() => this._fetch(q), 300); },
  async _fetch(q) {
    const c = document.getElementById('explore-stream');
    c.innerHTML = `<div class="p-6 flex justify-center"><i class="fa-solid fa-circle-notch fa-spin text-blue text-2xl"></i></div>`;
    
    let query = db.from('posts').select('*, profiles(*), reactions(*)').is('parent_id', null).order('created_at', { ascending: false }).limit(20);
    if(q.trim()) query = query.ilike('content', `%${q}%`);
    
    const { data } = await query;
    c.innerHTML = data?.length ? data.map(p => FluxFeed._postHTML(p)).join('') : `<div class="p-8 text-center text-muted">No results found.</div>`;
  }
};
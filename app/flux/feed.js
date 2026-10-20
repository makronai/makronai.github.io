// feed.js
window.FluxFeed = {
  _observer: null, _lastPostId: null, _loading: false, _tab: 'for-you',
  _replyTo: null, _mediaFiles: { post: null, modal: null },

  init() {
    this.loadFeed(true);
    this._subscribeRealtime();
    this._loadSuggested();
  },

  setTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.loadFeed(true);
  },

  async loadFeed(reset = false) {
    if (this._loading) return;
    this._loading = true;
    const container = document.getElementById('feed-stream');
    if (reset) { container.innerHTML = ''; this._lastPostId = null; }

    if (!this._lastPostId) container.innerHTML += this._skeletonHTML().repeat(3);

    let query = db.from('posts').select('*, profiles(id, username, display_name, avatar_url, presence), reactions(emoji, user_id)')
      .is('parent_id', null).eq('post_type', 'tweet').order('created_at', { ascending: false }).limit(15);
    
    if (this._lastPostId) query = query.lt('id', this._lastPostId);

    const { data } = await query;
    container.querySelectorAll('.skeleton').forEach(el => el.closest('.post-card')?.remove());

    if (data?.length) {
      data.forEach(post => container.insertAdjacentHTML('beforeend', this._postHTML(post)));
      this._lastPostId = data[data.length - 1].id; 
      this._observeLastPost(container.lastElementChild);
    } else if (!this._lastPostId) {
      container.innerHTML = `<div class="flex col items-center justify-center p-10 text-muted"><i class="fa-regular fa-folder-open text-4xl mb-3"></i><span class="fw-6">Nothing here yet</span></div>`;
    }
    this._loading = false;
  },

  _observeLastPost(el) {
    if (this._observer) this._observer.disconnect();
    if (!el) return;
    this._observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) this.loadFeed();
    }, { rootMargin: '200px' });
    this._observer.observe(el);
  },

  _subscribeRealtime() {
    db.channel('flux-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async payload => {
      if (payload.new.sender_id === FluxState.user?.id || payload.new.parent_id) return;
      const { data } = await db.from('posts').select('*, profiles(*), reactions(*)').eq('id', payload.new.id).single();
      if (data) {
        document.getElementById('feed-stream').insertAdjacentHTML('afterbegin', this._postHTML(data));
      }
    }).subscribe();
  },

  _postHTML(post) {
    const p = post.profiles || {};
    const name = p.display_name || p.username || 'Unknown';
    const isOwn = FluxState.user?.id === p.id;
    const time = timeAgo(post.created_at);
    
    let mediaHTML = '';
    (post.media_attachments || []).forEach(att => {
      if (att.type === 'image') mediaHTML += `<img src="${att.url}" class="w-full r-3 mt-3 border" style="max-height:400px;object-fit:cover;">`;
    });

    const likes = (post.reactions || []).filter(r => r.emoji === 'like');
    const isLiked = likes.some(r => r.user_id === FluxState.user?.id);

    return `
    <article class="post-card fade-in" data-post-id="${post.id}" onclick="FluxFeed.openThread('${post.id}')">
      <div class="flex gap-3 items-start">
        <div class="avatar avatar-md presence ${p.presence||'offline'}" style="${p.avatar_url ? `background-image:url(${p.avatar_url})` : ''}">${p.avatar_url?'':avatarInitials(name)}</div>
        <div class="flex col flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 truncate">
              <span class="fw-7 text-base hover:underline" onclick="event.stopPropagation();FluxProfile.openUser('${p.id}')">${escapeHTML(name)}</span>
              <span class="text-sm text-muted">@${p.username} · ${time}</span>
            </div>
            ${isOwn ? `
              <div class="relative" onclick="event.stopPropagation()">
                <button class="btn-icon" onclick="this.nextElementSibling.classList.toggle('hidden')"><i class="fa-solid fa-ellipsis"></i></button>
                <div class="dropdown hidden">
                  <button class="dropdown-item danger" onclick="FluxFeed.deletePost('${post.id}')"><i class="fa-regular fa-trash-can"></i> Delete Post</button>
                </div>
              </div>` : ''}
          </div>
          <p class="post-body">${escapeHTML(post.content || '')}</p>
          ${mediaHTML}
          <div class="post-actions" onclick="event.stopPropagation()">
            <button class="post-action" onclick="FluxFeed.openReply('${post.id}', '${escapeHTML(p.username)}')">
              <i class="fa-regular fa-comment"></i> <span>Reply</span>
            </button>
            <button class="post-action ${isLiked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="FluxFeed.toggleLike('${post.id}')">
              <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i> <span id="like-count-${post.id}">${likes.length || ''}</span>
            </button>
            <button class="post-action hover-blue" onclick="FluxFeed.sharePost('${post.id}')"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
          </div>
        </div>
      </div>
    </article>`;
  },

  _skeletonHTML() {
    return `<div class="post-card flex gap-3"><div class="skeleton avatar-md"></div><div class="flex col flex-1 gap-2"><div class="skeleton h-4 w-1/3"></div><div class="skeleton h-4 w-full"></div></div></div>`;
  },

  async createPost(isModal = false) {
    const context = isModal ? 'modal' : 'post';
    const input = document.getElementById(`${context}-input`);
    const content = input.value.trim();
    if (!content && !this._mediaFiles[context]) return showToast('Post cannot be empty', 'error');

    let attachments = [];
    if (this._mediaFiles[context]) {
      try {
        const file = this._mediaFiles[context];
        const url = await uploadFile('media', `posts/${FluxState.user.id}/${Date.now()}_${file.name}`, file);
        attachments.push({ type: 'image', url });
      } catch(e) { return showToast('Media upload failed', 'error'); }
    }

    const { error } = await db.from('posts').insert([{
      author_id: FluxState.user.id, content, parent_id: this._replyTo?.id || null, media_attachments: attachments
    }]);

    if (error) return showToast(error.message, 'error');
    
    input.value = '';
    this.clearMedia(context);
    if (isModal) this.closeComposer();
    this._replyTo = null;
    showToast('Posted successfully!', 'success');
    if (!isModal) this.loadFeed(true);
  },

  async toggleLike(postId) {
    const uid = FluxState.user.id;
    const { data } = await db.from('reactions').select('id').eq('post_id', postId).eq('user_id', uid).eq('emoji', 'like').single();
    
    if (data) await db.from('reactions').delete().eq('id', data.id);
    else await db.from('reactions').insert([{ post_id: postId, user_id: uid, emoji: 'like' }]);
    
    const { data: reactions } = await db.from('reactions').select('emoji').eq('post_id', postId).eq('emoji', 'like');
    const isLiked = !data;
    const btn = document.getElementById(`like-btn-${postId}`);
    if (btn) {
      btn.className = `post-action ${isLiked ? 'liked' : ''}`;
      btn.innerHTML = `<i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i> <span id="like-count-${postId}">${reactions.length || ''}</span>`;
    }
  },

  async deletePost(id) {
    if(!confirm('Delete this post?')) return;
    await db.from('posts').delete().eq('id', id).eq('author_id', FluxState.user.id);
    document.querySelector(`[data-post-id="${id}"]`)?.remove();
    showToast('Post deleted', 'success');
  },

  openReply(id, username) {
    this._replyTo = { id, username };
    this.openComposer();
    const el = document.getElementById('modal-reply-to');
    el.innerHTML = `<i class="fa-solid fa-reply"></i> Replying to @${username}`;
    el.classList.remove('hidden');
  },

  async openThread(id) {
    const { data: post } = await db.from('posts').select('*, profiles(*), reactions(*)').eq('id', id).single();
    const { data: replies } = await db.from('posts').select('*, profiles(*), reactions(*)').eq('parent_id', id).order('created_at', { ascending: true });
    
    document.querySelectorAll('.thread-expansion').forEach(e => e.remove());
    const el = document.querySelector(`[data-post-id="${id}"]`);
    if (!el) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'thread-expansion bg-surface border-b p-4 pl-12';
    wrapper.innerHTML = `<div class="text-xs text-muted mb-3"><i class="fa-solid fa-comments"></i> ${(replies||[]).length} replies</div>` + 
                        (replies||[]).map(r => this._postHTML(r)).join('');
    el.insertAdjacentElement('afterend', wrapper);
  },

  openComposer() {
    document.getElementById('composer-modal').classList.remove('hidden');
    document.getElementById('modal-post-input').focus();
    document.getElementById('modal-post-input').oninput = function() {
      document.getElementById('modal-char-count').textContent = 280 - this.value.length;
    };
  },
  
  closeComposer() {
    document.getElementById('composer-modal').classList.add('hidden');
    document.getElementById('modal-post-input').value = '';
    document.getElementById('modal-reply-to').classList.add('hidden');
    this.clearMedia('modal');
    this._replyTo = null;
  },

  previewMedia(input, ctx) {
    const file = input.files[0];
    if(!file) return;
    this._mediaFiles[ctx] = file;
    document.getElementById(`${ctx}-media-img`).src = URL.createObjectURL(file);
    document.getElementById(`${ctx}-media-preview`).classList.remove('hidden');
  },
  
  clearMedia(ctx) {
    this._mediaFiles[ctx] = null;
    document.getElementById(`${ctx}-media-preview`).classList.add('hidden');
    document.getElementById(`${ctx}-media-input`).value = '';
  },

  sharePost(id) { navigator.clipboard.writeText(`${window.location.origin}/post/${id}`); showToast('Link copied!', 'success'); },

  async _loadSuggested() {
    const { data } = await db.from('profiles').select('*').neq('id', FluxState.user?.id).limit(5);
    const c = document.getElementById('suggested-users');
    if (!c || !data) return;
    c.innerHTML = data.map(u => `
      <div class="flex gap-3 items-center cursor-pointer hover:bg-surface p-2 r-3 transition" onclick="FluxProfile.openUser('${u.id}')">
        <div class="avatar avatar-md" style="${u.avatar_url ? `background-image:url(${u.avatar_url})` : ''}">${u.avatar_url?'':avatarInitials(u.display_name||u.username)}</div>
        <div class="flex col flex-1 min-w-0">
          <span class="fw-6 text-sm truncate">${escapeHTML(u.display_name||u.username)}</span>
          <span class="text-xs text-muted truncate">@${u.username}</span>
        </div>
      </div>`).join('');
  }
};
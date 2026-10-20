// chat.js
window.FluxChat = {
  _activeRoomId: null, _activePartnerId: null, _realtimeChannel: null,

  async init() {
    await this.loadDMs();
    this._subscribeRealtime();
  },

  async loadDMs() {
    const uid = FluxState.user?.id;
    if (!uid) return;

    const { data: participations } = await db.from('chat_participants').select('chat_id').eq('user_id', uid);
    if (!participations?.length) return this._renderDMList([]);

    const rooms = await Promise.all(participations.map(async p => {
      const { data: parts } = await db.from('chat_participants').select('user_id, profiles(*)').eq('chat_id', p.chat_id);
      const { data: lastMsg } = await db.from('messages').select('*').eq('chat_id', p.chat_id).order('created_at', { ascending: false }).limit(1).single();
      const { count: unread } = await db.from('messages').select('*', { count: 'exact', head: true }).eq('chat_id', p.chat_id).eq('is_read', false).neq('sender_id', uid);
      return { room: p.chat_id, partner: parts?.find(x => x.user_id !== uid)?.profiles, lastMsg, unread: unread || 0 };
    }));

    this._renderDMList(rooms.filter(r => r.partner).sort((a,b) => new Date(b.lastMsg?.created_at||0) - new Date(a.lastMsg?.created_at||0)));
  },

  _renderDMList(rooms) {
    const container = document.getElementById('dm-list');
    if (!rooms.length) return container.innerHTML = `<div class="p-6 text-center text-muted text-sm">No messages yet.</div>`;
    
    let totalUnread = 0;
    container.innerHTML = rooms.map(r => {
      totalUnread += r.unread;
      const p = r.partner;
      const active = r.room === this._activeRoomId ? 'active' : '';
      return `
        <div class="dm-item ${active}" onclick="FluxChat.openRoom('${r.room}', '${p.id}')">
          <div class="avatar avatar-md presence ${p.presence||'offline'}" style="${p.avatar_url ? `background-image:url(${p.avatar_url})` : ''}">${p.avatar_url?'':avatarInitials(p.display_name||p.username)}</div>
          <div class="flex col flex-1 min-w-0">
            <div class="flex justify-between items-center">
              <span class="dm-name truncate">${escapeHTML(p.display_name||p.username)}</span>
              <span class="text-xs text-muted">${r.lastMsg ? timeAgo(r.lastMsg.created_at) : ''}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="dm-preview truncate">${escapeHTML(r.lastMsg?.content || 'No messages')}</span>
              ${r.unread > 0 ? `<span class="badge-dot">${r.unread}</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    const badge = document.getElementById('nav-badge-chat');
    badge.textContent = totalUnread;
    badge.classList.toggle('hidden', totalUnread === 0);
  },

  async openRoom(roomId, partnerId) {
    this._activeRoomId = roomId; this._activePartnerId = partnerId;
    document.querySelectorAll('.dm-item').forEach(el => el.classList.remove('active'));
    document.getElementById('chat-empty').classList.add('hidden');
    document.getElementById('chat-active').classList.remove('hidden');

    const { data: p } = await db.from('profiles').select('*').eq('id', partnerId).single();
    if(p) {
      setAvatarEl(document.getElementById('chat-header-avatar'), p);
      document.getElementById('chat-header-name').textContent = p.display_name || p.username;
      document.getElementById('chat-header-status').innerHTML = `${p.status_emoji||''} ${escapeHTML(p.status_text||p.presence)}`.trim();
    }

    await this.loadMessages(roomId);
    await db.from('messages').update({ is_read: true }).eq('chat_id', roomId).neq('sender_id', FluxState.user.id);
    this.loadDMs();
    setTimeout(()=>document.getElementById('msg-input')?.focus(), 100);
  },

  async loadMessages(roomId) {
    const { data } = await db.from('messages').select('*, profiles(*)').eq('chat_id', roomId).order('created_at', { ascending: true });
    const stream = document.getElementById('msg-stream');
    stream.innerHTML = data?.length ? data.map(m => this._bubbleHTML(m)).join('') : `<div class="p-8 text-center text-muted">Say hello!</div>`;
    stream.scrollTop = stream.scrollHeight;
  },

  _bubbleHTML(msg) {
    const isOwn = msg.sender_id === FluxState.user.id;
    return `
    <div class="msg-row ${isOwn ? 'own' : 'other'}">
      <div class="flex col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%]">
        <div class="bubble ${isOwn ? 'own' : 'other'}">${escapeHTML(msg.content)}</div>
        <div class="msg-meta">${timeAgo(msg.created_at)} ${isOwn ? (msg.is_read ? '<i class="fa-solid fa-check-double text-blue"></i>' : '<i class="fa-solid fa-check"></i>') : ''}</div>
      </div>
    </div>`;
  },

  async sendMessage() {
    const input = document.getElementById('msg-input');
    const content = input.value.trim();
    if (!content || !this._activeRoomId) return;
    input.value = ''; input.style.height = 'auto';

    // Optimistic UI
    const stream = document.getElementById('msg-stream');
    stream.insertAdjacentHTML('beforeend', this._bubbleHTML({ sender_id: FluxState.user.id, content, created_at: new Date(), is_read: false }));
    stream.scrollTop = stream.scrollHeight;

    await db.from('messages').insert([{ chat_id: this._activeRoomId, sender_id: FluxState.user.id, content }]);
  },

  _subscribeRealtime() {
    if(this._realtimeChannel) this._realtimeChannel.unsubscribe();
    this._realtimeChannel = db.channel('chat-room').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      if(payload.new.chat_id === this._activeRoomId && payload.new.sender_id !== FluxState.user.id) {
        document.getElementById('msg-stream').insertAdjacentHTML('beforeend', this._bubbleHTML(payload.new));
        document.getElementById('msg-stream').scrollTop = document.getElementById('msg-stream').scrollHeight;
        db.from('messages').update({ is_read: true }).eq('id', payload.new.id);
      }
      this.loadDMs();
    }).subscribe();
  },

  openNewDM() { document.getElementById('new-dm-modal').classList.remove('hidden'); },
  closeNewDM() { document.getElementById('new-dm-modal').classList.add('hidden'); },
  viewPartnerProfile() { if(this._activePartnerId) FluxProfile.openUser(this._activePartnerId); },

  async searchUsers(q) {
    const c = document.getElementById('user-search-results');
    if(q.length < 2) return c.innerHTML = '';
    const { data } = await db.from('profiles').select('*').ilike('username', `%${q}%`).neq('id', FluxState.user.id).limit(8);
    c.innerHTML = (data||[]).map(u => `
      <div class="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface r-3" onclick="FluxChat.startDM('${u.id}')">
        <div class="avatar avatar-sm" style="${u.avatar_url?`background-image:url(${u.avatar_url})`:''}">${u.avatar_url?'':avatarInitials(u.username)}</div>
        <div class="flex col"><span class="fw-6">${escapeHTML(u.display_name||u.username)}</span><span class="text-xs text-muted">@${u.username}</span></div>
      </div>`).join('');
  },

  async startDM(partnerId) {
    const uid = FluxState.user.id;
    this.closeNewDM(); FluxApp.switchView('chat');
    
    const { data: existing } = await db.from('chat_participants').select('chat_id').eq('user_id', uid);
    let shared = null;
    for (const p of (existing||[])) {
      const { data } = await db.from('chat_participants').select('user_id').eq('chat_id', p.chat_id);
      if(data?.some(x => x.user_id === partnerId) && data.length === 2) { shared = p.chat_id; break; }
    }

    if(!shared) {
      const { data: room } = await db.from('chat_rooms').insert([{}]).select().single();
      shared = room.id;
      await db.from('chat_participants').insert([{ chat_id: shared, user_id: uid }, { chat_id: shared, user_id: partnerId }]);
    }
    await this.loadDMs(); await this.openRoom(shared, partnerId);
  }
};
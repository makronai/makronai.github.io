/* ── Power App ── */
'use strict';

// ── State ──
const S = {
  peer: null,
  myId: null,
  myName: 'Anonymous',
  localStream: null,
  screenStream: null,
  connections: new Map(), // peerId → { data, call, stream }
  micOn: true,
  camOn: true,
  screenOn: false,
  chatOpen: false,
  sidebarOpen: true,
  currentMicId: null,
  currentCamId: null,
  pingTimers: new Map(),
  pingStart: new Map(),
  pings: new Map(),
  messageGroups: new Map(), // peerId → last group el
};

// ── QR libs loaded lazily ──
let qrLoaded = false;

// ── DOM shortcuts ──
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// ── Toast ──
function toast(msg, type = 'info', duration = 4000) {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
  const t = el('div', `toast ${type}`);
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 200); }, duration);
}

// ── Generate ID ──
function genId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

// ── Init PeerJS ──
function initPeer(id) {
  const config = {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Cloudflare worker TURN goes here if configured
        // { urls: 'turn:your-worker.workers.dev:3478', username: 'power', credential: 'power' }
      ]
    }
  };
  return new Peer(id || undefined, config);
}

// ── Get user media ──
async function getMedia(audio = true, video = true) {
  const constraints = {
    audio: audio ? (S.currentMicId ? { deviceId: { exact: S.currentMicId } } : true) : false,
    video: video ? (S.currentCamId ? { deviceId: { exact: S.currentCamId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 } }) : false,
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    toast(`Media error: ${e.message}`, 'warn');
    try { return await navigator.mediaDevices.getUserMedia({ audio, video: false }); } catch (_) {}
    return new MediaStream();
  }
}

// ── Merge streams for call ──
function buildOutStream() {
  const tracks = [];
  if (S.screenStream) {
    S.screenStream.getVideoTracks().forEach(t => tracks.push(t));
    if (S.localStream) S.localStream.getAudioTracks().forEach(t => tracks.push(t));
  } else if (S.localStream) {
    S.localStream.getTracks().forEach(t => tracks.push(t));
  }
  return new MediaStream(tracks);
}

// ── Landing ──
function setupLanding() {
  const myId = genId();
  $('my-id-display').textContent = myId;
  S.myId = myId;

  $('copy-id-btn').onclick = () => { navigator.clipboard.writeText(myId); toast('ID copied!', 'success'); };
  $('copy-link-btn').onclick = () => {
    const link = location.origin + location.pathname + '?id=' + myId;
    navigator.clipboard.writeText(link);
    toast('Link copied!', 'success');
  };

  $('show-qr-btn').onclick = () => { toggleQR(myId); };

  $('scan-qr-btn').onclick = startQRScan;
  $('stop-scan-btn').onclick = stopQRScan;

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
    };
  });

  $('go-host-btn').onclick = () => {
    const name = $('display-name-create').value.trim() || 'Anonymous';
    S.myName = name;
    enterRoom(myId);
  };

  $('go-join-btn').onclick = () => {
    const peerId = $('peer-id-input').value.trim();
    const name = $('display-name-join').value.trim() || 'Anonymous';
    S.myName = name;
    if (!peerId) { toast('Enter a peer ID to join', 'warn'); return; }
    enterRoom(null, peerId);
  };

  // Auto-join from URL
  const params = new URLSearchParams(location.search);
  const targetId = params.get('id') || params.get('join');
  if (targetId) {
    $('peer-id-input').value = targetId;
    document.querySelectorAll('.tab')[1].click();
    toast(`Invite detected. Enter your name and join!`, 'info');
  }
}

// ── QR Generation ──
async function toggleQR(text) {
  const box = $('qr-container');
  if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
  box.innerHTML = '';
  box.classList.remove('hidden');
  await loadQRLib();
  try {
    new QRCode(box, { text: location.origin + location.pathname + '?id=' + text, width: 180, height: 180, colorDark: '#000', colorLight: '#fff' });
  } catch (e) { box.textContent = 'QR unavailable'; }
}

async function loadQRLib() {
  if (qrLoaded) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => { qrLoaded = true; res(); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── QR Scanner ──
let scanStream = null, scanInterval = null;
async function startQRScan() {
  $('qr-scanner-box').classList.remove('hidden');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = $('qr-video');
    video.srcObject = scanStream;
    await loadQRLib();
    // Simple frame capture for QR
    await new Promise(r => video.onloadedmetadata = r);
    const canvas = $('qr-canvas');
    const ctx = canvas.getContext('2d');
    scanInterval = setInterval(() => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      try {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Basic URL detection via jsQR if loaded
        if (window.jsQR) {
          const code = jsQR(img.data, img.width, img.height);
          if (code) {
            stopQRScan();
            const url = new URL(code.data);
            const id = url.searchParams.get('id') || url.searchParams.get('join') || url.pathname.split('/').pop();
            if (id) { $('peer-id-input').value = id; toast('QR scanned!', 'success'); }
          }
        }
      } catch (_) {}
    }, 500);
    // Load jsQR
    if (!window.jsQR) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
      document.head.appendChild(s);
    }
  } catch (e) { toast('Camera access denied for QR scan', 'error'); $('qr-scanner-box').classList.add('hidden'); }
}

function stopQRScan() {
  clearInterval(scanInterval);
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  $('qr-scanner-box').classList.add('hidden');
}

// ── Enter Room ──
async function enterRoom(hostId, joinId = null) {
  $('landing').classList.remove('active');
  $('room').classList.add('active');

  S.localStream = await getMedia(true, true);
  const sv = $('self-video');
  sv.srcObject = S.localStream;
  sv.play().catch(() => {});
  updateSelfTile();

  $('self-name').textContent = S.myName;

  S.peer = initPeer(hostId);

  S.peer.on('open', id => {
    S.myId = id;
    $('room-my-id').textContent = id;
    $('room-copy-id').onclick = () => { navigator.clipboard.writeText(id); toast('ID copied!', 'success'); };
    updateConnStatus('Ready');

    if (joinId) connectToPeer(joinId);

    startPingLoop();
  });

  S.peer.on('error', e => {
    toast(`Connection error: ${e.type}`, 'error');
    updateConnStatus('Error');
  });

  S.peer.on('connection', dc => handleDataConn(dc));
  S.peer.on('call', call => {
    call.answer(buildOutStream());
    handleCall(call, call.peer);
  });

  setupRoomUI();
}

// ── Connect to peer ──
function connectToPeer(peerId) {
  if (S.connections.has(peerId)) return;
  S.connections.set(peerId, {});
  updateConnStatus('Connecting…');

  const dc = S.peer.connect(peerId, { reliable: true, metadata: { name: S.myName } });
  handleDataConn(dc);

  setTimeout(() => {
    const call = S.peer.call(peerId, buildOutStream(), { metadata: { name: S.myName } });
    handleCall(call, peerId);
  }, 600);
}

// ── Data connection ──
function handleDataConn(dc) {
  const peerId = dc.peer;
  const existing = S.connections.get(peerId) || {};
  S.connections.set(peerId, { ...existing, data: dc });

  dc.on('open', () => {
    dc.send(JSON.stringify({ type: 'hello', name: S.myName, id: S.myId }));
    updatePeersCount();
  });

  dc.on('data', raw => {
    let msg;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { return; }
    handleMessage(peerId, msg);
  });

  dc.on('close', () => removePeer(peerId));
  dc.on('error', e => toast(`Data channel error: ${e.message}`, 'error'));
}

// ── Media call ──
function handleCall(call, peerId) {
  const existing = S.connections.get(peerId) || {};
  S.connections.set(peerId, { ...existing, call });

  call.on('stream', stream => {
    existing.stream = stream;
    S.connections.set(peerId, { ...S.connections.get(peerId), stream });
    addVideoTile(peerId, stream);
  });

  call.on('close', () => removePeer(peerId));
  call.on('error', e => toast(`Call error: ${e.message}`, 'error'));
}

// ── Message handler ──
function handleMessage(peerId, msg) {
  switch (msg.type) {
    case 'hello': {
      const conn = S.connections.get(peerId) || {};
      conn.name = msg.name;
      S.connections.set(peerId, conn);
      addParticipant(peerId, msg.name);
      systemMsg(`${msg.name} joined the room`);
      toast(`${msg.name} joined`, 'info', 2500);
      break;
    }
    case 'chat': addChatMsg(peerId, S.connections.get(peerId)?.name || 'Peer', msg.text); break;
    case 'file': receiveFile(peerId, msg); break;
    case 'ping': {
      const conn = S.connections.get(peerId);
      if (conn?.data) conn.data.send(JSON.stringify({ type: 'pong', id: msg.id }));
      break;
    }
    case 'pong': {
      const start = S.pingStart.get(msg.id);
      if (start) { const rtt = Math.round(performance.now() - start); S.pings.set(peerId, rtt); updatePingUI(peerId, rtt); S.pingStart.delete(msg.id); }
      break;
    }
    case 'media-state': {
      const conn = S.connections.get(peerId);
      if (conn) { conn.micOn = msg.micOn; conn.camOn = msg.camOn; updateTileIndicators(peerId); }
      break;
    }
    case 'bye': removePeer(peerId); break;
  }
}

// ── Add video tile ──
function addVideoTile(peerId, stream) {
  const existing = document.getElementById('tile-' + peerId);
  if (existing) { existing.querySelector('video').srcObject = stream; return; }

  const conn = S.connections.get(peerId);
  const name = conn?.name || peerId;

  const tile = el('div', 'video-tile');
  tile.id = 'tile-' + peerId;
  tile.innerHTML = `
    <div class="avatar-placeholder"><div class="big-avatar">${name[0].toUpperCase()}</div></div>
    <video autoplay playsinline></video>
    <div class="tile-overlay">
      <span class="tile-name">${name}</span>
      <div class="tile-indicators">
        <span class="indicator" id="ind-mic-${peerId}">🎙</span>
        <span class="indicator" id="ind-cam-${peerId}">📷</span>
      </div>
    </div>`;
  const video = tile.querySelector('video');
  video.srcObject = stream;
  video.play().catch(() => {});
  video.onloadedmetadata = () => { tile.querySelector('.avatar-placeholder').style.display = 'none'; };

  $('video-grid').appendChild(tile);
  updateGridLayout();

  // Speaking detection
  try {
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser(); an.fftSize = 256;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    setInterval(() => {
      an.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      tile.classList.toggle('speaking', avg > 8);
    }, 200);
  } catch (_) {}
}

function removePeer(peerId) {
  const conn = S.connections.get(peerId);
  if (!conn) return;
  const name = conn.name || peerId;
  if (conn.call) try { conn.call.close(); } catch (_) {}
  if (conn.data) try { conn.data.close(); } catch (_) {}
  S.connections.delete(peerId);
  S.pings.delete(peerId);

  const tile = document.getElementById('tile-' + peerId);
  if (tile) tile.remove();
  const pEl = document.getElementById('p-' + peerId);
  if (pEl) pEl.remove();
  updateGridLayout();
  updatePeersCount();
  systemMsg(`${name} left the room`);
  toast(`${name} left`, 'warn', 2500);
}

// ── Participant list ──
function addParticipant(peerId, name) {
  if (document.getElementById('p-' + peerId)) return;
  const hue = Math.abs(peerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  const p = el('div', 'participant');
  p.id = 'p-' + peerId;
  p.innerHTML = `
    <div class="avatar" style="background:hsl(${hue},60%,45%)">${name[0].toUpperCase()}</div>
    <div class="p-info"><div class="p-name">${name}</div><div class="p-ping" id="ping-${peerId}">— ms</div></div>
    <div class="p-icons"><span class="p-icon" id="pi-mic-${peerId}">🎙</span><span class="p-icon" id="pi-cam-${peerId}">📷</span></div>`;
  $('participants-list').appendChild(p);
  updatePeersCount();
}

function updatePingUI(peerId, rtt) {
  const el = document.getElementById('ping-' + peerId);
  if (el) el.textContent = rtt + ' ms';
  if (peerId === S.myId) { $('ping-val').textContent = rtt + ' ms'; $('ping-val').className = 'mono ' + (rtt < 80 ? 'green' : rtt < 200 ? 'yellow' : 'red'); }
}

function updateTileIndicators(peerId) {
  const conn = S.connections.get(peerId);
  if (!conn) return;
  const mi = document.getElementById('ind-mic-' + peerId);
  const ci = document.getElementById('ind-cam-' + peerId);
  if (mi) mi.classList.toggle('off', !conn.micOn);
  if (ci) ci.classList.toggle('off', !conn.camOn);
}

function updatePeersCount() { $('peers-count').textContent = S.connections.size; }
function updateConnStatus(s) { $('conn-status').textContent = s; }

// ── Grid layout ──
function updateGridLayout() {
  const grid = $('video-grid');
  const n = grid.children.length;
  grid.className = 'video-grid';
  if (n === 1) grid.classList.add('solo');
  else if (n === 2) grid.classList.add('duo');
  else if (n <= 4) grid.classList.add('quad');
  else grid.classList.add('many');
}

// ── Self tile ──
function updateSelfTile() {
  const sv = $('self-video');
  const ph = $('self-tile').querySelector('.avatar-placeholder') || (() => {
    const d = el('div', 'avatar-placeholder');
    d.innerHTML = `<div class="big-avatar">${S.myName[0].toUpperCase()}</div>`;
    $('self-tile').insertBefore(d, sv);
    return d;
  })();
  if (!$('self-tile').querySelector('.avatar-placeholder')) {
    const d = el('div', 'avatar-placeholder');
    d.innerHTML = `<div class="big-avatar">${S.myName[0].toUpperCase()}</div>`;
    $('self-tile').insertBefore(d, sv);
  }
  sv.onloadedmetadata = () => {
    const p = $('self-tile').querySelector('.avatar-placeholder');
    if (p) p.style.display = 'none';
  };
}

// ── Controls ──
function setupRoomUI() {
  // Mic
  $('mic-btn').onclick = toggleMic;
  $('mic-arrow').onclick = (e) => openDeviceMenu('audio', e);
  // Cam
  $('cam-btn').onclick = toggleCam;
  $('cam-arrow').onclick = (e) => openDeviceMenu('video', e);
  // Screen
  $('screen-btn').onclick = toggleScreen;
  // Chat
  $('chat-btn').onclick = toggleChat;
  $('close-chat-btn').onclick = toggleChat;
  $('end-btn').onclick = leaveRoom;
  $('leave-btn').onclick = leaveRoom;
  // Layout
  $('layout-btn').onclick = cycleLayout;
  // Sidebar toggle (mobile)
  $('sidebar-toggle').onclick = () => {
    const sb = document.querySelector('.sidebar');
    sb.classList.toggle('open');
    sb.classList.toggle('collapsed');
  };
  // Chat send
  $('send-btn').onclick = sendChat;
  $('chat-input').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };
  // File attach
  $('attach-btn').onclick = () => $('file-input').click();
  $('file-input').onchange = handleFileSelect;
  // Add self to participants
  addSelfParticipant();
}

function addSelfParticipant() {
  const hue = 240;
  const p = el('div', 'participant');
  p.id = 'p-self';
  p.innerHTML = `
    <div class="avatar" style="background:hsl(${hue},60%,45%)">${S.myName[0].toUpperCase()}</div>
    <div class="p-info"><div class="p-name">${S.myName} (You)</div><div class="p-ping" id="ping-self">— ms</div></div>
    <div class="p-icons"><span class="p-icon" id="pi-mic-self">🎙</span><span class="p-icon" id="pi-cam-self">📷</span></div>`;
  $('participants-list').appendChild(p);
}

function toggleMic() {
  if (!S.localStream) return;
  S.micOn = !S.micOn;
  S.localStream.getAudioTracks().forEach(t => t.enabled = S.micOn);
  $('mic-btn').classList.toggle('muted', !S.micOn);
  $('self-mic-ind').classList.toggle('off', !S.micOn);
  broadcastMediaState();
}

function toggleCam() {
  if (!S.localStream) return;
  S.camOn = !S.camOn;
  S.localStream.getVideoTracks().forEach(t => t.enabled = S.camOn);
  $('cam-btn').classList.toggle('muted', !S.camOn);
  $('self-cam-ind').classList.toggle('off', !S.camOn);
  broadcastMediaState();
}

async function toggleScreen() {
  if (S.screenOn) {
    S.screenOn = false;
    if (S.screenStream) { S.screenStream.getTracks().forEach(t => t.stop()); S.screenStream = null; }
    $('screen-btn').classList.remove('screen-on');
    replaceCallTracks(buildOutStream());
    toast('Screen sharing stopped', 'info');
  } else {
    try {
      S.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      S.screenOn = true;
      $('screen-btn').classList.add('screen-on');
      S.screenStream.getVideoTracks()[0].onended = () => toggleScreen();
      replaceCallTracks(buildOutStream());
      toast('Screen sharing started', 'success');
    } catch (e) {
      if (e.name !== 'NotAllowedError') toast(`Screen share failed: ${e.message}`, 'error');
    }
  }
}

function replaceCallTracks(stream) {
  S.connections.forEach(conn => {
    if (!conn.call?.peerConnection) return;
    const pc = conn.call.peerConnection;
    stream.getTracks().forEach(track => {
      const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
      if (sender) sender.replaceTrack(track).catch(() => {});
    });
  });
  const sv = $('self-video');
  if (S.screenStream) {
    const ms = new MediaStream([...S.screenStream.getVideoTracks(), ...(S.localStream?.getAudioTracks() || [])]);
    sv.srcObject = ms;
  } else {
    sv.srcObject = S.localStream;
  }
}

function broadcastMediaState() {
  const msg = JSON.stringify({ type: 'media-state', micOn: S.micOn, camOn: S.camOn });
  S.connections.forEach(conn => { if (conn.data?.open) conn.data.send(msg); });
}

function toggleChat() {
  S.chatOpen = !S.chatOpen;
  const panel = $('chat-panel');
  panel.classList.toggle('closed', !S.chatOpen);
  $('chat-btn').classList.toggle('on', S.chatOpen);
  if (S.chatOpen) setTimeout(() => $('chat-input').focus(), 200);
}

let layoutMode = 0;
function cycleLayout() {
  const grid = $('video-grid');
  layoutMode = (layoutMode + 1) % 3;
  const modes = ['', 'focus', 'strip'];
  grid.dataset.layout = modes[layoutMode];
}

async function openDeviceMenu(kind, e) {
  const menu = $('device-menu');
  const list = $('device-list');
  list.innerHTML = '';

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const filtered = devices.filter(d => d.kind === (kind === 'audio' ? 'audioinput' : 'videoinput'));

    if (!filtered.length) { toast('No devices found', 'warn'); return; }

    const label = el('div', 'device-label', kind === 'audio' ? 'MICROPHONE' : 'CAMERA');
    list.appendChild(label);

    filtered.forEach(dev => {
      const item = el('div', 'device-item' + ((kind === 'audio' ? S.currentMicId : S.currentCamId) === dev.deviceId ? ' active' : ''));
      item.textContent = dev.label || `Device ${dev.deviceId.slice(0, 6)}`;
      item.onclick = () => { switchDevice(kind, dev.deviceId); menu.classList.add('hidden'); };
      list.appendChild(item);
    });

    const rect = e.target.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    menu.style.top = 'auto';
    menu.classList.remove('hidden');

    const close = (ev) => { if (!menu.contains(ev.target)) { menu.classList.add('hidden'); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  } catch (_) { toast('Cannot enumerate devices', 'error'); }
}

async function switchDevice(kind, deviceId) {
  const prev = S.localStream;
  if (kind === 'audio') S.currentMicId = deviceId;
  else S.currentCamId = deviceId;

  try {
    S.localStream = await getMedia(true, true);
    $('self-video').srcObject = S.localStream;
    replaceCallTracks(S.localStream);
    if (prev) prev.getTracks().forEach(t => t.stop());
    // Reapply mute state
    S.localStream.getAudioTracks().forEach(t => t.enabled = S.micOn);
    S.localStream.getVideoTracks().forEach(t => t.enabled = S.camOn);
    toast(`Switched ${kind === 'audio' ? 'microphone' : 'camera'}`, 'success');
  } catch (e) {
    toast(`Device switch failed: ${e.message}`, 'error');
  }
}

// ── Chat ──
function sendChat() {
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const msg = JSON.stringify({ type: 'chat', text });
  S.connections.forEach(conn => { if (conn.data?.open) conn.data.send(msg); });
  addChatMsg('self', S.myName, text);
}

function addChatMsg(peerId, name, text) {
  const msgs = $('messages');
  const isSelf = peerId === 'self';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hue = isSelf ? 240 : Math.abs(peerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;

  // Group messages from same sender
  const lastKey = isSelf ? 'self' : peerId;
  let group = S.messageGroups.get(lastKey);
  const now = Date.now();
  if (!group || (now - group.ts) > 60000) {
    group = { el: null, ts: now };
    const grp = el('div', 'msg-group');
    grp.innerHTML = `<div class="msg-header"><span class="msg-name" style="color:hsl(${hue},70%,65%)">${name}</span><span class="msg-time">${time}</span></div><div class="msg-bubble"></div>`;
    msgs.appendChild(grp);
    group.el = grp;
    group.bubble = grp.querySelector('.msg-bubble');
  }
  S.messageGroups.set(lastKey, group);

  const line = el('div', 'msg-text', escHtml(text));
  group.bubble.appendChild(line);
  msgs.scrollTop = msgs.scrollHeight;

  if (!S.chatOpen) $('chat-btn').classList.add('on');
}

function systemMsg(text) {
  const msgs = $('messages');
  const div = el('div', 'msg-system', text);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── File handling ──
async function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) { toast(`${file.name} is too large (max 20MB)`, 'error'); continue; }
    const ab = await file.arrayBuffer();
    const b64 = arrayBufferToBase64(ab);
    const msg = JSON.stringify({ type: 'file', name: file.name, mime: file.type, size: file.size, data: b64 });
    S.connections.forEach(conn => { if (conn.data?.open) conn.data.send(msg); });
    renderFile('self', S.myName, { name: file.name, mime: file.type, size: file.size, data: b64 });
  }
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}

function receiveFile(peerId, msg) {
  const name = S.connections.get(peerId)?.name || 'Peer';
  renderFile(peerId, name, msg);
}

function renderFile(peerId, name, { name: fname, mime, size, data }) {
  const msgs = $('messages');
  const url = 'data:' + mime + ';base64,' + data;
  const sizeStr = size > 1048576 ? (size / 1048576).toFixed(1) + ' MB' : (size / 1024).toFixed(0) + ' KB';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hue = peerId === 'self' ? 240 : Math.abs(peerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;

  const grp = el('div', 'msg-group');
  grp.innerHTML = `<div class="msg-header"><span class="msg-name" style="color:hsl(${hue},70%,65%)">${name}</span><span class="msg-time">${time}</span></div>`;

  const wrap = el('div', 'file-msg');
  let inner = '';

  if (mime.startsWith('image/')) {
    inner = `<img src="${url}" alt="${escHtml(fname)}" loading="lazy">`;
  } else if (mime.startsWith('video/')) {
    inner = `<video src="${url}" controls></video>`;
  } else if (mime.startsWith('audio/')) {
    inner = `<audio src="${url}" controls></audio>`;
  } else if (mime === 'application/pdf') {
    inner = `<div class="pdf-preview"><span class="pdf-icon">📄</span><div class="pdf-info"><div class="pdf-name">${escHtml(fname)}</div><div class="pdf-label">PDF Document · ${sizeStr}</div></div></div>`;
  } else {
    inner = `<div class="pdf-preview"><span class="pdf-icon">📦</span><div class="pdf-info"><div class="pdf-name">${escHtml(fname)}</div><div class="pdf-label">${sizeStr}</div></div></div>`;
  }

  inner += `<div class="file-footer"><span class="file-name">${escHtml(fname)}</span><span class="file-size">${sizeStr}</span><div class="file-actions">`;

  if (mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('video/')) {
    inner += `<button class="file-btn" onclick="viewFile('${url}','${mime}')">View</button>`;
  }
  inner += `<a class="file-btn" href="${url}" download="${escHtml(fname)}">Download</a></div></div>`;

  wrap.innerHTML = inner;

  // Image lightbox click
  if (mime.startsWith('image/')) {
    wrap.querySelector('img').onclick = () => viewFile(url, mime);
  }

  grp.appendChild(wrap);
  msgs.appendChild(grp);
  msgs.scrollTop = msgs.scrollHeight;

  if (!S.chatOpen) $('chat-btn').classList.add('on');
}

function viewFile(url, mime) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = el('div', ''); lb.id = 'lightbox';
    lb.innerHTML = '<span id="lightbox-close">✕</span><div id="lb-content"></div>';
    document.body.appendChild(lb);
    $('lightbox-close').onclick = () => lb.remove();
    lb.onclick = e => { if (e.target === lb) lb.remove(); };
  }
  const c = lb.querySelector('#lb-content');
  if (mime.startsWith('image/')) {
    c.innerHTML = `<img src="${url}">`;
  } else if (mime === 'application/pdf') {
    c.innerHTML = `<iframe src="${url}" style="width:90vw;height:90vh;border:none;border-radius:8px"></iframe>`;
  } else if (mime.startsWith('video/')) {
    c.innerHTML = `<video src="${url}" controls autoplay style="max-width:90vw;max-height:90vh"></video>`;
  }
}

// ── Ping loop ──
function startPingLoop() {
  setInterval(() => {
    const id = Math.random().toString(36).slice(2);
    S.pingStart.set(id, performance.now());
    const msg = JSON.stringify({ type: 'ping', id });
    S.connections.forEach(conn => { if (conn.data?.open) conn.data.send(msg); });

    // Self ping (roundtrip to measure local overhead)
    const selfStart = performance.now();
    setTimeout(() => {
      const rtt = Math.round(performance.now() - selfStart);
      $('ping-val').textContent = rtt + ' ms';
      const el = document.getElementById('ping-self');
      if (el) el.textContent = rtt + ' ms';
    }, 0);
  }, 3000);
}

// ── Leave ──
function leaveRoom() {
  const bye = JSON.stringify({ type: 'bye' });
  S.connections.forEach(conn => { if (conn.data?.open) try { conn.data.send(bye); } catch (_) {} });
  S.connections.forEach(conn => { try { conn.data?.close(); conn.call?.close(); } catch (_) {} });
  S.connections.clear();
  if (S.localStream) { S.localStream.getTracks().forEach(t => t.stop()); S.localStream = null; }
  if (S.screenStream) { S.screenStream.getTracks().forEach(t => t.stop()); S.screenStream = null; }
  if (S.peer) { try { S.peer.destroy(); } catch (_) {} S.peer = null; }
  $('room').classList.remove('active');
  $('landing').classList.add('active');
  // Reset video tiles
  const grid = $('video-grid');
  while (grid.children.length > 1) grid.removeChild(grid.lastChild);
  $('participants-list').innerHTML = '';
  $('messages').innerHTML = '';
  S.messageGroups.clear();
  toast('Left the room', 'info');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  setupLanding();

  // Close device menu on escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $('device-menu').classList.add('hidden');
      const lb = document.getElementById('lightbox');
      if (lb) lb.remove();
    }
  });
});

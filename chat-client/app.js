/**
 * ============================================================================
 * QuickChat Desktop Client - Application Logic
 * Architecture: Socket.io Client + Google OAuth 2.0 + 1-Click Email Dispatch
 * ============================================================================
 */

// ----------------------------------------------------
// Global Application State
// ----------------------------------------------------
const AppState = {
  user: null,
  token: localStorage.getItem('quickchat_token') || null,
  serverUrl: localStorage.getItem('quickchat_server_url') || 'http://localhost:5000',
  googleClientId: localStorage.getItem('quickchat_google_client_id') || '',
  
  socket: null,
  activeType: 'room', // 'room' or 'direct'
  activeId: 'general',
  
  rooms: [],
  onlineUsers: [],
  directConversations: [],
  messagesCache: {}, // id -> Array of messages
  unreadCounts: {}, // id -> count
  
  pendingAttachment: null,
  isTyping: false,
  typingTimeout: null
};

// ----------------------------------------------------
// DOM Element Selectors
// ----------------------------------------------------
const el = {
  // Auth Overlay
  authOverlay: document.getElementById('authOverlay'),
  googleSignInBtn: document.getElementById('googleSignInBtn'),
  loginIdentifierInput: document.getElementById('loginIdentifierInput'),
  quickLoginBtn: document.getElementById('quickLoginBtn'),
  authStatusMessage: document.getElementById('authStatusMessage'),
  
  // User Header & Sidebar
  currentUserAvatar: document.getElementById('currentUserAvatar'),
  currentUserName: document.getElementById('currentUserName'),
  currentUserEmail: document.getElementById('currentUserEmail'),
  logoutBtn: document.getElementById('logoutBtn'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  openDirectChatModalBtn: document.getElementById('openDirectChatModalBtn'),
  
  // Search & Tabs
  searchInput: document.getElementById('searchInput'),
  tabRoomsBtn: document.getElementById('tabRoomsBtn'),
  tabDirectBtn: document.getElementById('tabDirectBtn'),
  tabOnlineBtn: document.getElementById('tabOnlineBtn'),
  onlineCountBadge: document.getElementById('onlineCountBadge'),
  
  // Lists
  roomsList: document.getElementById('roomsList'),
  directChatsList: document.getElementById('directChatsList'),
  onlineUsersList: document.getElementById('onlineUsersList'),
  
  // 1-Click Background Email Dispatch Panel
  emailAlertRecipient: document.getElementById('emailAlertRecipient'),
  emailAlertNote: document.getElementById('emailAlertNote'),
  emailAlertSendBtn: document.getElementById('emailAlertSendBtn'),
  emailStatusFeedback: document.getElementById('emailStatusFeedback'),
  
  // Active Chat Header
  activeRoomAvatar: document.getElementById('activeRoomAvatar'),
  activeRoomTitle: document.getElementById('activeRoomTitle'),
  activeRoomMembersCount: document.getElementById('activeRoomMembersCount'),
  typingIndicator: document.getElementById('typingIndicator'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  headerSettingsBtn: document.getElementById('headerSettingsBtn'),
  
  // Messages Area
  messagesContainer: document.getElementById('messagesContainer'),
  messagesStream: document.getElementById('messagesStream'),
  
  // Attachment Preview
  attachmentPreviewBar: document.getElementById('attachmentPreviewBar'),
  previewImage: document.getElementById('previewImage'),
  previewFileName: document.getElementById('previewFileName'),
  previewFileSize: document.getElementById('previewFileSize'),
  removeAttachmentBtn: document.getElementById('removeAttachmentBtn'),
  
  // Chat Input Bar
  emojiToggleBtn: document.getElementById('emojiToggleBtn'),
  emojiPicker: document.getElementById('emojiPicker'),
  emojiGrid: document.getElementById('emojiGrid'),
  attachFileBtn: document.getElementById('attachFileBtn'),
  attachmentFileInput: document.getElementById('attachmentFileInput'),
  messageInput: document.getElementById('messageInput'),
  sendMessageBtn: document.getElementById('sendMessageBtn'),
  
  // Modals
  directChatModal: document.getElementById('directChatModal'),
  closeDirectChatModalBtn: document.getElementById('closeDirectChatModalBtn'),
  cancelDirectChatBtn: document.getElementById('cancelDirectChatBtn'),
  confirmDirectChatBtn: document.getElementById('confirmDirectChatBtn'),
  directRecipientInput: document.getElementById('directRecipientInput'),
  directInitialMsgInput: document.getElementById('directInitialMsgInput'),
  
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  settingsUserAvatar: document.getElementById('settingsUserAvatar'),
  settingsUserName: document.getElementById('settingsUserName'),
  settingsUserEmail: document.getElementById('settingsUserEmail'),
  settingsServerUrlInput: document.getElementById('settingsServerUrlInput'),
  settingsGoogleClientIdInput: document.getElementById('settingsGoogleClientIdInput')
};

// ----------------------------------------------------
// Application Bootstrap
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupElectronIPC();
  setupEventListeners();
  populateEmojiGrid();

  if (AppState.token) {
    validateExistingSession();
  } else {
    showAuthOverlay();
  }
});

// ----------------------------------------------------
// Electron IPC & OAuth Listener Setup
// ----------------------------------------------------
function setupElectronIPC() {
  if (window.require) {
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Receive OAuth Authorization code from main process loopback server
      ipcRenderer.on('google-oauth-success', async (event, { code }) => {
        showAuthStatus('Processing Google Sign-In...', 'info');
        await exchangeGoogleAuthCode(code);
      });

      ipcRenderer.on('google-oauth-error', (event, { error }) => {
        showAuthStatus(`Google Login Error: ${error}`, 'error');
      });
    } catch (e) {
      console.log('Running in browser or standard renderer mode.');
    }
  }
}

// ----------------------------------------------------
// Google Authentication Flow
// ----------------------------------------------------
async function handleGoogleSignIn() {
  showAuthStatus('Connecting to Google...', 'info');

  const clientId = AppState.googleClientId;

  // 1. If running in Electron with a Google Client ID configured
  if (window.require && clientId) {
    try {
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('start-google-oauth', { clientId });
      showAuthStatus('Please complete sign-in in your browser window...', 'info');
      return;
    } catch (err) {
      console.warn('IPC Google OAuth trigger failed, using direct fallback:', err);
    }
  }

  // 2. Direct Instant Google Sign-In Fallback (Zero Setup Demo / Fast Access)
  try {
    const inputVal = el.loginIdentifierInput.value.trim();
    const demoEmail = (inputVal && inputVal.includes('@')) 
      ? inputVal 
      : `${(inputVal || 'google_user').toLowerCase().replace(/\s+/g, '_')}@gmail.com`;
    const demoName = inputVal ? inputVal.split('@')[0] : 'Google User';

    const res = await fetch(`${AppState.serverUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isDemoGoogleAuth: true,
        email: demoEmail,
        displayName: demoName,
        photoURL: '🧑‍💻'
      })
    });

    const data = await res.json();
    if (data.success && data.token) {
      onAuthSuccess(data);
    } else {
      showAuthStatus(data.message || 'Google Authentication failed.', 'error');
    }
  } catch (err) {
    showAuthStatus('Cannot connect to backend server. Make sure server is running on port 5000.', 'error');
  }
}

async function exchangeGoogleAuthCode(code) {
  try {
    const res = await fetch(`${AppState.serverUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const data = await res.json();
    if (data.success && data.token) {
      onAuthSuccess(data);
    } else {
      showAuthStatus(data.message || 'Failed to verify Google token.', 'error');
    }
  } catch (err) {
    showAuthStatus('Server authentication error during Google OAuth exchange.', 'error');
  }
}

async function handleQuickLogin() {
  const identifier = el.loginIdentifierInput.value.trim();
  if (!identifier) {
    showAuthStatus('Please enter a display name or email.', 'error');
    return;
  }

  showAuthStatus('Signing in...', 'info');

  try {
    // Attempt login or register
    const res = await fetch(`${AppState.serverUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: identifier.includes('@') ? identifier.split('@')[0] : identifier,
        email: identifier.includes('@') ? identifier : `${identifier.toLowerCase().replace(/\s+/g, '')}@quickchat.app`,
        password: 'password123',
        avatar: '👤'
      })
    });

    let data = await res.json();
    if (!data.success && data.message.includes('already exists')) {
      // Try login instead
      const loginRes = await fetch(`${AppState.serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: 'password123' })
      });
      data = await loginRes.json();
    }

    if (data.success && data.token) {
      onAuthSuccess(data);
    } else {
      showAuthStatus(data.message || 'Login failed.', 'error');
    }
  } catch (err) {
    showAuthStatus('Could not connect to QuickChat server. Check backend status.', 'error');
  }
}

function onAuthSuccess(data) {
  AppState.token = data.token;
  AppState.user = data.user;
  localStorage.setItem('quickchat_token', data.token);

  hideAuthOverlay();
  updateUserProfileUI();
  initSocketConnection();
  loadRoomsAndDirectChats();
}

async function validateExistingSession() {
  try {
    const res = await fetch(`${AppState.serverUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${AppState.token}` }
    });
    const data = await res.json();
    if (data.success && data.user) {
      AppState.user = data.user;
      hideAuthOverlay();
      updateUserProfileUI();
      initSocketConnection();
      loadRoomsAndDirectChats();
    } else {
      logout();
    }
  } catch (e) {
    showAuthOverlay();
  }
}

function logout() {
  localStorage.removeItem('quickchat_token');
  AppState.token = null;
  AppState.user = null;
  if (AppState.socket) {
    AppState.socket.disconnect();
  }
  showAuthOverlay();
}

function showAuthOverlay() {
  el.authOverlay.classList.remove('hidden');
}

function hideAuthOverlay() {
  el.authOverlay.classList.add('hidden');
}

function showAuthStatus(msg, type = 'info') {
  el.authStatusMessage.textContent = msg;
  el.authStatusMessage.className = `auth-status-message ${type}`;
  el.authStatusMessage.classList.remove('hidden');
}

function updateUserProfileUI() {
  if (!AppState.user) return;
  const user = AppState.user;
  const name = user.displayName || user.username || 'User';
  const email = user.email || '';
  const avatar = user.avatar || user.photoURL || '👤';

  el.currentUserName.textContent = name;
  el.currentUserEmail.textContent = email;

  if (avatar.startsWith('http')) {
    el.currentUserAvatar.innerHTML = `<img src="${avatar}" alt="Avatar">`;
    el.settingsUserAvatar.innerHTML = `<img src="${avatar}" alt="Avatar">`;
  } else {
    el.currentUserAvatar.textContent = avatar;
    el.settingsUserAvatar.textContent = avatar;
  }

  el.settingsUserName.textContent = name;
  el.settingsUserEmail.textContent = email;
}

// ----------------------------------------------------
// Real-Time Socket.io Connection & Events
// ----------------------------------------------------
function initSocketConnection() {
  if (AppState.socket) {
    AppState.socket.disconnect();
  }

  // Load socket.io-client library
  let ioClient = window.io;
  if (!ioClient && window.require) {
    try {
      ioClient = window.require('socket.io-client');
    } catch (e) {}
  }

  if (!ioClient) {
    console.error('Socket.io client not found.');
    return;
  }

  AppState.socket = ioClient(AppState.serverUrl, {
    auth: { token: AppState.token },
    query: { token: AppState.token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  });

  AppState.socket.on('connect', () => {
    console.log('⚡ Connected to Socket.io real-time engine:', AppState.socket.id);
    el.currentUserEmail.textContent = AppState.user?.email || 'Online';

    // Auto join active room
    if (AppState.activeType === 'room') {
      joinRoom(AppState.activeId);
    }
  });

  AppState.socket.on('disconnect', () => {
    console.log('❌ Disconnected from real-time engine');
    el.currentUserEmail.textContent = 'Reconnecting...';
  });

  AppState.socket.on('receive_message', (msg) => {
    handleIncomingMessage(msg);
  });

  AppState.socket.on('receive_direct_message', (msg) => {
    handleIncomingDirectMessage(msg);
  });

  AppState.socket.on('online_users', (users) => {
    AppState.onlineUsers = users || [];
    el.onlineCountBadge.textContent = AppState.onlineUsers.length;
    renderOnlineUsersList();
  });

  AppState.socket.on('user_typing', ({ roomId, username }) => {
    if (AppState.activeId === roomId) {
      el.typingIndicator.textContent = `${username} is typing...`;
      el.typingIndicator.classList.remove('hidden');
    }
  });

  AppState.socket.on('user_stop_typing', ({ roomId }) => {
    if (AppState.activeId === roomId) {
      el.typingIndicator.classList.add('hidden');
    }
  });
}

// ----------------------------------------------------
// 1-Click Background Email Dispatch Feature
// ----------------------------------------------------
async function handleSendEmailAlert() {
  const recipient = el.emailAlertRecipient.value.trim();
  const note = el.emailAlertNote.value.trim();

  if (!recipient || !recipient.includes('@')) {
    showEmailFeedback('Please enter a valid recipient email address.', 'error');
    return;
  }

  // Set sending state
  el.emailAlertSendBtn.classList.add('sending');
  el.emailAlertSendBtn.disabled = true;
  el.emailAlertSendBtn.innerHTML = `<span>⚡ Sending...</span>`;
  showEmailFeedback('Dispatching email in background...', 'info');

  try {
    const res = await fetch(`${AppState.serverUrl}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.token}`
      },
      body: JSON.stringify({
        to: recipient,
        message: note || `Hey! Join me on QuickChat in #${AppState.activeId} to chat in real-time.`,
        roomId: AppState.activeId
      })
    });

    const data = await res.json();
    if (data.success) {
      showEmailFeedback(`Sent successfully to ${recipient} ✔`, 'success');
      el.emailAlertNote.value = '';
    } else {
      showEmailFeedback(data.message || 'Failed to dispatch email.', 'error');
    }
  } catch (err) {
    showEmailFeedback('Network error while sending email.', 'error');
  } finally {
    el.emailAlertSendBtn.classList.remove('sending');
    el.emailAlertSendBtn.disabled = false;
    el.emailAlertSendBtn.innerHTML = `<span>Send Email Alert</span>`;
  }
}

function showEmailFeedback(msg, type) {
  el.emailStatusFeedback.textContent = msg;
  el.emailStatusFeedback.className = `email-status-feedback ${type}`;
  el.emailStatusFeedback.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      el.emailStatusFeedback.classList.add('hidden');
    }, 4000);
  }
}

// ----------------------------------------------------
// Rooms & Chat Navigation
// ----------------------------------------------------
async function loadRoomsAndDirectChats() {
  try {
    const [roomsRes, directRes] = await Promise.all([
      fetch(`${AppState.serverUrl}/api/rooms`),
      fetch(`${AppState.serverUrl}/api/direct/conversations`, {
        headers: { 'Authorization': `Bearer ${AppState.token}` }
      })
    ]);

    const roomsData = await roomsRes.json();
    if (roomsData.success) {
      AppState.rooms = roomsData.rooms || [];
      renderRoomsList();
    }

    const directData = await directRes.json();
    if (directData.success) {
      AppState.directConversations = directData.conversations || [];
      renderDirectChatsList();
    }

    // Default join general
    joinRoom('general');
  } catch (e) {
    console.error('Error loading rooms and chats:', e);
  }
}

function renderRoomsList() {
  const query = el.searchInput.value.toLowerCase().trim();
  el.roomsList.innerHTML = '';

  const filtered = AppState.rooms.filter(r => 
    r.name.toLowerCase().includes(query) || (r.description && r.description.toLowerCase().includes(query))
  );

  filtered.forEach(room => {
    const item = document.createElement('div');
    item.className = `chat-item ${AppState.activeType === 'room' && room.id === AppState.activeId ? 'active' : ''}`;

    const roomMsgs = AppState.messagesCache[room.id] || [];
    const lastMsg = roomMsgs[roomMsgs.length - 1];
    const previewText = lastMsg 
      ? `${lastMsg.sender}: ${lastMsg.text || '📷 [Attachment]'}`
      : room.description || 'Click to enter';

    const timeDisplay = lastMsg ? formatMessageTime(lastMsg.timestamp) : '';
    const unread = AppState.unreadCounts[room.id] || 0;

    item.innerHTML = `
      <div class="item-avatar">${room.icon || '💬'}</div>
      <div class="item-content">
        <div class="item-row-top">
          <span class="item-title">${escapeHtml(room.name)}</span>
          <span class="item-time">${timeDisplay}</span>
        </div>
        <div class="item-row-bottom">
          <span class="item-preview">${escapeHtml(previewText)}</span>
          ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      joinRoom(room.id);
    });

    el.roomsList.appendChild(item);
  });
}

function renderDirectChatsList() {
  const query = el.searchInput.value.toLowerCase().trim();
  el.directChatsList.innerHTML = '';

  const filtered = AppState.directConversations.filter(c => {
    const other = c.participantDetails.find(p => p.id !== AppState.user?.id) || {};
    return (
      (other.username && other.username.toLowerCase().includes(query)) ||
      (other.email && other.email.toLowerCase().includes(query)) ||
      (c.targetIdentifier && c.targetIdentifier.toLowerCase().includes(query))
    );
  });

  if (filtered.length === 0) {
    el.directChatsList.innerHTML = `
      <div style="padding: 30px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
        No direct chats yet.<br>
        <button class="primary-btn" style="margin-top: 12px; font-size: 12px; padding: 6px 14px;" onclick="document.getElementById('openDirectChatModalBtn').click()">
          ✉️ Start Direct Chat
        </button>
      </div>
    `;
    return;
  }

  filtered.forEach(conv => {
    const other = conv.participantDetails.find(p => p.id !== AppState.user?.id) || {
      username: conv.targetIdentifier || 'Contact',
      avatar: '👤'
    };

    const item = document.createElement('div');
    item.className = `chat-item ${AppState.activeType === 'direct' && conv.id === AppState.activeId ? 'active' : ''}`;

    const lastMsg = conv.lastMessage;
    const previewText = lastMsg ? (lastMsg.text || '📷 [Attachment]') : 'Start conversation';
    const timeDisplay = lastMsg ? formatMessageTime(lastMsg.timestamp) : '';
    const unread = AppState.unreadCounts[conv.id] || 0;

    item.innerHTML = `
      <div class="item-avatar">${other.avatar || '👤'}</div>
      <div class="item-content">
        <div class="item-row-top">
          <span class="item-title">${escapeHtml(other.username)}</span>
          <span class="item-time">${timeDisplay}</span>
        </div>
        <div class="item-row-bottom">
          <span class="item-preview">${escapeHtml(previewText)}</span>
          ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      openDirectChat(conv.id);
    });

    el.directChatsList.appendChild(item);
  });
}

function renderOnlineUsersList() {
  el.onlineUsersList.innerHTML = '';
  if (AppState.onlineUsers.length === 0) {
    el.onlineUsersList.innerHTML = '<div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">No online users</div>';
    return;
  }

  AppState.onlineUsers.forEach(user => {
    const isMe = user.userId === AppState.user?.id;
    const item = document.createElement('div');
    item.className = 'chat-item';
    item.innerHTML = `
      <div class="item-avatar">${user.avatar || '👤'}</div>
      <div class="item-content">
        <div class="item-row-top">
          <span class="item-title">${escapeHtml(user.username || user.displayName)} ${isMe ? '<small style="color: var(--accent-emerald)">(You)</small>' : ''}</span>
          <span class="status-indicator online" style="position: static; display: inline-block;"></span>
        </div>
        <div class="item-row-bottom">
          <span class="item-preview">${escapeHtml(user.email || 'Online on QuickChat')}</span>
        </div>
      </div>
    `;

    if (!isMe) {
      item.addEventListener('click', () => {
        startDirectChatWithIdentifier(user.email || user.username);
      });
    }

    el.onlineUsersList.appendChild(item);
  });
}

// ----------------------------------------------------
// Room & Direct Chat Switching
// ----------------------------------------------------
async function joinRoom(roomId) {
  AppState.activeType = 'room';
  AppState.activeId = roomId;
  AppState.unreadCounts[roomId] = 0;

  if (AppState.socket && AppState.socket.connected) {
    AppState.socket.emit('join_room', {
      roomId,
      username: AppState.user?.displayName || AppState.user?.username || 'User',
      avatar: AppState.user?.avatar || '👤'
    });
  }

  updateActiveRoomHeader();
  renderRoomsList();

  if (AppState.messagesCache[roomId] && AppState.messagesCache[roomId].length > 0) {
    renderMessagesStream(AppState.messagesCache[roomId]);
  } else {
    el.messagesStream.innerHTML = '<div class="message-bubble system">Loading messages...</div>';
  }

  // Sync latest from REST API
  try {
    const res = await fetch(`${AppState.serverUrl}/api/history/${roomId}`);
    const data = await res.json();
    if (data.success) {
      AppState.messagesCache[roomId] = data.messages || [];
      if (AppState.activeId === roomId) {
        renderMessagesStream(data.messages);
      }
    }
  } catch (e) {}
}

async function openDirectChat(convId) {
  AppState.activeType = 'direct';
  AppState.activeId = convId;
  AppState.unreadCounts[convId] = 0;

  const conv = AppState.directConversations.find(c => c.id === convId);
  updateActiveDirectHeader(conv);
  renderDirectChatsList();

  if (AppState.messagesCache[convId] && AppState.messagesCache[convId].length > 0) {
    renderMessagesStream(AppState.messagesCache[convId]);
  } else {
    el.messagesStream.innerHTML = '<div class="message-bubble system">Loading conversation...</div>';
  }

  // Sync latest
  try {
    const res = await fetch(`${AppState.serverUrl}/api/history/${convId}`);
    const data = await res.json();
    if (data.success) {
      AppState.messagesCache[convId] = data.messages || [];
      if (AppState.activeId === convId) {
        renderMessagesStream(data.messages);
      }
    }
  } catch (e) {}
}

function updateActiveRoomHeader() {
  const room = AppState.rooms.find(r => r.id === AppState.activeId) || {
    name: AppState.activeId,
    icon: '💬',
    description: 'Channel'
  };

  el.activeRoomAvatar.textContent = room.icon;
  el.activeRoomTitle.textContent = `#${room.name}`;

  const roomOnline = AppState.onlineUsers.filter(u => u.currentRoom === AppState.activeId);
  el.activeRoomMembersCount.textContent = roomOnline.length > 0 
    ? `${roomOnline.length} members active now` 
    : room.description;
}

function updateActiveDirectHeader(conv) {
  if (!conv) return;

  const other = conv.participantDetails?.find(p => p.id !== AppState.user?.id) || {
    username: conv.targetIdentifier || 'Contact',
    avatar: '👤',
    email: conv.targetIdentifier
  };

  el.activeRoomAvatar.textContent = other.avatar || '👤';
  el.activeRoomTitle.textContent = other.username;

  const isOnline = AppState.onlineUsers.some(u => u.userId === other.id || u.email === other.email);
  el.activeRoomMembersCount.textContent = isOnline ? 'Online' : (other.email || 'Offline');
}

// ----------------------------------------------------
// Message Rendering & UI Stream
// ----------------------------------------------------
function renderMessagesStream(messages) {
  el.messagesStream.innerHTML = '';

  if (!messages || messages.length === 0) {
    appendSystemMessage('This is the start of your conversation.');
    return;
  }
  messages.forEach(msg => appendMessageToStream(msg));
  scrollToBottom();
}

function appendMessageToStream(msg) {
  if (msg.senderId === 'system' || !msg.sender) {
    appendSystemMessage(msg.text);
    return;
  }

  const isOutgoing = (AppState.user && (msg.senderId === AppState.user.id || msg.senderId === AppState.user._id || msg.sender === AppState.user.displayName || msg.sender === AppState.user.username)) || 
                     (AppState.socket && msg.senderId === AppState.socket.id);

  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
  bubble.setAttribute('data-msg-id', msg.id);

  const nameColorClass = `color-${(Math.abs(hashString(msg.sender)) % 5) + 1}`;

  let attachmentHtml = '';
  if (msg.attachment) {
    if (msg.attachment.type && msg.attachment.type.startsWith('image/')) {
      attachmentHtml = `<img src="${msg.attachment.data}" alt="${escapeHtml(msg.attachment.name)}" class="message-image">`;
    }
  }

  const ticksHtml = isOutgoing ? `
    <svg class="tick-icon ${msg.status === 'read' ? 'read' : ''}" viewBox="0 0 16 15" fill="currentColor">
      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
    </svg>
  ` : '';

  bubble.innerHTML = `
    ${!isOutgoing ? `<div class="message-sender ${nameColorClass}">${escapeHtml(msg.sender)}</div>` : ''}
    <div class="message-text">${escapeHtml(msg.text || '')}</div>
    ${attachmentHtml}
    <div class="message-meta">
      <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
      ${ticksHtml}
    </div>
  `;

  el.messagesStream.appendChild(bubble);
}

function appendSystemMessage(text) {
  const elMsg = document.createElement('div');
  elMsg.className = 'message-bubble system';
  elMsg.textContent = text;
  el.messagesStream.appendChild(elMsg);
}

function scrollToBottom() {
  el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
}

// ----------------------------------------------------
// Message Sending Logic
// ----------------------------------------------------
function sendMessage() {
  const text = el.messageInput.value.trim();
  const attachment = AppState.pendingAttachment;

  if (!text && !attachment) return;

  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = new Date().toISOString();

  const msgPayload = {
    id: tempId,
    roomId: AppState.activeId,
    conversationId: AppState.activeId,
    sender: AppState.user?.displayName || AppState.user?.username || 'You',
    senderId: AppState.user?.id || 'me',
    avatar: AppState.user?.avatar || '👤',
    email: AppState.user?.email || '',
    text: text,
    attachment: attachment,
    timestamp: timestamp,
    status: 'sent'
  };

  // 1. Optimistic Local Render
  if (!AppState.messagesCache[AppState.activeId]) {
    AppState.messagesCache[AppState.activeId] = [];
  }
  AppState.messagesCache[AppState.activeId].push(msgPayload);
  appendMessageToStream(msgPayload);
  scrollToBottom();

  // 2. Real-Time Socket Dispatch
  if (AppState.socket && AppState.socket.connected) {
    if (AppState.activeType === 'direct') {
      const conv = AppState.directConversations.find(c => c.id === AppState.activeId);
      const recipient = conv?.participantDetails?.find(p => p.id !== AppState.user?.id);
      AppState.socket.emit('send_direct_message', {
        ...msgPayload,
        recipientId: recipient?.id
      });
    } else {
      AppState.socket.emit('send_message', msgPayload);
    }
  }

  // Reset Input & Attachment
  el.messageInput.value = '';
  el.messageInput.style.height = 'auto';
  clearAttachment();
  el.messageInput.focus();

  if (AppState.activeType === 'room') {
    renderRoomsList();
  } else {
    renderDirectChatsList();
  }
}

function handleIncomingMessage(msg) {
  const roomId = msg.roomId || 'general';
  if (!AppState.messagesCache[roomId]) {
    AppState.messagesCache[roomId] = [];
  }

  // Check deduplication
  const exists = AppState.messagesCache[roomId].some(m => m.id === msg.id);
  if (!exists) {
    AppState.messagesCache[roomId].push(msg);
  }

  if (AppState.activeType === 'room' && AppState.activeId === roomId) {
    appendMessageToStream(msg);
    scrollToBottom();
  } else {
    AppState.unreadCounts[roomId] = (AppState.unreadCounts[roomId] || 0) + 1;
    renderRoomsList();
  }
}

function handleIncomingDirectMessage(msg) {
  const convId = msg.conversationId || msg.roomId;
  if (!AppState.messagesCache[convId]) {
    AppState.messagesCache[convId] = [];
  }

  const exists = AppState.messagesCache[convId].some(m => m.id === msg.id);
  if (!exists) {
    AppState.messagesCache[convId].push(msg);
  }

  if (AppState.activeType === 'direct' && AppState.activeId === convId) {
    appendMessageToStream(msg);
    scrollToBottom();
  } else {
    AppState.unreadCounts[convId] = (AppState.unreadCounts[convId] || 0) + 1;
    renderDirectChatsList();
  }
}

// ----------------------------------------------------
// Direct Chat Modal Action
// ----------------------------------------------------
async function startDirectChatWithIdentifier(identifier, initialMsg) {
  if (!identifier) return;

  try {
    const res = await fetch(`${AppState.serverUrl}/api/direct/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.token}`
      },
      body: JSON.stringify({
        targetIdentifier: identifier,
        initialMessage: initialMsg || ''
      })
    });

    const data = await res.json();
    if (data.success && data.conversation) {
      const exists = AppState.directConversations.some(c => c.id === data.conversation.id);
      if (!exists) {
        AppState.directConversations.unshift(data.conversation);
      }

      el.tabDirectBtn.click();
      openDirectChat(data.conversation.id);
    } else {
      alert(data.message || 'Could not start chat with this recipient.');
    }
  } catch (err) {
    alert('Error connecting to server. Please check backend status.');
  }
}

// ----------------------------------------------------
// Attachments & Emoji Picker
// ----------------------------------------------------
function handleAttachmentSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 20 * 1024 * 1024) {
    alert('File size exceeds 20MB limit.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    AppState.pendingAttachment = {
      name: file.name,
      size: file.size,
      type: file.type,
      data: event.target.result
    };

    el.previewFileName.textContent = file.name;
    el.previewFileSize.textContent = formatFileSize(file.size);

    if (file.type.startsWith('image/')) {
      el.previewImage.src = event.target.result;
      el.previewImage.classList.remove('hidden');
    } else {
      el.previewImage.classList.add('hidden');
    }

    el.attachmentPreviewBar.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearAttachment() {
  AppState.pendingAttachment = null;
  el.attachmentFileInput.value = '';
  el.attachmentPreviewBar.classList.add('hidden');
  el.previewImage.src = '';
}

const POPULAR_EMOJIS = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '🚀', '💯', '❤️', '✨', '👏', '😎', '💡', '💬', '💻', '🥳', '🙌'];

function populateEmojiGrid() {
  el.emojiGrid.innerHTML = '';
  POPULAR_EMOJIS.forEach(emoji => {
    const span = document.createElement('span');
    span.textContent = emoji;
    span.addEventListener('click', () => {
      el.messageInput.value += emoji;
      el.emojiPicker.classList.add('hidden');
      el.messageInput.focus();
    });
    el.emojiGrid.appendChild(span);
  });
}

// ----------------------------------------------------
// Event Listeners Setup
// ----------------------------------------------------
function setupEventListeners() {
  // Auth Triggers
  el.googleSignInBtn.addEventListener('click', handleGoogleSignIn);
  el.quickLoginBtn.addEventListener('click', handleQuickLogin);
  el.loginIdentifierInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleQuickLogin();
  });
  el.logoutBtn.addEventListener('click', logout);

  // 1-Click Email Alert
  el.emailAlertSendBtn.addEventListener('click', handleSendEmailAlert);
  el.emailAlertRecipient.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendEmailAlert();
  });

  // Tabs
  el.tabRoomsBtn.addEventListener('click', () => {
    setActiveTab(el.tabRoomsBtn, el.roomsList);
  });
  el.tabDirectBtn.addEventListener('click', () => {
    setActiveTab(el.tabDirectBtn, el.directChatsList);
  });
  el.tabOnlineBtn.addEventListener('click', () => {
    setActiveTab(el.tabOnlineBtn, el.onlineUsersList);
  });

  // Search Filter
  el.searchInput.addEventListener('input', () => {
    renderRoomsList();
    renderDirectChatsList();
  });

  // Direct Chat Modal
  el.openDirectChatModalBtn.addEventListener('click', () => {
    el.directRecipientInput.value = '';
    el.directInitialMsgInput.value = '';
    el.directChatModal.classList.remove('hidden');
    el.directRecipientInput.focus();
  });
  el.closeDirectChatModalBtn.addEventListener('click', () => el.directChatModal.classList.add('hidden'));
  el.cancelDirectChatBtn.addEventListener('click', () => el.directChatModal.classList.add('hidden'));
  el.confirmDirectChatBtn.addEventListener('click', () => {
    const recipient = el.directRecipientInput.value.trim();
    const msg = el.directInitialMsgInput.value.trim();
    if (!recipient) {
      alert('Please enter a recipient email or username.');
      return;
    }
    el.directChatModal.classList.add('hidden');
    startDirectChatWithIdentifier(recipient, msg);
  });

  // Message Input & Send
  el.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  el.messageInput.addEventListener('input', () => {
    el.messageInput.style.height = 'auto';
    el.messageInput.style.height = Math.min(el.messageInput.scrollHeight, 120) + 'px';

    if (!AppState.isTyping && AppState.socket) {
      AppState.isTyping = true;
      AppState.socket.emit('typing', {
        roomId: AppState.activeId,
        username: AppState.user?.displayName || AppState.user?.username
      });
    }
    clearTimeout(AppState.typingTimeout);
    AppState.typingTimeout = setTimeout(() => {
      AppState.isTyping = false;
      if (AppState.socket) {
        AppState.socket.emit('stop_typing', { roomId: AppState.activeId });
      }
    }, 1800);
  });

  el.sendMessageBtn.addEventListener('click', sendMessage);
  el.attachFileBtn.addEventListener('click', () => el.attachmentFileInput.click());
  el.attachmentFileInput.addEventListener('change', handleAttachmentSelect);
  el.removeAttachmentBtn.addEventListener('click', clearAttachment);

  el.emojiToggleBtn.addEventListener('click', () => {
    el.emojiPicker.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!el.emojiPicker.contains(e.target) && e.target !== el.emojiToggleBtn && !el.emojiToggleBtn.contains(e.target)) {
      el.emojiPicker.classList.add('hidden');
    }
  });

  el.clearChatBtn.addEventListener('click', () => {
    if (confirm('Clear message history for this view?')) {
      AppState.messagesCache[AppState.activeId] = [];
      renderMessagesStream([]);
    }
  });

  // Settings Modal
  const openSettings = () => {
    el.settingsServerUrlInput.value = AppState.serverUrl;
    el.settingsGoogleClientIdInput.value = AppState.googleClientId;
    el.settingsModal.classList.remove('hidden');
  };
  el.openSettingsBtn.addEventListener('click', openSettings);
  el.headerSettingsBtn.addEventListener('click', openSettings);
  el.closeSettingsModalBtn.addEventListener('click', () => el.settingsModal.classList.add('hidden'));
  el.cancelSettingsBtn.addEventListener('click', () => el.settingsModal.classList.add('hidden'));
  el.saveSettingsBtn.addEventListener('click', () => {
    const newServerUrl = el.settingsServerUrlInput.value.trim() || 'http://localhost:5000';
    const newClientId = el.settingsGoogleClientIdInput.value.trim();

    AppState.serverUrl = newServerUrl;
    AppState.googleClientId = newClientId;
    localStorage.setItem('quickchat_server_url', newServerUrl);
    localStorage.setItem('quickchat_google_client_id', newClientId);

    el.settingsModal.classList.add('hidden');
    alert('Settings saved! Reconnecting...');
    initSocketConnection();
  });
}

function setActiveTab(activeBtn, activeList) {
  [el.tabRoomsBtn, el.tabDirectBtn, el.tabOnlineBtn].forEach(b => b.classList.remove('active'));
  [el.roomsList, el.directChatsList, el.onlineUsersList].forEach(l => l.classList.add('hidden'));

  activeBtn.classList.add('active');
  activeList.classList.remove('hidden');
}

// ----------------------------------------------------
// Formatters & Utility Helpers
// ----------------------------------------------------
function formatMessageTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function hashString(str) {
  let hash = 0;
  if (!str || str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

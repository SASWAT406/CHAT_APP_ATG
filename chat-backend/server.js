/**
 * ============================================================================
 * Antigravity Backend Server
 * Real-Time WebSocket Rooms + Direct 1-on-1 Chats + Background Email Dispatch
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------
// Nodemailer Email Transporter Setup
// ----------------------------------------------------
let mailTransporter = null;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  console.log(`📧 Gmail Transporter active for [${process.env.GMAIL_USER}]`);
} else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log(`📧 Custom SMTP Transporter active (${process.env.SMTP_HOST})`);
} else {
  nodemailer.createTestAccount().then((testAccount) => {
    mailTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log('📧 Nodemailer Auto-Mailer initialized (Ethereal test inbox active with live preview URLs).');
  }).catch(() => {
    console.log('ℹ️ Nodemailer ready for automated email dispatch.');
  });
}

// ----------------------------------------------------
// In-Memory Data Stores
// ----------------------------------------------------
const roomHistories = {
  general: [
    {
      id: 'msg_welcome_1',
      targetId: 'general',
      sender: 'Antigravity Bot',
      email: 'bot@antigravity.app',
      avatar: '🤖',
      message: '👋 Welcome to Antigravity #general! Chat in real-time or start direct 1-on-1 messages.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ],
  dev: [
    {
      id: 'msg_welcome_2',
      targetId: 'dev',
      sender: 'Antigravity Bot',
      email: 'bot@antigravity.app',
      avatar: '🤖',
      message: '💻 Welcome to #dev! Engineering discussions, code snippets, and API discussions.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ],
  random: [
    {
      id: 'msg_welcome_3',
      targetId: 'random',
      sender: 'Antigravity Bot',
      email: 'bot@antigravity.app',
      avatar: '🤖',
      message: '☕ Welcome to #random! Casual conversations and fun banter.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]
};

// Direct 1-on-1 Chat Histories: key = sorted(`${email1}_${email2}`)
const directHistories = {};

// Online Users: socket.id -> { name, email, avatar, socketId }
const connectedUsers = {};

function getDirectKey(userA, userB) {
  return [userA.toLowerCase().trim(), userB.toLowerCase().trim()].sort().join('_');
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Antigravity Backend',
    timestamp: new Date().toISOString(),
    rooms: Object.keys(roomHistories),
    onlineUsersCount: Object.keys(connectedUsers).length
  });
});

// ----------------------------------------------------
// 1-Click Background Email Dispatch Endpoint
// ----------------------------------------------------
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, senderName, senderEmail, room, message } = req.body;

    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please provide a valid recipient email address.' });
    }

    const name = senderName || 'Antigravity User';
    const email = senderEmail || 'no-reply@antigravity.app';
    const subject = `${name} from QuickChat sent a message`;
    const messageContent = message || 'Hey! Join me on QuickChat to chat in real-time.';

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #111b21; color: #e9edef; border-radius: 12px; border: 1px solid #222e35;">
        <div style="text-align: center; border-bottom: 1px solid #222e35; padding-bottom: 16px; margin-bottom: 20px;">
          <h1 style="color: #00a884; margin: 0; font-size: 22px;">${name} from QuickChat sent a message</h1>
        </div>
        <div style="background: #202c33; padding: 18px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #2a3942;">
          <div style="background: #005c4b; color: #ffffff; padding: 14px 18px; border-radius: 8px; font-size: 15px; line-height: 1.5;">
            "${messageContent}"
          </div>
        </div>
        <div style="text-align: center; color: #667781; font-size: 12px; border-top: 1px solid #222e35; padding-top: 16px;">
          Replies to this email will go directly to <strong>${email}</strong>.<br>
          Antigravity • Standalone Desktop Messaging
        </div>
      </div>
    `;

    if (!mailTransporter) {
      return res.status(500).json({ success: false, message: 'Email transporter unavailable.' });
    }

    const fromAddress = process.env.GMAIL_USER 
      ? `"${name} (Antigravity)" <${process.env.GMAIL_USER}>` 
      : (process.env.SMTP_FROM || `"${name} (Antigravity)" <no-reply@antigravity.app>`);

    const info = await mailTransporter.sendMail({
      from: fromAddress,
      replyTo: email,
      to: to.trim(),
      subject: subject,
      html: emailHtml
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`✉️ [EMAIL DISPATCHED] To: [${to}] From: [${fromAddress}] Reply-To: [${email}]`);

    res.json({
      success: true,
      message: `Email alert sent successfully to ${to}!`,
      messageId: info.messageId,
      previewUrl: previewUrl || null
    });
  } catch (err) {
    console.error('❌ Failed to send email alert:', err);
    res.status(500).json({ success: false, message: 'Failed to send email: ' + err.message });
  }
});

// ----------------------------------------------------
// Socket.io Real-Time Engine Setup
// ----------------------------------------------------
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // User presence register
  socket.on('user_online', (userData) => {
    if (userData && userData.email) {
      connectedUsers[socket.id] = {
        name: userData.name || 'User',
        email: userData.email,
        avatar: userData.photoURL || '👤',
        socketId: socket.id
      };
      console.log(`🟢 User online: ${userData.name} (${userData.email})`);
      io.emit('online_users_update', Object.values(connectedUsers));
    }
  });

  // 1. Join Channel / Room
  socket.on('join_room', (roomId) => {
    const targetRoom = roomId || 'general';
    socket.join(targetRoom);
    const history = roomHistories[targetRoom] || [];
    socket.emit('room_history', { roomId: targetRoom, messages: history });
  });

  // 2. Broadcast Room Message
  socket.on('send_message', (data) => {
    const targetRoom = data.roomId || 'general';
    const messagePayload = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId: targetRoom,
      type: 'room',
      sender: data.sender || 'Anonymous',
      email: data.email || '',
      avatar: data.avatar || '👤',
      message: data.message || '',
      time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (!roomHistories[targetRoom]) {
      roomHistories[targetRoom] = [];
    }
    roomHistories[targetRoom].push(messagePayload);

    if (roomHistories[targetRoom].length > 100) {
      roomHistories[targetRoom].shift();
    }

    io.to(targetRoom).emit('receive_message', messagePayload);
  });

  // 3. Direct 1-on-1 Chat Messaging
  socket.on('get_direct_history', ({ senderEmail, recipientEmail }) => {
    if (!senderEmail || !recipientEmail) return;
    const directKey = getDirectKey(senderEmail, recipientEmail);
    const history = directHistories[directKey] || [];
    socket.emit('direct_history', { directKey, recipientEmail, messages: history });
  });

  socket.on('send_direct_message', (data) => {
    const { sender, senderEmail, senderAvatar, recipientEmail, recipientName, message, time } = data;
    if (!senderEmail || !recipientEmail || !message) return;

    const directKey = getDirectKey(senderEmail, recipientEmail);
    const messagePayload = {
      id: `dm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      directKey,
      type: 'direct',
      sender: sender || 'User',
      senderEmail,
      senderAvatar: senderAvatar || '👤',
      recipientEmail,
      recipientName: recipientName || recipientEmail,
      message,
      time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (!directHistories[directKey]) {
      directHistories[directKey] = [];
    }
    directHistories[directKey].push(messagePayload);

    if (directHistories[directKey].length > 100) {
      directHistories[directKey].shift();
    }

    // Send to sender
    socket.emit('receive_direct_message', messagePayload);

    // Send to recipient if online
    const recipientSocket = Object.values(connectedUsers).find(u => u.email.toLowerCase() === recipientEmail.toLowerCase());
    if (recipientSocket) {
      io.to(recipientSocket.socketId).emit('receive_direct_message', messagePayload);
    }
  });

  // 4. Typing Indicators
  socket.on('typing', ({ targetId, sender }) => {
    socket.broadcast.emit('user_typing', { targetId, sender });
  });

  socket.on('stop_typing', ({ targetId }) => {
    socket.broadcast.emit('user_stop_typing', { targetId });
  });

  socket.on('disconnect', () => {
    delete connectedUsers[socket.id];
    io.emit('online_users_update', Object.values(connectedUsers));
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 Antigravity Real-Time Server running on port ${PORT}`);
  console.log(`💬 Rooms: #general, #dev, #random`);
  console.log(`👤 Direct 1-on-1 Messages & User Presence Active`);
  console.log(`=============================================================\n`);
});

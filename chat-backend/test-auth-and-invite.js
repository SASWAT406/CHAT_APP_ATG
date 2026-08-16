/**
 * Integration Test Suite: Google OAuth, Socket.io Real-Time Rooms, & 1-Click Background Email Dispatch
 */

const { io } = require('../chat-client/node_modules/socket.io-client');

const BASE_URL = 'http://localhost:5000';

async function runTestSuite() {
  console.log('🧪 Starting QuickChat Production Test Suite...\n');

  // 1. Health Check
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  console.log('1️⃣ Health check OK:', healthData.appName, `v${healthData.version}`, `(Active Rooms: ${healthData.roomsCount})`);

  // 2. Test Google OAuth Sign-In Simulation
  const runId = Date.now();
  const googleEmail = `google_user_${runId}@gmail.com`;
  const googleAuthRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      isDemoGoogleAuth: true,
      email: googleEmail,
      displayName: 'Alex Google',
      photoURL: '🧑‍💻'
    })
  });
  const googleAuthData = await googleAuthRes.json();
  if (!googleAuthData.success) throw new Error('Google Auth failed: ' + googleAuthData.message);
  console.log('2️⃣ Google OAuth 2.0 Login OK. User:', googleAuthData.user.displayName, `(${googleAuthData.user.email})`);
  const userToken = googleAuthData.token;

  // 3. Test 1-Click Background Email Dispatch
  const emailDispatchRes = await fetch(`${BASE_URL}/api/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      to: 'colleague@example.com',
      message: 'Hey! Join me in #dev channel on QuickChat.',
      roomId: 'dev'
    })
  });
  const emailDispatchData = await emailDispatchRes.json();
  if (!emailDispatchData.success) throw new Error('Email dispatch failed: ' + emailDispatchData.message);
  console.log('3️⃣ 1-Click Background Email Dispatch OK:', emailDispatchData.message);
  if (emailDispatchData.previewUrl) {
    console.log('   🔗 Live Test Inbox URL:', emailDispatchData.previewUrl);
  }

  // 4. Test Socket.io Room Joining & Real-Time Messaging
  console.log('4️⃣ Testing Real-Time Socket.io Connection with Authenticated Token...');
  const socket = io(BASE_URL, {
    auth: { token: userToken },
    query: { token: userToken }
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket timeout')), 5000);

    socket.on('connect', () => {
      console.log('   ✅ Socket connected successfully:', socket.id);
      
      socket.emit('join_room', { roomId: 'dev', username: 'Alex Google', avatar: '🧑‍💻' });

      socket.on('receive_message', (msg) => {
        if (msg.text === '🚀 Real-time Google user test message') {
          console.log('   ✅ Real-time room message received broadcast:', `"${msg.text}" from [${msg.sender}] in [#${msg.roomId}]`);
          clearTimeout(timeout);
          socket.disconnect();
          resolve();
        }
      });

      setTimeout(() => {
        socket.emit('send_message', {
          roomId: 'dev',
          text: '🚀 Real-time Google user test message'
        });
      }, 500);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  console.log('\n🎉 ALL GOOGLE AUTH, EMAIL DISPATCH, & SOCKET.IO TESTS PASSED 100%!\n');
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

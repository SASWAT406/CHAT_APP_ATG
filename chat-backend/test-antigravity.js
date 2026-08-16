/**
 * Test Antigravity Real-Time Room Server & Background Email Dispatch Endpoint
 */

const { io } = require('../chat-client/node_modules/socket.io-client');

const SERVER_URL = 'http://localhost:5000';

async function testAntigravityServer() {
  console.log('🧪 Testing Antigravity Real-Time Server & Email Dispatch...\n');

  // 1. Health Check
  const healthRes = await fetch(`${SERVER_URL}/api/health`);
  const healthData = await healthRes.json();
  console.log('1️⃣ Health check OK:', healthData.app, `(Rooms: ${healthData.rooms.join(', ')})`);

  // 2. Test 1-Click Background Email Dispatch Endpoint
  const emailRes = await fetch(`${SERVER_URL}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'peer@example.com',
      senderName: 'Alex Firebase',
      senderEmail: 'alex.firebase@gmail.com',
      room: 'tech',
      message: 'Hey! Check out the Antigravity desktop chat app.'
    })
  });
  const emailData = await emailRes.json();
  if (!emailData.success) throw new Error('Email dispatch failed: ' + emailData.message);
  console.log('2️⃣ 1-Click Email Dispatch OK:', emailData.message);
  if (emailData.previewUrl) {
    console.log('   🔗 Live Test Inbox URL:', emailData.previewUrl);
  }

  // 3. Test Real-Time Room Messaging
  console.log('3️⃣ Testing Real-Time Room Joining & Broadcast in #tech...');
  const socket1 = io(SERVER_URL);
  const socket2 = io(SERVER_URL);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket test timed out')), 5000);

    socket2.on('connect', () => {
      socket2.emit('join_room', 'tech');
      socket2.on('receive_message', (msg) => {
        if (msg.message === '🚀 Firebase Google user test message') {
          console.log(`   ✅ Client 2 received broadcast in [#${msg.roomId}] from [${msg.sender}]: "${msg.message}"`);
          clearTimeout(timeout);
          socket1.disconnect();
          socket2.disconnect();
          resolve();
        }
      });
    });

    socket1.on('connect', () => {
      socket1.emit('join_room', 'tech');
      setTimeout(() => {
        socket1.emit('send_message', {
          roomId: 'tech',
          sender: 'Alex Firebase',
          email: 'alex.firebase@gmail.com',
          message: '🚀 Firebase Google user test message'
        });
      }, 500);
    });
  });

  console.log('\n🎉 ALL ANTIGRAVITY BACKEND & EMAIL DISPATCH TESTS PASSED 100%!\n');
}

testAntigravityServer().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

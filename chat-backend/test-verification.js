const { io } = require('../chat-client/node_modules/socket.io-client');
const http = require('http');

async function testBackend() {
  console.log('Testing REST /api/health...');
  
  const healthReq = await fetch('http://localhost:5000/api/health');
  const healthData = await healthReq.json();
  console.log('Health check response:', healthData);

  if (healthData.status !== 'online') {
    throw new Error('Health check status is not online');
  }

  console.log('\nTesting Socket.io Connection & Events...');
  const socket = io('http://localhost:5000');

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket timeout')), 5000);

    socket.on('connect', () => {
      console.log('✅ Client connected with socket ID:', socket.id);
      
      socket.emit('join_room', {
        roomId: 'general',
        username: 'TestBot',
        avatar: '🤖'
      });
    });

    socket.on('room_history', (data) => {
      console.log(`✅ Received history for room [${data.roomId}] with ${data.messages.length} messages.`);
      
      // Test sending a message
      socket.emit('send_message', {
        roomId: 'general',
        sender: 'TestBot',
        avatar: '🤖',
        text: 'Integration test automated verification message'
      });
    });

    socket.on('receive_message', (msg) => {
      console.log(`✅ Received message broadcast: [${msg.sender}] -> ${msg.text}`);
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  console.log('\n🎉 ALL AUTOMATED BACKEND & SOCKET TESTS PASSED SUCCESSFULLY!\n');
}

testBackend()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });

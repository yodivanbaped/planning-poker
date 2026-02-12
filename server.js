const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('public'));

// In-memory storage for rooms
const rooms = new Map();

// Room cleanup timers (for grace period when empty)
const roomCleanupTimers = new Map();

// Card values (Fibonacci)
const CARD_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?'];

// Room cleanup grace period (5 minutes)
const ROOM_CLEANUP_DELAY = 5 * 60 * 1000;

// Helper function to get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Helper function to get room state for broadcasting
function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const participants = Array.from(room.participants.values());
  const votes = {};
  
  // Only include vote values if revealed, otherwise just indicate if voted
  room.votes.forEach((value, oderId) => {
    votes[oderId] = room.revealed ? value : (value !== null);
  });

  return {
    roomId,
    creatorName: room.creatorName,
    participants,
    votes,
    revealed: room.revealed,
    story: room.story,
    timer: room.timer ? { endTime: room.timer.endTime, duration: room.timer.duration } : null,
    cardValues: CARD_VALUES
  };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create a new room
  socket.on('create-room', ({ creatorName }, callback) => {
    const roomId = uuidv4().substring(0, 8).toUpperCase();
    
    rooms.set(roomId, {
      creatorName: creatorName,  // Track the creator by name (since socket.id changes on page navigation)
      participants: new Map(),
      votes: new Map(),
      revealed: false,
      story: { title: '', description: '' },
      timer: null,
      createdAt: Date.now()
    });

    console.log(`Room created: ${roomId} by ${creatorName}`);
    callback({ success: true, roomId });
  });

  // Join an existing room
  socket.on('join-room', ({ roomId, name }, callback) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    // Cancel any pending cleanup for this room
    if (roomCleanupTimers.has(roomId)) {
      clearTimeout(roomCleanupTimers.get(roomId));
      roomCleanupTimers.delete(roomId);
      console.log(`Cancelled cleanup timer for room ${roomId}`);
    }

    // Add participant to room
    room.participants.set(socket.id, { name, oderId: socket.id });
    room.votes.set(socket.id, null);
    
    // Join the socket room
    socket.join(roomId);
    socket.roomId = roomId;
    socket.participantName = name;

    console.log(`${name} joined room ${roomId}`);

    // Send success response with room state
    callback({ success: true, roomState: getRoomState(roomId) });

    // Notify other participants
    socket.to(roomId).emit('participant-joined', {
      participant: { name, oderId: socket.id },
      roomState: getRoomState(roomId)
    });
  });

  // Submit a vote
  socket.on('submit-vote', ({ cardValue }) => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room || room.revealed) return;

    room.votes.set(socket.id, cardValue);
    console.log(`${socket.participantName} voted in room ${roomId}`);

    // Broadcast vote received (without revealing the value)
    io.to(roomId).emit('vote-received', {
      oderId: socket.id,
      roomState: getRoomState(roomId)
    });
  });

  // Reveal all votes (only creator can reveal)
  socket.on('reveal-votes', () => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room) return;

    // Server-side validation: only creator can reveal
    if (room.creatorName !== socket.participantName) {
      console.log(`${socket.participantName} tried to reveal but is not the creator`);
      return;
    }

    room.revealed = true;
    console.log(`Votes revealed in room ${roomId} by ${socket.participantName}`);

    // Stop timer if running
    if (room.timer && room.timer.intervalId) {
      clearInterval(room.timer.intervalId);
      room.timer = null;
    }

    io.to(roomId).emit('votes-revealed', {
      roomState: getRoomState(roomId)
    });
  });

  // Reset votes for next round (only creator can reset)
  socket.on('reset-votes', () => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room) return;

    // Server-side validation: only creator can reset
    if (room.creatorName !== socket.participantName) {
      console.log(`${socket.participantName} tried to reset but is not the creator`);
      return;
    }

    // Clear all votes
    room.votes.forEach((_, oderId) => {
      room.votes.set(oderId, null);
    });
    room.revealed = false;

    // Stop timer if running
    if (room.timer && room.timer.intervalId) {
      clearInterval(room.timer.intervalId);
      room.timer = null;
    }

    console.log(`Votes reset in room ${roomId}`);

    io.to(roomId).emit('votes-reset', {
      roomState: getRoomState(roomId)
    });
  });

  // Update story information
  socket.on('update-story', ({ title, description }) => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room) return;

    room.story = { title, description };

    io.to(roomId).emit('story-updated', {
      story: room.story
    });
  });

  // Start timer
  socket.on('start-timer', ({ duration }) => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room) return;

    // Clear existing timer if any
    if (room.timer && room.timer.intervalId) {
      clearInterval(room.timer.intervalId);
    }

    const endTime = Date.now() + duration * 1000;
    room.timer = {
      endTime,
      duration,
      intervalId: null
    };

    // Broadcast timer started
    io.to(roomId).emit('timer-started', {
      endTime,
      duration
    });

    // Set up interval to broadcast remaining time
    room.timer.intervalId = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((room.timer.endTime - Date.now()) / 1000));
      
      io.to(roomId).emit('timer-tick', { remaining });

      if (remaining <= 0) {
        clearInterval(room.timer.intervalId);
        room.timer = null;
        io.to(roomId).emit('timer-ended');
      }
    }, 1000);
  });

  // Stop timer
  socket.on('stop-timer', () => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room || !room.timer) return;

    if (room.timer.intervalId) {
      clearInterval(room.timer.intervalId);
    }
    room.timer = null;

    io.to(roomId).emit('timer-stopped');
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    
    if (roomId) {
      const room = rooms.get(roomId);
      
      if (room) {
        room.participants.delete(socket.id);
        room.votes.delete(socket.id);

        console.log(`${socket.participantName} left room ${roomId}`);

        // Notify remaining participants
        socket.to(roomId).emit('participant-left', {
          oderId: socket.id,
          name: socket.participantName,
          roomState: getRoomState(roomId)
        });

        // Schedule cleanup for empty rooms (with grace period)
        if (room.participants.size === 0) {
          console.log(`Room ${roomId} is empty, scheduling cleanup in ${ROOM_CLEANUP_DELAY / 1000}s`);
          
          const cleanupTimer = setTimeout(() => {
            const roomToDelete = rooms.get(roomId);
            if (roomToDelete && roomToDelete.participants.size === 0) {
              if (roomToDelete.timer && roomToDelete.timer.intervalId) {
                clearInterval(roomToDelete.timer.intervalId);
              }
              rooms.delete(roomId);
              roomCleanupTimers.delete(roomId);
              console.log(`Room ${roomId} deleted (empty after grace period)`);
            }
          }, ROOM_CLEANUP_DELAY);
          
          roomCleanupTimers.set(roomId, cleanupTimer);
        }
      }
    }

    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('\n🃏 Planning Poker Server Started!\n');
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}`);
  console.log('\n   Share the Network URL with your team!\n');
});

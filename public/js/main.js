// Landing page logic
const socket = io();

// DOM Elements
const createRoomBtn = document.getElementById('create-room-btn');
const joinForm = document.getElementById('join-form');
const roomIdInput = document.getElementById('room-id');
const participantNameInput = document.getElementById('participant-name');
const errorMessage = document.getElementById('error-message');

// Modal elements
const nameModal = document.getElementById('name-modal');
const nameForm = document.getElementById('name-form');
const creatorNameInput = document.getElementById('creator-name');

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

// Create a new room - first show modal to get name
createRoomBtn.addEventListener('click', () => {
  // Show modal to enter name first
  nameModal.classList.remove('hidden');
  creatorNameInput.focus();
});

// Handle name form submission (create room with creator name)
nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = creatorNameInput.value.trim();
  
  if (!name) {
    showError('Please enter your name');
    return;
  }

  // Create room with creator name
  socket.emit('create-room', { creatorName: name }, (response) => {
    if (response.success) {
      // Store that this user is the creator
      sessionStorage.setItem('isCreator', 'true');
      joinRoom(response.roomId, name);
    } else {
      showError('Failed to create room. Please try again.');
    }
  });
});

// Handle join form submission
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const roomId = roomIdInput.value.trim().toUpperCase();
  const name = participantNameInput.value.trim();
  
  if (!roomId || !name) {
    showError('Please enter both room code and your name');
    return;
  }

  joinRoom(roomId, name);
});

// Join a room - just store info and redirect, actual join happens on room page
function joinRoom(roomId, name, isCreator = false) {
  // Store participant info in session storage
  sessionStorage.setItem('roomId', roomId);
  sessionStorage.setItem('participantName', name);
  if (!isCreator) {
    sessionStorage.removeItem('isCreator');
  }
  
  // Redirect to room page - the room.js will handle the actual join
  window.location.href = `/room.html?room=${roomId}`;
}

// Close modal when clicking outside
nameModal.addEventListener('click', (e) => {
  if (e.target === nameModal) {
    nameModal.classList.add('hidden');
  }
});

// Auto-uppercase room ID input
roomIdInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

// Check if there's a room parameter in URL (for shared links)
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
  roomIdInput.value = roomParam.toUpperCase();
  participantNameInput.focus();
}

// Room page logic
const socket = io();

// Get room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const participantName = sessionStorage.getItem('participantName');

// If no room ID or name, redirect to home
if (!roomId || !participantName) {
  window.location.href = '/';
}

// State
let currentVote = null;
let isRevealed = false;
let cardValues = [];
let creatorName = null;
let isCreator = false;

// DOM Elements
const roomCodeDisplay = document.getElementById('room-code-display');
const copyRoomCodeBtn = document.getElementById('copy-room-code');
const participantNameDisplay = document.getElementById('participant-name-display');
const participantsList = document.getElementById('participants-list');
const participantCount = document.getElementById('participant-count');
const cardsContainer = document.getElementById('cards-container');
const storyTitle = document.getElementById('story-title');
const storyDescription = document.getElementById('story-description');
const timerValue = document.getElementById('timer-value');
const timerDuration = document.getElementById('timer-duration');
const startTimerBtn = document.getElementById('start-timer-btn');
const stopTimerBtn = document.getElementById('stop-timer-btn');
const revealBtn = document.getElementById('reveal-btn');
const resetBtn = document.getElementById('reset-btn');
const resultsSection = document.getElementById('results-section');
const resultAverage = document.getElementById('result-average');
const resultConsensus = document.getElementById('result-consensus');
const resultsBreakdown = document.getElementById('results-breakdown');
const connectionStatus = document.getElementById('connection-status');

// Initialize room
function initRoom() {
  roomCodeDisplay.textContent = roomId;
  participantNameDisplay.textContent = participantName;

  // Join the room
  socket.emit('join-room', { roomId, name: participantName }, (response) => {
    if (response.success) {
      hasJoined = true;
      updateRoomState(response.roomState);
    } else {
      alert(response.error || 'Failed to join room');
      window.location.href = '/';
    }
  });
}

// Update room state
function updateRoomState(state) {
  if (!state) return;

  cardValues = state.cardValues || ['1', '2', '3', '5', '8', '13', '21', '?'];
  isRevealed = state.revealed;
  creatorName = state.creatorName;
  isCreator = (participantName === creatorName);

  // Update participants
  renderParticipants(state.participants, state.votes);

  // Update cards
  renderCards();

  // Update story
  if (state.story) {
    storyTitle.value = state.story.title || '';
    storyDescription.value = state.story.description || '';
  }

  // Update UI based on revealed state and creator status
  updateRevealedState();
  updateCreatorUI();
}

// Render participants
function renderParticipants(participants, votes) {
  participantsList.innerHTML = '';
  participantCount.textContent = `(${participants.length})`;

  participants.forEach((participant) => {
    const hasVoted = votes[participant.oderId] === true || 
                     (typeof votes[participant.oderId] === 'string' && votes[participant.oderId] !== '');
    const voteValue = isRevealed ? votes[participant.oderId] : null;
    const isHost = participant.name === creatorName;

    const card = document.createElement('div');
    card.className = 'participant-card';
    
    const avatarClasses = ['participant-avatar'];
    if (hasVoted && !isRevealed) avatarClasses.push('voted');
    if (isHost) avatarClasses.push('host');

    card.innerHTML = `
      <div class="${avatarClasses.join(' ')}">
        ${participant.name.charAt(0).toUpperCase()}
      </div>
      <div class="participant-name">
        ${escapeHtml(participant.name)}
        ${isHost ? '<span class="host-badge">Host</span>' : ''}
      </div>
      <div class="participant-vote">${voteValue || ''}</div>
    `;
    participantsList.appendChild(card);
  });
}

// Render cards
function renderCards() {
  cardsContainer.innerHTML = '';

  cardValues.forEach((value) => {
    const card = document.createElement('div');
    card.className = `poker-card ${currentVote === value ? 'selected' : ''} ${isRevealed ? 'disabled' : ''}`;
    card.textContent = value;
    card.dataset.value = value;

    if (!isRevealed) {
      card.addEventListener('click', () => selectCard(value));
    }

    cardsContainer.appendChild(card);
  });
}

// Select a card
function selectCard(value) {
  if (isRevealed) return;

  currentVote = value;
  renderCards();

  // Send vote to server
  socket.emit('submit-vote', { cardValue: value });
}

// Update UI based on revealed state
function updateRevealedState() {
  if (isRevealed) {
    revealBtn.classList.add('hidden');
    // Only show reset button to creator
    if (isCreator) {
      resetBtn.classList.remove('hidden');
    } else {
      resetBtn.classList.add('hidden');
    }
    resultsSection.classList.remove('hidden');

    // Disable cards
    document.querySelectorAll('.poker-card').forEach((card) => {
      card.classList.add('disabled');
    });
  } else {
    // Only show reveal button to creator
    if (isCreator) {
      revealBtn.classList.remove('hidden');
    } else {
      revealBtn.classList.add('hidden');
    }
    resetBtn.classList.add('hidden');
    resultsSection.classList.add('hidden');
  }
}

// Update UI for creator-only features
function updateCreatorUI() {
  // Show/hide action buttons based on creator status
  if (!isCreator) {
    revealBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
  }
}

// Calculate and display results
function displayResults(votes) {
  const numericVotes = [];
  const voteCounts = {};

  Object.values(votes).forEach((vote) => {
    if (vote && vote !== '?') {
      const num = parseInt(vote, 10);
      if (!isNaN(num)) {
        numericVotes.push(num);
      }
    }
    if (vote) {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    }
  });

  // Calculate average
  let average = '-';
  if (numericVotes.length > 0) {
    const sum = numericVotes.reduce((a, b) => a + b, 0);
    average = (sum / numericVotes.length).toFixed(1);
  }
  resultAverage.textContent = average;

  // Check for consensus
  const voteValues = Object.keys(voteCounts);
  let consensus = '-';
  if (voteValues.length === 1) {
    consensus = voteValues[0];
  } else if (voteValues.length > 0) {
    // Find most common vote
    const maxCount = Math.max(...Object.values(voteCounts));
    const mostCommon = voteValues.filter((v) => voteCounts[v] === maxCount);
    if (mostCommon.length === 1) {
      consensus = `${mostCommon[0]} (${maxCount}/${Object.values(votes).filter(Boolean).length})`;
    } else {
      consensus = 'No consensus';
    }
  }
  resultConsensus.textContent = consensus;

  // Display breakdown
  resultsBreakdown.innerHTML = '';
  const sortedVotes = Object.entries(voteCounts).sort((a, b) => {
    const aNum = parseInt(a[0], 10);
    const bNum = parseInt(b[0], 10);
    if (isNaN(aNum) && isNaN(bNum)) return 0;
    if (isNaN(aNum)) return 1;
    if (isNaN(bNum)) return -1;
    return aNum - bNum;
  });

  sortedVotes.forEach(([value, count]) => {
    const badge = document.createElement('div');
    badge.className = 'vote-badge';
    badge.innerHTML = `<span class="value">${value}</span><span class="count">(${count})</span>`;
    resultsBreakdown.appendChild(badge);
  });
}

// Copy room code
copyRoomCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(roomId).then(() => {
    copyRoomCodeBtn.title = 'Copied!';
    setTimeout(() => {
      copyRoomCodeBtn.title = 'Copy room code';
    }, 2000);
  });
});

// Story input handlers (debounced)
let storyTimeout;
function updateStory() {
  clearTimeout(storyTimeout);
  storyTimeout = setTimeout(() => {
    socket.emit('update-story', {
      title: storyTitle.value,
      description: storyDescription.value
    });
  }, 500);
}

storyTitle.addEventListener('input', updateStory);
storyDescription.addEventListener('input', updateStory);

// Timer controls
startTimerBtn.addEventListener('click', () => {
  const duration = parseInt(timerDuration.value, 10);
  socket.emit('start-timer', { duration });
});

stopTimerBtn.addEventListener('click', () => {
  socket.emit('stop-timer');
});

// Reveal votes
revealBtn.addEventListener('click', () => {
  socket.emit('reveal-votes');
});

// Reset votes
resetBtn.addEventListener('click', () => {
  socket.emit('reset-votes');
});

// Socket event handlers
socket.on('participant-joined', ({ participant, roomState }) => {
  updateRoomState(roomState);
});

socket.on('participant-left', ({ oderId, name, roomState }) => {
  updateRoomState(roomState);
});

socket.on('vote-received', ({ oderId, roomState }) => {
  updateRoomState(roomState);
});

socket.on('votes-revealed', ({ roomState }) => {
  isRevealed = true;
  updateRoomState(roomState);
  displayResults(roomState.votes);
});

socket.on('votes-reset', ({ roomState }) => {
  currentVote = null;
  isRevealed = false;
  updateRoomState(roomState);
});

socket.on('story-updated', ({ story }) => {
  // Only update if different (to avoid cursor jumping)
  if (document.activeElement !== storyTitle && storyTitle.value !== story.title) {
    storyTitle.value = story.title;
  }
  if (document.activeElement !== storyDescription && storyDescription.value !== story.description) {
    storyDescription.value = story.description;
  }
});

socket.on('timer-started', ({ endTime, duration }) => {
  startTimerBtn.classList.add('hidden');
  stopTimerBtn.classList.remove('hidden');
  timerDuration.disabled = true;
});

socket.on('timer-tick', ({ remaining }) => {
  timerValue.textContent = remaining;
});

socket.on('timer-ended', () => {
  timerValue.textContent = '0';
  startTimerBtn.classList.remove('hidden');
  stopTimerBtn.classList.add('hidden');
  timerDuration.disabled = false;
});

socket.on('timer-stopped', () => {
  timerValue.textContent = '--';
  startTimerBtn.classList.remove('hidden');
  stopTimerBtn.classList.add('hidden');
  timerDuration.disabled = false;
});

// Track if we've already joined
let hasJoined = false;

// Connection status
socket.on('connect', () => {
  connectionStatus.classList.add('hidden');
  // Only rejoin on REconnect (not initial connect)
  if (hasJoined && roomId && participantName) {
    console.log('Reconnecting to room...');
    socket.emit('join-room', { roomId, name: participantName }, (response) => {
      if (response.success) {
        updateRoomState(response.roomState);
      }
    });
  }
});

socket.on('disconnect', () => {
  connectionStatus.classList.remove('hidden');
});

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
initRoom();

# Planning Poker

A lightweight, real-time Planning Poker application for agile estimation. Run it locally and share with your team on the same network.

## Features

- **Real-time voting** - All participants see updates instantly via WebSockets
- **Fibonacci estimation** - Cards: 1, 2, 3, 5, 8, 13, 21, ?
- **Timer** - Configurable countdown timer (30s, 60s, 90s, 2min)
- **Story input** - Add title and description for the item being estimated
- **Vote reveal & reset** - Reveal all votes at once, then reset for the next story
- **Results summary** - Shows average and consensus after reveal
- **No database required** - All data is stored in-memory

## Quick Start

### Prerequisites

- Node.js 16+ installed

### Installation

```bash
# Install dependencies
npm install

# Start the server
npm start
```

### Access the Application

Once started, the server will display:

```
🃏 Planning Poker Server Started!

   Local:   http://localhost:3000
   Network: http://192.168.x.x:3000

   Share the Network URL with your team!
```

- **You**: Open `http://localhost:3000` in your browser
- **Your team**: Share the Network URL (e.g., `http://192.168.1.100:3000`)

> **Note**: All participants must be on the same local network (office WiFi, VPN, etc.)

## How to Use

### Create a Session

1. Click **"Create Room"** on the landing page
2. Enter your name
3. Share the room code with your team

### Join a Session

1. Enter the room code shared by a teammate
2. Enter your name
3. Click **"Join Room"**

### Voting Flow

1. Add a story title and description (optional)
2. Start the timer (optional)
3. Everyone selects their estimate card
4. Click **"Reveal Votes"** to show all estimates
5. Discuss the results
6. Click **"Reset for Next Story"** to vote on the next item

## Configuration

### Port

Change the default port by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### Firewall

If teammates can't connect, you may need to allow incoming connections on your firewall:

**macOS:**
```bash
# Allow port 3000
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

**Windows:**
- Open Windows Defender Firewall
- Add inbound rule for port 3000

## Project Structure

```
planning-poker/
├── server.js           # Express + Socket.IO server
├── package.json        # Dependencies
├── public/
│   ├── index.html      # Landing page
│   ├── room.html       # Voting room
│   ├── css/
│   │   └── styles.css  # Styling
│   └── js/
│       ├── main.js     # Landing page logic
│       └── room.js     # Room logic
└── README.md
```

## Technology Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Real-time**: WebSockets via Socket.IO

## License

MIT

const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, './')));

// --- ADMIN CREDENTIALS ---
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "SecretPassword123";

let platformStats = {
  totalUsers: 0,
  activePlayers: 0,
  totalDeposited: 0,
  totalPayouts: 0
};

// Generate infinite queue of multipliers
let crashQueue = [];
function generateCrashMultiplier() {
  // Generates random crash between 1.10x and 15.00x
  return parseFloat((1.10 + Math.random() * (15 - 1.10)).toFixed(2));
}

for (let i = 0; i < 20; i++) {
  crashQueue.push(generateCrashMultiplier());
}

// Live state engine running continuously on backend
let currentRoundIndex = 0;
let roundStartTime = Date.now();

setInterval(() => {
  // Auto-advance to next round every 12 seconds
  if (Date.now() - roundStartTime > 12000) {
    currentRoundIndex++;
    roundStartTime = Date.now();
    crashQueue.push(generateCrashMultiplier());
  }
}, 1000);

// API endpoint returning current engine state
app.get('/api/live-state', (req, res) => {
  const elapsedTime = (Date.now() - roundStartTime) / 1000;
  res.json({
    elapsedTime: elapsedTime,
    currentCrash: crashQueue[currentRoundIndex],
    roundPlus1: crashQueue[currentRoundIndex + 1],
    roundPlus2: crashQueue[currentRoundIndex + 2],
    roundPlus3: crashQueue[currentRoundIndex + 3], // Admin +3 Simulator target
    roundPlus4: crashQueue[currentRoundIndex + 4],
    roundIndex: currentRoundIndex
  });
});

// Basic HTTP Auth
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Authentication required.');
  }
  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  if (auth[0] === ADMIN_USER && auth[1] === ADMIN_PASS) {
    return next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Invalid credentials.');
  }
}

// Secret Admin Route
app.get('/admin', adminAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SkyRush Owner Dashboard - Live Continuous Simulator</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #0b0e14; color: #fff; padding: 25px; margin: 0; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px; }
          .card { background: #161b22; border: 1px solid #30363d; padding: 15px; border-radius: 8px; }
          .card h3 { margin: 0 0 5px 0; color: #8b949e; font-size: 13px; }
          .card p { margin: 0; font-size: 22px; font-weight: bold; color: #00e676; }
          
          .sim-container { display: flex; gap: 20px; flex-wrap: wrap; }
          .stage { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 15px; flex: 1; min-width: 320px; }
          canvas { background: #0d1117; border-radius: 6px; width: 100%; height: 220px; }
          
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .badge-live { background: #d32f2f; color: #fff; }
          .badge-future { background: #0288d1; color: #fff; }
          
          .queue-list { background: #161b22; border: 1px solid #30363d; padding: 15px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>SkyRush Control Center</h1>
        <p style="color: #8b949e; margin-bottom: 20px;">Continuous Real-Time Telemetry Engine</p>

        <div class="grid">
          <div class="card"><h3>Total Registered</h3><p>${platformStats.totalUsers}</p></div>
          <div class="card"><h3>Active Players</h3><p>${platformStats.activePlayers}</p></div>
          <div class="card"><h3>Total Deposits</h3><p>KSh ${platformStats.totalDeposited}</p></div>
          <div class="card"><h3>Total Paid Out</h3><p>KSh ${platformStats.totalPayouts}</p></div>
        </div>

        <div class="sim-container">
          <!-- PUBLIC LIVE ROUND -->
          <div class="stage">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3>Public Live Screen</h3>
              <span class="badge badge-live" id="roundTag">ROUND #0</span>
            </div>
            <canvas id="liveCanvas"></canvas>
            <h2 id="liveText" style="text-align:center; color:#00e676; margin:10px 0 0 0;">1.00x</h2>
          </div>

          <!-- ADMIN +3 SIMULATOR -->
          <div class="stage">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3>Admin Simulator Preview</h3>
              <span class="badge badge-future">+3 ROUNDS AHEAD</span>
            </div>
            <canvas id="simCanvas"></canvas>
            <h2 id="simText" style="text-align:center; color:#29b6f6; margin:10px 0 0 0;">1.00x</h2>
          </div>
        </div>

        <div class="queue-list">
          <h3 style="margin-top:0; color:#00e676;">Live Multiplier Queue Stream</h3>
          <p><strong>Current Public Target:</strong> <span id="q0" style="color:#ff5252">--</span></p>
          <p><strong>Round +1 Ahead:</strong> <span id="q1">--</span></p>
          <p><strong>Round +2 Ahead:</strong> <span id="q2">--</span></p>
          <p><strong>Round +3 Ahead (Simulator Screen):</strong> <span id="q3" style="color:#29b6f6">--</span></p>
          <p><strong>Round +4 Ahead:</strong> <span id="q4">--</span></p>
        </div>

        <script>
          const liveCanvas = document.getElementById('liveCanvas');
          const simCanvas = document.getElementById('simCanvas');
          const ctxLive = liveCanvas.getContext('2d');
          const ctxSim = simCanvas.getContext('2d');

          function drawFlight(ctx, canvas, elapsed, targetMult, color, textId) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calculate real-time multiplier progression
            let currentMult = 1.00 + (elapsed * 0.4);
            let progress = Math.min(1, (currentMult - 1.00) / (targetMult - 1.00));

            if (currentMult < targetMult) {
              const x = 10 + (progress * (canvas.width - 40));
              const y = (canvas.height - 10) - (progress * (canvas.height - 40));

              ctx.beginPath();
              ctx.moveTo(10, canvas.height - 10);
              ctx.quadraticCurveTo(x / 2, canvas.height - 10, x, y);
              ctx.strokeStyle = color;
              ctx.lineWidth = 3;
              ctx.stroke();

              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, Math.PI * 2);
              ctx.fill();

              document.getElementById(textId).innerText = currentMult.toFixed(2) + "x";
              document.getElementById(textId).style.color = color;
            } else {
              ctx.fillStyle = "#ff1744";
              ctx.font = "bold 16px sans-serif";
              ctx.fillText("CRASHED @ " + targetMult + "x", canvas.width / 4, canvas.height / 2);
              document.getElementById(textId).innerText = "FLEW AWAY (" + targetMult + "x)";
              document.getElementById(textId).style.color = "#ff1744";
            }
          }

          async function syncEngine() {
            try {
              const res = await fetch('/api/live-state');
              const data = await res.json();

              document.getElementById('roundTag').innerText = "ROUND #" + data.roundIndex;
              document.getElementById('q0').innerText = data.currentCrash + "x";
              document.getElementById('q1').innerText = data.roundPlus1 + "x";
              document.getElementById('q2').innerText = data.roundPlus2 + "x";
              document.getElementById('q3').innerText = data.roundPlus3 + "x";
              document.getElementById('q4').innerText = data.roundPlus4 + "x";

              drawFlight(ctxLive, liveCanvas, data.elapsedTime, data.currentCrash, '#00e676', 'liveText');
              drawFlight(ctxSim, simCanvas, data.elapsedTime, data.roundPlus3, '#29b6f6', 'simText');
            } catch (e) {
              console.error(e);
            }
          }

          // Fetch state and re-render every 100ms for smooth live motion
          setInterval(syncEngine, 100);
        </script>
      </body>
    </html>
  `);
});

app.post('/api/v1/mpesa/stkpush', (req, res) => {
  const { amount } = req.body;
  platformStats.totalDeposited += Number(amount) || 0;
  res.json({ status: 'Success' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

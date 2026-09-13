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

// Queue of crash points (Index 0 = current live game, 1 = Next, 2 = Next+1, 3 = Next+2)
let crashQueue = [2.45, 1.80, 5.12, 1.15, 12.40];

function generateCrashMultiplier() {
  return (Math.random() * (10 - 1) + 1).toFixed(2);
}

// Keep a healthy queue of future rounds
function replenishQueue() {
  while (crashQueue.length < 10) {
    crashQueue.push(generateCrashMultiplier());
  }
}
replenishQueue();

// Basic HTTP Auth Middleware
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

// Protected Secret Admin Route
app.get('/admin', adminAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SkyRush Owner Dashboard - Live Simulator</title>
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
        <p style="color: #8b949e; margin-bottom: 20px;">Live Visual Plane Telemetry & Future Crash Simulator</p>

        <div class="grid">
          <div class="card"><h3>Total Registered</h3><p>${platformStats.totalUsers}</p></div>
          <div class="card"><h3>Active Players</h3><p>${platformStats.activePlayers}</p></div>
          <div class="card"><h3>Total Deposits</h3><p>KSh ${platformStats.totalDeposited}</p></div>
          <div class="card"><h3>Total Paid Out</h3><p>KSh ${platformStats.totalPayouts}</p></div>
        </div>

        <div class="sim-container">
          <!-- STAGE 1: CURRENT PUBLIC ROUND -->
          <div class="stage">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3>Public Live Screen</h3>
              <span class="badge badge-live">ROUND #0 (NOW PLAYING)</span>
            </div>
            <canvas id="liveCanvas"></canvas>
            <h2 id="liveText" style="text-align:center; color:#00e676; margin:10px 0 0 0;">1.00x</h2>
          </div>

          <!-- STAGE 2: ADVANCED SIMULATOR (+3 ROUNDS AHEAD) -->
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
          <h3 style="margin-top:0; color:#00e676;">Pre-Generated Multiplier Sequence</h3>
          <p><strong>Current Public Crash Point:</strong> <span style="color:#ff5252">${crashQueue[0]}x</span></p>
          <p><strong>Round +1 Ahead:</strong> ${crashQueue[1]}x</p>
          <p><strong>Round +2 Ahead:</strong> ${crashQueue[2]}x</p>
          <p><strong>Round +3 Ahead (Simulator Screen):</strong> <span style="color:#29b6f6">${crashQueue[3]}x</span></p>
          <p><strong>Round +4 Ahead:</strong> ${crashQueue[4]}x</p>
        </div>

        <script>
          // Current live crash target and +3 future crash target
          const liveTarget = parseFloat("${crashQueue[0]}");
          const simTarget = parseFloat("${crashQueue[3]}");

          function createFlightSimulator(canvasId, textId, targetMultiplier, color) {
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');
            let currentMult = 1.00;
            let progress = 0;

            function draw() {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // Draw Flight Curve Line
              ctx.beginPath();
              ctx.moveTo(10, canvas.height - 10);
              const x = 10 + (progress * (canvas.width - 40));
              const y = (canvas.height - 10) - (progress * (canvas.height - 40));
              
              ctx.quadraticCurveTo(x / 2, canvas.height - 10, x, y);
              ctx.strokeStyle = color;
              ctx.lineWidth = 3;
              ctx.stroke();

              // Draw Flying Rocket / Plane Indicator
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, Math.PI * 2);
              ctx.fill();

              if (currentMult < targetMultiplier) {
                currentMult += 0.01 + (currentMult * 0.002);
                progress = Math.min(1, progress + 0.005);
                document.getElementById(textId).innerText = currentMult.toFixed(2) + "x";
                requestAnimationFrame(draw);
              } else {
                ctx.fillStyle = "#ff1744";
                ctx.font = "bold 16px sans-serif";
                ctx.fillText("FLEW AWAY @ " + targetMultiplier + "x", canvas.width / 4, canvas.height / 2);
                document.getElementById(textId).innerText = "FLEW AWAY!";
                document.getElementById(textId).style.color = "#ff1744";
              }
            }
            draw();
          }

          // Run Public Plane & Admin +3 Simulator simultaneously
          createFlightSimulator('liveCanvas', 'liveText', liveTarget, '#00e676');
          createFlightSimulator('simCanvas', 'simText', simTarget, '#29b6f6');
        </script>
      </body>
    </html>
  `);
});

// Endpoint triggered on game bet
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
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. CONFIGURATION & DARAJA CREDENTIALS
// ==========================================

// --- PASTE YOUR KEYS HERE FROM DARAJA PORTAL ---
const DARAJA_CONSUMER_KEY = "VxMgo3QTXOMgt0TSx7AektXTm6OeBR6iLvfMabWtlK4Bg633";
const DARAJA_CONSUMER_SECRET = "q6iMrVsXjIob0jtqnWkb1hZgXuJgKKTgaxCZAm5ZxfrhkPmxVMEum3jFS3elEzac";

// --- DEFAULT SAFARICOM SANDBOX VALUES ---
const DARAJA_SHORTCODE = "174379";
const DARAJA_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const DARAJA_CALLBACK_URL = "https://mydomain.com/api/v1/mpesa/callback";

const ADMIN_USER = "admin";
const ADMIN_PASS = "SecretPassword123";

// ==========================================
// 2. GAME ENGINE & DUAL SYNC
// ==========================================
let platformStats = { totalUsers: 0, activePlayers: 0, totalDeposited: 0, totalPayouts: 0 };
let crashQueue = [];

function generateCrashMultiplier() {
  const rand = Math.random();
  if (rand < 0.05) return 1.00;
  return parseFloat((1.05 + Math.pow(Math.random(), 2) * 11).toFixed(2));
}

for (let i = 0; i < 100; i++) {
  crashQueue.push(generateCrashMultiplier());
}

let currentRoundIndex = 0;
let roundStartTime = Date.now();
const ROUND_DURATION_MS = 14000;

setInterval(() => {
  if (Date.now() - roundStartTime >= ROUND_DURATION_MS) {
    currentRoundIndex++;
    roundStartTime = Date.now();
    crashQueue.push(generateCrashMultiplier());
  }
}, 50);

app.get('/api/live-state', (req, res) => {
  const elapsedTime = (Date.now() - roundStartTime) / 1000;
  res.json({
    elapsedTime: elapsedTime,
    currentCrash: crashQueue[currentRoundIndex] || 1.00,
    nextCrash: crashQueue[currentRoundIndex + 1] || 1.00,
    roundPlus2: crashQueue[currentRoundIndex + 2] || 1.00,
    roundPlus3: crashQueue[currentRoundIndex + 3] || 1.00,
    roundIndex: currentRoundIndex
  });
});

// Basic Auth Middleware
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required.');
  }
  const auth = Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString().split(':');
  if (auth[0] === ADMIN_USER && auth[1] === ADMIN_PASS) {
    return next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Invalid credentials.');
  }
}

// Admin UI
app.get('/admin', adminAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SkyRush Control Center</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0b0e14; color: #fff; padding: 25px; margin: 0; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px; }
          .card { background: #161b22; border: 1px solid #30363d; padding: 15px; border-radius: 8px; }
          .card h3 { margin: 0 0 5px 0; color: #8b949e; font-size: 13px; }
          .card p { margin: 0; font-size: 22px; font-weight: bold; color: #00e676; }
          .sim-container { display: flex; gap: 20px; flex-wrap: wrap; }
          .stage { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 15px; flex: 1; min-width: 320px; }
          canvas { background: #0d1117; border-radius: 6px; width: 100%; height: 230px; display: block; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .badge-live { background: #d32f2f; color: #fff; }
          .badge-future { background: #0288d1; color: #fff; }
          .queue-list { background: #161b22; border: 1px solid #30363d; padding: 15px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>SkyRush Control Center</h1>
        <p style="color: #8b949e; margin-bottom: 20px;">Synchronized Dual-Engine Flight Control</p>

        <div class="grid">
          <div class="card"><h3>Total Registered</h3><p>${platformStats.totalUsers}</p></div>
          <div class="card"><h3>Active Players</h3><p>${platformStats.activePlayers}</p></div>
          <div class="card"><h3>Total Deposits</h3><p>KSh ${platformStats.totalDeposited}</p></div>
          <div class="card"><h3>Total Paid Out</h3><p>KSh ${platformStats.totalPayouts}</p></div>
        </div>

        <div class="sim-container">
          <div class="stage">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3>Public Live Screen (Current Round)</h3>
              <span class="badge badge-live" id="roundTag">ROUND #0</span>
            </div>
            <canvas id="liveCanvas" width="500" height="230"></canvas>
            <h2 id="liveText" style="text-align:center; color:#00e676; margin:10px 0 0 0;">1.00x</h2>
          </div>

          <div class="stage">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3>Admin Simulator (Immediate Next Round)</h3>
              <span class="badge badge-future" id="nextTag">ROUND #1 PREVIEW</span>
            </div>
            <canvas id="simCanvas" width="500" height="230"></canvas>
            <h2 id="simText" style="text-align:center; color:#29b6f6; margin:10px 0 0 0;">1.00x</h2>
          </div>
        </div>

        <div class="queue-list">
          <h3 style="margin-top:0; color:#00e676;">Next Multiplier Targets</h3>
          <p><strong>Public Current Target:</strong> <span id="q0" style="color:#00e676; font-weight:bold;">--</span></p>
          <p><strong>Immediate Next Round Target (Admin Canvas):</strong> <span id="q1" style="color:#29b6f6; font-weight:bold;">--</span></p>
          <p><strong>Round +2 Target:</strong> <span id="q2">--</span></p>
        </div>

        <script>
          const liveCanvas = document.getElementById('liveCanvas');
          const simCanvas = document.getElementById('simCanvas');
          const ctxLive = liveCanvas.getContext('2d');
          const ctxSim = simCanvas.getContext('2d');

          function renderFlight(ctx, canvas, elapsed, targetMult, color, textId) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let currentMult = parseFloat((1.00 + Math.pow(elapsed, 1.7) * 0.12).toFixed(2));

            if (currentMult < targetMult && elapsed < 10) {
              let progress = Math.min(1, elapsed / 10);
              const x = 20 + (progress * (canvas.width - 50));
              const y = (canvas.height - 20) - (Math.pow(progress, 0.85) * (canvas.height - 50));

              ctx.beginPath();
              ctx.moveTo(20, canvas.height - 20);
              ctx.quadraticCurveTo(x / 2, canvas.height - 20, x, y);
              ctx.strokeStyle = color;
              ctx.lineWidth = 4;
              ctx.stroke();

              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, Math.PI * 2);
              ctx.fill();

              document.getElementById(textId).innerText = currentMult.toFixed(2) + "x";
              document.getElementById(textId).style.color = color;
            } else {
              ctx.fillStyle = "#ff1744";
              ctx.font = "bold 18px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("FLEW AWAY @ " + targetMult.toFixed(2) + "x", canvas.width / 2, canvas.height / 2);
              
              document.getElementById(textId).innerText = "FLEW AWAY @ " + targetMult.toFixed(2) + "x";
              document.getElementById(textId).style.color = "#ff1744";
            }
          }

          async function syncEngine() {
            try {
              const res = await fetch('/api/live-state');
              const data = await res.json();

              document.getElementById('roundTag').innerText = "ROUND #" + data.roundIndex;
              document.getElementById('nextTag').innerText = "ROUND #" + (data.roundIndex + 1) + " (PREVIEW)";
              
              document.getElementById('q0').innerText = Number(data.currentCrash).toFixed(2) + "x";
              document.getElementById('q1').innerText = Number(data.nextCrash).toFixed(2) + "x";
              document.getElementById('q2').innerText = Number(data.roundPlus2).toFixed(2) + "x";

              renderFlight(ctxLive, liveCanvas, data.elapsedTime, data.currentCrash, '#00e676', 'liveText');
              renderFlight(ctxSim, simCanvas, data.elapsedTime, data.nextCrash, '#29b6f6', 'simText');
            } catch (e) {
              console.error('Sync Error:', e);
            }
          }

          setInterval(syncEngine, 100);
        </script>
      </body>
    </html>
  `);
});

// ==========================================
// 3. M-PESA DARAJA STK PUSH API
// ==========================================

async function getDarajaAccessToken() {
  if (DARAJA_CONSUMER_KEY === "PASTE_YOUR_CONSUMER_KEY_HERE" || DARAJA_CONSUMER_SECRET === "PASTE_YOUR_CONSUMER_SECRET_HERE") {
    throw new Error('Please replace PASTE_YOUR_CONSUMER_KEY_HERE and PASTE_YOUR_CONSUMER_SECRET_HERE with your real Daraja keys in server.js');
  }

  const credentials = Buffer
    .from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`)
    .toString('base64');

  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      headers: { Authorization: `Basic ${credentials}` }
    }
  );

  return response.data.access_token;
}

function createTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

app.post('/api/v1/mpesa/stkpush', async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone number and amount are required' });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const accessToken = await getDarajaAccessToken();
    const timestamp = createTimestamp();

    const password = Buffer
      .from(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`)
      .toString('base64');

    let formattedPhone = String(phone).replace(/\s+/g, '');
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.substring(1);
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1);

    const stkResponse = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(numericAmount),
        PartyA: formattedPhone,
        PartyB: DARAJA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: DARAJA_CALLBACK_URL,
        AccountReference: 'SkyRushDemo',
        TransactionDesc: 'SkyRush Sandbox Test'
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Daraja STK Response:', stkResponse.data);

    res.json({
      success: true,
      message: 'STK Push request sent',
      data: stkResponse.data
    });

  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error('Daraja STK Error:', errorDetails);

    res.status(500).json({
      success: false,
      error: error.response?.data?.errorMessage || error.response?.data?.errorCode || error.message || 'STK Push failed'
    });
  }
});

app.post('/api/v1/mpesa/callback', (req, res) => {
  console.log('M-Pesa Callback:', JSON.stringify(req.body, null, 2));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// ==========================================
// 4. STATIC SERVING & STARTUP
// ==========================================
app.use(express.static(path.join(__dirname, './')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin dashboard available at http://localhost:${PORT}/admin`);
});

const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// Serve static frontend files (index.html, styles, client scripts)
app.use(express.static(path.join(__dirname, './')));

// --- ADMIN & STATS TRACKER ---
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "SecretPassword123";

// Simple in-memory metrics store
let platformStats = {
  totalUsers: 0,
  activePlayers: 0,
  totalDeposited: 0,
  totalPayouts: 0,
  recentTransactions: []
};

// Queue to pre-generate crash odds
let upcomingCrashes = [];

function generateUpcomingCrashes(count = 5) {
  upcomingCrashes = [];
  for (let i = 0; i < count; i++) {
    // Generates random multipliers (e.g., 1.25x, 4.80x, 1.05x)
    let multiplier = (Math.random() * (10 - 1) + 1).toFixed(2);
    upcomingCrashes.push(multiplier);
  }
}

// Generate initial batch of crash odds
generateUpcomingCrashes();

// Admin Protection Middleware
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

// Secret Owner Dashboard Route (Shows stats + upcoming crash odds)
app.get('/admin', adminAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SkyRush Owner Dashboard</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #0b0e14; color: #fff; padding: 30px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
          .card { background: #161b22; border: 1px solid #30363d; padding: 20px; border-radius: 8px; }
          .card h3 { margin: 0 0 10px 0; color: #8b949e; font-size: 14px; }
          .card p { margin: 0; font-size: 24px; font-weight: bold; color: #00e676; }
          .odds-box { background: #1f242d; padding: 15px; border-radius: 8px; margin-top: 20px; border: 1px solid #00e676; }
        </style>
      </head>
      <body>
        <h1>SkyRush Control Center</h1>
        <p style="color: #8b949e;">Live Platform Analytics & Crash Control</p>

        <div class="grid">
          <div class="card"><h3>Total Registered Users</h3><p>${platformStats.totalUsers}</p></div>
          <div class="card"><h3>Active Players Now</h3><p>${platformStats.activePlayers}</p></div>
          <div class="card"><h3>Total Deposits</h3><p>KSh ${platformStats.totalDeposited}</p></div>
          <div class="card"><h3>Total Paid Out</h3><p>KSh ${platformStats.totalPayouts}</p></div>
        </div>

        <div class="odds-box">
          <h2 style="color: #00e676; margin-top: 0;">Upcoming Crash Multipliers</h2>
          <p><strong>Next Game Round (Current):</strong> ${upcomingCrashes[0]}x</p>
          <p><strong>Round +1:</strong> ${upcomingCrashes[1]}x</p>
          <p><strong>Round +2:</strong> ${upcomingCrashes[2]}x</p>
          <p><strong>Round +3:</strong> ${upcomingCrashes[3]}x</p>
          <p><strong>Round +4:</strong> ${upcomingCrashes[4]}x</p>
        </div>
      </body>
    </html>
  `);
});

// --- M-PESA API ROUTES ---
app.post('/api/v1/mpesa/stkpush', (req, res) => {
  const { amount, phone } = req.body;
  
  // Track deposit stats
  platformStats.totalDeposited += Number(amount) || 0;
  platformStats.recentTransactions.push({ phone, amount, type: 'Deposit', time: new Date() });

  res.json({ status: 'Success', message: 'STK Push Triggered' });
});

// Fallback route: Serves index.html for regular website visitors
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
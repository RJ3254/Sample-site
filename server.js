// SaaS Samples - Demo Server with NVIDIA NIM Proxy
// Run: node server.js
// Opens at: http://localhost:3000

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const STATIC_DIR = __dirname;

// ============================================================
//  🔐 SECRET — API key lives ONLY here, never sent to clients
// ============================================================
const NVIDIA_API_KEY = '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';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  // === NVIDIA NIM API PROXY ===
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        // 🔐 Always use server-side key — NEVER trust client to supply it
        const requestBody = JSON.stringify({
          model: payload.model || 'moonshotai/kimi-k2-instruct',
          messages: payload.messages,
          temperature: payload.temperature || 0.7,
          max_tokens: payload.max_tokens || 300,
          stream: false
        });

        const options = {
          hostname: 'integrate.api.nvidia.com',
          port: 443,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Length': Buffer.byteLength(requestBody)
          }
        };

        const proxyReq = https.request(options, (proxyRes) => {
          let data = '';
          proxyRes.on('data', chunk => data += chunk);
          proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
          });
        });

        proxyReq.on('error', (err) => {
          console.error('Proxy error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy request failed', details: err.message }));
        });

        proxyReq.write(requestBody);
        proxyReq.end();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', details: e.message }));
      }
    });
    return;
  }

  // === STATIC FILE SERVER ===
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(STATIC_DIR, filePath.split('?')[0]);

  // Security: prevent path traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) {
      // Try index.html in directory
      const indexPath = path.join(filePath, 'index.html');
      fs.readFile(indexPath, (err2, data) => {
        if (err2) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err2, data) => {
      if (err2) { res.writeHead(500); res.end('Server Error'); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log('\n🚀 SaaS Demo Server running!');
  console.log(`\n   📦 Showcase:  http://localhost:${PORT}`);
  console.log(`   ⚡ FlowDesk:  http://localhost:${PORT}/flowdesk`);
  console.log(`   💼 NexusCRM:  http://localhost:${PORT}/nexuscrm`);
  console.log(`   🌿 PulseHR:   http://localhost:${PORT}/pulsehr`);
  console.log(`   📊 DataLens:  http://localhost:${PORT}/datalens`);
  console.log('\n   🤖 AI Proxy: http://localhost:${PORT}/api/chat');
  console.log('\n   Press Ctrl+C to stop\n');
});

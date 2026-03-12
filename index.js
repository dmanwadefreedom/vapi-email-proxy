const http = require('http');
const https = require('https');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8cMhZhxrOEGIsGaN9a2CZghCRENn3D-hQ-ON28TQKAe725dS2DSnoMTNG-gixdBUqmQ/exec';

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'ok', message: 'VAPI email proxy is live'}));
    return;
  }
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    // POST to Apps Script
    const url = new URL(APPS_SCRIPT_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {'Content-Type': 'application/json'}
    };
    
    const proxyReq = https.request(options, (proxyRes) => {
      // Follow 302 redirect
      if (proxyRes.statusCode === 302 && proxyRes.headers.location) {
        const redirectUrl = new URL(proxyRes.headers.location);
        const getOpts = {
          hostname: redirectUrl.hostname,
          path: redirectUrl.pathname + redirectUrl.search,
          method: 'GET'
        };
        https.get(getOpts, (finalRes) => {
          let data = '';
          finalRes.on('data', chunk => data += chunk);
          finalRes.on('end', () => {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(data);
          });
        }).on('error', (e) => {
          res.writeHead(500, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({results: [{result: 'Redirect error: ' + e.message}]}));
        });
      } else {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(data);
        });
      }
    });
    
    proxyReq.on('error', (e) => {
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({results: [{result: 'Proxy error: ' + e.message}]}));
    });
    
    proxyReq.write(body);
    proxyReq.end();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('VAPI email proxy running on port ' + PORT));

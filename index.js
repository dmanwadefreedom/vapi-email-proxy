const http = require('http');
const https = require('https');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxE0SDGb_VsvG_L-dwTKTsukybaNvdshvd1DyZYVlj0AuHu3mKhzNQtACxPVSINBj3nQw/exec';

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.headers['user-agent'] || 'unknown'}`);
  
  if (req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'ok', message: 'VAPI email proxy is live'}));
    return;
  }
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    console.log(`[${new Date().toISOString()}] POST body: ${body.substring(0, 300)}`);
    
    const url = new URL(APPS_SCRIPT_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {'Content-Type': 'application/json'}
    };
    
    const proxyReq = https.request(options, (proxyRes) => {
      console.log(`[${new Date().toISOString()}] Apps Script response: ${proxyRes.statusCode}`);
      
      if (proxyRes.statusCode === 302 && proxyRes.headers.location) {
        console.log(`[${new Date().toISOString()}] Following redirect...`);
        const redirectUrl = new URL(proxyRes.headers.location);
        https.get({
          hostname: redirectUrl.hostname,
          path: redirectUrl.pathname + redirectUrl.search,
          method: 'GET'
        }, (finalRes) => {
          let data = '';
          finalRes.on('data', chunk => data += chunk);
          finalRes.on('end', () => {
            console.log(`[${new Date().toISOString()}] Final response: ${data.substring(0, 200)}`);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(data);
          });
        }).on('error', (e) => {
          console.log(`[${new Date().toISOString()}] Redirect error: ${e.message}`);
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({results: [{result: 'Redirect error: ' + e.message}]}));
        });
      } else {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          console.log(`[${new Date().toISOString()}] Direct response: ${data.substring(0, 200)}`);
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(data);
        });
      }
    });
    
    proxyReq.on('error', (e) => {
      console.log(`[${new Date().toISOString()}] Proxy error: ${e.message}`);
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({results: [{result: 'Proxy error: ' + e.message}]}));
    });
    
    proxyReq.write(body);
    proxyReq.end();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('VAPI email proxy running on port ' + PORT));

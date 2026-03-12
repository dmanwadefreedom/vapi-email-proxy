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
    console.log(`[${new Date().toISOString()}] POST body: ${body.substring(0, 500)}`);

    // Parse the incoming request to extract email for logging
    let emailTo = 'unknown';
    try {
      const parsed = JSON.parse(body);
      const tc = parsed.message && parsed.message.toolCalls && parsed.message.toolCalls[0];
      if (tc) {
        const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        emailTo = args.email || 'unknown';
      }
    } catch(e) {}

    // Respond to VAPI IMMEDIATELY — don't wait for Apps Script
    // This prevents the "No result returned" timeout error
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({results: [{result: 'Email sent successfully to ' + emailTo}]}));
    console.log(`[${new Date().toISOString()}] Responded to VAPI immediately for ${emailTo}`);

    // Now fire the email in the background
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
          path: redirectUrl.pathname + redirectUrl.search
        }, (finalRes) => {
          let data = '';
          finalRes.on('data', chunk => data += chunk);
          finalRes.on('end', () => {
            console.log(`[${new Date().toISOString()}] Background email result: ${data.substring(0, 200)}`);
          });
        }).on('error', (e) => {
          console.log(`[${new Date().toISOString()}] Redirect error: ${e.message}`);
        });
      } else {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          console.log(`[${new Date().toISOString()}] Background direct response: ${data.substring(0, 200)}`);
        });
      }
    });

    proxyReq.on('error', (e) => {
      console.log(`[${new Date().toISOString()}] Background proxy error: ${e.message}`);
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('VAPI email proxy running on port ' + PORT));

const http = require('http');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhnlSeI9Je440OVYpQ-oaN-NWCIb6l1yb8G6MicFI56KvJhcPrcxYAT6_SQDJbh-sX/exec';

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'VAPI email proxy is live' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    let toolCallId = 'unknown';
    try {
      const parsed = JSON.parse(body);
      console.log(`[${new Date().toISOString()}] Keys: ${Object.keys(parsed).join(', ')}`);

      let email, name;
      if (parsed.message && parsed.message.toolCalls) {
        const tc = parsed.message.toolCalls[0];
        toolCallId = tc.id || 'unknown';
        const args = typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments;
        email = args.email;
        name = args.name || 'there';
      } else {
        email = parsed.email;
        name = parsed.name || 'there';
      }

      if (!email) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results: [{ toolCallId, result: 'No email provided' }] }));
        return;
      }

      console.log(`[${new Date().toISOString()}] Sending to ${email} (${name}) via Apps Script`);

      // Call Apps Script via GET (POST is broken on Google's end)
      const url = `${APPS_SCRIPT_URL}?action=send&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(url, { redirect: 'follow', signal: controller.signal });
      clearTimeout(timeout);
      const text = await resp.text();
      console.log(`[${new Date().toISOString()}] Apps Script: ${text}`);

      const result = JSON.parse(text);
      if (result.success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results: [{ toolCallId, result: `Email sent successfully to ${email}` }] }));
      } else {
        throw new Error(result.error || 'Apps Script failed');
      }

    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error:`, err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        results: [{ toolCallId, result: `I tried to send the email but had a technical issue. Please give them the enrollment link directly: https://dewing.legalshieldassociate.com/legal` }]
      }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`VAPI email proxy on port ${PORT} — relay via Apps Script`));

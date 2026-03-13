const http = require('http');
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER || 'dylan@thedylanewing.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const ENROLLMENT_LINK = 'https://dewing.legalshieldassociate.com/legal';
const IPHONE_APP = 'https://apps.apple.com/us/app/legalshield-law-firms-on-call/id924247236';
const ANDROID_APP = 'https://play.google.com/store/apps/details?id=com.legalshield.lsapp';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

function buildEmailHtml(name) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
    <p style="font-size:16px;">Hey ${name},</p>
    <p style="font-size:16px;">Great chatting with you just now.</p>
    <p style="font-size:16px;">Here is your enrollment link to get set up with LegalShield:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${ENROLLMENT_LINK}" style="background:#1a73e8;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">Get Protected Now</a>
    </p>
    <p style="font-size:16px;">After you enroll, download the app:</p>
    <p style="font-size:14px;">
      <a href="${IPHONE_APP}">iPhone App</a> | <a href="${ANDROID_APP}">Android App</a>
    </p>
    <p style="font-size:16px;">Questions? Just reply to this email.</p>
    <p style="font-size:16px;">Talk soon,<br><strong>Dylan Ewing</strong><br>Independent LegalShield Associate</p>
    <hr style="margin-top:30px;border:none;border-top:1px solid #ddd;">
    <p style="font-size:11px;color:#999;">Dylan Ewing | Wilmington, DE 19801<br>To unsubscribe, reply "unsubscribe" to this email.</p>
  </div>`;
}

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'VAPI email proxy is live', sender: GMAIL_USER }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body);

      // Handle both VAPI tool call format AND direct {email, name} format
      let email, name;
      if (parsed.message && parsed.message.toolCalls) {
        const tc = parsed.message.toolCalls[0];
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
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No email provided' }));
        return;
      }

      console.log(`[${new Date().toISOString()}] Sending email to ${email} (${name})`);

      // Send email
      const info = await transporter.sendMail({
        from: `"Dylan Ewing" <${GMAIL_USER}>`,
        to: email,
        subject: `${name}, here is your LegalShield enrollment link`,
        text: `Hey ${name},\n\nGreat chatting with you. Here is your enrollment link:\n${ENROLLMENT_LINK}\n\niPhone App: ${IPHONE_APP}\nAndroid App: ${ANDROID_APP}\n\nQuestions? Just reply.\n\nDylan Ewing\nIndependent LegalShield Associate`,
        html: buildEmailHtml(name)
      });

      console.log(`[${new Date().toISOString()}] Email sent: ${info.messageId}`);

      // Get toolCallId for VAPI response format
      let toolCallId = 'unknown';
      try { toolCallId = parsed.message.toolCalls[0].id; } catch(e) {}

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        results: [{ toolCallId, result: `Email sent successfully to ${email}` }]
      }));

    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error:`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`VAPI email proxy running on port ${PORT} — sending from ${GMAIL_USER}`));

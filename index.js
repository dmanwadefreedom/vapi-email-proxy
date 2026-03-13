const http = require('http');
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER || 'dylan@thedylanewing.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const ENROLLMENT_LINK = 'https://dewing.legalshieldassociate.com/legal';
const IPHONE_APP = 'https://apps.apple.com/us/app/legalshield-law-firms-on-call/id924247236';
const ANDROID_APP = 'https://play.google.com/store/apps/details?id=com.legalshield.lsapp';

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
}

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

async function sendEmail(email, name) {
  const transporter = createTransporter();
  try {
    const info = await transporter.sendMail({
      from: `"Dylan Ewing" <${GMAIL_USER}>`,
      to: email,
      subject: `${name}, here is your LegalShield enrollment link`,
      text: `Hey ${name},\n\nGreat chatting with you. Here is your enrollment link:\n${ENROLLMENT_LINK}\n\niPhone App: ${IPHONE_APP}\nAndroid App: ${ANDROID_APP}\n\nQuestions? Just reply.\n\nDylan Ewing\nIndependent LegalShield Associate`,
      html: buildEmailHtml(name)
    });
    console.log(`[${new Date().toISOString()}] Email sent: ${info.messageId}`);
    return info;
  } finally {
    transporter.close();
  }
}

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'VAPI email proxy is live', sender: GMAIL_USER, password_set: !!GMAIL_APP_PASSWORD }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body);
      console.log(`[${new Date().toISOString()}] Payload keys: ${Object.keys(parsed).join(', ')}`);

      // Handle both VAPI tool call format AND direct {email, name} format
      let email, name, toolCallId = 'unknown';
      if (parsed.message && parsed.message.toolCalls) {
        const tc = parsed.message.toolCalls[0];
        toolCallId = tc.id || 'unknown';
        const args = typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments;
        email = args.email;
        name = args.name || 'there';
        console.log(`[${new Date().toISOString()}] VAPI format — toolCallId: ${toolCallId}`);
      } else {
        email = parsed.email;
        name = parsed.name || 'there';
        console.log(`[${new Date().toISOString()}] Direct format`);
      }

      if (!email) {
        console.log(`[${new Date().toISOString()}] No email in payload`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results: [{ toolCallId, result: 'Error: No email provided' }] }));
        return;
      }

      console.log(`[${new Date().toISOString()}] Sending to ${email} (${name})`);

      // Send with 15s timeout
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Email send timeout')), 15000));
      const send = sendEmail(email, name);
      await Promise.race([send, timeout]);

      console.log(`[${new Date().toISOString()}] Success!`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        results: [{ toolCallId, result: `Email sent successfully to ${email}` }]
      }));

    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error:`, err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        results: [{ toolCallId: 'unknown', result: `Email failed: ${err.message}. Ask the lead to check their email later or give them the link directly: ${ENROLLMENT_LINK}` }]
      }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`VAPI email proxy running on port ${PORT}`);
  console.log(`Sender: ${GMAIL_USER}`);
  console.log(`Password set: ${!!GMAIL_APP_PASSWORD}`);
});

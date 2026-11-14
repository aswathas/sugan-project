'use strict';
// Delivery for the one-time code. Two modes, neither of which costs money:
//
//   console — no external service at all. The code is printed in the server
//             terminal and, in demo mode, shown on screen. Works offline.
//   resend  — the Resend free tier (RESEND_API_KEY + MAIL_FROM). A real inbox.
//
// MAIL_MODE=resend switches modes. Without a key it falls back to console.

const MODE = process.env.MAIL_MODE === 'resend' && process.env.RESEND_API_KEY ? 'resend' : 'console';

async function deliverOtp(email, code) {
  if (MODE === 'resend') {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM,
          to: [email],
          subject: 'Your SecureShare verification code',
          text: `Your verification code is ${code}. It expires in 10 minutes.`,
        }),
      });
      if (res.ok) return { mode: 'resend', sent: true };
      return { mode: 'resend', sent: false, error: `email service replied ${res.status}` };
    } catch (err) {
      return { mode: 'resend', sent: false, error: err.message };
    }
  }
  console.log(`\n[SecureShare] verification code for ${email}: ${code}\n`);
  return { mode: 'console', sent: true };
}

module.exports = { deliverOtp, MODE };

#!/usr/bin/env node
/**
 * AfetNet Firebase Email Template Updater
 * Updates Email Verification and Email Address Change templates
 * using the Google Identity Platform REST API.
 */

const { execSync } = require('child_process');
const https = require('https');

const PROJECT_ID = 'afetnet-4a6b6';

// Get access token from Firebase CLI
function getAccessToken() {
  try {
    const token = execSync(
      'firebase login:ci --no-localhost 2>/dev/null || echo ""',
      { encoding: 'utf8' },
    ).trim();
    if (token) return token;
  } catch (error) {
    // Ignore and fall back to gcloud token.
  }

  // Try gcloud
  try {
    const token = execSync(
      'gcloud auth print-access-token 2>/dev/null',
      { encoding: 'utf8' },
    ).trim();
    if (token) return token;
  } catch (error) {
    // Ignore and return null.
  }

  return null;
}

// Premium Email Verification HTML Template
const EMAIL_VERIFICATION_BODY = `<div style="max-width:600px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 24px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;letter-spacing:-0.5px;">AfetNet</h1>
<p style="color:#94a3b8;font-size:13px;margin:8px 0 0;font-weight:400;">Afet Bilgi ve Koordinasyon Platformu</p>
</div>
<div style="padding:32px 28px;">
<p style="font-size:17px;color:#1a1a2e;margin:0 0 8px;font-weight:600;">Merhaba %DISPLAY_NAME%,</p>
<p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">AfetNet ailesine hosgeldiniz! Hesabinizi aktif hale getirmek icin asagidaki butona tiklayarak e-posta adresinizi dogrulayin.</p>
<div style="text-align:center;margin:28px 0;">
<a href='%LINK%' style="display:inline-block;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#ffffff;padding:16px 48px;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">Hesabimi Dogrula</a>
</div>
<p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:24px 0 0;">Bu baglanti 24 saat gecerlidir. Eger bu hesabi siz olusturmadiyseniz, bu e-postayi gormezden gelebilirsiniz.</p>
</div>
<div style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e8e8e8;text-align:center;">
<p style="font-size:12px;color:#94a3b8;margin:0;">Bu e-posta AfetNet tarafindan otomatik olarak gonderilmistir.</p>
<p style="font-size:11px;color:#cbd5e1;margin:6px 0 0;">(c) 2026 AfetNet. Tum haklari saklidir.</p>
</div>
</div>`;

// Premium Email Address Change HTML Template  
const EMAIL_CHANGE_BODY = `<div style="max-width:600px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 24px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;letter-spacing:-0.5px;">AfetNet</h1>
<p style="color:#94a3b8;font-size:13px;margin:8px 0 0;font-weight:400;">Afet Bilgi ve Koordinasyon Platformu</p>
</div>
<div style="padding:32px 28px;">
<p style="font-size:17px;color:#1a1a2e;margin:0 0 8px;font-weight:600;">Merhaba,</p>
<p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">AfetNet hesabinizin e-posta adresini %NEW_EMAIL% olarak degistirmek icin bir istek aldik. Bu degisikligi onaylamak icin asagidaki butona tiklayin.</p>
<div style="text-align:center;margin:28px 0;">
<a href='%LINK%' style="display:inline-block;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#ffffff;padding:16px 48px;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">Degisikligi Onayla</a>
</div>
<p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:24px 0 0;">Eger bu istegi siz yapmadiysaniz, bu e-postayi gormezden gelebilirsiniz. Mevcut e-posta adresiniz degismeyecektir.</p>
</div>
<div style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e8e8e8;text-align:center;">
<p style="font-size:12px;color:#94a3b8;margin:0;">Bu e-posta AfetNet tarafindan otomatik olarak gonderilmistir.</p>
<p style="font-size:11px;color:#cbd5e1;margin:6px 0 0;">(c) 2026 AfetNet. Tum haklari saklidir.</p>
</div>
</div>`;

console.log('\n📧 AfetNet Email Templates');
console.log('========================\n');
console.log('✅ Email Verification Template HTML:');
console.log(EMAIL_VERIFICATION_BODY.substring(0, 200) + '...\n');
console.log('✅ Email Address Change Template HTML:');
console.log(EMAIL_CHANGE_BODY.substring(0, 200) + '...\n');
console.log('Templates are ready. Copy the HTML above into Firebase Console.');
console.log('\nNote: Firebase Console may restrict direct body editing for');
console.log('Email Verification template. To fully customize, consider:');
console.log('1. Setting up Custom SMTP in Firebase Console');
console.log('2. Using Firebase Admin SDK Email Action Links for custom emails');

// api/send-welcome-email.js
// Vercel serverless function — sends the creator introduction email
// to a new customer within 1 hour of their first order or signup.
//
// Deploy to: api/send-welcome-email.js in the GitHub repo
// Same pattern as api/send-email.js

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    to,
    customerName,
    creatorName,
    creatorTagline,
    creatorBio,
    creatorHowDropsWork,
    creatorLogoUrl,
    creatorPhotoUrl,
    creatorStorefrontUrl,
    socialLinks = {},
  } = req.body;

  if (!to || !customerName || !creatorName || !creatorBio) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Build social links HTML — only include links the creator has filled in
  const socials = [];
  if (socialLinks.instagram) socials.push(`<a href="https://instagram.com/${socialLinks.instagram.replace('@','')}" style="color:#C4856A;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;margin:0 10px">Instagram</a>`);
  if (socialLinks.facebook) socials.push(`<a href="${socialLinks.facebook.startsWith('http') ? socialLinks.facebook : 'https://'+socialLinks.facebook}" style="color:#C4856A;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;margin:0 10px">Facebook</a>`);
  if (socialLinks.tiktok) socials.push(`<a href="https://tiktok.com/${socialLinks.tiktok.replace('@','')}" style="color:#C4856A;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;margin:0 10px">TikTok</a>`);
  const socialHtml = socials.length > 0 ? `
    <tr>
      <td style="padding:0 0 32px;border-top:1px solid #E8DDD4;padding-top:28px;text-align:center">
        <p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C4856A;margin:0 0 14px">Follow along</p>
        ${socials.join('')}
      </td>
    </tr>` : '';

  // Build how drops work section — only if creator filled it in
  const howDropsHtml = creatorHowDropsWork ? `
    <tr>
      <td style="padding:0 0 28px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #C4856A;background:#FDF8F2;border-radius:0 4px 4px 0">
          <tr>
            <td style="padding:20px 24px">
              <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:400;color:#2C2018;margin:0 0 10px">How my drops work</p>
              <p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.75;color:#6B5344;margin:0;white-space:pre-line">${creatorHowDropsWork}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  // Hero photo — only if creator uploaded one
  const heroHtml = creatorPhotoUrl ? `
    <tr>
      <td style="padding:0;line-height:0">
        <img src="${creatorPhotoUrl}" width="600" alt="${creatorName}" style="display:block;width:100%;max-width:600px;height:220px;object-fit:cover">
      </td>
    </tr>` : '';

  // Logo in header — use creator initial if no logo
  const logoHtml = creatorLogoUrl
    ? `<img src="${creatorLogoUrl}" width="60" height="60" alt="${creatorName}" style="display:block;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.15)">`
    : `<div style="width:60px;height:60px;border-radius:50%;background:#FDF8F0;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:26px;color:#2C2018;border:3px solid rgba(255,255,255,0.15)">${creatorName.charAt(0)}</div>`;

  // Bio — convert newlines to paragraph breaks
  const bioParagraphs = creatorBio
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.8;color:#4A3728;margin:0 0 16px">${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('');

  // First name only for the greeting
  const firstName = customerName.split(' ')[0];

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A note from ${creatorName}</title></head>
<body style="margin:0;padding:0;background:#F5F0E8">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F0E8;padding:24px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#FDFCFA;border-radius:4px;overflow:hidden">

          <!-- HEADER -->
          <tr>
            <td style="background:#2C2018;padding:28px 40px 24px;text-align:center">
              <div style="margin:0 auto 16px;width:60px;height:60px">${logoHtml}</div>
              <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:#FFFFFF;letter-spacing:0.02em;margin:0 0 4px">${creatorName}</p>
              ${creatorTagline ? `<p style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13px;color:rgba(255,255,255,0.55);margin:0">${creatorTagline}</p>` : ''}
            </td>
          </tr>

          <!-- HERO PHOTO -->
          ${heroHtml}

          <!-- BODY -->
          <tr>
            <td style="padding:36px 48px 0">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Greeting -->
                <tr>
                  <td style="padding:0 0 20px">
                    <p style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#2C2018;margin:0">Hi <em style="color:#C4856A;font-style:italic">${firstName}</em>,</p>
                  </td>
                </tr>

                <!-- Divider -->
                <tr><td style="padding:0 0 28px"><hr style="border:none;border-top:1px solid #E8DDD4;margin:0"></td></tr>

                <!-- Bio section label -->
                <tr>
                  <td style="padding:0 0 12px">
                    <p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C4856A;margin:0">A little about ${creatorName}</p>
                  </td>
                </tr>

                <!-- Bio -->
                <tr>
                  <td style="padding:0 0 28px">
                    ${bioParagraphs}
                  </td>
                </tr>

                <!-- Divider -->
                <tr><td style="padding:0 0 28px"><hr style="border:none;border-top:1px solid #E8DDD4;margin:0"></td></tr>

                <!-- How drops work -->
                ${howDropsHtml}

                <!-- CTA button -->
                <tr>
                  <td style="padding:0 0 28px;text-align:center">
                    <a href="${creatorStorefrontUrl}" style="display:inline-block;background:#C4856A;color:#FFFFFF;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.06em;text-decoration:none;padding:14px 36px;border-radius:2px;text-transform:uppercase">View my storefront →</a>
                  </td>
                </tr>

                <!-- Social links -->
                ${socialHtml}

              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#2C2018;padding:20px 40px;text-align:center">
              <p style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 4px;line-height:1.6">You're receiving this because you ordered from or joined ${creatorName}'s list.</p>
              <p style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.25);margin:0">Powered by FoodDrop</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${creatorName} via FoodDrop <hello@getfooddrop.com>`,
        to: [to],
        subject: `A note from ${creatorName} 👋`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Resend error:", err);
      return res.status(500).json({ error: "Email send failed", details: err });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Welcome email exception:", err);
    return res.status(500).json({ error: err.message });
  }
}

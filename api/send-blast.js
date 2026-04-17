// api/send-blast.js — v2
// Announcement/blast email. v27b: rebranded to match the welcome email's
// editorial aesthetic (dark header + serif body + #C4856A accent + dark footer).
// Preserves all functional content: personal note, pickup details, items, CTA.
// SMS branch remains a graceful stub until Twilio lands.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { creator, drop, items, customers, channel, customNote } = req.body;

  if (!creator || !drop || !customers?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // --- SMS stub (scaffold for future Twilio integration) ---
  if (channel === "sms") {
    return res.status(200).json({
      success: true,
      smsStub: true,
      message: "SMS not yet enabled. Twilio integration coming soon.",
      attempted: customers.length,
      sent: 0,
    });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "Missing RESEND_API_KEY" });

  const pickupDate = drop.pickup_date
    ? new Date(drop.pickup_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  // Items as a styled table matching welcome-email typography (serif body, warm accents).
  const itemsList = (items || [])
    .map(i => `<tr><td style="padding:10px 0;border-bottom:1px solid #E8DDD4;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#2C2018;">${escapeHtml(i.name)}</td><td style="padding:10px 0;border-bottom:1px solid #E8DDD4;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#6B5344;text-align:right;">$${Number(i.price).toFixed(2)}</td></tr>`)
    .join("");

  const storefrontUrl = `${process.env.APP_URL || "https://app.getfooddrop.com"}/#/${creator.slug}`;

  // Logo in dark header: creator's hero image if present, else first-initial badge.
  // (Mirrors the welcome email's logoHtml pattern, though that uses creatorLogoUrl;
  // the blast endpoint doesn't currently receive a separate logo, so we fall back
  // to the initial badge always. Upgrade path: add logo_url to creators table later.)
  const creatorInitial = (creator.name || "F").charAt(0).toUpperCase();
  const logoHtml = `<div style="width:60px;height:60px;border-radius:50%;background:#FDF8F0;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:26px;color:#2C2018;border:3px solid rgba(255,255,255,0.15);line-height:60px;text-align:center;">${escapeHtml(creatorInitial)}</div>`;

  // Hero banner: drop's cover image at the welcome-email's 220px standard.
  // Graceful fallback to a thin accent bar when no image exists.
  const heroHtml = drop.image_url
    ? `<tr><td style="padding:0;line-height:0"><img src="${drop.image_url}" width="600" alt="${escapeHtml(drop.title)}" style="display:block;width:100%;max-width:600px;height:220px;object-fit:cover;"></td></tr>`
    : `<tr><td style="padding:0;line-height:0"><div style="width:100%;height:8px;background:#C4856A;"></div></td></tr>`;

  const customNoteHtml = customNote
    ? `<tr><td style="padding:0 0 28px"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #C4856A;background:#FDF8F2;border-radius:0 4px 4px 0"><tr><td style="padding:16px 20px"><p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#2C2018;line-height:1.65;margin:0;white-space:pre-line">${escapeHtml(customNote)}</p></td></tr></table></td></tr>`
    : "";

  let sent = 0;
  let failed = 0;

  for (const customer of customers) {
    const firstName = (customer.name || "").split(" ")[0] || "there";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(creator.name)} — ${escapeHtml(drop.title)}</title></head>
<body style="margin:0;padding:0;background:#F5F0E8">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F0E8;padding:24px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#FDFCFA;border-radius:4px;overflow:hidden">

          <!-- HEADER -->
          <tr>
            <td style="background:#2C2018;padding:28px 40px 24px;text-align:center">
              <div style="margin:0 auto 16px;width:60px;height:60px">${logoHtml}</div>
              <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:#FFFFFF;letter-spacing:0.02em;margin:0 0 4px">${escapeHtml(creator.name)}</p>
              <p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin:0">New Drop Available</p>
            </td>
          </tr>

          <!-- HERO -->
          ${heroHtml}

          <!-- BODY -->
          <tr>
            <td style="padding:36px 48px 0">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Greeting -->
                <tr>
                  <td style="padding:0 0 16px">
                    <p style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;color:#2C2018;margin:0">Hi <em style="color:#C4856A;font-style:italic">${escapeHtml(firstName)}</em>,</p>
                  </td>
                </tr>

                <!-- Drop title + description -->
                <tr>
                  <td style="padding:0 0 20px">
                    <p style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#2C2018;margin:0 0 8px;line-height:1.25">${escapeHtml(drop.title)}</p>
                    ${drop.description ? `<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#6B5344;margin:0">${escapeHtml(drop.description)}</p>` : ""}
                  </td>
                </tr>

                <!-- Divider -->
                <tr><td style="padding:0 0 24px"><hr style="border:none;border-top:1px solid #E8DDD4;margin:0"></td></tr>

                <!-- Custom note (if any) -->
                ${customNoteHtml}

                <!-- Pickup details -->
                <tr>
                  <td style="padding:0 0 24px">
                    <p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C4856A;margin:0 0 10px">Pickup Details</p>
                    <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#2C2018;margin:0 0 4px">${escapeHtml(pickupDate)}${drop.pickup_time ? ` · ${escapeHtml(drop.pickup_time)}` : ""}</p>
                    ${drop.pickup_location ? `<p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6B5344;margin:0">${escapeHtml(drop.pickup_location)}</p>` : ""}
                  </td>
                </tr>

                <!-- Items list (if provided) -->
                ${itemsList ? `<tr><td style="padding:0 0 28px"><p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C4856A;margin:0 0 10px">What's Available</p><table width="100%" cellpadding="0" cellspacing="0" border="0">${itemsList}</table></td></tr>` : ""}

                <!-- CTA -->
                <tr>
                  <td style="padding:0 0 32px;text-align:center">
                    <a href="${storefrontUrl}" style="display:inline-block;background:#C4856A;color:#FFFFFF;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.06em;text-decoration:none;padding:14px 36px;border-radius:2px;text-transform:uppercase">Order Now →</a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#2C2018;padding:20px 40px;text-align:center">
              <p style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 4px;line-height:1.6">You're receiving this because you signed up for updates from ${escapeHtml(creator.name)}.</p>
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
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${creator.name} <orders@getfooddrop.com>`,
          to: customer.email,
          subject: `🍽️ New drop from ${creator.name}: ${drop.title}`,
          html,
        }),
      });
      if (r.ok) sent++; else failed++;
    } catch { failed++; }
  }

  return res.status(200).json({ success: true, sent, failed, attempted: customers.length });
}

// --- helpers ---

// Minimal HTML escaping — prevents drop titles with quotes/brackets from
// breaking email rendering. Not bulletproof but covers the common cases.
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

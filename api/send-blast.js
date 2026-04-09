// api/send-blast.js
// Sends a drop announcement blast to a list of customers via Resend.
// SMS branch is scaffolded — returns a graceful stub until Twilio is wired in.

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

  // --- Email blast via Resend ---
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "Missing RESEND_API_KEY" });

  const pickupDate = drop.pickup_date
    ? new Date(drop.pickup_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  const itemsList = (items || [])
    .map(i => `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:15px;color:#1a1a1a;">${i.name}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:15px;color:#555;text-align:right;">$${Number(i.price).toFixed(2)}</td></tr>`)
    .join("");

  const storefrontUrl = `${process.env.APP_URL || "https://fooddrop-seven.vercel.app"}/#/${creator.slug}`;

  let sent = 0;
  let failed = 0;

  for (const customer of customers) {
    const firstName = customer.name?.split(" ")[0] || "there";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f6f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    
    ${drop.image_url ? `<img src="${drop.image_url}" alt="${drop.title}" style="width:100%;height:220px;object-fit:cover;display:block;">` : `<div style="width:100%;height:8px;background:#c8956c;"></div>`}

    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#c8956c;text-transform:uppercase;letter-spacing:1px;">New Drop Available</p>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#1a1a1a;">${drop.title}</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#666;">${drop.description || ""}</p>

      ${customNote ? `
      <div style="background:#fdf8f4;border-left:3px solid #c8956c;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.6;">${customNote}</p>
      </div>` : ""}

      <div style="background:#f9f6f2;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;">Pickup Details</p>
        <p style="margin:0;font-size:15px;color:#1a1a1a;font-weight:600;">${pickupDate}${drop.pickup_time ? " · " + drop.pickup_time : ""}</p>
        ${drop.pickup_location ? `<p style="margin:4px 0 0;font-size:14px;color:#555;">${drop.pickup_location}</p>` : ""}
      </div>

      ${itemsList ? `
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;">What's Available</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${itemsList}</table>` : ""}

      <a href="${storefrontUrl}" style="display:block;text-align:center;background:#c8956c;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:.3px;">Order Now →</a>
    </div>

    <div style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">You're receiving this because you signed up for updates from <strong>${creator.name}</strong>.</p>
    </div>
  </div>
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

// api/notify-creator.js
// Sends a simple new order notification to the creator.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { creatorEmail, creatorName, customerName, dropTitle, items, total } = req.body;
  if (!creatorEmail || !customerName) return res.status(400).json({ error: "Missing fields" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "Missing RESEND_API_KEY" });

  const itemRows = (items || [])
    .map(i => `<tr><td style="padding:5px 0;font-size:14px;color:#1a1a1a;">${i.qty}× ${i.name}</td><td style="padding:5px 0;font-size:14px;color:#555;text-align:right;">$${Number(i.price * i.qty).toFixed(2)}</td></tr>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9f6f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#c8956c;padding:20px 28px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:1px;">New Order</p>
      <h1 style="margin:4px 0 0;font-size:22px;font-weight:700;color:#fff;">You got an order! 🎉</h1>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 20px;font-size:15px;color:#555;"><strong style="color:#1a1a1a;">${customerName}</strong> just placed an order for <strong style="color:#1a1a1a;">${dropTitle}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${itemRows}</table>
      <div style="border-top:2px solid #1a1a1a;padding-top:12px;display:flex;justify-content:space-between;">
        <span style="font-size:16px;font-weight:700;color:#1a1a1a;">Total</span>
        <span style="font-size:16px;font-weight:700;color:#1a1a1a;">$${Number(total).toFixed(2)}</span>
      </div>
    </div>
    <div style="padding:0 28px 24px;">
      <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">Log in to your FoodDrop dashboard to view all orders.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `FoodDrop <orders@getfooddrop.com>`,
        to: creatorEmail,
        subject: `🎉 New order from ${customerName} — ${dropTitle}`,
        html,
      }),
    });
    if (r.ok) return res.status(200).json({ success: true });
    const err = await r.text();
    return res.status(500).json({ error: err });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

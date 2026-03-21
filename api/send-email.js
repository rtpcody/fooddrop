export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "Email service not configured" });

  try {
    const { to, customerName, creatorName, dropTitle, pickupDate, pickupTime, pickupLocation, items, total } = req.body;

    if (!to || !customerName || !dropTitle) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Build item rows
    const itemRows = (items || []).map(item => 
      `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #E8E4DC;font-size:14px;">${item.qty}× ${item.name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #E8E4DC;font-size:14px;text-align:right;">$${(item.price * item.qty).toFixed(2)}</td>
      </tr>`
    ).join("");

    const htmlEmail = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
        
        <!-- Header -->
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:32px;margin-bottom:8px;">🍽️</div>
          <h1 style="font-size:24px;font-weight:700;color:#1A1916;margin:0;">${creatorName || "FoodDrop"}</h1>
        </div>

        <!-- Confirmation Card -->
        <div style="background:#FFFFFF;border:1px solid #E8E4DC;border-radius:12px;padding:28px;margin-bottom:20px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:48px;height:48px;background:#EDFAF2;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
              <span style="color:#2D7A4F;font-size:24px;">✓</span>
            </div>
            <h2 style="font-size:20px;font-weight:700;color:#1A1916;margin:0 0 4px;">Order Confirmed!</h2>
            <p style="font-size:14px;color:#6B6760;margin:0;">Thanks, ${customerName}!</p>
          </div>

          <!-- Drop Details -->
          <div style="background:#F5F3EE;border-radius:8px;padding:16px;margin-bottom:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1A1916;margin:0 0 8px;">${dropTitle}</h3>
            <p style="font-size:14px;color:#6B6760;margin:0 0 4px;">📅 ${pickupDate || ""}${pickupTime ? ", " + pickupTime : ""}</p>
            <p style="font-size:14px;color:#6B6760;margin:0;">📍 ${pickupLocation || ""}</p>
          </div>

          <!-- Order Items -->
          <table style="width:100%;border-collapse:collapse;">
            ${itemRows}
            <tr>
              <td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#1A1916;">Total</td>
              <td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#1A1916;text-align:right;">$${(total || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- Payment Reminder -->
        <div style="background:#FFF8E7;border:1px solid #f0dca0;border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="font-size:14px;color:#6B6760;margin:0;"><strong style="color:#B8860B;">💵 Payment:</strong> Bring <strong>$${(total || 0).toFixed(2)}</strong> cash to pickup.</p>
        </div>

        <!-- Footer -->
        <div style="text-align:center;padding-top:20px;border-top:1px solid #E8E4DC;">
          <p style="font-size:12px;color:#9C978E;margin:0;">Sent by ${creatorName || "FoodDrop"} via FoodDrop</p>
        </div>
      </div>
    </body>
    </html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${creatorName || "FoodDrop"} <onboarding@resend.dev>`,
        to: [to],
        subject: `Order Confirmed — ${dropTitle}`,
        html: htmlEmail,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(response.status).json({ error: data.message || "Email send failed" });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error("Email function error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

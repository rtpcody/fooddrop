// api/send-email.js — v2
// Order confirmation email. v27b additions:
// • Drop cover image banner at 600×220 (matches welcome + blast email dimensions)
// • .ics calendar attachment so customers can 1-click add the pickup to their
//   calendar. Uses floating local time (hyperlocal pickups, no TZID overhead).
//   Falls back to an all-day event when no parseable start/end time is available.

export default async function handler(req, res) {
  // CORS headers (unchanged)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "Email service not configured" });

  try {
    const {
      to,
      customerName,
      creatorName,
      dropTitle,
      dropImageUrl,        // v27b: optional banner
      pickupDate,          // display string, e.g. "Friday, October 17, 2025"
      pickupDateRaw,       // v27b: YYYY-MM-DD for .ics
      pickupTime,          // display string, e.g. "5:00 PM – 7:00 PM"
      pickupStart24h,      // v27b: "HH:MM" or null
      pickupEnd24h,        // v27b: "HH:MM" or null
      pickupLocation,
      items,
      total,
      orderId,             // v27b: unique .ics UID
    } = req.body;

    if (!to || !customerName || !dropTitle) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Build item rows (unchanged structure)
    const itemRows = (items || []).map(item =>
      `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #E8E4DC;font-size:14px;">${escapeHtml(item.qty)}× ${escapeHtml(item.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #E8E4DC;font-size:14px;text-align:right;">$${(item.price * item.qty).toFixed(2)}</td>
      </tr>`
    ).join("");

    // v27b: Banner block — renders the drop image at welcome-email-matching dimensions
    // (600px max width × 220px height, object-fit:cover). If no image, we skip the banner
    // entirely and keep the original emoji/name header as the top element.
    const bannerHtml = dropImageUrl
      ? `<div style="max-width:600px;margin:0 auto 20px;border-radius:12px;overflow:hidden;line-height:0;"><img src="${dropImageUrl}" alt="${escapeHtml(dropTitle)}" style="display:block;width:100%;max-width:600px;height:220px;object-fit:cover;"></div>`
      : "";

    const htmlEmail = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:32px 20px;">

        ${bannerHtml}

        <!-- Header -->
        <div style="text-align:center;margin-bottom:32px;">
          ${dropImageUrl ? "" : `<div style="font-size:32px;margin-bottom:8px;">🍽️</div>`}
          <h1 style="font-size:24px;font-weight:700;color:#1A1916;margin:0;">${escapeHtml(creatorName || "FoodDrop")}</h1>
        </div>

        <!-- Confirmation Card -->
        <div style="background:#FFFFFF;border:1px solid #E8E4DC;border-radius:12px;padding:28px;margin-bottom:20px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:48px;height:48px;background:#EDFAF2;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;line-height:48px;">
              <span style="color:#2D7A4F;font-size:24px;">✓</span>
            </div>
            <h2 style="font-size:20px;font-weight:700;color:#1A1916;margin:0 0 4px;">Order Confirmed!</h2>
            <p style="font-size:14px;color:#6B6760;margin:0;">Thanks, ${escapeHtml(customerName)}!</p>
          </div>

          <!-- Drop Details -->
          <div style="background:#F5F3EE;border-radius:8px;padding:16px;margin-bottom:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1A1916;margin:0 0 8px;">${escapeHtml(dropTitle)}</h3>
            <p style="font-size:14px;color:#6B6760;margin:0 0 4px;">📅 ${escapeHtml(pickupDate || "")}${pickupTime ? ", " + escapeHtml(pickupTime) : ""}</p>
            <p style="font-size:14px;color:#6B6760;margin:0;">📍 ${escapeHtml(pickupLocation || "")}</p>
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

        <!-- Calendar hint (only if we're attaching an .ics) -->
        ${pickupDateRaw ? `
        <div style="background:#EDFAF2;border:1px solid #b8e0c8;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
          <p style="font-size:13px;color:#1A4D2E;margin:0;">📅 <strong>Pickup invite attached</strong> — open it to add this pickup to your calendar.</p>
        </div>` : ""}

        <!-- Payment Reminder -->
        <div style="background:#FFF8E7;border:1px solid #f0dca0;border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="font-size:14px;color:#6B6760;margin:0;"><strong style="color:#B8860B;">💵 Payment:</strong> Bring <strong>$${(total || 0).toFixed(2)}</strong> cash to pickup.</p>
        </div>

        <!-- Footer -->
        <div style="text-align:center;padding-top:20px;border-top:1px solid #E8E4DC;">
          <p style="font-size:12px;color:#9C978E;margin:0;">Sent by ${escapeHtml(creatorName || "FoodDrop")} via FoodDrop</p>
        </div>
      </div>
    </body>
    </html>`;

    // v27b: Generate .ics attachment when we have at least a raw pickup date.
    const attachments = [];
    if (pickupDateRaw) {
      const ics = buildIcs({
        orderId,
        dropTitle,
        creatorName,
        pickupDateRaw,
        pickupStart24h,
        pickupEnd24h,
        pickupLocation,
      });
      attachments.push({
        filename: "pickup.ics",
        content: Buffer.from(ics, "utf-8").toString("base64"),
        content_type: "text/calendar; charset=utf-8; method=PUBLISH",
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${creatorName || "FoodDrop"} <orders@getfooddrop.com>`,
        to: [to],
        subject: `Order Confirmed — ${dropTitle}`,
        html: htmlEmail,
        ...(attachments.length ? { attachments } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(response.status).json({ error: data.message || "Email send failed" });
    }

    return res.status(200).json({ success: true, id: data.id, attachedIcs: attachments.length > 0 });
  } catch (error) {
    console.error("Email function error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// --- helpers ---

// Build an iCalendar (.ics) string for a pickup event.
// Times: floating local (no TZID, no Z suffix) — best fit for hyperlocal pickups
// where creator and customer are in the same timezone.
// When start/end times are missing or unparseable, falls back to an all-day event.
function buildIcs({ orderId, dropTitle, creatorName, pickupDateRaw, pickupStart24h, pickupEnd24h, pickupLocation }) {
  const lines = [];
  const push = (line) => lines.push(line);

  const uid = `order-${orderId || Date.now()}@getfooddrop.com`;
  const dtstamp = icsNowUtc();
  const summary = icsEscape(`Pickup: ${dropTitle}${creatorName ? ` (${creatorName})` : ""}`);
  const description = icsEscape(`Your pickup from ${creatorName || "FoodDrop"}. See your confirmation email for order details and payment info.`);
  const location = icsEscape(pickupLocation || "");

  push("BEGIN:VCALENDAR");
  push("VERSION:2.0");
  push("PRODID:-//FoodDrop//Pickup Event//EN");
  push("CALSCALE:GREGORIAN");
  push("METHOD:PUBLISH");
  push("BEGIN:VEVENT");
  push(`UID:${uid}`);
  push(`DTSTAMP:${dtstamp}`);

  if (pickupStart24h && pickupEnd24h) {
    // Timed event, floating local time
    push(`DTSTART:${icsDateTime(pickupDateRaw, pickupStart24h)}`);
    push(`DTEND:${icsDateTime(pickupDateRaw, pickupEnd24h)}`);
  } else {
    // All-day fallback — DTEND is exclusive, so it's the next day
    push(`DTSTART;VALUE=DATE:${icsDateOnly(pickupDateRaw)}`);
    push(`DTEND;VALUE=DATE:${icsDateOnlyPlusDay(pickupDateRaw)}`);
  }

  push(`SUMMARY:${summary}`);
  if (location) push(`LOCATION:${location}`);
  push(`DESCRIPTION:${description}`);
  push("END:VEVENT");
  push("END:VCALENDAR");

  // iCalendar spec requires CRLF line endings
  return lines.join("\r\n") + "\r\n";
}

// Format: YYYYMMDDTHHMMSS (floating local, no Z)
function icsDateTime(yyyymmdd, hhmm) {
  const [y, m, d] = yyyymmdd.split("-");
  const [h, mn] = hhmm.split(":");
  return `${y}${m}${d}T${h}${mn}00`;
}

// Format: YYYYMMDD (for VALUE=DATE)
function icsDateOnly(yyyymmdd) {
  return yyyymmdd.replace(/-/g, "");
}

// Add one day to a YYYY-MM-DD string and return YYYYMMDD (for exclusive DTEND on all-day events)
function icsDateOnlyPlusDay(yyyymmdd) {
  const dt = new Date(yyyymmdd + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

// Current UTC as YYYYMMDDTHHMMSSZ (DTSTAMP must always be UTC)
function icsNowUtc() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

// Escape text for .ics TEXT fields (RFC 5545 §3.3.11)
function icsEscape(str) {
  if (str == null) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Minimal HTML escaping for the email body
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

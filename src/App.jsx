import { useState, useEffect, useCallback } from "react";

// ============================================================
// FOODDROP MVP v2 — Separated Creator/Customer, Guest Checkout
// ============================================================

const SUPABASE_URL = "https://fgkwdobauncgkyuvyfhn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZna3dkb2JhdW5jZ2t5dXZ5ZmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzE5NTEsImV4cCI6MjA4ODE0Nzk1MX0.oLRa9jF6bSe_KX9NZFwe6tuPRxmZ6cn2TQY8I9VZCJE";

// --- Supabase REST client ---
const supabase = {
  from: (table) => {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    let headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    let queryParams = [];
    let method = "GET";
    let body = null;
    const builder = {
      select: (cols = "*") => { queryParams.push(`select=${cols}`); return builder; },
      eq: (col, val) => { queryParams.push(`${col}=eq.${val}`); return builder; },
      neq: (col, val) => { queryParams.push(`${col}=neq.${val}`); return builder; },
      order: (col, opts = {}) => { queryParams.push(`order=${col}.${opts.ascending ? "asc" : "desc"}`); return builder; },
      insert: (data) => { method = "POST"; body = JSON.stringify(Array.isArray(data) ? data : [data]); return builder; },
      update: (data) => { method = "PATCH"; body = JSON.stringify(data); return builder; },
      single: () => { headers["Accept"] = "application/vnd.pgrst.object+json"; return builder; },
      execute: async () => {
        try {
          const fullUrl = queryParams.length > 0 ? `${url}?${queryParams.join("&")}` : url;
          const res = await fetch(fullUrl, { method, headers, body });
          if (!res.ok) {
            const err = await res.text();
            return { data: null, error: { message: err, status: res.status } };
          }
          const text = await res.text();
          const data = text ? JSON.parse(text) : null;
          return { data, error: null };
        } catch (e) {
          return { data: null, error: { message: e.message } };
        }
      },
    };
    return builder;
  },
};

// --- Icons ---
const I = {
  home: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  drop: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
  users: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  plus: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  send: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  check: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  back: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  clock: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pin: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  clipboard: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  dollar: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  mail: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  phone: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  refresh: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  eye: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  share: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
};

// --- Utility ---
const fmt = (n) => `$${Number(n).toFixed(2)}`;
const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};
const fmtDateLong = (d) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
};

// ============================================================
// STYLES
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Playfair+Display:wght@400;500;600;700&display=swap');

:root {
  --bg: #FAFAF7; --surface: #FFFFFF; --surface-alt: #F5F3EE;
  --border: #E8E4DC; --border-strong: #D4CFC4;
  --text: #1A1916; --text-secondary: #6B6760; --text-tertiary: #9C978E;
  --accent: #C4572A; --accent-light: #FFF0EB; --accent-hover: #A8461F;
  --green: #2D7A4F; --green-light: #EDFAF2;
  --gold: #B8860B; --gold-light: #FFF8E7;
  --red: #C53030; --red-light: #FFF5F5;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'DM Sans', -apple-system, sans-serif;
  --radius: 12px; --radius-sm: 8px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --shadow: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font-body); background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
.app { min-height: 100vh; display: flex; flex-direction: column; }

/* --- Shared --- */
h1 { font-family: var(--font-display); font-size: 32px; font-weight: 600; line-height: 1.2; }
h2 { font-family: var(--font-display); font-size: 24px; font-weight: 600; line-height: 1.3; }
h3 { font-family: var(--font-body); font-size: 16px; font-weight: 600; }

.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow-sm); }
.card-hover { transition: all 0.2s; cursor: pointer; }
.card-hover:hover { box-shadow: var(--shadow); border-color: var(--border-strong); transform: translateY(-1px); }

.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-secondary { background: var(--surface-alt); color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover:not(:disabled) { background: var(--border); }
.btn-ghost { background: transparent; color: var(--text-secondary); padding: 8px 12px; }
.btn-ghost:hover { background: var(--surface-alt); color: var(--text); }
.btn-danger { background: var(--red-light); color: var(--red); border: 1px solid #fed7d7; }
.btn-danger:hover:not(:disabled) { background: #fed7d7; }
.btn-sm { padding: 7px 14px; font-size: 13px; }
.btn-full { width: 100%; justify-content: center; }

.badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; }
.badge-active { background: var(--green-light); color: var(--green); }
.badge-ended { background: var(--surface-alt); color: var(--text-tertiary); }
.badge-fcfs { background: var(--accent-light); color: var(--accent); }
.badge-preorder { background: var(--gold-light); color: var(--gold); }
.badge-confirmed { background: var(--gold-light); color: var(--gold); }
.badge-picked_up { background: var(--green-light); color: var(--green); }
.badge-cancelled { background: var(--red-light); color: var(--red); }

.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; }
.form-input, .form-textarea, .form-select { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px; background: var(--surface); color: var(--text); transition: border-color 0.15s; }
.form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
.form-textarea { resize: vertical; min-height: 80px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-hint { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; }

.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; }
.stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); margin-bottom: 8px; }
.stat-value { font-family: var(--font-display); font-size: 28px; font-weight: 600; }
.stat-sub { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); background: var(--surface-alt); border-bottom: 1px solid var(--border); }
td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid var(--border); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(0,0,0,0.01); }

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.empty-state { text-align: center; padding: 48px 24px; color: var(--text-tertiary); }
.empty-state-icon { width: 56px; height: 56px; background: var(--surface-alt); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.modal { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; padding: 32px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }

.checkbox-row { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; }
.checkbox-row input { accent-color: var(--accent); width: 16px; height: 16px; }

.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--text); color: white; padding: 14px 24px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; box-shadow: var(--shadow-lg); z-index: 200; display: flex; align-items: center; gap: 10px; animation: toastIn 0.3s ease; }
.toast-error { background: var(--red); }
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

.page-enter { animation: fadeUp 0.25s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* === CREATOR LAYOUT === */
.creator-topbar { background: var(--text); color: white; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
.creator-topbar-brand { font-family: var(--font-display); font-size: 18px; font-weight: 700; }
.creator-topbar-actions { display: flex; gap: 12px; align-items: center; }
.creator-topbar-link { font-size: 12px; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 6px; text-decoration: none; display: flex; align-items: center; gap: 6px; transition: all 0.15s; cursor: pointer; border: none; font-family: var(--font-body); font-weight: 500; }
.creator-topbar-link:hover { background: rgba(255,255,255,0.2); color: white; }

.creator-nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 24px; display: flex; gap: 0; }
.creator-nav button { background: none; border: none; padding: 16px 20px; font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
.creator-nav button:hover { color: var(--text); }
.creator-nav button.active { color: var(--accent); border-bottom-color: var(--accent); }

.main-content { flex: 1; max-width: 1100px; width: 100%; margin: 0 auto; padding: 32px 24px; }

.drop-card { border-left: 4px solid var(--accent); }
.drop-card-ended { border-left-color: var(--text-tertiary); }
.drop-meta { display: flex; gap: 20px; margin-top: 12px; font-size: 13px; color: var(--text-secondary); flex-wrap: wrap; }
.drop-meta-item { display: flex; align-items: center; gap: 6px; }
.drop-items-preview { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.drop-item-chip { background: var(--surface-alt); border: 1px solid var(--border); padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; }

.progress-bar { height: 6px; background: var(--surface-alt); border-radius: 3px; overflow: hidden; margin-top: 6px; }
.progress-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.3s; }
.progress-fill.full { background: var(--text-tertiary); }

.prep-grid { display: grid; gap: 12px; }
.prep-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--surface-alt); border-radius: var(--radius-sm); }
.prep-item-name { font-weight: 600; }
.prep-item-count { font-family: var(--font-display); font-size: 24px; font-weight: 600; color: var(--accent); }

.compose-area { background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-top: 16px; }
.recipient-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.recipient-tag { background: var(--surface); border: 1px solid var(--border); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }

/* === CUSTOMER LAYOUT === */
.cust-header { text-align: center; padding: 40px 24px 28px; background: linear-gradient(180deg, var(--surface-alt) 0%, var(--bg) 100%); border-bottom: 1px solid var(--border); }
.cust-header-name { font-family: var(--font-display); font-size: 36px; font-weight: 700; margin-bottom: 6px; }
.cust-header-tagline { color: var(--text-secondary); font-size: 16px; }
.cust-body { max-width: 640px; margin: 0 auto; padding: 32px 24px 64px; }

.cust-drop-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: all 0.2s; cursor: pointer; }
.cust-drop-card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
.cust-drop-banner { background: var(--accent); color: white; padding: 20px 24px; }
.cust-drop-banner h2 { font-family: var(--font-display); color: white; font-size: 22px; }
.cust-drop-body { padding: 20px 24px; }
.cust-drop-detail { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; }
.cust-drop-items-peek { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.cust-drop-items-peek span { font-size: 13px; color: var(--text-secondary); }

/* order item rows */
.oi-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border); }
.oi-row:last-child { border-bottom: none; }
.oi-info { flex: 1; }
.oi-name { font-weight: 600; font-size: 15px; }
.oi-price { color: var(--text-secondary); font-size: 14px; margin-top: 2px; }
.oi-avail { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.qty-ctrl { display: flex; align-items: center; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.qty-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--surface-alt); border: none; cursor: pointer; font-size: 18px; color: var(--text); transition: background 0.1s; }
.qty-btn:hover { background: var(--border); }
.qty-btn:disabled { color: var(--text-tertiary); cursor: default; }
.qty-btn:disabled:hover { background: var(--surface-alt); }
.qty-val { width: 40px; text-align: center; font-weight: 600; font-size: 15px; }

/* confirmation */
.confirm-box { text-align: center; padding: 40px 24px; }
.confirm-icon { width: 64px; height: 64px; background: var(--green-light); color: var(--green); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
.confirm-icon svg { width: 32px; height: 32px; }

.connection-banner { padding: 10px 24px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; justify-content: center; }
.connection-banner.err { background: var(--red-light); color: var(--red); }

.loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 16px; color: var(--text-secondary); }
.spin { width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .form-row { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: 1fr 1fr; }
  h1 { font-size: 24px; }
  .main-content { padding: 20px 16px; }
  .cust-header-name { font-size: 28px; }
  .creator-nav { overflow-x: auto; }
  .creator-nav button { white-space: nowrap; font-size: 13px; padding: 14px 16px; }
  .cust-body { padding: 24px 16px 64px; }
}
`;

// ============================================================
// ROUTING — Simple hash-based: #/admin = creator, default = customer
// ============================================================
function useRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const handler = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return hash;
}

// ============================================================
// MAIN APP
// ============================================================
export default function FoodDropApp() {
  const route = useRoute();
  const [creator, setCreator] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [drops, setDrops] = useState([]);
  const [dropItems, setDropItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbOk, setDbOk] = useState(null);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("ok");

  const showToast = useCallback((msg, type = "ok") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [cRes, custRes, dropsRes, diRes, ordRes, oiRes] = await Promise.all([
        supabase.from("creators").select("*").execute(),
        supabase.from("customers").select("*").order("created_at", { ascending: false }).execute(),
        supabase.from("drops").select("*").order("created_at", { ascending: false }).execute(),
        supabase.from("drop_items").select("*").order("sort_order").execute(),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).execute(),
        supabase.from("order_items").select("*").execute(),
      ]);
      if (cRes.error || custRes.error || dropsRes.error) { setDbOk(false); setLoading(false); return; }
      setCreator(cRes.data?.[0] || null);
      setCustomers(custRes.data || []);
      setDrops(dropsRes.data || []);
      setDropItems(diRes.data || []);
      setOrders(ordRes.data || []);
      setOrderItems(oiRes.data || []);
      setDbOk(true);
    } catch { setDbOk(false); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getDropItems = useCallback((dropId) => dropItems.filter((di) => di.drop_id === dropId), [dropItems]);
  const getDropOrders = useCallback((dropId) => orders.filter((o) => o.drop_id === dropId), [orders]);
  const getOrderItems = useCallback((orderId) => orderItems.filter((oi) => oi.order_id === orderId), [orderItems]);

  const isAdmin = route.startsWith("#/admin");

  if (loading) {
    return (
      <><style>{CSS}</style>
        <div className="app">
          <div className="loading-screen"><div className="spin" /><span>Loading FoodDrop...</span></div>
        </div>
      </>
    );
  }

  return (
    <><style>{CSS}</style>
      <div className="app">
        {dbOk === false && (
          <div className="connection-banner err">
            Could not connect to database.
            <button className="btn btn-sm btn-ghost" onClick={loadData} style={{ color: "var(--red)" }}>{I.refresh} Retry</button>
          </div>
        )}
        {isAdmin ? (
          <CreatorDashboard
            creator={creator} customers={customers} drops={drops} orders={orders}
            getDropItems={getDropItems} getDropOrders={getDropOrders} getOrderItems={getOrderItems}
            showToast={showToast} loadData={loadData}
          />
        ) : (
          <CustomerStorefront
            creator={creator} drops={drops}
            getDropItems={getDropItems}
            showToast={showToast} loadData={loadData}
            customers={customers}
          />
        )}
        {toast && <div className={`toast ${toastType === "error" ? "toast-error" : ""}`}>{toastType === "error" ? "⚠️ " : ""}{toastType !== "error" && I.check}{toast}</div>}
      </div>
    </>
  );
}

// ============================================================
// CREATOR DASHBOARD
// ============================================================
function CreatorDashboard({ creator, customers, drops, orders, getDropItems, getDropOrders, getOrderItems, showToast, loadData }) {
  const [tab, setTab] = useState("dashboard");
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showNewDrop, setShowNewDrop] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const customerUrl = window.location.origin + window.location.pathname;

  const handleCreateDrop = async (dropData, items) => {
    if (!creator) return;
    const { data: newDrop, error } = await supabase.from("drops").insert({ creator_id: creator.id, title: dropData.title, description: dropData.description, status: "active", type: dropData.type, pickup_date: dropData.pickupDate, pickup_time: dropData.pickupTime, pickup_location: dropData.pickupLocation }).select("*").single().execute();
    if (error || !newDrop) { showToast("Failed to create drop", "error"); return; }
    const inserts = items.map((item, idx) => ({ drop_id: newDrop.id, name: item.name, price: parseFloat(item.price) || 0, quantity: item.unlimited ? -1 : parseInt(item.quantity) || 0, claimed: 0, sort_order: idx }));
    await supabase.from("drop_items").insert(inserts).execute();
    setShowNewDrop(false);
    showToast("Drop created! Share your page with customers.");
    loadData();
  };

  const handleAddCustomer = async (d) => {
    if (!creator) return;
    const { error } = await supabase.from("customers").insert({ creator_id: creator.id, name: d.name, email: d.email, phone: d.phone, prefer_contact: d.preferContact }).execute();
    if (error) { showToast("Failed to add customer", "error"); return; }
    setShowNewCustomer(false);
    showToast(`${d.name} added.`);
    loadData();
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    await supabase.from("orders").update({ status }).eq("id", orderId).execute();
    showToast(`Order marked as ${status.replace("_", " ")}.`);
    loadData();
  };

  const handleEndDrop = async (dropId) => {
    await supabase.from("drops").update({ status: "ended" }).eq("id", dropId).execute();
    showToast("Drop ended.");
    setSelectedDrop(null);
    loadData();
  };

  const copyUrl = () => {
    navigator.clipboard?.writeText(customerUrl);
    showToast("Customer page URL copied!");
  };

  return (
    <>
      <div className="creator-topbar">
        <span className="creator-topbar-brand">🍽️ FoodDrop</span>
        <div className="creator-topbar-actions">
          <button className="creator-topbar-link" onClick={copyUrl}>{I.share} Copy Customer Link</button>
          <a className="creator-topbar-link" href={customerUrl} target="_blank" rel="noopener noreferrer">{I.eye} View Customer Page</a>
        </div>
      </div>
      <nav className="creator-nav">
        {[{ key: "dashboard", label: "Dashboard", icon: I.home }, { key: "drops", label: "Drops", icon: I.drop }, { key: "customers", label: "Customers", icon: I.users }].map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => { setTab(t.key); setSelectedDrop(null); }}>{t.icon} {t.label}</button>
        ))}
      </nav>
      <div className="main-content page-enter" key={tab + (selectedDrop?.id || "")}>
        {tab === "dashboard" && <DashboardTab customers={customers} drops={drops} orders={orders} getDropOrders={getDropOrders} onViewDrop={(d) => { setSelectedDrop(d); setTab("drops"); }} />}
        {tab === "drops" && !selectedDrop && <DropsTab drops={drops} getDropItems={getDropItems} getDropOrders={getDropOrders} onSelect={setSelectedDrop} onNew={() => setShowNewDrop(true)} />}
        {tab === "drops" && selectedDrop && <DropDetail drop={selectedDrop} getDropItems={getDropItems} getDropOrders={getDropOrders} getOrderItems={getOrderItems} customers={customers} onBack={() => setSelectedDrop(null)} onUpdateOrderStatus={handleUpdateOrderStatus} onEndDrop={handleEndDrop} />}
        {tab === "customers" && <CustomersTab customers={customers} orders={orders} onAddCustomer={() => setShowNewCustomer(true)} onCompose={() => setShowCompose(true)} />}
      </div>
      {showNewDrop && <NewDropModal onSave={handleCreateDrop} onClose={() => setShowNewDrop(false)} />}
      {showNewCustomer && <NewCustomerModal onSave={handleAddCustomer} onClose={() => setShowNewCustomer(false)} />}
      {showCompose && <ComposeModal customers={customers} onClose={() => setShowCompose(false)} onSend={() => { setShowCompose(false); showToast("Message ready! Copy and send via your preferred channel."); }} />}
    </>
  );
}

// --- Dashboard Tab ---
function DashboardTab({ customers, drops, orders, getDropOrders, onViewDrop }) {
  const activeDrops = drops.filter((d) => d.status === "active");
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  return (
    <>
      <div style={{ marginBottom: 28 }}><h1>Dashboard</h1><p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Overview of your food drop business</p></div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Customers</div><div className="stat-value">{customers.length}</div></div>
        <div className="stat-card"><div className="stat-label">Active Drops</div><div className="stat-value">{activeDrops.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{orders.length}</div></div>
        <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">{fmt(totalRevenue)}</div><div className="stat-sub">Cash to collect</div></div>
      </div>
      {activeDrops.length > 0 && (<><div className="section-header"><h2>Active Drops</h2></div><div style={{ display: "grid", gap: 16 }}>{activeDrops.map((drop) => { const dO = getDropOrders(drop.id); return (<div key={drop.id} className="card card-hover drop-card" onClick={() => onViewDrop(drop)}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><h3>{drop.title}</h3><div className="drop-meta"><span className="drop-meta-item">{I.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span></div></div><span className="badge badge-active">Active</span></div><div style={{ marginTop: 16, fontSize: 14, color: "var(--text-secondary)" }}><strong style={{ color: "var(--text)" }}>{dO.length}</strong> orders · <strong style={{ color: "var(--text)" }}>{fmt(dO.reduce((s, o) => s + Number(o.total), 0))}</strong></div></div>); })}</div></>)}
    </>
  );
}

// --- Drops Tab ---
function DropsTab({ drops, getDropItems, getDropOrders, onSelect, onNew }) {
  return (
    <>
      <div className="section-header"><div><h1>Drops</h1></div><button className="btn btn-primary" onClick={onNew}>{I.plus} New Drop</button></div>
      {drops.length === 0 ? (<div className="empty-state"><div className="empty-state-icon">{I.drop}</div><h3>No drops yet</h3><p style={{ marginTop: 8 }}>Create your first drop to start taking orders.</p></div>) : (
        <div style={{ display: "grid", gap: 16 }}>{drops.map((drop) => { const dI = getDropItems(drop.id); const dO = getDropOrders(drop.id); return (<div key={drop.id} className={`card card-hover drop-card ${drop.status === "ended" ? "drop-card-ended" : ""}`} onClick={() => onSelect(drop)}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><h3>{drop.title}</h3><p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>{drop.description}</p><div className="drop-meta"><span className="drop-meta-item">{I.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span></div></div><div style={{ display: "flex", gap: 8, flexShrink: 0 }}><span className={`badge badge-${drop.status}`}>{drop.status === "active" ? "Active" : "Ended"}</span><span className={`badge ${drop.type === "fcfs" ? "badge-fcfs" : "badge-preorder"}`}>{drop.type === "fcfs" ? "FCFS" : "Pre-order"}</span></div></div><div className="drop-items-preview">{dI.map((item) => <span key={item.id} className="drop-item-chip">{item.name} · {fmt(item.price)}</span>)}</div><div style={{ marginTop: 12, fontSize: 14, color: "var(--text-secondary)" }}><strong style={{ color: "var(--text)" }}>{dO.length}</strong> order{dO.length !== 1 ? "s" : ""} · <strong style={{ color: "var(--text)" }}>{fmt(dO.reduce((s, o) => s + Number(o.total), 0))}</strong></div></div>); })}</div>
      )}
    </>
  );
}

// --- Drop Detail ---
function DropDetail({ drop, getDropItems, getDropOrders, getOrderItems, customers, onBack, onUpdateOrderStatus, onEndDrop }) {
  const dI = getDropItems(drop.id);
  const dO = getDropOrders(drop.id);
  const totalRevenue = dO.reduce((s, o) => s + Number(o.total), 0);
  const prepSummary = dI.map((item) => { const totalQty = dO.reduce((sum, order) => { const ois = getOrderItems(order.id); const oi = ois.find((i) => i.drop_item_id === item.id); return sum + (oi ? oi.quantity : 0); }, 0); return { ...item, totalOrdered: totalQty }; });

  return (
    <>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>{I.back} Back to Drops</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div><h1>{drop.title}</h1><div className="drop-meta" style={{ marginTop: 8 }}><span className="drop-meta-item">{I.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span></div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span className={`badge badge-${drop.status}`}>{drop.status === "active" ? "Active" : "Ended"}</span>{drop.status === "active" && <button className="btn btn-danger btn-sm" onClick={() => onEndDrop(drop.id)}>End Drop</button>}</div>
      </div>
      <div className="stats-row"><div className="stat-card"><div className="stat-label">Orders</div><div className="stat-value">{dO.length}</div></div><div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">{fmt(totalRevenue)}</div><div className="stat-sub">Cash to collect</div></div></div>

      <div style={{ marginBottom: 32 }}><div className="section-header"><h2>🧑‍🍳 Prep Summary</h2></div><div className="prep-grid">{prepSummary.map((item) => (<div key={item.id} className="prep-item"><div><div className="prep-item-name">{item.name}</div><div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{fmt(item.price)} each · {item.quantity > 0 ? `${item.quantity - item.totalOrdered} remaining of ${item.quantity}` : "Unlimited"}</div>{item.quantity > 0 && <div className="progress-bar" style={{ width: 160, marginTop: 8 }}><div className={`progress-fill ${item.totalOrdered >= item.quantity ? "full" : ""}`} style={{ width: `${Math.min((item.totalOrdered / item.quantity) * 100, 100)}%` }} /></div>}</div><div className="prep-item-count">{item.totalOrdered}</div></div>))}</div></div>

      <div style={{ marginBottom: 32 }}><div className="section-header"><h2>Orders</h2></div>
        {dO.length === 0 ? <div className="empty-state"><p>No orders yet.</p></div> : (
          <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{dO.map((order) => { const cust = customers.find((c) => c.id === order.customer_id); const ois = getOrderItems(order.id); return (<tr key={order.id}><td><div style={{ fontWeight: 600 }}>{cust?.name || order.customer_name || "Guest"}</div><div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{cust?.email || order.customer_email}</div></td><td>{ois.map((oi) => <div key={oi.id} style={{ fontSize: 13 }}>{oi.quantity}× {oi.item_name}</div>)}</td><td style={{ fontWeight: 600 }}>{fmt(order.total)}</td><td><span className={`badge badge-${order.status}`}>{order.status === "picked_up" ? "Picked Up" : order.status === "cancelled" ? "Cancelled" : "Confirmed"}</span></td><td>{order.status === "confirmed" && (<div style={{ display: "flex", gap: 6 }}><button className="btn btn-sm btn-secondary" onClick={() => onUpdateOrderStatus(order.id, "picked_up")}>{I.check} Picked Up</button><button className="btn btn-sm btn-ghost" onClick={() => onUpdateOrderStatus(order.id, "cancelled")} style={{ color: "var(--red)" }}>Cancel</button></div>)}</td></tr>); })}</tbody></table></div>
        )}
      </div>
    </>
  );
}

// --- Customers Tab ---
function CustomersTab({ customers, orders, onAddCustomer, onCompose }) {
  return (
    <>
      <div className="section-header"><div><h1>Customers</h1><p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{customers.length} customer{customers.length !== 1 ? "s" : ""}</p></div><div style={{ display: "flex", gap: 10 }}><button className="btn btn-secondary" onClick={onCompose}>{I.send} Compose</button><button className="btn btn-primary" onClick={onAddCustomer}>{I.plus} Add Customer</button></div></div>
      {customers.length === 0 ? (<div className="empty-state"><div className="empty-state-icon">{I.users}</div><h3>No customers yet</h3><p style={{ marginTop: 8 }}>Customers will appear here when they place orders.</p></div>) : (
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Contact</th><th>Preferred</th><th>Orders</th><th>Total Spent</th></tr></thead><tbody>{customers.map((c) => { const cO = orders.filter((o) => o.customer_id === c.id); return (<tr key={c.id}><td style={{ fontWeight: 600 }}>{c.name}</td><td><div style={{ fontSize: 13 }}>{c.email}</div>{c.phone && <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{c.phone}</div>}</td><td><span className={`badge ${c.prefer_contact === "sms" ? "badge-fcfs" : "badge-preorder"}`}>{c.prefer_contact === "sms" ? "SMS" : "Email"}</span></td><td>{cO.length}</td><td style={{ fontWeight: 500 }}>{fmt(cO.reduce((s, o) => s + Number(o.total), 0))}</td></tr>); })}</tbody></table></div>
      )}
    </>
  );
}

// ============================================================
// MODALS (Creator)
// ============================================================
function NewDropModal({ onSave, onClose }) {
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [type, setType] = useState("fcfs");
  const [pickupDate, setPickupDate] = useState(""); const [pickupTime, setPickupTime] = useState(""); const [pickupLocation, setPickupLocation] = useState("");
  const [items, setItems] = useState([{ id: "i0", name: "", price: "", quantity: "", unlimited: false }]);
  const [saving, setSaving] = useState(false);
  const addItem = () => setItems([...items, { id: `i${Date.now()}`, name: "", price: "", quantity: "", unlimited: false }]);
  const removeItem = (id) => items.length > 1 && setItems(items.filter((i) => i.id !== id));
  const updateItem = (id, f, v) => setItems(items.map((i) => (i.id === id ? { ...i, [f]: v } : i)));
  const canSave = title && pickupDate && pickupTime && pickupLocation && items.every((i) => i.name && i.price) && !saving;
  const handleSave = async () => { setSaving(true); await onSave({ title, description: desc, type, pickupDate, pickupTime, pickupLocation }, items); setSaving(false); };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header"><h2>Create New Drop</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div className="form-group"><label className="form-label">Drop Title</label><input className="form-input" placeholder='e.g., "Friday Dinner Box — March 6"' value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" placeholder="Describe what's in this drop..." value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Order Type</label><select className="form-select" value={type} onChange={(e) => setType(e.target.value)}><option value="fcfs">First Come, First Served</option><option value="preorder">Pre-order Window</option></select></div>
      <div className="form-row"><div className="form-group"><label className="form-label">Pickup Date</label><input className="form-input" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} /></div><div className="form-group"><label className="form-label">Pickup Time</label><input className="form-input" placeholder="5:00 PM – 7:00 PM" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} /></div></div>
      <div className="form-group"><label className="form-label">Pickup Location</label><input className="form-input" placeholder="123 Main St" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} /></div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><label className="form-label" style={{ marginBottom: 0 }}>Menu Items</label><button className="btn btn-ghost btn-sm" onClick={addItem}>{I.plus} Add Item</button></div>
        {items.map((item, idx) => (<div key={item.id} style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Item {idx + 1}</span>{items.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => removeItem(item.id)} style={{ color: "var(--accent)", padding: 4 }}>{I.x}</button>}</div><input className="form-input" placeholder="Item name" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} style={{ marginBottom: 8 }} /><div className="form-row"><input className="form-input" type="number" placeholder="Price" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(item.id, "price", e.target.value)} /><input className="form-input" type="number" placeholder="Quantity" min="1" value={item.unlimited ? "" : item.quantity} disabled={item.unlimited} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} /></div><label className="checkbox-row" style={{ marginTop: 10 }}><input type="checkbox" checked={item.unlimited} onChange={(e) => updateItem(item.id, "unlimited", e.target.checked)} />Unlimited quantity</label></div>))}
      </div>
      <button className="btn btn-primary btn-full" disabled={!canSave} onClick={handleSave}>{saving ? "Creating..." : "Create Drop"}</button>
    </div></div>
  );
}

function NewCustomerModal({ onSave, onClose }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [prefer, setPrefer] = useState("email"); const [saving, setSaving] = useState(false);
  const canSave = name && email && !saving;
  const handleSave = async () => { setSaving(true); await onSave({ name, email, phone, preferContact: prefer }); setSaving(false); };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header"><h2>Add Customer</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="(808)555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Preferred Contact</label><select className="form-select" value={prefer} onChange={(e) => setPrefer(e.target.value)}><option value="email">Email</option><option value="sms">SMS / Text</option></select></div>
      <button className="btn btn-primary btn-full" disabled={!canSave} onClick={handleSave}>{saving ? "Adding..." : "Add Customer"}</button>
    </div></div>
  );
}

function ComposeModal({ customers, onClose, onSend }) {
  const [message, setMessage] = useState("Hey! 🍽️ A new drop just went live — check it out and grab your order before it sells out!");
  const [selectedIds, setSelectedIds] = useState(customers.map((c) => c.id));
  const toggle = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const sms = customers.filter((c) => selectedIds.includes(c.id) && c.prefer_contact === "sms");
  const email = customers.filter((c) => selectedIds.includes(c.id) && c.prefer_contact === "email");
  const handleCopy = () => {
    const text = `${message}\n\n---\nSMS Recipients:\n${sms.map(c => `${c.name}: ${c.phone}`).join("\n")}\n\nEmail Recipients:\n${email.map(c => `${c.name}: ${c.email}`).join("\n")}`;
    navigator.clipboard?.writeText(text);
    onSend();
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
      <div className="modal-header"><h2>Compose Message</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div style={{ marginBottom: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><label className="form-label" style={{ marginBottom: 0 }}>Recipients ({selectedIds.length})</label><div style={{ display: "flex", gap: 8 }}><button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(customers.map(c => c.id))}>All</button><button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>None</button></div></div>
        <div style={{ maxHeight: 140, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 8 }}>{customers.map((c) => (<label key={c.id} className="checkbox-row" style={{ padding: "6px 8px" }}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} /><span>{c.name}</span><span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>{c.prefer_contact === "sms" ? "SMS" : "Email"}</span></label>))}</div>
      </div>
      <div className="form-group"><label className="form-label">Message</label><textarea className="form-textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
      <div className="compose-area">
        {sms.length > 0 && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>VIA SMS ({sms.length}):</span><div className="recipient-tags" style={{ marginTop: 4 }}>{sms.map((c) => <span key={c.id} className="recipient-tag">{c.name} · {c.phone}</span>)}</div></div>}
        {email.length > 0 && <div><span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>VIA EMAIL ({email.length}):</span><div className="recipient-tags" style={{ marginTop: 4 }}>{email.map((c) => <span key={c.id} className="recipient-tag">{c.name} · {c.email}</span>)}</div></div>}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 }}>💡 This copies the message and recipient list to your clipboard. Paste into Google Voice or email.</p>
      <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={handleCopy}>{I.clipboard} Copy to Clipboard</button>
    </div></div>
  );
}

// ============================================================
// CUSTOMER STOREFRONT — Drops-first, guest checkout
// ============================================================
function CustomerStorefront({ creator, drops, getDropItems, showToast, loadData, customers }) {
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const activeDrops = drops.filter((d) => d.status === "active");

  if (orderConfirmation) {
    return (
      <>
        <CustomerHeader creator={creator} />
        <div className="cust-body page-enter">
          <OrderConfirmation order={orderConfirmation} creator={creator} onBack={() => { setOrderConfirmation(null); setSelectedDrop(null); }} />
        </div>
      </>
    );
  }

  if (selectedDrop) {
    return (
      <>
        <CustomerHeader creator={creator} />
        <div className="cust-body page-enter">
          <DropOrderPage
            drop={selectedDrop}
            items={getDropItems(selectedDrop.id)}
            creator={creator}
            customers={customers}
            onBack={() => setSelectedDrop(null)}
            onOrderPlaced={(order) => { setOrderConfirmation(order); loadData(); }}
            showToast={showToast}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <CustomerHeader creator={creator} />
      <div className="cust-body page-enter">
        {activeDrops.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state-icon">{I.drop}</div>
            <h3>No active drops right now</h3>
            <p style={{ marginTop: 8, maxWidth: 300, margin: "8px auto 0" }}>Check back soon — the next drop is coming!</p>
          </div>
        ) : (
          <>
            <h2 style={{ marginBottom: 20 }}>Available Drops</h2>
            <div style={{ display: "grid", gap: 20 }}>
              {activeDrops.map((drop) => {
                const dI = getDropItems(drop.id);
                return (
                  <div key={drop.id} className="cust-drop-card" onClick={() => setSelectedDrop(drop)}>
                    <div className="cust-drop-banner">
                      <h2>{drop.title}</h2>
                      {drop.description && <p style={{ fontSize: 14, marginTop: 6, opacity: 0.9 }}>{drop.description}</p>}
                    </div>
                    <div className="cust-drop-body">
                      <div className="cust-drop-detail">{I.clock} <span>{fmtDateLong(drop.pickup_date)}, {drop.pickup_time}</span></div>
                      <div className="cust-drop-detail">{I.pin} <span>{drop.pickup_location}</span></div>
                      <div className="cust-drop-detail">{I.dollar} <span>Cash at pickup</span></div>
                      <div className="cust-drop-items-peek">
                        <span>{dI.length} item{dI.length !== 1 ? "s" : ""} available: {dI.map(i => i.name).join(", ")}</span>
                      </div>
                      <div style={{ marginTop: 16 }}><span className="btn btn-primary btn-full">View Menu & Order →</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CustomerHeader({ creator }) {
  return (
    <div className="cust-header">
      <div className="cust-header-name">{creator?.name || "FoodDrop"}</div>
      <div className="cust-header-tagline">{creator?.tagline || "Fresh food, made with love"}</div>
    </div>
  );
}

// --- Drop Order Page (guest checkout) ---
function DropOrderPage({ drop, items, creator, customers, onBack, onOrderPlaced, showToast }) {
  const [cart, setCart] = useState({});
  const [step, setStep] = useState("menu"); // "menu" | "checkout"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferContact, setPreferContact] = useState("email");
  const [placing, setPlacing] = useState(false);

  const updateCart = (itemId, delta, item) => {
    setCart((prev) => {
      const curr = prev[itemId] || 0;
      const next = Math.max(0, curr + delta);
      const maxQty = item.quantity > 0 ? item.quantity - item.claimed : 999;
      if (next > maxQty) return prev;
      return { ...prev, [itemId]: next };
    });
  };

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = items.find((i) => i.id === id);
    return sum + (item ? Number(item.price) * qty : 0);
  }, 0);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ dropItemId: id, qty }));

    // Find or create customer
    let customerId = null;
    const existing = customers.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      customerId = existing.id;
    } else if (creator) {
      const { data: newCust } = await supabase.from("customers").insert({ creator_id: creator.id, name, email, phone, prefer_contact: preferContact }).select("*").single().execute();
      if (newCust) customerId = newCust.id;
    }

    // Create order
    const { data: newOrder, error } = await supabase.from("orders").insert({ drop_id: drop.id, customer_id: customerId, total: cartTotal, status: "confirmed", customer_name: name, customer_email: email }).select("*").single().execute();
    if (error || !newOrder) { showToast("Failed to place order", "error"); setPlacing(false); return; }

    // Create order items
    const oiInserts = cartItems.map((ci) => { const di = items.find((d) => d.id === ci.dropItemId); return { order_id: newOrder.id, drop_item_id: ci.dropItemId, item_name: di?.name || "Unknown", item_price: di?.price || 0, quantity: ci.qty }; });
    await supabase.from("order_items").insert(oiInserts).execute();

    // Update claimed counts
    for (const ci of cartItems) {
      const di = items.find((d) => d.id === ci.dropItemId);
      if (di) await supabase.from("drop_items").update({ claimed: di.claimed + ci.qty }).eq("id", di.id).execute();
    }

    // Build confirmation
    const orderDetail = { ...newOrder, items: cartItems.map(ci => { const di = items.find(d => d.id === ci.dropItemId); return { name: di?.name, price: di?.price, qty: ci.qty }; }), drop, customerName: name, customerEmail: email };
    setPlacing(false);
    onOrderPlaced(orderDetail);
  };

  return (
    <>
      <button className="btn btn-ghost" onClick={step === "checkout" ? () => setStep("menu") : onBack} style={{ marginBottom: 16 }}>{I.back} {step === "checkout" ? "Back to menu" : "Back to drops"}</button>

      <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--accent)" }}>
        <h2>{drop.title}</h2>
        {drop.description && <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 6 }}>{drop.description}</p>}
        <div className="drop-meta" style={{ marginTop: 12 }}>
          <span className="drop-meta-item">{I.clock} {fmtDateLong(drop.pickup_date)}, {drop.pickup_time}</span>
          <span className="drop-meta-item">{I.pin} {drop.pickup_location}</span>
          <span className="drop-meta-item">{I.dollar} Cash at pickup</span>
        </div>
      </div>

      {step === "menu" && (
        <>
          <h3 style={{ marginBottom: 4 }}>Menu</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Select what you'd like to order</p>
          <div className="card">
            {items.map((item) => {
              const avail = item.quantity > 0 ? item.quantity - item.claimed : -1;
              const soldOut = item.quantity > 0 && avail <= 0;
              return (
                <div key={item.id} className="oi-row" style={{ opacity: soldOut ? 0.5 : 1 }}>
                  <div className="oi-info">
                    <div className="oi-name">{item.name}</div>
                    <div className="oi-price">{fmt(item.price)}</div>
                    <div className="oi-avail">{soldOut ? "Sold out" : item.quantity > 0 ? `${avail} left` : "Available"}</div>
                  </div>
                  {!soldOut && (
                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() => updateCart(item.id, -1, item)} disabled={!cart[item.id]}>−</button>
                      <span className="qty-val">{cart[item.id] || 0}</span>
                      <button className="qty-btn" onClick={() => updateCart(item.id, 1, item)}>+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {cartCount > 0 && (
            <div style={{ position: "sticky", bottom: 16, marginTop: 24 }}>
              <button className="btn btn-primary btn-full" onClick={() => setStep("checkout")} style={{ padding: "14px 24px", fontSize: 16, boxShadow: "var(--shadow-lg)" }}>
                Continue — {cartCount} item{cartCount !== 1 ? "s" : ""}, {fmt(cartTotal)}
              </button>
            </div>
          )}
        </>
      )}

      {step === "checkout" && (
        <>
          <h3 style={{ marginBottom: 4 }}>Your Order</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Review your items, then enter your info to confirm</p>

          <div className="card" style={{ marginBottom: 20 }}>
            {Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => {
              const item = items.find(i => i.id === id);
              return item ? (
                <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{qty}× {item.name}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(item.price * qty)}</span>
                </div>
              ) : null;
            })}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>
              <span>Total</span><span>{fmt(cartTotal)}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>💵 Pay cash at pickup</div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Your Information</h3>
            <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /><div className="form-hint">We'll send your order confirmation here</div></div>
            <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="(808)555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="form-group">
              <label className="form-label">How should we reach you about future drops?</label>
              <div style={{ display: "flex", gap: 20 }}>
                <label className="checkbox-row"><input type="radio" name="prefer" checked={preferContact === "email"} onChange={() => setPreferContact("email")} />{I.mail} Email</label>
                <label className="checkbox-row"><input type="radio" name="prefer" checked={preferContact === "sms"} onChange={() => setPreferContact("sms")} />{I.phone} Text / SMS</label>
              </div>
            </div>
          </div>

          <button className="btn btn-primary btn-full" style={{ marginTop: 20, padding: "14px 24px", fontSize: 16 }} disabled={!name || !email || placing} onClick={handlePlaceOrder}>
            {placing ? "Placing order..." : `Confirm Order — ${fmt(cartTotal)}`}
          </button>
        </>
      )}
    </>
  );
}

// --- Order Confirmation ---
function OrderConfirmation({ order, creator, onBack }) {
  return (
    <div className="confirm-box page-enter">
      <div className="confirm-icon"><svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
      <h1 style={{ marginBottom: 8 }}>Order Confirmed!</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 16, marginBottom: 28 }}>Thanks, {order.customerName}! Here's your order summary.</p>

      <div className="card" style={{ textAlign: "left", marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>{order.drop.title}</h3>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>{I.clock} {fmtDateLong(order.drop.pickup_date)}, {order.drop.pickup_time}</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>{I.pin} {order.drop.pickup_location}</div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <span>{item.qty}× {item.name}</span>
              <span style={{ fontWeight: 600 }}>{fmt(item.price * item.qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 8, borderTop: "1px solid var(--border)", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>
            <span>Total</span><span>{fmt(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ textAlign: "left", background: "var(--gold-light)", border: "1px solid #f0dca0" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)", marginBottom: 4 }}>💵 Payment</div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Bring <strong>{fmt(order.total)}</strong> cash to pickup.</p>
      </div>

      <div className="card" style={{ textAlign: "left", marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>📧 Confirmation</div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>A confirmation will be sent to <strong>{order.customerEmail}</strong></p>
      </div>

      <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={onBack}>← Browse More Drops</button>
    </div>
  );
}

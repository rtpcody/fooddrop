import { useState, useEffect, useCallback } from "react";

// ============================================================
// FOODDROP MVP v7 — Bulk select, drop duplication, customer notes, search, CSV export
// ============================================================

const SUPABASE_URL = "https://fgkwdobauncgkyuvyfhn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZna3dkb2JhdW5jZ2t5dXZ5ZmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzE5NTEsImV4cCI6MjA4ODE0Nzk1MX0.oLRa9jF6bSe_KX9NZFwe6tuPRxmZ6cn2TQY8I9VZCJE";

// --- Supabase REST client ---
const supabase = {
  from: (table) => {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    let headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
    let queryParams = []; let method = "GET"; let body = null;
    const b = {
      select: (c = "*") => { queryParams.push(`select=${c}`); return b; },
      eq: (c, v) => { queryParams.push(`${c}=eq.${v}`); return b; },
      neq: (c, v) => { queryParams.push(`${c}=neq.${v}`); return b; },
      order: (c, o = {}) => { queryParams.push(`order=${c}.${o.ascending ? "asc" : "desc"}`); return b; },
      insert: (d) => { method = "POST"; body = JSON.stringify(Array.isArray(d) ? d : [d]); return b; },
      update: (d) => { method = "PATCH"; body = JSON.stringify(d); return b; },
      delete: () => { method = "DELETE"; return b; },
      single: () => { headers["Accept"] = "application/vnd.pgrst.object+json"; return b; },
      execute: async () => {
        try {
          const fullUrl = queryParams.length > 0 ? `${url}?${queryParams.join("&")}` : url;
          const res = await fetch(fullUrl, { method, headers, body });
          if (!res.ok) { const err = await res.text(); return { data: null, error: { message: err, status: res.status } }; }
          const text = await res.text();
          return { data: text ? JSON.parse(text) : null, error: null };
        } catch (e) { return { data: null, error: { message: e.message } }; }
      },
    };
    return b;
  },
  uploadImage: async (file) => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/images/${fileName}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) return { url: null, error: "Upload failed" };
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${fileName}`;
    return { url: publicUrl, error: null };
  },
};

// --- Icons ---
const I = {
  home: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  drop: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
  users: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  settings: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  plus: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  send: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  check: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  back: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  clock: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pin: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  edit: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  clipboard: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  dollar: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  mail: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  phone: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  refresh: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  eye: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  share: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  history: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  archive: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  download: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  search: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  copy: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  image: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  chart: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
};

const fmt = (n) => `$${Number(n).toFixed(2)}`;
const fmtDate = (d) => { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
const fmtDateLong = (d) => { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); };

// ============================================================
// STYLES
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Playfair+Display:wght@400;500;600;700&display=swap');
:root{--bg:#FAFAF7;--surface:#FFF;--surface-alt:#F5F3EE;--border:#E8E4DC;--border-strong:#D4CFC4;--text:#1A1916;--text-secondary:#6B6760;--text-tertiary:#9C978E;--accent:#C4572A;--accent-light:#FFF0EB;--accent-hover:#A8461F;--green:#2D7A4F;--green-light:#EDFAF2;--gold:#B8860B;--gold-light:#FFF8E7;--red:#C53030;--red-light:#FFF5F5;--font-display:'Playfair Display',Georgia,serif;--font-body:'DM Sans',-apple-system,sans-serif;--radius:12px;--radius-sm:8px;--shadow-sm:0 1px 3px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.06);--shadow:0 4px 12px rgba(0,0,0,.06),0 1px 3px rgba(0,0,0,.08);--shadow-lg:0 12px 40px rgba(0,0,0,.1),0 4px 12px rgba(0,0,0,.06)}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--font-body);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}.app{min-height:100vh;display:flex;flex-direction:column}
h1{font-family:var(--font-display);font-size:32px;font-weight:600;line-height:1.2}h2{font-family:var(--font-display);font-size:24px;font-weight:600;line-height:1.3}h3{font-family:var(--font-body);font-size:16px;font-weight:600}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow-sm)}.card-hover{transition:all .2s;cursor:pointer}.card-hover:hover{box-shadow:var(--shadow);border-color:var(--border-strong);transform:translateY(-1px)}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:var(--radius-sm);font-family:var(--font-body);font-size:14px;font-weight:600;border:none;cursor:pointer;transition:all .15s}.btn:disabled{opacity:.5;cursor:default}.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover:not(:disabled){background:var(--accent-hover)}.btn-secondary{background:var(--surface-alt);color:var(--text);border:1px solid var(--border)}.btn-secondary:hover:not(:disabled){background:var(--border)}.btn-ghost{background:transparent;color:var(--text-secondary);padding:8px 12px}.btn-ghost:hover{background:var(--surface-alt);color:var(--text)}.btn-danger{background:var(--red-light);color:var(--red);border:1px solid #fed7d7}.btn-danger:hover:not(:disabled){background:#fed7d7}.btn-sm{padding:7px 14px;font-size:13px}.btn-full{width:100%;justify-content:center}
.badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;letter-spacing:.3px}.badge-active{background:var(--green-light);color:var(--green)}.badge-ended{background:var(--surface-alt);color:var(--text-tertiary)}.badge-archived{background:var(--surface-alt);color:var(--text-tertiary)}.badge-fcfs{background:var(--accent-light);color:var(--accent)}.badge-preorder{background:var(--gold-light);color:var(--gold)}.badge-confirmed{background:var(--gold-light);color:var(--gold)}.badge-picked_up{background:var(--green-light);color:var(--green)}.badge-cancelled{background:var(--red-light);color:var(--red)}
.form-group{margin-bottom:20px}.form-label{display:block;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.3px}.form-input,.form-textarea,.form-select{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:14px;background:var(--surface);color:var(--text);transition:border-color .15s}.form-input:focus,.form-textarea:focus,.form-select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light)}.form-textarea{resize:vertical;min-height:80px}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.form-hint{font-size:12px;color:var(--text-tertiary);margin-top:4px}
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:32px}.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px}.stat-label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-tertiary);margin-bottom:8px}.stat-value{font-family:var(--font-display);font-size:28px;font-weight:600}.stat-sub{font-size:13px;color:var(--text-secondary);margin-top:4px}
.table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface)}table{width:100%;border-collapse:collapse}th{text-align:left;padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-tertiary);background:var(--surface-alt);border-bottom:1px solid var(--border)}td{padding:14px 16px;font-size:14px;border-bottom:1px solid var(--border)}tr:last-child td{border-bottom:none}tr:hover td{background:rgba(0,0,0,.01)}
.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px}.empty-state{text-align:center;padding:48px 24px;color:var(--text-tertiary)}.empty-state-icon{width:56px;height:56px;background:var(--surface-alt);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}.modal{background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow-lg);width:100%;max-width:560px;max-height:90vh;overflow-y:auto;padding:32px}.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.checkbox-row{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px}.checkbox-row input{accent-color:var(--accent);width:16px;height:16px}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--text);color:#fff;padding:14px 24px;border-radius:var(--radius-sm);font-size:14px;font-weight:500;box-shadow:var(--shadow-lg);z-index:200;display:flex;align-items:center;gap:10px;animation:toastIn .3s ease}.toast-error{background:var(--red)}@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.page-enter{animation:fadeUp .25s ease}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.creator-topbar{background:var(--text);color:#fff;padding:12px 24px;display:flex;align-items:center;justify-content:space-between}.creator-topbar-brand{font-family:var(--font-display);font-size:18px;font-weight:700}.creator-topbar-actions{display:flex;gap:12px;align-items:center}.creator-topbar-link{font-size:12px;color:rgba(255,255,255,.6);background:rgba(255,255,255,.1);padding:6px 12px;border-radius:6px;text-decoration:none;display:flex;align-items:center;gap:6px;transition:all .15s;cursor:pointer;border:none;font-family:var(--font-body);font-weight:500}.creator-topbar-link:hover{background:rgba(255,255,255,.2);color:#fff}
.creator-nav{background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;display:flex;gap:0}.creator-nav button{background:none;border:none;padding:16px 20px;font-family:var(--font-body);font-size:14px;font-weight:500;color:var(--text-secondary);cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;display:flex;align-items:center;gap:8px}.creator-nav button:hover{color:var(--text)}.creator-nav button.active{color:var(--accent);border-bottom-color:var(--accent)}
.main-content{flex:1;max-width:1100px;width:100%;margin:0 auto;padding:32px 24px}
.drop-card{border-left:4px solid var(--accent)}.drop-card-ended{border-left-color:var(--text-tertiary)}.drop-meta{display:flex;gap:20px;margin-top:12px;font-size:13px;color:var(--text-secondary);flex-wrap:wrap}.drop-meta-item{display:flex;align-items:center;gap:6px}.drop-items-preview{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.drop-item-chip{background:var(--surface-alt);border:1px solid var(--border);padding:6px 12px;border-radius:20px;font-size:13px;font-weight:500}
.progress-bar{height:6px;background:var(--surface-alt);border-radius:3px;overflow:hidden;margin-top:6px}.progress-fill{height:100%;background:var(--accent);border-radius:3px;transition:width .3s}.progress-fill.full{background:var(--text-tertiary)}
.prep-grid{display:grid;gap:12px}.prep-item{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:var(--surface-alt);border-radius:var(--radius-sm)}.prep-item-name{font-weight:600}.prep-item-count{font-family:var(--font-display);font-size:24px;font-weight:600;color:var(--accent)}
.compose-area{background:var(--surface-alt);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-top:16px}.recipient-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.recipient-tag{background:var(--surface);border:1px solid var(--border);padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500}
.cust-header{text-align:center;padding:40px 24px 28px;background:linear-gradient(180deg,var(--surface-alt) 0%,var(--bg) 100%);border-bottom:1px solid var(--border)}.cust-header-name{font-family:var(--font-display);font-size:36px;font-weight:700;margin-bottom:6px}.cust-header-tagline{color:var(--text-secondary);font-size:16px}.cust-body{max-width:640px;margin:0 auto;padding:32px 24px 64px}
.cust-drop-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:all .2s;cursor:pointer}.cust-drop-card:hover{box-shadow:var(--shadow);transform:translateY(-2px)}.cust-drop-banner{background:var(--accent);color:#fff;padding:20px 24px;position:relative;overflow:hidden;min-height:80px}.cust-drop-banner.has-img{background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55));background-size:cover;background-position:center}.cust-drop-banner h2{font-family:var(--font-display);color:#fff;font-size:22px;position:relative;z-index:1}.cust-drop-banner p{position:relative;z-index:1}.cust-drop-body{padding:20px 24px}.cust-drop-detail{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text-secondary);margin-bottom:8px}.cust-drop-items-peek{margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}.cust-drop-items-peek span{font-size:13px;color:var(--text-secondary)}
.oi-row{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--border)}.oi-row:last-child{border-bottom:none}.oi-info{flex:1}.oi-name{font-weight:600;font-size:15px}.oi-price{color:var(--text-secondary);font-size:14px;margin-top:2px}.oi-avail{font-size:12px;color:var(--text-tertiary);margin-top:2px}.qty-ctrl{display:flex;align-items:center;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}.qty-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--surface-alt);border:none;cursor:pointer;font-size:18px;color:var(--text);transition:background .1s}.qty-btn:hover{background:var(--border)}.qty-btn:disabled{color:var(--text-tertiary);cursor:default}.qty-btn:disabled:hover{background:var(--surface-alt)}.qty-val{width:40px;text-align:center;font-weight:600;font-size:15px}
.confirm-box{text-align:center;padding:40px 24px}.confirm-icon{width:64px;height:64px;background:var(--green-light);color:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}.confirm-icon svg{width:32px;height:32px}
.connection-banner{padding:10px 24px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;justify-content:center}.connection-banner.err{background:var(--red-light);color:var(--red)}
.loading-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;color:var(--text-secondary)}.spin{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.cust-detail-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:24px}.cust-detail-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}.cust-order-timeline{border-left:2px solid var(--border);padding-left:20px;margin-top:16px}.cust-order-item{position:relative;padding-bottom:20px}.cust-order-item:last-child{padding-bottom:0}.cust-order-dot{position:absolute;left:-27px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:2px solid var(--surface)}
.img-upload{border:2px dashed var(--border);border-radius:var(--radius-sm);padding:20px;text-align:center;cursor:pointer;transition:all .15s;position:relative;overflow:hidden}.img-upload:hover{border-color:var(--accent);background:var(--accent-light)}.img-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}.img-upload-preview{width:100%;height:120px;object-fit:cover;border-radius:var(--radius-sm);margin-bottom:8px}
.rev-bar-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}.rev-bar-label{width:140px;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}.rev-bar-track{flex:1;height:24px;background:var(--surface-alt);border-radius:4px;overflow:hidden;position:relative}.rev-bar-fill{height:100%;background:var(--accent);border-radius:4px;transition:width .4s ease;min-width:2px}.rev-bar-val{width:70px;text-align:right;font-size:13px;font-weight:600;flex-shrink:0}
@media(max-width:640px){.form-row{grid-template-columns:1fr}.stats-row{grid-template-columns:1fr 1fr}h1{font-size:24px}.main-content{padding:20px 16px}.cust-header-name{font-size:28px}.creator-nav{overflow-x:auto}.creator-nav button{white-space:nowrap;font-size:13px;padding:14px 16px}.cust-body{padding:24px 16px 64px}.rev-bar-label{width:100px}}

.stat-card-clickable{cursor:pointer;transition:all .2s}.stat-card-clickable:hover{border-color:var(--accent);box-shadow:var(--shadow)}.stat-card-clickable .stat-label{color:var(--accent)}

.lightbox-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:200;cursor:pointer;padding:20px}.lightbox-img{max-width:90vw;max-height:85vh;object-fit:contain;border-radius:var(--radius);box-shadow:var(--shadow-lg)}

.getting-started{background:linear-gradient(135deg,var(--accent-light),#fff8f5);border:1px solid #f0d4c4;border-radius:var(--radius);padding:32px;margin-bottom:32px}
.gs-title{font-family:var(--font-display);font-size:28px;font-weight:700;margin-bottom:8px}
.gs-sub{color:var(--text-secondary);font-size:15px;margin-bottom:24px}
.gs-steps{display:grid;gap:16px}
.gs-step{display:flex;gap:16px;align-items:flex-start;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px 20px;cursor:pointer;transition:all .15s}
.gs-step:hover{border-color:var(--accent);box-shadow:var(--shadow-sm)}
.gs-step-num{width:32px;height:32px;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0}
.gs-step-done{background:var(--green)}
.gs-step-title{font-weight:600;font-size:15px;margin-bottom:2px}
.gs-step-desc{font-size:13px;color:var(--text-secondary)}

.search-bar{position:relative;margin-bottom:16px}.search-bar input{width:100%;padding:10px 14px 10px 38px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:14px;background:var(--surface);transition:border-color .15s}.search-bar input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light)}.search-bar svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)}
.bulk-bar{background:var(--accent-light);border:1px solid #f0d4c4;border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;animation:fadeUp .2s ease}.bulk-bar-count{font-size:14px;font-weight:600;color:var(--accent)}.bulk-bar-actions{display:flex;gap:8px;flex-wrap:wrap}

`;

// ============================================================
// ROUTING
// ============================================================
function useRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => { const h = () => setHash(window.location.hash || "#/"); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
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

  const showToast = useCallback((msg, type = "ok") => { setToast(msg); setToastType(type); setTimeout(() => setToast(null), 3500); }, []);

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
      setCreator(cRes.data?.[0] || null); setCustomers(custRes.data || []); setDrops(dropsRes.data || []); setDropItems(diRes.data || []); setOrders(ordRes.data || []); setOrderItems(oiRes.data || []); setDbOk(true);
    } catch { setDbOk(false); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const getDropItems = useCallback((id) => dropItems.filter((di) => di.drop_id === id), [dropItems]);
  const getDropOrders = useCallback((id) => orders.filter((o) => o.drop_id === id), [orders]);
  const getOrderItems = useCallback((id) => orderItems.filter((oi) => oi.order_id === id), [orderItems]);
  const isAdmin = route.startsWith("#/admin");

  if (loading) return <><style>{CSS}</style><div className="app"><div className="loading-screen"><div className="spin"/><span>Loading FoodDrop...</span></div></div></>;

  return (
    <><style>{CSS}</style><div className="app">
      {dbOk === false && <div className="connection-banner err">Could not connect to database.<button className="btn btn-sm btn-ghost" onClick={loadData} style={{color:"var(--red)"}}>{I.refresh} Retry</button></div>}
      {isAdmin ? <CreatorDashboard creator={creator} customers={customers} drops={drops} orders={orders} orderItems={orderItems} dropItems={dropItems} getDropItems={getDropItems} getDropOrders={getDropOrders} getOrderItems={getOrderItems} showToast={showToast} loadData={loadData}/> : <CustomerStorefront creator={creator} drops={drops} getDropItems={getDropItems} showToast={showToast} loadData={loadData} customers={customers}/>}
      {toast && <div className={`toast ${toastType==="error"?"toast-error":""}`}>{toastType==="error"?"⚠️ ":""}{toastType!=="error"&&I.check}{toast}</div>}
    </div></>
  );
}

// ============================================================
// CREATOR DASHBOARD
// ============================================================
function CreatorDashboard({ creator, customers, drops, orders, orderItems, dropItems, getDropItems, getDropOrders, getOrderItems, showToast, loadData }) {
  const [tab, setTab] = useState("dashboard");
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewDrop, setShowNewDrop] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showEditDrop, setShowEditDrop] = useState(null);
  const [showEditCustomer, setShowEditCustomer] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(null);
  const [showRevenue, setShowRevenue] = useState(false);
  const [duplicateDrop, setDuplicateDrop] = useState(null);
  const customerUrl = window.location.origin + window.location.pathname;

  const handleCreateDrop = async (d, items) => {
    if (!creator) return;
    const { data: nd, error } = await supabase.from("drops").insert({ creator_id: creator.id, title: d.title, description: d.description, status: "active", type: "standard", pickup_date: d.pickupDate, pickup_time: d.pickupTime, pickup_location: d.pickupLocation, image_url: d.imageUrl || "" }).select("*").single().execute();
    if (error || !nd) { showToast("Failed to create drop", "error"); return; }
    await supabase.from("drop_items").insert(items.map((item, idx) => ({ drop_id: nd.id, name: item.name, price: parseFloat(item.price)||0, quantity: item.unlimited ? -1 : parseInt(item.quantity)||0, claimed: 0, sort_order: idx, image_url: item.imageUrl || "" }))).execute();
    setShowNewDrop(false); setDuplicateDrop(null); showToast("Drop created!"); loadData();
  };

  const handleEditDrop = async (dropId, d, items) => {
    await supabase.from("drops").update({ title: d.title, description: d.description, pickup_date: d.pickupDate, pickup_time: d.pickupTime, pickup_location: d.pickupLocation, image_url: d.imageUrl || "" }).eq("id", dropId).execute();
    for (const item of items) {
      if (item.existingId) {
        await supabase.from("drop_items").update({ name: item.name, price: parseFloat(item.price)||0, quantity: item.unlimited ? -1 : parseInt(item.quantity)||0, image_url: item.imageUrl || "" }).eq("id", item.existingId).execute();
      } else {
        await supabase.from("drop_items").insert({ drop_id: dropId, name: item.name, price: parseFloat(item.price)||0, quantity: item.unlimited ? -1 : parseInt(item.quantity)||0, claimed: 0, sort_order: item.sortOrder||0, image_url: item.imageUrl || "" }).execute();
      }
    }
    setShowEditDrop(null); showToast("Drop updated!"); loadData();
  };

  const handleAddCustomer = async (d) => { if (!creator) return; await supabase.from("customers").insert({ creator_id: creator.id, name: d.name, email: d.email, phone: d.phone, prefer_contact: d.preferContact, notes: d.notes || "" }).execute(); setShowNewCustomer(false); showToast(`${d.name} added.`); loadData(); };
  const handleEditCustomer = async (custId, d) => { await supabase.from("customers").update({ name: d.name, email: d.email, phone: d.phone, prefer_contact: d.preferContact, notes: d.notes || "" }).eq("id", custId).execute(); setShowEditCustomer(null); setSelectedCustomer(null); showToast("Customer updated."); loadData(); };
  const handleDeleteCustomer = async (custId, custName) => { await supabase.from("customers").delete().eq("id", custId).execute(); setSelectedCustomer(null); showToast(`${custName} removed.`); loadData(); };
  const handleEditProfile = async (d) => { if (!creator) return; await supabase.from("creators").update({ name: d.name, tagline: d.tagline }).eq("id", creator.id).execute(); setShowEditProfile(false); showToast("Profile updated!"); loadData(); };
  const handleUpdateOrderStatus = async (oid, status) => { await supabase.from("orders").update({ status }).eq("id", oid).execute(); showToast(`Order marked as ${status.replace("_"," ")}.`); loadData(); };
  const handleEndDrop = async (id) => { await supabase.from("drops").update({ status: "ended" }).eq("id", id).execute(); showToast("Drop ended."); setSelectedDrop(null); loadData(); };
  const handleArchiveDrop = async (id) => { await supabase.from("drops").update({ archived: true }).eq("id", id).execute(); showToast("Drop archived."); setSelectedDrop(null); loadData(); };
  const handleUnarchiveDrop = async (id) => { await supabase.from("drops").update({ archived: false }).eq("id", id).execute(); showToast("Drop restored."); loadData(); };

  const handleEditOrder = async (orderId, updatedItems, dropId) => {
    // Delete existing order items
    await supabase.from("order_items").delete().eq("order_id", orderId).execute();
    // Insert updated items
    const newTotal = updatedItems.reduce((s, i) => s + i.quantity * i.item_price, 0);
    await supabase.from("order_items").insert(updatedItems.map(i => ({ order_id: orderId, drop_item_id: i.drop_item_id, item_name: i.item_name, item_price: i.item_price, quantity: i.quantity }))).execute();
    await supabase.from("orders").update({ total: newTotal }).eq("id", orderId).execute();
    // Recalculate claimed counts for all drop items
    const allDropOrders = orders.filter(o => o.drop_id === dropId && o.id !== orderId);
    const dis = getDropItems(dropId);
    for (const di of dis) {
      const otherClaimed = allDropOrders.reduce((sum, o) => { const ois = getOrderItems(o.id); const oi = ois.find(x => x.drop_item_id === di.id); return sum + (oi ? oi.quantity : 0); }, 0);
      const thisClaimed = updatedItems.find(x => x.drop_item_id === di.id)?.quantity || 0;
      await supabase.from("drop_items").update({ claimed: otherClaimed + thisClaimed }).eq("id", di.id).execute();
    }
    setShowEditOrder(null); showToast("Order updated."); loadData();
  };

  const copyUrl = () => { navigator.clipboard?.writeText(customerUrl); showToast("Customer page URL copied!"); };

  return (
    <>
      <div className="creator-topbar"><span className="creator-topbar-brand">🍽️ FoodDrop</span><div className="creator-topbar-actions"><button className="creator-topbar-link" onClick={copyUrl}>{I.share} Copy Customer Link</button><a className="creator-topbar-link" href={customerUrl} target="_blank" rel="noopener noreferrer">{I.eye} View Customer Page</a></div></div>
      <nav className="creator-nav">
        {[{key:"dashboard",label:"Dashboard",icon:I.home},{key:"drops",label:"Drops",icon:I.drop},{key:"customers",label:"Customers",icon:I.users},{key:"settings",label:"Settings",icon:I.settings}].map(t=>(
          <button key={t.key} className={tab===t.key?"active":""} onClick={()=>{setTab(t.key);setSelectedDrop(null);setSelectedCustomer(null)}}>{t.icon} {t.label}</button>
        ))}
      </nav>
      <div className="main-content page-enter" key={tab+(selectedDrop?.id||"")+(selectedCustomer?.id||"")}>
        {tab==="dashboard" && <DashboardTab creator={creator} customers={customers} drops={drops} orders={orders} orderItems={orderItems} dropItems={dropItems} getDropOrders={getDropOrders} getDropItems={getDropItems} getOrderItems={getOrderItems} onViewDrop={d=>{setSelectedDrop(d);setTab("drops")}} onShowRevenue={()=>setShowRevenue(true)} onGoToDrops={()=>setTab("drops")} onNewDrop={()=>{setTab("drops");setShowNewDrop(true)}} onGoToSettings={()=>setTab("settings")} onGoToCustomers={()=>setTab("customers")}/>}
        {tab==="drops" && !selectedDrop && <DropsTab drops={drops} getDropItems={getDropItems} getDropOrders={getDropOrders} onSelect={setSelectedDrop} onNew={()=>setShowNewDrop(true)} onArchive={handleArchiveDrop} onUnarchive={handleUnarchiveDrop} onDuplicate={(drop)=>{setDuplicateDrop(drop);setShowNewDrop(true)}}/>}
        {tab==="drops" && selectedDrop && <DropDetail drop={selectedDrop} getDropItems={getDropItems} getDropOrders={getDropOrders} getOrderItems={getOrderItems} customers={customers} onBack={()=>setSelectedDrop(null)} onUpdateOrderStatus={handleUpdateOrderStatus} onEndDrop={handleEndDrop} onEditDrop={()=>setShowEditDrop(selectedDrop)} onArchiveDrop={()=>handleArchiveDrop(selectedDrop.id)} onEditOrder={(order)=>setShowEditOrder({order,dropId:selectedDrop.id})} onDuplicate={()=>{setDuplicateDrop(selectedDrop);setSelectedDrop(null);setShowNewDrop(true)}}/>}
        {tab==="customers" && !selectedCustomer && <CustomersTab customers={customers} orders={orders} drops={drops} getDropOrders={getDropOrders} onAddCustomer={()=>setShowNewCustomer(true)} onCompose={()=>setShowCompose(true)} onSelectCustomer={setSelectedCustomer}/>}
        {tab==="customers" && selectedCustomer && <CustomerDetail customer={selectedCustomer} orders={orders} drops={drops} getOrderItems={getOrderItems} onBack={()=>setSelectedCustomer(null)} onEdit={()=>setShowEditCustomer(selectedCustomer)} onDelete={()=>handleDeleteCustomer(selectedCustomer.id, selectedCustomer.name)}/>}
        {tab==="settings" && <SettingsTab creator={creator} onEditProfile={()=>setShowEditProfile(true)}/>}
      </div>
      {showNewDrop && <DropFormModal mode="create" duplicateFrom={duplicateDrop} duplicateItems={duplicateDrop?getDropItems(duplicateDrop.id):null} onSave={handleCreateDrop} onClose={()=>{setShowNewDrop(false);setDuplicateDrop(null)}}/>}
      {showEditDrop && <DropFormModal mode="edit" drop={showEditDrop} existingItems={getDropItems(showEditDrop.id)} onSave={(d,items)=>handleEditDrop(showEditDrop.id,d,items)} onClose={()=>setShowEditDrop(null)}/>}
      {showNewCustomer && <CustomerFormModal mode="create" onSave={handleAddCustomer} onClose={()=>setShowNewCustomer(false)}/>}
      {showEditCustomer && <CustomerFormModal mode="edit" customer={showEditCustomer} onSave={d=>handleEditCustomer(showEditCustomer.id,d)} onClose={()=>setShowEditCustomer(null)}/>}
      {showEditProfile && <ProfileFormModal creator={creator} onSave={handleEditProfile} onClose={()=>setShowEditProfile(false)}/>}
      {showCompose && <ComposeModal customers={customers} onClose={()=>setShowCompose(false)} onSend={()=>{setShowCompose(false);showToast("Copied to clipboard!")}}/>}
      {showEditOrder && <EditOrderModal order={showEditOrder.order} dropItems={getDropItems(showEditOrder.dropId)} existingOrderItems={getOrderItems(showEditOrder.order.id)} onSave={(items)=>handleEditOrder(showEditOrder.order.id,items,showEditOrder.dropId)} onClose={()=>setShowEditOrder(null)}/>}
      {showRevenue && <RevenueModal drops={drops} orders={orders} getDropOrders={getDropOrders} getOrderItems={getOrderItems} customers={customers} onClose={()=>setShowRevenue(false)} onViewDrop={d=>{setShowRevenue(false);setSelectedDrop(d);setTab("drops")}}/>}
    </>
  );
}

// ============================================================
// DASHBOARD TAB — Clean with getting started + clickable revenue
// ============================================================
function DashboardTab({ creator, customers, drops, orders, orderItems, dropItems, getDropOrders, getDropItems, getOrderItems, onViewDrop, onShowRevenue, onGoToDrops, onNewDrop, onGoToSettings, onGoToCustomers }) {
  const activeDrops = drops.filter(d => d.status === "active" && !d.archived);
  const nonArchived = drops.filter(d => !d.archived);
  const confirmedOrders = orders.filter(o => o.status !== "cancelled");
  const totalRev = confirmedOrders.reduce((s, o) => s + Number(o.total), 0);

  const hasProfile = creator?.name && creator.name !== "My Food Business";
  const hasDrops = drops.length > 0;
  const hasOrders = orders.length > 0;
  const isNewCreator = !hasDrops;

  // Getting started steps
  const steps = [
    { num: 1, title: "Set up your profile", desc: "Add your business name and tagline so customers know who you are.", done: hasProfile, action: onGoToSettings },
    { num: 2, title: "Create your first drop", desc: "Add menu items, set a pickup date and location, and upload food photos.", done: hasDrops, action: onNewDrop },
    { num: 3, title: "Share your page with customers", desc: "Copy your customer link and send it out via text or email.", done: hasDrops && customers.length > 0, action: null },
    { num: 4, title: "Manage incoming orders", desc: "Track who ordered, view your prep summary, and mark pickups complete.", done: hasOrders, action: onGoToDrops },
  ];

  return (<>
    <div style={{marginBottom:28}}><h1>Dashboard</h1><p style={{color:"var(--text-secondary)",marginTop:4}}>Welcome back{creator?.name ? `, ${creator.name}` : ""}!</p></div>

    {/* Getting Started Guide — shows when no drops exist */}
    {isNewCreator && (
      <div className="getting-started">
        <div className="gs-title">Let's get you set up!</div>
        <div className="gs-sub">Follow these steps to start taking orders from your customers.</div>
        <div className="gs-steps">
          {steps.map(step => (
            <div key={step.num} className="gs-step" onClick={step.action || undefined} style={{cursor: step.action ? "pointer" : "default"}}>
              <div className={`gs-step-num ${step.done ? "gs-step-done" : ""}`}>{step.done ? "✓" : step.num}</div>
              <div><div className="gs-step-title">{step.title}</div><div className="gs-step-desc">{step.desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Stats Row — always visible */}
    <div className="stats-row">
      <div className="stat-card stat-card-clickable" onClick={onShowRevenue}>
        <div className="stat-label">Total Revenue →</div>
        <div className="stat-value">{fmt(totalRev)}</div>
        <div className="stat-sub">Click for breakdown</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Orders</div>
        <div className="stat-value">{confirmedOrders.length}</div>
      </div>
      <div className="stat-card stat-card-clickable" onClick={onGoToCustomers}>
        <div className="stat-label">Customers →</div>
        <div className="stat-value">{customers.length}</div>
      </div>
    </div>

    {/* Active Drops Quick View */}
    {activeDrops.length > 0 && (<>
      <div className="section-header"><h2>Active Drops</h2><button className="btn btn-ghost btn-sm" onClick={onGoToDrops}>View All →</button></div>
      <div style={{display:"grid",gap:16}}>{activeDrops.map(drop=>{const dO=getDropOrders(drop.id).filter(o=>o.status!=="cancelled");return(<div key={drop.id} className="card card-hover drop-card" onClick={()=>onViewDrop(drop)}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><h3>{drop.title}</h3><div className="drop-meta"><span className="drop-meta-item">{I.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span></div></div><span className="badge badge-active">Active</span></div><div style={{marginTop:16,fontSize:14,color:"var(--text-secondary)"}}><strong style={{color:"var(--text)"}}>{dO.length}</strong> orders · <strong style={{color:"var(--text)"}}>{fmt(dO.reduce((s,o)=>s+Number(o.total),0))}</strong></div></div>)})}</div>
    </>)}

    {/* Prompt to create first drop if they have none */}
    {!isNewCreator && activeDrops.length === 0 && (
      <div className="card" style={{textAlign:"center",padding:32}}>
        <div className="empty-state-icon" style={{margin:"0 auto 12px"}}>{I.drop}</div>
        <h3>No active drops</h3>
        <p style={{color:"var(--text-secondary)",fontSize:14,marginTop:4,marginBottom:16}}>Create a new drop to start taking orders.</p>
        <button className="btn btn-primary" onClick={onNewDrop}>{I.plus} New Drop</button>
      </div>
    )}
  </>);
}

// ============================================================
// REVENUE MODAL
// ============================================================
function RevenueModal({ drops, orders, getDropOrders, getOrderItems, customers, onClose, onViewDrop }) {
  const nonArchived = drops.filter(d => !d.archived);
  const confirmedOrders = orders.filter(o => o.status !== "cancelled");
  const totalRev = confirmedOrders.reduce((s, o) => s + Number(o.total), 0);

  // Revenue per drop
  const dropRevenue = nonArchived.map(drop => {
    const dO = getDropOrders(drop.id).filter(o => o.status !== "cancelled");
    return { ...drop, revenue: dO.reduce((s, o) => s + Number(o.total), 0), orderCount: dO.length };
  }).filter(d => d.orderCount > 0).sort((a, b) => b.revenue - a.revenue);
  const maxDropRev = Math.max(...dropRevenue.map(d => d.revenue), 1);

  // Top selling items
  const itemSales = {};
  confirmedOrders.forEach(order => {
    getOrderItems(order.id).forEach(oi => {
      const key = oi.item_name;
      if (!itemSales[key]) itemSales[key] = { name: key, qty: 0, revenue: 0 };
      itemSales[key].qty += oi.quantity;
      itemSales[key].revenue += oi.quantity * Number(oi.item_price);
    });
  });
  const topItems = Object.values(itemSales).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const maxItemRev = Math.max(...topItems.map(i => i.revenue), 1);

  // Repeat customers
  const custOrderCounts = {};
  confirmedOrders.forEach(o => { if (o.customer_id) { custOrderCounts[o.customer_id] = (custOrderCounts[o.customer_id] || 0) + 1; } });
  const repeatCustomers = Object.values(custOrderCounts).filter(c => c > 1).length;
  const avgOrderValue = confirmedOrders.length > 0 ? totalRev / confirmedOrders.length : 0;

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:640}}>
      <div className="modal-header"><h2>Revenue Breakdown</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>

      <div className="stats-row" style={{marginBottom:24}}>
        <div className="stat-card"><div className="stat-label">Total Revenue</div><div className="stat-value">{fmt(totalRev)}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Order</div><div className="stat-value">{fmt(avgOrderValue)}</div></div>
        <div className="stat-card"><div className="stat-label">Repeat Customers</div><div className="stat-value">{repeatCustomers}</div></div>
      </div>

      {dropRevenue.length > 0 && (<div style={{marginBottom:24}}>
        <h3 style={{marginBottom:12}}>Revenue by Drop</h3>
        {dropRevenue.map(drop => (
          <div key={drop.id} className="rev-bar-row" style={{cursor:"pointer"}} onClick={()=>onViewDrop(drop)}>
            <div className="rev-bar-label" title={drop.title}>{drop.title}</div>
            <div className="rev-bar-track"><div className="rev-bar-fill" style={{width:`${(drop.revenue/maxDropRev)*100}%`}}/></div>
            <div className="rev-bar-val">{fmt(drop.revenue)}</div>
          </div>
        ))}
      </div>)}

      {topItems.length > 0 && (<div>
        <h3 style={{marginBottom:12}}>Top Selling Items</h3>
        {topItems.map((item, i) => (
          <div key={i} className="rev-bar-row">
            <div className="rev-bar-label" title={item.name}>{item.name}</div>
            <div className="rev-bar-track"><div className="rev-bar-fill" style={{width:`${(item.revenue/maxItemRev)*100}%`,background:"var(--green)"}}/></div>
            <div className="rev-bar-val">{item.qty} sold · {fmt(item.revenue)}</div>
          </div>
        ))}
      </div>)}

      {dropRevenue.length === 0 && <div className="empty-state"><p>No revenue data yet. Revenue will appear here after your first orders.</p></div>}
    </div></div>
  );
}

// ============================================================
// DROPS TAB — with archive toggle
// ============================================================
function DropsTab({ drops, getDropItems, getDropOrders, onSelect, onNew, onArchive, onUnarchive, onDuplicate }) {
  const [showArchived, setShowArchived] = useState(false);
  const visible = showArchived ? drops : drops.filter(d => !d.archived);
  const archivedCount = drops.filter(d => d.archived).length;

  return (<>
    <div className="section-header">
      <div><h1>Drops</h1></div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        {archivedCount > 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setShowArchived(!showArchived)}>{I.archive} {showArchived ? "Hide" : "Show"} Archived ({archivedCount})</button>}
        <button className="btn btn-primary" onClick={onNew}>{I.plus} New Drop</button>
      </div>
    </div>
    {visible.length===0?(<div className="empty-state"><div className="empty-state-icon">{I.drop}</div><h3>No drops yet</h3><p style={{marginTop:8}}>Create your first drop to start taking orders.</p></div>):(
      <div style={{display:"grid",gap:16}}>{visible.map(drop=>{const dI=getDropItems(drop.id);const dO=getDropOrders(drop.id);const isArchived=drop.archived;return(<div key={drop.id} className={`card card-hover drop-card ${drop.status==="ended"||isArchived?"drop-card-ended":""}`} style={{opacity:isArchived?.6:1}} onClick={()=>!isArchived&&onSelect(drop)}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><h3>{drop.title}</h3><p style={{color:"var(--text-secondary)",fontSize:14,marginTop:4}}>{drop.description}</p><div className="drop-meta"><span className="drop-meta-item">{I.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span></div></div><div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>{isArchived?<><span className="badge badge-archived">Archived</span><button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();onUnarchive(drop.id)}}>Restore</button></>:<><span className={`badge badge-${drop.status}`}>{drop.status==="active"?"Active":"Ended"}</span><button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();onDuplicate(drop)}} title="Duplicate this drop">{I.copy}</button></>}</div></div>{!isArchived&&<><div className="drop-items-preview">{dI.map(item=><span key={item.id} className="drop-item-chip">{item.name} · {fmt(item.price)}</span>)}</div><div style={{marginTop:12,fontSize:14,color:"var(--text-secondary)"}}><strong style={{color:"var(--text)"}}>{dO.length}</strong> order{dO.length!==1?"s":""} · <strong style={{color:"var(--text)"}}>{fmt(dO.reduce((s,o)=>s+Number(o.total),0))}</strong></div></>}</div>)})}</div>
    )}
  </>);
}

// ============================================================
// DROP DETAIL — with archive, edit order buttons
// ============================================================
function DropDetail({ drop, getDropItems, getDropOrders, getOrderItems, customers, onBack, onUpdateOrderStatus, onEndDrop, onEditDrop, onArchiveDrop, onEditOrder, onDuplicate }) {
  const dI=getDropItems(drop.id); const dO=getDropOrders(drop.id); const rev=dO.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+Number(o.total),0);
  const prep=dI.map(item=>{const tot=dO.filter(o=>o.status!=="cancelled").reduce((sum,order)=>{const ois=getOrderItems(order.id);const oi=ois.find(i=>i.drop_item_id===item.id);return sum+(oi?oi.quantity:0)},0);return{...item,totalOrdered:tot}});

  return (<>
    <button className="btn btn-ghost" onClick={onBack} style={{marginBottom:16}}>{I.back} Back to Drops</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28,flexWrap:"wrap",gap:12}}>
      <div>
        {drop.image_url && <img src={drop.image_url} alt="" style={{width:"100%",maxWidth:400,height:160,objectFit:"cover",borderRadius:"var(--radius-sm)",marginBottom:12}}/>}
        <h1>{drop.title}</h1>
        <div className="drop-meta" style={{marginTop:8}}><span className="drop-meta-item">{I.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span></div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <button className="btn btn-secondary btn-sm" onClick={onEditDrop}>{I.edit} Edit</button>
        <button className="btn btn-secondary btn-sm" onClick={onDuplicate}>{I.copy} Duplicate</button>
        <span className={`badge badge-${drop.status}`}>{drop.status==="active"?"Active":"Ended"}</span>
        {drop.status==="active"&&<button className="btn btn-danger btn-sm" onClick={()=>onEndDrop(drop.id)}>End Drop</button>}
        <button className="btn btn-ghost btn-sm" onClick={onArchiveDrop} title="Archive this drop">{I.archive} Archive</button>
      </div>
    </div>
    <div className="stats-row"><div className="stat-card"><div className="stat-label">Orders</div><div className="stat-value">{dO.filter(o=>o.status!=="cancelled").length}</div></div><div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">{fmt(rev)}</div><div className="stat-sub">Cash to collect</div></div></div>

    <div style={{marginBottom:32}}><div className="section-header"><h2>🧑‍🍳 Prep Summary</h2></div><div className="prep-grid">{prep.map(item=>(<div key={item.id} className="prep-item"><div style={{display:"flex",alignItems:"center",gap:12}}>{item.image_url&&<img src={item.image_url} alt="" style={{width:48,height:48,borderRadius:8,objectFit:"cover"}}/>}<div><div className="prep-item-name">{item.name}</div><div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>{fmt(item.price)} each · {item.quantity>0?`${item.quantity-item.totalOrdered} remaining of ${item.quantity}`:"Unlimited"}</div>{item.quantity>0&&<div className="progress-bar" style={{width:160,marginTop:8}}><div className={`progress-fill ${item.totalOrdered>=item.quantity?"full":""}`} style={{width:`${Math.min((item.totalOrdered/item.quantity)*100,100)}%`}}/></div>}</div></div><div className="prep-item-count">{item.totalOrdered}</div></div>))}</div></div>

    <div style={{marginBottom:32}}><div className="section-header"><h2>Orders</h2></div>
      {dO.length===0?<div className="empty-state"><p>No orders yet.</p></div>:(
        <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{dO.map(order=>{const cust=customers.find(c=>c.id===order.customer_id);const ois=getOrderItems(order.id);return(<tr key={order.id}><td><div style={{fontWeight:600}}>{cust?.name||order.customer_name||"Guest"}</div><div style={{fontSize:12,color:"var(--text-tertiary)"}}>{cust?.email||order.customer_email}</div></td><td>{ois.map(oi=><div key={oi.id} style={{fontSize:13}}>{oi.quantity}× {oi.item_name}</div>)}</td><td style={{fontWeight:600}}>{fmt(order.total)}</td><td><span className={`badge badge-${order.status}`}>{order.status==="picked_up"?"Picked Up":order.status==="cancelled"?"Cancelled":"Confirmed"}</span></td><td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{order.status==="confirmed"&&<><button className="btn btn-sm btn-secondary" onClick={()=>onUpdateOrderStatus(order.id,"picked_up")}>{I.check} Picked Up</button><button className="btn btn-sm btn-ghost" onClick={()=>onEditOrder(order)}>{I.edit} Edit</button><button className="btn btn-sm btn-ghost" onClick={()=>onUpdateOrderStatus(order.id,"cancelled")} style={{color:"var(--red)"}}>Cancel</button></>}{order.status!=="confirmed"&&order.status!=="cancelled"&&<button className="btn btn-sm btn-ghost" onClick={()=>onEditOrder(order)}>{I.edit} Edit</button>}</div></td></tr>)})}</tbody></table></div>
      )}
    </div>
  </>);
}

// ============================================================
// CUSTOMERS TAB + DETAIL — Enhanced CRM v7
// ============================================================
function CustomersTab({ customers, orders, drops, getDropOrders, onAddCustomer, onCompose, onSelectCustomer }) {
  const [copied, setCopied] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const activeDrops = drops.filter(d => d.status === "active" && !d.archived);
  const latestActiveDrop = activeDrops[0];

  // Filter customers by search
  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q) || c.notes?.toLowerCase().includes(q);
  });

  const emailCustomers = customers.filter(c => c.prefer_contact === "email");
  const smsCustomers = customers.filter(c => c.prefer_contact === "sms");

  const toggleSelect = (id) => setSelected(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(c=>c.id));
  const selCusts = customers.filter(c => selected.includes(c.id));
  const selEmails = selCusts.filter(c => c.email);
  const selSms = selCusts.filter(c => c.phone);

  const copySelected = (type) => {
    if (type === "email") {
      navigator.clipboard?.writeText(selEmails.map(c=>c.email).join(", "));
      setCopied("sel-email"); setTimeout(()=>setCopied(null),2500);
    } else {
      navigator.clipboard?.writeText(selSms.map(c=>`${c.name}: ${c.phone}`).join("\n"));
      setCopied("sel-sms"); setTimeout(()=>setCopied(null),2500);
    }
  };

  const copyEmails = () => { navigator.clipboard?.writeText(emailCustomers.map(c=>c.email).join(", ")); setCopied("email"); setTimeout(()=>setCopied(null),2500); };
  const copySmsNumbers = () => { navigator.clipboard?.writeText(smsCustomers.map(c=>`${c.name}: ${c.phone}`).join("\n")); setCopied("sms"); setTimeout(()=>setCopied(null),2500); };

  const exportCSV = () => {
    const header = "Name,Email,Phone,Preferred Contact,Notes,Total Orders,Total Spent";
    const rows = customers.map(c => {
      const cO = orders.filter(o=>o.customer_id===c.id&&o.status!=="cancelled");
      const spent = cO.reduce((s,o)=>s+Number(o.total),0);
      return `"${c.name||""}","${c.email||""}","${c.phone||""}","${c.prefer_contact||""}","${(c.notes||"").replace(/"/g,'""')}",${cO.length},${spent.toFixed(2)}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "customers.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const getDropOrderStatus = (customerId) => {
    if (!latestActiveDrop) return null;
    const dropOrders = orders.filter(o => o.drop_id === latestActiveDrop.id && o.status !== "cancelled");
    return dropOrders.some(o => o.customer_id === customerId);
  };

  return (<>
    <div className="section-header"><div><h1>Customers</h1><p style={{color:"var(--text-secondary)",marginTop:4}}>{customers.length} customer{customers.length!==1?"s":""} · {emailCustomers.length} email, {smsCustomers.length} SMS</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="btn btn-secondary btn-sm" onClick={exportCSV}>{I.download} Export CSV</button><button className="btn btn-secondary btn-sm" onClick={onCompose}>{I.send} Compose</button><button className="btn btn-primary" onClick={onAddCustomer}>{I.plus} Add Customer</button></div></div>

    {/* Quick actions */}
    {customers.length > 0 && (
      <div className="card" style={{marginBottom:16,padding:12,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)"}}>Quick:</span>
        {emailCustomers.length > 0 && <button className="btn btn-secondary btn-sm" onClick={copyEmails}>{copied==="email"?<>{I.check} Copied!</>:<>{I.mail} Copy All {emailCustomers.length} Emails</>}</button>}
        {smsCustomers.length > 0 && <button className="btn btn-secondary btn-sm" onClick={copySmsNumbers}>{copied==="sms"?<>{I.check} Copied!</>:<>{I.phone} Copy All {smsCustomers.length} SMS</>}</button>}
      </div>
    )}

    {/* Search */}
    {customers.length > 3 && (
      <div className="search-bar">{I.search}<input placeholder="Search customers by name, email, phone, or notes..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    )}

    {/* Bulk action bar */}
    {selected.length > 0 && (
      <div className="bulk-bar">
        <div className="bulk-bar-count">{selected.length} selected</div>
        <div className="bulk-bar-actions">
          {selEmails.length > 0 && <button className="btn btn-secondary btn-sm" onClick={()=>copySelected("email")}>{copied==="sel-email"?<>{I.check} Copied!</>:<>{I.mail} Copy {selEmails.length} Email{selEmails.length!==1?"s":""}</>}</button>}
          {selSms.length > 0 && <button className="btn btn-secondary btn-sm" onClick={()=>copySelected("sms")}>{copied==="sel-sms"?<>{I.check} Copied!</>:<>{I.phone} Copy {selSms.length} Phone{selSms.length!==1?"s":""}</>}</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>setSelected([])}>Clear</button>
        </div>
      </div>
    )}

    {filtered.length===0 && customers.length > 0 ? (<div className="empty-state"><p>No customers match "{search}"</p></div>) :
    filtered.length===0?(<div className="empty-state"><div className="empty-state-icon">{I.users}</div><h3>No customers yet</h3><p style={{marginTop:8}}>Customers appear here when they place orders.</p></div>):(
      <div className="table-wrap"><table><thead><tr><th style={{width:40}}><input type="checkbox" checked={selected.length===filtered.length&&filtered.length>0} onChange={toggleAll} style={{accentColor:"var(--accent)",width:16,height:16}}/></th><th>Name</th><th>Contact</th><th>Preferred</th>{latestActiveDrop && <th style={{maxWidth:120}}>{latestActiveDrop.title.length > 15 ? latestActiveDrop.title.slice(0,15)+"…" : latestActiveDrop.title}</th>}<th>Orders</th><th>Spent</th><th></th></tr></thead><tbody>{filtered.map(c=>{const cO=orders.filter(o=>o.customer_id===c.id&&o.status!=="cancelled");const dropStatus=getDropOrderStatus(c.id);const isSelected=selected.includes(c.id);return(<tr key={c.id} style={{cursor:"pointer",background:isSelected?"var(--accent-light)":"transparent"}}><td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(c.id)} style={{accentColor:"var(--accent)",width:16,height:16}}/></td><td onClick={()=>onSelectCustomer(c)}><div style={{fontWeight:600}}>{c.name}</div>{c.notes&&<div style={{fontSize:11,color:"var(--text-tertiary)",marginTop:2,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.notes}>📝 {c.notes}</div>}</td><td onClick={()=>onSelectCustomer(c)}><div style={{fontSize:13}}>{c.email}</div>{c.phone&&<div style={{fontSize:12,color:"var(--text-tertiary)"}}>{c.phone}</div>}</td><td onClick={()=>onSelectCustomer(c)}><span className={`badge ${c.prefer_contact==="sms"?"badge-fcfs":"badge-preorder"}`}>{c.prefer_contact==="sms"?"SMS":"Email"}</span></td>{latestActiveDrop && <td onClick={()=>onSelectCustomer(c)}>{dropStatus===null?"":<span className={`badge ${dropStatus?"badge-active":"badge-cancelled"}`} style={{fontSize:11}}>{dropStatus?"Ordered":"Not yet"}</span>}</td>}<td onClick={()=>onSelectCustomer(c)}>{cO.length}</td><td onClick={()=>onSelectCustomer(c)} style={{fontWeight:500}}>{fmt(cO.reduce((s,o)=>s+Number(o.total),0))}</td><td><span style={{color:"var(--text-tertiary)"}}>{I.history}</span></td></tr>)})}</tbody></table></div>
    )}

    {/* Who hasn't ordered */}
    {latestActiveDrop && customers.length > 0 && (() => {
      const notOrdered = customers.filter(c => getDropOrderStatus(c.id) === false);
      if (notOrdered.length === 0) return null;
      const notOrderedEmails = notOrdered.filter(c => c.prefer_contact === "email");
      const notOrderedSms = notOrdered.filter(c => c.prefer_contact === "sms");
      return (
        <div className="card" style={{marginTop:20,borderLeft:"4px solid var(--gold)"}}>
          <div><h3 style={{color:"var(--gold)"}}>Haven't ordered "{latestActiveDrop.title}" yet</h3><p style={{fontSize:13,color:"var(--text-secondary)",marginTop:4}}>{notOrdered.length} customer{notOrdered.length!==1?"s":""} haven't placed an order.</p></div>
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            {notOrderedEmails.length > 0 && <button className="btn btn-secondary btn-sm" onClick={()=>{navigator.clipboard?.writeText(notOrderedEmails.map(c=>c.email).join(", "));setCopied("nudge-email");setTimeout(()=>setCopied(null),2500)}}>{copied==="nudge-email"?<>{I.check} Copied!</>:<>{I.mail} Copy {notOrderedEmails.length} email{notOrderedEmails.length!==1?"s":""}</>}</button>}
            {notOrderedSms.length > 0 && <button className="btn btn-secondary btn-sm" onClick={()=>{navigator.clipboard?.writeText(notOrderedSms.map(c=>`${c.name}: ${c.phone}`).join("\n"));setCopied("nudge-sms");setTimeout(()=>setCopied(null),2500)}}>{copied==="nudge-sms"?<>{I.check} Copied!</>:<>{I.phone} Copy {notOrderedSms.length} SMS</>}</button>}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12}}>{notOrdered.map(c=><span key={c.id} className="recipient-tag">{c.name} · {c.prefer_contact==="sms"?"SMS":"Email"}</span>)}</div>
        </div>
      );
    })()}
  </>);
}

function CustomerDetail({ customer, orders, drops, getOrderItems, onBack, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const custOrders = orders.filter(o => o.customer_id === customer.id);
  const nonCancelled = custOrders.filter(o => o.status !== "cancelled");
  const totalSpent = nonCancelled.reduce((s, o) => s + Number(o.total), 0);

  return (<>
    <button className="btn btn-ghost" onClick={onBack} style={{marginBottom:16}}>{I.back} Back to Customers</button>
    <div className="cust-detail-panel">
      <div className="cust-detail-header">
        <div>
          <h1>{customer.name}</h1>
          <div style={{display:"flex",gap:16,marginTop:8,fontSize:14,color:"var(--text-secondary)",flexWrap:"wrap"}}><span style={{display:"flex",alignItems:"center",gap:6}}>{I.mail} {customer.email}</span>{customer.phone&&<span style={{display:"flex",alignItems:"center",gap:6}}>{I.phone} {customer.phone}</span>}</div>
          <div style={{marginTop:8}}><span className={`badge ${customer.prefer_contact==="sms"?"badge-fcfs":"badge-preorder"}`}>Prefers {customer.prefer_contact==="sms"?"SMS":"Email"}</span></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={onEdit}>{I.edit} Edit</button>
          {!confirmDelete ? (
            <button className="btn btn-danger btn-sm" onClick={()=>setConfirmDelete(true)}>Delete</button>
          ) : (
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:12,color:"var(--red)"}}>Sure?</span>
              <button className="btn btn-danger btn-sm" onClick={onDelete}>Yes</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmDelete(false)}>No</button>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {customer.notes && (
        <div style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:12,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--text-tertiary)",textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Notes</div>
          <div style={{fontSize:14,color:"var(--text-secondary)",whiteSpace:"pre-wrap"}}>{customer.notes}</div>
        </div>
      )}

      <div className="stats-row" style={{marginBottom:0}}>
        <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{nonCancelled.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Spent</div><div className="stat-value">{fmt(totalSpent)}</div></div>
        <div className="stat-card"><div className="stat-label">Customer Since</div><div className="stat-value" style={{fontSize:20}}>{customer.joined_at?fmtDate(customer.joined_at):customer.created_at?fmtDate(customer.created_at.slice(0,10)):"N/A"}</div></div>
      </div>
    </div>
    <h2 style={{marginBottom:16}}>Order History</h2>
    {custOrders.length===0?(<div className="empty-state"><p>No orders yet from this customer.</p></div>):(
      <div className="cust-order-timeline">{custOrders.map(order=>{const drop=drops.find(d=>d.id===order.drop_id);const ois=getOrderItems(order.id);return(<div key={order.id} className="cust-order-item"><div className="cust-order-dot"/><div className="card" style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div><h3>{drop?.title||"Unknown Drop"}</h3><div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>{drop?`${fmtDate(drop.pickup_date)}, ${drop.pickup_time}`:""}</div></div><span className={`badge badge-${order.status}`}>{order.status==="picked_up"?"Picked Up":order.status==="cancelled"?"Cancelled":"Confirmed"}</span></div>{ois.map(oi=>(<div key={oi.id} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"4px 0"}}><span>{oi.quantity}× {oi.item_name}</span><span style={{color:"var(--text-secondary)"}}>{fmt(oi.item_price*oi.quantity)}</span></div>))}<div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)",fontWeight:600}}><span>Total</span><span>{fmt(order.total)}</span></div></div></div>)})}</div>
    )}
  </>);
}

// ============================================================
// SETTINGS TAB
// ============================================================
function SettingsTab({ creator, onEditProfile }) {
  return (<>
    <div style={{marginBottom:28}}><h1>Settings</h1><p style={{color:"var(--text-secondary)",marginTop:4}}>Manage your storefront profile</p></div>
    <div className="card" style={{maxWidth:600}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}><h2>Storefront Profile</h2><button className="btn btn-secondary btn-sm" onClick={onEditProfile}>{I.edit} Edit</button></div>
      <div className="form-group"><label className="form-label">Business Name</label><div style={{fontSize:16,fontWeight:600}}>{creator?.name||"Not set"}</div></div>
      <div className="form-group"><label className="form-label">Tagline</label><div style={{fontSize:14,color:"var(--text-secondary)"}}>{creator?.tagline||"Not set"}</div></div>
      <div style={{padding:16,background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",marginTop:8}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--text-tertiary)",textTransform:"uppercase",letterSpacing:.3,marginBottom:8}}>Preview</div>
        <div style={{fontFamily:"var(--font-display)",fontSize:24,fontWeight:700}}>{creator?.name||"Your Business"}</div>
        <div style={{color:"var(--text-secondary)",fontSize:14,marginTop:4}}>{creator?.tagline||"Your tagline here"}</div>
      </div>
      <p style={{fontSize:12,color:"var(--text-tertiary)",marginTop:16}}>This is what customers see at the top of your page.</p>
    </div>
  </>);
}

// ============================================================
// MODALS
// ============================================================

// --- Image Upload Component ---
function ImageUpload({ value, onChange, label }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { url, error } = await supabase.uploadImage(file);
    setUploading(false);
    if (url) onChange(url);
  };
  return (
    <div className="form-group">
      <label className="form-label">{label || "Image"}</label>
      {value ? (
        <div style={{position:"relative"}}>
          <img src={value} alt="" className="img-upload-preview" style={{width:"100%",height:120,objectFit:"cover",borderRadius:"var(--radius-sm)"}}/>
          <button className="btn btn-sm btn-ghost" onClick={()=>onChange("")} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.6)",color:"#fff",borderRadius:20,padding:"4px 8px"}}>{I.x}</button>
        </div>
      ) : (
        <div className="img-upload">
          <input type="file" accept="image/*" onChange={handleFile}/>
          <div>{uploading ? <><div className="spin" style={{width:20,height:20,margin:"0 auto 8px"}}/> Uploading...</> : <><span style={{color:"var(--accent)"}}>{I.image}</span><div style={{fontSize:13,color:"var(--text-secondary)",marginTop:4}}>Click or drag to upload</div></>}</div>
        </div>
      )}
    </div>
  );
}

// --- Drop Form (create + edit, with images) ---
function DropFormModal({ mode, drop, existingItems, duplicateFrom, duplicateItems, onSave, onClose }) {
  const src = drop || duplicateFrom;
  const srcItems = existingItems || duplicateItems;
  const [title, setTitle] = useState(duplicateFrom ? "" : (src?.title || ""));
  const [desc, setDesc] = useState(src?.description || "");
  const [pickupDate, setPickupDate] = useState(duplicateFrom ? "" : (src?.pickup_date || ""));
  const [pickupTime, setPickupTime] = useState(src?.pickup_time || "");
  const [pickupLocation, setPickupLocation] = useState(src?.pickup_location || "");
  const [imageUrl, setImageUrl] = useState(src?.image_url || "");
  const [items, setItems] = useState(() => {
    if (srcItems?.length) return srcItems.map(i => ({
      id: duplicateFrom ? `dup${i.id}` : i.id,
      existingId: duplicateFrom ? undefined : i.id,
      name: i.name, price: String(i.price),
      quantity: i.quantity===-1?"":String(i.quantity),
      unlimited: i.quantity===-1, sortOrder: i.sort_order,
      imageUrl: i.image_url||""
    }));
    return [{ id: "i0", name: "", price: "", quantity: "", unlimited: false, imageUrl: "" }];
  });
  const [saving, setSaving] = useState(false);
  const addItem = () => setItems([...items, { id: `i${Date.now()}`, name: "", price: "", quantity: "", unlimited: false, sortOrder: items.length, imageUrl: "" }]);
  const removeItem = (id) => items.length > 1 && setItems(items.filter(i => i.id !== id));
  const updateItem = (id, f, v) => setItems(items.map(i => (i.id === id ? { ...i, [f]: v } : i)));
  const canSave = title && pickupDate && pickupTime && pickupLocation && items.every(i => i.name && i.price) && !saving;
  const handleSave = async () => { setSaving(true); await onSave({ title, description: desc, pickupDate, pickupTime, pickupLocation, imageUrl }, items); setSaving(false); };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2>{mode==="edit"?"Edit Drop":duplicateFrom?"Duplicate Drop":"Create New Drop"}</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div className="form-group"><label className="form-label">Drop Title</label><input className="form-input" placeholder='e.g., "Friday Dinner Box — March 6"' value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" placeholder="Describe what's in this drop..." value={desc} onChange={e=>setDesc(e.target.value)}/></div>
      <ImageUpload value={imageUrl} onChange={setImageUrl} label="Drop Cover Image (optional)"/>
      <div className="form-row"><div className="form-group"><label className="form-label">Pickup Date</label><input className="form-input" type="date" value={pickupDate} onChange={e=>setPickupDate(e.target.value)}/></div><div className="form-group"><label className="form-label">Pickup Time</label><input className="form-input" placeholder="5:00 PM – 7:00 PM" value={pickupTime} onChange={e=>setPickupTime(e.target.value)}/></div></div>
      <div className="form-group"><label className="form-label">Pickup Location</label><input className="form-input" placeholder="123 Main St" value={pickupLocation} onChange={e=>setPickupLocation(e.target.value)}/></div>
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><label className="form-label" style={{marginBottom:0}}>Menu Items</label><button className="btn btn-ghost btn-sm" onClick={addItem}>{I.plus} Add Item</button></div>
        {items.map((item,idx)=>(<div key={item.id} style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:16,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)"}}>Item {idx+1}</span>{items.length>1&&<button className="btn btn-ghost btn-sm" onClick={()=>removeItem(item.id)} style={{color:"var(--accent)",padding:4}}>{I.x}</button>}</div>
          <input className="form-input" placeholder="Item name" value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)} style={{marginBottom:8}}/>
          <div className="form-row"><input className="form-input" type="number" placeholder="Price" min="0" step="0.01" value={item.price} onChange={e=>updateItem(item.id,"price",e.target.value)}/><input className="form-input" type="number" placeholder="Quantity" min="1" value={item.unlimited?"":item.quantity} disabled={item.unlimited} onChange={e=>updateItem(item.id,"quantity",e.target.value)}/></div>
          <label className="checkbox-row" style={{marginTop:10}}><input type="checkbox" checked={item.unlimited} onChange={e=>updateItem(item.id,"unlimited",e.target.checked)}/>Unlimited quantity</label>
          <ImageUpload value={item.imageUrl} onChange={url=>updateItem(item.id,"imageUrl",url)} label="Item Image (optional)"/>
        </div>))}
      </div>
      <button className="btn btn-primary btn-full" disabled={!canSave} onClick={handleSave}>{saving?"Saving...":(mode==="edit"?"Save Changes":"Create Drop")}</button>
    </div></div>
  );
}

// --- Edit Order Modal ---
function EditOrderModal({ order, dropItems, existingOrderItems, onSave, onClose }) {
  const [items, setItems] = useState(() => {
    return dropItems.map(di => {
      const existing = existingOrderItems.find(oi => oi.drop_item_id === di.id);
      return { drop_item_id: di.id, item_name: di.name, item_price: Number(di.price), quantity: existing ? existing.quantity : 0, maxQty: di.quantity > 0 ? di.quantity : 999 };
    });
  });

  const updateQty = (diId, delta) => {
    setItems(prev => prev.map(i => {
      if (i.drop_item_id !== diId) return i;
      const next = Math.max(0, i.quantity + delta);
      return { ...i, quantity: Math.min(next, i.maxQty) };
    }));
  };

  const total = items.reduce((s, i) => s + i.quantity * i.item_price, 0);
  const hasItems = items.some(i => i.quantity > 0);

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2>Edit Order</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <p style={{fontSize:14,color:"var(--text-secondary)",marginBottom:16}}>Adjust items and quantities for this order. Changes will update the prep summary and revenue.</p>
      {items.map(item => (
        <div key={item.drop_item_id} className="oi-row">
          <div className="oi-info"><div className="oi-name">{item.item_name}</div><div className="oi-price">{fmt(item.item_price)}</div></div>
          <div className="qty-ctrl">
            <button className="qty-btn" onClick={()=>updateQty(item.drop_item_id,-1)} disabled={item.quantity===0}>−</button>
            <span className="qty-val">{item.quantity}</span>
            <button className="qty-btn" onClick={()=>updateQty(item.drop_item_id,1)}>+</button>
          </div>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",padding:"16px 0",fontFamily:"var(--font-display)",fontSize:20,fontWeight:600,borderTop:"1px solid var(--border)",marginTop:8}}>
        <span>New Total</span><span>{fmt(total)}</span>
      </div>
      <button className="btn btn-primary btn-full" disabled={!hasItems} onClick={()=>onSave(items.filter(i=>i.quantity>0))}>Save Changes</button>
    </div></div>
  );
}

// --- Customer Form ---
function CustomerFormModal({ mode, customer, onSave, onClose }) {
  const [name, setName] = useState(customer?.name||""); const [email, setEmail] = useState(customer?.email||""); const [phone, setPhone] = useState(customer?.phone||""); const [prefer, setPrefer] = useState(customer?.prefer_contact||"email"); const [notes, setNotes] = useState(customer?.notes||"");
  const [saving, setSaving] = useState(false);
  const canSave = name && email && !saving;
  const handleSave = async () => { setSaving(true); await onSave({ name, email, phone, preferContact: prefer, notes }); setSaving(false); };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2>{mode==="edit"?"Edit Customer":"Add Customer"}</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="555-0100" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Preferred Contact</label><select className="form-select" value={prefer} onChange={e=>setPrefer(e.target.value)}><option value="email">Email</option><option value="sms">SMS / Text</option></select></div>
      <div className="form-group"><label className="form-label">Notes (optional)</label><textarea className="form-textarea" rows={3} placeholder="Allergies, preferences, special requests..." value={notes} onChange={e=>setNotes(e.target.value)}/><div className="form-hint">Only visible to you, not the customer</div></div>
      <button className="btn btn-primary btn-full" disabled={!canSave} onClick={handleSave}>{saving?"Saving...":(mode==="edit"?"Save Changes":"Add Customer")}</button>
    </div></div>
  );
}

// --- Profile Form ---
function ProfileFormModal({ creator, onSave, onClose }) {
  const [name, setName] = useState(creator?.name||""); const [tagline, setTagline] = useState(creator?.tagline||""); const [saving, setSaving] = useState(false);
  const handleSave = async () => { setSaving(true); await onSave({ name, tagline }); setSaving(false); };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2>Edit Profile</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div className="form-group"><label className="form-label">Business Name</label><input className="form-input" placeholder="Your business name" value={name} onChange={e=>setName(e.target.value)}/><div className="form-hint">Appears at the top of your customer page</div></div>
      <div className="form-group"><label className="form-label">Tagline</label><input className="form-input" placeholder="Fresh food, made with love" value={tagline} onChange={e=>setTagline(e.target.value)}/></div>
      <div style={{padding:16,background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--text-tertiary)",textTransform:"uppercase",letterSpacing:.3,marginBottom:8}}>Preview</div>
        <div style={{fontFamily:"var(--font-display)",fontSize:24,fontWeight:700}}>{name||"Your Business"}</div>
        <div style={{color:"var(--text-secondary)",fontSize:14,marginTop:4}}>{tagline||"Your tagline here"}</div>
      </div>
      <button className="btn btn-primary btn-full" disabled={!name||saving} onClick={handleSave}>{saving?"Saving...":"Save Profile"}</button>
    </div></div>
  );
}

// --- Compose Modal ---
function ComposeModal({ customers, onClose, onSend }) {
  const [message, setMessage] = useState("Hey! 🍽️ A new drop just went live — check it out and grab your order before it sells out!");
  const [selectedIds, setSelectedIds] = useState(customers.map(c=>c.id));
  const toggle=id=>setSelectedIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const sms=customers.filter(c=>selectedIds.includes(c.id)&&c.prefer_contact==="sms");
  const email=customers.filter(c=>selectedIds.includes(c.id)&&c.prefer_contact==="email");
  const handleCopy=()=>{const text=`${message}\n\n---\nSMS Recipients:\n${sms.map(c=>`${c.name}: ${c.phone}`).join("\n")}\n\nEmail Recipients:\n${email.map(c=>`${c.name}: ${c.email}`).join("\n")}`;navigator.clipboard?.writeText(text);onSend()};
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:600}}>
      <div className="modal-header"><h2>Compose Message</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><label className="form-label" style={{marginBottom:0}}>Recipients ({selectedIds.length})</label><div style={{display:"flex",gap:8}}><button className="btn btn-ghost btn-sm" onClick={()=>setSelectedIds(customers.map(c=>c.id))}>All</button><button className="btn btn-ghost btn-sm" onClick={()=>setSelectedIds([])}>None</button></div></div>
        <div style={{maxHeight:140,overflow:"auto",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:8}}>{customers.map(c=>(<label key={c.id} className="checkbox-row" style={{padding:"6px 8px"}}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={()=>toggle(c.id)}/><span>{c.name}</span><span style={{marginLeft:"auto",fontSize:12,color:"var(--text-tertiary)"}}>{c.prefer_contact==="sms"?"SMS":"Email"}</span></label>))}</div>
      </div>
      <div className="form-group"><label className="form-label">Message</label><textarea className="form-textarea" rows={4} value={message} onChange={e=>setMessage(e.target.value)}/></div>
      <div className="compose-area">
        {sms.length>0&&<div style={{marginBottom:8}}><span style={{fontSize:12,color:"var(--text-tertiary)",fontWeight:600}}>VIA SMS ({sms.length}):</span><div className="recipient-tags" style={{marginTop:4}}>{sms.map(c=><span key={c.id} className="recipient-tag">{c.name} · {c.phone}</span>)}</div></div>}
        {email.length>0&&<div><span style={{fontSize:12,color:"var(--text-tertiary)",fontWeight:600}}>VIA EMAIL ({email.length}):</span><div className="recipient-tags" style={{marginTop:4}}>{email.map(c=><span key={c.id} className="recipient-tag">{c.name} · {c.email}</span>)}</div></div>}
      </div>
      <p style={{fontSize:12,color:"var(--text-tertiary)",marginTop:12}}>Copies message + recipient list to clipboard.</p>
      <button className="btn btn-primary btn-full" style={{marginTop:16}} onClick={handleCopy}>{I.clipboard} Copy to Clipboard</button>
    </div></div>
  );
}

// ============================================================
// IMAGE LIGHTBOX
// ============================================================
function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <img src={src} alt="" className="lightbox-img" onClick={e=>e.stopPropagation()}/>
    </div>
  );
}

// ============================================================
// CUSTOMER STOREFRONT (unchanged except image support)
// ============================================================
function CustomerStorefront({ creator, drops, getDropItems, showToast, loadData, customers }) {
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const active = drops.filter(d=>d.status==="active"&&!d.archived);

  if (orderConfirmation) return (<><CustomerHeader creator={creator}/><div className="cust-body page-enter"><OrderConfirmation order={orderConfirmation} creator={creator} onBack={()=>{setOrderConfirmation(null);setSelectedDrop(null)}}/></div></>);
  if (selectedDrop) return (<><CustomerHeader creator={creator}/><div className="cust-body page-enter"><DropOrderPage drop={selectedDrop} items={getDropItems(selectedDrop.id)} creator={creator} customers={customers} onBack={()=>setSelectedDrop(null)} onOrderPlaced={order=>{setOrderConfirmation(order);loadData()}} showToast={showToast}/></div></>);

  return (<><CustomerHeader creator={creator}/><div className="cust-body page-enter">
    {active.length===0?(<div className="empty-state" style={{marginTop:40}}><div className="empty-state-icon">{I.drop}</div><h3>No active drops right now</h3><p style={{marginTop:8}}>Check back soon!</p></div>):(<>
      <h2 style={{marginBottom:20}}>Available Drops</h2>
      <div style={{display:"grid",gap:20}}>{active.map(drop=>{const dI=getDropItems(drop.id);const bannerStyle=drop.image_url?{backgroundImage:`linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url(${drop.image_url})`,backgroundSize:"cover",backgroundPosition:"center"}:{};return(<div key={drop.id} className="cust-drop-card" onClick={()=>setSelectedDrop(drop)}><div className="cust-drop-banner" style={bannerStyle}><h2>{drop.title}</h2>{drop.description&&<p style={{fontSize:14,marginTop:6,opacity:.9}}>{drop.description}</p>}</div><div className="cust-drop-body"><div className="cust-drop-detail">{I.clock} <span>{fmtDateLong(drop.pickup_date)}, {drop.pickup_time}</span></div><div className="cust-drop-detail">{I.pin} <span>{drop.pickup_location}</span></div><div className="cust-drop-detail">{I.dollar} <span>Cash at pickup</span></div><div className="cust-drop-items-peek"><span>{dI.length} item{dI.length!==1?"s":""}: {dI.map(i=>i.name).join(", ")}</span></div><div style={{marginTop:16}}><span className="btn btn-primary btn-full">View Menu & Order →</span></div></div></div>)})}</div>
    </>)}
  </div></>);
}

function CustomerHeader({ creator }) {
  return <div className="cust-header"><div className="cust-header-name">{creator?.name||"FoodDrop"}</div><div className="cust-header-tagline">{creator?.tagline||"Fresh food, made with love"}</div></div>;
}

function DropOrderPage({ drop, items, creator, customers, onBack, onOrderPlaced, showToast }) {
  const [cart, setCart] = useState({});
  const [step, setStep] = useState("menu");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [preferContact, setPreferContact] = useState("email");
  const [placing, setPlacing] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  const updateCart = (itemId, delta, item) => { setCart(prev => { const curr=prev[itemId]||0; const next=Math.max(0,curr+delta); const max=item.quantity>0?item.quantity-item.claimed:999; if(next>max) return prev; return{...prev,[itemId]:next}; }); };
  const cartCount = Object.values(cart).reduce((s,q)=>s+q,0);
  const cartTotal = Object.entries(cart).reduce((sum,[id,qty])=>{const item=items.find(i=>i.id===id);return sum+(item?Number(item.price)*qty:0)},0);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    const cartItems = Object.entries(cart).filter(([,q])=>q>0).map(([id,qty])=>({dropItemId:id,qty}));
    let customerId = null;
    const existing = customers.find(c=>c.email.toLowerCase()===email.toLowerCase());
    if(existing){customerId=existing.id}else if(creator){const{data:nc}=await supabase.from("customers").insert({creator_id:creator.id,name,email,phone,prefer_contact:preferContact}).select("*").single().execute();if(nc)customerId=nc.id}
    const{data:no,error}=await supabase.from("orders").insert({drop_id:drop.id,customer_id:customerId,total:cartTotal,status:"confirmed",customer_name:name,customer_email:email}).select("*").single().execute();
    if(error||!no){showToast("Failed to place order","error");setPlacing(false);return}
    await supabase.from("order_items").insert(cartItems.map(ci=>{const di=items.find(d=>d.id===ci.dropItemId);return{order_id:no.id,drop_item_id:ci.dropItemId,item_name:di?.name||"Unknown",item_price:di?.price||0,quantity:ci.qty}})).execute();
    for(const ci of cartItems){const di=items.find(d=>d.id===ci.dropItemId);if(di)await supabase.from("drop_items").update({claimed:di.claimed+ci.qty}).eq("id",di.id).execute()}
    const orderDetail={...no,items:cartItems.map(ci=>{const di=items.find(d=>d.id===ci.dropItemId);return{name:di?.name,price:di?.price,qty:ci.qty}}),drop,customerName:name,customerEmail:email};
    setPlacing(false);onOrderPlaced(orderDetail);
  };

  return (<>
    <button className="btn btn-ghost" onClick={step==="checkout"?()=>setStep("menu"):onBack} style={{marginBottom:16}}>{I.back} {step==="checkout"?"Back to menu":"Back to drops"}</button>
    <div className="card" style={{marginBottom:24,borderLeft:"4px solid var(--accent)"}}>
      {drop.image_url&&<img src={drop.image_url} alt="" style={{width:"100%",height:160,objectFit:"cover",borderRadius:"var(--radius-sm)",marginBottom:12}}/>}
      <h2>{drop.title}</h2>{drop.description&&<p style={{color:"var(--text-secondary)",fontSize:14,marginTop:6}}>{drop.description}</p>}
      <div className="drop-meta" style={{marginTop:12}}><span className="drop-meta-item">{I.clock} {fmtDateLong(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span><span className="drop-meta-item">{I.dollar} Cash at pickup</span></div>
    </div>

    {step==="menu"&&(<>
      <h3 style={{marginBottom:4}}>Menu</h3><p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:16}}>Select what you'd like to order</p>
      <div className="card">{items.map(item=>{const avail=item.quantity>0?item.quantity-item.claimed:-1;const sold=item.quantity>0&&avail<=0;return(<div key={item.id} className="oi-row" style={{opacity:sold?.5:1}}><div className="oi-info" style={{display:"flex",gap:12,alignItems:"center"}}>{item.image_url&&<img src={item.image_url} alt="" onClick={e=>{e.stopPropagation();setLightboxImg(item.image_url)}} style={{width:56,height:56,borderRadius:8,objectFit:"cover",flexShrink:0,cursor:"pointer",transition:"transform .15s"}} onMouseOver={e=>e.target.style.transform="scale(1.05)"} onMouseOut={e=>e.target.style.transform="scale(1)"}/>}<div><div className="oi-name">{item.name}</div><div className="oi-price">{fmt(item.price)}</div><div className="oi-avail">{sold?"Sold out":item.quantity>0?`${avail} left`:"Available"}</div></div></div>{!sold&&<div className="qty-ctrl"><button className="qty-btn" onClick={()=>updateCart(item.id,-1,item)} disabled={!cart[item.id]}>−</button><span className="qty-val">{cart[item.id]||0}</span><button className="qty-btn" onClick={()=>updateCart(item.id,1,item)}>+</button></div>}</div>)})}</div>
      {cartCount>0&&<div style={{position:"sticky",bottom:16,marginTop:24}}><button className="btn btn-primary btn-full" onClick={()=>setStep("checkout")} style={{padding:"14px 24px",fontSize:16,boxShadow:"var(--shadow-lg)"}}>Continue — {cartCount} item{cartCount!==1?"s":""}, {fmt(cartTotal)}</button></div>}
      <Lightbox src={lightboxImg} onClose={()=>setLightboxImg(null)}/>
    </>)}

    {step==="checkout"&&(<>
      <h3 style={{marginBottom:4}}>Your Order</h3><p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:16}}>Review your items, then enter your info</p>
      <div className="card" style={{marginBottom:20}}>
        {Object.entries(cart).filter(([,q])=>q>0).map(([id,qty])=>{const item=items.find(i=>i.id===id);return item?<div key={id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}><span>{qty}× {item.name}</span><span style={{fontWeight:600}}>{fmt(item.price*qty)}</span></div>:null})}
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0",fontFamily:"var(--font-display)",fontSize:20,fontWeight:600}}><span>Total</span><span>{fmt(cartTotal)}</span></div>
        <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:4}}>💵 Pay cash at pickup</div>
      </div>
      <div className="card">
        <h3 style={{marginBottom:16}}>Your Information</h3>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/><div className="form-hint">We'll send your order confirmation here</div></div>
        <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="555-0100" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
        <div className="form-group"><label className="form-label">How should we reach you about future drops?</label><div style={{display:"flex",gap:20}}><label className="checkbox-row"><input type="radio" name="prefer" checked={preferContact==="email"} onChange={()=>setPreferContact("email")}/>{I.mail} Email</label><label className="checkbox-row"><input type="radio" name="prefer" checked={preferContact==="sms"} onChange={()=>setPreferContact("sms")}/>{I.phone} Text / SMS</label></div></div>
      </div>
      <button className="btn btn-primary btn-full" style={{marginTop:20,padding:"14px 24px",fontSize:16}} disabled={!name||!email||placing} onClick={handlePlaceOrder}>{placing?"Placing order...":`Confirm Order — ${fmt(cartTotal)}`}</button>
    </>)}
  </>);
}

function OrderConfirmation({ order, creator, onBack }) {
  return (<div className="confirm-box page-enter">
    <div className="confirm-icon"><svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
    <h1 style={{marginBottom:8}}>Order Confirmed!</h1>
    <p style={{color:"var(--text-secondary)",fontSize:16,marginBottom:28}}>Thanks, {order.customerName}!</p>
    <div className="card" style={{textAlign:"left",marginBottom:20}}>
      <h3 style={{marginBottom:12}}>{order.drop.title}</h3>
      <div style={{fontSize:14,color:"var(--text-secondary)",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>{I.clock} {fmtDateLong(order.drop.pickup_date)}, {order.drop.pickup_time}</div>
      <div style={{fontSize:14,color:"var(--text-secondary)",marginBottom:16,display:"flex",alignItems:"center",gap:6}}>{I.pin} {order.drop.pickup_location}</div>
      <div style={{borderTop:"1px solid var(--border)",paddingTop:12}}>
        {order.items.map((item,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span>{item.qty}× {item.name}</span><span style={{color:"var(--text-secondary)"}}>{fmt(item.price*item.qty)}</span></div>))}
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0",marginTop:8,borderTop:"1px solid var(--border)",fontFamily:"var(--font-display)",fontSize:20,fontWeight:600}}><span>Total</span><span>{fmt(order.total)}</span></div>
      </div>
    </div>
    <div className="card" style={{textAlign:"left",background:"var(--gold-light)",border:"1px solid #f0dca0"}}><div style={{fontSize:14,fontWeight:600,color:"var(--gold)",marginBottom:4}}>💵 Payment</div><p style={{fontSize:14,color:"var(--text-secondary)"}}>Bring <strong>{fmt(order.total)}</strong> cash to pickup.</p></div>
    <div className="card" style={{textAlign:"left",marginTop:12}}><div style={{fontSize:14,fontWeight:600,marginBottom:4}}>📧 Confirmation</div><p style={{fontSize:14,color:"var(--text-secondary)"}}>A confirmation will be sent to <strong>{order.customerEmail}</strong></p></div>
    <button className="btn btn-secondary" style={{marginTop:24}} onClick={onBack}>← Browse More Drops</button>
  </div>);
}

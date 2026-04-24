import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// FOODDROP MVP v28a — Products tab (creator product library):
//                     • new products table with CRUD UI
//                     • tag-based organization, archive/delete
//                     • per-product capacity_weight column
//                       staged for v28.1 (pizza throughput)
//                     • drop_items.product_id added but not
//                       yet wired — that's v28b's job
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
  auth: {
    signIn: async (email, password) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) return { session: null, error: { message: data.error_description || data.msg || "Login failed" } };
        return { session: data, error: null };
      } catch (e) { return { session: null, error: { message: e.message } }; }
    },
    signOut: async (accessToken) => {
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        });
      } catch {}
    },
    getUser: async (accessToken) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return { user: null };
        const data = await res.json();
        return { user: data };
      } catch { return { user: null }; }
    },
    updateUser: async (accessToken, updates) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "PUT",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok) return { error: { message: data.error_description || data.msg || "Update failed" } };
        return { error: null };
      } catch (e) { return { error: { message: e.message } }; }
    },
    signUp: async (email, password) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent("https://app.getfooddrop.com")}`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) return { user: null, error: { message: data.error_description || data.msg || "Signup failed" } };
        return { user: data.user || data, error: null };
      } catch (e) { return { user: null, error: { message: e.message } }; }
    },
    resetPasswordForEmail: async (email) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, redirect_to: "https://app.getfooddrop.com" }),
        });
        if (!res.ok) { const d = await res.json(); return { error: { message: d.error_description || d.msg || "Failed to send reset email" } }; }
        return { error: null };
      } catch (e) { return { error: { message: e.message } }; }
    },
  },
};

// --- Pickup window helpers (v26) ---
// Time strings are stored as 24h "HH:MM" (the native format of <input type="time">).
// We format to 12h for display.
const formatTime12 = (t24) => {
  if (!t24) return "";
  const [h, m] = t24.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return t24;
  const hr = h % 12 || 12;
  const period = h < 12 ? "AM" : "PM";
  return `${hr}:${m.toString().padStart(2,"0")} ${period}`;
};
const formatWindow = (w) => w ? `${formatTime12(w.start)} – ${formatTime12(w.end)}` : "";
// Count how many non-cancelled orders are in a given window.
const windowOrderCount = (orders, dropId, windowId) =>
  orders.filter(o => o.drop_id === dropId && o.pickup_window_id === windowId && o.status !== "cancelled").length;
const windowSlotsRemaining = (window, orders, dropId) => {
  if (!window || window.slotLimit == null) return null; // null = unlimited
  return Math.max(0, window.slotLimit - windowOrderCount(orders, dropId, window.id));
};
// Derive a "5:00 PM – 7:00 PM" string from the span of all windows (earliest start to latest end).
// Used so the auto-computed pickup_time keeps all existing display code working unchanged.
const spanWindows = (windows) => {
  if (!windows?.length) return "";
  const sorted = [...windows].filter(w => w.start && w.end).sort((a,b) => a.start.localeCompare(b.start));
  if (!sorted.length) return "";
  const earliest = sorted[0].start;
  const latest = [...sorted].sort((a,b) => b.end.localeCompare(a.end))[0].end;
  return `${formatTime12(earliest)} – ${formatTime12(latest)}`;
};
// v27b: Parse a free-form pickup_time string like "5:00 PM – 7:00 PM" or "5-7pm"
// into 24h {start, end} for .ics generation. Returns null if unparseable.
// Used only when a drop doesn't use pickup windows (those already have structured times).
const parseTimeRange = (str) => {
  if (!str || typeof str !== "string") return null;
  const normalized = str.replace(/[–—−]/g, "-");
  const m = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
  if (!m) return null;
  const [, h1, mn1, p1, h2, mn2, p2] = m;
  const toHM = (h, mn, p, fallbackP) => {
    let hour = parseInt(h, 10);
    if (isNaN(hour)) return null;
    const minute = mn ? parseInt(mn, 10) : 0;
    const period = (p || fallbackP || "").toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    return { h: hour, m: minute };
  };
  const end = toHM(h2, mn2, p2, null);
  const start = toHM(h1, mn1, p1, p2); // inherit period from end if start has none ("5-7pm")
  if (!start || !end) return null;
  const fmt = (t) => `${String(t.h).padStart(2,"0")}:${String(t.m).padStart(2,"0")}`;
  return { start: fmt(start), end: fmt(end) };
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
  upload: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  undo: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
  print: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  listCheck: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10 6h11M10 12h11M10 18h11"/><path d="M3 6l2 2 4-4M3 18l2 2 4-4"/><rect x="3" y="10" width="4" height="4" rx="1"/></svg>,
  columns: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>,
  image: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  chart: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  palette: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
};

// Phone auto-formatter: converts digits to (xxx) xxx-xxxx
const formatPhone = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
};

const fmt = (n) => `$${Number(n).toFixed(2)}`;
const fmtDate = (d) => { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
const fmtDateLong = (d) => { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); };

// Sends the creator introduction email — non-blocking, fire-and-forget.
// Checks welcome_sent flag first to ensure it only fires once per customer.
async function sendWelcomeEmail({ creator, customerName, customerEmail }) {
  if (!creator?.bio) return; // Creator hasn't set up their welcome email yet
  if (!customerEmail) return;
  try {
    const storefrontUrl = `${window.location.origin}${window.location.pathname}#/${creator.slug || ""}`;
    await fetch("/api/send-welcome-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: customerEmail,
        customerName,
        creatorName: creator.name || "FoodDrop",
        creatorTagline: creator.tagline || "",
        creatorBio: creator.bio || "",
        creatorHowDropsWork: creator.how_drops_work || "",
        creatorLogoUrl: creator.logo_url || "",
        creatorPhotoUrl: creator.welcome_photo_url || "",
        creatorStorefrontUrl: storefrontUrl,
        socialLinks: creator.social_links || {},
      }),
    });
  } catch (e) { console.error("Welcome email failed:", e); }
}

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
.cust-header{text-align:center;padding:40px 24px 28px;background:linear-gradient(180deg,var(--surface-alt) 0%,var(--bg) 100%);border-bottom:1px solid var(--border);position:relative;overflow:hidden}.cust-header.has-hero{background:none;padding:60px 24px 36px}.cust-header-hero{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}.cust-header-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:1}.cust-header-content{position:relative;z-index:2}.cust-header.has-hero .cust-header-name{color:#fff}.cust-header.has-hero .cust-header-tagline{color:rgba(255,255,255,.85)}.cust-header-name{font-family:var(--font-display);font-size:36px;font-weight:700;margin-bottom:6px}.cust-header-tagline{color:var(--text-secondary);font-size:16px}.cust-body{max-width:640px;margin:0 auto;padding:32px 24px 64px}
.cust-drop-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:all .2s;cursor:pointer}.cust-drop-card:hover{box-shadow:var(--shadow);transform:translateY(-2px)}.cust-drop-banner{background:var(--accent);color:#fff;padding:20px 24px;position:relative;overflow:hidden;min-height:80px}.cust-drop-banner.has-img{background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55));background-size:cover;background-position:center}.cust-drop-banner h2{font-family:var(--font-display);color:#fff;font-size:22px;position:relative;z-index:1}.cust-drop-banner p{position:relative;z-index:1}.cust-drop-body{padding:20px 24px}.cust-drop-detail{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text-secondary);margin-bottom:8px}.cust-drop-items-peek{margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}.cust-drop-items-peek span{font-size:13px;color:var(--text-secondary)}
.oi-row{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--border)}.oi-row:last-child{border-bottom:none}.oi-info{flex:1}.oi-name{font-weight:600;font-size:15px}.oi-price{color:var(--text-secondary);font-size:14px;margin-top:2px}.oi-desc{color:var(--text-tertiary);font-size:13px;margin-top:3px;line-height:1.4}.oi-avail{font-size:12px;color:var(--text-tertiary);margin-top:2px}.qty-ctrl{display:flex;align-items:center;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}.qty-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--surface-alt);border:none;cursor:pointer;font-size:18px;color:var(--text);transition:background .1s}.qty-btn:hover{background:var(--border)}.qty-btn:disabled{color:var(--text-tertiary);cursor:default}.qty-btn:disabled:hover{background:var(--surface-alt)}.qty-val{width:40px;text-align:center;font-weight:600;font-size:15px}
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

.drops-cell{position:relative}.drops-toggle{cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--accent);padding:2px 8px;background:var(--accent-light);border-radius:12px;border:none;font-family:var(--font-body)}.drops-toggle:hover{background:#ffe0d5}.drops-expand{position:absolute;top:100%;left:0;z-index:10;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:8px;min-width:200px;margin-top:4px}.drops-expand-item{font-size:12px;padding:4px 8px;border-radius:4px;white-space:nowrap}.drops-expand-item:hover{background:var(--surface-alt)}
.import-preview{border:1px solid var(--border);border-radius:var(--radius-sm);overflow:auto;max-height:300px;margin:16px 0}.import-preview table{font-size:13px}.import-preview th{padding:8px 12px;font-size:11px}.import-preview td{padding:6px 12px;font-size:13px}
.signup-section{margin-top:32px;padding-top:32px;border-top:1px solid var(--border)}.signup-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px;max-width:480px;margin:0 auto}

.col-toggle-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}.col-toggle-label{font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.3px;margin-right:4px}.col-toggle{display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background .1s}.col-toggle:hover{background:var(--surface-alt)}.col-toggle input{accent-color:var(--accent);width:14px;height:14px}
.pickup-list{display:grid;gap:8px}.pickup-item{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);transition:all .15s}.pickup-item.checked{background:var(--green-light);border-color:#b7e4c7}.pickup-item-check{width:24px;height:24px;border:2px solid var(--border-strong);border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0}.pickup-item-check.checked{background:var(--green);border-color:var(--green);color:#fff}.pickup-item-info{flex:1}.pickup-item-name{font-weight:600;font-size:15px}.pickup-item-items{font-size:13px;color:var(--text-secondary);margin-top:2px}.pickup-item-total{font-weight:600;font-size:14px;flex-shrink:0}
.view-tabs{display:flex;gap:4px;margin-bottom:20px;background:var(--surface-alt);border-radius:var(--radius-sm);padding:4px}.view-tab{flex:1;text-align:center;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;border:none;background:transparent;font-family:var(--font-body);color:var(--text-secondary);transition:all .15s}.view-tab.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow-sm)}
@media print{.creator-topbar,.creator-nav,.btn,.view-tabs,.section-header .btn{display:none!important}.main-content{padding:0!important;max-width:100%!important}}

.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg)}.login-card{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:40px 32px;box-shadow:var(--shadow)}.login-brand{text-align:center;margin-bottom:28px}.login-brand-icon{font-size:40px;margin-bottom:8px}.login-brand h2{font-family:var(--font-display);font-size:24px}.login-brand p{color:var(--text-secondary);font-size:14px;margin-top:4px}.login-error{padding:10px 14px;background:var(--red-light);color:var(--red);border-radius:var(--radius-sm);font-size:13px;margin-bottom:16px}

.theme-swatch{width:28px;height:28px;border-radius:50%;border:3px solid transparent;cursor:pointer;transition:transform .15s;flex-shrink:0}.theme-swatch:hover{transform:scale(1.15)}.theme-swatch.selected{border-color:var(--text)}
.theme-preview-bar{height:6px;border-radius:3px;margin-top:8px}

.pan-frame{position:relative;overflow:hidden;border-radius:var(--radius-sm);border:1px solid var(--border);cursor:grab;user-select:none;background:var(--surface-alt)}.pan-frame.dragging{cursor:grabbing}.pan-frame img{position:absolute;pointer-events:none;user-select:none}.pan-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .2s}.pan-frame:hover .pan-hint{opacity:1}.pan-hint-inner{background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:5px 14px;border-radius:20px;font-family:var(--font-body)}.pan-size-badge{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.45);color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;pointer-events:none;font-family:var(--font-body)}.pan-actions{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}.pan-size-hint{font-size:11px;color:var(--text-tertiary);margin-top:4px}

/* v27a: Drops calendar view */
.view-toggle{display:inline-flex;background:var(--surface-alt);border:1px solid var(--border);border-radius:var(--radius-sm);padding:3px}
.view-toggle button{background:transparent;border:none;padding:6px 14px;border-radius:5px;font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s}
.view-toggle button.active{background:var(--surface);color:var(--accent);box-shadow:var(--shadow-sm)}
.cal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:0 4px}
.cal-title{font-family:var(--font-display);font-size:22px;font-weight:600;color:var(--text)}
.cal-nav{display:flex;gap:6px;align-items:center}
.cal-nav-btn{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;cursor:pointer;color:var(--text-secondary);font-size:14px;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;min-width:32px}
.cal-nav-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-light)}
.cal-weekdays{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;padding:0 4px}
.cal-weekday{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-tertiary);text-align:center;padding:6px 0}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:var(--surface-alt);border-radius:var(--radius-sm);padding:4px}
.cal-cell{background:var(--surface);border-radius:6px;min-height:104px;padding:6px 8px;display:flex;flex-direction:column;gap:4px;transition:background .15s}
.cal-cell.other-month{background:transparent;opacity:.45}
.cal-cell.today{box-shadow:inset 0 0 0 2px var(--accent)}
.cal-cell.clickable{cursor:pointer}
.cal-cell.clickable:hover{background:var(--accent-light)}
.cal-daynum{font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:2px;display:flex;justify-content:space-between;align-items:center}
.cal-cell.today .cal-daynum{color:var(--accent)}
.cal-daynum-plus{font-size:14px;color:var(--text-tertiary);opacity:0;transition:opacity .15s}
.cal-cell.clickable:hover .cal-daynum-plus{opacity:1}
.cal-drop-chip{font-size:11px;font-weight:600;padding:3px 7px;border-radius:4px;background:var(--accent-light);color:var(--accent);border-left:3px solid var(--accent);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;justify-content:space-between;align-items:center;gap:4px}
.cal-drop-chip.ended{background:var(--surface-alt);color:var(--text-tertiary);border-left-color:var(--text-tertiary)}
.cal-drop-chip:hover{filter:brightness(.95)}
.cal-drop-chip-count{font-size:10px;font-weight:500;background:rgba(0,0,0,.08);padding:1px 5px;border-radius:8px;flex-shrink:0}
.cal-more-link{font-size:11px;font-weight:600;color:var(--text-tertiary);cursor:pointer;padding:1px 4px;text-align:left}
.cal-more-link:hover{color:var(--accent)}
.cal-more-popover{position:fixed;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);padding:12px;min-width:220px;z-index:50}
.cal-more-popover-title{font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.3px;margin-bottom:8px}
.cal-context-hint{background:var(--surface-alt);border-left:3px solid var(--accent);border-radius:4px;padding:8px 10px;margin-top:6px;font-size:12px;color:var(--text-secondary);line-height:1.5}
.cal-context-hint.warn{background:var(--gold-light);border-left-color:var(--gold);color:var(--text)}
@media(max-width:640px){.cal-cell{min-height:76px;padding:4px 6px}.cal-drop-chip{font-size:10px;padding:2px 5px}.cal-grid{overflow-x:auto}}

`;

// ============================================================
// THEME SYSTEM
// ============================================================
const THEMES = {
  terracotta: { name: "Terracotta", accent: "#C4572A", accentLight: "#FFF0EB", accentHover: "#A8461F", bg: "#FAFAF7", surface: "#FFF", surfaceAlt: "#F5F3EE", border: "#E8E4DC" },
  forest:     { name: "Forest",     accent: "#2D6A4F", accentLight: "#EDFAF2", accentHover: "#1E4D38", bg: "#F7FAF8", surface: "#FFF", surfaceAlt: "#EEF4F0", border: "#D8E8DC" },
  midnight:   { name: "Midnight",   accent: "#3B4F9C", accentLight: "#EEF1FF", accentHover: "#2C3C7A", bg: "#F7F8FC", surface: "#FFF", surfaceAlt: "#EEF0F8", border: "#DDE1F0" },
  blush:      { name: "Blush",      accent: "#B5466B", accentLight: "#FFF0F4", accentHover: "#8E3454", bg: "#FDF8F9", surface: "#FFF", surfaceAlt: "#F9F0F3", border: "#EDD8DF" },
  custom:     { name: "Custom",     accent: "#C4572A", accentLight: "#FFF0EB", accentHover: "#A8461F", bg: "#FAFAF7", surface: "#FFF", surfaceAlt: "#F5F3EE", border: "#E8E4DC" },
};

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-light", theme.accentLight);
  root.style.setProperty("--accent-hover", theme.accentHover);
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--surface-alt", theme.surfaceAlt);
  root.style.setProperty("--border", theme.border);
}

function hexToAccentLight(hex) {
  // Derive a very light tint from a hex color
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},0.1)`;
}
function darkenHex(hex, amt=20) {
  const r = Math.max(0,parseInt(hex.slice(1,3),16)-amt);
  const g = Math.max(0,parseInt(hex.slice(3,5),16)-amt);
  const b = Math.max(0,parseInt(hex.slice(5,7),16)-amt);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

// ============================================================
// ROUTING — Hash-based with creator slugs
// ============================================================
// Routes: #/slug = customer page, #/slug/admin = creator admin, #/ = landing
function useRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const h = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", h);
    // Intercept browser back/forward: if a session exists and the back destination
    // is the storefront for the creator currently in admin, redirect to admin instead.
    const onPop = () => {
      const newHash = window.location.hash || "#/";
      const { isAdmin } = parseRoute(newHash);
      try {
        const s = localStorage.getItem("fd_session");
        if (s && !isAdmin) {
          const session = JSON.parse(s);
          if (session?.user) {
            // We have a session — stay on the admin URL
            window.history.replaceState(null, "", window.location.pathname + window.location.hash);
            // Don't change hash — keep them where they were
          }
        }
      } catch {}
      setHash(window.location.hash || "#/");
    };
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("hashchange", h); window.removeEventListener("popstate", onPop); };
  }, []);
  return hash;
}

function parseRoute(hash) {
  const base = { slug: null, isAdmin: false, isLoginPage: false, isOnboardingPage: false, isResetPasswordPage: false };
  // Supabase email callback — tokens injected into hash before our router runs
  if (hash.includes("access_token=") && !hash.startsWith("#/")) {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const type = params.get("type");
    return { ...base, isOnboardingPage: type !== "recovery", isResetPasswordPage: type === "recovery" };
  }
  const path = hash.replace("#/", "").replace(/\/$/, "");
  if (!path) return base;
  if (path === "login") return { ...base, isLoginPage: true };
  if (path === "onboarding") return { ...base, isOnboardingPage: true };
  if (path === "reset-password") return { ...base, isResetPasswordPage: true };
  const parts = path.split("/");
  if (parts.length >= 2 && parts[parts.length - 1] === "admin") {
    return { ...base, slug: parts.slice(0, -1).join("/"), isAdmin: true };
  }
  return { ...base, slug: parts.join("/") };
}

// ============================================================
// MAIN APP — with auth
// ============================================================
export default function FoodDropApp() {
  const route = useRoute();
  const { slug, isAdmin } = parseRoute(route);
  const [allCreators, setAllCreators] = useState([]);
  const [creator, setCreator] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [drops, setDrops] = useState([]);
  const [dropItems, setDropItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]); // v28a
  const [loading, setLoading] = useState(true);
  const [dbOk, setDbOk] = useState(null);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("ok");
  // Auth state
  const [session, setSession] = useState(() => {
    try { const s = localStorage.getItem("fd_session"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [authCallbackUser, setAuthCallbackUser] = useState(null);
  // Capture email-verification / password-reset tokens that Supabase injects into the URL hash
  const [authCallback] = useState(() => {
    const h = window.location.hash;
    if (h.includes("access_token=") && !h.startsWith("#/")) {
      const params = new URLSearchParams(h.replace(/^#/, ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const type = params.get("type");
      if (access_token && type) {
        window.history.replaceState(null, "", window.location.pathname + (type === "recovery" ? "#/reset-password" : "#/onboarding"));
        return { access_token, refresh_token, type };
      }
    }
    return null;
  });

  const showToast = useCallback((msg, type = "ok") => { setToast(msg); setToastType(type); setTimeout(() => setToast(null), 3500); }, []);

  // Persist session
  useEffect(() => {
    if (session) localStorage.setItem("fd_session", JSON.stringify(session));
    else localStorage.removeItem("fd_session");
  }, [session]);

  // Validate session on mount; also resolve user from email-verification/password-reset callbacks
  useEffect(() => {
    const init = async () => {
      if (authCallback?.access_token) {
        const { user } = await supabase.auth.getUser(authCallback.access_token);
        if (user) setAuthCallbackUser(user);
        setAuthChecked(true);
        return;
      }
      if (session?.access_token) {
        const { user } = await supabase.auth.getUser(session.access_token);
        if (!user) setSession(null);
      }
      setAuthChecked(true);
    };
    init();
  }, []);

const handleLogin = async (email, password) => {
    const { session: s, error } = await supabase.auth.signIn(email, password);
    if (error) return { error };
    setSession(s);
    // After login from /#/login, find this creator's slug and redirect to their admin
    if (s?.user) {
      const cRes = await supabase.from("creators").select("*").execute();
      const matched = (cRes.data || []).find(c => c.auth_user_id === s.user.id);
      if (matched?.slug) {
        window.location.hash = `#/${matched.slug}/admin`;
      } else {
        // Auth user exists but no creators row yet — resume onboarding
        setAuthCallbackUser(s.user);
        window.location.hash = "#/onboarding";
      }
    }
    return { error: null };
  };

  const handleLogout = async () => {
    if (session?.access_token) await supabase.auth.signOut(session.access_token);
    setSession(null);
    window.location.hash = "#/login";
  };

  const handleSignup = async (email, password) => {
    const { user, error } = await supabase.auth.signUp(email, password);
    if (error) return { error };
    return { user, error: null };
  };

  const handleForgotPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error };
    return { error: null };
  };

  const handleResetPassword = async (newPassword) => {
    if (!authCallback?.access_token) return { error: { message: "Invalid or expired reset link." } };
    const { error } = await supabase.auth.updateUser(authCallback.access_token, { password: newPassword });
    if (error) return { error };
    return { error: null };
  };

  const handleCompleteOnboarding = async (name) => {
    const user = authCallbackUser || session?.user;
    if (!user) return;
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "creator";
    const { data: existing } = await supabase.from("creators").select("slug").execute();
    const slugSet = new Set((existing || []).map(c => c.slug));
    let finalSlug = base; let n = 2;
    while (slugSet.has(finalSlug)) { finalSlug = `${base}-${n}`; n++; }
    const { data, error } = await supabase.from("creators").insert({
      name,
      slug: finalSlug,
      auth_user_id: user.id,
      email: user.email,
      tagline: "",
      bio: "",
      social_links: {},
    }).select("*").single().execute();
    if (error) { showToast("Failed to create your profile. Please try again.", "error"); return; }
    const newSession = authCallback
      ? { access_token: authCallback.access_token, refresh_token: authCallback.refresh_token, user }
      : { ...session, user };
    setSession(newSession);
    window.location.hash = `#/${data.slug}/admin`;
  };

  const loadData = useCallback(async () => {
    try {
      const cRes = await supabase.from("creators").select("*").execute();
      if (cRes.error) { setDbOk(false); setLoading(false); return; }
      const creators = cRes.data || [];
      setAllCreators(creators);

      let activeCreator = null;
      if (slug) activeCreator = creators.find(c => c.slug === slug);
      if (!activeCreator && creators.length === 1 && !slug) activeCreator = creators[0];
      setCreator(activeCreator);

      if (activeCreator) {
        const [custRes, dropsRes, diRes, ordRes, oiRes, prodRes] = await Promise.all([
          supabase.from("customers").select("*").eq("creator_id", activeCreator.id).order("created_at", { ascending: false }).execute(),
          supabase.from("drops").select("*").eq("creator_id", activeCreator.id).order("created_at", { ascending: false }).execute(),
          supabase.from("drop_items").select("*").order("sort_order").execute(),
          supabase.from("orders").select("*").order("created_at", { ascending: false }).execute(),
          supabase.from("order_items").select("*").execute(),
          supabase.from("products").select("*").eq("creator_id", activeCreator.id).order("created_at", { ascending: false }).execute(),
        ]);
        setCustomers(custRes.data || []);
        const creatorDrops = dropsRes.data || [];
        setDrops(creatorDrops);
        const dropIds = creatorDrops.map(d => d.id);
        setDropItems((diRes.data || []).filter(di => dropIds.includes(di.drop_id)));
        const creatorOrders = (ordRes.data || []).filter(o => dropIds.includes(o.drop_id));
        setOrders(creatorOrders);
        const orderIds = creatorOrders.map(o => o.id);
        setOrderItems((oiRes.data || []).filter(oi => orderIds.includes(oi.order_id)));
        setProducts(prodRes.data || []);
      } else {
        setCustomers([]); setDrops([]); setDropItems([]); setOrders([]); setOrderItems([]); setProducts([]);
      }
      setDbOk(true);
    } catch { setDbOk(false); }
    setLoading(false);
  }, [slug]);

  useEffect(() => { loadData(); }, [loadData]);
  const getDropItems = useCallback((id) => dropItems.filter((di) => di.drop_id === id), [dropItems]);
  const getDropOrders = useCallback((id) => orders.filter((o) => o.drop_id === id), [orders]);
  const getOrderItems = useCallback((id) => orderItems.filter((oi) => oi.order_id === id), [orderItems]);

  if (loading || !authChecked) return <><style>{CSS}</style><div className="app"><div className="loading-screen"><div className="spin"/><span>Loading FoodDrop...</span></div></div></>;

// Onboarding + reset-password are standalone pages (reached via email link callbacks)
  const { isLoginPage, isOnboardingPage, isResetPasswordPage } = parseRoute(route);

  if (isOnboardingPage) {
    if (!authCallback && !authCallbackUser) { window.location.hash = "#/login"; return null; }
    if (!authCallbackUser) return (
      <><style>{CSS}</style><div className="app">
        <div className="loading-screen" style={{color:"var(--text)"}}>
          <h2>Link expired or invalid</h2>
          <p style={{color:"var(--text-secondary)"}}>Please try signing up again.</p>
          <a href="#/login" className="btn btn-primary" style={{marginTop:16,textDecoration:"none"}}>← Sign In</a>
        </div>
      </div></>
    );
    return (
      <><style>{CSS}</style><div className="app">
        <OnboardingPage userEmail={authCallbackUser.email} onComplete={handleCompleteOnboarding} showToast={showToast}/>
        {toast && <div className={`toast ${toastType==="error"?"toast-error":""}`}>{toastType==="error"?"⚠️ ":""}{toastType!=="error"&&I.check}{toast}</div>}
      </div></>
    );
  }

  if (isResetPasswordPage) {
    return (
      <><style>{CSS}</style><div className="app">
        <ResetPasswordPage onReset={handleResetPassword} showToast={showToast}/>
        {toast && <div className={`toast ${toastType==="error"?"toast-error":""}`}>{toastType==="error"?"⚠️ ":""}{toastType!=="error"&&I.check}{toast}</div>}
      </div></>
    );
  }

  // Universal login page at /#/login
  if (isLoginPage) {
    // If already logged in, redirect to their dashboard
    if (session?.user) {
      const matched = allCreators.find(c => c.auth_user_id === session.user.id);
      if (matched?.slug) {
        window.location.hash = `#/${matched.slug}/admin`;
        return null;
      }
    }
    return (
      <><style>{CSS}</style><div className="app">
        <LoginPage creator={null} onLogin={handleLogin} onSignup={handleSignup} onForgotPassword={handleForgotPassword} showToast={showToast}/>
        {toast && <div className={`toast ${toastType==="error"?"toast-error":""}`}>{toastType==="error"?"⚠️ ":""}{toastType!=="error"&&I.check}{toast}</div>}
      </div></>
    );
  }

  // Landing page
  if (!slug && !creator) {
    return (
      <><style>{CSS}</style><div className="app">
        {dbOk === false && <div className="connection-banner err">Could not connect to database.<button className="btn btn-sm btn-ghost" onClick={loadData} style={{color:"var(--red)"}}>{I.refresh} Retry</button></div>}
        <LandingPage creators={allCreators}/>
        {toast && <div className={`toast ${toastType==="error"?"toast-error":""}`}>{toastType==="error"?"⚠️ ":""}{toastType!=="error"&&I.check}{toast}</div>}
      </div></>
    );
  }

// Creator not found — but if we have a session, this might just be a loadData race
  // (e.g. right after login redirect). Show spinner instead of "not found" in that case.
  if (slug && !creator) {
    if (session?.access_token) {
      return <><style>{CSS}</style><div className="app"><div className="loading-screen"><div className="spin"/><span>Loading...</span></div></div></>;
    }
    return (
      <><style>{CSS}</style><div className="app">
        <div className="loading-screen" style={{color:"var(--text)"}}>
          <h2>Page not found</h2>
          <p style={{color:"var(--text-secondary)"}}>No creator found at this URL.</p>
          <a href="#/" className="btn btn-primary" style={{marginTop:16,textDecoration:"none"}}>← Go Home</a>
        </div>
      </div></>
    );
  }

  // Admin route — check auth
  if (isAdmin) {
    const isLoggedIn = session?.access_token && session?.user;
    const isAuthorized = isLoggedIn && creator?.auth_user_id === session.user.id;

    if (!isLoggedIn) {
      return (
        <><style>{CSS}</style><div className="app">
          <LoginPage creator={creator} onLogin={handleLogin} onSignup={handleSignup} onForgotPassword={handleForgotPassword} showToast={showToast}/>
          {toast && <div className={`toast ${toastType==="error"?"toast-error":""}`}>{toastType==="error"?"⚠️ ":""}{toastType!=="error"&&I.check}{toast}</div>}
        </div></>
      );
    }

    if (!isAuthorized) {
      return (
        <><style>{CSS}</style><div className="app">
          <div className="loading-screen" style={{color:"var(--text)"}}>
            <h2>Access Denied</h2>
            <p style={{color:"var(--text-secondary)"}}>Your account doesn't have access to this dashboard.</p>
            <div style={{display:"flex",gap:12,marginTop:16}}>
              <button className="btn btn-secondary" onClick={handleLogout}>Log Out</button>
              <a href="#/" className="btn btn-primary" style={{textDecoration:"none"}}>Go Home</a>
            </div>
          </div>
        </div></>
      );
    }

    return (
      <><style>{CSS}</style><div className="app">
        {dbOk === false && <div className="connection-banner err">Could not connect to database.<button className="btn btn-sm btn-ghost" onClick={loadData} style={{color:"var(--red)"}}>{I.refresh} Retry</button></div>}
        <CreatorDashboard creator={creator} customers={customers} drops={drops} orders={orders} orderItems={orderItems} dropItems={dropItems} products={products} getDropItems={getDropItems} getDropOrders={getDropOrders} getOrderItems={getOrderItems} showToast={showToast} loadData={loadData} session={session} onLogout={handleLogout}/>
        {toast && <div className={`toast ${toastType==="error"?"toast-error":""}`}>{toastType==="error"?"⚠️ ":""}{toastType!=="error"&&I.check}{toast}</div>}
      </div></>
    );
  }

  // Customer storefront — no auth needed
  return (
    <><style>{CSS}</style><div className="app">
      {dbOk === false && <div className="connection-banner err">Could not connect to database.<button className="btn btn-sm btn-ghost" onClick={loadData} style={{color:"var(--red)"}}>{I.refresh} Retry</button></div>}
      <CustomerStorefront creator={creator} drops={drops} getDropItems={getDropItems} showToast={showToast} loadData={loadData} customers={customers} orders={orders}/>
      {toast && <div className={`toast ${toastType==="error"?"toast-error":""}`}>{toastType==="error"?"⚠️ ":""}{toastType!=="error"&&I.check}{toast}</div>}
    </div></>
  );
}

// ============================================================
// LOGIN PAGE — Sign In / Create Account / Forgot Password
// ============================================================
function LoginPage({ creator, onLogin, onSignup, onForgotPassword, showToast }) {
  const [view, setView] = useState("login"); // "login" | "signup" | "forgot" | "check-email"
  const [checkEmailFor, setCheckEmailFor] = useState("signup"); // "signup" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const switchView = (v) => { setView(v); setError(null); setPassword(""); setConfirmPassword(""); };

  const doLogin = async () => {
    if (!email || !password) return;
    setLoading(true); setError(null);
    const { error: err } = await onLogin(email, password);
    setLoading(false);
    if (err) setError(err.message);
  };

  const doSignup = async () => {
    if (!email || !password || !confirmPassword) return;
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(null);
    const { error: err } = await onSignup(email, password);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setCheckEmailFor("signup"); setView("check-email");
  };

  const doForgot = async () => {
    if (!email) return;
    setLoading(true); setError(null);
    const { error: err } = await onForgotPassword(email);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setCheckEmailFor("reset"); setView("check-email");
  };

  const handleKey = (e) => { if (e.key !== "Enter") return; if (view==="login") doLogin(); else if (view==="signup") doSignup(); else if (view==="forgot") doForgot(); };

  if (view === "check-email") {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-icon">📬</div>
            <h2>Check your email</h2>
            <p>We sent a link to <strong>{email}</strong></p>
          </div>
          <p style={{fontSize:14,color:"var(--text-secondary)",textAlign:"center",lineHeight:1.6,marginBottom:8}}>
            Click the link in that email to {checkEmailFor==="signup"?"verify your account and continue setup":"reset your password"}.
          </p>
          <p style={{fontSize:12,color:"var(--text-tertiary)",textAlign:"center",marginBottom:20}}>Don't see it? Check your spam folder.</p>
          <button className="btn btn-ghost btn-full" onClick={()=>switchView("login")}>← Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">🍽️</div>
          <h2>{creator?.name || "FoodDrop"}</h2>
          <p>{view==="forgot" ? "Reset your password" : "Creator Dashboard"}</p>
        </div>

        {view !== "forgot" && (
          <div style={{display:"flex",background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:3,marginBottom:20}}>
            <button onClick={()=>switchView("login")} style={{flex:1,padding:"7px 0",borderRadius:"var(--radius-sm)",border:"none",background:view==="login"?"var(--surface)":"transparent",fontWeight:view==="login"?600:400,cursor:"pointer",fontSize:13,color:"var(--text)",boxShadow:view==="login"?"var(--shadow-sm)":"none",transition:"all 0.15s"}}>Sign In</button>
            <button onClick={()=>switchView("signup")} style={{flex:1,padding:"7px 0",borderRadius:"var(--radius-sm)",border:"none",background:view==="signup"?"var(--surface)":"transparent",fontWeight:view==="signup"?600:400,cursor:"pointer",fontSize:13,color:"var(--text)",boxShadow:view==="signup"?"var(--shadow-sm)":"none",transition:"all 0.15s"}}>Create Account</button>
          </div>
        )}

        {error && <div className="login-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKey}/>
        </div>

        {view !== "forgot" && (
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder={view==="signup"?"Create a password (min 6 chars)":"Enter your password"} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={handleKey}/>
          </div>
        )}

        {view === "signup" && (
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" placeholder="Re-enter your password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={handleKey}/>
          </div>
        )}

        {view === "login" && (
          <div style={{textAlign:"right",marginBottom:16,marginTop:-8}}>
            <button onClick={()=>switchView("forgot")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-secondary)",fontSize:12}}>Forgot password?</button>
          </div>
        )}

        {view === "login" && <button className="btn btn-primary btn-full" disabled={!email||!password||loading} onClick={doLogin}>{loading?"Signing in...":"Sign In"}</button>}
        {view === "signup" && <button className="btn btn-primary btn-full" disabled={!email||!password||!confirmPassword||loading} onClick={doSignup}>{loading?"Creating account...":"Create Account"}</button>}
        {view === "forgot" && (
          <>
            <button className="btn btn-primary btn-full" disabled={!email||loading} onClick={doForgot} style={{marginTop:4}}>{loading?"Sending...":"Send Reset Email"}</button>
            <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={()=>switchView("login")}>← Back to sign in</button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ONBOARDING PAGE — post email-verification, collect business name
// ============================================================
const ROTATING_WORDS = ["bakery", "food biz", "cookie brand", "farm stand", "pop-up", "company"];
function OnboardingPage({ userEmail, onComplete, showToast }) {
  const [wordIdx, setWordIdx] = useState(0);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setWordIdx(i => (i + 1) % ROTATING_WORDS.length), 1800);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onComplete(name.trim());
    setSaving(false);
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{maxWidth:440}}>
        <div className="login-brand">
          <div className="login-brand-icon">🍽️</div>
          <h2>Welcome to FoodDrop</h2>
          {userEmail && <p style={{fontSize:12,color:"var(--text-tertiary)",marginTop:4}}>{userEmail}</p>}
        </div>
        <p style={{fontSize:18,fontWeight:600,color:"var(--text)",marginBottom:20,textAlign:"center",lineHeight:1.4}}>
          {"What's the name of your "}
          <span style={{color:"var(--accent)"}}>{ROTATING_WORDS[wordIdx]}</span>{"?"}
        </p>
        <div className="form-group">
          <input
            className="form-input"
            style={{fontSize:15}}
            placeholder='e.g., "Warmly Cookies"'
            value={name}
            onChange={e=>setName(e.target.value)}
            onKeyDown={e=>{ if (e.key==="Enter") handleSubmit(); }}
            autoFocus
          />
          <div className="form-hint" style={{textAlign:"center",marginTop:8}}>* You can update this anytime in Settings.</div>
        </div>
        <button className="btn btn-primary btn-full" disabled={!name.trim()||saving} onClick={handleSubmit} style={{marginTop:4}}>
          {saving ? "Setting up your dashboard…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// RESET PASSWORD PAGE — reached via password-reset email link
// ============================================================
function ResetPasswordPage({ onReset, showToast }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) return;
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(null);
    const { error: err } = await onReset(password);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    showToast("Password updated successfully.");
    setTimeout(() => { window.location.hash = "#/login"; }, 1800);
  };

  if (done) return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">✅</div>
          <h2>Password updated</h2>
          <p>Redirecting you to sign in…</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">🔑</div>
          <h2>Set a new password</h2>
          <p>Choose a strong password for your account</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input className="form-input" type="password" placeholder="Min 6 characters" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleSubmit();}}/>
        </div>
        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <input className="form-input" type="password" placeholder="Re-enter your password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleSubmit();}}/>
        </div>
        <button className="btn btn-primary btn-full" disabled={!password||!confirmPassword||loading} onClick={handleSubmit}>{loading?"Updating...":"Set New Password"}</button>
      </div>
    </div>
  );
}

// ============================================================
// LANDING PAGE
// ============================================================
function LandingPage() {
  useEffect(() => {
    window.location.replace("/#/login");
  }, []);
  return null;
}

// ============================================================
// CREATOR DASHBOARD
// ============================================================
function CreatorDashboard({ creator, customers, drops, orders, orderItems, dropItems, products, getDropItems, getDropOrders, getOrderItems, showToast, loadData, session, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // v28a: Products tab state
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(null); // product object
  const [showDeleteProduct, setShowDeleteProduct] = useState(null); // product object
  const [showNewDrop, setShowNewDrop] = useState(false);
  const [prefilledDropDate, setPrefilledDropDate] = useState(null); // v27a: set when creating a drop from calendar click
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showEditDrop, setShowEditDrop] = useState(null);
  const [showEditCustomer, setShowEditCustomer] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(null);
  const [showRevenue, setShowRevenue] = useState(false); // kept for legacy, unused
  const [duplicateDrop, setDuplicateDrop] = useState(null);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(null); // array of ids
  const [showDeleteDrop, setShowDeleteDrop] = useState(null); // drop object
  const customerUrl = `${window.location.origin}${window.location.pathname}#/${creator?.slug || ""}`;
  const adminUrl = `${window.location.origin}${window.location.pathname}#/${creator?.slug || ""}/admin`;

  const handleCreateDrop = async (d, items) => {
    if (!creator) return;
    const { data: nd, error } = await supabase.from("drops").insert({ creator_id: creator.id, title: d.title, description: d.description, status: "active", type: "standard", pickup_date: d.pickupDate, pickup_time: d.pickupTime, pickup_location: d.pickupLocation, image_url: d.imageUrl || "", image_data: d.imageUrl ? { url: d.imageUrl, x: d.imagePan?.x ?? 50, y: d.imagePan?.y ?? 50 } : null, use_pickup_windows: !!d.useWindows, pickup_windows: d.useWindows ? d.pickupWindows : null }).select("*").single().execute();
    if (error || !nd) { showToast("Failed to create drop", "error"); return; }
    await supabase.from("drop_items").insert(items.map((item, idx) => ({ drop_id: nd.id, name: item.name, description: item.description || "", price: parseFloat(item.price)||0, quantity: item.unlimited ? -1 : parseInt(item.quantity)||0, claimed: 0, sort_order: idx, image_url: item.imageUrl || "", image_data: item.imageUrl ? { url: item.imageUrl, x: item.imagePan?.x ?? 50, y: item.imagePan?.y ?? 50 } : null, product_id: item.productId || null, capacity_weight: parseFloat(item.capacityWeight) || 1 }))).execute();
    setShowNewDrop(false); setDuplicateDrop(null); showToast("Drop created!"); loadData();
  };

  const handleEditDrop = async (dropId, d, items) => {
    await supabase.from("drops").update({ title: d.title, description: d.description, pickup_date: d.pickupDate, pickup_time: d.pickupTime, pickup_location: d.pickupLocation, image_url: d.imageUrl || "", image_data: d.imageUrl ? { url: d.imageUrl, x: d.imagePan?.x ?? 50, y: d.imagePan?.y ?? 50 } : null, use_pickup_windows: !!d.useWindows, pickup_windows: d.useWindows ? d.pickupWindows : null }).eq("id", dropId).execute();
    for (const item of items) {
      const imgData = item.imageUrl ? { url: item.imageUrl, x: item.imagePan?.x ?? 50, y: item.imagePan?.y ?? 50 } : null;
      if (item.existingId) {
        await supabase.from("drop_items").update({ name: item.name, description: item.description || "", price: parseFloat(item.price)||0, quantity: item.unlimited ? -1 : parseInt(item.quantity)||0, image_url: item.imageUrl || "", image_data: imgData, product_id: item.productId || null, capacity_weight: parseFloat(item.capacityWeight) || 1 }).eq("id", item.existingId).execute();
      } else {
        await supabase.from("drop_items").insert({ drop_id: dropId, name: item.name, description: item.description || "", price: parseFloat(item.price)||0, quantity: item.unlimited ? -1 : parseInt(item.quantity)||0, claimed: 0, sort_order: item.sortOrder||0, image_url: item.imageUrl || "", image_data: imgData, product_id: item.productId || null, capacity_weight: parseFloat(item.capacityWeight) || 1 }).execute();
      }
    }
    setShowEditDrop(null); showToast("Drop updated!"); loadData();
  };

  const handleAddCustomer = async (d) => { if (!creator) return; await supabase.from("customers").insert({ creator_id: creator.id, name: d.name, email: d.email, phone: d.phone, prefer_contact: d.preferContact, notes: d.notes || "" }).execute(); setShowNewCustomer(false); showToast(`${d.name} added.`); loadData(); };
  const handleCreateProductFromDrop = async (name) => {
    if (!creator) return null;
    const { data, error } = await supabase.from("products").insert({ creator_id: creator.id, name, description: "", price: 0, image_url: "", image_data: null, sku: "", tags: [], capacity_weight: 1, archived: false }).select("*").single().execute();
    if (error || !data) { showToast("Failed to create product.", "error"); return null; }
    loadData();
    return data;
  };
  const handleEditCustomer = async (custId, d) => { await supabase.from("customers").update({ name: d.name, email: d.email, phone: d.phone, prefer_contact: d.preferContact, notes: d.notes || "" }).eq("id", custId).execute(); setShowEditCustomer(null); setSelectedCustomer(null); showToast("Customer updated."); loadData(); };
  const handleDeleteCustomer = async (custId, custName) => { await supabase.from("customers").delete().eq("id", custId).execute(); setSelectedCustomer(null); showToast(`${custName} removed.`); loadData(); };

  const handleMergeCustomers = async (keepId, mergeId) => {
    // Move all orders from mergeId to keepId
    await supabase.from("orders").update({ customer_id: keepId }).eq("customer_id", mergeId).execute();
    // Delete the duplicate customer row
    await supabase.from("customers").delete().eq("id", mergeId).execute();
    setSelectedCustomer(null);
    showToast("Customers merged successfully.");
    loadData();
  };
  const handleImportCustomers = async (rows) => {
    if (!creator) return;
    const inserts = rows.map(r => ({ creator_id: creator.id, name: r.name, email: r.email, phone: r.phone || "", prefer_contact: r.prefer_contact || "email", notes: r.notes || "", opted_in: true }));
    // Try bulk insert first
    const { error } = await supabase.from("customers").insert(inserts).execute();
    if (error) {
      console.error("Bulk import error:", error);
      // Fallback: try one at a time to identify bad rows
      let successCount = 0;
      for (const row of inserts) {
        const { error: rowErr } = await supabase.from("customers").insert(row).execute();
        if (!rowErr) successCount++;
        else console.error("Row failed:", row.name, row.email, rowErr);
      }
      if (successCount > 0) {
        setShowImportCSV(false); showToast(`${successCount} of ${rows.length} imported (some rows had issues).`); loadData();
      } else {
        showToast(`Import failed: ${error.message || "Unknown error. Check browser console for details."}`, "error");
      }
      return;
    }
    setShowImportCSV(false); showToast(`${rows.length} customer${rows.length!==1?"s":""} imported!`); loadData();
  };
  const [showManualOrder, setShowManualOrder] = useState(null); // drop object

  const handleManualOrder = async ({ drop, customer, isNewCustomer, cartItems, paymentMethod }) => {
    let customerId = customer?.id || null;
    const customerName = customer?.name || "";
    const customerEmail = customer?.email || "";

    // Create new customer if needed
    if (isNewCustomer && creator) {
      const { data: nc } = await supabase.from("customers").insert({
        creator_id: creator.id,
        name: customerName,
        email: customerEmail.toLowerCase().trim(),
        phone: customer?.phone || "",
        prefer_contact: "email",
        signup_source: "manual",
        opted_in: false,
      }).select("*").single().execute();
      if (nc) customerId = nc.id;
    }

    const dropItemsList = getDropItems(drop.id);
    const total = cartItems.reduce((sum, ci) => {
      const item = dropItemsList.find(i => i.id === ci.dropItemId);
      return sum + (item ? Number(item.price) * ci.qty : 0);
    }, 0);

    const paymentStatus = paymentMethod === "invoice" ? "unpaid" : "paid";

    const { data: no, error } = await supabase.from("orders").insert({
      drop_id: drop.id,
      customer_id: customerId,
      customer_name: customerName,
      customer_email: customerEmail.toLowerCase().trim(),
      total,
      status: "confirmed",
      payment_method: paymentMethod,
      payment_status: paymentStatus,
    }).select("*").single().execute();

    if (error || !no) { showToast("Failed to create order.", "error"); return; }

    await supabase.from("order_items").insert(
      cartItems.map(ci => {
        const item = dropItemsList.find(i => i.id === ci.dropItemId);
        return { order_id: no.id, drop_item_id: ci.dropItemId, item_name: item?.name || "", item_price: item?.price || 0, quantity: ci.qty };
      })
    ).execute();

    // Update claimed counts
    for (const ci of cartItems) {
      const item = dropItemsList.find(i => i.id === ci.dropItemId);
      if (item && item.quantity > 0) {
        await supabase.from("drop_items").update({ claimed: item.claimed + ci.qty }).eq("id", item.id).execute();
      }
    }

    // Send invoice email if payment method is invoice
    if (paymentMethod === "invoice" && customerEmail) {
      try {
        fetch("/api/send-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorName: creator.name,
            customerName,
            customerEmail,
            dropTitle: drop.title,
            pickupDate: fmtDateLong(drop.pickup_date),
            pickupTime: drop.use_pickup_windows && selectedWindow ? formatWindow(selectedWindow) : drop.pickup_time,
            pickupLocation: drop.pickup_location,
            items: cartItems.map(ci => {
              const item = dropItemsList.find(i => i.id === ci.dropItemId);
              return { name: item?.name || "", price: item?.price || 0, qty: ci.qty };
            }),
            total,
          }),
        });
      } catch (e) { console.error("Invoice email failed:", e); }
    }

    showToast(`Order created for ${customerName}!`);
    loadData();
  };
  const [showBlast, setShowBlast] = useState(null); // drop object

  const handleSendBlast = async ({ drop, channel, audience, customNote }) => {
    const dropItemsList = getDropItems(drop.id);
    // Build customer list based on audience selection
    let targetCustomers;
    if (audience === "ordered") {
      const orderedEmails = getDropOrders(drop.id)
        .filter(o => o.status !== "cancelled")
        .map(o => o.customer_email?.toLowerCase().trim())
        .filter(Boolean);
      targetCustomers = customers.filter(c =>
        c.opted_in && orderedEmails.includes(c.email?.toLowerCase().trim())
      );
    } else {
      targetCustomers = customers.filter(c => c.opted_in);
    }

    if (!targetCustomers.length) {
      showToast("No opted-in customers to send to.", "error"); return;
    }

    if (channel === "sms") {
      showToast("SMS blasts coming soon! 📱"); return;
    }

    try {
      const res = await fetch("/api/send-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator,
          drop,
          items: dropItemsList,
          customers: targetCustomers,
          channel,
          customNote: customNote || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Record that the announcement was sent so the UI can warn against
        // accidental re-sends. Non-blocking: if this patch fails we still
        // consider the blast itself successful.
        const prevCount = Number(drop.announcement_sent_count || 0);
        await supabase.from("drops").update({
          announcement_sent_at: new Date().toISOString(),
          announcement_sent_count: prevCount + 1,
        }).eq("id", drop.id).execute();
        await loadData();
        showToast(`📣 Blast sent to ${data.sent} customer${data.sent !== 1 ? "s" : ""}!`);
      } else {
        showToast("Blast failed. Check your email setup.", "error");
      }
    } catch {
      showToast("Blast failed — network error.", "error");
    }
  };

  // v27.1: Send a preview blast to a single address (typically the creator's email).
  // Reuses the same /api/send-blast endpoint with a one-customer list.
  // Does NOT flip announcement_sent_at so the v25 sent indicator stays accurate.
  const handleSendPreviewBlast = async ({ drop, customNote, previewEmail }) => {
    if (!previewEmail) { showToast("Missing preview email address.", "error"); return { success: false }; }
    const dropItemsList = getDropItems(drop.id);
    try {
      const res = await fetch("/api/send-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator,
          drop,
          items: dropItemsList,
          customers: [{ name: creator?.name || "Preview", email: previewEmail, opted_in: true }],
          channel: "email",
          customNote: customNote || "",
        }),
      });
      const data = await res.json();
      if (data.success && data.sent > 0) {
        showToast(`👁 Preview sent to ${previewEmail}`);
        return { success: true };
      }
      showToast("Preview send failed. Check the address and try again.", "error");
      return { success: false };
    } catch {
      showToast("Preview send failed — network error.", "error");
      return { success: false };
    }
  };

  const handleEditProfile = async (d) => {
    if (!creator) return;
    await supabase.from("creators").update({
      name: d.name, tagline: d.tagline, slug: d.slug, theme: d.theme,
      hero_image_url: d.heroImageUrl || "",
      hero_image_data: d.heroImageUrl ? { url: d.heroImageUrl, x: d.heroPan?.x ?? 50, y: d.heroPan?.y ?? 50 } : null,
    }).eq("id", creator.id).execute();
    setShowEditProfile(false); showToast("Profile updated! Slug changes take effect on reload."); loadData();
  };

  const handleSaveWelcomeEmail = async (d) => {
    if (!creator) return;
    await supabase.from("creators").update({
      logo_url: d.logoUrl || "",
      logo_data: d.logoUrl ? { url: d.logoUrl, x: d.logoPan?.x ?? 50, y: d.logoPan?.y ?? 50 } : null,
      bio: d.bio || "",
      how_drops_work: d.howDropsWork || "",
      social_links: d.socialLinks || {},
      welcome_photo_url: d.welcomePhotoUrl || "",
      welcome_photo_data: d.welcomePhotoUrl ? { url: d.welcomePhotoUrl, x: d.welcomePhotoPan?.x ?? 50, y: d.welcomePhotoPan?.y ?? 50 } : null,
    }).eq("id", creator.id).execute();
    showToast("Welcome email saved!"); loadData();
  };
  const handleMarkPaid = async (orderId) => {
    await supabase.from("orders").update({ payment_status: "paid" }).eq("id", orderId).execute();
    showToast("Order marked as paid."); loadData();
  };
  const handleUpdateOrderStatus = async (oid, status) => { await supabase.from("orders").update({ status }).eq("id", oid).execute(); showToast(`Order marked as ${status.replace("_"," ")}.`); loadData(); };
  const handleEndDrop = async (id) => { await supabase.from("drops").update({ status: "ended" }).eq("id", id).execute(); showToast("Drop ended."); setSelectedDrop(null); loadData(); };
  const handleArchiveDrop = async (id) => { await supabase.from("drops").update({ archived: true }).eq("id", id).execute(); showToast("Drop archived."); setSelectedDrop(null); loadData(); };
  const handleUnarchiveDrop = async (id) => { await supabase.from("drops").update({ archived: false }).eq("id", id).execute(); showToast("Drop restored."); loadData(); };

  // v28a: Product CRUD
  const handleCreateProduct = async (d) => {
    if (!creator) return;
    const { error } = await supabase.from("products").insert({
      creator_id: creator.id,
      name: d.name,
      description: d.description || "",
      price: parseFloat(d.price) || 0,
      image_url: d.imageUrl || "",
      image_data: d.imageUrl ? { url: d.imageUrl, x: d.imagePan?.x ?? 50, y: d.imagePan?.y ?? 50 } : null,
      sku: d.sku || "",
      tags: d.tags || [],
      capacity_weight: 1,
    }).execute();
    if (error) { showToast("Failed to create product.", "error"); return; }
    setShowNewProduct(false); showToast(`"${d.name}" added to products.`); loadData();
  };
  const handleEditProduct = async (id, d) => {
    const { error } = await supabase.from("products").update({
      name: d.name,
      description: d.description || "",
      price: parseFloat(d.price) || 0,
      image_url: d.imageUrl || "",
      image_data: d.imageUrl ? { url: d.imageUrl, x: d.imagePan?.x ?? 50, y: d.imagePan?.y ?? 50 } : null,
      sku: d.sku || "",
      tags: d.tags || [],
    }).eq("id", id).execute();
    if (error) { showToast("Failed to update product.", "error"); return; }
    setShowEditProduct(null); showToast("Product updated."); loadData();
  };
  const handleArchiveProduct = async (id) => { await supabase.from("products").update({ archived: true }).eq("id", id).execute(); showToast("Product archived."); loadData(); };
  const handleUnarchiveProduct = async (id) => { await supabase.from("products").update({ archived: false }).eq("id", id).execute(); showToast("Product restored."); loadData(); };
  const handleDeleteProductPermanently = async (productId) => {
    // drop_items.product_id is ON DELETE SET NULL so existing drops/items survive
    const { error } = await supabase.from("products").delete().eq("id", productId).execute();
    if (error) { showToast("Delete failed — check Supabase RLS policies.", "error"); return; }
    setShowDeleteProduct(null);
    showToast("Product permanently deleted.");
    loadData();
  };

const handleDeleteDropPermanently = async (dropId) => {
    // Delete in order: order_items → orders → drop_items → drop
    const dropOrderIds = orders.filter(o => o.drop_id === dropId).map(o => o.id);
    for (const oid of dropOrderIds) {
      await supabase.from("order_items").delete().eq("order_id", oid).execute();
    }
    await supabase.from("orders").delete().eq("drop_id", dropId).execute();
    await supabase.from("drop_items").delete().eq("drop_id", dropId).execute();
    const { error } = await supabase.from("drops").delete().eq("id", dropId).execute();
    if (error) { showToast("Delete failed — check Supabase RLS policies.", "error"); return; }
    // v27.1: close the confirmation modal + defensively drop the detail view if
    // the user was somehow viewing the drop we just deleted.
    setShowDeleteDrop(null);
    if (selectedDrop?.id === dropId) setSelectedDrop(null);
    showToast("Drop permanently deleted."); loadData();
  };

  const handleBulkDeleteCustomers = async (customerIds, deleteOrders) => {
    if (deleteOrders) {
      for (const cid of customerIds) {
        const custOrderIds = orders.filter(o => o.customer_id === cid).map(o => o.id);
        for (const oid of custOrderIds) {
          await supabase.from("order_items").delete().eq("order_id", oid).execute();
        }
        await supabase.from("orders").delete().eq("customer_id", cid).execute();
      }
    } else {
      // Keep orders but detach customer — set customer_id to null, keep customer_name
      for (const cid of customerIds) {
        const custName = customers.find(c => c.id === cid)?.name || "Guest";
        const custEmail = customers.find(c => c.id === cid)?.email || "";
        await supabase.from("orders").update({ customer_id: null, customer_name: custName, customer_email: custEmail }).eq("customer_id", cid).execute();
      }
    }
    for (const cid of customerIds) {
      await supabase.from("customers").delete().eq("id", cid).execute();
    }
    showToast(`${customerIds.length} customer${customerIds.length !== 1 ? "s" : ""} deleted.`);
    loadData();
  };

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
      <div className="creator-topbar"><span className="creator-topbar-brand">🍽️ FoodDrop</span><div className="creator-topbar-actions"><button className="creator-topbar-link" onClick={copyUrl}>{I.share} Copy Customer Link</button><a className="creator-topbar-link" href={customerUrl} target="_blank" rel="noopener noreferrer">{I.eye} View Page</a><button className="creator-topbar-link" onClick={onLogout}>Log Out</button></div></div>
      <nav className="creator-nav">
        {[{key:"dashboard",label:"Dashboard",icon:I.home},{key:"drops",label:"Drops",icon:I.drop},{key:"products",label:"Products",icon:I.image},{key:"customers",label:"Customers",icon:I.users},{key:"reports",label:"Reports",icon:I.chart},{key:"settings",label:"Settings",icon:I.settings}].map(t=>(
          <button key={t.key} className={tab===t.key?"active":""} onClick={()=>{setTab(t.key);setSelectedDrop(null);setSelectedCustomer(null)}}>{t.icon} {t.label}</button>
        ))}
      </nav>
      <div className="main-content page-enter" key={tab+(selectedDrop?.id||"")+(selectedCustomer?.id||"")}>
        {tab==="dashboard" && <DashboardTab creator={creator} customers={customers} drops={drops} orders={orders} orderItems={orderItems} dropItems={dropItems} getDropOrders={getDropOrders} getDropItems={getDropItems} getOrderItems={getOrderItems} onViewDrop={d=>{setSelectedDrop(d);setTab("drops")}} onShowRevenue={()=>setTab("reports")} onGoToDrops={()=>setTab("drops")} onNewDrop={()=>{setTab("drops");setShowNewDrop(true)}} onGoToSettings={()=>setTab("settings")} onGoToCustomers={()=>setTab("customers")} onGoToWelcomeEmail={()=>setTab("settings")}/>}
        {tab==="drops" && !selectedDrop && <DropsTab drops={drops} getDropItems={getDropItems} getDropOrders={getDropOrders} onSelect={setSelectedDrop} onNew={()=>setShowNewDrop(true)} onNewOnDate={(date)=>{setPrefilledDropDate(date);setShowNewDrop(true)}} onArchive={handleArchiveDrop} onUnarchive={handleUnarchiveDrop} onDuplicate={(drop)=>{setDuplicateDrop(drop);setShowNewDrop(true)}} onDeletePermanently={(drop)=>setShowDeleteDrop(drop)} onAnnounce={(drop)=>setShowBlast(drop)}/>}
        {tab==="drops" && selectedDrop && <DropDetail drop={selectedDrop} getDropItems={getDropItems} getDropOrders={getDropOrders} getOrderItems={getOrderItems} customers={customers} onBack={()=>setSelectedDrop(null)} onUpdateOrderStatus={handleUpdateOrderStatus} onMarkPaid={handleMarkPaid} onEndDrop={handleEndDrop} onEditDrop={()=>setShowEditDrop(selectedDrop)} onArchiveDrop={()=>handleArchiveDrop(selectedDrop.id)} onEditOrder={(order)=>setShowEditOrder({order,dropId:selectedDrop.id})} onDuplicate={()=>{setDuplicateDrop(selectedDrop);setSelectedDrop(null);setShowNewDrop(true)}} onNewOrder={()=>setShowManualOrder(selectedDrop)}/>}
        {tab==="products" && <ProductsTab products={products} dropItems={dropItems} onNew={()=>setShowNewProduct(true)} onEdit={(p)=>setShowEditProduct(p)} onArchive={handleArchiveProduct} onUnarchive={handleUnarchiveProduct} onDeletePermanently={(p)=>setShowDeleteProduct(p)}/>}
        {tab==="customers" && !selectedCustomer && <CustomersTab customers={customers} orders={orders} drops={drops} getDropOrders={getDropOrders} onAddCustomer={()=>setShowNewCustomer(true)} onCompose={()=>setShowCompose(true)} onSelectCustomer={setSelectedCustomer} onImport={()=>setShowImportCSV(true)} onBulkDelete={(ids)=>setShowBulkDelete(ids)}/>}
        {tab==="customers" && selectedCustomer && <CustomerDetail customer={selectedCustomer} orders={orders} drops={drops} customers={customers} getOrderItems={getOrderItems} onBack={()=>setSelectedCustomer(null)} onEdit={()=>setShowEditCustomer(selectedCustomer)} onDelete={()=>handleDeleteCustomer(selectedCustomer.id, selectedCustomer.name)} onMerge={handleMergeCustomers}/>}
        {tab==="reports" && <ReportsTab drops={drops} orders={orders} orderItems={orderItems} customers={customers} getDropOrders={getDropOrders} getDropItems={getDropItems} getOrderItems={getOrderItems} onViewDrop={d=>{setSelectedDrop(d);setTab("drops")}}/>}
        {tab==="settings" && <SettingsTab creator={creator} onEditProfile={()=>setShowEditProfile(true)} onSaveWelcomeEmail={handleSaveWelcomeEmail} session={session} showToast={showToast}/>}
      </div>
      {showNewDrop && <DropFormModal mode="create" duplicateFrom={duplicateDrop} duplicateItems={duplicateDrop?getDropItems(duplicateDrop.id):null} prefilledDate={prefilledDropDate} allDrops={drops} products={products} onCreateProduct={handleCreateProductFromDrop} onSave={handleCreateDrop} onClose={()=>{setShowNewDrop(false);setDuplicateDrop(null);setPrefilledDropDate(null)}}/>}
      {showEditDrop && <DropFormModal mode="edit" drop={showEditDrop} existingItems={getDropItems(showEditDrop.id)} allDrops={drops} products={products} onCreateProduct={handleCreateProductFromDrop} onSave={(d,items)=>handleEditDrop(showEditDrop.id,d,items)} onClose={()=>setShowEditDrop(null)}/>}
      {showNewCustomer && <CustomerFormModal mode="create" onSave={handleAddCustomer} onClose={()=>setShowNewCustomer(false)}/>}
      {showEditCustomer && <CustomerFormModal mode="edit" customer={showEditCustomer} onSave={d=>handleEditCustomer(showEditCustomer.id,d)} onClose={()=>setShowEditCustomer(null)}/>}
      {showEditProfile && <ProfileFormModal creator={creator} onSave={handleEditProfile} onClose={()=>setShowEditProfile(false)}/>}
      {showCompose && <ComposeModal customers={customers} onClose={()=>setShowCompose(false)} onSend={()=>{setShowCompose(false);showToast("Copied to clipboard!")}}/>}
      {showEditOrder && <EditOrderModal order={showEditOrder.order} dropItems={getDropItems(showEditOrder.dropId)} existingOrderItems={getOrderItems(showEditOrder.order.id)} onSave={(items)=>handleEditOrder(showEditOrder.order.id,items,showEditOrder.dropId)} onClose={()=>setShowEditOrder(null)}/>}
      {showImportCSV && <ImportCSVModal onImport={handleImportCustomers} onClose={()=>setShowImportCSV(false)}/>}
      {showBulkDelete && <BulkDeleteCustomersModal count={showBulkDelete.length} onConfirm={(deleteOrders)=>{handleBulkDeleteCustomers(showBulkDelete,deleteOrders);setShowBulkDelete(null);}} onClose={()=>setShowBulkDelete(null)}/>}
      {showBlast && <BlastModal drop={showBlast} creator={creator} customers={customers} getDropOrders={getDropOrders} onSend={handleSendBlast} onSendPreview={handleSendPreviewBlast} onClose={()=>setShowBlast(null)}/>}
      {showManualOrder && <ManualOrderModal drop={showManualOrder} dropItems={getDropItems(showManualOrder.id)} customers={customers} creator={creator} onSave={handleManualOrder} onClose={()=>setShowManualOrder(null)}/>}
      {/* v27.1: delete confirmation for archived drops (was previously orphaned state with no render) */}
      {showDeleteDrop && <PermanentDeleteDropModal drop={showDeleteDrop} onConfirm={()=>handleDeleteDropPermanently(showDeleteDrop.id)} onClose={()=>setShowDeleteDrop(null)}/>}
      {/* v28a: product modals */}
      {showNewProduct && <ProductFormModal mode="create" onSave={handleCreateProduct} onClose={()=>setShowNewProduct(false)} allExistingTags={[...new Set(products.flatMap(p=>p.tags||[]))].sort()}/>}
      {showEditProduct && <ProductFormModal mode="edit" product={showEditProduct} onSave={(d)=>handleEditProduct(showEditProduct.id,d)} onClose={()=>setShowEditProduct(null)} allExistingTags={[...new Set(products.flatMap(p=>p.tags||[]))].sort()} onArchive={()=>{handleArchiveProduct(showEditProduct.id);setShowEditProduct(null);}} onUnarchive={()=>{handleUnarchiveProduct(showEditProduct.id);setShowEditProduct(null);}} onDelete={()=>{setShowDeleteProduct(showEditProduct);setShowEditProduct(null);}}/>}
      {showDeleteProduct && <PermanentDeleteProductModal product={showDeleteProduct} onConfirm={()=>handleDeleteProductPermanently(showDeleteProduct.id)} onClose={()=>setShowDeleteProduct(null)}/>}
    </>
  );
}

// ============================================================
// DASHBOARD TAB — Clean with getting started + clickable revenue
// ============================================================
function DashboardTab({ creator, customers, drops, orders, orderItems, dropItems, getDropOrders, getDropItems, getOrderItems, onViewDrop, onShowRevenue, onGoToDrops, onNewDrop, onGoToSettings, onGoToCustomers, onGoToWelcomeEmail }) {
  const activeDrops = drops.filter(d => d.status === "active" && !d.archived);
  const nonArchived = drops.filter(d => !d.archived);
  const confirmedOrders = orders.filter(o => o.status !== "cancelled");
  const totalRev = confirmedOrders.reduce((s, o) => s + Number(o.total), 0);

  const hasProfile = creator?.name && creator.name !== "My Food Business";
  const hasDrops = drops.length > 0;
  const hasOrders = orders.length > 0;
  const hasWelcomeEmail = !!(creator?.bio);
  const isNewCreator = !hasDrops;

  // Getting started steps
  const steps = [
    { num: 1, title: "Set up your profile", desc: "Add your business name and tagline so customers know who you are.", done: hasProfile, action: onGoToSettings },
    { num: 2, title: "Write your welcome email", desc: "Introduce yourself to new customers — they'll receive this within an hour of joining your list or placing their first order.", done: hasWelcomeEmail, action: onGoToWelcomeEmail },
    { num: 3, title: "Create your first drop", desc: "Add menu items, set a pickup date and location, and upload food photos.", done: hasDrops, action: onNewDrop },
    { num: 4, title: "Share your page with customers", desc: "Copy your customer link and send it out via text or email.", done: hasDrops && customers.length > 0, action: null },
    { num: 5, title: "Manage incoming orders", desc: "Track who ordered, view your prep summary, and mark pickups complete.", done: hasOrders, action: onGoToDrops },
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
        <div className="stat-sub">View Reports</div>
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
// REPORTS TAB — Sales Summary + Item Summary
// ============================================================

// Date range helpers
function getDateRange(preset, customStart, customEnd) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "7d": return { start: new Date(today - 6 * 86400000), end: new Date(today.getTime() + 86399999) };
    case "30d": return { start: new Date(today - 29 * 86400000), end: new Date(today.getTime() + 86399999) };
    case "90d": return { start: new Date(today - 89 * 86400000), end: new Date(today.getTime() + 86399999) };
    case "year": return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getTime() + 86399999) };
    case "all": return { start: new Date("2000-01-01"), end: new Date(today.getTime() + 86399999) };
    case "custom": return { start: customStart ? new Date(customStart + "T00:00:00") : new Date("2000-01-01"), end: customEnd ? new Date(customEnd + "T23:59:59") : new Date(today.getTime() + 86399999) };
    default: return { start: new Date("2000-01-01"), end: new Date(today.getTime() + 86399999) };
  }
}

function DateRangeSelector({ preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd }) {
  const presets = [
    { key: "7d", label: "Last 7 Days" },
    { key: "30d", label: "Last 30 Days" },
    { key: "90d", label: "Last 90 Days" },
    { key: "year", label: "This Year" },
    { key: "all", label: "All Time" },
    { key: "custom", label: "Custom" },
  ];
  return (
    <div style={{marginBottom: 24}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom: preset==="custom" ? 12 : 0}}>
        {presets.map(p => (
          <button key={p.key} onClick={()=>setPreset(p.key)}
            className={`btn btn-sm ${preset===p.key ? "btn-primary" : "btn-secondary"}`}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginTop:12,padding:"12px 16px",background:"var(--surface-alt)",borderRadius:"var(--radius-sm)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <label style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)",whiteSpace:"nowrap"}}>From</label>
            <input type="date" className="form-input" style={{width:160}} value={customStart} onChange={e=>setCustomStart(e.target.value)}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <label style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)",whiteSpace:"nowrap"}}>To</label>
            <input type="date" className="form-input" style={{width:160}} value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsTab({ drops, orders, orderItems, customers, getDropOrders, getDropItems, getOrderItems, onViewDrop }) {
  const [report, setReport] = useState("sales");
  const [itemSubview, setItemSubview] = useState("byItem");
  const [preset, setPreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { start, end } = getDateRange(preset, customStart, customEnd);

  // Filter orders to date range using created_at
  const allConfirmed = orders.filter(o => o.status !== "cancelled");
  const rangeOrders = allConfirmed.filter(o => {
    const d = new Date(o.created_at);
    return d >= start && d <= end;
  });

  // Also filter drops whose pickup_date falls in range (for context)
  const nonArchived = drops.filter(d => !d.archived);

  return (
    <div>
      <div style={{marginBottom:28}}>
        <h1>Reports</h1>
        <p style={{color:"var(--text-secondary)",marginTop:4}}>Review your sales performance and item breakdown.</p>
      </div>

      {/* Report type selector */}
      <div className="view-tabs" style={{maxWidth:520,marginBottom:28}}>
        <button className={`view-tab ${report==="sales"?"active":""}`} onClick={()=>setReport("sales")}>Sales Summary</button>
        <button className={`view-tab ${report==="items"?"active":""}`} onClick={()=>setReport("items")}>Item Summary</button>
        <button className={`view-tab ${report==="customers"?"active":""}`} onClick={()=>setReport("customers")}>Customer Summary</button>
      </div>

      {report === "sales" && (
        <SalesSummary
          drops={nonArchived} orders={rangeOrders} allOrders={allConfirmed}
          customers={customers} getDropOrders={getDropOrders} getOrderItems={getOrderItems}
          onViewDrop={onViewDrop} preset={preset} setPreset={setPreset}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd} setCustomEnd={setCustomEnd}
          start={start} end={end}
        />
      )}
      {report === "items" && (
        <ItemSummary
          drops={nonArchived} orders={rangeOrders} getDropItems={getDropItems}
          getOrderItems={getOrderItems} onViewDrop={onViewDrop}
          subview={itemSubview} setSubview={setItemSubview}
          preset={preset} setPreset={setPreset}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd} setCustomEnd={setCustomEnd}
        />
      )}
      {report === "customers" && (
        <CustomerSummary
          drops={nonArchived} orders={rangeOrders} customers={customers}
          getOrderItems={getOrderItems}
          preset={preset} setPreset={setPreset}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd} setCustomEnd={setCustomEnd}
        />
      )}
    </div>
  );
}

// ── Sales Summary ──────────────────────────────────────────────
function SalesSummary({ drops, orders, allOrders, customers, getDropOrders, getOrderItems, onViewDrop, preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, start, end }) {
  const totalRev = orders.reduce((s, o) => s + Number(o.total), 0);
  const avgOrder = orders.length > 0 ? totalRev / orders.length : 0;

  // Customer loyalty within range
  const custOrderCounts = {};
  orders.forEach(o => { if (o.customer_id) custOrderCounts[o.customer_id] = (custOrderCounts[o.customer_id] || 0) + 1; });
  const repeatCustomers = Object.values(custOrderCounts).filter(c => c > 1).length;
  const firstTimeCustomers = Object.values(custOrderCounts).filter(c => c === 1).length;

  // Uncollected cash — active drops only
  const activeDrops = drops.filter(d => d.status === "active");
  const uncollected = activeDrops.reduce((sum, drop) => {
    const dOrders = getDropOrders(drop.id).filter(o => o.status !== "cancelled" && o.status !== "picked_up");
    return sum + dOrders.reduce((s, o) => s + Number(o.total), 0);
  }, 0);

  // Drop-by-drop breakdown filtered to range
  const dropRows = drops.map(drop => {
    const dOrders = getDropOrders(drop.id).filter(o => {
      if (o.status === "cancelled") return false;
      const d = new Date(o.created_at);
      return d >= start && d <= end;
    });
    return { ...drop, revenue: dOrders.reduce((s, o) => s + Number(o.total), 0), orderCount: dOrders.length };
  }).filter(d => d.orderCount > 0).sort((a, b) => new Date(b.pickup_date) - new Date(a.pickup_date));

  // Best drop in range
  const bestDrop = [...dropRows].sort((a, b) => b.revenue - a.revenue)[0] || null;

  return (
    <>
      <DateRangeSelector preset={preset} setPreset={setPreset} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd}/>

      {/* Top stats */}
      <div className="stats-row" style={{marginBottom:24}}>
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value">{fmt(totalRev)}</div>
          <div className="stat-sub">{orders.length} order{orders.length!==1?"s":""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Order Value</div>
          <div className="stat-value">{fmt(avgOrder)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{orders.length}</div>
        </div>
        {uncollected > 0 && (
          <div className="stat-card" style={{borderLeft:"4px solid var(--gold)"}}>
            <div className="stat-label" style={{color:"var(--gold)"}}>Uncollected Cash</div>
            <div className="stat-value" style={{color:"var(--gold)"}}>{fmt(uncollected)}</div>
            <div className="stat-sub">Active drop(s) — cash due at pickup</div>
          </div>
        )}
      </div>

      {/* Best Drop */}
      {bestDrop && (
        <div style={{background:"var(--gold-light)",border:"1px solid #f0dca0",borderRadius:"var(--radius)",padding:"16px 20px",marginBottom:24,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={()=>onViewDrop(bestDrop)}>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--gold)",marginBottom:4}}>🏆 Best Drop</div>
            <div style={{fontWeight:600,fontSize:16}}>{bestDrop.title}</div>
            <div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>{bestDrop.orderCount} orders · {fmtDate(bestDrop.pickup_date)}</div>
          </div>
          <div style={{fontFamily:"var(--font-display)",fontSize:24,fontWeight:700,color:"var(--gold)"}}>{fmt(bestDrop.revenue)}</div>
        </div>
      )}

      {/* Customer loyalty */}
      {(repeatCustomers > 0 || firstTimeCustomers > 0) && (
        <div style={{marginBottom:24}}>
          <h3 style={{marginBottom:12}}>Customer Loyalty</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{background:"var(--green-light)",borderRadius:"var(--radius-sm)",padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--green)",marginBottom:4}}>Repeat Customers</div>
              <div style={{fontFamily:"var(--font-display)",fontSize:28,fontWeight:700,color:"var(--green)"}}>{repeatCustomers}</div>
              <div style={{fontSize:12,color:"var(--green)",marginTop:2,opacity:.8}}>2+ orders placed</div>
            </div>
            <div style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--text-tertiary)",marginBottom:4}}>First-Time Customers</div>
              <div style={{fontFamily:"var(--font-display)",fontSize:28,fontWeight:700}}>{firstTimeCustomers}</div>
              <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>1 order placed</div>
            </div>
          </div>
        </div>
      )}

      {/* Drop-by-drop table */}
      {dropRows.length > 0 ? (
        <div>
          <h3 style={{marginBottom:12}}>Revenue by Drop</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Drop</th>
                  <th>Pickup Date</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Avg Order</th>
                </tr>
              </thead>
              <tbody>
                {dropRows.map(drop => (
                  <tr key={drop.id} style={{cursor:"pointer"}} onClick={()=>onViewDrop(drop)}>
                    <td><div style={{fontWeight:600}}>{drop.title}</div></td>
                    <td style={{color:"var(--text-secondary)",fontSize:13}}>{fmtDate(drop.pickup_date)}</td>
                    <td>{drop.orderCount}</td>
                    <td style={{fontWeight:600,color:"var(--accent)"}}>{fmt(drop.revenue)}</td>
                    <td style={{color:"var(--text-secondary)"}}>{fmt(drop.orderCount > 0 ? drop.revenue / drop.orderCount : 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:"2px solid var(--border)"}}>
                  <td colSpan={2} style={{fontWeight:700,paddingTop:12}}>Total</td>
                  <td style={{fontWeight:700}}>{dropRows.reduce((s,d)=>s+d.orderCount,0)}</td>
                  <td style={{fontWeight:700,color:"var(--accent)"}}>{fmt(dropRows.reduce((s,d)=>s+d.revenue,0))}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state"><p>No sales data for this date range.</p></div>
      )}
    </>
  );
}

// ── Item Summary ───────────────────────────────────────────────
function ItemSummary({ drops, orders, getDropItems, getOrderItems, onViewDrop, subview, setSubview, preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd }) {

  // Build item-level data across all orders in range
  const itemSales = {};
  orders.forEach(order => {
    getOrderItems(order.id).forEach(oi => {
      const key = oi.item_name;
      if (!itemSales[key]) itemSales[key] = { name: key, qty: 0, revenue: 0, orders: 0 };
      itemSales[key].qty += oi.quantity;
      itemSales[key].revenue += oi.quantity * Number(oi.item_price);
      itemSales[key].orders += 1;
    });
  });
  const itemRows = Object.values(itemSales).sort((a, b) => b.revenue - a.revenue);
  const maxItemRev = Math.max(...itemRows.map(i => i.revenue), 1);

  // Build drop-level data
  const { start, end } = getDateRange(preset, customStart, customEnd);
  const dropRows = drops.map(drop => {
    const dOrders = getDropOrders_local(drop.id, orders, getOrderItems);
    const filtered = dOrders.filter(o => {
      if (o.status === "cancelled") return false;
      const d = new Date(o.created_at);
      return d >= start && d <= end;
    });
    const dItems = getDropItems(drop.id);
    const itemBreakdown = dItems.map(di => {
      const sold = filtered.reduce((sum, o) => {
        const oi = getOrderItems(o.id).find(x => x.drop_item_id === di.id);
        return sum + (oi ? oi.quantity : 0);
      }, 0);
      return { name: di.name, price: di.price, sold, revenue: sold * Number(di.price) };
    }).filter(i => i.sold > 0);
    const revenue = filtered.reduce((s, o) => s + Number(o.total), 0);
    return { ...drop, orderCount: filtered.length, revenue, itemBreakdown };
  }).filter(d => d.orderCount > 0).sort((a, b) => new Date(b.pickup_date) - new Date(a.pickup_date));

  return (
    <>
      <DateRangeSelector preset={preset} setPreset={setPreset} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd}/>

      {/* Sub-view toggle */}
      <div className="view-tabs" style={{maxWidth:300,marginBottom:24}}>
        <button className={`view-tab ${subview==="byItem"?"active":""}`} onClick={()=>setSubview("byItem")}>By Item</button>
        <button className={`view-tab ${subview==="byDrop"?"active":""}`} onClick={()=>setSubview("byDrop")}>By Drop</button>
      </div>

      {/* By Item view */}
      {subview === "byItem" && (
        itemRows.length > 0 ? (
          <div>
            <h3 style={{marginBottom:12}}>All Items — Sales Totals</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                    <th style={{width:200}}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.map((item, i) => (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{item.name}</td>
                      <td>{item.qty}</td>
                      <td style={{fontWeight:600,color:"var(--accent)"}}>{fmt(item.revenue)}</td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:8,background:"var(--surface-alt)",borderRadius:4,overflow:"hidden"}}>
                            <div style={{height:"100%",background:"var(--accent)",borderRadius:4,width:`${(item.revenue/maxItemRev)*100}%`}}/>
                          </div>
                          <span style={{fontSize:12,color:"var(--text-tertiary)",width:36,textAlign:"right"}}>{Math.round((item.revenue/maxItemRev)*100)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{borderTop:"2px solid var(--border)"}}>
                    <td style={{fontWeight:700,paddingTop:12}}>Total</td>
                    <td style={{fontWeight:700}}>{itemRows.reduce((s,i)=>s+i.qty,0)}</td>
                    <td style={{fontWeight:700,color:"var(--accent)"}}>{fmt(itemRows.reduce((s,i)=>s+i.revenue,0))}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : <div className="empty-state"><p>No item sales data for this date range.</p></div>
      )}

      {/* By Drop view */}
      {subview === "byDrop" && (
        dropRows.length > 0 ? (
          <div style={{display:"grid",gap:16}}>
            <h3>Items Sold — by Drop</h3>
            {dropRows.map(drop => (
              <div key={drop.id} className="card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,cursor:"pointer"}} onClick={()=>onViewDrop(drop)}>
                  <div>
                    <div style={{fontWeight:700,fontSize:16}}>{drop.title}</div>
                    <div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>{fmtDate(drop.pickup_date)} · {drop.orderCount} orders · {fmt(drop.revenue)}</div>
                  </div>
                  <span style={{fontSize:12,color:"var(--accent)",fontWeight:600}}>View Drop →</span>
                </div>
                {drop.itemBreakdown.length > 0 ? (
                  <div className="table-wrap" style={{border:"none",borderRadius:0,background:"transparent"}}>
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Price</th>
                          <th>Sold</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drop.itemBreakdown.map((item, i) => (
                          <tr key={i}>
                            <td style={{fontWeight:500}}>{item.name}</td>
                            <td style={{color:"var(--text-secondary)"}}>{fmt(item.price)}</td>
                            <td>{item.sold}</td>
                            <td style={{fontWeight:600,color:"var(--accent)"}}>{fmt(item.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{fontSize:13,color:"var(--text-tertiary)"}}>No item data available.</div>
                )}
              </div>
            ))}
          </div>
        ) : <div className="empty-state"><p>No drop data for this date range.</p></div>
      )}
    </>
  );
}

// Helper used inside ItemSummary to get orders for a drop without prop drilling getDropOrders
function getDropOrders_local(dropId, orders) {
  return orders.filter(o => o.drop_id === dropId);
}

// ── Customer Summary ───────────────────────────────────────────
function CustomerSummary({ drops, orders, customers, getOrderItems, preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd }) {
  const [sortKey, setSortKey] = useState("spent");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span style={{color:"var(--text-tertiary)",fontSize:10,marginLeft:4}}>↕</span>;
    return <span style={{color:"var(--accent)",fontSize:10,marginLeft:4}}>{sortDir==="desc"?"↓":"↑"}</span>;
  };

  // Build per-customer stats from range orders
  const custMap = {};
  orders.forEach(o => {
    const key = o.customer_id || ("guest_" + (o.customer_email || o.customer_name || o.id));
    if (!custMap[key]) {
      const cust = customers.find(c => c.id === o.customer_id);
      custMap[key] = {
        id: o.customer_id,
        name: cust?.name || o.customer_name || "Guest",
        email: cust?.email || o.customer_email || "",
        totalSpent: 0,
        orderCount: 0,
        firstOrder: null,
        lastOrder: null,
        dropIds: new Set(),
      };
    }
    custMap[key].totalSpent += Number(o.total);
    custMap[key].orderCount += 1;
    const d = new Date(o.created_at);
    if (!custMap[key].firstOrder || d < custMap[key].firstOrder) custMap[key].firstOrder = d;
    if (!custMap[key].lastOrder || d > custMap[key].lastOrder) custMap[key].lastOrder = d;
    if (o.drop_id) custMap[key].dropIds.add(o.drop_id);
  });

  let rows = Object.values(custMap).map(c => ({
    ...c,
    dropIds: Array.from(c.dropIds),
    isRepeat: c.orderCount > 1,
  }));

  // Sort
  rows.sort((a, b) => {
    let av, bv;
    switch (sortKey) {
      case "spent":    av = a.totalSpent;   bv = b.totalSpent;   break;
      case "orders":   av = a.orderCount;   bv = b.orderCount;   break;
      case "last":     av = a.lastOrder;    bv = b.lastOrder;    break;
      case "first":    av = a.firstOrder;   bv = b.firstOrder;   break;
      case "name":     av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
      default:         av = a.totalSpent;   bv = b.totalSpent;
    }
    if (av < bv) return sortDir === "desc" ? 1 : -1;
    if (av > bv) return sortDir === "desc" ? -1 : 1;
    return 0;
  });

  const totalRevenue = rows.reduce((s, c) => s + c.totalSpent, 0);
  const repeatCount = rows.filter(c => c.isRepeat).length;
  const topSpender = rows[0] || null;

  // Map drop ids to titles for the drops column
  const dropTitle = (id) => drops.find(d => d.id === id)?.title || "Unknown Drop";

  return (
    <>
      <DateRangeSelector preset={preset} setPreset={setPreset} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd}/>

      {/* Summary stats */}
      <div className="stats-row" style={{marginBottom:24}}>
        <div className="stat-card">
          <div className="stat-label">Customers Who Ordered</div>
          <div className="stat-value">{rows.length}</div>
          <div className="stat-sub">in this date range</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Repeat Buyers</div>
          <div className="stat-value" style={{color:"var(--green)"}}>{repeatCount}</div>
          <div className="stat-sub">{rows.length > 0 ? Math.round((repeatCount/rows.length)*100) : 0}% of customers</div>
        </div>
        {topSpender && (
          <div className="stat-card">
            <div className="stat-label">Top Customer</div>
            <div className="stat-value" style={{fontSize:20}}>{topSpender.name}</div>
            <div className="stat-sub">{fmt(topSpender.totalSpent)} across {topSpender.orderCount} order{topSpender.orderCount!==1?"s":""}</div>
          </div>
        )}
      </div>

      {rows.length > 0 ? (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3>Customer Breakdown</h3>
            <div style={{fontSize:12,color:"var(--text-tertiary)"}}>Click column headers to sort</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{cursor:"pointer"}} onClick={()=>handleSort("name")}>Customer <SortIcon col="name"/></th>
                  <th style={{cursor:"pointer"}} onClick={()=>handleSort("spent")}>Total Spent <SortIcon col="spent"/></th>
                  <th style={{cursor:"pointer"}} onClick={()=>handleSort("orders")}>Orders <SortIcon col="orders"/></th>
                  <th>Status</th>
                  <th style={{cursor:"pointer"}} onClick={()=>handleSort("first")}>First Order <SortIcon col="first"/></th>
                  <th style={{cursor:"pointer"}} onClick={()=>handleSort("last")}>Last Order <SortIcon col="last"/></th>
                  <th>Drops</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((cust, i) => (
                  <tr key={cust.id || i}>
                    <td>
                      <div style={{fontWeight:600}}>{cust.name}</div>
                      {cust.email && <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>{cust.email}</div>}
                    </td>
                    <td style={{fontWeight:600,color:"var(--accent)"}}>{fmt(cust.totalSpent)}</td>
                    <td>{cust.orderCount}</td>
                    <td>
                      <span className={`badge ${cust.isRepeat ? "badge-active" : "badge-preorder"}`} style={{fontSize:11}}>
                        {cust.isRepeat ? "Repeat" : "First-time"}
                      </span>
                    </td>
                    <td style={{fontSize:13,color:"var(--text-secondary)"}}>{cust.firstOrder ? fmtDate(cust.firstOrder.toISOString().slice(0,10)) : "—"}</td>
                    <td style={{fontSize:13,color:"var(--text-secondary)"}}>{cust.lastOrder ? fmtDate(cust.lastOrder.toISOString().slice(0,10)) : "—"}</td>
                    <td>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {cust.dropIds.map(id => (
                          <span key={id} style={{fontSize:11,background:"var(--surface-alt)",border:"1px solid var(--border)",borderRadius:12,padding:"2px 8px",whiteSpace:"nowrap"}}>
                            {dropTitle(id)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:"2px solid var(--border)"}}>
                  <td style={{fontWeight:700,paddingTop:12}}>Total</td>
                  <td style={{fontWeight:700,color:"var(--accent)"}}>{fmt(totalRevenue)}</td>
                  <td style={{fontWeight:700}}>{rows.reduce((s,c)=>s+c.orderCount,0)}</td>
                  <td colSpan={4}/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state"><p>No customer orders found for this date range.</p></div>
      )}
    </>
  );
}

// ============================================================
// DROPS TAB — with archive toggle
// ============================================================
// v27a: Month-grid calendar view of drops
function DropsCalendar({ drops, getDropOrders, onSelectDrop, onNewOnDate }) {
  const [focalMonth, setFocalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [morePopover, setMorePopover] = useState(null); // { dayKey, drops, x, y }

  const today = new Date(); today.setHours(0,0,0,0);
  const monthLabel = focalMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Build 6-week grid starting on Sunday of the first week
  const firstOfMonth = focalMonth;
  const firstCellDate = new Date(firstOfMonth); firstCellDate.setDate(1 - firstOfMonth.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstCellDate); d.setDate(firstCellDate.getDate() + i);
    cells.push(d);
  }

  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const dropsByDay = drops.reduce((acc, drop) => {
    if (!drop.pickup_date) return acc;
    (acc[drop.pickup_date] ||= []).push(drop);
    return acc;
  }, {});

  const goPrev = () => setFocalMonth(new Date(focalMonth.getFullYear(), focalMonth.getMonth()-1, 1));
  const goNext = () => setFocalMonth(new Date(focalMonth.getFullYear(), focalMonth.getMonth()+1, 1));
  const goToday = () => { const d = new Date(); setFocalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); };

  const handleMoreClick = (e, dayDrops, dayKey) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMorePopover({ dayKey, drops: dayDrops, x: rect.left, y: rect.bottom + 4 });
  };

  useEffect(() => {
    if (!morePopover) return;
    const close = () => setMorePopover(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [morePopover]);

  return (
    <div>
      <div className="cal-header">
        <div className="cal-title">{monthLabel}</div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={goToday} title="Jump to today" style={{fontSize:12,padding:"6px 12px"}}>Today</button>
          <button className="cal-nav-btn" onClick={goPrev} title="Previous month">‹</button>
          <button className="cal-nav-btn" onClick={goNext} title="Next month">›</button>
        </div>
      </div>
      <div className="cal-weekdays">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="cal-weekday">{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map(cellDate => {
          const key = ymd(cellDate);
          const dayDrops = dropsByDay[key] || [];
          const isOtherMonth = cellDate.getMonth() !== focalMonth.getMonth();
          const isToday = cellDate.getTime() === today.getTime();
          const isClickable = !isOtherMonth && dayDrops.length === 0;
          const visibleDrops = dayDrops.slice(0, 2);
          const hiddenCount = dayDrops.length - visibleDrops.length;
          return (
            <div
              key={key}
              className={`cal-cell ${isOtherMonth?"other-month":""} ${isToday?"today":""} ${isClickable?"clickable":""}`}
              onClick={isClickable ? () => onNewOnDate(key) : undefined}>
              <div className="cal-daynum">
                <span>{cellDate.getDate()}</span>
                {isClickable && <span className="cal-daynum-plus">+</span>}
              </div>
              {visibleDrops.map(drop => {
                const isEnded = drop.status === "ended";
                const orderCount = getDropOrders(drop.id).filter(o => o.status !== "cancelled").length;
                return (
                  <div
                    key={drop.id}
                    className={`cal-drop-chip ${isEnded?"ended":""}`}
                    title={drop.title}
                    onClick={(e)=>{e.stopPropagation();onSelectDrop(drop);}}>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{drop.title}</span>
                    {orderCount > 0 && <span className="cal-drop-chip-count">{orderCount}</span>}
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <div className="cal-more-link" onClick={(e)=>handleMoreClick(e, dayDrops, key)}>
                  +{hiddenCount} more
                </div>
              )}
            </div>
          );
        })}
      </div>
      {morePopover && (
        <div className="cal-more-popover" style={{left:morePopover.x, top:morePopover.y}} onClick={e=>e.stopPropagation()}>
          <div className="cal-more-popover-title">{fmtDate(morePopover.dayKey)}</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {morePopover.drops.map(drop => {
              const orderCount = getDropOrders(drop.id).filter(o => o.status !== "cancelled").length;
              return (
                <div
                  key={drop.id}
                  className={`cal-drop-chip ${drop.status==="ended"?"ended":""}`}
                  onClick={()=>{setMorePopover(null);onSelectDrop(drop);}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{drop.title}</span>
                  {orderCount > 0 && <span className="cal-drop-chip-count">{orderCount}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DropsTab({ drops, getDropItems, getDropOrders, onSelect, onNew, onNewOnDate, onArchive, onUnarchive, onDuplicate, onDeletePermanently, onAnnounce }) {
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState("list"); // v27a: "list" | "calendar"
  const visible = showArchived ? drops : drops.filter(d => !d.archived);
  const archivedCount = drops.filter(d => d.archived).length;

  return (<>
    <div className="section-header">
      <div><h1>Drops</h1></div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div className="view-toggle" role="tablist" aria-label="Drops view">
          <button className={view==="list"?"active":""} onClick={()=>setView("list")} aria-selected={view==="list"}>☰ List</button>
          <button className={view==="calendar"?"active":""} onClick={()=>setView("calendar")} aria-selected={view==="calendar"}>🗓 Calendar</button>
        </div>
        {archivedCount > 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setShowArchived(!showArchived)}>{I.archive} {showArchived ? "Hide" : "Show"} Archived ({archivedCount})</button>}
        <button className="btn btn-primary" onClick={onNew}>{I.plus} New Drop</button>
      </div>
    </div>
    {view === "calendar" ? (
      <DropsCalendar drops={visible} getDropOrders={getDropOrders} onSelectDrop={(d)=>!d.archived&&onSelect(d)} onNewOnDate={onNewOnDate}/>
    ) : visible.length===0?(<div className="empty-state"><div className="empty-state-icon">{I.drop}</div><h3>No drops yet</h3><p style={{marginTop:8}}>Create your first drop to start taking orders.</p></div>):(
      <div style={{display:"grid",gap:16}}>{visible.map(drop=>{const dI=getDropItems(drop.id);const dO=getDropOrders(drop.id);const isArchived=drop.archived;return(<div key={drop.id} className={`card card-hover drop-card ${drop.status==="ended"||isArchived?"drop-card-ended":""}`} style={{opacity:isArchived?.6:1}} onClick={()=>!isArchived&&onSelect(drop)}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><h3>{drop.title}</h3><p style={{color:"var(--text-secondary)",fontSize:14,marginTop:4}}>{drop.description}</p><div className="drop-meta"><span className="drop-meta-item">{I.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span></div></div><div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>{isArchived?<><span className="badge badge-archived">Archived</span><button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();onUnarchive(drop.id)}}>Restore</button><button className="btn btn-danger btn-sm" onClick={e=>{e.stopPropagation();onDeletePermanently(drop)}}>{I.trash} Delete</button></>:<><span className={`badge badge-${drop.status}`}>{drop.status==="active"?"Active":"Ended"}</span>{drop.status==="active"&&(drop.announcement_sent_at?<button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();if(window.confirm(`You already sent an announcement for "${drop.title}" on ${new Date(drop.announcement_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}${drop.announcement_sent_count>1?` (${drop.announcement_sent_count} times total)`:""}. Send another?`))onAnnounce(drop)}} title={`Sent ${new Date(drop.announcement_sent_at).toLocaleString()}`} style={{color:"var(--text-secondary)"}}>✅ Announced</button>:<button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();onAnnounce(drop)}} title="Announce this drop">📣 Announce</button>)}<button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();onDuplicate(drop)}} title="Duplicate this drop">{I.copy}</button></>}</div></div>{!isArchived&&<><div className="drop-items-preview">{dI.map(item=><span key={item.id} className="drop-item-chip">{item.name} · {fmt(item.price)}</span>)}</div><div style={{marginTop:12,fontSize:14,color:"var(--text-secondary)"}}><strong style={{color:"var(--text)"}}>{dO.length}</strong> order{dO.length!==1?"s":""} · <strong style={{color:"var(--text)"}}>{fmt(dO.reduce((s,o)=>s+Number(o.total),0))}</strong></div></>}</div>)})}</div>
    )}
  </>);
}

// ============================================================
// DROP DETAIL — with archive, edit order buttons
// ============================================================
function DropDetail({ drop, getDropItems, getDropOrders, getOrderItems, customers, onBack, onUpdateOrderStatus, onMarkPaid, onEndDrop, onEditDrop, onArchiveDrop, onEditOrder, onDuplicate, onNewOrder }) {
  const [view, setView] = useState("summary");
  const [pickedUpLocal, setPickedUpLocal] = useState({});
  const dI=getDropItems(drop.id); const dO=getDropOrders(drop.id); const activeDO=dO.filter(o=>o.status!=="cancelled"); const rev=activeDO.reduce((s,o)=>s+Number(o.total),0);
  const prep=dI.map(item=>{const tot=activeDO.reduce((sum,order)=>{const ois=getOrderItems(order.id);const oi=ois.find(i=>i.drop_item_id===item.id);return sum+(oi?oi.quantity:0)},0);return{...item,totalOrdered:tot}});

  const handlePrint = () => window.print();

  // Pickup checklist uses local state for instant toggling + syncs to DB
  const togglePickup = async (orderId, currentStatus) => {
    const newStatus = currentStatus === "picked_up" ? "confirmed" : "picked_up";
    setPickedUpLocal(p => ({...p, [orderId]: newStatus}));
    await onUpdateOrderStatus(orderId, newStatus);
  };

  const getOrderStatus = (order) => pickedUpLocal[order.id] || order.status;

  return (<>
    <button className="btn btn-ghost" onClick={onBack} style={{marginBottom:16}}>{I.back} Back to Drops</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div>
        {drop.image_url && <img src={drop.image_url} alt="" style={{width:"100%",maxWidth:400,height:160,objectFit:"cover",borderRadius:"var(--radius-sm)",marginBottom:12}}/>}
        <h1>{drop.title}</h1>
        <div className="drop-meta" style={{marginTop:8}}><span className="drop-meta-item">{I.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span><span className="drop-meta-item">{I.pin} {drop.pickup_location}</span></div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <button className="btn btn-secondary btn-sm" onClick={onEditDrop}>{I.edit} Edit</button>
        <button className="btn btn-secondary btn-sm" onClick={onDuplicate}>{I.copy} Duplicate</button>
        <span className={`badge badge-${drop.status}`}>{drop.status==="active"?"Active":"Ended"}</span>
        {drop.status==="active"&&<button className="btn btn-primary btn-sm" onClick={onNewOrder}>+ New Order</button>}
        {drop.status==="active"&&<button className="btn btn-danger btn-sm" onClick={()=>onEndDrop(drop.id)}>End Drop</button>}
        <button className="btn btn-ghost btn-sm" onClick={onArchiveDrop}>{I.archive} Archive</button>
      </div>
    </div>

    <div className="stats-row"><div className="stat-card"><div className="stat-label">Orders</div><div className="stat-value">{activeDO.length}</div></div><div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">{fmt(rev)}</div><div className="stat-sub">Cash to collect</div></div><div className="stat-card"><div className="stat-label">Picked Up</div><div className="stat-value">{dO.filter(o=>getOrderStatus(o)==="picked_up").length}/{activeDO.length}</div></div></div>

    {/* View Tabs */}
    <div className="view-tabs">
      <button className={`view-tab ${view==="summary"?"active":""}`} onClick={()=>setView("summary")}>🧑‍🍳 Prep Summary</button>
      <button className={`view-tab ${view==="orders"?"active":""}`} onClick={()=>setView("orders")}>📋 Orders</button>
      <button className={`view-tab ${view==="pickup"?"active":""}`} onClick={()=>setView("pickup")}>{I.listCheck} Pickup Checklist</button>
    </div>

    {/* Prep Summary View */}
    {view==="summary"&&(<div className="page-enter">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2>Prep Summary</h2><button className="btn btn-secondary btn-sm" onClick={handlePrint}>{I.print} Print</button></div>
      <div className="prep-grid">{prep.map(item=>(<div key={item.id} className="prep-item"><div style={{display:"flex",alignItems:"center",gap:12}}>{item.image_url&&<img src={item.image_url} alt="" style={{width:48,height:48,borderRadius:8,objectFit:"cover"}}/>}<div><div className="prep-item-name">{item.name}</div><div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>{fmt(item.price)} each · {item.quantity>0?`${item.quantity-item.totalOrdered} remaining of ${item.quantity}`:"Unlimited"}</div>{item.quantity>0&&<div className="progress-bar" style={{width:160,marginTop:8}}><div className={`progress-fill ${item.totalOrdered>=item.quantity?"full":""}`} style={{width:`${Math.min((item.totalOrdered/item.quantity)*100,100)}%`}}/></div>}</div></div><div className="prep-item-count">{item.totalOrdered}</div></div>))}</div>
    </div>)}

    {/* Orders View */}
    {view==="orders"&&(<div className="page-enter">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2>All Orders</h2></div>
      {dO.length===0?<div className="empty-state"><p>No orders yet.</p></div>:(
        <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Items</th>{drop.use_pickup_windows&&<th>Window</th>}<th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{dO.map(order=>{const cust=customers.find(c=>c.id===order.customer_id);const ois=getOrderItems(order.id);const isCancelled=order.status==="cancelled";const orderWindow=drop.use_pickup_windows?(drop.pickup_windows||[]).find(w=>w.id===order.pickup_window_id):null;return(<tr key={order.id} style={{opacity:isCancelled?0.6:1}}><td><div style={{fontWeight:600}}>{cust?.name||order.customer_name||"Guest"}</div><div style={{fontSize:12,color:"var(--text-tertiary)"}}>{cust?.email||order.customer_email}</div></td><td>{ois.map(oi=><div key={oi.id} style={{fontSize:13}}>{oi.quantity}× {oi.item_name}</div>)}</td>{drop.use_pickup_windows&&<td style={{fontSize:13,whiteSpace:"nowrap"}}>{orderWindow?formatWindow(orderWindow):<span style={{color:"var(--text-tertiary)"}}>—</span>}</td>}<td style={{fontWeight:600,textDecoration:isCancelled?"line-through":"none",color:isCancelled?"var(--text-tertiary)":"var(--text)"}}>{fmt(order.total)}</td><td><span className={`badge badge-${order.status}`}>{order.status==="picked_up"?"Picked Up":order.status==="cancelled"?"Cancelled":"Confirmed"}</span>{order.payment_status==="unpaid"&&<span className="badge" style={{background:"var(--red-light)",color:"var(--red)",marginLeft:4,fontSize:11}}>💳 Unpaid</span>}</td><td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{order.status==="confirmed"&&<><button className="btn btn-sm btn-secondary" onClick={()=>onUpdateOrderStatus(order.id,"picked_up")}>{I.check} Picked Up</button>{order.payment_status==="unpaid"&&<button className="btn btn-sm btn-ghost" onClick={()=>onMarkPaid(order.id)} style={{color:"var(--green)"}}>💳 Mark Paid</button>}<button className="btn btn-sm btn-ghost" onClick={()=>onEditOrder(order)}>{I.edit} Edit</button><button className="btn btn-sm btn-ghost" onClick={()=>onUpdateOrderStatus(order.id,"cancelled")} style={{color:"var(--red)"}}>Cancel</button></>}{order.status==="picked_up"&&<><button className="btn btn-sm btn-ghost" onClick={()=>onUpdateOrderStatus(order.id,"confirmed")}>{I.undo} Undo Pickup</button><button className="btn btn-sm btn-ghost" onClick={()=>onEditOrder(order)}>{I.edit} Edit</button></>}{order.status==="cancelled"&&<button className="btn btn-sm btn-ghost" onClick={()=>onUpdateOrderStatus(order.id,"confirmed")}>{I.undo} Restore</button>}</div></td></tr>)})}</tbody></table></div>
      )}
    </div>)}

    {/* Pickup Checklist View */}
    {view==="pickup"&&(<div className="page-enter">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2>Pickup Checklist</h2><button className="btn btn-secondary btn-sm" onClick={handlePrint}>{I.print} Print</button></div>
      <p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:16}}>Tap to check off customers as they pick up their orders.</p>
      {activeDO.length===0?<div className="empty-state"><p>No orders to check off.</p></div>:(() => {
        // Render a single order row (reused whether we're grouping or not)
        const renderRow = (order) => {
          const cust = customers.find(c => c.id === order.customer_id);
          const ois = getOrderItems(order.id);
          const status = getOrderStatus(order);
          const isChecked = status === "picked_up";
          return (
            <div key={order.id} className={`pickup-item ${isChecked?"checked":""}`}>
              <div className={`pickup-item-check ${isChecked?"checked":""}`} onClick={()=>togglePickup(order.id, status)}>
                {isChecked && <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div className="pickup-item-info">
                <div className="pickup-item-name" style={{textDecoration:isChecked?"line-through":"none",opacity:isChecked?.6:1}}>{cust?.name||order.customer_name||"Guest"}{order.payment_status==="unpaid"&&<span className="badge" style={{background:"var(--red-light)",color:"var(--red)",fontSize:10,marginLeft:6}}>💳 Unpaid</span>}</div>
                <div className="pickup-item-items">{ois.map(oi=>`${oi.quantity}× ${oi.item_name}`).join(", ")}</div>
              </div>
              <div className="pickup-item-total" style={{opacity:isChecked?.6:1}}>{fmt(order.total)}</div>
            </div>
          );
        };
        // v26: if drop uses windows, group by window (sorted by start time).
        // Orders without a window id (legacy or manual) fall into "Unassigned".
        if (drop.use_pickup_windows && Array.isArray(drop.pickup_windows) && drop.pickup_windows.length) {
          const sortedWindows = [...drop.pickup_windows].sort((a,b) => (a.start||"").localeCompare(b.start||""));
          const unassigned = activeDO.filter(o => !o.pickup_window_id || !sortedWindows.find(w=>w.id===o.pickup_window_id));
          return (
            <div>
              {sortedWindows.map(w => {
                const wOrders = activeDO.filter(o => o.pickup_window_id === w.id);
                if (!wOrders.length) return null;
                return (
                  <div key={w.id} style={{marginBottom:20}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)",marginBottom:8,padding:"0 4px"}}>
                      🕐 {formatWindow(w)} · {wOrders.length} order{wOrders.length!==1?"s":""}
                    </div>
                    <div className="pickup-list">{wOrders.map(renderRow)}</div>
                  </div>
                );
              })}
              {unassigned.length > 0 && (
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text-tertiary)",marginBottom:8,padding:"0 4px"}}>
                    Unassigned · {unassigned.length} order{unassigned.length!==1?"s":""}
                  </div>
                  <div className="pickup-list">{unassigned.map(renderRow)}</div>
                </div>
              )}
            </div>
          );
        }
        // No windows — original flat list
        return <div className="pickup-list">{activeDO.map(renderRow)}</div>;
      })()}
      <div style={{marginTop:16,padding:12,background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",fontSize:13,color:"var(--text-secondary)",textAlign:"center"}}>
        {dO.filter(o=>getOrderStatus(o)==="picked_up").length} of {activeDO.length} picked up · {fmt(activeDO.filter(o=>getOrderStatus(o)==="picked_up").reduce((s,o)=>s+Number(o.total),0))} collected
      </div>
    </div>)}
  </>);
}

// ============================================================
// CUSTOMERS TAB + DETAIL — Enhanced CRM v7
// ============================================================
// ============================================================
// v28a: PRODUCTS TAB — creator product library
// ============================================================
function ProductsTab({ products, dropItems, onNew, onEdit, onArchive, onUnarchive, onDeletePermanently }) {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);

  const visible = products.filter(p => {
    if (!showArchived && p.archived) return false;
    if (activeTag && !(p.tags || []).includes(activeTag)) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.name.toLowerCase().includes(s) || (p.description || "").toLowerCase().includes(s) || (p.sku || "").toLowerCase().includes(s);
    }
    return true;
  });

  const archivedCount = products.filter(p => p.archived).length;
  // Gather all distinct tags across visible-ish products (include archived if showing)
  const allTags = [...new Set(products.flatMap(p => p.tags || []))].sort();

  return (<>
    <div className="section-header">
      <div>
        <h1>Products</h1>
        <p style={{color:"var(--text-secondary)",fontSize:14,marginTop:4}}>Your reusable product library. Pull from here when building drops.</p>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        {archivedCount > 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setShowArchived(!showArchived)}>{I.archive} {showArchived ? "Hide" : "Show"} Archived ({archivedCount})</button>}
        <button className="btn btn-primary" onClick={onNew}>{I.plus} New Product</button>
      </div>
    </div>

    {products.length > 0 && (
      <div style={{marginBottom:16,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <div className="search-bar" style={{flex:"1 1 240px",maxWidth:320,marginBottom:0}}>
          {I.search}
          <input placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {allTags.length > 0 && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <button
              className="drop-item-chip"
              onClick={()=>setActiveTag(null)}
              style={{cursor:"pointer",background:activeTag===null?"var(--accent-light)":"var(--surface-alt)",color:activeTag===null?"var(--accent)":"var(--text-secondary)",borderColor:activeTag===null?"var(--accent)":"var(--border)"}}>
              All
            </button>
            {allTags.map(t => (
              <button
                key={t}
                className="drop-item-chip"
                onClick={()=>setActiveTag(activeTag===t?null:t)}
                style={{cursor:"pointer",background:activeTag===t?"var(--accent-light)":"var(--surface-alt)",color:activeTag===t?"var(--accent)":"var(--text-secondary)",borderColor:activeTag===t?"var(--accent)":"var(--border)"}}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    )}

    {products.length === 0 ? (
      <div className="empty-state">
        <div className="empty-state-icon">{I.image}</div>
        <h3>No products yet</h3>
        <p style={{marginTop:8,maxWidth:420,margin:"8px auto 0"}}>Add your signature items here to reuse them across drops — name, photo, price, and description stay ready to pull in.</p>
      </div>
    ) : visible.length === 0 ? (
      <div className="empty-state">
        <p>No products match your filters.</p>
      </div>
    ) : (
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {visible.map(product => {
          const isArchived = product.archived;
          const pos = product.image_data ? `${product.image_data.x}% ${product.image_data.y}%` : "50% 50%";
          return (
            <div key={product.id} className="card card-hover" onClick={()=>onEdit(product)} style={{opacity:isArchived?.6:1,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                  <span style={{fontWeight:600,fontSize:14,color:"var(--text)"}}>{product.name}</span>
                  {isArchived && <span className="badge badge-archived" style={{fontSize:11}}>Archived</span>}
                </div>
                <div style={{fontSize:13,fontWeight:600,color:"var(--accent)"}}>{fmt(product.price)}</div>
                {(product.tags||[]).length > 0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                    {(product.tags||[]).slice(0,5).map(t=><span key={t} className="drop-item-chip" style={{fontSize:11,padding:"2px 8px"}}>{t}</span>)}
                  </div>
                )}
              </div>
              <div style={{width:52,height:52,flexShrink:0,borderRadius:"var(--radius-sm)",overflow:"hidden",background:product.image_url?`url(${product.image_url})`:"var(--surface-alt)",backgroundSize:"cover",backgroundPosition:pos,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-tertiary)"}}>
                {!product.image_url && I.image}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>);
}

function CustomersTab({ customers, orders, drops, getDropOrders, onAddCustomer, onCompose, onSelectCustomer, onImport, onBulkDelete }) {
  const [copied, setCopied] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [expandedDrops, setExpandedDrops] = useState(null);
  const [showColPanel, setShowColPanel] = useState(false);
  const [cols, setCols] = useState({ email: true, phone: true, pref: true, drops: true, activeDrop: true, orders: true, spent: true, notes: false, since: false, optedIn: false });
  const toggleCol = (key) => setCols(p => ({...p, [key]: !p[key]}));
  const activeDrops = drops.filter(d => d.status === "active" && !d.archived);
  const latestActiveDrop = activeDrops[0];
  const nonArchivedDrops = drops.filter(d => !d.archived);

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
    if (type === "email") { navigator.clipboard?.writeText(selEmails.map(c=>c.email).join(", ")); setCopied("sel-email"); }
    else { navigator.clipboard?.writeText(selSms.map(c=>`${c.name}: ${c.phone}`).join("\n")); setCopied("sel-sms"); }
    setTimeout(()=>setCopied(null),2500);
  };
  const copyEmails = () => { navigator.clipboard?.writeText(emailCustomers.map(c=>c.email).join(", ")); setCopied("email"); setTimeout(()=>setCopied(null),2500); };
  const copySmsNumbers = () => { navigator.clipboard?.writeText(smsCustomers.map(c=>`${c.name}: ${c.phone}`).join("\n")); setCopied("sms"); setTimeout(()=>setCopied(null),2500); };

  const exportCSV = () => {
    const header = "Name,Email,Phone,Preferred Contact,Notes,Total Orders,Total Spent";
    const rows = customers.map(c => { const cO=orders.filter(o=>o.customer_id===c.id&&o.status!=="cancelled"); return `"${c.name||""}","${c.email||""}","${c.phone||""}","${c.prefer_contact||""}","${(c.notes||"").replace(/"/g,'""')}",${cO.length},${cO.reduce((s,o)=>s+Number(o.total),0).toFixed(2)}`; });
    const blob = new Blob([[header,...rows].join("\n")], { type: "text/csv" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="customers.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const getDropOrderStatus = (customerId) => {
    if (!latestActiveDrop) return null;
    return orders.filter(o => o.drop_id === latestActiveDrop.id && o.status !== "cancelled").some(o => o.customer_id === customerId);
  };

  // Get which drops a customer has participated in
  const getCustomerDrops = (customerId) => {
    const dropIds = [...new Set(orders.filter(o => o.customer_id === customerId && o.status !== "cancelled").map(o => o.drop_id))];
    return nonArchivedDrops.filter(d => dropIds.includes(d.id));
  };

  return (<>
    <div className="section-header"><div><h1>Customers</h1><p style={{color:"var(--text-secondary)",marginTop:4}}>{customers.length} customer{customers.length!==1?"s":""} · {emailCustomers.length} email, {smsCustomers.length} SMS</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="btn btn-secondary btn-sm" onClick={onImport}>{I.upload} Import CSV</button><button className="btn btn-secondary btn-sm" onClick={exportCSV}>{I.download} Export CSV</button><button className="btn btn-secondary btn-sm" onClick={onCompose}>{I.send} Compose</button><button className="btn btn-primary" onClick={onAddCustomer}>{I.plus} Add</button></div></div>

    {customers.length > 0 && (
      <div className="card" style={{marginBottom:16,padding:12,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)"}}>Quick:</span>
        {emailCustomers.length > 0 && <button className="btn btn-secondary btn-sm" onClick={copyEmails}>{copied==="email"?<>{I.check} Copied!</>:<>{I.mail} All {emailCustomers.length} Emails</>}</button>}
        {smsCustomers.length > 0 && <button className="btn btn-secondary btn-sm" onClick={copySmsNumbers}>{copied==="sms"?<>{I.check} Copied!</>:<>{I.phone} All {smsCustomers.length} SMS</>}</button>}
      </div>
    )}

    {customers.length > 3 && <div className="search-bar">{I.search}<input placeholder="Search by name, email, phone, or notes..." value={search} onChange={e=>setSearch(e.target.value)}/></div>}

    {/* Column toggle */}
    {customers.length > 0 && (
      <div style={{marginBottom:12}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowColPanel(!showColPanel)}>{I.columns} {showColPanel?"Hide":"Show"} Columns</button>
        {showColPanel && (
          <div className="col-toggle-panel" style={{marginTop:8}}>
            <span className="col-toggle-label">Show:</span>
            {[{key:"email",label:"Email"},{key:"phone",label:"Phone"},{key:"pref",label:"Preferred"},{key:"drops",label:"Drops"},{key:"activeDrop",label:"Active Drop Status"},{key:"orders",label:"Order Count"},{key:"spent",label:"Total Spent"},{key:"notes",label:"Notes"},{key:"since",label:"Customer Since"},{key:"optedIn",label:"Opted In"}].map(col=>(
              <label key={col.key} className="col-toggle"><input type="checkbox" checked={cols[col.key]} onChange={()=>toggleCol(col.key)}/>{col.label}</label>
            ))}
          </div>
        )}
      </div>
    )}

    {selected.length > 0 && (
      <div className="bulk-bar"><div className="bulk-bar-count">{selected.length} selected</div><div className="bulk-bar-actions">
        {selEmails.length > 0 && <button className="btn btn-secondary btn-sm" onClick={()=>copySelected("email")}>{copied==="sel-email"?<>{I.check} Copied!</>:<>{I.mail} {selEmails.length} Email{selEmails.length!==1?"s":""}</>}</button>}
        {selSms.length > 0 && <button className="btn btn-secondary btn-sm" onClick={()=>copySelected("sms")}>{copied==="sel-sms"?<>{I.check} Copied!</>:<>{I.phone} {selSms.length} Phone{selSms.length!==1?"s":""}</>}</button>}
        <button className="btn btn-danger btn-sm" onClick={()=>onBulkDelete(selected)}>{I.trash} Delete {selected.length}</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>setSelected([])}>Clear</button>
      </div></div>
    )}

    {filtered.length===0 && customers.length > 0 ? (<div className="empty-state"><p>No customers match "{search}"</p></div>) :
    filtered.length===0?(<div className="empty-state"><div className="empty-state-icon">{I.users}</div><h3>No customers yet</h3><p style={{marginTop:8}}>Add customers manually, import from CSV, or they'll appear when they place orders.</p></div>):(
      <div className="table-wrap"><table><thead><tr><th style={{width:40}}><input type="checkbox" checked={selected.length===filtered.length&&filtered.length>0} onChange={toggleAll} style={{accentColor:"var(--accent)",width:16,height:16}}/></th><th>Name</th>{cols.email&&<th>Email</th>}{cols.phone&&<th>Phone</th>}{cols.pref&&<th>Pref</th>}{cols.drops&&<th>Drops</th>}{cols.activeDrop&&latestActiveDrop&&<th style={{maxWidth:100}}>{latestActiveDrop.title.length > 12 ? latestActiveDrop.title.slice(0,12)+"…" : latestActiveDrop.title}</th>}{cols.orders&&<th>Orders</th>}{cols.spent&&<th>Spent</th>}{cols.since&&<th>Since</th>}{cols.optedIn&&<th>Opted In</th>}</tr></thead><tbody>{filtered.map(c=>{const cO=orders.filter(o=>o.customer_id===c.id&&o.status!=="cancelled");const dropStatus=getDropOrderStatus(c.id);const custDrops=getCustomerDrops(c.id);const isSelected=selected.includes(c.id);const isExpanded=expandedDrops===c.id;return(<tr key={c.id} style={{background:isSelected?"var(--accent-light)":"transparent"}}><td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(c.id)} style={{accentColor:"var(--accent)",width:16,height:16}}/></td><td style={{cursor:"pointer"}} onClick={()=>onSelectCustomer(c)}><div style={{fontWeight:600}}>{c.name}</div>{cols.notes&&c.notes&&<div style={{fontSize:11,color:"var(--text-tertiary)",marginTop:2,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.notes}>📝 {c.notes}</div>}</td>{cols.email&&<td style={{cursor:"pointer",fontSize:13}} onClick={()=>onSelectCustomer(c)}>{c.email}</td>}{cols.phone&&<td style={{cursor:"pointer",fontSize:13,color:c.phone?"var(--text)":"var(--text-tertiary)"}} onClick={()=>onSelectCustomer(c)}>{c.phone||"—"}</td>}{cols.pref&&<td style={{cursor:"pointer"}} onClick={()=>onSelectCustomer(c)}><span className={`badge ${c.prefer_contact==="sms"?"badge-fcfs":"badge-preorder"}`} style={{fontSize:11}}>{c.prefer_contact==="sms"?"SMS":"Email"}</span></td>}{cols.drops&&<td className="drops-cell" onClick={e=>e.stopPropagation()}>{custDrops.length===0?<span style={{fontSize:12,color:"var(--text-tertiary)"}}>—</span>:<><button className="drops-toggle" onClick={()=>setExpandedDrops(isExpanded?null:c.id)}>{custDrops.length} drop{custDrops.length!==1?"s":""} {isExpanded?"▴":"▾"}</button>{isExpanded&&<div className="drops-expand">{custDrops.map(d=><div key={d.id} className="drops-expand-item">{d.title} · {fmtDate(d.pickup_date)}</div>)}</div>}</>}</td>}{cols.activeDrop&&latestActiveDrop&&<td style={{cursor:"pointer"}} onClick={()=>onSelectCustomer(c)}>{dropStatus===null?"":<span className={`badge ${dropStatus?"badge-active":"badge-cancelled"}`} style={{fontSize:11}}>{dropStatus?"Ordered":"Not yet"}</span>}</td>}{cols.orders&&<td style={{cursor:"pointer"}} onClick={()=>onSelectCustomer(c)}>{cO.length}</td>}{cols.spent&&<td style={{cursor:"pointer",fontWeight:500}} onClick={()=>onSelectCustomer(c)}>{fmt(cO.reduce((s,o)=>s+Number(o.total),0))}</td>}{cols.since&&<td style={{cursor:"pointer",fontSize:12}} onClick={()=>onSelectCustomer(c)}>{c.created_at?fmtDate(c.created_at.slice(0,10)):"—"}</td>}{cols.optedIn&&<td style={{cursor:"pointer"}} onClick={()=>onSelectCustomer(c)}><span className={`badge ${c.opted_in!==false?"badge-active":"badge-cancelled"}`} style={{fontSize:11}}>{c.opted_in!==false?"Yes":"No"}</span></td>}</tr>)})}</tbody></table></div>
    )}

    {latestActiveDrop && customers.length > 0 && (() => {
      const notOrdered = customers.filter(c => getDropOrderStatus(c.id) === false);
      if (notOrdered.length === 0) return null;
      const notOrderedEmails = notOrdered.filter(c => c.prefer_contact === "email");
      const notOrderedSms = notOrdered.filter(c => c.prefer_contact === "sms");
      return (
        <div className="card" style={{marginTop:20,borderLeft:"4px solid var(--gold)"}}>
          <div><h3 style={{color:"var(--gold)"}}>Haven't ordered "{latestActiveDrop.title}" yet</h3><p style={{fontSize:13,color:"var(--text-secondary)",marginTop:4}}>{notOrdered.length} customer{notOrdered.length!==1?"s":""}.</p></div>
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            {notOrderedEmails.length > 0 && <button className="btn btn-secondary btn-sm" onClick={()=>{navigator.clipboard?.writeText(notOrderedEmails.map(c=>c.email).join(", "));setCopied("nudge-email");setTimeout(()=>setCopied(null),2500)}}>{copied==="nudge-email"?<>{I.check} Copied!</>:<>{I.mail} {notOrderedEmails.length} email{notOrderedEmails.length!==1?"s":""}</>}</button>}
            {notOrderedSms.length > 0 && <button className="btn btn-secondary btn-sm" onClick={()=>{navigator.clipboard?.writeText(notOrderedSms.map(c=>`${c.name}: ${c.phone}`).join("\n"));setCopied("nudge-sms");setTimeout(()=>setCopied(null),2500)}}>{copied==="nudge-sms"?<>{I.check} Copied!</>:<>{I.phone} {notOrderedSms.length} SMS</>}</button>}
          </div>
        </div>
      );
    })()}
  </>);
}

function CustomerDetail({ customer, orders, drops, customers, getOrderItems, onBack, onEdit, onDelete, onMerge }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const custOrders = orders.filter(o => o.customer_id === customer.id);
  const nonCancelled = custOrders.filter(o => o.status !== "cancelled");
  const totalSpent = nonCancelled.reduce((s, o) => s + Number(o.total), 0);

  const sourceLabel = { order: "Ordered", signup_form: "Signed up", manual: "Added manually" };
  const sourceBadgeClass = { order: "badge-active", signup_form: "badge-preorder", manual: "badge-confirmed" };

  return (<>
    <button className="btn btn-ghost" onClick={onBack} style={{marginBottom:16}}>{I.back} Back to Customers</button>
    <div className="cust-detail-panel">
      <div className="cust-detail-header">
        <div>
          <h1>{customer.name}</h1>
          <div style={{display:"flex",gap:16,marginTop:8,fontSize:14,color:"var(--text-secondary)",flexWrap:"wrap"}}>
            <span style={{display:"flex",alignItems:"center",gap:6}}>{I.mail} {customer.email}</span>
            {customer.phone&&<span style={{display:"flex",alignItems:"center",gap:6}}>{I.phone} {customer.phone}</span>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <span className={`badge ${customer.prefer_contact==="sms"?"badge-fcfs":"badge-preorder"}`}>Prefers {customer.prefer_contact==="sms"?"SMS":"Email"}</span>
            {customer.signup_source && (
              <span className={`badge ${sourceBadgeClass[customer.signup_source]||"badge-confirmed"}`} style={{fontSize:11}}>
                {sourceLabel[customer.signup_source]||customer.signup_source}
              </span>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>setShowMerge(!showMerge)}>{I.users} Merge</button>
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

      {/* Merge tool */}
      {showMerge && (
        <MergeCustomerPanel
          customer={customer}
          allCustomers={customers}
          onMerge={(targetId) => { onMerge(customer.id, targetId); setShowMerge(false); }}
          onCancel={() => setShowMerge(false)}
        />
      )}

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
      <div className="cust-order-timeline">{custOrders.map(order=>{const drop=drops.find(d=>d.id===order.drop_id);const ois=getOrderItems(order.id);return(<div key={order.id} className="cust-order-item"><div className="cust-order-dot"/><div className="card" style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div><h3>{drop?.title||"Unknown Drop"}</h3><div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>{drop?`${fmtDate(drop.pickup_date)}, ${drop.pickup_time}`:""}</div></div><span className={`badge badge-${order.status}`}>{order.status==="picked_up"?"Picked Up":order.status==="cancelled"?"Cancelled":"Confirmed"}</span></div>{ois.map(oi=>(<div key={oi.id} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"4px 0"}}><span>{oi.quantity}× {oi.item_name}</span><span style={{color:"var(--text-secondary)"}}>{fmt(oi.item_price*oi.quantity)}</span></div>))}<div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)",fontWeight:600}}><span>Total</span><span style={{textDecoration:order.status==="cancelled"?"line-through":"none",color:order.status==="cancelled"?"var(--text-tertiary)":"var(--text)"}}>{fmt(order.total)}</span></div></div></div>)})}</div>
    )}
  </>);
}

// Merge customer panel — shown inline in CustomerDetail
function MergeCustomerPanel({ customer, allCustomers, onMerge, onCancel }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const candidates = allCustomers.filter(c =>
    c.id !== customer.id &&
    (c.name.toLowerCase().includes(search.toLowerCase()) ||
     c.email.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  return (
    <div style={{background:"var(--gold-light)",border:"1px solid #f0dca0",borderRadius:"var(--radius-sm)",padding:16,marginBottom:16}}>
      <div style={{fontWeight:600,fontSize:15,marginBottom:4,color:"var(--gold)"}}>Merge duplicate customer</div>
      <p style={{fontSize:13,color:"var(--text-secondary)",marginBottom:12}}>
        Find the duplicate entry below. All orders from that record will be moved to <strong>{customer.name}</strong>, and the duplicate will be deleted.
      </p>
      <input
        className="form-input"
        placeholder="Search by name or email..."
        value={search}
        onChange={e=>setSearch(e.target.value)}
        style={{marginBottom:8}}
        autoFocus
      />
      {search && candidates.length === 0 && (
        <div style={{fontSize:13,color:"var(--text-tertiary)",padding:"8px 0"}}>No matches found.</div>
      )}
      {candidates.map(c => (
        <div
          key={c.id}
          onClick={()=>setSelected(selected?.id===c.id?null:c)}
          style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:"var(--radius-sm)",background:selected?.id===c.id?"var(--accent-light)":"var(--surface)",border:`1px solid ${selected?.id===c.id?"var(--accent)":"var(--border)"}`,marginBottom:6,cursor:"pointer"}}
        >
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14}}>{c.name}</div>
            <div style={{fontSize:12,color:"var(--text-secondary)"}}>{c.email}{c.phone?` · ${c.phone}`:""}</div>
          </div>
          {selected?.id===c.id && <span style={{fontSize:12,color:"var(--accent)",fontWeight:600}}>Selected</span>}
        </div>
      ))}
      {selected && (
        <div style={{marginTop:12,padding:12,background:"var(--surface)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",fontSize:13,color:"var(--text-secondary)"}}>
          <strong style={{color:"var(--text)"}}>Confirm:</strong> Move all orders from <strong>{selected.name}</strong> ({selected.email}) into <strong>{customer.name}</strong>'s record and delete the duplicate.
        </div>
      )}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button className="btn btn-danger btn-sm" disabled={!selected} onClick={()=>onMerge(selected.id)}>
          {I.users} Merge into {customer.name}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS TAB
// ============================================================
function SettingsTab({ creator, onEditProfile, onSaveWelcomeEmail, session, showToast }) {
  const customerUrl = `${window.location.origin}${window.location.pathname}#/${creator?.slug || ""}`;
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Welcome email state
  const [logoUrl, setLogoUrl] = useState(creator?.logo_data?.url || creator?.logo_url || "");
  const [logoPan, setLogoPan] = useState({ x: creator?.logo_data?.x ?? 50, y: creator?.logo_data?.y ?? 50 });
  const [welcomePhotoUrl, setWelcomePhotoUrl] = useState(creator?.welcome_photo_data?.url || creator?.welcome_photo_url || "");
  const [welcomePhotoPan, setWelcomePhotoPan] = useState({ x: creator?.welcome_photo_data?.x ?? 50, y: creator?.welcome_photo_data?.y ?? 50 });
  const [bio, setBio] = useState(creator?.bio || "");
  const [howDropsWork, setHowDropsWork] = useState(creator?.how_drops_work || "");
  const [instagram, setInstagram] = useState(creator?.social_links?.instagram || "");
  const [facebook, setFacebook] = useState(creator?.social_links?.facebook || "");
  const [tiktok, setTiktok] = useState(creator?.social_links?.tiktok || "");
  const [savingWelcome, setSavingWelcome] = useState(false);

  const handleSaveWelcome = async () => {
    setSavingWelcome(true);
    await onSaveWelcomeEmail({
      logoUrl, logoPan, welcomePhotoUrl, welcomePhotoPan, bio, howDropsWork,
      socialLinks: { instagram, facebook, tiktok },
    });
    setSavingWelcome(false);
  };

  const welcomeComplete = !!(bio);

  const handleChangeEmail = async () => {
    if (!newEmail) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser(session.access_token, { email: newEmail });
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Email update requested. Check your new email for confirmation.");
    setNewEmail("");
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) { showToast("Passwords don't match", "error"); return; }
    if (newPassword.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser(session.access_token, { password: newPassword });
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Password updated successfully!");
    setNewPassword(""); setConfirmPassword("");
  };

  const themeKey = creator?.theme?.key || "terracotta";
  const themeAccent = creator?.theme?.accent || THEMES.terracotta.accent;
  const themeName = THEMES[themeKey]?.name || "Custom";

  return (<>
    <div style={{marginBottom:28}}><h1>Settings</h1><p style={{color:"var(--text-secondary)",marginTop:4}}>Manage your storefront and account</p></div>

    {/* Storefront Profile */}
    <div className="card" style={{maxWidth:600,marginBottom:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}><h2>Storefront Profile</h2><button className="btn btn-secondary btn-sm" onClick={onEditProfile}>{I.edit} Edit</button></div>
      <div className="form-group"><label className="form-label">Business Name</label><div style={{fontSize:16,fontWeight:600}}>{creator?.name||"Not set"}</div></div>
      <div className="form-group"><label className="form-label">Tagline</label><div style={{fontSize:14,color:"var(--text-secondary)"}}>{creator?.tagline||"Not set"}</div></div>
      <div className="form-group"><label className="form-label">Your Page URL</label><div style={{fontSize:14,fontWeight:500,color:"var(--accent)",wordBreak:"break-all"}}>{customerUrl}</div><div className="form-hint">Share this link with your customers</div></div>
      <div className="form-group"><label className="form-label">URL Slug</label><div style={{fontSize:14,fontWeight:500}}>{creator?.slug||"Not set"}</div></div>
      <div style={{marginTop:8}}>
        <label className="form-label">{I.palette} Storefront Theme</label>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"var(--surface-alt)",borderRadius:"var(--radius-sm)"}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:themeAccent,flexShrink:0}}/>
          <div><div style={{fontWeight:600,fontSize:14}}>{themeName}</div><div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>Click Edit to change theme or upload a hero image</div></div>
          {creator?.hero_image_url && <img src={creator.hero_image_url} alt="" style={{width:48,height:32,objectFit:"cover",borderRadius:6,marginLeft:"auto",flexShrink:0}}/>}
        </div>
      </div>
    </div>

    {/* Welcome Email */}
    <div className="card" id="welcome-email-section" style={{maxWidth:600,marginBottom:24,borderLeft: welcomeComplete ? "4px solid var(--green)" : "4px solid var(--gold)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <h2 style={{marginBottom:4}}>Welcome Email</h2>
          <p style={{fontSize:13,color:"var(--text-secondary)"}}>
            New customers receive this email within 1 hour of their first order or signup — automatically, in your voice.
          </p>
        </div>
        {welcomeComplete
          ? <span className="badge badge-active" style={{flexShrink:0,marginLeft:12}}>✓ Set up</span>
          : <span className="badge badge-confirmed" style={{flexShrink:0,marginLeft:12}}>Incomplete</span>
        }
      </div>

      {/* Guidance callout */}
      <div style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:"14px 16px",marginBottom:20,fontSize:13,color:"var(--text-secondary)",lineHeight:1.6}}>
        <strong style={{color:"var(--text)",display:"block",marginBottom:4}}>What to include</strong>
        Think of this as your first impression — a personal note from you to someone who just discovered your food. Tell them who you are, what drives you to cook, and what they can expect from ordering with you. The more genuine and personal it feels, the more likely they are to order again.
      </div>

      {/* Logo */}
      <ImageUpload value={logoUrl} onChange={setLogoUrl} panValue={logoPan} onPanChange={setLogoPan} label="Your Logo (optional)" frameRatio="circle"/>

      {/* Welcome photo */}
      <ImageUpload value={welcomePhotoUrl} onChange={setWelcomePhotoUrl} panValue={welcomePhotoPan} onPanChange={setWelcomePhotoPan} label="Photo of You or Your Food (optional)" frameRatio="4:3"/>

      {/* Bio */}
      <div className="form-group">
        <label className="form-label">Your Introduction {!bio && <span style={{color:"var(--gold)",fontSize:11,fontWeight:400,marginLeft:4}}>Required</span>}</label>
        <textarea
          className="form-textarea"
          rows={6}
          placeholder={"Introduce yourself — who you are, where you cook, and what drives you to make food. Share the story behind your business. Your customers want to connect with the person behind the food, not just the menu.\n\nAim for 1–3 paragraphs in your own voice. Don't overthink it — write like you'd talk to a friend."}
          value={bio}
          onChange={e=>setBio(e.target.value)}
          style={{minHeight:140}}
        />
      </div>

      {/* How drops work */}
      <div className="form-group">
        <label className="form-label">How Your Drops Work</label>
        <textarea
          className="form-textarea"
          rows={4}
          placeholder={"Explain your rhythm in your own words — how often you drop, how long orders stay open, and where/when pickup happens.\n\nExample: \"I post a new drop every other Friday. Orders are open for 48 hours or until things sell out. Pickup is Sunday 12–3pm in Somerville.\""}
          value={howDropsWork}
          onChange={e=>setHowDropsWork(e.target.value)}
          style={{minHeight:100}}
        />
      </div>

      {/* Social links */}
      <div style={{marginBottom:20}}>
        <label className="form-label">Social Links (optional)</label>
        <div style={{display:"grid",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,color:"var(--text-secondary)",width:80,flexShrink:0}}>Instagram</span>
            <input className="form-input" placeholder="@yourbusiness" value={instagram} onChange={e=>setInstagram(e.target.value)}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,color:"var(--text-secondary)",width:80,flexShrink:0}}>Facebook</span>
            <input className="form-input" placeholder="facebook.com/yourpage" value={facebook} onChange={e=>setFacebook(e.target.value)}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,color:"var(--text-secondary)",width:80,flexShrink:0}}>TikTok</span>
            <input className="form-input" placeholder="@yourbusiness" value={tiktok} onChange={e=>setTiktok(e.target.value)}/>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" disabled={!bio||savingWelcome} onClick={handleSaveWelcome}>
        {savingWelcome ? "Saving..." : welcomeComplete ? "Update Welcome Email" : "Save Welcome Email"}
      </button>
      {!bio && <div className="form-hint" style={{marginTop:8}}>Add your introduction above to save — it's the only required field.</div>}
    </div>

    {/* Account Settings */}
    <div className="card" style={{maxWidth:600,marginBottom:24}}>
      <h2 style={{marginBottom:20}}>Account</h2>
      <div className="form-group"><label className="form-label">Current Email</label><div style={{fontSize:14,fontWeight:500}}>{session?.user?.email||"Unknown"}</div></div>
      <div style={{borderTop:"1px solid var(--border)",paddingTop:20,marginTop:8}}>
        <h3 style={{marginBottom:12}}>Change Email</h3>
        <div className="form-group"><label className="form-label">New Email</label><input className="form-input" type="email" placeholder="newemail@example.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)}/></div>
        <button className="btn btn-secondary btn-sm" disabled={!newEmail||saving} onClick={handleChangeEmail}>{saving?"Updating...":"Update Email"}</button>
      </div>
      <div style={{borderTop:"1px solid var(--border)",paddingTop:20,marginTop:20}}>
        <h3 style={{marginBottom:12}}>Change Password</h3>
        <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" placeholder="At least 6 characters" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Confirm Password</label><input className="form-input" type="password" placeholder="Type it again" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></div>
        <button className="btn btn-secondary btn-sm" disabled={!newPassword||!confirmPassword||saving} onClick={handleChangePassword}>{saving?"Updating...":"Update Password"}</button>
      </div>
    </div>
  </>);
}

// ============================================================
// CONFIRMATION MODALS — Bulk Delete Customers + Permanent Drop Delete
// ============================================================
function BulkDeleteCustomersModal({ count, onConfirm, onClose }) {
  const [step, setStep] = useState("warn"); // warn → choose
  const [choice, setChoice] = useState(null); // "keep" | "delete"

  if (step === "warn") return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2 style={{color:"var(--red)"}}>Delete {count} Customer{count!==1?"s":""}?</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <p style={{fontSize:15,marginBottom:20}}>This will permanently remove <strong>{count} customer{count!==1?"s":""}</strong> from your database. This cannot be undone.</p>
      <p style={{fontSize:14,color:"var(--text-secondary)",marginBottom:24}}>What should happen to their order history?</p>
      <div style={{display:"grid",gap:10,marginBottom:24}}>
        <label style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",border:`2px solid ${choice==="keep"?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",cursor:"pointer",background:choice==="keep"?"var(--accent-light)":"var(--surface)"}} onClick={()=>setChoice("keep")}>
          <input type="radio" checked={choice==="keep"} onChange={()=>setChoice("keep")} style={{marginTop:2,accentColor:"var(--accent)"}}/>
          <div><div style={{fontWeight:600}}>Keep order history</div><div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>Past orders remain in drop records as guest orders. Revenue data is preserved.</div></div>
        </label>
        <label style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",border:`2px solid ${choice==="delete"?"var(--red)":"var(--border)"}`,borderRadius:"var(--radius-sm)",cursor:"pointer",background:choice==="delete"?"var(--red-light)":"var(--surface)"}} onClick={()=>setChoice("delete")}>
          <input type="radio" checked={choice==="delete"} onChange={()=>setChoice("delete")} style={{marginTop:2,accentColor:"var(--red)"}}/>
          <div><div style={{fontWeight:600,color:"var(--red)"}}>Delete everything</div><div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>Customer records and all associated orders are permanently deleted. Revenue data will change.</div></div>
        </label>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" disabled={!choice} onClick={()=>onConfirm(choice==="delete")}>Delete {count} Customer{count!==1?"s":""}</button>
      </div>
    </div></div>
  );
}

// v28a: Product form (create or edit)
function ProductFormModal({ mode, product, onSave, onClose, allExistingTags, onArchive, onUnarchive, onDelete }) {
  const [name, setName] = useState(product?.name || "");
  const [desc, setDesc] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [sku, setSku] = useState(product?.sku || "");
  const [imageUrl, setImageUrl] = useState(product?.image_data?.url || product?.image_url || "");
  const [imagePan, setImagePan] = useState({ x: product?.image_data?.x ?? 50, y: product?.image_data?.y ?? 50 });
  const [tags, setTags] = useState(product?.tags || []);
  const [tagQuery, setTagQuery] = useState("");
  const [tagAcOpen, setTagAcOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = name && price && !saving;
  const handleSave = async () => {
    setSaving(true);
    await onSave({ name, description: desc, price, sku, imageUrl, imagePan, tags });
    setSaving(false);
  };

  const addTag = (t) => { const tr = t.trim(); if (tr && !tags.includes(tr)) setTags(prev=>[...prev,tr]); setTagQuery(""); };
  const removeTag = (t) => setTags(tags.filter(x=>x!==t));
  const tagSuggestions = (allExistingTags||[]).filter(t=>!tags.includes(t)&&(tagQuery===""||t.toLowerCase().includes(tagQuery.toLowerCase())));
  const showAddNew = tagQuery.trim().length>0 && !(allExistingTags||[]).some(t=>t.toLowerCase()===tagQuery.trim().toLowerCase()) && !tags.includes(tagQuery.trim());

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2>{mode==="edit"?"Edit Product":"New Product"}</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div className="form-group"><label className="form-label">Name <span style={{color:"var(--accent)"}}>*</span></label><input className="form-input" placeholder='e.g., "Margherita Pizza"' value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" placeholder="Ingredients, allergens, serving size..." value={desc} onChange={e=>setDesc(e.target.value)}/></div>
      <ImageUploadWithPan value={imageUrl} onChange={setImageUrl} panValue={imagePan} onPanChange={setImagePan} label="Product Image (optional)" frameRatio="1:1"/>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Price <span style={{color:"var(--accent)"}}>*</span></label>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text-secondary)",pointerEvents:"none",fontSize:14}}>$</span>
            <input className="form-input" type="number" step="0.01" min="0" placeholder="12.00" value={price} onChange={e=>setPrice(e.target.value)} style={{paddingLeft:26}}/>
          </div>
          <div className="form-hint">Editable per drop</div>
        </div>
        <div className="form-group"><label className="form-label">SKU</label><input className="form-input" placeholder="Optional — your own identifier" value={sku} onChange={e=>setSku(e.target.value)}/></div>
      </div>
      <div className="form-group">
        <label className="form-label">Tags</label>
        {tags.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
            {tags.map(t=>(
              <span key={t} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",background:"var(--accent-light)",color:"var(--accent)",borderRadius:"var(--radius-sm)",fontSize:12,fontWeight:500}}>
                {t}
                <button onClick={()=>removeTag(t)} style={{background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:1,color:"var(--accent)",fontSize:14,marginLeft:2}}>×</button>
              </span>
            ))}
          </div>
        )}
        <div style={{position:"relative"}}>
          <input
            className="form-input"
            placeholder="Type a tag and press Enter…"
            value={tagQuery}
            onChange={e=>setTagQuery(e.target.value)}
            onFocus={()=>setTagAcOpen(true)}
            onBlur={()=>setTimeout(()=>setTagAcOpen(false),150)}
            onKeyDown={e=>{if((e.key==="Enter"||e.key===",")&&tagQuery.trim()){e.preventDefault();addTag(tagQuery);}}}
          />
          {tagAcOpen&&(tagSuggestions.length>0||showAddNew)&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",boxShadow:"var(--shadow-lg)",maxHeight:180,overflowY:"auto",marginTop:2}}>
              {tagSuggestions.map(t=>(
                <button key={t} onMouseDown={e=>e.preventDefault()} onClick={()=>addTag(t)} style={{display:"block",width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",borderBottom:"1px solid var(--border)",cursor:"pointer",fontSize:13}} onMouseOver={e=>e.currentTarget.style.background="var(--surface-alt)"} onMouseOut={e=>e.currentTarget.style.background="none"}>{t}</button>
              ))}
              {showAddNew&&(<button onMouseDown={e=>e.preventDefault()} onClick={()=>addTag(tagQuery)} style={{display:"block",width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",cursor:"pointer",color:"var(--accent)",fontWeight:600,fontSize:13}}>+ Add "{tagQuery.trim()}"</button>)}
            </div>
          )}
        </div>
        <div className="form-hint">Organize your catalog with tags.</div>
      </div>
      <p style={{fontSize:12,color:"var(--text-tertiary)",margin:"0 0 10px",textAlign:"center"}}><span style={{color:"var(--accent)"}}>*</span> Required fields</p>
      <button className="btn btn-primary btn-full" disabled={!canSave} onClick={handleSave}>{saving?"Saving...":(mode==="edit"?"Save Changes":"Create Product")}</button>
      {mode==="edit"&&(
        <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid var(--border)",display:"flex",gap:8,justifyContent:"flex-end"}}>
          {product?.archived
            ? <button className="btn btn-ghost btn-sm" onMouseDown={e=>e.preventDefault()} onClick={onUnarchive}>Restore from Archive</button>
            : <button className="btn btn-ghost btn-sm" onMouseDown={e=>e.preventDefault()} onClick={onArchive}>{I.archive} Archive</button>
          }
          <button className="btn btn-danger btn-sm" onMouseDown={e=>e.preventDefault()} onClick={onDelete}>{I.trash} Delete</button>
        </div>
      )}
    </div></div>
  );
}

// v28a: Permanent delete for products
function PermanentDeleteProductModal({ product, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2 style={{color:"var(--red)"}}>Permanently Delete Product?</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <p style={{fontSize:15,marginBottom:12}}>You are about to permanently delete <strong>"{product.name}"</strong>.</p>
      <p style={{fontSize:14,color:"var(--text-secondary)",marginBottom:20,lineHeight:1.8}}>Existing drops that used this product will keep their menu items intact — only the canonical product entry is removed. If you want to hide it without affecting anything, archive instead.</p>
      <div style={{padding:"12px 16px",background:"var(--red-light)",borderRadius:"var(--radius-sm)",fontSize:13,color:"var(--red)",fontWeight:500,marginBottom:24}}>⚠️ This cannot be undone.</div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>{I.trash} Delete Permanently</button>
      </div>
    </div></div>
  );
}
      
function ManualOrderModal({ drop, dropItems, customers, creator, onSave, onClose }) {
  const [customerMode, setCustomerMode] = useState("existing"); // "existing" | "new"
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [cart, setCart] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  const filtered = customers.filter(c =>
    search.length < 2 ? false :
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = dropItems.find(i => i.id === id);
    return sum + (item ? Number(item.price) * qty : 0);
  }, 0);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const updateCart = (itemId, delta, item) => {
    setCart(prev => {
      const curr = prev[itemId] || 0;
      const next = Math.max(0, curr + delta);
      const max = item.quantity > 0 ? item.quantity - item.claimed : 999;
      if (next > max) return prev;
      return { ...prev, [itemId]: next };
    });
  };

  const customerName = customerMode === "existing" ? selectedCustomer?.name : newName;
  const customerEmail = customerMode === "existing" ? selectedCustomer?.email : newEmail;
  const canSave = cartCount > 0 &&
    (customerMode === "existing" ? !!selectedCustomer : (!!newName && !!newEmail));

  const handleSave = async () => {
    setSaving(true);
    const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ dropItemId: id, qty }));
    await onSave({
      drop,
      customer: customerMode === "existing"
        ? selectedCustomer
        : { name: newName, email: newEmail, phone: newPhone },
      isNewCustomer: customerMode === "new",
      cartItems,
      paymentMethod,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:540,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{margin:0}}>+ New Order</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"0 24px 24px"}}>

          {/* Drop summary */}
          <div style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:"10px 14px",marginBottom:20}}>
            <p style={{margin:0,fontWeight:600,fontSize:14}}>{drop.title}</p>
            <p style={{margin:"2px 0 0",fontSize:13,color:"var(--text-secondary)"}}>
              {drop.pickup_date ? new Date(drop.pickup_date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}) : ""}
              {drop.pickup_time ? " · "+drop.pickup_time : ""}
            </p>
          </div>

          {/* Customer selector */}
          <div style={{marginBottom:20}}>
            <p style={{margin:"0 0 10px",fontWeight:600,fontSize:14}}>Customer</p>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button onClick={()=>{setCustomerMode("existing");setSelectedCustomer(null);setSearch("");}}
                style={{flex:1,padding:"8px 12px",borderRadius:"var(--radius-sm)",border:`2px solid ${customerMode==="existing"?"var(--accent)":"var(--border)"}`,background:customerMode==="existing"?"var(--accent-light)":"var(--surface)",fontWeight:600,fontSize:13,cursor:"pointer",color:customerMode==="existing"?"var(--accent)":"var(--text-secondary)"}}>
                Existing Customer
              </button>
              <button onClick={()=>{setCustomerMode("new");setSelectedCustomer(null);}}
                style={{flex:1,padding:"8px 12px",borderRadius:"var(--radius-sm)",border:`2px solid ${customerMode==="new"?"var(--accent)":"var(--border)"}`,background:customerMode==="new"?"var(--accent-light)":"var(--surface)",fontWeight:600,fontSize:13,cursor:"pointer",color:customerMode==="new"?"var(--accent)":"var(--text-secondary)"}}>
                New Customer
              </button>
            </div>

            {customerMode==="existing"&&(<>
              {!selectedCustomer ? (<>
                <input className="form-input" placeholder="Search by name or email..." value={search} onChange={e=>setSearch(e.target.value)}/>
                {filtered.length>0&&(
                  <div style={{border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",marginTop:4,overflow:"hidden"}}>
                    {filtered.slice(0,6).map(c=>(
                      <div key={c.id} onClick={()=>setSelectedCustomer(c)}
                        style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid var(--border)",background:"var(--surface)"}}
                        onMouseOver={e=>e.currentTarget.style.background="var(--surface-alt)"}
                        onMouseOut={e=>e.currentTarget.style.background="var(--surface)"}>
                        <div style={{fontWeight:600,fontSize:14}}>{c.name}</div>
                        <div style={{fontSize:12,color:"var(--text-tertiary)"}}>{c.email}</div>
                      </div>
                    ))}
                  </div>
                )}
                {search.length>=2&&filtered.length===0&&<p style={{fontSize:13,color:"var(--text-tertiary)",marginTop:6}}>No customers found. Try "New Customer" to add them.</p>}
              </>) : (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--accent-light)",border:"1px solid var(--accent)",borderRadius:"var(--radius-sm)"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--accent)"}}>{selectedCustomer.name}</div>
                    <div style={{fontSize:12,color:"var(--text-secondary)"}}>{selectedCustomer.email}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedCustomer(null)}>Change</button>
                </div>
              )}
            </>)}

            {customerMode==="new"&&(<>
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Full name" value={newName} onChange={e=>setNewName(e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="email@example.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="(555) 555-5555" value={newPhone} onChange={e=>setNewPhone(formatPhone(e.target.value))}/></div>
            </>)}
          </div>

          {/* Item picker */}
          <div style={{marginBottom:20}}>
            <p style={{margin:"0 0 10px",fontWeight:600,fontSize:14}}>Items</p>
            <div style={{border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",overflow:"hidden"}}>
              {dropItems.map((item,idx)=>{
                const avail = item.quantity>0 ? item.quantity-item.claimed : 999;
                const qty = cart[item.id]||0;
                const soldOut = item.quantity>0&&avail<=0;
                return (
                  <div key={item.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:idx<dropItems.length-1?"1px solid var(--border)":"none",opacity:soldOut?.5:1}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{item.name}</div>
                      <div style={{fontSize:12,color:"var(--text-tertiary)"}}>{fmt(item.price)}{item.quantity>0?` · ${avail} left`:""}</div>
                    </div>
                    {soldOut ? <span style={{fontSize:12,color:"var(--text-tertiary)"}}>Sold out</span> : (
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <button className="qty-btn" onClick={()=>updateCart(item.id,-1,item)} disabled={!qty}>−</button>
                        <span style={{minWidth:20,textAlign:"center",fontWeight:600}}>{qty}</span>
                        <button className="qty-btn" onClick={()=>updateCart(item.id,1,item)}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {cartCount>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"10px 2px",fontWeight:600,fontSize:15,marginTop:4}}><span>Total</span><span>{fmt(cartTotal)}</span></div>}
          </div>

          {/* Payment method */}
          <div style={{marginBottom:24}}>
            <p style={{margin:"0 0 10px",fontWeight:600,fontSize:14}}>Payment</p>
            <div style={{display:"flex",gap:8}}>
              {["cash","venmo","invoice"].map(method=>(
                <button key={method} onClick={()=>setPaymentMethod(method)}
                  style={{flex:1,padding:"9px 8px",borderRadius:"var(--radius-sm)",border:`2px solid ${paymentMethod===method?"var(--accent)":"var(--border)"}`,background:paymentMethod===method?"var(--accent-light)":"var(--surface)",fontWeight:600,fontSize:13,cursor:"pointer",color:paymentMethod===method?"var(--accent)":"var(--text-secondary)",textTransform:"capitalize"}}>
                  {method==="cash"?"💵 Cash":method==="venmo"?"💙 Venmo":"📧 Invoice"}
                </button>
              ))}
            </div>
            {paymentMethod==="invoice"&&customerEmail&&(
              <p style={{margin:"8px 0 0",fontSize:12,color:"var(--text-tertiary)"}}>An invoice email will be sent to <strong>{customerEmail}</strong> automatically.</p>
            )}
            {paymentMethod==="invoice"&&!customerEmail&&(
              <p style={{margin:"8px 0 0",fontSize:12,color:"var(--red)"}}>A customer email is required to send an invoice.</p>
            )}
          </div>

          <div style={{display:"flex",gap:12}}>
            <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" style={{flex:2}} disabled={!canSave||saving||(paymentMethod==="invoice"&&!customerEmail)} onClick={handleSave}>
              {saving?"Creating...":cartCount>0?`Create Order — ${fmt(cartTotal)}`:"Create Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function BlastModal({ drop, creator, customers, getDropOrders, onSend, onSendPreview, onClose }) {
  const [channel, setChannel] = useState("email");
  const [audience, setAudience] = useState("all");
  const [customNote, setCustomNote] = useState("");
  const [sending, setSending] = useState(false);
  // v27.1: preview state — defaults to creator's own email, editable so creators
  // can send to a phone-reachable address to preview mobile rendering
  const [previewEmail, setPreviewEmail] = useState(creator?.email || "");
  const [sendingPreview, setSendingPreview] = useState(false);

  const handleSendPreviewClick = async () => {
    if (!previewEmail || !onSendPreview) return;
    setSendingPreview(true);
    await onSendPreview({ drop, customNote, previewEmail });
    setSendingPreview(false);
  };

  const optedIn = customers.filter(c => c.opted_in);
  const orderedCustomerEmails = getDropOrders(drop.id)
    .filter(o => o.status !== "cancelled")
    .map(o => o.customer_email?.toLowerCase().trim())
    .filter(Boolean);
  const orderedOptedIn = optedIn.filter(c => orderedCustomerEmails.includes(c.email?.toLowerCase().trim()));
  const targetCount = audience === "all" ? optedIn.length : orderedOptedIn.length;

  const handleSend = async () => {
    setSending(true);
    await onSend({ drop, channel, audience, customNote });
    setSending(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{margin:0}}>📣 Announce Drop</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"0 24px 24px"}}>

          {/* Drop summary */}
          <div style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:"12px 16px",marginBottom:20}}>
            <p style={{margin:0,fontWeight:600,fontSize:15}}>{drop.title}</p>
            <p style={{margin:"4px 0 0",fontSize:13,color:"var(--text-secondary)"}}>
              {drop.pickup_date ? new Date(drop.pickup_date + "T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}) : ""}{drop.pickup_time ? " · " + drop.pickup_time : ""}
            </p>
          </div>

          {/* Channel selector */}
          <div style={{marginBottom:20}}>
            <p style={{margin:"0 0 10px",fontWeight:600,fontSize:14}}>Send via</p>
            <div style={{display:"flex",gap:10}}>
              <button
                onClick={()=>setChannel("email")}
                style={{flex:1,padding:"10px 16px",borderRadius:"var(--radius-sm)",border:`2px solid ${channel==="email"?"var(--accent)":"var(--border)"}`,background:channel==="email"?"var(--accent-light)":"var(--surface)",fontWeight:600,fontSize:14,cursor:"pointer",color:channel==="email"?"var(--accent)":"var(--text-secondary)"}}>
                ✉️ Email
              </button>
              <button
                onClick={()=>setChannel("sms")}
                style={{flex:1,padding:"10px 16px",borderRadius:"var(--radius-sm)",border:`2px solid ${channel==="sms"?"var(--accent)":"var(--border)"}`,background:channel==="sms"?"var(--accent-light)":"var(--surface)",fontWeight:600,fontSize:14,cursor:"pointer",color:channel==="sms"?"var(--accent)":"var(--text-secondary)",position:"relative"}}>
                💬 Text
                <span style={{position:"absolute",top:-8,right:-8,background:"var(--gold)",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:10,letterSpacing:.5}}>SOON</span>
              </button>
            </div>
            {channel==="sms"&&<p style={{margin:"8px 0 0",fontSize:12,color:"var(--text-tertiary)"}}>SMS blasts are coming soon. Set up your message now and send when it's ready.</p>}
          </div>

          {/* Audience selector */}
          <div style={{marginBottom:20}}>
            <p style={{margin:"0 0 10px",fontWeight:600,fontSize:14}}>Send to</p>
            <div style={{display:"flex",gap:10}}>
              <button
                onClick={()=>setAudience("all")}
                style={{flex:1,padding:"10px 16px",borderRadius:"var(--radius-sm)",border:`2px solid ${audience==="all"?"var(--accent)":"var(--border)"}`,background:audience==="all"?"var(--accent-light)":"var(--surface)",fontWeight:600,fontSize:14,cursor:"pointer",color:audience==="all"?"var(--accent)":"var(--text-secondary)"}}>
                All opted-in
                <span style={{display:"block",fontSize:12,fontWeight:400,color:"var(--text-tertiary)",marginTop:2}}>{optedIn.length} customer{optedIn.length!==1?"s":""}</span>
              </button>
              <button
                onClick={()=>setAudience("ordered")}
                style={{flex:1,padding:"10px 16px",borderRadius:"var(--radius-sm)",border:`2px solid ${audience==="ordered"?"var(--accent)":"var(--border)"}`,background:audience==="ordered"?"var(--accent-light)":"var(--surface)",fontWeight:600,fontSize:14,cursor:"pointer",color:audience==="ordered"?"var(--accent)":"var(--text-secondary)"}}>
                Ordered this drop
                <span style={{display:"block",fontSize:12,fontWeight:400,color:"var(--text-tertiary)",marginTop:2}}>{orderedOptedIn.length} customer{orderedOptedIn.length!==1?"s":""}</span>
              </button>
            </div>
          </div>

          {/* Custom note */}
          <div style={{marginBottom:24}}>
            <label style={{display:"block",fontWeight:600,fontSize:14,marginBottom:8}}>
              Personal note <span style={{fontWeight:400,color:"var(--text-tertiary)"}}>(optional)</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder={`Add a personal message to your customers. E.g. "So excited to share this week's menu with you — it's been a long time coming!"`}
              value={customNote}
              onChange={e=>setCustomNote(e.target.value)}
              style={{resize:"vertical",fontFamily:"inherit"}}
            />
            <p style={{margin:"6px 0 0",fontSize:12,color:"var(--text-tertiary)"}}>This appears at the top of the email above the drop details.</p>
          </div>

          {/* Preview note */}
          <div style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:"10px 14px",marginBottom:20,fontSize:13,color:"var(--text-secondary)"}}>
            📧 The email will include your drop image, items, pickup details, and a direct link to your storefront — all branded as <strong>{drop.title}</strong>.
          </div>

          {/* v27.1: Preview to creator's own inbox before sending to real customers */}
          {channel === "email" && onSendPreview && (
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"14px 16px",marginBottom:20}}>
              <p style={{margin:"0 0 8px",fontSize:13,fontWeight:600,color:"var(--text)"}}>👁 Preview before sending</p>
              <p style={{margin:"0 0 10px",fontSize:12,color:"var(--text-secondary)",lineHeight:1.5}}>Send yourself a test to see exactly how it'll look in your customers' inbox.</p>
              <div style={{display:"flex",gap:8}}>
                <input
                  className="form-input"
                  type="email"
                  placeholder="preview@email.com"
                  value={previewEmail}
                  onChange={e=>setPreviewEmail(e.target.value)}
                  style={{flex:1,fontSize:13,padding:"8px 12px"}}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={!previewEmail || sendingPreview || sending}
                  onClick={handleSendPreviewClick}
                  style={{whiteSpace:"nowrap"}}>
                  {sendingPreview ? "Sending..." : "Send preview"}
                </button>
              </div>
              <p style={{margin:"8px 0 0",fontSize:11,color:"var(--text-tertiary)"}}>Previews don't count toward the "Announced" status on this drop.</p>
            </div>
          )}

          {targetCount === 0 && (
            <div style={{background:"var(--red-light)",color:"var(--red)",borderRadius:"var(--radius-sm)",padding:"10px 14px",marginBottom:16,fontSize:13}}>
              No opted-in customers in this audience. Ask customers to opt in first.
            </div>
          )}

          <div style={{display:"flex",gap:12}}>
            <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              style={{flex:2}}
              disabled={sending || sendingPreview || targetCount===0 || channel==="sms"}
              onClick={handleSend}>
              {sending ? "Sending..." : `Send to ${targetCount} customer${targetCount!==1?"s":""}`}
            </button>
          </div>
          {channel==="sms"&&<p style={{margin:"10px 0 0",textAlign:"center",fontSize:12,color:"var(--text-tertiary)"}}>SMS sending will be enabled in a future update.</p>}
        </div>
      </div>
    </div>
  );
}
function PermanentDeleteDropModal({ drop, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2 style={{color:"var(--red)"}}>Permanently Delete Drop?</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <p style={{fontSize:15,marginBottom:12}}>You are about to permanently delete <strong>"{drop.title}"</strong>.</p>
      <p style={{fontSize:14,color:"var(--text-secondary)",marginBottom:8}}>This will delete:</p>
      <ul style={{fontSize:14,color:"var(--text-secondary)",paddingLeft:20,marginBottom:20,lineHeight:1.8}}>
        <li>The drop and all menu items</li>
        <li>All orders and order items for this drop</li>
        <li>This drop's revenue data</li>
      </ul>
      <div style={{padding:"12px 16px",background:"var(--red-light)",borderRadius:"var(--radius-sm)",fontSize:13,color:"var(--red)",fontWeight:500,marginBottom:24}}>⚠️ This cannot be undone.</div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>{I.trash} Delete Permanently</button>
      </div>
    </div></div>
  );
}

// ============================================================
// MODALS
// ============================================================

// --- Image Upload Component ---
// ============================================================
// IMAGE UPLOAD WITH PAN-TO-CROP
// ============================================================
// frameRatio: "1:1" | "2:1" | "3:1" | "4:3" | "16:9" | "circle"
// value: image URL string
// panValue: { x: 0-100, y: 0-100 } — stored in parallel state by parent
// onChange(url): called when new image is uploaded or removed
// onPanChange({ x, y }): called as creator drags

const FRAME_META = {
  "3:1":   { w: 480, h: 160, label: "3:1 wide banner",   hint: "Recommended: 1200×400px — use a landscape photo" },
  "2:1":   { w: 480, h: 240, label: "2:1 landscape",     hint: "Recommended: 1200×600px — food close-ups work great" },
  "1:1":   { w: 280, h: 280, label: "1:1 square",        hint: "Recommended: 800×800px — center your subject when shooting" },
  "4:3":   { w: 480, h: 360, label: "4:3 landscape",     hint: "Recommended: 800×600px — landscape fills email cleanly" },
  "circle":{ w: 120, h: 120, label: "Circle / logo",     hint: "Recommended: 400×400px — square image, centered subject" },
};

function ImageUploadWithPan({ value, onChange, panValue, onPanChange, label, frameRatio = "1:1" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const dragRef = useRef(null);
  const frameRef = useRef(null);
  const imgRef = useRef(null);

  const pan = panValue || { x: 50, y: 50 };
  const fm = FRAME_META[frameRatio] || FRAME_META["1:1"];
  const isCircle = frameRatio === "circle";

  // Compress before upload — same logic as before
  const compressImage = (file, maxWidth = 1200) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    setError(null); setUploading(true);
    let uploadFile = file;
    if (file.size > 1024 * 1024) {
      const compressed = await compressImage(file);
      if (compressed) uploadFile = new File([compressed], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
    }
    const { url, error: uploadErr } = await supabase.uploadImage(uploadFile);
    setUploading(false);
    if (url) { onChange(url); onPanChange && onPanChange({ x: 50, y: 50 }); setImgLoaded(false); setError(null); }
    else { setError("Upload failed. Try a smaller image or different format."); console.error("Upload error:", uploadErr); }
  };

  // When image loads, record natural dimensions
  const handleImgLoad = (e) => {
    setNaturalW(e.target.naturalWidth);
    setNaturalH(e.target.naturalHeight);
    setImgLoaded(true);
  };

  // Compute scaled image size and position inside the frame
  const getImgStyle = () => {
    if (!imgLoaded || !naturalW || !naturalH) return { width: "100%", height: "100%", objectFit: "cover", objectPosition: `${pan.x}% ${pan.y}%` };
    const scale = Math.max(fm.w / naturalW, fm.h / naturalH);
    const iw = naturalW * scale;
    const ih = naturalH * scale;
    const maxOffX = 0, minOffX = fm.w - iw;
    const maxOffY = 0, minOffY = fm.h - ih;
    const ox = Math.max(minOffX, Math.min(maxOffX, (fm.w - iw) * (pan.x / 100)));
    const oy = Math.max(minOffY, Math.min(maxOffY, (fm.h - ih) * (pan.y / 100)));
    return { width: iw, height: ih, left: ox, top: oy };
  };

  // Drag handlers
  const startDrag = (clientX, clientY) => {
    if (!imgLoaded) return;
    const scale = Math.max(fm.w / naturalW, fm.h / naturalH);
    const iw = naturalW * scale, ih = naturalH * scale;
    const style = getImgStyle();
    dragRef.current = { startX: clientX, startY: clientY, startOX: style.left || 0, startOY: style.top || 0, iw, ih };
    frameRef.current?.classList.add("dragging");
  };

  const onDrag = (clientX, clientY) => {
    if (!dragRef.current) return;
    const { startX, startY, startOX, startOY, iw, ih } = dragRef.current;
    const dx = clientX - startX, dy = clientY - startY;
    const newOX = Math.max(fm.w - iw, Math.min(0, startOX + dx));
    const newOY = Math.max(fm.h - ih, Math.min(0, startOY + dy));
    const fracX = iw <= fm.w ? 50 : Math.round((newOX / (fm.w - iw)) * 100);
    const fracY = ih <= fm.h ? 50 : Math.round((newOY / (fm.h - ih)) * 100);
    onPanChange && onPanChange({ x: Math.max(0, Math.min(100, fracX)), y: Math.max(0, Math.min(100, fracY)) });
  };

  const endDrag = () => { dragRef.current = null; frameRef.current?.classList.remove("dragging"); };

  return (
    <div className="form-group">
      <label className="form-label">{label || "Image"}</label>

      {!value ? (
        <div className="img-upload">
          <input type="file" accept="image/*" onChange={handleFile}/>
          <div>{uploading
            ? <><div className="spin" style={{width:20,height:20,margin:"0 auto 8px"}}/> Uploading...</>
            : <><span style={{color:"var(--accent)"}}>{I.image}</span><div style={{fontSize:13,color:"var(--text-secondary)",marginTop:4}}>Click or drag to upload</div></>
          }</div>
        </div>
      ) : (
        <div>
          {/* Pan-to-crop frame */}
          <div
            ref={frameRef}
            className="pan-frame"
            style={{ width: fm.w, maxWidth: "100%", height: fm.h, borderRadius: isCircle ? "50%" : "var(--radius-sm)" }}
            onMouseDown={e => { startDrag(e.clientX, e.clientY); e.preventDefault(); }}
            onMouseMove={e => { if (dragRef.current) onDrag(e.clientX, e.clientY); }}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={e => { if (dragRef.current) { onDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); } }}
            onTouchEnd={endDrag}
          >
            <img
              ref={imgRef}
              src={value}
              alt=""
              onLoad={handleImgLoad}
              style={{ ...getImgStyle(), position: imgLoaded ? "absolute" : "relative", objectFit: imgLoaded ? undefined : "cover", width: imgLoaded ? getImgStyle().width : "100%", height: imgLoaded ? getImgStyle().height : "100%" }}
              draggable={false}
            />
            <div className="pan-size-badge">{fm.label}</div>
            <div className="pan-hint"><div className="pan-hint-inner">Drag to reposition</div></div>
          </div>

          {/* Size hint + remove button */}
          <div className="pan-actions">
            <label className="btn btn-secondary btn-sm" style={{cursor:"pointer",position:"relative"}}>
              {I.upload} Replace
              <input type="file" accept="image/*" onChange={handleFile} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
            </label>
            <button className="btn btn-ghost btn-sm" onClick={()=>{ onChange(""); onPanChange && onPanChange({x:50,y:50}); setImgLoaded(false); }} style={{color:"var(--red)"}}>
              {I.x} Remove
            </button>
          </div>
          <div className="pan-size-hint">{fm.hint}</div>
        </div>
      )}

      {/* Show size hint even before upload */}
      {!value && <div className="pan-size-hint" style={{marginTop:4}}>{fm.hint}</div>}
      {error && <div style={{fontSize:12,color:"var(--red)",marginTop:6}}>{error}</div>}
    </div>
  );
}

// Backwards-compatible alias — plain ImageUpload still works for non-image contexts (CSV etc.)
function ImageUpload({ value, onChange, label, frameRatio = "1:1" }) {
  const [pan, setPan] = useState({ x: 50, y: 50 });
  return <ImageUploadWithPan value={value} onChange={onChange} panValue={pan} onPanChange={setPan} label={label} frameRatio={frameRatio}/>;
}

// --- Drop Form (create + edit, with images) ---
function DropFormModal({ mode, drop, existingItems, duplicateFrom, duplicateItems, prefilledDate, allDrops, products, onCreateProduct, onSave, onClose }) {
  const src = drop || duplicateFrom;
  const srcItems = existingItems || duplicateItems;
  const [title, setTitle] = useState(duplicateFrom ? "" : (src?.title || ""));
  const [desc, setDesc] = useState(src?.description || "");
  // v27a: prefilledDate (from calendar click) takes precedence over src date when creating
  const [pickupDate, setPickupDate] = useState(duplicateFrom ? (prefilledDate || "") : (prefilledDate || src?.pickup_date || ""));
  const [pickupTime, setPickupTime] = useState(src?.pickup_time || "");
  const [pickupLocation, setPickupLocation] = useState(src?.pickup_location || "");
  // v26: pickup windows (opt-in)
  const [useWindows, setUseWindows] = useState(!!src?.use_pickup_windows);
  const [windows, setWindows] = useState(() => {
    if (src?.pickup_windows?.length) {
      return src.pickup_windows.map(w => ({
        id: w.id, start: w.start || "", end: w.end || "",
        slotLimit: w.slotLimit == null ? "" : String(w.slotLimit),
        unlimited: w.slotLimit == null,
      }));
    }
    return [{ id: "w0", start: "", end: "", slotLimit: "", unlimited: false }];
  });
  const addWindow = () => setWindows([...windows, { id: `w${Date.now()}`, start: "", end: "", slotLimit: "", unlimited: false }]);
  const removeWindow = (id) => windows.length > 1 && setWindows(windows.filter(w => w.id !== id));
  const updateWindow = (id, f, v) => setWindows(windows.map(w => (w.id === id ? { ...w, [f]: v } : w)));
  const [imageUrl, setImageUrl] = useState(src?.image_data?.url || src?.image_url || "");
  const [imagePan, setImagePan] = useState({ x: src?.image_data?.x ?? 50, y: src?.image_data?.y ?? 50 });
  const [items, setItems] = useState(() => {
    if (srcItems?.length) return srcItems.map(i => ({
      id: duplicateFrom ? `dup${i.id}` : i.id,
      existingId: duplicateFrom ? undefined : i.id,
      name: i.name, description: i.description||"", price: String(i.price),
      quantity: i.quantity===-1?"":String(i.quantity),
      unlimited: i.quantity===-1, sortOrder: i.sort_order,
      imageUrl: i.image_data?.url || i.image_url||"",
      imagePan: { x: i.image_data?.x ?? 50, y: i.image_data?.y ?? 50 },
      productId: i.product_id || null,
      capacityWeight: i.capacity_weight != null ? String(i.capacity_weight) : "1",
    }));
    return [{ id: "i0", name: "", description: "", price: "", quantity: "", unlimited: false, imageUrl: "", imagePan: { x: 50, y: 50 }, productId: null, capacityWeight: "1" }];
  });
  const [saving, setSaving] = useState(false);
  const [acItemId, setAcItemId] = useState(null);
  const addItem = () => setItems([...items, { id: `i${Date.now()}`, name: "", description: "", price: "", quantity: "", unlimited: false, sortOrder: items.length, imageUrl: "", imagePan: { x: 50, y: 50 }, productId: null, capacityWeight: "1" }]);
  const removeItem = (id) => items.length > 1 && setItems(items.filter(i => i.id !== id));
  const updateItem = (id, f, v) => setItems(items.map(i => (i.id === id ? { ...i, [f]: v } : i)));
  const applyProduct = (itemId, p) => setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, name: p.name, description: p.description || "", price: String(p.price), imageUrl: p.image_data?.url || p.image_url || "", imagePan: { x: p.image_data?.x ?? 50, y: p.image_data?.y ?? 50 }, productId: p.id, capacityWeight: p.capacity_weight != null ? String(p.capacity_weight) : "1" }));
  // v26: when windows are enabled, auto-compute pickup_time string from the windows span
  // so all existing display code continues to work.
  const windowsValid = windows.every(w => w.start && w.end && (w.unlimited || (w.slotLimit && Number(w.slotLimit) > 0)));
  const effectivePickupTime = useWindows ? spanWindows(windows) : pickupTime;
  const acActiveItem = items.find(i => i.id === acItemId);
  const acQ = acActiveItem?.name || "";
  const acResults = acItemId ? (acQ.length === 0 ? (products||[]).filter(p=>!p.archived) : acQ.length >= 3 ? (products||[]).filter(p=>!p.archived&&p.name.toLowerCase().includes(acQ.toLowerCase())) : null) : null;
  const acShowAddNew = !!acItemId && acQ.length >= 3 && !(products||[]).some(p=>!p.archived&&p.name.toLowerCase()===acQ.toLowerCase());
  const canSave = title && pickupDate && pickupLocation && !saving
    && items.every(i => i.name && i.price)
    && (useWindows ? (windows.length > 0 && windowsValid) : !!pickupTime);
  const handleSave = async () => {
    setSaving(true);
    const normalizedWindows = useWindows ? windows.map(w => ({
      id: w.id, start: w.start, end: w.end,
      slotLimit: w.unlimited ? null : parseInt(w.slotLimit) || 0,
    })) : null;
    await onSave({
      title, description: desc, pickupDate,
      pickupTime: effectivePickupTime,
      pickupLocation, imageUrl, imagePan,
      useWindows, pickupWindows: normalizedWindows,
    }, items);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2>{mode==="edit"?"Edit Drop":duplicateFrom?"Duplicate Drop":"Create New Drop"}</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div className="form-group"><label className="form-label">Drop Title <span style={{color:"var(--accent)"}}>*</span></label><input className="form-input" placeholder='e.g., "Friday Dinner Box — March 6"' value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" placeholder="Describe what's in this drop..." value={desc} onChange={e=>setDesc(e.target.value)}/></div>
      <ImageUpload value={imageUrl} onChange={setImageUrl} panValue={imagePan} onPanChange={setImagePan} label="Drop Cover Image (optional)" frameRatio="2:1"/>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Pickup Date <span style={{color:"var(--accent)"}}>*</span></label>
          <input className="form-input" type="date" value={pickupDate} onChange={e=>setPickupDate(e.target.value)}/>
          {/* v27a: Contextual awareness — show other drops in the selected month */}
          {pickupDate && allDrops && (() => {
            const selected = new Date(pickupDate + "T00:00:00");
            const selectedYM = `${selected.getFullYear()}-${selected.getMonth()}`;
            const currentDropId = drop?.id;
            const sameMonthDrops = allDrops.filter(d => {
              if (!d.pickup_date || d.archived) return false;
              if (currentDropId && d.id === currentDropId) return false; // exclude self when editing
              const dd = new Date(d.pickup_date + "T00:00:00");
              return `${dd.getFullYear()}-${dd.getMonth()}` === selectedYM;
            });
            const sameDayConflict = sameMonthDrops.find(d => d.pickup_date === pickupDate);
            if (sameDayConflict) {
              return <div className="cal-context-hint warn">⚠️ You already have a drop on this date: <strong>{sameDayConflict.title}</strong></div>;
            }
            if (sameMonthDrops.length > 0) {
              const monthName = selected.toLocaleDateString("en-US", { month: "long" });
              const listed = sameMonthDrops.slice(0, 3).map(d => {
                const dd = new Date(d.pickup_date + "T00:00:00");
                return `${d.title} (${dd.toLocaleDateString("en-US",{month:"short",day:"numeric"})})`;
              }).join(", ");
              const extra = sameMonthDrops.length > 3 ? ` +${sameMonthDrops.length-3} more` : "";
              return <div className="cal-context-hint">📅 Also in {monthName}: {listed}{extra}</div>;
            }
            return null;
          })()}
        </div>
        {!useWindows && <div className="form-group"><label className="form-label">Pickup Time <span style={{color:"var(--accent)"}}>*</span></label><input className="form-input" placeholder="5:00 PM – 7:00 PM" value={pickupTime} onChange={e=>setPickupTime(e.target.value)}/></div>}
      </div>
      <div className="form-group"><label className="form-label">Pickup Location <span style={{color:"var(--accent)"}}>*</span></label><input className="form-input" placeholder="123 Main St" value={pickupLocation} onChange={e=>setPickupLocation(e.target.value)}/></div>

      {/* v26: Pickup windows opt-in */}
      <div style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:"12px 14px",marginBottom:16}}>
        <label className="checkbox-row" style={{margin:0}}>
          <input type="checkbox" checked={useWindows} onChange={e=>setUseWindows(e.target.checked)}/>
          <span style={{fontWeight:600}}>Use pickup windows</span>
        </label>
        <p style={{margin:"6px 0 0 26px",fontSize:12,color:"var(--text-secondary)"}}>
          Let customers pick a specific time slot at checkout. Good for staggered pickups or limited counter space.
        </p>
      </div>

      {useWindows && (
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <label className="form-label" style={{marginBottom:0}}>Pickup Windows <span style={{color:"var(--accent)"}}>*</span></label>
            <button className="btn btn-ghost btn-sm" onClick={addWindow}>{I.plus} Add Window</button>
          </div>
          {windows.map((w, idx) => (
            <div key={w.id} style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:16,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)"}}>Window {idx+1}</span>
                {windows.length>1 && <button className="btn btn-ghost btn-sm" onClick={()=>removeWindow(w.id)} style={{color:"var(--accent)",padding:4}}>{I.x}</button>}
              </div>
              <div className="form-row">
                <div className="form-group" style={{marginBottom:0}}><label className="form-label" style={{fontSize:12}}>Start</label><input className="form-input" type="time" value={w.start} onChange={e=>updateWindow(w.id,"start",e.target.value)}/></div>
                <div className="form-group" style={{marginBottom:0}}><label className="form-label" style={{fontSize:12}}>End</label><input className="form-input" type="time" value={w.end} onChange={e=>updateWindow(w.id,"end",e.target.value)}/></div>
              </div>
              <div style={{marginTop:10}}>
                <label className="form-label" style={{fontSize:12}}>Slot limit</label>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 5" value={w.unlimited?"":w.slotLimit} disabled={w.unlimited} onChange={e=>updateWindow(w.id,"slotLimit",e.target.value)} style={{flex:"0 0 140px"}}/>
                  <label className="checkbox-row" style={{margin:0}}><input type="checkbox" checked={w.unlimited} onChange={e=>updateWindow(w.id,"unlimited",e.target.checked)}/>Unlimited</label>
                </div>
              </div>
            </div>
          ))}
          <p style={{fontSize:12,color:"var(--text-tertiary)",margin:"8px 0 0"}}>
            Customers will see only windows with slots available. Once a window is full, it's hidden from checkout.
          </p>
        </div>
      )}      <div style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><label className="form-label" style={{marginBottom:0}}>Menu Items <span style={{color:"var(--accent)"}}>*</span></label><button className="btn btn-ghost btn-sm" onClick={addItem}>{I.plus} Add Item</button></div>
        {items.map((item,idx)=>(<div key={item.id} style={{background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",padding:16,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)"}}>Item {idx+1}</span>{items.length>1&&<button className="btn btn-ghost btn-sm" onClick={()=>removeItem(item.id)} style={{color:"var(--accent)",padding:4}}>{I.x}</button>}</div>
          <div style={{position:"relative",marginBottom:8}}>
            <input className="form-input" placeholder="Item name *" value={item.name} onChange={e=>{const v=e.target.value;setItems(prev=>prev.map(i=>i.id===item.id?{...i,name:v,productId:null}:i));}} onFocus={()=>setAcItemId(item.id)} onBlur={()=>setTimeout(()=>setAcItemId(prev=>prev===item.id?null:prev),150)}/>
            {acItemId===item.id&&acResults!==null&&(acResults.length>0||acShowAddNew)&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",boxShadow:"var(--shadow-lg)",maxHeight:220,overflowY:"auto",marginTop:2}}>
                {acResults.map(p=>(<button key={p.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{applyProduct(item.id,p);setAcItemId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"9px 12px",background:"none",border:"none",borderBottom:"1px solid var(--border)",cursor:"pointer"}} onMouseOver={e=>e.currentTarget.style.background="var(--surface-alt)"} onMouseOut={e=>e.currentTarget.style.background="none"}><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:12,color:"var(--text-secondary)"}}>{fmt(p.price)}{p.description?" · "+p.description.slice(0,50)+(p.description.length>50?"...":""):""}</div></button>))}
                {acShowAddNew&&(<button onMouseDown={e=>e.preventDefault()} onClick={async()=>{const p=await onCreateProduct(item.name);if(p)setItems(prev=>prev.map(i=>i.id===item.id?{...i,productId:p.id}:i));setAcItemId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"9px 12px",background:"none",border:"none",cursor:"pointer",color:"var(--accent)",fontWeight:600,fontSize:13}}>{I.plus} Add "{item.name}" as new product</button>)}
              </div>
            )}
          </div>
          <textarea className="form-textarea" placeholder="Description (optional) — ingredients, allergens, serving size..." value={item.description} onChange={e=>updateItem(item.id,"description",e.target.value)} style={{marginBottom:8,minHeight:56,fontSize:13}}/>
          <div className="form-row"><input className="form-input" type="number" placeholder="Price *" min="0" step="0.01" value={item.price} onChange={e=>updateItem(item.id,"price",e.target.value)}/><input className="form-input" type="number" placeholder="Quantity" min="1" value={item.unlimited?"":item.quantity} disabled={item.unlimited} onChange={e=>updateItem(item.id,"quantity",e.target.value)}/></div>          <label className="checkbox-row" style={{marginTop:10}}><input type="checkbox" checked={item.unlimited} onChange={e=>updateItem(item.id,"unlimited",e.target.checked)}/>Unlimited quantity</label>
          <ImageUpload value={item.imageUrl} onChange={url=>updateItem(item.id,"imageUrl",url)} panValue={item.imagePan} onPanChange={pan=>updateItem(item.id,"imagePan",pan)} label="Item Image (optional)" frameRatio="1:1"/>
        </div>))}
      </div>
      <p style={{fontSize:12,color:"var(--text-tertiary)",margin:"0 0 10px",textAlign:"center"}}><span style={{color:"var(--accent)"}}>*</span> Required fields</p>
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
  const [name, setName] = useState(customer?.name||"");
  const [email, setEmail] = useState(customer?.email||"");
  const [phone, setPhone] = useState(customer?.phone ? formatPhone(customer.phone) : "");
  const [prefer, setPrefer] = useState(customer?.prefer_contact||"email");
  const [notes, setNotes] = useState(customer?.notes||"");
  const [saving, setSaving] = useState(false);
  const canSave = name && email && !saving;
  const handleSave = async () => { setSaving(true); await onSave({ name, email, phone, preferContact: prefer, notes }); setSaving(false); };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2>{mode==="edit"?"Edit Customer":"Add Customer"}</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="(555) 555-5555" value={phone} onChange={e=>setPhone(formatPhone(e.target.value))}/></div>
      <div className="form-group"><label className="form-label">Preferred Contact</label><select className="form-select" value={prefer} onChange={e=>setPrefer(e.target.value)}><option value="email">Email</option><option value="sms">SMS / Text</option></select></div>
      <div className="form-group"><label className="form-label">Notes (optional)</label><textarea className="form-textarea" rows={3} placeholder="Allergies, preferences, special requests..." value={notes} onChange={e=>setNotes(e.target.value)}/><div className="form-hint">Only visible to you, not the customer</div></div>
      <button className="btn btn-primary btn-full" disabled={!canSave} onClick={handleSave}>{saving?"Saving...":(mode==="edit"?"Save Changes":"Add Customer")}</button>
    </div></div>
  );
}

// --- Profile Form — with theme picker + hero image ---
function ProfileFormModal({ creator, onSave, onClose }) {
  const [name, setName] = useState(creator?.name||"");
  const [tagline, setTagline] = useState(creator?.tagline||"");
  const [slug, setSlug] = useState(creator?.slug||"");
  const [heroImageUrl, setHeroImageUrl] = useState(creator?.hero_image_data?.url || creator?.hero_image_url||"");
  const [heroPan, setHeroPan] = useState({ x: creator?.hero_image_data?.x ?? 50, y: creator?.hero_image_data?.y ?? 50 });
  const [themeKey, setThemeKey] = useState(creator?.theme?.key || "terracotta");
  const [customAccent, setCustomAccent] = useState(creator?.theme?.accent || "#C4572A");
  const [saving, setSaving] = useState(false);

  const cleanSlug = (s) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  const getThemeData = () => {
    if (themeKey === "custom") {
      const accentHover = darkenHex(customAccent);
      const accentLight = hexToAccentLight(customAccent);
      return { ...THEMES.custom, key: "custom", accent: customAccent, accentHover, accentLight };
    }
    return { ...THEMES[themeKey], key: themeKey };
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name, tagline, slug: cleanSlug(slug), theme: getThemeData(), heroImageUrl, heroPan });
    setSaving(false);
  };

  const previewUrl = `${window.location.origin}${window.location.pathname}#/${cleanSlug(slug)||"your-business"}`;
  const previewAccent = themeKey === "custom" ? customAccent : THEMES[themeKey]?.accent;

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:600}}>
      <div className="modal-header"><h2>Edit Profile</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>

      <div className="form-group"><label className="form-label">Business Name</label><input className="form-input" placeholder="Your business name" value={name} onChange={e=>setName(e.target.value)}/><div className="form-hint">Appears at the top of your customer page</div></div>
      <div className="form-group"><label className="form-label">Tagline</label><input className="form-input" placeholder="Fresh food, made with love" value={tagline} onChange={e=>setTagline(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Page URL Slug</label><input className="form-input" placeholder="my-kitchen" value={slug} onChange={e=>setSlug(e.target.value)}/><div className="form-hint">Letters, numbers, and dashes only.</div></div>

      {/* Hero Image */}
      <ImageUpload value={heroImageUrl} onChange={setHeroImageUrl} panValue={heroPan} onPanChange={setHeroPan} label="Storefront Hero Image (optional)" frameRatio="3:1"/>

      {/* Theme Picker */}
      <div className="form-group">
        <label className="form-label">{I.palette} Storefront Theme</label>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
          {Object.entries(THEMES).map(([key, t]) => (
            <div key={key} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>setThemeKey(key)}>
              <div className={`theme-swatch ${themeKey===key?"selected":""}`} style={{background: key==="custom" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : t.accent}}/>
              <span style={{fontSize:11,fontWeight:600,color:themeKey===key?"var(--text)":"var(--text-tertiary)"}}>{t.name}</span>
            </div>
          ))}
        </div>
        {themeKey === "custom" && (
          <div style={{display:"flex",alignItems:"center",gap:12,padding:12,background:"var(--surface-alt)",borderRadius:"var(--radius-sm)"}}>
            <label className="form-label" style={{margin:0,whiteSpace:"nowrap"}}>Accent Color</label>
            <input type="color" value={customAccent} onChange={e=>setCustomAccent(e.target.value)} style={{width:48,height:36,border:"1px solid var(--border)",borderRadius:6,cursor:"pointer",padding:2}}/>
            <span style={{fontSize:13,color:"var(--text-secondary)"}}>{customAccent}</span>
          </div>
        )}
        {/* Live preview bar */}
        <div className="theme-preview-bar" style={{background:previewAccent, marginTop:12}}/>
      </div>

      {/* Preview */}
      <div style={{padding:16,background:"var(--surface-alt)",borderRadius:"var(--radius-sm)",marginBottom:20,borderLeft:`4px solid ${previewAccent}`}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--text-tertiary)",textTransform:"uppercase",letterSpacing:.3,marginBottom:8}}>Preview</div>
        <div style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:700}}>{name||"Your Business"}</div>
        <div style={{color:"var(--text-secondary)",fontSize:14,marginTop:4}}>{tagline||"Your tagline here"}</div>
        <div style={{fontSize:12,color:previewAccent,marginTop:8,wordBreak:"break-all"}}>{previewUrl}</div>
      </div>

      <button className="btn btn-primary btn-full" disabled={!name||!slug||saving} onClick={handleSave} style={{background:previewAccent}}>{saving?"Saving...":"Save Profile"}</button>
    </div></div>
  );
}

// --- Import CSV Modal ---
function ImportCSVModal({ onImport, onClose }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setError("CSV needs a header row and at least one data row."); return; }
        const headerRaw = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
        const nameIdx = headerRaw.findIndex(h => h.includes("name") && !h.includes("last"));
        const emailIdx = headerRaw.findIndex(h => h.includes("email"));
        const phoneIdx = headerRaw.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("cell"));
        const prefIdx = headerRaw.findIndex(h => h.includes("prefer") || h.includes("contact"));
        const notesIdx = headerRaw.findIndex(h => h.includes("note"));
        if (nameIdx === -1 || emailIdx === -1) { setError("CSV must have 'name' and 'email' columns. Found: " + headerRaw.join(", ")); return; }
        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
          const name = vals[nameIdx]?.trim();
          const email = vals[emailIdx]?.trim();
          if (!name || !email) continue;
          parsed.push({ name, email, phone: phoneIdx >= 0 ? (vals[phoneIdx]?.trim()||"") : "", prefer_contact: prefIdx >= 0 ? (vals[prefIdx]?.trim().toLowerCase().includes("sms") ? "sms" : "email") : "email", notes: notesIdx >= 0 ? (vals[notesIdx]?.trim()||"") : "" });
        }
        if (parsed.length === 0) { setError("No valid rows found. Each row needs name and email."); return; }
        setRows(parsed); setError(null);
      } catch { setError("Could not parse file. Make sure it's a valid CSV."); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:640}}>
      <div className="modal-header"><h2>Import Customers from CSV</h2><button className="btn btn-ghost" onClick={onClose}>{I.x}</button></div>
      <p style={{fontSize:14,color:"var(--text-secondary)",marginBottom:16}}>Upload a CSV with <strong>name</strong> and <strong>email</strong> columns (required). Optional: phone, preferred contact, notes.</p>
      <div className="img-upload" style={{marginBottom:16}}><input type="file" accept=".csv,.txt" onChange={handleFile}/><div>{I.upload}<div style={{fontSize:13,color:"var(--text-secondary)",marginTop:4}}>{fileName||"Click to select CSV file"}</div></div></div>
      {error && <div style={{padding:12,background:"var(--red-light)",color:"var(--red)",borderRadius:"var(--radius-sm)",fontSize:13,marginBottom:16}}>{error}</div>}
      {rows.length > 0 && (<>
        <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>{rows.length} customer{rows.length!==1?"s":""} found:</div>
        <div className="import-preview"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Pref</th></tr></thead><tbody>{rows.slice(0,50).map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.email}</td><td>{r.phone}</td><td>{r.prefer_contact}</td></tr>)}</tbody></table></div>
        {rows.length > 50 && <p style={{fontSize:12,color:"var(--text-tertiary)",marginTop:4}}>Showing first 50 of {rows.length}.</p>}
        <button className="btn btn-primary btn-full" style={{marginTop:16}} onClick={()=>onImport(rows)}>Import {rows.length} Customer{rows.length!==1?"s":""}</button>
      </>)}
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
// CUSTOMER STOREFRONT
// ============================================================
function CustomerStorefront({ creator, drops, getDropItems, showToast, loadData, customers, orders }) {
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [showSignup, setShowSignup] = useState(false);
  // Hide drops whose pickup date has already passed (YYYY-MM-DD local compare)
  // Drops on today's date remain visible all day, then drop off at midnight.
  const today = new Date(); today.setHours(0,0,0,0);
  const active = drops.filter(d => {
    if (d.status !== "active" || d.archived) return false;
    if (!d.pickup_date) return true; // safety: don't hide drops missing a date
    const pickup = new Date(d.pickup_date + "T00:00:00");
    return pickup >= today;
  });

  // Apply creator's theme on mount
  useEffect(() => {
    if (creator?.theme) applyTheme(creator.theme);
  }, [creator?.theme]);

  if (orderConfirmation) return (<><CustomerHeader creator={creator}/><div className="cust-body page-enter"><OrderConfirmation order={orderConfirmation} creator={creator} onBack={()=>{setOrderConfirmation(null);setSelectedDrop(null)}}/></div></>);
  if (selectedDrop) return (<><CustomerHeader creator={creator}/><div className="cust-body page-enter"><DropOrderPage drop={selectedDrop} items={getDropItems(selectedDrop.id)} creator={creator} customers={customers} orders={orders} onBack={()=>setSelectedDrop(null)} onOrderPlaced={order=>{setOrderConfirmation(order);loadData()}} showToast={showToast}/></div></>);

  return (<><CustomerHeader creator={creator}/><div className="cust-body page-enter">
    {active.length===0?(<div className="empty-state" style={{marginTop:40}}><div className="empty-state-icon">{I.drop}</div><h3>No active drops right now</h3><p style={{marginTop:8}}>Check back soon!</p></div>):(<>
      <h2 style={{marginBottom:20}}>Available Drops</h2>
      <div style={{display:"grid",gap:20}}>{active.map(drop=>{const dI=getDropItems(drop.id);const dropPos=drop.image_data?`${drop.image_data.x}% ${drop.image_data.y}%`:"50% 50%";const bannerStyle=drop.image_url?{backgroundImage:`linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url(${drop.image_url})`,backgroundSize:"cover",backgroundPosition:dropPos}:{};return(<div key={drop.id} className="cust-drop-card" onClick={()=>setSelectedDrop(drop)}><div className="cust-drop-banner" style={bannerStyle}><h2>{drop.title}</h2>{drop.description&&<p style={{fontSize:14,marginTop:6,opacity:.9}}>{drop.description}</p>}</div><div className="cust-drop-body"><div className="cust-drop-detail">{I.clock} <span>{fmtDateLong(drop.pickup_date)}, {drop.pickup_time}</span></div><div className="cust-drop-detail">{I.pin} <span>{drop.pickup_location}</span></div><div className="cust-drop-detail">{I.dollar} <span>Cash at pickup</span></div><div className="cust-drop-items-peek"><span>{dI.length} item{dI.length!==1?"s":""}: {dI.map(i=>i.name).join(", ")}</span></div><div style={{marginTop:16}}><span className="btn btn-primary btn-full">View Menu & Order →</span></div></div></div>)})}</div>
    </>)}
    <div className="signup-section">
      {!showSignup ? (
        <div style={{textAlign:"center"}}>
          <h3>Want to hear about future drops?</h3>
          <p style={{color:"var(--text-secondary)",fontSize:14,marginTop:4,marginBottom:16}}>Sign up to get notified when new drops go live.</p>
          <button className="btn btn-primary" onClick={()=>setShowSignup(true)}>{I.mail} Join the List</button>
        </div>
      ) : (
        <CustomerSignupForm creator={creator} customers={customers} showToast={showToast} loadData={loadData} onDone={()=>setShowSignup(false)}/>
      )}
    </div>
  </div></>);
}

function CustomerHeader({ creator }) {
  const hasHero = !!creator?.hero_image_url;
  const heroPan = creator?.hero_image_data;
  const heroPos = heroPan ? `${heroPan.x}% ${heroPan.y}%` : "50% 50%";
  return (
    <div className={`cust-header ${hasHero ? "has-hero" : ""}`}>
      {hasHero && <img src={creator.hero_image_url} alt="" className="cust-header-hero" style={{objectPosition: heroPos}}/>}
      {hasHero && <div className="cust-header-overlay"/>}
      <div className="cust-header-content">
        <div className="cust-header-name">{creator?.name||"FoodDrop"}</div>
        <div className="cust-header-tagline">{creator?.tagline||"Fresh food, made with love"}</div>
      </div>
    </div>
  );
}

function DropOrderPage({ drop, items, creator, customers, orders, onBack, onOrderPlaced, showToast }) {
  const [cart, setCart] = useState({});
  const [step, setStep] = useState("menu");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [preferContact, setPreferContact] = useState("email");
  const [placing, setPlacing] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [emailStep, setEmailStep] = useState("entry"); // "entry" | "recognized" | "new"
  const [lookingUp, setLookingUp] = useState(false);
  const [returningCustomer, setReturningCustomer] = useState(null);
  // v26: pickup window selection (only relevant if drop.use_pickup_windows)
  const [selectedWindowId, setSelectedWindowId] = useState(null);
  const dropWindows = drop.use_pickup_windows && Array.isArray(drop.pickup_windows) ? drop.pickup_windows : [];
  const selectedWindow = dropWindows.find(w => w.id === selectedWindowId) || null;

  const handleEmailContinue = async () => {
    if (!email) return;
    setLookingUp(true);
    const normalized = email.toLowerCase().trim();
    const found = customers.find(c => c.email.toLowerCase().trim() === normalized);
    if (found) {
      setReturningCustomer(found);
      setName(found.name || "");
      setPhone(found.phone || "");
      setPreferContact(found.prefer_contact || "email");
      setEmailStep("recognized");
    } else {
      setEmailStep("new");
    }
    setLookingUp(false);
  };

  const updateCart = (itemId, delta, item) => { setCart(prev => { const curr=prev[itemId]||0; const next=Math.max(0,curr+delta); const max=item.quantity>0?item.quantity-item.claimed:999; if(next>max) return prev; return{...prev,[itemId]:next}; }); };
  const cartCount = Object.values(cart).reduce((s,q)=>s+q,0);
  const cartTotal = Object.entries(cart).reduce((sum,[id,qty])=>{const item=items.find(i=>i.id===id);return sum+(item?Number(item.price)*qty:0)},0);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    const cartItems = Object.entries(cart).filter(([,q])=>q>0).map(([id,qty])=>({dropItemId:id,qty}));
    let customerId = null;
    const existing = customers.find(c=>c.email.toLowerCase().trim()===email.toLowerCase().trim());
    if (existing) {
      customerId = existing.id;
      // If existing customer has no phone/prefer_contact, update them
      if (!existing.phone && phone) {
        await supabase.from("customers").update({ phone, prefer_contact: preferContact }).eq("id", existing.id).execute();
      }
    } else if (creator) {
      const { data: nc } = await supabase.from("customers").insert({ creator_id: creator.id, name, email: email.toLowerCase().trim(), phone, prefer_contact: preferContact, signup_source: "order" }).select("*").single().execute();
      if (nc) customerId = nc.id;
    }
    // v26: Re-check slot availability right before writing the order. This catches
    // the race where two customers pick the last slot simultaneously; whoever's
    // insert lands second gets the error. Not bulletproof (no DB-level lock) but
    // good enough at cottage-food scale.
    if (drop.use_pickup_windows) {
      if (!selectedWindow) { showToast("Please pick a pickup window", "error"); setPlacing(false); return; }
      if (selectedWindow.slotLimit != null) {
        const taken = windowOrderCount(orders || [], drop.id, selectedWindow.id);
        if (taken >= selectedWindow.slotLimit) {
          showToast("That window just filled up — please pick another.", "error");
          setSelectedWindowId(null); setPlacing(false); return;
        }
      }
    }
    const { data: no, error } = await supabase.from("orders").insert({ drop_id: drop.id, customer_id: customerId, total: cartTotal, status: "confirmed", customer_name: name, customer_email: email.toLowerCase().trim(), pickup_window_id: drop.use_pickup_windows ? selectedWindow?.id : null }).select("*").single().execute();
    if (error || !no) { showToast("Failed to place order", "error"); setPlacing(false); return; }
    await supabase.from("order_items").insert(cartItems.map(ci => { const di = items.find(d => d.id === ci.dropItemId); return { order_id: no.id, drop_item_id: ci.dropItemId, item_name: di?.name || "Unknown", item_price: di?.price || 0, quantity: ci.qty }; })).execute();
    for (const ci of cartItems) { const di = items.find(d => d.id === ci.dropItemId); if (di) await supabase.from("drop_items").update({ claimed: di.claimed + ci.qty }).eq("id", di.id).execute(); }
    const orderDetail = { ...no, items: cartItems.map(ci => { const di = items.find(d => d.id === ci.dropItemId); return { name: di?.name, price: di?.price, qty: ci.qty }; }), drop, customerName: name, customerEmail: email };

    // Send confirmation email (non-blocking) — v27b: expanded payload for .ics + banner
    try {
      // Derive structured pickup times for .ics generation.
      // If pickup windows in use, the selected window is authoritative.
      // Otherwise, try to parse the free-form drop.pickup_time.
      let pickupStart24h = null, pickupEnd24h = null;
      if (drop.use_pickup_windows && selectedWindow) {
        pickupStart24h = selectedWindow.start;
        pickupEnd24h = selectedWindow.end;
      } else {
        const parsed = parseTimeRange(drop.pickup_time);
        if (parsed) { pickupStart24h = parsed.start; pickupEnd24h = parsed.end; }
      }
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          customerName: name,
          creatorName: creator?.name || "FoodDrop",
          dropTitle: drop.title,
          dropImageUrl: drop.image_url || "",               // v27b: banner
          pickupDate: fmtDateLong(drop.pickup_date),        // display string
          pickupDateRaw: drop.pickup_date,                  // v27b: YYYY-MM-DD for .ics
          pickupTime: drop.use_pickup_windows && selectedWindow ? formatWindow(selectedWindow) : drop.pickup_time,
          pickupStart24h,                                   // v27b: "HH:MM" or null
          pickupEnd24h,                                     // v27b: "HH:MM" or null
          pickupLocation: drop.pickup_location,
          items: orderDetail.items,
          total: cartTotal,
          orderId: no.id,                                   // v27b: unique .ics UID
        }),
      });
    } catch (emailErr) { console.error("Email send failed:", emailErr); }

// Notify creator of new order (non-blocking)
    try {
      if (creator?.email) {
        fetch("/api/notify-creator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorEmail: creator.email,
            creatorName: creator.name,
            customerName: name,
            dropTitle: drop.title,
            items: orderDetail.items,
            total: cartTotal,
          }),
        });
      }
    } catch (notifyErr) { console.error("Creator notify failed:", notifyErr); }
          
    // Send welcome email — only for brand new customers
    if (!existing && customerId) {
      await supabase.from("customers").update({ welcome_sent: true }).eq("id", customerId).execute();
      sendWelcomeEmail({ creator, customerName: name, customerEmail: email });
    }

    setPlacing(false); onOrderPlaced(orderDetail);
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
      <div className="card">{items.map(item=>{const avail=item.quantity>0?item.quantity-item.claimed:-1;const sold=item.quantity>0&&avail<=0;const itemPos=item.image_data?`${item.image_data.x}% ${item.image_data.y}%`:"50% 50%";return(<div key={item.id} className="oi-row" style={{opacity:sold?.5:1}}><div className="oi-info" style={{display:"flex",gap:12,alignItems:"center"}}>{item.image_url&&<img src={item.image_url} alt="" onClick={e=>{e.stopPropagation();setLightboxImg(item.image_url)}} style={{width:56,height:56,borderRadius:8,objectFit:"cover",objectPosition:itemPos,flexShrink:0,cursor:"pointer",transition:"transform .15s"}} onMouseOver={e=>e.target.style.transform="scale(1.05)"} onMouseOut={e=>e.target.style.transform="scale(1)"}/>}<div><div className="oi-name">{item.name}</div><div className="oi-price">{fmt(item.price)}</div>{item.description&&<div className="oi-desc">{item.description}</div>}<div className="oi-avail">{sold?"Sold out":item.quantity>0?`${avail} left`:"Available"}</div></div></div>{!sold&&<div className="qty-ctrl"><button className="qty-btn" onClick={()=>updateCart(item.id,-1,item)} disabled={!cart[item.id]}>−</button><span className="qty-val">{cart[item.id]||0}</span><button className="qty-btn" onClick={()=>updateCart(item.id,1,item)}>+</button></div>}</div>)})}</div>
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

      {/* v26: Pickup window picker */}
      {drop.use_pickup_windows && dropWindows.length > 0 && (
        <div className="card" style={{marginBottom:20}}>
          <h3 style={{marginBottom:4}}>Pick your pickup window</h3>
          <p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:16}}>Choose a time that works for you.</p>
          <div style={{display:"grid",gap:10}}>
            {dropWindows.map(w => {
              const remaining = windowSlotsRemaining(w, orders || [], drop.id);
              const isFull = remaining === 0;
              const isSelected = selectedWindowId === w.id;
              return (
                <button
                  key={w.id}
                  onClick={()=>!isFull&&setSelectedWindowId(w.id)}
                  disabled={isFull}
                  style={{
                    textAlign:"left",
                    padding:"12px 16px",
                    borderRadius:"var(--radius-sm)",
                    border:`2px solid ${isSelected?"var(--accent)":"var(--border)"}`,
                    background:isSelected?"var(--accent-light)":"var(--surface)",
                    cursor:isFull?"not-allowed":"pointer",
                    opacity:isFull?0.5:1,
                    display:"flex",
                    justifyContent:"space-between",
                    alignItems:"center",
                  }}>
                  <span style={{fontWeight:600,color:isSelected?"var(--accent)":"var(--text)"}}>{formatWindow(w)}</span>
                  <span style={{fontSize:12,color:"var(--text-secondary)"}}>
                    {remaining == null ? "Open" : isFull ? "Full" : `${remaining} slot${remaining!==1?"s":""} left`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
<div className="card">
        <h3 style={{marginBottom:16}}>Your Information</h3>

        {/* Step 1 — Email entry */}
        <div className="form-group">
          <label className="form-label">Email</label>
          <div style={{display:"flex",gap:8}}>
            <input
              className="form-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e=>{setEmail(e.target.value);setEmailStep("entry");setReturningCustomer(null);setName("");setPhone("");}}
              disabled={emailStep!=="entry"}
              style={{flex:1}}
            />
            {emailStep==="entry"&&(
              <button
                className="btn btn-secondary"
                onClick={handleEmailContinue}
                disabled={!email||lookingUp}
                style={{whiteSpace:"nowrap"}}>
                {lookingUp?"...":"Continue →"}
              </button>
            )}
            {emailStep!=="entry"&&(
              <button className="btn btn-ghost" onClick={()=>{setEmailStep("entry");setReturningCustomer(null);setName("");setPhone("");}}>Edit</button>
            )}
          </div>
          {emailStep==="entry"&&<div className="form-hint">We'll send your order confirmation here</div>}
        </div>

        {/* Recognized returning customer */}
        {emailStep==="recognized"&&returningCustomer&&(
          <div style={{background:"var(--green-light)",border:"1px solid var(--green)",borderRadius:"var(--radius-sm)",padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>👋</span>
            <div>
              <p style={{margin:0,fontWeight:600,color:"var(--green)",fontSize:14}}>Welcome back, {returningCustomer.name.split(" ")[0]}!</p>
              <p style={{margin:"2px 0 0",fontSize:13,color:"var(--text-secondary)"}}>We've filled in your details below.</p>
            </div>
          </div>
        )}

        {/* Name + phone — shown after email step */}
        {emailStep!=="entry"&&(<>
          <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="(555) 555-5555" value={phone} onChange={e=>setPhone(formatPhone(e.target.value))}/></div>
          <div className="form-group"><label className="form-label">How should we reach you about future drops?</label><div style={{display:"flex",gap:20}}><label className="checkbox-row"><input type="radio" name="prefer" checked={preferContact==="email"} onChange={()=>setPreferContact("email")}/>{I.mail} Email</label><label className="checkbox-row"><input type="radio" name="prefer" checked={preferContact==="sms"} onChange={()=>setPreferContact("sms")}/>{I.phone} Text / SMS</label></div></div>
        </>)}
      </div>
      <button className="btn btn-primary btn-full" style={{marginTop:20,padding:"14px 24px",fontSize:16}} disabled={!name||!email||emailStep==="entry"||placing||(drop.use_pickup_windows&&!selectedWindowId)} onClick={handlePlaceOrder}>{placing?"Placing order...":`Confirm Order — ${fmt(cartTotal)}`}</button>
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
    <div className="card" style={{textAlign:"left",marginTop:12}}><div style={{fontSize:14,fontWeight:600,marginBottom:4}}>📧 Confirmation Sent</div><p style={{fontSize:14,color:"var(--text-secondary)"}}>We've sent your order details to <strong>{order.customerEmail}</strong>. Check your inbox!</p></div>
    <button className="btn btn-secondary" style={{marginTop:24}} onClick={onBack}>← Browse More Drops</button>
  </div>);
}

// --- Customer Signup Form ---
function CustomerSignupForm({ creator, customers, showToast, loadData, onDone }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferContact, setPreferContact] = useState("email");
  const [optedIn, setOptedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !optedIn) return;
    setSaving(true);
    const normalizedEmail = email.toLowerCase().trim();
    try {
      const existing = customers.find(c => c.email.toLowerCase().trim() === normalizedEmail);
      if (existing) {
        // Update existing record — keep their orders intact
        await supabase.from("customers").update({ name, phone, prefer_contact: preferContact, opted_in: true }).eq("id", existing.id).execute();
      } else if (creator) {
        // New customer — insert with signup_source
        const { data: nc, error } = await supabase.from("customers").insert({ creator_id: creator.id, name, email: normalizedEmail, phone: phone || "", prefer_contact: preferContact, opted_in: true, notes: "", welcome_sent: true, signup_source: "signup_form" }).select("*").single().execute();
        if (error) { console.error("Signup insert error:", error); showToast("Something went wrong. Please try again.", "error"); setSaving(false); return; }
        if (nc) {
          // Re-link any orphaned orders (customer_id = null) that match this email
          await supabase.from("orders").update({ customer_id: nc.id }).eq("customer_email", normalizedEmail).execute();
          sendWelcomeEmail({ creator, customerName: name, customerEmail: normalizedEmail });
        }
      }
      setSaving(false); setDone(true); loadData();
    } catch (e) { console.error("Signup exception:", e); showToast("Something went wrong.", "error"); setSaving(false); }
  };

  if (done) return (
    <div className="signup-card" style={{textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:8}}>🎉</div>
      <h3>You're on the list!</h3>
      <p style={{color:"var(--text-secondary)",fontSize:14,marginTop:8}}>We'll let you know when the next drop goes live.</p>
      <button className="btn btn-ghost" style={{marginTop:16}} onClick={onDone}>Close</button>
    </div>
  );

  return (
    <div className="signup-card">
      <h3 style={{marginBottom:4}}>Join the list</h3>
      <p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:20}}>Get notified about upcoming drops from {creator?.name || "us"}.</p>
      <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="(555) 555-5555" value={phone} onChange={e=>setPhone(formatPhone(e.target.value))}/></div>
      <div className="form-group"><label className="form-label">How should we reach you?</label><div style={{display:"flex",gap:20}}><label className="checkbox-row"><input type="radio" name="signup-prefer" checked={preferContact==="email"} onChange={()=>setPreferContact("email")}/>{I.mail} Email</label><label className="checkbox-row"><input type="radio" name="signup-prefer" checked={preferContact==="sms"} onChange={()=>setPreferContact("sms")}/>{I.phone} Text</label></div></div>
      <label className="checkbox-row" style={{marginBottom:20,padding:12,background:"var(--surface-alt)",borderRadius:"var(--radius-sm)"}}><input type="checkbox" checked={optedIn} onChange={e=>setOptedIn(e.target.checked)}/><span style={{fontSize:13}}>I agree to receive notifications about upcoming drops via {preferContact === "sms" ? "text message" : "email"}.</span></label>
      <button className="btn btn-primary btn-full" disabled={!name||!email||!optedIn||saving} onClick={handleSubmit}>{saving ? "Joining..." : "Sign Me Up"}</button>
    </div>
  );
}

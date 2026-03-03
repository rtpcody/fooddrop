import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// FOODDROP MVP — Connected to Supabase
// ============================================================

const SUPABASE_URL = "https://fgkwdobauncgkyuvyfhn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZna3dkb2JhdW5jZ2t5dXZ5ZmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzE5NTEsImV4cCI6MjA4ODE0Nzk1MX0.oLRa9jF6bSe_KX9NZFwe6tuPRxmZ6cn2TQY8I9VZCJE";

// --- Lightweight Supabase REST client ---
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
const Icons = {
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
  loader: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path></svg>,
  refresh: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

// --- Utility ---
const fmt = (n) => `$${Number(n).toFixed(2)}`;
const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

// ============================================================
// STYLES
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Playfair+Display:wght@400;500;600;700&display=swap');

:root {
  --bg: #FAFAF7;
  --surface: #FFFFFF;
  --surface-alt: #F5F3EE;
  --border: #E8E4DC;
  --border-strong: #D4CFC4;
  --text: #1A1916;
  --text-secondary: #6B6760;
  --text-tertiary: #9C978E;
  --accent: #C4572A;
  --accent-light: #FFF0EB;
  --accent-hover: #A8461F;
  --green: #2D7A4F;
  --green-light: #EDFAF2;
  --gold: #B8860B;
  --gold-light: #FFF8E7;
  --red: #C53030;
  --red-light: #FFF5F5;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'DM Sans', -apple-system, sans-serif;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --shadow: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font-body); background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
.app-container { min-height: 100vh; display: flex; flex-direction: column; }

.topbar { background: var(--text); color: white; padding: 10px 24px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 500; }
.topbar-toggle { display: flex; gap: 2px; background: rgba(255,255,255,0.1); border-radius: 6px; padding: 2px; }
.topbar-toggle button { background: transparent; border: none; color: rgba(255,255,255,0.5); padding: 6px 14px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: var(--font-body); letter-spacing: 0.5px; text-transform: uppercase; transition: all 0.2s; }
.topbar-toggle button.active { background: rgba(255,255,255,0.2); color: white; }

.creator-nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 24px; display: flex; gap: 0; }
.creator-nav button { background: none; border: none; padding: 16px 20px; font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
.creator-nav button:hover { color: var(--text); }
.creator-nav button.active { color: var(--accent); border-bottom-color: var(--accent); }

.main-content { flex: 1; max-width: 1100px; width: 100%; margin: 0 auto; padding: 32px 24px; }

h1 { font-family: var(--font-display); font-size: 32px; font-weight: 600; line-height: 1.2; }
h2 { font-family: var(--font-display); font-size: 24px; font-weight: 600; line-height: 1.3; }
h3 { font-family: var(--font-body); font-size: 16px; font-weight: 600; }

.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow-sm); }
.card-hover { transition: all 0.2s; cursor: pointer; }
.card-hover:hover { box-shadow: var(--shadow); border-color: var(--border-strong); transform: translateY(-1px); }

.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; }
.stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); margin-bottom: 8px; }
.stat-value { font-family: var(--font-display); font-size: 28px; font-weight: 600; color: var(--text); }
.stat-sub { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

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
.badge-draft { background: var(--surface-alt); color: var(--text-tertiary); }
.badge-ended { background: var(--surface-alt); color: var(--text-tertiary); }
.badge-fcfs { background: var(--accent-light); color: var(--accent); }
.badge-preorder { background: var(--gold-light); color: var(--gold); }
.badge-picked_up { background: var(--green-light); color: var(--green); }
.badge-cancelled { background: var(--red-light); color: var(--red); }
.badge-confirmed { background: var(--gold-light); color: var(--gold); }

.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; }
.form-input, .form-textarea, .form-select { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px; background: var(--surface); color: var(--text); transition: border-color 0.15s; }
.form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
.form-textarea { resize: vertical; min-height: 80px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); background: var(--surface-alt); border-bottom: 1px solid var(--border); }
td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid var(--border); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--surface-alt); }

.drop-card { border-left: 4px solid var(--accent); }
.drop-card-ended { border-left-color: var(--text-tertiary); }
.drop-meta { display: flex; gap: 20px; margin-top: 12px; font-size: 13px; color: var(--text-secondary); }
.drop-meta-item { display: flex; align-items: center; gap: 6px; }
.drop-items-preview { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.drop-item-chip { background: var(--surface-alt); border: 1px solid var(--border); padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; }

.progress-bar { height: 6px; background: var(--surface-alt); border-radius: 3px; overflow: hidden; margin-top: 6px; }
.progress-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.3s; }
.progress-fill.full { background: var(--text-tertiary); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.modal { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; padding: 32px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }

.storefront-header { text-align: center; padding: 48px 24px 32px; background: linear-gradient(180deg, var(--surface-alt) 0%, var(--bg) 100%); border-bottom: 1px solid var(--border); }
.storefront-title { font-family: var(--font-display); font-size: 36px; font-weight: 700; margin-bottom: 8px; }
.storefront-tagline { color: var(--text-secondary); font-size: 16px; }
.drop-section { max-width: 640px; margin: 0 auto; padding: 32px 24px; }

.order-item-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border); }
.order-item-row:last-child { border-bottom: none; }
.order-item-info { flex: 1; }
.order-item-name { font-weight: 600; font-size: 15px; }
.order-item-price { color: var(--text-secondary); font-size: 14px; margin-top: 2px; }
.order-item-avail { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.qty-control { display: flex; align-items: center; gap: 0; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.qty-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--surface-alt); border: none; cursor: pointer; font-size: 18px; color: var(--text); transition: background 0.1s; }
.qty-btn:hover { background: var(--border); }
.qty-btn:disabled { color: var(--text-tertiary); cursor: default; }
.qty-btn:disabled:hover { background: var(--surface-alt); }
.qty-value { width: 40px; text-align: center; font-weight: 600; font-size: 15px; }

.prep-grid { display: grid; gap: 12px; }
.prep-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--surface-alt); border-radius: var(--radius-sm); }
.prep-item-name { font-weight: 600; }
.prep-item-count { font-family: var(--font-display); font-size: 24px; font-weight: 600; color: var(--accent); }

.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--text); color: white; padding: 14px 24px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; box-shadow: var(--shadow-lg); z-index: 200; display: flex; align-items: center; gap: 10px; animation: toastIn 0.3s ease; }
.toast-error { background: var(--red); }
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

.checkbox-row { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; }
.checkbox-row input { accent-color: var(--accent); width: 16px; height: 16px; }

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.empty-state { text-align: center; padding: 48px 24px; color: var(--text-tertiary); }
.empty-state-icon { width: 56px; height: 56px; background: var(--surface-alt); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: var(--text-tertiary); }

.compose-area { background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-top: 16px; }
.recipient-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.recipient-tag { background: var(--surface); border: 1px solid var(--border); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }

.page-enter { animation: fadeUp 0.25s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 16px; color: var(--text-secondary); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.connection-banner { padding: 10px 24px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; justify-content: center; }
.connection-banner.ok { background: var(--green-light); color: var(--green); }
.connection-banner.err { background: var(--red-light); color: var(--red); }

@media (max-width: 640px) {
  .form-row { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: 1fr 1fr; }
  h1 { font-size: 24px; }
  .main-content { padding: 20px 16px; }
  .storefront-title { font-size: 28px; }
  .creator-nav { overflow-x: auto; }
  .creator-nav button { white-space: nowrap; font-size: 13px; padding: 14px 16px; }
}
`;

// ============================================================
// MAIN APP
// ============================================================
export default function FoodDropApp() {
  const [view, setView] = useState("creator");
  const [creatorTab, setCreatorTab] = useState("dashboard");
  const [creator, setCreator] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [drops, setDrops] = useState([]);
  const [dropItems, setDropItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showNewDrop, setShowNewDrop] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("ok");
  const [loading, setLoading] = useState(true);
  const [dbOk, setDbOk] = useState(null);
  const [customerSignedUp, setCustomerSignedUp] = useState(false);
  const [customerOrder, setCustomerOrder] = useState(null);

  const showToast = useCallback((msg, type = "ok") => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // --- Load all data ---
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

      if (cRes.error || custRes.error || dropsRes.error || diRes.error || ordRes.error || oiRes.error) {
        console.error("Load errors:", { cRes, custRes, dropsRes, diRes, ordRes, oiRes });
        setDbOk(false);
        setLoading(false);
        return;
      }

      setCreator(cRes.data?.[0] || null);
      setCustomers(custRes.data || []);
      setDrops(dropsRes.data || []);
      setDropItems(diRes.data || []);
      setOrders(ordRes.data || []);
      setOrderItems(oiRes.data || []);
      setDbOk(true);
    } catch (e) {
      console.error("Connection error:", e);
      setDbOk(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Helper: get items for a drop ---
  const getDropItems = useCallback((dropId) => dropItems.filter((di) => di.drop_id === dropId), [dropItems]);
  const getDropOrders = useCallback((dropId) => orders.filter((o) => o.drop_id === dropId), [orders]);
  const getOrderItems = useCallback((orderId) => orderItems.filter((oi) => oi.order_id === orderId), [orderItems]);

  // --- Create drop ---
  const handleCreateDrop = async (dropData, items) => {
    if (!creator) return;
    const { data: newDrop, error } = await supabase.from("drops").insert({
      creator_id: creator.id,
      title: dropData.title,
      description: dropData.description,
      status: "active",
      type: dropData.type,
      pickup_date: dropData.pickupDate,
      pickup_time: dropData.pickupTime,
      pickup_location: dropData.pickupLocation,
    }).select("*").single().execute();

    if (error || !newDrop) { showToast("Failed to create drop: " + (error?.message || "Unknown error"), "error"); return; }

    const itemInserts = items.map((item, idx) => ({
      drop_id: newDrop.id,
      name: item.name,
      price: parseFloat(item.price) || 0,
      quantity: item.unlimited ? -1 : parseInt(item.quantity) || 0,
      claimed: 0,
      sort_order: idx,
    }));

    const { error: itemError } = await supabase.from("drop_items").insert(itemInserts).execute();
    if (itemError) { showToast("Drop created but items failed: " + itemError.message, "error"); }

    setShowNewDrop(false);
    showToast("Drop created! Customers can now order.");
    loadData();
  };

  // --- Add customer ---
  const handleAddCustomer = async (custData) => {
    if (!creator) return;
    const { error } = await supabase.from("customers").insert({
      creator_id: creator.id,
      name: custData.name,
      email: custData.email,
      phone: custData.phone,
      prefer_contact: custData.preferContact,
    }).execute();

    if (error) { showToast("Failed to add customer: " + error.message, "error"); return; }
    setShowNewCustomer(false);
    showToast(`${custData.name} added to your customer list.`);
    loadData();
  };

  // --- Place order (customer) ---
  const handlePlaceOrder = async (drop, cartItems, customerInfo) => {
    const dItems = getDropItems(drop.id);
    const total = cartItems.reduce((sum, ci) => {
      const di = dItems.find((d) => d.id === ci.dropItemId);
      return sum + (di ? di.price * ci.qty : 0);
    }, 0);

    // Check if customer exists or create
    let customerId = null;
    if (customerInfo) {
      const existing = customers.find(
        (c) => c.email.toLowerCase() === customerInfo.email.toLowerCase()
      );
      if (existing) {
        customerId = existing.id;
      } else if (creator) {
        const { data: newCust } = await supabase.from("customers").insert({
          creator_id: creator.id,
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone || "",
          prefer_contact: customerInfo.preferContact || "email",
        }).select("*").single().execute();
        if (newCust) customerId = newCust.id;
      }
    }

    const { data: newOrder, error } = await supabase.from("orders").insert({
      drop_id: drop.id,
      customer_id: customerId,
      total,
      status: "confirmed",
      customer_name: customerInfo?.name || "Guest",
      customer_email: customerInfo?.email || "",
    }).select("*").single().execute();

    if (error || !newOrder) { showToast("Failed to place order: " + (error?.message || ""), "error"); return; }

    const oiInserts = cartItems.map((ci) => {
      const di = dItems.find((d) => d.id === ci.dropItemId);
      return {
        order_id: newOrder.id,
        drop_item_id: ci.dropItemId,
        item_name: di?.name || "Unknown",
        item_price: di?.price || 0,
        quantity: ci.qty,
      };
    });
    await supabase.from("order_items").insert(oiInserts).execute();

    // Update claimed counts
    for (const ci of cartItems) {
      const di = dItems.find((d) => d.id === ci.dropItemId);
      if (di) {
        await supabase.from("drop_items").update({ claimed: di.claimed + ci.qty }).eq("id", di.id).execute();
      }
    }

    setCustomerOrder(newOrder);
    showToast("Order placed!");
    loadData();
  };

  // --- Update order status ---
  const handleUpdateOrderStatus = async (orderId, status) => {
    await supabase.from("orders").update({ status }).eq("id", orderId).execute();
    showToast(`Order marked as ${status.replace("_", " ")}.`);
    loadData();
  };

  // --- End drop ---
  const handleEndDrop = async (dropId) => {
    await supabase.from("drops").update({ status: "ended" }).eq("id", dropId).execute();
    showToast("Drop ended.");
    setSelectedDrop(null);
    loadData();
  };

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="app-container">
          <div className="topbar">
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: 0, textTransform: "none" }}>🍽️ FoodDrop</span>
          </div>
          <div className="loading-screen">
            <div className="spin" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
            <span>Connecting to database...</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app-container">
        <div className="topbar">
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: 0, textTransform: "none" }}>🍽️ FoodDrop</span>
          <div className="topbar-toggle">
            <button className={view === "creator" ? "active" : ""} onClick={() => setView("creator")}>Creator Dashboard</button>
            <button className={view === "customer" ? "active" : ""} onClick={() => { setView("customer"); setCustomerOrder(null); }}>Customer View</button>
          </div>
        </div>

        {dbOk === false && (
          <div className="connection-banner err">
            ⚠️ Could not connect to database. Make sure you've run the schema SQL in Supabase.
            <button className="btn btn-sm btn-ghost" onClick={loadData} style={{ marginLeft: 8, color: "var(--red)" }}>{Icons.refresh} Retry</button>
          </div>
        )}
        {dbOk === true && !creator && (
          <div className="connection-banner err">
            ⚠️ Connected, but no creator profile found. Run the schema SQL to create the seed data.
            <button className="btn btn-sm btn-ghost" onClick={loadData} style={{ marginLeft: 8 }}>{Icons.refresh} Retry</button>
          </div>
        )}

        {view === "creator" ? (
          <CreatorView
            tab={creatorTab} setTab={setCreatorTab}
            creator={creator} customers={customers}
            drops={drops} orders={orders}
            getDropItems={getDropItems} getDropOrders={getDropOrders} getOrderItems={getOrderItems}
            selectedDrop={selectedDrop} setSelectedDrop={setSelectedDrop}
            showNewDrop={showNewDrop} setShowNewDrop={setShowNewDrop}
            showNewCustomer={showNewCustomer} setShowNewCustomer={setShowNewCustomer}
            showCompose={showCompose} setShowCompose={setShowCompose}
            onCreateDrop={handleCreateDrop} onAddCustomer={handleAddCustomer}
            onUpdateOrderStatus={handleUpdateOrderStatus} onEndDrop={handleEndDrop}
            showToast={showToast} loadData={loadData}
          />
        ) : (
          <CustomerView
            creator={creator} drops={drops}
            getDropItems={getDropItems}
            onPlaceOrder={handlePlaceOrder}
            customerSignedUp={customerSignedUp} setCustomerSignedUp={setCustomerSignedUp}
            customerOrder={customerOrder}
          />
        )}

        {toast && <div className={`toast ${toastType === "error" ? "toast-error" : ""}`}>{toastType === "error" ? "⚠️" : ""}{toastType !== "error" && Icons.check}{toast}</div>}
      </div>
    </>
  );
}

// ============================================================
// CREATOR VIEW
// ============================================================
function CreatorView({ tab, setTab, creator, customers, drops, orders, getDropItems, getDropOrders, getOrderItems, selectedDrop, setSelectedDrop, showNewDrop, setShowNewDrop, showNewCustomer, setShowNewCustomer, showCompose, setShowCompose, onCreateDrop, onAddCustomer, onUpdateOrderStatus, onEndDrop, showToast, loadData }) {
  return (
    <>
      <nav className="creator-nav">
        {[ { key: "dashboard", label: "Dashboard", icon: Icons.home }, { key: "drops", label: "Drops", icon: Icons.drop }, { key: "customers", label: "Customers", icon: Icons.users } ].map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => { setTab(t.key); setSelectedDrop(null); }}>{t.icon} {t.label}</button>
        ))}
      </nav>
      <div className="main-content page-enter" key={tab + (selectedDrop?.id || "")}>
        {tab === "dashboard" && <DashboardTab customers={customers} drops={drops} orders={orders} getDropItems={getDropItems} getDropOrders={getDropOrders} onViewDrop={(d) => { setSelectedDrop(d); setTab("drops"); }} />}
        {tab === "drops" && !selectedDrop && <DropsTab drops={drops} orders={orders} getDropItems={getDropItems} getDropOrders={getDropOrders} onSelect={setSelectedDrop} onNew={() => setShowNewDrop(true)} />}
        {tab === "drops" && selectedDrop && <DropDetail drop={selectedDrop} getDropItems={getDropItems} getDropOrders={getDropOrders} getOrderItems={getOrderItems} customers={customers} onBack={() => setSelectedDrop(null)} onUpdateOrderStatus={onUpdateOrderStatus} onEndDrop={onEndDrop} />}
        {tab === "customers" && <CustomersTab customers={customers} orders={orders} drops={drops} onAddCustomer={() => setShowNewCustomer(true)} onCompose={() => setShowCompose(true)} />}
      </div>
      {showNewDrop && <NewDropModal onSave={onCreateDrop} onClose={() => setShowNewDrop(false)} />}
      {showNewCustomer && <NewCustomerModal onSave={onAddCustomer} onClose={() => setShowNewCustomer(false)} />}
      {showCompose && <ComposeModal customers={customers} onClose={() => setShowCompose(false)} onSend={() => { setShowCompose(false); showToast("Message draft ready! Copy and send via your preferred channel."); }} />}
    </>
  );
}

// --- Dashboard ---
function DashboardTab({ customers, drops, orders, getDropItems, getDropOrders, onViewDrop }) {
  const activeDrops = drops.filter((d) => d.status === "active");
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1>Dashboard</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Overview of your food drop business</p>
      </div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Customers</div><div className="stat-value">{customers.length}</div><div className="stat-sub">Total signed up</div></div>
        <div className="stat-card"><div className="stat-label">Active Drops</div><div className="stat-value">{activeDrops.length}</div><div className="stat-sub">Open for orders</div></div>
        <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{orders.length}</div><div className="stat-sub">Across all drops</div></div>
        <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">{fmt(totalRevenue)}</div><div className="stat-sub">Cash to collect</div></div>
      </div>
      {activeDrops.length > 0 && (
        <>
          <div className="section-header"><h2>Active Drops</h2></div>
          <div style={{ display: "grid", gap: 16 }}>
            {activeDrops.map((drop) => {
              const dOrders = getDropOrders(drop.id);
              return (
                <div key={drop.id} className="card card-hover drop-card" onClick={() => onViewDrop(drop)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3>{drop.title}</h3>
                      <div className="drop-meta">
                        <span className="drop-meta-item">{Icons.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span>
                        <span className="drop-meta-item">{Icons.pin} {drop.pickup_location}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span className="badge badge-active">Active</span>
                      <span className={`badge ${drop.type === "fcfs" ? "badge-fcfs" : "badge-preorder"}`}>{drop.type === "fcfs" ? "FCFS" : "Pre-order"}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, fontSize: 14, color: "var(--text-secondary)" }}>
                    <strong style={{ color: "var(--text)" }}>{dOrders.length}</strong> orders · <strong style={{ color: "var(--text)" }}>{fmt(dOrders.reduce((s, o) => s + Number(o.total), 0))}</strong> revenue
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// --- Drops List ---
function DropsTab({ drops, orders, getDropItems, getDropOrders, onSelect, onNew }) {
  return (
    <>
      <div className="section-header">
        <div><h1>Drops</h1><p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Manage your food drops</p></div>
        <button className="btn btn-primary" onClick={onNew}>{Icons.plus} New Drop</button>
      </div>
      {drops.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">{Icons.drop}</div><h3>No drops yet</h3><p style={{ marginTop: 8 }}>Create your first drop to start taking orders.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {drops.map((drop) => {
            const dItems = getDropItems(drop.id);
            const dOrders = getDropOrders(drop.id);
            return (
              <div key={drop.id} className={`card card-hover drop-card ${drop.status === "ended" ? "drop-card-ended" : ""}`} onClick={() => onSelect(drop)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>{drop.title}</h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>{drop.description}</p>
                    <div className="drop-meta">
                      <span className="drop-meta-item">{Icons.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span>
                      <span className="drop-meta-item">{Icons.pin} {drop.pickup_location}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <span className={`badge badge-${drop.status}`}>{drop.status === "active" ? "Active" : drop.status === "draft" ? "Draft" : "Ended"}</span>
                    <span className={`badge ${drop.type === "fcfs" ? "badge-fcfs" : "badge-preorder"}`}>{drop.type === "fcfs" ? "FCFS" : "Pre-order"}</span>
                  </div>
                </div>
                <div className="drop-items-preview">
                  {dItems.map((item) => (
                    <span key={item.id} className="drop-item-chip">{item.name} · {fmt(item.price)} {item.quantity > 0 ? `· ${item.claimed}/${item.quantity}` : "· Unlimited"}</span>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--text)" }}>{dOrders.length}</strong> order{dOrders.length !== 1 ? "s" : ""} · <strong style={{ color: "var(--text)" }}>{fmt(dOrders.reduce((s, o) => s + Number(o.total), 0))}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// --- Drop Detail ---
function DropDetail({ drop, getDropItems, getDropOrders, getOrderItems, customers, onBack, onUpdateOrderStatus, onEndDrop }) {
  const dItems = getDropItems(drop.id);
  const dOrders = getDropOrders(drop.id);
  const totalRevenue = dOrders.reduce((s, o) => s + Number(o.total), 0);

  const prepSummary = dItems.map((item) => {
    const totalQty = dOrders.reduce((sum, order) => {
      const ois = getOrderItems(order.id);
      const oi = ois.find((i) => i.drop_item_id === item.id);
      return sum + (oi ? oi.quantity : 0);
    }, 0);
    return { ...item, totalOrdered: totalQty };
  });

  return (
    <>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>{Icons.back} Back to Drops</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>{drop.title}</h1>
          <div className="drop-meta" style={{ marginTop: 8 }}>
            <span className="drop-meta-item">{Icons.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span>
            <span className="drop-meta-item">{Icons.pin} {drop.pickup_location}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`badge badge-${drop.status}`}>{drop.status === "active" ? "Active" : "Ended"}</span>
          <span className={`badge ${drop.type === "fcfs" ? "badge-fcfs" : "badge-preorder"}`}>{drop.type === "fcfs" ? "FCFS" : "Pre-order"}</span>
          {drop.status === "active" && (
            <button className="btn btn-danger btn-sm" onClick={() => onEndDrop(drop.id)}>End Drop</button>
          )}
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Orders</div><div className="stat-value">{dOrders.length}</div></div>
        <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">{fmt(totalRevenue)}</div><div className="stat-sub">Cash to collect</div></div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div className="section-header"><h2>🧑‍🍳 Prep Summary</h2></div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Exactly what you need to prepare for this drop.</p>
        <div className="prep-grid">
          {prepSummary.map((item) => (
            <div key={item.id} className="prep-item">
              <div>
                <div className="prep-item-name">{item.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                  {fmt(item.price)} each · {item.quantity > 0 ? `${item.quantity - item.totalOrdered} remaining of ${item.quantity}` : "Unlimited"}
                </div>
                {item.quantity > 0 && (
                  <div className="progress-bar" style={{ width: 160, marginTop: 8 }}>
                    <div className={`progress-fill ${item.totalOrdered >= item.quantity ? "full" : ""}`} style={{ width: `${Math.min((item.totalOrdered / item.quantity) * 100, 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="prep-item-count">{item.totalOrdered}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div className="section-header"><h2>Orders</h2></div>
        {dOrders.length === 0 ? (
          <div className="empty-state"><p>No orders yet for this drop.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {dOrders.map((order) => {
                  const cust = customers.find((c) => c.id === order.customer_id);
                  const ois = getOrderItems(order.id);
                  return (
                    <tr key={order.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{cust?.name || order.customer_name || "Guest"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{cust?.email || order.customer_email}</div>
                      </td>
                      <td>{ois.map((oi) => <div key={oi.id} style={{ fontSize: 13 }}>{oi.quantity}× {oi.item_name}</div>)}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(order.total)}</td>
                      <td><span className={`badge badge-${order.status}`}>{order.status === "picked_up" ? "Picked Up" : order.status === "cancelled" ? "Cancelled" : "Confirmed"}</span></td>
                      <td>
                        {order.status === "confirmed" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => onUpdateOrderStatus(order.id, "picked_up")}>{Icons.check} Picked Up</button>
                            <button className="btn btn-sm btn-ghost" onClick={() => onUpdateOrderStatus(order.id, "cancelled")} style={{ color: "var(--red)" }}>Cancel</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="section-header"><h2>Menu Items</h2></div>
        <div style={{ display: "grid", gap: 12 }}>
          {dItems.map((item) => {
            const pct = item.quantity > 0 ? Math.min((item.claimed / item.quantity) * 100, 100) : 0;
            return (
              <div key={item.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3>{item.name}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>{fmt(item.price)} · {item.quantity > 0 ? `${item.claimed} of ${item.quantity} claimed` : `${item.claimed} claimed (unlimited)`}</div>
                  </div>
                  {item.quantity > 0 && item.claimed >= item.quantity && <span className="badge badge-ended">Sold Out</span>}
                </div>
                {item.quantity > 0 && <div className="progress-bar" style={{ marginTop: 12 }}><div className={`progress-fill ${pct >= 100 ? "full" : ""}`} style={{ width: `${pct}%` }} /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// --- Customers Tab ---
function CustomersTab({ customers, orders, drops, onAddCustomer, onCompose }) {
  return (
    <>
      <div className="section-header">
        <div><h1>Customers</h1><p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{customers.length} customer{customers.length !== 1 ? "s" : ""}</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={onCompose}>{Icons.send} Compose</button>
          <button className="btn btn-primary" onClick={onAddCustomer}>{Icons.plus} Add Customer</button>
        </div>
      </div>
      {customers.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">{Icons.users}</div><h3>No customers yet</h3><p style={{ marginTop: 8 }}>Add customers or share your page.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Contact</th><th>Preferred</th><th>Orders</th><th>Total Spent</th><th>Joined</th></tr></thead>
            <tbody>
              {customers.map((c) => {
                const custOrders = orders.filter((o) => o.customer_id === c.id);
                const totalSpent = custOrders.reduce((s, o) => s + Number(o.total), 0);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><div style={{ fontSize: 13 }}>{c.email}</div>{c.phone && <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{c.phone}</div>}</td>
                    <td><span className={`badge ${c.prefer_contact === "sms" ? "badge-fcfs" : "badge-preorder"}`}>{c.prefer_contact === "sms" ? "SMS" : "Email"}</span></td>
                    <td>{custOrders.length}</td>
                    <td style={{ fontWeight: 500 }}>{fmt(totalSpent)}</td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.joined_at ? fmtDate(c.joined_at) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ============================================================
// MODALS
// ============================================================
function NewDropModal({ onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("fcfs");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [items, setItems] = useState([{ id: "i0", name: "", price: "", quantity: "", unlimited: false }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, { id: `i${Date.now()}`, name: "", price: "", quantity: "", unlimited: false }]);
  const removeItem = (id) => items.length > 1 && setItems(items.filter((i) => i.id !== id));
  const updateItem = (id, field, value) => setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const canSave = title && pickupDate && pickupTime && pickupLocation && items.every((i) => i.name && i.price) && !saving;

  const handleSave = async () => {
    setSaving(true);
    await onSave({ title, description: desc, type, pickupDate, pickupTime, pickupLocation }, items);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Create New Drop</h2><button className="btn btn-ghost" onClick={onClose}>{Icons.x}</button></div>
        <div className="form-group"><label className="form-label">Drop Title</label><input className="form-input" placeholder='e.g., "Friday Dinner Box — March 6"' value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" placeholder="Describe what's in this drop..." value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Order Type</label><select className="form-select" value={type} onChange={(e) => setType(e.target.value)}><option value="fcfs">First Come, First Served</option><option value="preorder">Pre-order Window</option></select></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Pickup Date</label><input className="form-input" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Pickup Time</label><input className="form-input" placeholder='e.g., "5:00 PM – 7:00 PM"' value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Pickup Location</label><input className="form-input" placeholder="123 Main St, Boston" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} /></div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Menu Items</label>
            <button className="btn btn-ghost btn-sm" onClick={addItem}>{Icons.plus} Add Item</button>
          </div>
          {items.map((item, idx) => (
            <div key={item.id} style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Item {idx + 1}</span>
                {items.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => removeItem(item.id)} style={{ color: "var(--accent)", padding: 4 }}>{Icons.x}</button>}
              </div>
              <input className="form-input" placeholder="Item name" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} style={{ marginBottom: 8 }} />
              <div className="form-row">
                <input className="form-input" type="number" placeholder="Price" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(item.id, "price", e.target.value)} />
                <input className="form-input" type="number" placeholder="Quantity" min="1" value={item.unlimited ? "" : item.quantity} disabled={item.unlimited} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} />
              </div>
              <label className="checkbox-row" style={{ marginTop: 10 }}><input type="checkbox" checked={item.unlimited} onChange={(e) => updateItem(item.id, "unlimited", e.target.checked)} />Unlimited quantity</label>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-full" disabled={!canSave} onClick={handleSave}>
          {saving ? "Creating..." : "Create Drop"}
        </button>
      </div>
    </div>
  );
}

function NewCustomerModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [prefer, setPrefer] = useState("email");
  const [saving, setSaving] = useState(false);
  const canSave = name && email && !saving;

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name, email, phone, preferContact: prefer });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Add Customer</h2><button className="btn btn-ghost" onClick={onClose}>{Icons.x}</button></div>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" placeholder="555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Preferred Contact</label><select className="form-select" value={prefer} onChange={(e) => setPrefer(e.target.value)}><option value="email">Email</option><option value="sms">SMS / Text</option></select></div>
        <button className="btn btn-primary btn-full" disabled={!canSave} onClick={handleSave}>{saving ? "Adding..." : "Add Customer"}</button>
      </div>
    </div>
  );
}

function ComposeModal({ customers, onClose, onSend }) {
  const [message, setMessage] = useState("Hey! 🍽️ A new drop just went live — check it out and grab your order before it sells out!");
  const [selectedIds, setSelectedIds] = useState(customers.map((c) => c.id));
  const toggleCustomer = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const smsCustomers = customers.filter((c) => selectedIds.includes(c.id) && c.prefer_contact === "sms");
  const emailCustomers = customers.filter((c) => selectedIds.includes(c.id) && c.prefer_contact === "email");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header"><h2>Compose Message</h2><button className="btn btn-ghost" onClick={onClose}>{Icons.x}</button></div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Recipients ({selectedIds.length})</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(customers.map((c) => c.id))}>All</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>None</button>
            </div>
          </div>
          <div style={{ maxHeight: 140, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 8 }}>
            {customers.map((c) => (
              <label key={c.id} className="checkbox-row" style={{ padding: "6px 8px" }}>
                <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleCustomer(c.id)} />
                <span>{c.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>{c.prefer_contact === "sms" ? "SMS" : "Email"}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="form-group"><label className="form-label">Message</label><textarea className="form-textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <div className="compose-area">
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Ready to send to:</p>
          {smsCustomers.length > 0 && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>VIA SMS ({smsCustomers.length}):</span><div className="recipient-tags" style={{ marginTop: 4 }}>{smsCustomers.map((c) => <span key={c.id} className="recipient-tag">{c.name} · {c.phone}</span>)}</div></div>}
          {emailCustomers.length > 0 && <div><span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>VIA EMAIL ({emailCustomers.length}):</span><div className="recipient-tags" style={{ marginTop: 4 }}>{emailCustomers.map((c) => <span key={c.id} className="recipient-tag">{c.name} · {c.email}</span>)}</div></div>}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 }}>💡 Copy this message and send via Google Voice or email. Automated sending coming soon!</p>
        <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={onSend}>{Icons.clipboard} Copy Message & Recipients</button>
      </div>
    </div>
  );
}

// ============================================================
// CUSTOMER VIEW
// ============================================================
function CustomerView({ creator, drops, getDropItems, onPlaceOrder, customerSignedUp, setCustomerSignedUp, customerOrder }) {
  const [signupForm, setSignupForm] = useState({ name: "", email: "", phone: "", preferContact: "email" });
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [placing, setPlacing] = useState(false);
  const activeDrops = drops.filter((d) => d.status === "active");

  const handleSignup = () => {
    setCurrentCustomer(signupForm);
    setCustomerSignedUp(true);
  };

  const updateCart = (itemId, delta, item) => {
    setCart((prev) => {
      const curr = prev[itemId] || 0;
      const next = Math.max(0, curr + delta);
      const maxQty = item.quantity > 0 ? item.quantity - item.claimed : 999;
      if (next > maxQty) return prev;
      return { ...prev, [itemId]: next };
    });
  };

  const placeOrder = async (drop) => {
    const dItems = getDropItems(drop.id);
    const cartItems = Object.entries(cart).filter(([, qty]) => qty > 0).map(([itemId, qty]) => ({ dropItemId: itemId, qty }));
    if (cartItems.length === 0) return;
    setPlacing(true);
    await onPlaceOrder(drop, cartItems, currentCustomer || signupForm);
    setCart({});
    setPlacing(false);
  };

  const cartTotal = (drop) => {
    const dItems = getDropItems(drop.id);
    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = dItems.find((i) => i.id === itemId);
      return sum + (item ? Number(item.price) * qty : 0);
    }, 0);
  };
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  return (
    <>
      <div className="storefront-header">
        <div className="storefront-title">{creator?.name || "FoodDrop"}</div>
        <div className="storefront-tagline">{creator?.tagline || ""}</div>
      </div>
      <div className="drop-section page-enter">
        {!customerSignedUp && (
          <div className="card" style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 4 }}>Join the list</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Sign up to get notified about new drops and place orders.</p>
            <div className="form-group"><input className="form-input" placeholder="Your name" value={signupForm.name} onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })} /></div>
            <div className="form-group"><input className="form-input" type="email" placeholder="Email address" value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} /></div>
            <div className="form-group"><input className="form-input" placeholder="Phone number (optional)" value={signupForm.phone} onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })} /></div>
            <div className="form-group">
              <label className="form-label">How should we reach you?</label>
              <div style={{ display: "flex", gap: 16 }}>
                <label className="checkbox-row"><input type="radio" name="contact" checked={signupForm.preferContact === "email"} onChange={() => setSignupForm({ ...signupForm, preferContact: "email" })} />Email</label>
                <label className="checkbox-row"><input type="radio" name="contact" checked={signupForm.preferContact === "sms"} onChange={() => setSignupForm({ ...signupForm, preferContact: "sms" })} />Text / SMS</label>
              </div>
            </div>
            <button className="btn btn-primary btn-full" disabled={!signupForm.name || !signupForm.email} onClick={handleSignup}>Sign Up</button>
          </div>
        )}

        {customerSignedUp && !customerOrder && (
          <div className="card" style={{ marginBottom: 24, background: "var(--green-light)", border: "1px solid #c3e6d1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{Icons.check}<div><div style={{ fontWeight: 600, color: "var(--green)" }}>You're on the list{currentCustomer ? `, ${currentCustomer.name.split(" ")[0]}` : ""}!</div><div style={{ fontSize: 13, color: "var(--text-secondary)" }}>You'll be notified when new drops go live.</div></div></div>
          </div>
        )}

        {customerOrder && (
          <div className="card" style={{ marginBottom: 24, background: "var(--green-light)", border: "1px solid #c3e6d1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>{Icons.check}<div style={{ fontWeight: 600, color: "var(--green)" }}>Order confirmed!</div></div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Your total is <strong>{fmt(customerOrder.total)}</strong> — pay cash at pickup. See you there!</p>
          </div>
        )}

        {activeDrops.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">{Icons.drop}</div><h3>No active drops right now</h3><p style={{ marginTop: 8 }}>Check back soon!</p></div>
        ) : (
          activeDrops.map((drop) => {
            const dItems = getDropItems(drop.id);
            return (
              <div key={drop.id} className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h2>{drop.title}</h2>
                  <span className={`badge ${drop.type === "fcfs" ? "badge-fcfs" : "badge-preorder"}`}>{drop.type === "fcfs" ? "First come, first served" : "Pre-order"}</span>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 12 }}>{drop.description}</p>
                <div className="drop-meta" style={{ marginBottom: 20 }}>
                  <span className="drop-meta-item">{Icons.clock} {fmtDate(drop.pickup_date)}, {drop.pickup_time}</span>
                  <span className="drop-meta-item">{Icons.pin} {drop.pickup_location}</span>
                </div>
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {dItems.map((item) => {
                    const avail = item.quantity > 0 ? item.quantity - item.claimed : -1;
                    const soldOut = item.quantity > 0 && avail <= 0;
                    return (
                      <div key={item.id} className="order-item-row" style={{ opacity: soldOut ? 0.5 : 1 }}>
                        <div className="order-item-info">
                          <div className="order-item-name">{item.name}</div>
                          <div className="order-item-price">{fmt(item.price)}</div>
                          <div className="order-item-avail">{soldOut ? "Sold out" : item.quantity > 0 ? `${avail} left` : "Available"}</div>
                        </div>
                        {!soldOut && !customerOrder && (
                          <div className="qty-control">
                            <button className="qty-btn" onClick={() => updateCart(item.id, -1, item)} disabled={!cart[item.id]}>−</button>
                            <span className="qty-value">{cart[item.id] || 0}</span>
                            <button className="qty-btn" onClick={() => updateCart(item.id, 1, item)}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {cartCount > 0 && !customerOrder && (
                  <div style={{ marginTop: 20, padding: "16px 0 0", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{cartCount} item{cartCount !== 1 ? "s" : ""}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>{fmt(cartTotal(drop))}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>💵 Pay cash at pickup</p>
                    <button className="btn btn-primary btn-full" disabled={placing} onClick={() => placeOrder(drop)}>{placing ? "Placing order..." : "Place Order"}</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

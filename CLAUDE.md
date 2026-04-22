[FoodDrop_CLAUDE_Handoff.md](https://github.com/user-attachments/files/26973700/FoodDrop_CLAUDE_Handoff.md)
# FoodDrop — Handoff to Claude Code

**Last updated:** April 22, 2026 · Generated end of Claude.ai chat session before moving to Claude Code.

This doc is the complete context you need to pick up development exactly where we left off. Paste it into Claude Code (or save it as `CLAUDE.md` in the repo root — Claude Code reads that automatically on every session).

---

## 1. What FoodDrop Is

A CRM and drop management platform for cottage food creators (home bakers, pop-up chefs, cottage food operators) to manage limited-availability food drops, customers, and orders. Cody Miller is the founder and sole developer; Claude is the technical co-builder. Cody writes no code himself — all code is written by Claude and Cody handles GitHub commits, Supabase SQL, and real-world creator testing.

Broader vision is "Warmly / Maker Platform" — FoodDrop is step one of a platform for small food creators with products, drops, AI licensing help, recipe costing, and more.

**Primary competitor:** Hotplate (YC-backed, SMS-first). FoodDrop differentiates as CRM-first and a true startup platform for first-time creators, not just an order form.

**Revenue model:** 4% + $0.45 customer-facing fee, Stripe costs passed through to creators transparently. CRM is free initially.

**Target creator ICP:** Tech-savvy food creator, 20s–30s, social media presence, growing personal brand.

---

## 2. Current Production State

**Live app:** `app.getfooddrop.com` (CNAME to Vercel)
**Marketing site:** `getfooddrop.com` (Squarespace-hosted, separate repo `rtpcody/fooddrop-landing`)
**Dev preview:** `fooddrop-git-dev-rtpcodys-projects.vercel.app`

**Current code version: v28a** (Products tab CRUD shipped, drop-form autocomplete NOT yet shipped — that's v28b, the next planned version).

**Release history (reverse chron):**
- **v28a** — Products tab (creator product library). CRUD for products with name/description/price/image/tags/SKU/capacity_weight. Archive + permanent delete. `products` table created with RLS, `drop_items.product_id` nullable FK added. Post-deploy bug: my v28a diff for `PermanentDeleteDropModal` got pasted *inside* `BulkDeleteCustomersModal`'s body, wiping that modal's body and breaking parse. Fixed by restoring `BulkDeleteCustomersModal` from v26 source.
- **v27.1** — Three fixes. (1) Archived drop Delete button actually deletes (modal was never rendered — orphaned state). (2) View resets after delete (side effect of fix #1). (3) "Send preview to me" button on announcement modal — reuses `/api/send-blast` with a one-customer list, does NOT flip `announcement_sent_at`.
- **v27b** — Email polish. (1) `.ics` calendar invite attached to order confirmation emails. Uses specific pickup window if drop uses windows, falls back to parsed `pickup_time`, falls back to all-day event. Floating local time (no TZID). (2) Drop cover image banner 600×220 on confirmation email. (3) Announcement email rebranded to welcome-email aesthetic (dark `#2C2018` header band, Georgia serif, `#C4856A` accent, dark footer band).
- **v27a** — Dashboard calendar view. Month grid toggle alongside list view on Drops tab. Click empty day → create new drop prefilled. "Also in {month}" hint inside drop form with same-day conflict warning. No SQL — pure client.
- **v26** — Pickup windows with slot limits. Opt-in per drop via `use_pickup_windows` boolean + `pickup_windows` jsonb. Window picker at checkout. Pickup checklist groups by window. Orders table adds "Window" column when drop uses windows. Known limit: TOCTOU race if two customers target the last slot simultaneously. Acceptable at current scale.
- **v25** — Required-field asterisks on drop form, hide expired drops from storefront (date-based, not time-based), announcement-sent indicator with confirm-before-resend using new `announcement_sent_at` + `announcement_sent_count` columns.
- **v20–v24** — Manual order builder + invoice foundation, creator order notifications, returning customer recognition at checkout, bulk customer operations, duplicate customer fix, cancelled-order revenue fix, `signup_source` tracking, archive-drop delete RLS fix.
- **v17–v19** — Welcome email in Settings + trigger, pan-to-crop image picker with jsonb `image_data` pan positions.

---

## 3. Tech Stack

- **Frontend:** React single-file architecture in `src/App.jsx`, Vite, hash-based routing. No TypeScript, no component library, custom CSS in a big template literal constant.
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage + RLS). Custom lightweight client implemented inline in `App.jsx` — not the official `@supabase/supabase-js` package. Calls are `.execute()`-terminated.
- **Deployment:** Vercel. Serverless functions in `api/` folder. GitHub account: `rtpcody`, repo: `rtpcody/fooddrop`.
- **Email:** Resend (domain verified at `getfooddrop.com`). Transactional through `orders@getfooddrop.com`.
- **SMS (planned):** Twilio. Scaffolded but not wired in `api/send-blast.js`.
- **Payments (planned):** Stripe Connect Express (decision finalized — not a stepping stone to Custom; deferred onboarding pattern; destination charges shift chargebacks to creator).
- **Forms (landing page only):** Formspree (ID `mqeyqyqo`). Not used by the app.
- **Analytics:** Google Analytics `G-FRLFSCE3N5` on landing page.
- **Domain registrar:** Squarespace (DNS management).
- **Creator email:** Google Workspace `info@getfooddrop.com`.

**Supabase project:**
- URL: `https://fgkwdobauncgkyuvyfhn.supabase.co`
- Project ref: `fgkwdobauncgkyuvyfhn`
- Key: legacy anon key (stored in `src/App.jsx` — search for `SUPABASE_KEY`)

**Asana:** Project "FoodDrop 30-60-90" (GID `1214010900797667`, created April 9 2026). **Use this GID directly** — more reliable than searching by name. The older board "FoodDrop 30-60-90 Day Plan" (GID `1213758299774296`) is archived, ignore it. Section GIDs:
- Days 1–30: `1214003621737182`
- Days 31–60: `1214003537110000`
- Days 61–90: `1214003537110013`

---

## 4. Current Database Schema

All tables have `creator_id` foreign key and RLS policies scoped to `creators.auth_user_id = auth.uid()`.

### `creators`
`id, name, tagline, slug, auth_user_id, email, theme(jsonb), hero_image_url, hero_image_data(jsonb), logo_url, logo_data(jsonb), bio, how_drops_work, social_links(jsonb), welcome_photo_url, welcome_photo_data(jsonb), created_at`

### `customers`
`id, creator_id, name, email, phone, prefer_contact(email/sms), notes, opted_in, joined_at, created_at, welcome_sent, signup_source(order/signup_form/manual)`

### `drops`
`id, creator_id, title, description, status(active/ended), type(standard), pickup_date, pickup_time, pickup_location, image_url, image_data(jsonb), archived, created_at, announcement_sent_at(timestamptz), announcement_sent_count(integer default 0), use_pickup_windows(boolean), pickup_windows(jsonb)`

### `drop_items`
`id, drop_id, name, description, price, quantity(-1=unlimited), claimed, sort_order, image_url, image_data(jsonb), product_id(uuid nullable FK → products)`

### `orders`
`id, drop_id, customer_id, customer_name, customer_email, total, status(confirmed/picked_up/cancelled), payment_method(cash/venmo/invoice), payment_status(paid/unpaid), pickup_window_id(text nullable), created_at`

### `order_items`
`id, order_id, drop_item_id, item_name, item_price, quantity`

### `products` (new in v28a)
`id, creator_id, name, description, price(numeric 10,2), image_url, image_data(jsonb), sku, tags(text[]), capacity_weight(numeric 6,2 default 1), archived, created_at`

### `pickup_windows` jsonb shape
Stored on `drops.pickup_windows`:
```json
[{"id":"w1","start":"17:00","end":"17:30","slotLimit":5},
 {"id":"w2","start":"17:30","end":"18:00","slotLimit":null}]
```
`slotLimit: null` = unlimited. `id` is client-generated string scoped within the drop (typical `w{timestamp}`).

### RLS pattern — copy this for every new table
```sql
alter table <NAME> enable row level security;

create policy "<name>_select_own" on <NAME>
  for select using (
    creator_id in (select id from creators where auth_user_id = auth.uid())
  );
-- Repeat for insert/update/delete. SELECT does NOT imply DELETE.
```

RLS failure modes to remember:
- Missing DELETE policy → silent no-op from the client
- `PGRST204` = column doesn't exist, migration needed
- `23514` = check constraint violation (error includes constraint name)

---

## 5. Active Creators

- **Temple Kitchen** (external) — slug `temple-kitchen`, login `camerondavidwill@gmail.com`, Hawaii-based, weekly dinner box drops, Friday pickups. First external creator, has launched live drops.
- **Warmly Cookies** (Cody's test/dogfood account) — slug `warmly-cookies`.
- **Spanish Salads** — test account.
- **Pizza creator (name TBD)** — surfaced the v28.1 capacity-weight need.

---

## 6. Vercel Serverless Functions

All in `api/` folder. Deployed paths are literal filenames — **filename must match the URL path**.

- `api/send-email.js` — order confirmation. v27b adds `.ics` attachment + 600×220 banner. Accepts `pickupStart24h/pickupEnd24h` for structured .ics, falls back to parsing `pickupTime` string, falls back to all-day event.
- `api/send-welcome-email.js` — creator-branded welcome email to new customers on first signup.
- `api/send-blast.js` — drop announcement blast to opted-in customers. v27b rebranded to welcome-email aesthetic. SMS branch is scaffolded but returns stub `{smsStub: true}` — Twilio not wired.
- `api/notify-creator.js` — new order notification to the creator. Uses `creator.email`.
- `api/send-invoice.js` — invoice-style confirmation when `payment_method === "invoice"`. Will become the Stripe payment link email when Connect ships.

**Env vars in Vercel (Production + Preview + Development):**
- `RESEND_API_KEY`
- `APP_URL` = `https://app.getfooddrop.com`

---

## 7. What's Scheduled to Build Next

In priority order. Always start each session by querying Asana project `1214010900797667` for the current state before assuming.

### v28b — Drop form product autocomplete
Asana task: `1214124716424271` (currently in Days 31-60; see sequencing note below).
Depends on: v28a products tab (shipped). Next logical session.

**Scope:**
- In `DropFormModal`'s menu items section, typing in the item name field triggers autocomplete from creator's products table
- Selecting a product auto-fills name/description/price/image/capacity_weight — all still editable per drop
- **Coupling model is "Option B — reference with snapshot":** `drop_items.product_id` links to product, but name/price/description are copied at drop-item creation so per-drop tweaks don't mutate the canonical product, and historical orders stay frozen at purchase-time values
- If typed name doesn't match, show "Add '{name}' as new product" action that creates the product AND attaches it to the drop item
- After shipping, the "Used in X drops" count on product cards becomes real data (via drop_items.product_id join)
- Backward compat: existing drop_items have `product_id=null`, work unchanged

**Sequencing note / Asana cleanup needed:** The three v28 tasks (Products tab, Drop form autocomplete, v28.1 capacity-weight) currently live in Days 31-60 but v28a already shipped. The shipped task should be marked complete and the remaining v28 tasks probably belong in Days 1-30 since they're blocking creator-#3 onboarding. Resolve before starting v28b.

### v28.1 — Pickup window capacity by units/weight (pizza case)
Asana task: `1214124073929934`.

**Scope:** Per-window capacity mode (`customers` current / `units` new). When units mode, `sum(qty × drop_item.capacity_weight)` across non-cancelled orders in the window; window full when sum >= capacity. Requires `capacity_weight` on `drop_items` — add column flowing from products at drop-item creation. Checkout UX shows "3 of 10 units left" instead of "3 slots left."

**Important:** Build this AFTER we have a second creator asking for throughput modeling. Pizza is the only signal so far. Meanwhile, the pizza creator can use the workaround: `slot limit = hourly_capacity ÷ typical_order_size`. This is a "wait for validation" item, not a now item.

### v26 follow-up — Manual order modal should support pickup window selection
Asana task: `1214104161549370`. Minor scope. When a drop uses pickup windows and a creator creates a manual order from the dashboard, the order currently gets `pickup_window_id=null` and shows as "Unassigned" in the pickup checklist. Add window picker to `ManualOrderModal` matching the customer-side UX.

### Self-serve creator onboarding
Asana task: `1214003537110008` (due 2026-04-26).
**Current blocker for onboarding strangers.** Creator onboarding is currently manual: create Supabase auth user → copy UID → insert `creators` row → send credentials by hand. This is a real gate on expansion — platform must support self-serve creator signup before broader GTM.

### Google Sign-In for creators (Supabase OAuth)
Asana tasks: `1214104160302740` (Sign-In), `1214104232031541` (push drops to Google Calendar).
Order: Sign-In first, extended `calendar.events` scope second. Supabase natively supports Google OAuth — config-heavy but not code-heavy for the basic sign-in. The push-to-calendar piece needs backend token storage (provider_token + provider_refresh_token) and refresh handling in a serverless function.

### Stripe Connect (Express)
Asana task: `1214003537110004` (Days 31-60, due 2026-05-09).
**Architecture decisions finalized:**
- Express is the right long-term choice, not a stepping stone to Custom
- Deferred onboarding is the right pattern (reduces creator friction)
- Destination charges → chargebacks automatically flow to creator's connected account
- Migration to Custom only if white-labeled onboarding or complex multi-party splits are needed

**DB columns to add when we build:** `stripe_account_id`, `stripe_onboarding_complete` on `creators`; `stripe_session_id` on `orders`. The existing `payment_method` and `payment_status` columns are Stripe-ready.

### SMS blasts via Twilio
Asana task: `1214003537110003` (Days 31-60, due 2026-05-16).
`api/send-blast.js` already accepts `channel: "sms"` param and returns a graceful stub. A2P registration required. Consider SimpleTexting or managed SMS platform as alternative to raw Twilio.

### Known bugs queued for next versions
(Tracked under Asana parent "Quick features Claude can build" GID `1214003537109996`):
1. **Duplicate customer bug** — guest checkout creates row A; later storefront signup creates row B if email case/whitespace differs. Fix: case-insensitive trimmed email lookup in `CustomerSignupForm`. Also need a customer merge tool (partially exists via `MergeCustomerPanel`).
2. **Cancelled orders still counting in revenue** in some views — v20 fix was incomplete. Affects Reports tab and drop detail view.
3. **Welcome email possibly re-sending** (Cody flagged this, not yet confirmed). Retest after next push before assuming it's real. If confirmed, probably a `welcome_sent` flag being reset somewhere.

### Longer-horizon (Days 61-90)
Recipe cost calculator, AI licensing assistant (MA cottage food law first), custom domain support for creators, Pro tier (~$34/mo soft-launch), investor materials, Maker Platform features, VIP buyer tagging in CRM.

---

## 8. Development Workflow

This hasn't been Claude Code yet — it was GitHub pencil editor + manual file uploads. Claude Code will make this faster. Current flow:

1. All work on `dev` branch
2. Run SQL migrations in Supabase SQL Editor **first**, before code changes
3. Apply code changes (dev branch)
4. Vercel auto-builds preview at `fooddrop-git-dev-rtpcodys-projects.vercel.app`
5. Test on preview — backward-compat tests first, then new functionality
6. Merge dev → main via GitHub PR → Vercel auto-deploys production in ~30s

**New with Claude Code:** Claude can now read/edit source directly and open PRs, so the workflow can compress into a single session. Still run SQL manually in Supabase first.

---

## 9. Architecture & Coding Patterns

- **Single-file architecture:** Everything lives in `src/App.jsx`. ~3,940 lines after v28a. All components, all CSS, all state, all API calls. This is intentional for now — don't refactor to multi-file unless there's a clear reason.
- **Custom lightweight Supabase client:** Inlined in `src/App.jsx` near the top. Uses `.execute()` terminators. Not the official npm package. Do NOT replace with `@supabase/supabase-js` without explicit discussion — the custom client is tuned to our usage and the replacement would touch every data call.
- **Inline styles for component-specific styling:** Most one-off styles live in JSX `style={{...}}` attributes. Class-based styles (like `.card`, `.btn`, `.modal-overlay`) live in the `CSS` template literal constant near the top.
- **CSS variables for theming:** `--accent`, `--accent-light`, `--surface`, `--surface-alt`, `--text`, `--text-secondary`, `--text-tertiary`, `--border`, `--red`, `--red-light`, `--gold`, `--gold-light`, `--radius`, `--radius-sm`, `--font-body`, `--font-display`, `--shadow`, `--shadow-sm`, `--shadow-lg`. Use these rather than hardcoding colors/sizes.
- **Icon set:** `I.home`, `I.drop`, `I.users`, `I.image`, `I.chart`, `I.settings`, `I.plus`, `I.send`, `I.check`, `I.x`, `I.back`, `I.clock`, `I.pin`, `I.edit`, `I.clipboard`, `I.dollar`, `I.mail`, `I.phone`, `I.refresh`, `I.eye`, `I.share`, `I.archive`, `I.download`, `I.search`, `I.copy`, `I.upload`, `I.undo`, `I.print`, `I.listCheck`, `I.columns`, `I.palette`, `I.trash`. Reuse rather than adding new SVGs.
- **Data loading pattern:** `loadData()` is the single function that refetches everything. Call it after any mutation. Lives in the top-level `FoodDropApp` component.

### Diff safety rules (burned-in lessons)

1. **When replacing a whole function body, include the preceding function's closing `}` in the "Find" block.** This is non-negotiable — it anchors the replace at a true function boundary. Without this, the find-match can land inside another function, wipe its body, and create unclosed braces. Happened in v28a with `PermanentDeleteDropModal` — paste landed inside `BulkDeleteCustomersModal`, broke the file, took 20 minutes to diagnose.
2. **When inserting state/handlers before an existing function, verify the `function Name(...) {` opening brace is intact in the final file.** Missing opening braces caused Vercel build failures in v23 and v24.
3. **When adding a new prop to a child component's function signature, also pass it at the call site in the parent render.** v22 Announce button silently didn't work for this reason.
4. **Brace-balance scanners misread the CSS template literal constant.** Real imbalances are always in JS function bodies, never in CSS. If your scanner shows drift inside the CSS block, it's a false positive.
5. **File naming:** always use the final deployed path (`send-email.js`, NOT `send-email_v2.js`). GitHub upload preserves literal filenames. Use commit messages for version tracking, not filenames. This bit us in v27b — `_v2` suffix caused `/api/send-email` to 404 in production.
6. **Targeted diffs over full file rewrites.** Full rewrite only if 15+ locations change simultaneously.
7. **New DB columns require fresh test data.** Columns added after rows existed won't appear on old records.
8. **Windows-specific:** files re-downloaded on Windows may be renamed to `Index(1).html` — Vercel requires exactly `index.html`. Smart quotes from Windows editors can corrupt URLs in fetch calls — always use straight quotes.

---

## 10. Design Decisions Worth Remembering

- **Creator philosophy:** build features that serve creator's voice and autonomy rather than automating everything. Welcome emails are entirely creator-branded, no platform language visible to customers.
- **Payment: cash at pickup is the default.** Venmo and Invoice are alternatives. Confirmation email reminds customer to bring cash.
- **No pickup reminder or post-pickup follow-up emails until SMS infrastructure is ready.** Don't over-notify before we can do it well.
- **Announcement email vs. welcome email:** both use the same aesthetic (v27b rebrand) — dark `#2C2018` header, Georgia serif, `#C4856A` accent, dark footer. Confirmation email kept its distinct look (emoji header or banner, sans-serif) intentionally.
- **`.ics` over Google-only calendar invites:** floating local time, works across Gmail/Apple/Outlook. Google Calendar push is a separate later feature for creators (not customers).
- **Product coupling: Option B (reference with snapshot).** `drop_items.product_id` links to the canonical product but all display fields are copied at creation. Historical orders stay frozen. Per-drop edits don't mutate the catalog.
- **Product variants (size/flavor):** deferred. V1 treats "Small Margherita" and "Large Margherita" as separate products. Revisit if creators push back.
- **Pickup window slot TOCTOU race:** accepted. Cottage food scale makes the probability negligible. Revisit if a creator reports oversold windows.
- **Products table is creator-scoped**, not shared across creators. Two creators both selling "Margherita Pizza" get their own product rows.
- **Tags are freeform text[]**, not a fixed enum. Creator-defined.
- **Capacity weight default = 1.** Everyone keeps default behavior; only pizza-style creators set it differently.

---

## 11. Key Open Questions

- **Welcome email re-send bug:** real or false alarm? Retest after next deploy.
- **Pizza creator's exact name and handle:** need for marketing.
- **Brand decision:** FoodDrop vs Warmly vs Maker Platform naming — deferred to Days 61-90.
- **Pro tier pricing:** tentative ~$34/mo, needs validation.
- **Stripe timing:** can start after v28b ships (no hard dependency but logical sequencing).

---

## 12. Sanity-Check Steps When Starting a New Session in Claude Code

1. `git status` and `git pull` — ensure clean local state on dev branch.
2. Query Asana project `1214010900797667` — find what's next, what's open, what's shipped.
3. Read the version header at the top of `src/App.jsx` to confirm current version.
4. If unsure about a past decision, search this doc first, then ask Cody.
5. For new schema work, confirm the RLS policy pattern by reading an existing table's policies in Supabase before creating new ones.

---

## 13. What Claude.ai Chat Has Access To That Claude Code Won't

Things that existed in the chat session workflow which you may need to replace in Claude Code:

- **Asana MCP** — was connected in chat for task management. If Claude Code doesn't have Asana access, Cody will need to update tasks manually or we drop back to notes-based tracking.
- **Vercel MCP** — was connected in chat for pulling build logs, runtime logs, and verifying deploys. Useful for diagnosing prod issues. If Claude Code doesn't have it, lean on Vercel dashboard screenshots when debugging.
- **Memory system** — chat accumulated memory across sessions. Claude Code sessions start fresh; the equivalent is keeping `CLAUDE.md` up to date. After each significant session, update this doc with what changed.

---

## 14. The Bigger "Why"

This is not just a drop management app. It's infrastructure for cottage food creators who today are stitched together across Google Forms, Venmo, Instagram DMs, and Excel spreadsheets. The long vision is the Maker Platform — products → drops → customers → payments → compliance (licensing help, cottage food law) → growth (referral, content, pricing) — for the small food creator category specifically. Competing with Hotplate on CRM depth, not SMS speed.

Investor framing: structural gap in food creator infrastructure versus surface-level tool fragmentation. All 50 states now have cottage food laws; ~7.5% CAGR in home-based bakery market. No reliable headcount data on cottage food operators exists — pitch leans on trend data, not TAM math.

End of handoff.

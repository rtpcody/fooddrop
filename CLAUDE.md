# FoodDrop — Project Context for Claude Code

## What This Is
FoodDrop is a CRM and drop management platform for cottage food creators (home bakers, pop-up chefs) to manage limited-availability food pickup events ("drops"), customers, and orders.

## Current Version
v28a

## Tech Stack
- **Frontend:** React (single-file architecture — `src/App.jsx`), Vite, hash-based routing
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Deployment:** Vercel (serverless functions in `api/` folder), GitHub (`rtpcody` account)
- **Email:** Resend (transactional), domain verified at `getfooddrop.com`
- **Payments (planned):** Stripe Connect Express

## File Structure
fooddrop/
api/
send-email.js           — order confirmation email
send-welcome-email.js   — creator intro email to new customers
send-blast.js           — drop announcement email to customer list
send-invoice.js         — invoice email for manual orders
notify-creator.js       — new order notification to creator
src/
App.jsx                 — entire React app (single file, ~3500 lines)
main.jsx                — React entry point
index.html
package.json
vite.config.js
vercel.json
CLAUDE.md

## Supabase
- URL: `https://fgkwdobauncgkyuvyfhn.supabase.co`
- Anon key is hardcoded in App.jsx (acceptable for this stage)
- RLS is enabled — always create explicit policies per operation type (SELECT ≠ DELETE)

## Deployment Rules
- **Always work on `dev` branch first** — never commit directly to `main`
- Dev previews at: `fooddrop-git-dev-rtpcodys-projects.vercel.app`
- Production at: `app.getfooddrop.com`
- Merge dev → main via GitHub PR only after testing on preview URL
- `RESEND_API_KEY` must be set in Vercel dashboard (all 3 environments)
- **File naming:** Never add version suffixes to filenames (e.g. never `send-email_v2.js`) — use commit messages for version history

## Code Patterns
- **Targeted diffs only** — never rewrite the full App.jsx; always make surgical find/replace edits
- When replacing a full function, include the preceding function's closing brace in the search anchor
- When inserting new state/handlers before an existing function, never omit the `function Name(...) {` opening brace
- When adding a new prop to a child component's signature, also pass it at the call site in the parent
- The large CSS template literal in App.jsx causes false positives in brace-balance checkers — real imbalances are always in JS function bodies

## Database Columns (Key Notes)
- New columns require fresh test data — features won't appear on records created before a migration ran
- `PGRST204` = column doesn't exist, run migration; `23514` = check constraint violation
- `drop_items.product_id` exists but is not yet wired (staged for v28b)
- `orders` table has `payment_method` and `payment_status` columns
- `customers` table has `signup_source` (order / signup_form / manual), `opted_in`, `welcome_sent`

## Known Bugs (Next to Fix)
1. Duplicate customer bug — guest checkout creates row A; storefront signup creates row B if email case/whitespace differs. Fix: case-insensitive trimmed email lookup in `CustomerSignupForm`. Also need a customer merge tool (merge tool exists in UI but the root cause needs fixing).
2. Cancelled orders still counting in revenue — affects Reports tab and drop detail view
3. `signup_source` field needs to be added to `customers` table via SQL migration

## Live Creators
- **WarmlyCookies** — Cody's test/dogfood account
- **Temple Kitchen** — Hawaii-based external creator
- **Spanish Salads** — test account

## Revenue Model
4% + $0.45 customer-facing fee. Stripe costs passed through transparently. CRM free initially. Considering free plan that includes email and cash transactions. Upgrading remaines free for the creator but allows SMS and credit card transactions.

## What NOT to Do
- Don't rewrite App.jsx in full — always targeted edits
- Don't commit directly to main
- Don't add `_v2` or version numbers to filenames
- Don't add SQL migrations without noting they need to be run in Supabase SQL Editor first
- Don't add pickup reminder or post-pickup emails yet (waiting for SMS infrastructure)

# NAMCOS — Local Commerce Platform (PRD)

## Original Problem Statement
Cloned from https://github.com/dragon16t/namc2.git. User then requested a large multi-feature build, to be delivered in phases, integrating LIVE Razorpay + Google Maps.

## Stack
- Frontend: React 19 (CRACO), Tailwind, shadcn/ui, lucide-react, framer-motion
- Backend: FastAPI + Motor (MongoDB)
- Integrations: Razorpay (LIVE), Google Maps, Emergent object storage (EMERGENT_LLM_KEY)

## User-requested feature backlog (phased)
1. **Phase 1 — Money core** ✅ DONE (2026-06)
   - LIVE Razorpay for Pay-at-Store (UPI/QR/Card) + Wallet payment
   - Wallet add + deduct logic (insufficient → prompt to add shortfall, then pay)
   - Order confirmation + Order Detail page
   - Merchant portal shows payment w/ customer name + phone + amount + status
   - Wallet transaction history (store payments + top-ups, with store name)
2. **Phase 2 — Offers & NAMCOS earning** (P0 next)
   - Per-store discount % badge on home/store pages; claim-discount on amount entry
   - Admin: set store discount %
   - NAMCOS earning % split; merchant wallet shows gross, NAMCOS %, customer discount %, available
3. **Phase 3 — Referral system** (P1)
   - Referral code per user (profile); add referral on signup/login
   - Credit % of referred user's purchases to referrer wallet; withdrawal review in admin
4. **Phase 4 — Shops subcategories** (P1)
   - Subcategory menu + filtering; custom subcategory add with admin approval
   - Classifieds subcategories shown inside a square grid
5. **Phase 5 — Form unification + Google Maps** (P2)
   - Make register-business / sell forms identical everywhere (home form is the canonical one)
   - Integrate Google Maps

## What's implemented (Phase 1)
- `backend/routes/common.py`: real `/wallet/balance`, new `/wallet/transactions`
- `backend/routes/payments.py`: `/payments/pay-with-wallet` (atomic conditional deduction,
  structured INSUFFICIENT_FUNDS error), customer_name/phone stored on all payment docs
- `backend/routes/mylistings.py`: customer_name/phone added to Razorpay order/verify/webhook
- `backend/server.py`: seeds demo merchant (+919876543210) owning all demo listings/payments
- Frontend: StoreDetail wallet pay + shortfall modal + inline support CTA (overlay fix),
  new OrderDetail page + route, MerchantPayments customer column, CustomerWallet merged history

## Credentials (see /app/memory/test_credentials.md)
- Admin: glowcelesta@gmail.com / Admin@namcos2024 (/admin/login)
- Customer OTP: any number, OTP in send-otp response
- Demo merchant: +919876543210

### Phase 3 — Chain Referral Engine ✅ DONE (2026-06)
- `earnings.py` rewritten as central engine: `store_rates`, `compute_full_breakdown`, `apply_purchase_earnings`, multi-level `_credit_referral_chain`, unified `write_ledger`.
- Per-store % allocation fields on stores: `discount_percent` (customer), `referral_percent` (direct), `chain_percent`, `namcos_percent` (fee). Seeded defaults (ref 1, chain 1, namcos 3).
- On purchase: customer discount reduces net; direct referrer gets referral %; chain % distributed up the chain (decreasing 1/2,1/4… weights, up to 5 levels); NAMCOS fee; merchant = remainder. Credited ONLY when referred user purchases.
- Wired into `payments.pay_with_wallet`, `mylistings.razorpay/verify`; withdrawals + wallet top-ups also write to ledger (`db.transactions`).
- Verified E2E: A→B→C, C pays ₹100 @ 10/1/1/3 → Bob(direct) ₹1, Alice(chain) ₹1, merchant ₹85, NAMCOS ₹3.

### Phase 4 — Admin Panel Overhaul ✅ DONE (2026-06)
- Dashboard: new "Money & Earnings" section with 12 metrics + hover info tooltips (incl. DMB = Due Merchant Balance explained); driven by `/admin/dashboard-metrics` + existing date presets/custom range.
- Users: merchant/customer badge, drill-down detail modal (purchases, listings, referrals, direct+chain bonus, wallet, withdrawals) via `/admin/users/{id}/detail`; count-based pagination + search.
- Stores: per-store allocation editor (customer/referral/chain/NAMCOS fee %) via `/admin/stores/{id}/rates`; per-store transaction totals modal via `/admin/stores/{id}/transactions`; pagination + search.
- Listings: new view/edit modal (`/admin/edit/{kind}/{id}`), pagination + search, status edit.
- Transactions: new grouped page (`/admin/transactions` → `AdminTransactions.jsx`) with per-group summary cards + month filter + pagination from `db.transactions` ledger. (Old orders page moved to `/admin/orders`.)
- Withdrawals: user vs merchant tabs, month selector, CSV/Excel export (`/admin/withdrawals-export`), pagination.
- Business Types: new admin CRUD page (`/admin/business-types`).
- My Account: new page to update admin name + password.

### New admin endpoints (admin_ext.py)
dashboard-metrics, users-count, users/{id}/detail, merchants-count, stores/{id}/rates, stores/{id}/transactions, transactions, withdrawals-list, withdrawals-export, business-types CRUD, profile, listings-count/{type}

## Notes
- Razorpay keys are **LIVE** — real money on checkout. Wallet-funded path is internal (safe to test).
- SMS OTP is MOCKED (returned in API response).

### 2026-06 follow-up: Store Full Edit + Invite & Earn + full E2E test ✅ DONE
- **Store Full Edit (admin)**: AdminStores "Edit" button opens a modal to edit photos (Cloudinary ImageUploader), business name/type, owner, phone, address, locality/city, opening/closing hours, description → saves via `/admin/edit/store/{id}`.
- **Invite & Earn card (customer)**: CustomerProfile card now shows referral code, Copy + Share (native share / WhatsApp message), Referred count, Direct Bonus, Chain Bonus, Total Earned. Backed by `/referrals/me` (now splits `direct_earnings`/`chain_earnings`).
- **Full user-level test (testing_agent, iteration_3)**: 28/28 backend tests PASS covering signup+name step, A→B→C referral chain, pay-with-wallet full split + direct+chain credit + ledger, INSUFFICIENT_FUNDS, razorpay order (LIVE, not charged), Cloudinary upload, user+merchant withdrawals, and ALL admin endpoints. Frontend flows verified. **Bug fixed**: `/api/admin/change-password` compared against a stripped password_hash (get_current_user removes it) → now refetches the user to verify current password.

---

## 2026-06 — NEW LARGE BUILD (LIVE keys: Razorpay + Google Maps + Cloudinary)
User requested a big multi-area upgrade, delivered phase-by-phase. User does main testing; agent does smoke checks.

### Phase 1 — Foundations & Integrations ✅ DONE (2026-06)
- Wired LIVE Razorpay (`RAZORPAY_KEY_ID/SECRET`), Google Maps (`REACT_APP_GOOGLE_MAPS_API_KEY` + backend `GOOGLE_MAPS_API_KEY`), Cloudinary (`CLOUDINARY_*`) into env.
- Image uploads now go to **Cloudinary** (backend direct upload in `routes/uploads.py`, returns secure_url, stored in `db.files`). Legacy object-storage read kept for old files. New uploads only (per user choice).
- Signup: after OTP, NEW users get a dedicated "enter your name" step (`AuthPage.jsx` mode='name' → PUT /auth/profile → /customer). Referral code input stays on OTP screen.

### Phase 2 — Home & Shops UI ✅ DONE (2026-06)
- Golden "X% OFF" `DiscountBadge` on ALL store image sections (CustomerHome StoreCard + CategoryPage store ItemCard). Driven by `store.discount_percent`.
- Seeded demo store discounts (Green Mart 10, Spice Garden 15, TechHub 8, Style Hub 20); all stores backfilled `discount_percent` default 0.
- Shops subcategories now render as ICON tiles (keyword→lucide icon map in CategoryPage: bakery→Cake, jewellery→Gem, electronics→Cpu, fashion→Shirt, pharmacy→Pill, footwear→Footprints, furniture→Sofa, gifts→Gift, etc.).
- Register-business form: `business_type` autocomplete field (store type) backed by new `GET /api/business-types` (189 seeded types in `db.business_types`), `<datalist>` suggestions.

### Phase 3 — Chain Referral Engine (P0 NEXT — not started)
- Per-store % allocation: customer discount %, direct referral %, chain referral %, NAMCOS %. Admin sets each per store.
- Credit referral ONLY when referred user purchases (direct referrer gets direct %).
- Multi-level chain: distribute chain % up the referral chain (logical decreasing split — agent to design).
- `earnings.py` currently has flat `credit_referral` (single level). Needs: per-store rates, chain walk via `referred_by`, transaction records for each hop.

### Phase 4 — Admin Panel Overhaul (P1 — not started)
- Dashboard: DMB info tooltip; metrics (merchant valid balance after withdrawal, user wallet balance, total revenue, user referral revenue, merchant revenue, chain total revenue, NAMCOS % revenue, total % revenue, withdrawals processed/pending, total txns); date range picker (from/to + single date).
- Users: merchant vs customer badges, drill-down detail (purchases, listings, referrals+bonus, chain bonus, wallet, txns, withdrawals), pagination + working search.
- Stores: fee % edit per store, full store edit (images etc.) for pending/published, per-store txn totals (total amount, #txns, after-deduction revenue), pagination.
- Listing moderation: view+edit detail, pagination + search (all admin pages need pagination + search).
- Transactions: grouped main/sub headings for every money flow (referral, NAMCOS, chain, withdrawals, wallet add, discount claim).
- Withdrawals: user + merchant sections, month selector, Excel export, pagination.
- Admin: update own username + password.

### Env keys added (2026-06)
- backend/.env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, GOOGLE_MAPS_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- frontend/.env: REACT_APP_GOOGLE_MAPS_API_KEY

---
## 2026-10 Session (clone of dragon16t/nam-up2 + fixes)
- Profile "Start Selling" now opens the same form as the home page (/customer/register-merchant?type=X); /customer/sell redirects there; old SellSomething removed
- Approval gating: ensure_visible() makes unpublished store/agri/service/classified detail pages + store products visible only to the owner/admin; owner toggle works only published<->paused; payments to non-published stores are blocked; owner edits can't change status/rates
- Listing Dashboard inside the user app: /customer/my-listings/:kind/:id/dashboard (GET /api/my/listings/{kind}/{id}/dashboard)
- Payout details: /api/my/payout-details (bank A/C + IFSC + holder or UPI, validated, saved); used by wallet + merchant withdrawals; admin sees them via /api/admin/users/{id}/payout and /api/admin/stores/{id}/payout; admin Stores page has visible Edit + Bank buttons, Users page has Bank Details, Withdrawals page shows full account info
- Deactivated users are blocked (403)
- Twilio Verify SMS OTP (service VAdff8f6...); test phones use OTP 123456 (OTP_TEST_PHONES). Twilio is a TRIAL account: it only sends to verified numbers
- Live keys set up: Razorpay, Cloudinary, Google Maps
- Home banner is now 16:9
- Testing iteration_4: 32/32 backend tests + frontend checks passed
## Backlog
- Upgrade Twilio from trial; add the in-app notifications screen; add a real weekly sales chart (currently static data)

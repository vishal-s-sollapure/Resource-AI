# ReSource AI

**Turn Waste into Business Opportunities.**

> Hackathon demo prototype. Companies, prices, orders, bank details, payment references and shipment events are labelled demo data. No real money, escrow, GPS tracking or verified business data is involved.

---

## Project overview

ReSource AI is a responsive marketplace MVP for industrial and agricultural by-products. Sellers publish surplus material, buyers describe what they need, and both sides use explainable recommendations to discover applications, compare opportunities, negotiate and coordinate delivery.

The repository is a monorepo:

```text
Resource-AI/
├── backend/                 FastAPI + Pydantic REST API
│   ├── app/
│   │   ├── routers/          auth/profile, market/AI/matching, commerce/orders
│   │   ├── services/         Gemini adapter, discovery, matching/pricing/logistics
│   │   ├── sql/schema.sql    optional Supabase PostgreSQL schema
│   │   ├── seed.py           labelled demo dataset
│   │   └── store.py          optional Supabase adapter + persistent JSON fallback
│   ├── scripts/              demo pre-flight check
│   ├── tests/                backend unit and API smoke tests
│   └── .env.example
├── frontend/                 React + Vite + TypeScript + Tailwind CSS
│   ├── src/pages/            public workflows, dashboards and workspace pages
│   ├── src/components/       shared UI and domain cards
│   ├── src/state/            auth/session/toast context
│   └── .env.example
├── render.yaml               optional Render backend blueprint
└── README.md
```

The demo runs with **no API keys**: the backend uses a persistent JSON store, seeded demo accounts and deterministic rule-based AI fallbacks.

---

## Features

### Public marketplace

- Prominent **Find Buyers** and **Find Materials** entry points.
- API-backed demo listing and requirement previews with demo labels.
- Material analysis preview and Knowledge Hub guides.
- Clear separation of three discovery result types:
  - AI-suggested prospect categories (not real companies).
  - Sample/real business listings (Google Places only when configured).
  - Published platform requirements (confirmed only when a buyer confirms them).

### Seller workspace

- Create, edit, pause and delete listings.
- Analyse materials and view an indicative price estimate.
- `Insufficient market data.` fallback when comparables are unavailable.
- Weighted matching against published buyer requirements.
- Material Passport and enquiry/offer/negotiation workflows.
- Order acceptance, manual advance confirmation, transport agreement and shipment milestones.
- Admin/demo reset controls.

### Buyer workspace

- Plain-language requirement extraction with editable fields.
- Supplier matching with visible score factors.
- Publish and separately confirm requirements.
- RFQs, offers, counteroffers and buyer/seller-controlled negotiation.
- Orders at listed or agreed prices, masked demo bank details after seller acceptance.
- Demo UTR references, refund requests and manual tracking timeline.

### Safety features

- No invented market prices: numeric references come from transparent comparable calculations.
- No fake demand: published requirements are not “confirmed” until explicitly confirmed.
- No fake prospects: AI suggests categories and search queries, not invented companies.
- No fake payment success: a UTR only records a reference until the seller confirms receipt.
- Bank details are hidden from public responses and masked in the UI.
- Closed orders reject new payment references, transport changes and refund shortcuts.

---

## Tech stack

- **Frontend:** React 18, Vite 6, TypeScript, Tailwind CSS 3, React Router 7, Lucide React.
- **Backend:** Python 3.11+, FastAPI, Pydantic, Uvicorn.
- **Storage:** persistent JSON demo store by default; optional Supabase PostgreSQL.
- **AI:** optional Gemini API for interpretation; deterministic knowledge-base fallback otherwise.
- **Discovery:** optional Google Places/Maps; labelled sample data and local distance fallback otherwise.
- **Deployment:** Vercel frontend and Render backend are supported with explicit environment variables.

---

## Installation

### Prerequisites

- Node.js 20+ and npm.
- Python 3.11+ (3.12 tested).

### 1. Backend dependencies

```powershell
cd D:\GIT\Resource-AI\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

### 2. Frontend dependencies

```powershell
cd D:\GIT\Resource-AI\frontend
npm install
```

### 3. Environment files (optional for local demo)

Copy `.env.example` to `.env` in each folder only if you need to change defaults or add integration keys:

```powershell
Copy-Item ..\backend\.env.example ..\backend\.env
Copy-Item .env.example .env
```

No API keys are required for the local demonstration.

---

## Environment variables

### Backend (`backend/.env.example`)

| Variable | Purpose | Default / fallback |
| --- | --- | --- |
| `SUPABASE_URL` | Optional Supabase project URL | Empty → local JSON store |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database key | Empty → local JSON store |
| `GEMINI_API_KEY` | Optional AI interpretation | Empty → deterministic knowledge-base fallback |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash` |
| `GOOGLE_PLACES_API_KEY` | Optional real business discovery | Empty → labelled sample listings |
| `GOOGLE_MAPS_API_KEY` | Optional distance support | Empty → approximate local coordinate table |
| `FRONTEND_URL` | CORS origin for deployment | `http://localhost:5173` |
| `DATA_DIR` | Demo JSON store location | `backend/data` |
| `APP_ENV` | `demo` or `production` | `demo`; `production` requires `TOKEN_SECRET` |
| `ALLOW_ANONYMOUS_DEMO` | Allow public demo identities to mutate records | `true`; set `false` for sign-in-required deployments |
| `TOKEN_SECRET` | Signs session tokens | Built-in demo secret only for local use; mandatory in production |
| `MATCH_WEIGHT_MATERIAL` | Material score weight | `0.40` |
| `MATCH_WEIGHT_QUANTITY` | Quantity score weight | `0.25` |
| `MATCH_WEIGHT_LOCATION` | Location score weight | `0.20` |
| `MATCH_WEIGHT_QUALITY` | Quality score weight | `0.15` |

Supabase is used only for optional data storage in this prototype. It is **not** an external authentication provider here.

### Frontend (`frontend/.env.example`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL | `/api` (Vite proxies it in dev/preview) |

**Never put Supabase service-role keys, Gemini keys, Google keys or `TOKEN_SECRET` in frontend files or `VITE_*` variables.** Only the public API URL belongs in the frontend.

---

## How to run frontend and backend

### Terminal 1 — backend API

```powershell
cd D:\GIT\Resource-AI\backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/api/health>

Expected local demo health response:

```json
{
  "status": "ok",
  "storage": "demo-json",
  "gemini": "demo-fallback",
  "google_places": "demo-fallback",
  "anonymous_demo": "enabled"
}
```

### Terminal 2 — frontend

```powershell
cd D:\GIT\Resource-AI\frontend
npm run dev
```

Open <http://localhost:5173>. The frontend proxies `/api` to `http://127.0.0.1:8000` in dev and preview.

### Demo readiness checks

With both servers running:

```powershell
cd D:\GIT\Resource-AI\backend
python -m pytest -q
python scripts/demo_preflight.py --reset

cd D:\GIT\Resource-AI\frontend
npm run build
```

`demo_preflight.py --reset` restores seeded data, verifies all demo accounts, checks the 500 kg coconut-husk listing and requirement, exercises analysis/extraction/pricing/discovery/matching fallbacks, confirms the walkthrough order is ready and loads key frontend routes.

To restore data during the demo, sign in as admin and use the reset control, or run the pre-flight script again with `--reset`.

---

## Demo login credentials

All accounts are seeded; **no sign-up is required**. Password for every account: **`demo123`**.

| Role | Email | Suggested use |
| --- | --- | --- |
| Seller | `seller@demo.resourceai.in` | Listings, matches, offers, order acceptance, shipment |
| Buyer | `buyer@demo.resourceai.in` | Requirement assistant, supplier matches, orders, UTR/refunds |
| Buyer + Seller | `both@demo.resourceai.in` | Show combined role navigation |
| Admin / Demo | `admin@demo.resourceai.in` | Overview and demo reset |

The `/login` page also has one-click demo account buttons. Public pages work without signing in; in local demo mode, state-changing actions use labelled demo identities when no token is present.

---

## How to run the demo scenario

Recommended path: **5–7 minutes**, using the seeded 500 kg coconut-husk materials.

### Step 0 — reset (optional but recommended)

```powershell
cd D:\GIT\Resource-AI\backend
python scripts/demo_preflight.py --reset
```

### Step 1 — seller story (~2 minutes)

1. Open <http://localhost:5173> and click **Find Buyers**.
2. Sign in with `seller@demo.resourceai.in` / `demo123` using a demo button.
3. Enter **Coconut husk**, **500 kg**, **Bengaluru, Karnataka**, grade **B**.
4. Show:
   - Material analysis applications and disclaimer.
   - Indicative price estimate (or `Insufficient market data.` if no comparables).
   - Business Discovery buckets.
5. Go to **Matches → Buyer requirement matches** and show the confirmed coconut-husk requirement. Send an enquiry if desired.
6. Go to **My Listings** and show the active **500 kg Coconut husk** lot.

### Step 2 — buyer story (~2 minutes)

1. Log out and sign in with `buyer@demo.resourceai.in` / `demo123`.
2. Open **Find Materials** and paste:
   `I need 500 kg of raw coconut husk in Karnataka for coco peat production.`
3. Run extraction, review the parsed fields, then run matching.
4. Show the ranked supplier match and, if time allows, make an offer to start a negotiation.

### Step 3 — fast order walkthrough (~2 minutes)

Use the seeded order **`ord_4`** so the full payment-reference flow can be shown without waiting for a new negotiation:

| Actor | Route | Action |
| --- | --- | --- |
| Seller | `/orders/ord_4` | Accept the order. |
| Buyer | `/orders/ord_4` | Submit demo UTR `DEMOUTR500` for the 20% advance. Point out that this is only a reference, not a payment. |
| Seller | `/orders/ord_4` | Confirm advance receipt. |
| Buyer or seller | `/orders/ord_4` | Agree transport terms and note the estimate is indicative. |
| Seller | `/orders/ord_4` | Update a manual shipment milestone. |
| Buyer | `/orders/ord_4` | Show the timeline and the “manual tracking, no GPS” note. |

### Step 4 — optional admin recap

Sign in as `admin@demo.resourceai.in`, open **Admin / Demo**, and show counts, simulated fee overview and storage status.

**Very short path:** if time is under two minutes, show the public homepage CTAs, seller material analysis, buyer requirement extraction and the `ord_4` accept → UTR → confirm → milestone flow.

Do not enter real bank details. All payout details and UTRs are demo values.

---

## Which features are simulated

Only the local React app, FastAPI backend and JSON demo store are connected and tested in this repository. No external API keys are present.

| Feature | What actually happens in the local demo |
| --- | --- |
| Data storage | Persistent JSON file seeded with labelled demo records. Supabase is optional and unconfigured. |
| Authentication | Seeded demo accounts and signed prototype sessions. No external identity provider. |
| Demo identities | Unauthenticated public demo actions use labelled identities when `ALLOW_ANONYMOUS_DEMO=true`. |
| AI analysis / extraction | Deterministic knowledge-base and rule-based fallback responses, clearly labelled as such. Gemini is optional and unconfigured. |
| Business discovery | Labelled sample businesses and AI prospect categories. Google Places is optional and unconfigured. |
| Distance / route data | Approximate local coordinate table. Google Maps is optional and unconfigured. |
| Prices | Median-of-comparables calculations over demo data; `Insufficient market data.` when absent. Not market quotes. |
| Payments | Buyer-submitted UTR references plus seller confirmation. No escrow, bank transfer or payment gateway is connected. |
| Bank details | Seeded demo values, masked in the UI and hidden from public API responses. Never use real details. |
| Logistics | Indicative cost/distance estimates and manual transport agreement. No carrier API or real-time GPS. |
| Shipment tracking | Manual milestone updates by seller/transporter, not live location data. |
| Fees and subscriptions | Illustrative amounts and tier labels. No money is collected and no feature is actually paywalled. |
| Orders / refunds | Real API state transitions over demo records, with guardrails, but no commercial or financial effect. |

---

## Deployment notes

- **Vercel frontend:** Vite preset, root `frontend`, build `npm run build`, output `dist`. Set `VITE_API_BASE_URL` to the Render API URL because the default `/api` is same-origin only.
- **Render backend:** `render.yaml` defines a Python web service rooted at `backend`. It sets `APP_ENV=production` and `ALLOW_ANONYMOUS_DEMO=false`; set a strong `TOKEN_SECRET` in Render. Startup fails without it.
- Set `FRONTEND_URL` to the deployed frontend origin for CORS.
- Secret keys belong only in backend environment variables.

---

## API surface (summary)

Health/demo: `GET /api/health`, `POST /api/demo/reset` (admin login required).

Identity/profile: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/profile`, `/api/subscription/*`.

Market data: `/api/materials`, `/api/listings`, `/api/listings/mine`, `/api/requirements`, `/api/requirements/mine`, `/api/passports`.

AI/matching: `/api/materials/analyze`, `/api/requirements/extract`, `/api/pricing/estimate`, `/api/discovery/search`, `/api/matching/seller`, `/api/matching/buyer`, `/api/negotiations/{id}/assist`.

Commerce: `/api/enquiries`, `/api/offers`, `/api/negotiations`, `/api/orders`, `/api/refunds`, `/api/transporters`, `/api/fee-policy`, `/api/logistics/estimate`, `/api/admin/overview`.

Full interactive documentation is available at `/docs` when the backend is running.

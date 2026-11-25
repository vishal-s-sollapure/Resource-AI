-- ReSource AI — Supabase PostgreSQL schema
-- Run once in the Supabase SQL editor before setting SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
-- The backend uses a service-role key server-side; never expose it to the frontend.

create extension if not exists "pgcrypto";

create table if not exists users (
  id text primary key,
  email text not null unique,
  full_name text not null,
  role text not null default 'buyer',
  password_hash text not null default '',
  phone text,
  avatar_url text,
  verification_status text not null default 'unverified',
  subscription_tier text not null default 'basic',
  trial_status text not null default 'active',
  trial_ends_at timestamptz,
  bank_account_holder text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  bank_upi text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_profiles (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  business_name text not null,
  business_type text,
  industry text,
  contact_person text,
  email text,
  phone text,
  location text,
  description text,
  logo_url text,
  verification_status text not null default 'unverified',
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists materials (
  id text primary key,
  name text not null,
  category text not null default 'other',
  description text,
  source text,
  common_byproducts jsonb not null default '[]',
  applications jsonb not null default '[]',
  possible_products jsonb not null default '[]',
  processing_methods jsonb not null default '[]',
  quality_requirements jsonb not null default '[]',
  buyer_industries jsonb not null default '[]',
  storage_handling jsonb not null default '[]',
  environmental_considerations jsonb not null default '[]',
  aliases jsonb not null default '[]',
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists listings (
  id text primary key,
  seller_id text not null references users(id) on delete cascade,
  material_id text references materials(id) on delete set null,
  material_name text not null,
  category text not null default 'other',
  quantity numeric not null check (quantity >= 0),
  unit text not null default 'kg',
  form text not null default 'raw',
  quality_grade text not null default 'ungraded',
  moisture_content numeric,
  processing_level text,
  location text,
  price numeric not null default 0 check (price >= 0),
  price_type text not null default 'negotiable',
  available_date date,
  images jsonb not null default '[]',
  description text,
  status text not null default 'active',
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists buyer_requirements (
  id text primary key,
  buyer_id text not null references users(id) on delete cascade,
  material_name text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null default 'kg',
  required_quality text not null default 'ungraded',
  application text,
  location text,
  max_price numeric,
  delivery_date date,
  alternatives_allowed boolean not null default false,
  status text not null default 'open',
  confirmed boolean not null default false,
  description text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_discovery_results (
  id text primary key,
  query text,
  source_type text not null,
  label text,
  business_name text,
  address text,
  category text,
  website text,
  distance_km numeric,
  location text,
  material text,
  note text,
  search_query text,
  confidence numeric,
  is_real_business boolean not null default false,
  is_confirmed_demand boolean not null default false,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists enquiries (
  id text primary key,
  listing_id text not null references listings(id) on delete cascade,
  buyer_id text not null references users(id) on delete cascade,
  seller_id text not null references users(id) on delete cascade,
  requirement_id text references buyer_requirements(id) on delete set null,
  message text,
  status text not null default 'sent',
  reply text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists offers (
  id text primary key,
  negotiation_id text not null,
  listing_id text not null references listings(id) on delete cascade,
  buyer_id text not null references users(id) on delete cascade,
  seller_id text not null references users(id) on delete cascade,
  made_by text not null default 'buyer',
  price numeric not null check (price >= 0),
  quantity numeric not null check (quantity >= 0),
  unit text not null default 'kg',
  delivery_location text,
  message text,
  status text not null default 'pending',
  parent_offer_id text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists negotiations (
  id text primary key,
  listing_id text not null references listings(id) on delete cascade,
  buyer_id text not null references users(id) on delete cascade,
  seller_id text not null references users(id) on delete cascade,
  status text not null default 'in_progress',
  agreed_price numeric,
  agreed_quantity numeric,
  order_id text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  listing_id text references listings(id) on delete set null,
  buyer_id text not null references users(id),
  seller_id text not null references users(id),
  negotiation_id text,
  material_name text not null,
  quantity numeric not null,
  unit text not null default 'kg',
  agreed_price numeric not null,
  total_value numeric not null,
  advance_amount numeric not null,
  balance_amount numeric not null,
  advance_status text not null default 'pending',
  balance_status text not null default 'pending',
  seller_fee numeric not null default 0,
  transport_cost numeric,
  transport_payer text not null default 'buyer',
  transport_agreed boolean not null default false,
  status text not null default 'awaiting_seller_acceptance',
  buyer_confirmed_at timestamptz,
  seller_accepted_at timestamptz,
  pickup_location text,
  delivery_location text,
  estimated_pickup date,
  estimated_delivery date,
  terms text,
  cancellation_reason text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  type text not null default 'advance',
  amount numeric not null,
  status text not null default 'pending',
  method text not null default 'direct_bank_transfer',
  utr text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  note text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refunds (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  requested_by text not null,
  reason text,
  order_stage text,
  amount numeric not null,
  seller_response text,
  status text not null default 'requested',
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shipments (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  status text not null default 'order_confirmed',
  transporter_id text,
  vehicle_type text,
  distance_km numeric,
  transport_cost numeric,
  estimated_pickup date,
  estimated_delivery date,
  actual_pickup date,
  actual_delivery date,
  tracking_events jsonb not null default '[]',
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transporters (
  id text primary key,
  name text not null,
  phone text,
  vehicle_type text,
  capacity_kg numeric not null default 0,
  location text,
  added_by text,
  is_partner boolean not null default false,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  tier text not null default 'basic',
  monthly_price numeric not null default 0,
  status text not null default 'active',
  demo_mode boolean not null default true,
  started_at timestamptz,
  expires_at timestamptz,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists material_passports (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  listing_id text references listings(id) on delete set null,
  material_name text not null,
  source text,
  quantity text,
  quality text,
  processing_history text,
  intended_applications jsonb not null default '[]',
  storage_conditions jsonb not null default '[]',
  specifications jsonb not null default '{}',
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additive migration for databases created before confirmation timestamps.
alter table orders add column if not exists buyer_confirmed_at timestamptz;
alter table orders add column if not exists seller_accepted_at timestamptz;

-- Indexes for common marketplace filters
create index if not exists idx_listings_status on listings(status);
create index if not exists idx_listings_material on listings(material_name);
create index if not exists idx_listings_seller on listings(seller_id);
create index if not exists idx_requirements_status on buyer_requirements(status);
create index if not exists idx_requirements_buyer on buyer_requirements(buyer_id);
create index if not exists idx_offers_negotiation on offers(negotiation_id);
create index if not exists idx_offers_status on offers(status);
create index if not exists idx_orders_buyer on orders(buyer_id);
create index if not exists idx_orders_seller on orders(seller_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_payments_order on payments(order_id);
create index if not exists idx_shipments_order on shipments(order_id);
create index if not exists idx_enquiries_listing on enquiries(listing_id);
create index if not exists idx_discovery_source on business_discovery_results(source_type);

-- Row Level Security: enable on all tables. The backend uses a service-role key
-- which bypasses RLS; add user-scoped policies before exposing the anon key.
-- alter table listings enable row level security;
-- alter table orders enable row level security;

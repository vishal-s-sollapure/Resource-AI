export type Role = 'seller' | 'buyer' | 'buyer_seller' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  role: Role
  phone?: string | null
  verification_status?: string
  subscription_tier?: 'basic' | 'premium'
  trial_status?: string
  trial_ends_at?: string | null
  avatar_url?: string | null
  is_demo?: boolean
}

export interface Profile {
  id: string
  user_id: string
  business_name: string
  business_type?: string
  industry?: string
  contact_person?: string
  email?: string
  phone?: string
  location?: string
  description?: string
  logo_url?: string | null
  verification_status?: string
}

export interface MaterialGuide {
  id: string
  name: string
  category: string
  description: string
  source: string
  common_byproducts: string[]
  applications: string[]
  possible_products: string[]
  processing_methods: string[]
  quality_requirements: string[]
  buyer_industries: string[]
  storage_handling: string[]
  environmental_considerations: string[]
  aliases: string[]
  is_demo: boolean
}

export interface Listing {
  id: string
  seller_id: string
  material_id?: string | null
  material_name: string
  category: string
  quantity: number
  unit: string
  form: string
  quality_grade: string
  moisture_content?: number | null
  processing_level: string
  location: string
  price: number
  price_type: 'fixed' | 'negotiable'
  available_date?: string | null
  images: string[]
  description: string
  status: string
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface Requirement {
  id: string
  buyer_id: string
  material_name: string
  quantity: number
  unit: string
  required_quality: string
  application: string
  location: string
  max_price?: number | null
  delivery_date?: string | null
  alternatives_allowed: boolean
  status: string
  confirmed: boolean
  description?: string
  is_demo: boolean
}

export interface AnalysisApplication {
  name: string
  rationale?: string
  feasibility?: string
}

export interface Analysis {
  material_identity: string
  category: string
  quantity_context: string
  possible_applications: AnalysisApplication[]
  target_industries: string[]
  potential_products: string[]
  processing_requirements: string[]
  quality_considerations: string[]
  storage_handling: string[]
  environmental_benefits: string[]
  buyer_categories: string[]
  search_queries: string[]
  source: string
  is_ai_generated: boolean
  disclaimer: string
}

export interface PriceEstimate {
  insufficient_data: boolean
  suggested_low?: number | null
  suggested_typical?: number | null
  suggested_high?: number | null
  suggested_low_per_kg?: number
  suggested_typical_per_kg?: number
  suggested_high_per_kg?: number
  message: string
  factors: string[]
  data_source: string
  confidence: string
  comparable_count: number
  is_demo_estimate: boolean
  seller_control: string
}

export interface MatchFactors {
  material: number
  quantity: number
  location: number
  quality: number
}

export interface MatchResult {
  score: number
  factors: MatchFactors
  weights: Record<string, number>
  reasons: string[]
  summary: string
  note: string
}

export interface SellerMatch {
  requirement: Requirement
  buyer_name: string
  match: MatchResult
  confirmed_demand: boolean
}

export interface BuyerMatch {
  listing: Listing
  supplier_name: string
  match: MatchResult
  price: number
  status: string
}

export interface DiscoveryResult {
  id?: string
  source_type: 'ai_prospect' | 'real_business_listing' | 'published_requirement'
  label: string
  demand_label?: string
  business_name: string
  address: string
  category: string
  website?: string | null
  distance_km?: number | null
  material?: string
  quantity?: number
  unit?: string
  reference_id?: string
  note: string
  search_query?: string
  source?: string
  is_real_business: boolean
  is_confirmed_demand: boolean
  is_demo: boolean
}

export interface Offer {
  id: string
  negotiation_id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  made_by: 'buyer' | 'seller'
  price: number
  quantity: number
  unit: string
  delivery_location: string
  message: string
  status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn'
  parent_offer_id?: string | null
  created_at: string
}

export interface Negotiation {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  buyer_name?: string
  seller_name?: string
  status: string
  agreed_price?: number | null
  agreed_quantity?: number | null
  order_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface Order {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  negotiation_id?: string | null
  material_name: string
  quantity: number
  unit: string
  agreed_price: number
  total_value: number
  advance_amount: number
  balance_amount: number
  advance_status: string
  balance_status: string
  seller_fee: number
  transport_cost?: number | null
  transport_payer: string
  transport_agreed: boolean
  status: string
  buyer_confirmed_at?: string | null
  seller_accepted_at?: string | null
  pickup_location: string
  delivery_location: string
  estimated_pickup?: string | null
  estimated_delivery?: string | null
  terms?: string
  cancellation_reason?: string | null
  is_demo: boolean
  created_at: string
}

export interface Payment {
  id: string
  order_id: string
  type: string
  amount: number
  status: string
  method: string
  utr?: string | null
  submitted_at?: string | null
  confirmed_at?: string | null
  note?: string
}

export interface Refund {
  id: string
  order_id: string
  requested_by: string
  reason: string
  order_stage: string
  amount: number
  seller_response: string
  status: string
}

export interface ShipmentEvent {
  status: string
  timestamp: string
  note: string
}

export interface Shipment {
  id: string
  order_id: string
  status: string
  transporter_id?: string | null
  vehicle_type: string
  distance_km?: number | null
  transport_cost?: number | null
  estimated_pickup?: string | null
  estimated_delivery?: string | null
  actual_pickup?: string | null
  actual_delivery?: string | null
  tracking_events: ShipmentEvent[]
}

export interface MaterialPassport {
  id: string
  material_name: string
  source: string
  quantity: string
  quality: string
  processing_history: string
  intended_applications: string[]
  storage_conditions: string[]
  specifications: Record<string, unknown>
}

export interface LogisticsEstimate {
  distance_km: number | null
  distance_source: string
  vehicle_type: string
  transport_cost: number | null
  cost_source: string
  loading_unloading_hours: number
  estimated_transit_days: number | null
  estimated_delivery_date: string | null
  transport_cost_available: boolean
  note: string
}

export interface AdminOverview {
  counts: Record<string, number>
  material_categories: Record<string, number>
  demo_revenue_overview: {
    service_fees: number
    order_material_value: number
    note: string
  }
  storage_backend: string
}

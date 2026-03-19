-- ============================================
-- Migration: Create Contracts Table
-- Description: Main contract management with user isolation
-- ============================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('license', 'service', 'support', 'subscription')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  CONSTRAINT end_after_start CHECK (end_date > start_date),
  value DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD', 'AUD')),
  auto_renew BOOLEAN DEFAULT false,
  renewal_terms TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

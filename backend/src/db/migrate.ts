import { query } from './client';
import { logger } from '../utils/logger';

/**
 * GigShield Database Migration
 * Creates all tables in the correct order with proper constraints.
 */
async function migrate() {
  logger.info('Running database migrations...');

  await query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Zones (cities + delivery zones)
    CREATE TABLE IF NOT EXISTS zones (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      city VARCHAR(100) NOT NULL,
      name VARCHAR(200) NOT NULL,
      display_name VARCHAR(200) NOT NULL,
      geo_polygon JSONB,
      lat DECIMAL(10, 6),
      lng DECIMAL(10, 6),
      flood_history_score DECIMAL(4, 2) DEFAULT 0,
      aqi_frequency_score DECIMAL(4, 2) DEFAULT 0,
      order_volume_baseline DECIMAL(10, 2) DEFAULT 100,
      active_worker_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Workers (delivery partners)
    CREATE TABLE IF NOT EXISTS workers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      phone VARCHAR(15) UNIQUE NOT NULL,
      name VARCHAR(200),
      firebase_uid VARCHAR(200) UNIQUE,
      platform VARCHAR(20) CHECK (platform IN ('swiggy', 'zomato', 'dunzo', 'blinkit')),
      platform_worker_id VARCHAR(100),
      zone_id UUID REFERENCES zones(id),
      current_tier VARCHAR(20) DEFAULT 'standard' CHECK (current_tier IN ('lite', 'standard', 'pro')),
      avg_daily_earning DECIMAL(10, 2) DEFAULT 0,
      avg_daily_hours DECIMAL(4, 2) DEFAULT 8,
      bcs_trust_reserve DECIMAL(4, 2) DEFAULT 0,
      platform_tenure_months INTEGER DEFAULT 0,
      kyc_verified BOOLEAN DEFAULT FALSE,
      upi_id VARCHAR(200),
      razorpay_customer_id VARCHAR(200),
      razorpay_mandate_id VARCHAR(200),
      language VARCHAR(5) DEFAULT 'hi',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Policies (weekly coverage windows)
    CREATE TABLE IF NOT EXISTS policies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      worker_id UUID NOT NULL REFERENCES workers(id),
      tier VARCHAR(20) NOT NULL CHECK (tier IN ('lite', 'standard', 'pro')),
      week_start TIMESTAMPTZ NOT NULL,
      week_end TIMESTAMPTZ NOT NULL,
      base_premium DECIMAL(8, 2) NOT NULL,
      final_premium DECIMAL(8, 2) NOT NULL,
      premium_factors JSONB DEFAULT '{}',
      daily_cap DECIMAL(8, 2) NOT NULL,
      max_covered_days INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
      premium_paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Trigger Events (confirmed disruptions)
    CREATE TABLE IF NOT EXISTS trigger_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      zone_id UUID NOT NULL REFERENCES zones(id),
      trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('WEATHER', 'AQI', 'HEAT', 'ZONE_DISRUPTION', 'CIVIL')),
      severity VARCHAR(20) DEFAULT 'moderate' CHECK (severity IN ('low', 'moderate', 'high', 'extreme')),
      api_source VARCHAR(100) NOT NULL,
      backup_source_confirmed BOOLEAN DEFAULT FALSE,
      trigger_data JSONB DEFAULT '{}',
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Claims (individual worker claims against a trigger)
    CREATE TABLE IF NOT EXISTS claims (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      worker_id UUID NOT NULL REFERENCES workers(id),
      policy_id UUID NOT NULL REFERENCES policies(id),
      trigger_event_id UUID NOT NULL REFERENCES trigger_events(id),
      bcs_score DECIMAL(5, 2),
      bcs_signals JSONB DEFAULT '{}',
      track VARCHAR(10) CHECK (track IN ('A', 'B', 'C', 'D')),
      disrupted_hours DECIMAL(4, 2),
      hourly_rate DECIMAL(8, 2),
      payout_amount DECIMAL(8, 2),
      status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'soft_flagged', 'held', 'blocked', 'paid', 'rejected', 'appealed')),
      payout_utr VARCHAR(100),
      razorpay_payout_id VARCHAR(200),
      appeal_reason TEXT,
      reviewed_by VARCHAR(200),
      review_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Ring Flags (coordinated fraud detections)
    CREATE TABLE IF NOT EXISTS ring_flags (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      cluster_id VARCHAR(100) NOT NULL,
      worker_ids UUID[] NOT NULL,
      signal_ids TEXT[] NOT NULL,
      confidence_score DECIMAL(4, 2),
      auto_blocked BOOLEAN DEFAULT FALSE,
      reviewed BOOLEAN DEFAULT FALSE,
      reviewed_by VARCHAR(200),
      review_outcome VARCHAR(30) CHECK (review_outcome IN ('confirmed_fraud', 'false_positive', 'pending')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Payout Transactions
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      claim_id UUID NOT NULL REFERENCES claims(id),
      worker_id UUID NOT NULL REFERENCES workers(id),
      amount DECIMAL(8, 2) NOT NULL,
      transaction_type VARCHAR(20) CHECK (transaction_type IN ('payout', 'refund', 'premium_debit')),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      razorpay_payout_id VARCHAR(200),
      utr VARCHAR(100),
      failure_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_workers_zone ON workers(zone_id);
    CREATE INDEX IF NOT EXISTS idx_workers_phone ON workers(phone);
    CREATE INDEX IF NOT EXISTS idx_policies_worker ON policies(worker_id);
    CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
    CREATE INDEX IF NOT EXISTS idx_claims_worker ON claims(worker_id);
    CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
    CREATE INDEX IF NOT EXISTS idx_claims_trigger ON claims(trigger_event_id);
    CREATE INDEX IF NOT EXISTS idx_trigger_events_zone ON trigger_events(zone_id);
    CREATE INDEX IF NOT EXISTS idx_trigger_events_active ON trigger_events(is_active);
  `);

  logger.info('All migrations completed successfully');
}

migrate().catch((err) => {
  logger.error('Migration failed', err);
  process.exit(1);
});

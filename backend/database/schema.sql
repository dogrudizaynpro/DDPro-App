-- ============================================================
-- DDPRO BACKEND - DATABASE SCHEMA
-- ============================================================
-- PostgreSQL / Supabase Schema for DDPro System
-- Phase 1: Core tables only
-- DO NOT execute this file manually
-- Use Supabase SQL Editor or migration tools in Phase 2
-- ============================================================

-- ============================================================
-- TABLE: projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_type TEXT,
  status TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: research_items
-- ============================================================
CREATE TABLE IF NOT EXISTS research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: offers
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  project_id UUID,
  amount NUMERIC,
  currency TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_offers_project_id
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: memory_items
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: system_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT,
  message TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: integrations
-- ============================================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL,
  configuration JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SCHEMA NOTES
-- ============================================================
-- Phase 1: No RLS policies enabled
-- Phase 1: No triggers created
-- Phase 1: No functions created
-- Phase 2: RLS policies will be added
-- Phase 2: Audit triggers will be added
-- Phase 2: Additional indexes will be created
-- ============================================================

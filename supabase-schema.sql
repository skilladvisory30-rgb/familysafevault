-- FamilyKYCManager - Supabase PostgreSQL Schema & Security Policies
-- Copy & Paste this SQL script into the Supabase SQL Editor (https://app.supabase.com)

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    country TEXT DEFAULT 'India',
    billing_tier TEXT DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. FAMILY MEMBERS TABLE
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    member_key TEXT NOT NULL, -- e.g., 'head', 'spouse', 'child', 'parent'
    name TEXT NOT NULL,
    relation TEXT NOT NULL,
    role TEXT DEFAULT 'Member',
    avatar TEXT,
    mobile TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. VAULT DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS vault_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    member_key TEXT NOT NULL,
    doc_type TEXT NOT NULL, -- e.g., 'Aadhaar', 'PAN', 'Passport', 'SSN'
    doc_number TEXT NOT NULL,
    kyc_name TEXT NOT NULL,
    kyc_dob DATE,
    kyc_address TEXT,
    issue_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'valid', -- 'valid', 'warning', 'critical'
    encrypted_payload TEXT, -- WebCrypto encrypted payload (zero-knowledge)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. AUDIT TIMELINE TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ROW LEVEL SECURITY (RLS) POLICIES --
-- Ensure users can ONLY read and write their OWN data

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Family Members Policies
CREATE POLICY "Users can view own family members" ON family_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own family members" ON family_members FOR ALL USING (auth.uid() = user_id);

-- Vault Documents Policies
CREATE POLICY "Users can view own documents" ON vault_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own documents" ON vault_documents FOR ALL USING (auth.uid() = user_id);

-- Audit Logs Policies
CREATE POLICY "Users can view own audit logs" ON audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audit logs" ON audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

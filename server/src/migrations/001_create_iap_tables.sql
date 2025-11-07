-- Database Migration: Create IAP Tables
-- PostgreSQL schema for AfetNet IAP system

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    device_id VARCHAR(255),
    apple_user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL CHECK (product_id IN ('org.afetnetapp.premium.monthly', 'org.afetnetapp.premium.yearly', 'org.afetnetapp.premium.lifetime')),
    original_transaction_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'refunded', 'revoked')),
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    is_lifetime BOOLEAN DEFAULT FALSE,
    last_event JSONB,
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active purchase per user per product
    UNIQUE(user_id, product_id, original_transaction_id)
);

-- Create entitlements table (denormalized for performance)
CREATE TABLE IF NOT EXISTS entitlements (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(20) CHECK (source IN ('monthly', 'yearly', 'lifetime')),
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    active_product_id VARCHAR(255),
    last_purchase_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_expires_at ON purchases(expires_at);
CREATE INDEX IF NOT EXISTS idx_purchases_original_transaction_id ON purchases(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_is_premium ON entitlements(is_premium);
CREATE INDEX IF NOT EXISTS idx_entitlements_expires_at ON entitlements(expires_at);

-- Create function to update entitlements when purchases change
CREATE OR REPLACE FUNCTION update_user_entitlements()
RETURNS TRIGGER AS $$
BEGIN
    -- Update entitlements based on active purchases
    INSERT INTO entitlements (user_id, is_premium, source, expires_at, active_product_id, last_purchase_id, updated_at)
    SELECT 
        NEW.user_id,
        CASE 
            WHEN p.is_lifetime THEN TRUE
            WHEN p.expires_at > NOW() THEN TRUE
            ELSE FALSE
        END as is_premium,
        CASE 
            WHEN p.product_id = 'afetnet_premium_lifetime' THEN 'lifetime'
            WHEN p.product_id = 'afetnet_premium_monthly1' THEN 'monthly'
            WHEN p.product_id = 'afetnet_premium_yearly1' THEN 'yearly'
        END as source,
        CASE 
            WHEN p.is_lifetime THEN NULL
            ELSE p.expires_at
        END as expires_at,
        p.product_id as active_product_id,
        p.id as last_purchase_id,
        NOW() as updated_at
    FROM purchases p
    WHERE p.user_id = NEW.user_id 
        AND p.status = 'active'
        AND (p.is_lifetime OR p.expires_at > NOW())
    ORDER BY 
        CASE WHEN p.is_lifetime THEN 0 ELSE 1 END, -- Lifetime first
        p.expires_at DESC NULLS LAST -- Most recent expiry first
    LIMIT 1
    
    ON CONFLICT (user_id) DO UPDATE SET
        is_premium = EXCLUDED.is_premium,
        source = EXCLUDED.source,
        expires_at = EXCLUDED.expires_at,
        active_product_id = EXCLUDED.active_product_id,
        last_purchase_id = EXCLUDED.last_purchase_id,
        updated_at = EXCLUDED.updated_at;
    
    -- If no active purchases, set premium to false
    IF NOT EXISTS (
        SELECT 1 FROM purchases 
        WHERE user_id = NEW.user_id 
            AND status = 'active' 
            AND (is_lifetime OR expires_at > NOW())
    ) THEN
        UPDATE entitlements 
        SET is_premium = FALSE, 
            source = NULL, 
            expires_at = NULL,
            active_product_id = NULL,
            last_purchase_id = NULL,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update entitlements
DROP TRIGGER IF EXISTS trigger_update_entitlements ON purchases;
CREATE TRIGGER trigger_update_entitlements
    AFTER INSERT OR UPDATE OR DELETE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_user_entitlements();

-- Create function to clean up expired purchases
CREATE OR REPLACE FUNCTION cleanup_expired_purchases()
RETURNS void AS $$
BEGIN
    -- Mark expired subscriptions as expired
    UPDATE purchases 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' 
        AND NOT is_lifetime 
        AND expires_at < NOW();
    
    -- Log cleanup
    RAISE NOTICE 'Cleaned up expired purchases at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to get user entitlements
CREATE OR REPLACE FUNCTION get_user_entitlements(p_user_id UUID)
RETURNS TABLE (
    is_premium BOOLEAN,
    source VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE,
    active_product_id VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.is_premium,
        e.source,
        e.expires_at,
        e.active_product_id
    FROM entitlements e
    WHERE e.user_id = p_user_id;
    
    -- If no entitlements found, return default
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::VARCHAR(20), NULL::TIMESTAMP WITH TIME ZONE, NULL::VARCHAR(255);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert initial data (optional)
-- INSERT INTO users (email, device_id) VALUES ('test@afetnet.com', 'test_device_123');

COMMENT ON TABLE users IS 'User accounts for AfetNet IAP system';
COMMENT ON TABLE purchases IS 'Purchase records with Apple transaction details';
COMMENT ON TABLE entitlements IS 'Denormalized user premium status for fast lookups';
COMMENT ON COLUMN purchases.product_id IS 'Only valid App Store Connect product IDs';
COMMENT ON COLUMN purchases.status IS 'Purchase status: active, expired, refunded, revoked';
COMMENT ON COLUMN purchases.is_lifetime IS 'True for lifetime purchases, false for subscriptions';
COMMENT ON COLUMN purchases.last_event IS 'Last Apple Server Notification event data';
COMMENT ON COLUMN entitlements.source IS 'Premium source: monthly, yearly, lifetime';

-- Create user_locations table for earthquake warning system
CREATE TABLE IF NOT EXISTS user_locations (
    user_id VARCHAR(255) PRIMARY KEY,
    push_token VARCHAR(500),
    last_latitude DECIMAL(10, 8),
    last_longitude DECIMAL(11, 8),
    device_type VARCHAR(20) CHECK (device_type IN ('ios', 'android')),
    provinces TEXT[],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_user_locations_updated_at ON user_locations(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_locations_push_token ON user_locations(push_token) WHERE push_token IS NOT NULL;

COMMENT ON TABLE user_locations IS 'User locations and push tokens for earthquake warning system';

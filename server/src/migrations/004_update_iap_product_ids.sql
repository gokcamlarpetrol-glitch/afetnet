-- Migration: Update IAP product identifiers to RevenueCat v2 naming
-- Ensures database constraints and helper functions accept the new product IDs

BEGIN;

-- Normalize existing purchase records to the new identifiers
UPDATE purchases
SET product_id = CASE product_id
    WHEN 'org.afetapp.premium.monthly' THEN 'org.afetapp.premium.monthly.v2'
    WHEN 'org.afetapp.premium.yearly' THEN 'org.afetapp.premium.yearly.v2'
    WHEN 'org.afetapp.premium.lifetime' THEN 'org.afetapp.premium.lifetime.v2'
    WHEN 'afetnet_premium_monthly1' THEN 'org.afetapp.premium.monthly.v2'
    WHEN 'afetnet_premium_yearly1' THEN 'org.afetapp.premium.yearly.v2'
    WHEN 'afetnet_premium_lifetime' THEN 'org.afetapp.premium.lifetime.v2'
    ELSE product_id
END
WHERE product_id IN (
    'org.afetapp.premium.monthly',
    'org.afetapp.premium.yearly',
    'org.afetapp.premium.lifetime',
    'afetnet_premium_monthly1',
    'afetnet_premium_yearly1',
    'afetnet_premium_lifetime'
);

UPDATE entitlements
SET active_product_id = CASE active_product_id
    WHEN 'org.afetapp.premium.monthly' THEN 'org.afetapp.premium.monthly.v2'
    WHEN 'org.afetapp.premium.yearly' THEN 'org.afetapp.premium.yearly.v2'
    WHEN 'org.afetapp.premium.lifetime' THEN 'org.afetapp.premium.lifetime.v2'
    WHEN 'afetnet_premium_monthly1' THEN 'org.afetapp.premium.monthly.v2'
    WHEN 'afetnet_premium_yearly1' THEN 'org.afetapp.premium.yearly.v2'
    WHEN 'afetnet_premium_lifetime' THEN 'org.afetapp.premium.lifetime.v2'
    ELSE active_product_id
END
WHERE active_product_id IN (
    'org.afetapp.premium.monthly',
    'org.afetapp.premium.yearly',
    'org.afetapp.premium.lifetime',
    'afetnet_premium_monthly1',
    'afetnet_premium_yearly1',
    'afetnet_premium_lifetime'
);

-- Refresh the product_id check constraint to allow only the new identifiers
ALTER TABLE purchases
    DROP CONSTRAINT IF EXISTS purchases_product_id_check;

ALTER TABLE purchases
    ADD CONSTRAINT purchases_product_id_check CHECK (
        product_id IN (
            'org.afetapp.premium.monthly.v2',
            'org.afetapp.premium.yearly.v2',
            'org.afetapp.premium.lifetime.v2'
        )
    );

-- Keep the entitlement refresh logic aligned with the updated IDs
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
            WHEN p.product_id = 'org.afetapp.premium.lifetime.v2' THEN 'lifetime'
            WHEN p.product_id = 'org.afetapp.premium.monthly.v2' THEN 'monthly'
            WHEN p.product_id = 'org.afetapp.premium.yearly.v2' THEN 'yearly'
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

COMMIT;



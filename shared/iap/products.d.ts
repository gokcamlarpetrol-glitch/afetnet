export declare const IAP_PRODUCTS: {
    readonly monthly: "org.afetapp.premium.monthly.v2";
    readonly yearly: "org.afetapp.premium.yearly.v2";
    readonly lifetime: "org.afetapp.premium.lifetime.v2";
};
export type ProductKey = keyof typeof IAP_PRODUCTS;
export type ProductId = typeof IAP_PRODUCTS[ProductKey];
export declare const IAP_PRODUCT_IDS: ProductId[];
export declare const SUBSCRIPTION_PRODUCTS: ProductId[];
export declare const LIFETIME_PRODUCTS: ProductId[];
export declare const isSubscriptionProduct: (productId: string) => boolean;
export declare const isLifetimeProduct: (productId: string) => boolean;
export declare const isValidProduct: (productId: string) => boolean;
export declare const PRODUCT_CONFIG: {
    readonly "org.afetapp.premium.monthly.v2": {
        readonly id: "org.afetapp.premium.monthly.v2";
        readonly title: "Aylık Premium";
        readonly description: "Tüm premium özellikler 1 ay";
        readonly price: 49.99;
        readonly currency: "TRY";
        readonly type: "subscription";
        readonly duration: "monthly";
    };
    readonly "org.afetapp.premium.yearly.v2": {
        readonly id: "org.afetapp.premium.yearly.v2";
        readonly title: "Yıllık Premium";
        readonly description: "Tüm premium özellikler 1 yıl (%17 indirim)";
        readonly price: 499.99;
        readonly currency: "TRY";
        readonly type: "subscription";
        readonly duration: "yearly";
    };
    readonly "org.afetapp.premium.lifetime.v2": {
        readonly id: "org.afetapp.premium.lifetime.v2";
        readonly title: "Yaşam Boyu Premium";
        readonly description: "Tüm premium özellikler kalıcı (%50 indirim)";
        readonly price: 999.99;
        readonly currency: "TRY";
        readonly type: "lifetime";
        readonly duration: "permanent";
    };
};
export type ProductType = 'subscription' | 'lifetime';
export type SubscriptionDuration = 'monthly' | 'yearly' | 'permanent';
export interface ProductInfo {
    id: ProductId;
    title: string;
    description: string;
    price: number;
    currency: string;
    type: ProductType;
    duration: SubscriptionDuration;
}
export declare const logProductDetection: (productId: string) => void;
export declare const logPremiumStatus: (isPremium: boolean, productId?: string) => void;
//# sourceMappingURL=products.d.ts.map
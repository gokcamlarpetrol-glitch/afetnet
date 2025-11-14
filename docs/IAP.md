# In‑App Purchase (RevenueCat) and Receipt Validation

This app uses RevenueCat for subscription and lifetime purchases. The single paywall screen lives at `src/features/paywall/Paywall.tsx`, and Settings includes entries to open the paywall and restore purchases.

## Product IDs

- monthly: `org.afetapp.premium.monthly.v2`
- yearly: `org.afetapp.premium.yearly.v2`
- lifetime: `org.afetapp.premium.lifetime.v2`

Authoritative source: `shared/iap/products.ts`.

## Client Flow (iOS)

1. App startup calls `initializeRevenueCat()` in `App.tsx`.
2. Paywall loads offerings via `react-native-purchases` and shows packages.
3. Purchase: idle → loading → success/failure via Alerts; restore is available both on Paywall and from Settings.

## Server Receipt Validation (recommended)

When implementing server‑side verification (optional for initial submission):

- Send the iOS receipt to the App Store verifyReceipt endpoint.
- Always try PRODUCTION first. If response status is `21007`, retry against the SANDBOX endpoint.

Pseudo:

```typescript
async function validateIosReceipt(receipt: string) {
  const prod = await post('https://buy.itunes.apple.com/verifyReceipt', { receipt });
  if (prod.status === 21007) {
    return await post('https://sandbox.itunes.apple.com/verifyReceipt', { receipt });
  }
  return prod;
}
```

Notes:
- Never ship secrets in the client. Keep shared secrets on server only.
- RevenueCat already performs receipt handling; server validation is for additional auditing if required.

## Environment Variables

See `.env.example` for placeholders:
- `RC_IOS_KEY`, `RC_ANDROID_KEY`
- Optional: `EEW_*` keys

## QA Checklist

- Open Settings → Premium → Paywall loads offerings.
- Purchase button shows loading and results (success/cancel/error).
- Restore Purchases works and shows a confirmation.
- Works on iPhone and iPad; paywall is a normal screen (no obscured popups).

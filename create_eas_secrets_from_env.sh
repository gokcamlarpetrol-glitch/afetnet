#!/bin/bash

echo "🔐 .env DOSYASINDAN EAS SECRETS OLUŞTURMA"
echo ""

# .env dosyasını kontrol et
if [ ! -f .env ]; then
    echo "❌ .env dosyası bulunamadı!"
    exit 1
fi

echo "✅ .env dosyası bulundu"
echo ""

# .env dosyasından değerleri oku
source .env

# Secret'ları oluştur
echo "📋 Oluşturulacak secrets:"
echo ""

# 1. EXPO_PUBLIC_OPENAI_API_KEY
if [ -n "$EXPO_PUBLIC_OPENAI_API_KEY" ]; then
    echo "1️⃣  EXPO_PUBLIC_OPENAI_API_KEY"
    echo "   Komut: eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value '$EXPO_PUBLIC_OPENAI_API_KEY'"
    echo ""
fi

# 2. RC_IOS_KEY
if [ -n "$RC_IOS_KEY" ]; then
    echo "2️⃣  RC_IOS_KEY"
    echo "   Komut: eas secret:create --scope project --name RC_IOS_KEY --value '$RC_IOS_KEY'"
    echo ""
fi

# 3. RC_ANDROID_KEY
if [ -n "$RC_ANDROID_KEY" ] && [ "$RC_ANDROID_KEY" != "goog_your-android-key-here" ]; then
    echo "3️⃣  RC_ANDROID_KEY"
    echo "   Komut: eas secret:create --scope project --name RC_ANDROID_KEY --value '$RC_ANDROID_KEY'"
    echo ""
elif [ "$RC_ANDROID_KEY" = "goog_your-android-key-here" ]; then
    echo "⚠️  RC_ANDROID_KEY: Placeholder değer tespit edildi - güncellenmeli!"
    echo ""
fi

# 4. FIREBASE_API_KEY
if [ -n "$FIREBASE_API_KEY" ]; then
    echo "4️⃣  FIREBASE_API_KEY"
    echo "   Komut: eas secret:create --scope project --name FIREBASE_API_KEY --value '$FIREBASE_API_KEY'"
    echo ""
fi

# 5. FIREBASE_PROJECT_ID
if [ -n "$FIREBASE_PROJECT_ID" ]; then
    echo "5️⃣  FIREBASE_PROJECT_ID"
    echo "   Komut: eas secret:create --scope project --name FIREBASE_PROJECT_ID --value '$FIREBASE_PROJECT_ID'"
    echo ""
fi

# 6. ORG_SECRET
if [ -n "$ORG_SECRET" ]; then
    echo "6️⃣  ORG_SECRET"
    echo "   Komut: eas secret:create --scope project --name ORG_SECRET --value '$ORG_SECRET'"
    echo ""
fi

echo "---"
echo ""
echo "✅ Tüm komutlar hazır! Yukarıdaki komutları sırayla çalıştırın."
echo ""
echo "💡 İPUCU: Tüm komutları otomatik çalıştırmak için:"
echo "   bash create_eas_secrets_from_env.sh | grep 'Komut:' | cut -d: -f2- | bash"

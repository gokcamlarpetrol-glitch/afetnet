#!/bin/bash
# ORG_SECRET Generator Script
# Bu script güçlü bir ORG_SECRET oluşturur

echo "🔐 ORG_SECRET oluşturuluyor..."
echo ""
echo "Aşağıdaki değeri Render.com Environment Variables'a ekleyin:"
echo ""
echo "Key: ORG_SECRET"
echo "Value:"
openssl rand -base64 32
echo ""
echo "✅ Bu değeri Render.com'da ORG_SECRET olarak ekleyin"
echo "⚠️  Bu değeri güvenli bir yerde saklayın - client uygulamada da kullanılacak"


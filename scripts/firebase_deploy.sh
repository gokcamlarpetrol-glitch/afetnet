#!/bin/bash

# Firebase Deploy Script
# Deploys Firestore rules, indexes, and storage rules

set -e

echo "🔥 Firebase Deploy Başlatılıyor..."

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI bulunamadı!"
    echo "Yüklemek için: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Firebase'e giriş yapılmamış!"
    echo "Giriş yapmak için: firebase login"
    exit 1
fi

echo "✅ Firebase CLI hazır"

# Deploy Firestore rules
echo "📋 Firestore Security Rules deploy ediliyor..."
firebase deploy --only firestore:rules

# Deploy Firestore indexes
echo "📊 Firestore Indexes deploy ediliyor..."
firebase deploy --only firestore:indexes

# Deploy Storage rules
echo "💾 Storage Rules deploy ediliyor..."
firebase deploy --only storage

echo "✅ Firebase deploy tamamlandı!"
echo ""
echo "📝 Sonraki adımlar:"
echo "1. Firebase Console'da Firestore Database'i oluştur (Production mode)"
echo "2. Security rules'ları test et"
echo "3. Index'lerin oluşturulmasını bekle (birkaç dakika sürebilir)"


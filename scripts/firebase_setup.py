#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Firebase google-services.json otomatik kurulum & güncelleme scripti

Kullanım:
  1) Firebase Console'dan yeni google-services.json dosyasını indir
  2) Proje kökünde çalıştır:
       python3 scripts/firebase_setup.py

Not:
  - En son indirilen google-services*.json dosyasını otomatik bulur
  - android/app/google-services.json üzerine kopyalar
  - Gradle temizliği ve hızlı bir run komutu tetikleyebilir
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    home = str(Path.home())
    downloads_path = os.path.join(home, "Downloads")
    project_root = os.getcwd()
    android_app_path = os.path.join(project_root, "android", "app")
    ios_path = os.path.join(project_root, "ios")

    if not os.path.isdir(downloads_path):
        print(f"❌ İndirilenler klasörü bulunamadı: {downloads_path}")
        return 1

    try:
        files_in_downloads = os.listdir(downloads_path)
    except Exception as e:
        print(f"❌ İndirilenler okunamadı: {e}")
        return 1

    # --- ANDROID: google-services.json ---
    json_candidates = [
        f for f in files_in_downloads
        if f.startswith("google-services") and f.endswith(".json")
    ]
    if json_candidates:
        latest_json = sorted(
            [os.path.join(downloads_path, f) for f in json_candidates],
            key=lambda x: os.path.getmtime(x),
            reverse=True,
        )[0]

        target_file = os.path.join(android_app_path, "google-services.json")
        os.makedirs(android_app_path, exist_ok=True)

        if os.path.exists(target_file):
            try:
                os.remove(target_file)
                print("🧹 Eski google-services.json silindi.")
            except Exception as e:
                print(f"⚠️ Eski dosya silinemedi: {e}")

        try:
            shutil.copy(latest_json, target_file)
            print(f"✅ Yeni google-services.json eklendi: {target_file}")
        except Exception as e:
            print(f"❌ Dosya kopyalanamadı: {e}")
            return 1
    else:
        print("⚠️ İndirilenlerde google-services.json bulunamadı (Android adımı atlandı).")

    # --- iOS: GoogleService-Info.plist ---
    plist_candidates = [
        f for f in files_in_downloads
        if f.startswith("GoogleService-Info") and f.endswith(".plist")
    ]
    if plist_candidates:
        latest_plist = sorted(
            [os.path.join(downloads_path, f) for f in plist_candidates],
            key=lambda x: os.path.getmtime(x),
            reverse=True,
        )[0]

        # Copy to ios/ and project root (some setups expect both)
        ios_target = os.path.join(ios_path, "GoogleService-Info.plist")
        root_target = os.path.join(project_root, "GoogleService-Info.plist")

        try:
            shutil.copy(latest_plist, ios_target)
            print(f"✅ Yeni GoogleService-Info.plist eklendi: {ios_target}")
        except Exception as e:
            print(f"❌ iOS plist kopyalanamadı (ios/): {e}")
            return 1

        try:
            shutil.copy(latest_plist, root_target)
            print(f"✅ Yeni GoogleService-Info.plist eklendi: {root_target}")
        except Exception as e:
            print(f"⚠️ Root plist kopyalanamadı (opsiyonel): {e}")
    else:
        print("⚠️ İndirilenlerde GoogleService-Info.plist bulunamadı (iOS adımı atlandı).")

    # Gradle cache temizliği (opsiyonel)
    print("🧩 Gradle temizleniyor...")
    try:
        subprocess.run(["bash", "-c", "cd android && ./gradlew clean"], check=False)
    except Exception as e:
        print(f"⚠️ Gradle temizliği sırasında uyarı: {e}")

    # Hızlı run (opsiyonel)
    print("🚀 Firebase bağlantısı test ediliyor (build/run başlatılabilir)...")
    try:
        subprocess.run(["bash", "-c", "npx expo run:android || npm run android"], check=False)
    except Exception as e:
        print(f"⚠️ Android çalıştırma sırasında uyarı: {e}")

    # iOS tarafı için sadece bilgilendirme (Expo/CLI üzerinden çalıştırabilirsiniz)
    print("ℹ️ iOS için: 'npx expo run:ios' ya da Xcode ile workspace açıp deneyebilirsiniz.")

    print("🎯 İşlem tamam! Artık Firebase bağlantısı aktif olmalı.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

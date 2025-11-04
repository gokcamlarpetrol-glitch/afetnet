#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Firebase Config Güncelleme Scripti
GoogleService-Info.plist ve google-services.json dosyalarını Firebase Console'dan indirilen gerçek dosyalarla günceller
"""

import os
import shutil
import sys
import json
import plistlib
from pathlib import Path

def update_firebase_config():
    """Firebase config dosyalarını güncelle"""
    home = str(Path.home())
    downloads_path = os.path.join(home, "Downloads")
    project_root = os.getcwd()
    
    print("🔥 Firebase Config Güncelleme")
    print("=" * 50)
    
    # Android: google-services.json
    print("\n📱 Android: google-services.json")
    json_files = [f for f in os.listdir(downloads_path) 
                  if f.startswith("google-services") and f.endswith(".json")]
    
    if json_files:
        latest_json = sorted(
            [os.path.join(downloads_path, f) for f in json_files],
            key=lambda x: os.path.getmtime(x),
            reverse=True
        )[0]
        
        # Validate JSON
        try:
            with open(latest_json, 'r') as f:
                data = json.load(f)
                android_app_id = data.get('client', [{}])[0].get('client_info', {}).get('mobilesdk_app_id', '')
                
                if 'YOUR' in android_app_id:
                    print("⚠️  İndirilen dosyada placeholder değerler var!")
                    print("   Firebase Console'dan gerçek dosyayı indirin.")
                else:
                    # Copy to project root
                    target = os.path.join(project_root, "google-services.json")
                    shutil.copy(latest_json, target)
                    print(f"✅ google-services.json güncellendi: {target}")
                    
                    # Copy to android/app/
                    android_target = os.path.join(project_root, "android", "app", "google-services.json")
                    os.makedirs(os.path.dirname(android_target), exist_ok=True)
                    shutil.copy(latest_json, android_target)
                    print(f"✅ android/app/google-services.json güncellendi")
                    
                    # Update firebase.ts config
                    update_firebase_ts_config(data)
        except Exception as e:
            print(f"❌ JSON validation hatası: {e}")
    else:
        print("⚠️  İndirilenlerde google-services.json bulunamadı")
    
    # iOS: GoogleService-Info.plist
    print("\n🍎 iOS: GoogleService-Info.plist")
    plist_files = [f for f in os.listdir(downloads_path) 
                   if f.startswith("GoogleService-Info") and f.endswith(".plist")]
    
    if plist_files:
        latest_plist = sorted(
            [os.path.join(downloads_path, f) for f in plist_files],
            key=lambda x: os.path.getmtime(x),
            reverse=True
        )[0]
        
        try:
            with open(latest_plist, 'rb') as f:
                data = plistlib.load(f)
                
                # Copy to project root
                target = os.path.join(project_root, "GoogleService-Info.plist")
                shutil.copy(latest_plist, target)
                print(f"✅ GoogleService-Info.plist güncellendi: {target}")
                
                # Copy to ios/
                ios_target = os.path.join(project_root, "ios", "GoogleService-Info.plist")
                os.makedirs(os.path.dirname(ios_target), exist_ok=True)
                shutil.copy(latest_plist, ios_target)
                print(f"✅ ios/GoogleService-Info.plist güncellendi")
        except Exception as e:
            print(f"❌ PLIST validation hatası: {e}")
    else:
        print("⚠️  İndirilenlerde GoogleService-Info.plist bulunamadı")
    
    print("\n" + "=" * 50)
    print("✅ Firebase config güncelleme tamamlandı!")
    print("\n📝 Sonraki adımlar:")
    print("1. Firebase Console'da Firestore Database oluştur")
    print("2. Firebase Console'da Storage oluştur")
    print("3. Security rules'ları deploy et: ./scripts/firebase_deploy.sh")

def update_firebase_ts_config(json_data):
    """firebase.ts config dosyasını güncelle"""
    config_file = os.path.join(os.getcwd(), "src", "core", "config", "firebase.ts")
    
    if not os.path.exists(config_file):
        print("⚠️  firebase.ts bulunamadı")
        return
    
    try:
        # Extract Android app ID from JSON
        android_app_id = json_data.get('client', [{}])[0].get('client_info', {}).get('mobilesdk_app_id', '')
        
        if android_app_id and 'YOUR' not in android_app_id:
            # Read current config
            with open(config_file, 'r') as f:
                content = f.read()
            
            # Replace Android app ID
            import re
            pattern = r"appId:\s*['\"].*android:.*['\"]"
            replacement = f'appId: \'{android_app_id}\''
            
            if re.search(pattern, content):
                content = re.sub(pattern, replacement, content)
                
                # Write back
                with open(config_file, 'w') as f:
                    f.write(content)
                
                print(f"✅ firebase.ts güncellendi: Android App ID = {android_app_id}")
            else:
                print("⚠️  firebase.ts'de Android app ID pattern bulunamadı")
    except Exception as e:
        print(f"⚠️  firebase.ts güncelleme hatası: {e}")

if __name__ == "__main__":
    try:
        update_firebase_config()
        sys.exit(0)
    except Exception as e:
        print(f"❌ Hata: {e}")
        sys.exit(1)


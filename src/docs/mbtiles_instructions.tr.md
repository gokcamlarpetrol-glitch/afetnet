# MBTiles Hazırlama Kılavuzu - AfetNet

## Genel Bakış

AfetNet uygulaması için offline uydu görüntüleri ve vektör haritaları hazırlamak için MBTiles formatı kullanılır. Bu kılavuz, Sentinel-2, ticari uydu verileri ve OpenStreetMap verilerinden MBTiles oluşturma sürecini açıklar.

## Gerekli Araçlar

### GDAL (Geospatial Data Abstraction Library)
```bash
# Ubuntu/Debian
sudo apt-get install gdal-bin

# macOS
brew install gdal

# Windows
# GDAL installer indirin: https://gdal.org/download.html
```

### MBTiles Araçları
```bash
# mbutil (MBTiles işlemleri için)
pip install mbutil

# Tippecanoe (vektör tiles için)
# macOS
brew install tippecanoe

# Ubuntu/Debian
sudo apt-get install tippecanoe
```

## 1. Sentinel-2 Uydu Görüntülerinden MBTiles

### Adım 1: Sentinel-2 Verisi İndirme
```bash
# Copernicus Open Access Hub'dan GeoTIFF indirin
# https://scihub.copernicus.eu/

# Veya Python ile otomatik indirme:
pip install sentinelsat
```

### Adım 2: GeoTIFF Hazırlama
```bash
# Projeksiyon dönüştürme (Web Mercator - EPSG:3857)
gdalwarp -t_srs EPSG:3857 input_sentinel.tif warped_sentinel.tif

# Bant kombinasyonu (RGB için 4,3,2 bantları)
gdal_translate -b 4 -b 3 -b 2 warped_sentinel.tif rgb_sentinel.tif

# Kontrast ve parlaklık ayarı
gdal_translate -scale 0 4096 0 255 rgb_sentinel.tif enhanced_sentinel.tif
```

### Adım 3: MBTiles Oluşturma
```bash
# GDAL ile direkt MBTiles oluşturma
gdal_translate -of MBTILES enhanced_sentinel.tif satellite.mbtiles

# Veya klasör yapısı ile
gdal2tiles.py -z 12-17 enhanced_sentinel.tif tiles_folder/
mbutil mb-util tiles_folder/ satellite.mbtiles
```

## 2. Ticari Uydu Verilerinden MBTiles

### Maxar, Airbus, DigitalGlobe vb.
```bash
# GeoTIFF'i Web Mercator'a dönüştür
gdalwarp -t_srs EPSG:3857 commercial_input.tif warped_commercial.tif

# Yüksek çözünürlük için zoom seviyelerini sınırla
gdal_translate -of MBTILES -co ZOOM_LEVEL_STRATEGY=LOWER warped_commercial.tif highres_satellite.mbtiles

# Veya klasör yapısı
gdal2tiles.py -z 16-20 warped_commercial.tif highres_tiles/
mbutil mb-util highres_tiles/ highres_satellite.mbtiles
```

## 3. OpenStreetMap Vektör Haritaları

### Adım 1: OSM Verisi İndirme
```bash
# Türkiye extract (Geofabrik)
wget https://download.geofabrik.de/europe/turkey-latest.osm.pbf

# Veya belirli bir bölge
wget https://download.geofabrik.de/europe/turkey/ankara-latest.osm.pbf
```

### Adım 2: Vektör Tiles Oluşturma
```bash
# Tippecanoe ile vektör MBTiles
tippecanoe -z 14 -Z 0 -o turkey_vector.mbtiles turkey-latest.osm.pbf

# Belirli katmanlar ile
tippecanoe -z 14 -Z 0 \
  --layer=roads \
  --layer=buildings \
  --layer=water \
  -o ankara_vector.mbtiles ankara-latest.osm.pbf
```

## 4. Performans Optimizasyonu

### Dosya Boyutu Kontrolü
```bash
# MBTiles boyutunu kontrol et
sqlite3 satellite.mbtiles "SELECT COUNT(*) as tile_count FROM tiles;"
sqlite3 satellite.mbtiles "SELECT SUM(length(tile_data)) as total_size FROM tiles;"
```

### Zoom Seviyesi Stratejisi
- **Genel bakış**: Zoom 10-12
- **Şehir merkezi**: Zoom 13-15  
- **Detaylı görüntü**: Zoom 16-17
- **Yüksek çözünürlük**: Zoom 18-20 (sadece kritik alanlar)

### Önerilen Boyutlar
- **Şehir merkezi (5km yarıçap)**: 50-200 MB
- **İlçe seviyesi (20km yarıçap)**: 200-500 MB
- **İl seviyesi (100km yarıçap)**: 1-5 GB

## 5. Lisans ve Yasal Uyarılar

### ⚠️ ÖNEMLİ UYARILAR

#### Google/Apple Tiles
- **YASAK**: Google Maps veya Apple Maps tile'larını offline kullanmak
- **YASAK**: Bu servislerden tile'ları cache'leyip dağıtmak
- **SONUÇ**: Lisans ihlali, yasal sorunlar

#### OpenStreetMap
- **İZİN**: Açık lisans (ODbL)
- **GEREK**: Uygun atıf yapılmalı
- **ÖRNEK**: "© OpenStreetMap contributors"

#### Sentinel-2/Copernicus
- **İZİN**: Açık veri, ticari kullanım mümkün
- **GEREK**: Copernicus atıfı
- **ÖRNEK**: "© Copernicus Sentinel-2 data"

#### Ticari Uydu Verileri
- **GEREK**: Açık satın alma lisansı
- **GEREK**: Offline dağıtım izni
- **GEREK**: Kullanım kısıtlarına uyum

## 6. AfetNet'e Entegrasyon

### MBTiles Dosyasını Yerleştirme
```bash
# Uygulama assets klasörüne kopyala
cp satellite.mbtiles /path/to/AfetNet/assets/tiles/

# Veya kullanıcı tarafından indirilebilir paket olarak
zip -r ankara_satellite.zip satellite.mbtiles README.txt
```

### Dosya Adlandırma Konvansiyonu
- `satellite_[region].mbtiles` - Uydu görüntüleri
- `vector_[region].mbtiles` - Vektör haritalar
- `prefetch_[timestamp].mbtiles` - Kullanıcı tarafından indirilen

## 7. Kalite Kontrol

### Test Adımları
```bash
# MBTiles bütünlüğünü kontrol et
sqlite3 satellite.mbtiles "PRAGMA integrity_check;"

# Tile sayısını kontrol et
sqlite3 satellite.mbtiles "SELECT zoom_level, COUNT(*) FROM tiles GROUP BY zoom_level;"

# Örnek tile'ı görüntüle
sqlite3 satellite.mbtiles "SELECT tile_data FROM tiles WHERE zoom_level=15 AND tile_column=12345 AND tile_row=67890;" | base64 -d > test_tile.png
```

### Performans Testi
- Farklı cihazlarda yükleme süresi
- Bellek kullanımı kontrolü
- Zoom geçişlerinde akıcılık
- Offline erişim testi

## 8. Sorun Giderme

### Yaygın Sorunlar
```bash
# "Invalid MBTiles" hatası
# Çözüm: Dosyayı yeniden oluştur
gdal_translate -of MBTILES -co TILE_FORMAT=PNG input.tif output.mbtiles

# "Out of memory" hatası  
# Çözüm: Dosyayı böl
gdalwarp -t_srs EPSG:3857 -ts 8192 8192 input.tif chunk.tif

# "Tile not found" hatası
# Çözüm: Zoom seviyelerini kontrol et
sqlite3 satellite.mbtiles "SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles;"
```

### Log Kontrolü
- AfetNet uygulamasında Diagnostics > "Satellite pack available" testi
- TileManager.log dosyası kontrolü
- Cihaz depolama alanı kontrolü

## 9. Örnek Komutlar

### Tam İş Akışı Örneği (Ankara)
```bash
# 1. Sentinel-2 verisi indir (Python ile)
python download_sentinel.py --bounds 32.5,39.7,33.0,40.2 --date 2024-01-01

# 2. GeoTIFF hazırla
gdalwarp -t_srs EPSG:3857 S2A_MSIL2A_20240101T090321_N0509_R050_T36SUC_20240101T114441.SAFE/GRANULE/L2A_T36SUC_A043015_20240101T090319/IMG_DATA/R10m/T36SUC_20240101T090321_B04_10m.jp2 band4.tif
gdalwarp -t_srs EPSG:3857 S2A_MSIL2A_20240101T090321_N0509_R050_T36SUC_20240101T114441.SAFE/GRANULE/L2A_T36SUC_A043015_20240101T090319/IMG_DATA/R10m/T36SUC_20240101T090321_B03_10m.jp2 band3.tif  
gdalwarp -t_srs EPSG:3857 S2A_MSIL2A_20240101T090321_N0509_R050_T36SUC_20240101T114441.SAFE/GRANULE/L2A_T36SUC_A043015_20240101T090319/IMG_DATA/R10m/T36SUC_20240101T090321_B02_10m.jp2 band2.tif

# 3. RGB kombinasyonu
gdal_merge.py -separate -o ankara_rgb.tif band4.tif band3.tif band2.tif

# 4. Kontrast ayarı
gdal_translate -scale 0 4096 0 255 ankara_rgb.tif ankara_enhanced.tif

# 5. MBTiles oluştur
gdal_translate -of MBTILES ankara_enhanced.tif ankara_satellite.mbtiles

# 6. Boyut kontrolü
ls -lh ankara_satellite.mbtiles
sqlite3 ankara_satellite.mbtiles "SELECT COUNT(*) FROM tiles;"
```

## 10. İletişim ve Destek

Teknik sorular için:
- GitHub Issues: [AfetNet Repository]
- Email: [Teknik Destek]
- Dokümantasyon: [AfetNet Docs]

**Son güncelleme**: Ocak 2024

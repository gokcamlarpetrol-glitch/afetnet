import * as Crypto from 'expo-crypto';
import { logger } from '../utils/productionLogger';
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import { deriveGroupKey } from '../identity/groupId';
import { Group } from '../store/groups';

export function deriveSharedKey(
  group: Group,
  mySecKey?: Uint8Array,
  allMemberPubKeysB64?: string[]
): string {
  // If we have a seed (creator), use seed-based derivation
  if (group.seed && allMemberPubKeysB64) {
    return deriveGroupKey(group.seed, allMemberPubKeysB64);
  }

  // If we don't have a seed but have member public keys, derive from public keys only
  if (allMemberPubKeysB64) {
    // Create a synthetic seed from the group's GID for consistency
    const gidBytes = new TextEncoder().encode(group.gid);
    const syntheticSeed = new Uint8Array(16);
    syntheticSeed.set(gidBytes.subarray(0, Math.min(16, gidBytes.length)), 0);
    
    return deriveGroupKey(syntheticSeed, allMemberPubKeysB64);
  }

  // Fallback: if we have a stored shared key, use it
  if (group.sharedKeyB64) {
    return group.sharedKeyB64;
  }

  throw new Error('Cannot derive shared key: insufficient data');
}

export function gSeal(sharedKeyB64: string, plaintext: Uint8Array): { nonceB64: string; boxB64: string } {
  const sharedKey = decodeBase64(sharedKeyB64);
  const nonce = nacl.randomBytes(24);
  
  // Use nacl.secretbox for symmetric encryption
  const box = nacl.secretbox(plaintext, nonce, sharedKey);
  
  if (!box) {
    throw new Error('Failed to encrypt message');
  }

  return {
    nonceB64: encodeBase64(nonce),
    boxB64: encodeBase64(box),
  };
}

export function gOpen(
  sharedKeyB64: string,
  boxB64: string,
  nonceB64: string
): Uint8Array | null {
  try {
    const sharedKey = decodeBase64(sharedKeyB64);
    const box = decodeBase64(boxB64);
    const nonce = decodeBase64(nonceB64);
    
    const plaintext = nacl.secretbox.open(box, nonce, sharedKey);
    return plaintext;
  } catch (error) {
    logger.error('Failed to decrypt group message:', error);
    return null;
  }
}

export async function generateVerificationPhrase(sharedKeyB64: string): Promise<string> {
  // Generate a deterministic 5-word phrase from shared key
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    sharedKeyB64,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  
  const hashBytes = decodeBase64(keyHash);
  
  // Simple wordlist (2048 words) - in production, use a proper BIP39 wordlist
  const wordlist = [
    'abla', 'abuk', 'acayip', 'acele', 'acı', 'adam', 'adım', 'ağaç', 'ağır', 'ağız',
    'ağrı', 'ahşap', 'akıl', 'akşam', 'alçak', 'aldı', 'alem', 'alış', 'altın', 'ana',
    'anı', 'araba', 'aralık', 'arşın', 'artık', 'aşık', 'atlas', 'ayak', 'ayrı', 'aziz',
    'bağ', 'bahçe', 'baki', 'balık', 'barış', 'baş', 'batı', 'bazen', 'bebek', 'beden',
    'bekle', 'belki', 'benim', 'beraber', 'besin', 'beton', 'beş', 'beyaz', 'bırak', 'bile',
    'bilgi', 'bin', 'bir', 'bisiklet', 'bitki', 'bizim', 'boş', 'boyun', 'bozuk', 'bulut',
    'burada', 'buz', 'büyük', 'cami', 'canlı', 'cehennem', 'cevap', 'cuma', 'çabuk', 'çağ',
    'çakıl', 'çalış', 'çanta', 'çay', 'çek', 'çelik', 'çevre', 'çiçek', 'çile', 'çocuk',
    'çok', 'çöp', 'dağ', 'dakika', 'dalga', 'damla', 'danış', 'dar', 'davran', 'değil',
    'delik', 'deniz', 'derin', 'ders', 'devam', 'dışarı', 'dil', 'dinle', 'diş', 'doğa',
    'doğru', 'doktor', 'dolap', 'don', 'dost', 'dövüş', 'durak', 'durum', 'duvar', 'dünya',
    'düş', 'düzen', 'eczane', 'efendi', 'el', 'elektrik', 'emek', 'enerji', 'en iyi', 'erken',
    'eski', 'et', 'ev', 'evet', 'eylem', 'ezgi', 'fabrika', 'fakir', 'fark', 'fayda',
    'felaket', 'fen', 'fırın', 'fidan', 'film', 'fiyat', 'fotoğraf', 'futbol', 'gayet', 'gaz',
    'gece', 'geç', 'gel', 'genç', 'gerçek', 'gerek', 'geri', 'getir', 'gibi', 'gidiş',
    'gizli', 'göl', 'gönder', 'gör', 'göz', 'grup', 'güç', 'güneş', 'güzel', 'haber',
    'hadi', 'hak', 'hal', 'ham', 'hanım', 'hangi', 'harika', 'hasret', 'hatır', 'havada',
    'hayal', 'hayat', 'hazır', 'hemen', 'henüz', 'her', 'hesap', 'heyecan', 'hızlı', 'hiç',
    'hizmet', 'hoş', 'hukuk', 'huzur', 'ırmak', 'ıslak', 'ışık', 'iç', 'içki', 'içme',
    'içinde', 'ideal', 'ihtiyaç', 'ihtimal', 'ihtiyar', 'ikinci', 'ilaç', 'ileri', 'imkan', 'inan',
    'ince', 'iş', 'işte', 'it', 'iyi', 'izle', 'kaba', 'kadın', 'kağıt', 'kaldır',
    'kalp', 'kamera', 'kan', 'kapı', 'kar', 'karar', 'kardeş', 'kasa', 'kat', 'kaynak',
    'kaza', 'keder', 'kelime', 'kemik', 'kendi', 'kent', 'kes', 'kırmızı', 'kış', 'kişi',
    'kitap', 'kız', 'koca', 'kolay', 'komşu', 'konu', 'korku', 'koş', 'kötü', 'kuş',
    'küçük', 'kültür', 'küre', 'lamba', 'lazım', 'leke', 'lezzet', 'liman', 'liste', 'lütfen',
    'mağaza', 'makine', 'mal', 'mama', 'mavi', 'medya', 'mekan', 'memnun', 'merak', 'mesaj',
    'metin', 'meyve', 'mıknatıs', 'miktar', 'milyon', 'minare', 'misafir', 'moda', 'mola', 'moral',
    'motor', 'muhteşem', 'müzik', 'nabız', 'nasıl', 'nazar', 'ne', 'neden', 'nefes', 'neşe',
    'nesil', 'neticede', 'niçin', 'nişan', 'nokta', 'normal', 'not', 'numara', 'nüfus', 'obje',
    'oda', 'okul', 'okuyan', 'olay', 'oldukça', 'olgun', 'olmak', 'onay', 'önemli', 'önce',
    'öğren', 'öğretmen', 'ölçü', 'ölüm', 'ön', 'özel', 'özür', 'öğüt', 'pahalı', 'paket',
    'para', 'park', 'parti', 'patlama', 'pazar', 'peki', 'perde', 'pilot', 'pirinç', 'plan',
    'plastik', 'polisiye', 'portre', 'pozisyon', 'problem', 'program', 'proje', 'puan', 'pul', 'pusula',
    'rahat', 'rakam', 'randevu', 'rapor', 'rastgele', 'raymond', 'reçete', 'rehber', 'renk', 'resim',
    'rica', 'ritim', 'robot', 'rol', 'roman', 'ruh', 'rüzgar', 'saat', 'sabah', 'sabır',
    'sağ', 'sağlık', 'sahne', 'sakla', 'salon', 'samimi', 'sanat', 'sanki', 'sarı', 'savaş',
    'sayı', 'sebep', 'seç', 'sedir', 'sefer', 'seğir', 'sekiz', 'selam', 'sen', 'serin',
    'ses', 'seyahat', 'sevgili', 'sevinç', 'sıcak', 'sınav', 'sık', 'sıra', 'sır', 'sırt',
    'sistem', 'siyah', 'sokak', 'sol', 'son', 'sor', 'soru', 'sosyal', 'soy', 'spor',
    'su', 'süre', 'sürü', 'şah', 'şaka', 'şan', 'şarkı', 'şehir', 'şekil', 'şemsiye',
    'şerit', 'şey', 'şiir', 'şikayet', 'şimdi', 'şirket', 'şişe', 'şoför', 'şok', 'şu',
    'tabak', 'tablo', 'tahmin', 'takım', 'tam', 'tane', 'taraf', 'tarih', 'taş', 'tat',
    'tavuk', 'taze', 'tebeşir', 'tecrübe', 'tehlike', 'tek', 'telefon', 'tema', 'temiz', 'ten',
    'tercih', 'teslim', 'teşekkür', 'teşvik', 'tetik', 'teyze', 'tez', 'tıp', 'tırnak', 'ticaret',
    'tip', 'titreşim', 'titreşim', 'toz', 'trafik', 'tren', 'tut', 'tuş', 'tutkal', 'tuz',
    'tüy', 'tüzel', 'ucuz', 'ufak', 'uğur', 'uçak', 'uçmak', 'uçurtma', 'uçurtma', 'ufak',
    'umut', 'un', 'unlu', 'unut', 'uşak', 'uydu', 'uygun', 'uyku', 'uyum', 'uzak',
    'uzun', 'üç', 'ümit', 'ün', 'ünlü', 'üre', 'üst', 'ütü', 'üye', 'üzüm',
    'vaat', 'vadi', 'vakit', 'vapur', 'var', 'varlık', 'vatan', 'vazife', 've', 'vejetaryen',
    'veli', 'ver', 'vergi', 'veri', 'vesile', 'veto', 'vezir', 'vida', 'video', 'viraj',
    'viran', 'virüs', 'viski', 'vitrin', 'vize', 'vokal', 'volkan', 'voleybol', 'volt', 'vurgu',
    'vurmak', 'vücut', 'ya', 'yabancı', 'yağ', 'yağmur', 'yakın', 'yalnız', 'yap', 'yara',
    'yarı', 'yasak', 'yaş', 'yaşam', 'yatak', 'yavaş', 'yaz', 'yazı', 'yemek', 'yeni',
    'yer', 'yeşil', 'yıldız', 'yıl', 'yine', 'yol', 'yorum', 'yuva', 'yüz', 'zaman',
    'zarar', 'zaten', 'zayıf', 'zebra', 'zeka', 'zemin', 'zengin', 'zeytin', 'zil', 'zincir',
    'zirve', 'zombi', 'zor', 'zorunlu', 'zulüm', 'zurna', 'züppe', 'zürafa', 'zürih', 'zümre'
  ];

  // Use hash bytes to select 5 words
  const words: string[] = [];
  for (let i = 0; i < 5; i++) {
    const index = (hashBytes[i * 2] << 8) | hashBytes[i * 2 + 1];
    words.push(wordlist[index % wordlist.length]);
  }

  return words.join(' ');
}
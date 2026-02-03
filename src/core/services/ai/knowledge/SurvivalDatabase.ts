/**
 * SURVIVAL DATABASE - ELITE EDITION
 * Massive collection of survival techniques.
 */

import { KnowledgeArticle } from '../KnowledgeBase';

export const SurvivalDatabase: KnowledgeArticle[] = [
  // WATER
  {
    id: 'srv-w-001',
    title: 'Doğada Su Bulma Teknikleri',
    content: `**1. Bitkiler:** Yeşil bitkilerin olduğu yerde su yüzeye yakındır. Sabahları yapraklardaki çiy damlalarını toplayın.\n**2. Dere Yatakları:** Kurumuş dere yataklarının kıvrım yerlerini kazın, su sızabilir.\n**3. Terleme Yöntemi:** Yeşil yapraklı bir dalın üzerine naylon poşet geçirin ve bağlayın. Güneşle buharlaşan su poşette birikir.\n**4. Hayvan İzleri:** Hayvan patikaları genellikle suya çıkar.`,
    tags: ['su', 'doğa', 'kaynak', 'susuzluk'],
    category: 'survival',
  },
  {
    id: 'srv-w-002',
    title: 'Deniz Suyu İçilir mi?',
    content: `**HAYIR!** Asla deniz suyu içmeyin. Böbrekleri iflas ettirir ve susuzluğu artırır. Eğer deniz kenarındaysanız, deniz suyunu kaynatıp buharını yoğuşturarak (distilasyon) tatlı su elde edebilirsiniz.`,
    tags: ['deniz', 'tuzlu', 'su', 'içme'],
    category: 'survival',
  },

  // FIRE
  {
    id: 'srv-f-001',
    title: 'Ateş Yakma (Çakmaksız)',
    content: `**1. Pil ve Tel:** Bir AA pilin iki ucuna ince bir tel veya alüminyum folyo değdirin. Isınan tel kavı (kuru ot) tutuşturur.\n**2. Gözlük/Mercek:** Güneş ışığını kav üzerine odaklayın.\n**3. Sürtünme:** Yay matkabı yöntemi (uzmanlık gerektirir).`,
    tags: ['ateş', 'kibrit', 'çakmak', 'ısınma', 'kamp'],
    category: 'survival',
  },

  // SHELTER
  {
    id: 'srv-s-001',
    title: 'Karda Barınak (Iglo/Mağara)',
    content: `**1. Kar Mağarası:** Kar yığını içine tünel kazın. Girişi rüzgara ters yönde açın.\n**2. Havalandırma:** Tavanda mutlaka bir havalandırma deliği açın (Boğulmayı önlemek için).\n**3. Yalıtım:** Zemine çam dalları serin.`,
    tags: ['kar', 'kış', 'barınak', 'soğuk'],
    category: 'survival',
  },

  // NAVIGATION
  {
    id: 'srv-n-001',
    title: 'Yön Bulma (Pusulasız)',
    content: `**1. Güneş:** Güneş doğudan doğar, batıdan batar. Öğle vakti (kuzey yarımkürede) güneş güneydedir.\n**2. Karınca Yuvaları:** Toprağı yuvanın kuzeyine yığarlar (Güneyi açık bırakırlar).\n**3. Yosunlar:** Ağaçların ve taşların kuzey tarafı yosun tutar.\n**4. Kutup Yıldızı:** Daima Kuzey'i gösterir (Bükayı takım yıldızının ucunda).`,
    tags: ['yön', 'pusula', 'kuzey', 'kaybolma'],
    category: 'survival',
  },

  // FOOD
  {
    id: 'srv-fd-001',
    title: 'Yenilebilir Bitki Testi (Evrensel)',
    content: `Bilmediğiniz bitkiyi test etme adımları:\n1. Kokla (Badem/Şeftali kokusu varsa yeme).\n2. Cildine sür, 15dk bekle (Kaşıntı var mı?).\n3. Dudağına değdir, bekle (Yanma var mı?).\n4. Küçük bir parça çiğne, yutma.\n5. En son yut ve 8 saat bekle.`,
    tags: ['yemek', 'bitki', 'zehir', 'açlık'],
    category: 'survival',
  },
];

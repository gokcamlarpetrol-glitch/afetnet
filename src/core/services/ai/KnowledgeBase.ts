/**
 * KNOWLEDGE BASE - ELITE EDITION
 * Comprehensive emergency data for on-device AI.
 */

export interface KnowledgeArticle {
    id: string;
    title: string;
    content: string;
    tags: string[];
    category: 'first_aid' | 'earthquake' | 'fire' | 'general' | 'survival' | 'communication';
}

// Initial Knowledge Base
export const initialKnowledgeBase: KnowledgeArticle[] = [
  {
    id: 'eq-001',
    title: 'Deprem Anında Ne Yapmalı? (Çök-Kapan-Tutun)',
    content: `1. Sakin olun, paniğe kapılmayın.
2. Sağlam bir eşyanın (masa, sıra) altına veya yanına 'ÇÖK'ün.
3. Başınızı ve boynunuzu koruyacak şekilde 'KAPAN'ın.
4. Sarsıntı geçene kadar eşyadan 'TUTUN'un.
5. Asansör ve merdivenleri KULLANMAYIN.
6. Camlardan ve devrilebilecek eşyalardan uzak durun.`,
    tags: ['deprem', 'sarsıntı', 'çök', 'kapan', 'tutun', 'güvenlik'],
    category: 'earthquake',
  },
  {
    id: 'med-001',
    title: 'Kanamayı Durdurma (Turnike)',
    content: `1. Kanamalı bölgeye temiz bir bezle doğrudan baskı uygulayın.
2. Kanama durmuyorsa ve uzuvda ise, yara ile kalp arasına turnike uygulayın.
3. Turnike olarak kemer veya en az 5cm genişliğinde bez kullanın.
4. Turnikeyi sıkın ve kanama durana kadar gevşetmeyin.
5. Turnike saatinizi not edin (Alna 'T' harfi ve saat yazılır).`,
    tags: ['kanama', 'yaralanma', 'ilk yardım', 'turnike', 'kan'],
    category: 'first_aid',
  },
  {
    id: 'med-002',
    title: 'Kalp Masajı (CPR)',
    content: `1. Hasta tepkisiz ve nefes almıyorsa 112'yi arayın.
2. Sert bir zemine yatırın.
3. Göğüs kemiğinin alt yarısına el topuğunu yerleştirin.
4. Dakikada 100-120 bası olacak hızda ve göğüs 5cm çökecek derinlikte bastırın.
5. 30 bası / 2 soluk döngüsünü uygulayın.`,
    tags: ['kalp', 'masaj', 'nefes', 'cpr', 'nabız', 'bayılma'],
    category: 'first_aid',
  },
  {
    id: 'fire-001',
    title: 'Yangın Güvenliği',
    content: `1. Duman varsa yere yakın emekleyerek ilerleyin.
2. Kapalı kapılara dokunmadan önce elinizin tersiyle sıcaklığını kontrol edin.
3. Asla asansör kullanmayın.
4. Kıyafetiniz tutuşursa: DUR, YAT, YUVARLAN.`,
    tags: ['yangın', 'ateş', 'duman', 'yanık', 'tahliye'],
    category: 'fire',
  },
  {
    id: 'eq-002',
    title: 'Enkaz Altında İletişim',
    content: `1. Enerjinizi koruyun, sürekli bağırmayın.
2. Varsa düdük çalın veya metal bir cisme vurun.
3. Ağzınızı tozdan korumak için kıyafetinizle kapatın.
4. Dışarıdan ses duyduğunuzda tepki verin.`,
    tags: ['enkaz', 'göçük', 'ses', 'düdük', 'yardım', 'kurtarma'],
    category: 'earthquake',
  },
];

// Elite Knowledge Base - Comprehensive Guides
export const eliteKnowledgeBase: KnowledgeArticle[] = [
  // --- SURVIVAL ---
  {
    id: 'surv-001',
    title: 'Su Arıtma ve Temini',
    content: `**1. Kaynatma:** Suyu en az 1-3 dakika fokurdayarak kaynatın. En güvenli yöntemdir.\n**2. Kimyasal Dezenfeksiyon:** 1 litre suya 2 damla kokusuz çamaşır suyu ekleyin, 30dk bekleyin. Hafif klor kokusu normaldir.\n**3. Güneşle Arıtma (SODIS):** Pet şişeyi 6 saat güneş altında bekletin (UV ışınları mikropları öldürür).\n**4. Yağmur Suyu:** Temiz bir kapla toplayın, mümkünse filtreleyin.`,
    tags: ['su', 'içme', 'arıtma', 'kaynatma', 'susuzluk', 'survival'],
    category: 'survival',
  },
  {
    id: 'surv-002',
    title: 'Vücut Isısını Koruma (Hipotermi)',
    content: `**1. Kuru Kalın:** Islak kıyafetleri hemen çıkarın.\n**2. Katmanlı Giyinin:** Tek kalın kıyafet yerine, birçok ince katman giyin (Hava yalıtımı sağlar).\n**3. Başınızı Örtün:** Isı kaybının %30'u baştan olur.\n**4. Hareket Edin:** Titremek vücudun ısınma refleksidir, durmayın.`,
    tags: ['soğuk', 'donma', 'hipotermi', 'ısınma', 'kıyafet'],
    category: 'survival',
  },
  {
    id: 'surv-003',
    title: 'Barınak Yapımı',
    content: `**1. Yer Seçimi:** Rüzgar almayan, su basma riski olmayan düz bir alan seçin.\n**2. Yalıtım:** Zemine yaprak/karton serin (Soğuk topraktan çeker).\n**3. Çatı:** Branda veya yağmurluk kullanarak rüzgarla 45 derece açılı bir eğim oluşturun.`,
    tags: ['barınak', 'kamp', 'çadır', 'uyku', 'güvenlik'],
    category: 'survival',
  },

  // --- COMMUNICATION ---
  {
    id: 'comm-001',
    title: 'Şebeke Yokken İletişim',
    content: `**1. AfetNet Mesh:** Bu uygulamayı kullanan diğer kişilerle otomatik ağ kurarsınız. Bluetooth'u açık tutun.\n**2. SMS:** Arama yerine SMS deneyin, daha az bant genişliği kullanır ve sıraya girer.\n**3. Sesli Mesaj Kutusu:** Ulaşamadığınız kişiye sesli mesaj bırakın, şebeke gelince iletilir.\n**4. Radyo:** Yerel frekansları dinleyerek resmi anonsları takip edin.`,
    tags: ['internet', 'şebeke', 'telefon', 'iletişim', 'sms', 'mesh'],
    category: 'communication',
  },
  {
    id: 'comm-002',
    title: 'Telefon Pil Ömrünü Uzatma',
    content: `**1. Ekran:** Parlaklığı en düşüğe getirin.\n**2. Bağlantılar:** Wi-Fi ve Mobil Veriyi kapatın. Sadece Bluetooth (Mesh için) açık kalsın.\n**3. Arka Plan:** Tüm gereksiz uygulamaları kapatın.\n**4. Titreşim:** Kapatın, pil tüketir.\n**5. Sıcaklık:** Telefonu vücudunuza yakın tutarak soğuktan koruyun (Soğuk pil ömrünü azaltır).`,
    tags: ['pil', 'batarya', 'şarj', 'tasarruf', 'telefon'],
    category: 'communication',
  },

  // --- EARTHQUAKE SPECIFIC ---
  {
    id: 'eq-003',
    title: 'Artçı Depremler',
    content: `**Bilgi:** Ana depremden sonra günler/haftalarca sürebilir.\n**Ne Yapmalı?**\n1. Her sarsıntıda tekrar Çök-Kapan-Tutun yapın.\n2. Hasarlı binalara ASLA girmeyin.\n3. Sahile yakınsanız tsunami uyarısı için yüksek yere çıkın.\n4. Gaz kokusu alırsanız kibrit/çakmak yakmayın.`,
    tags: ['artçı', 'sarsıntı', 'devam', 'deprem'],
    category: 'earthquake',
  },

  // --- FIRST AID ---
  {
    id: 'med-003',
    title: 'Kırık ve Çıkıklar',
    content: `**1. Sabitleme:** Yaralı bölgeyi hareket ettirmeyin. Sert bir cisimle (tahta, karton) sabitleyin (Atel).\n**2. Pozisyon:** Kalp seviyesinden yukarıda tutarak şişmeyi azaltın.\n**3. Soğuk:** Varsa buz uygulayın (doğrudan tene değil, beze sararak).\n**4. Yerine Oturtmaya ÇALIŞMAYIN.**`,
    tags: ['kırık', 'çıkık', 'burkulma', 'atel', 'ilk yardım', 'kemik'],
    category: 'first_aid',
  },
  {
    id: 'med-004',
    title: 'Şok Belirtileri ve Müdahale',
    content: `**Belirtiler:** Soluk cilt, hızlı nabız, susuzluk, bilinç bulanıklığı.\n**Müdahale:**\n1. Sırt üstü yatırın.\n2. Ayaklarını 30cm yukarı kaldırın.\n3. Üstünü örtün.\n4. Su vermeyin (Kusabilir).`,
    tags: ['şok', 'bayılma', 'nabız', 'ilk yardım'],
    category: 'first_aid',
  },

  // --- PSYCHOLOGY ---
  {
    id: 'psy-001',
    title: 'Panik Atak Yönetimi',
    content: `**1. Nefes:** 4 saniye al, 4 saniye tut, 4 saniye ver.\n**2. Odaklanma:** Etrafınızdaki 5 nesneyi sayın, 4 sesi dinleyin.\n**3. Telkin:** "Bu geçici bir durum, güvendeyim" deyin.\n**4. Temas:** Yere sağlam basın veya bir yere oturun.`,
    tags: ['korku', 'panik', 'stres', 'psikoloji', 'sakinleşme'],
    category: 'general',
  },

  // --- GLOBAL DISASTERS (ELITE) ---
  {
    id: 'nuc-001',
    title: 'Nükleer/Radyasyon Tehlikesi',
    content: `**1. Kapalı Alan:** Derhal en yakın beton binaya girin. Bodrum katı en güvenlisidir.\n**2. İzolasyon:** Pencereleri/kapıları sıkıca kapatın ve bantlayın. Havalandırmayı (klima) kapatın.\n**3. Temizlik:** Dışarıdan geldiyseniz kıyafetleri poşetleyip atın, bol su ve sabunla yıkanın.\n**4. Bekleme:** Yetkililer "çıkın" diyene kadar (en az 24-72 saat) dışarı çıkmayın. Radyasyon zamanla azalır.`,
    tags: ['nükleer', 'radyasyon', 'sığınak', 'izolasyon', 'bomba'],
    category: 'general',
  },
  {
    id: 'bio-001',
    title: 'Biyolojik/Kimyasal Tehdit',
    content: `**1. Maske:** Varsa N95 maske, yoksa birkaç kat bezle ağzınızı/burnunuzu kapatın.\n**2. Yüksek Yer:** Kimyasal gazların çoğu havadan ağırdır, üst katlara çıkın (Nükleerin tersine).\n**3. Rüzgar:** Rüzgarı arkanıza değil, yanınıza alarak olay yerinden dik açıyla uzaklaşın.\n**4. Dekontaminasyon:** Kıyafetleri çıkarın, gözlerinizi/cildinizi bol suyla 15dk yıkayın.`,
    tags: ['kimyasal', 'biyolojik', 'gaz', 'zehir', 'maske'],
    category: 'general',
  },
  {
    id: 'tsu-001',
    title: 'Tsunami Uyarısı',
    content: `**1. Doğal Uyarı:** Deniz aniden çekilirse veya "jet uçağı" sesi duyarsanız BEKLEMEYİN.\n**2. Tahliye:** Kıyıdan olabildiğince uzağa ve YÜKSEĞE (en az 30m) çıkın.\n**3. Nehirler:** Tsunami nehir yataklarından içeriye km'lerce girebilir, nehir kenarlarından uzak durun.\n**4. Süre:** İlk dalga en büyüğü olmayabilir, tehlike saatlerce sürebilir.`,
    tags: ['tsunami', 'dalga', 'deniz', 'sel', 'sahil'],
    category: 'general',
  },
  {
    id: 'vol-001',
    title: 'Volkanik Kül Yağışı',
    content: `**1. Solunum:** Kül cam tozuna benzer, ciğerleri parçalar. Mutlaka maske/ıslak bez takın.\n**2. Göz:** Kontakt lensleri çıkarın, varsa koruyucu gözlük takın.\n**3. Motor:** Araba motorunu çalıştırmayın, hava filtresini tıkar.\n**4. Barınak:** Çatılarda biriken kül (ıslanırsa betona dönüşür) çökme yapabilir, dikkatli olun.`,
    tags: ['volkan', 'kül', 'yanardağ', 'solunum'],
    category: 'general',
  },
  {
    id: 'ext-001',
    title: 'Aşırı Sıcak (Heatwave)',
    content: `**1. Hidrasyon:** Susamayı beklemeden su için.\n**2. Soğutma:** Bileklere, boyna ve kasıklara soğuk kompres yapın.\n**3. Güneş Çarpması:** Bilinç kaybı, ateş (40°C), kuru cilt varsa ACİL tıbbi yardım gerekir.\n**4. Saatler:** 11:00-15:00 arası gölgeden çıkmayın.`,
    tags: ['sıcak', 'güneş', 'çarpma', 'su', 'yaz'],
    category: 'survival',
  },
  {
    id: 'ext-002',
    title: 'Kar Fırtınası/Tipi',
    content: `**1. Araçta:** Motoru saatte 10dk çalıştırın (karbonmonoksit için egzozu açık tutun).\n**2. Görünürlük:** Antene renkli bez bağlayın.\n**3. Yürüyüş:** Görüş mesafesi sıfıra indiyse YÜRÜMEYİN, kaybolursunuz. Kuytu bir yere sığının.\n**4. Hipotermi:** Uyku bastırırsa uyumayın, birbirinizi uyanık tutun.`,
    tags: ['kar', 'fırtına', 'kış', 'donma', 'tipi'],
    category: 'survival',
  },
  // --- SPECIALIZED SURVIVAL SCENARIOS (ELITE EXPANSION) ---
  {
    id: 'scen-001',
    title: 'Enkaz Altında Psikoloji ve Hayatta Kalma',
    content: `**1. Enerji Tasarrufu:** Asla sürekli bağırmayın. Enerjinizi tüketir ve oksijeni harcar.\n**2. Ses Verme:** Metal bir cisme (kalorifer borusu vb.) ritmik olarak vurun (3 vuruş, bekle, 3 vuruş).\n**3. Pozisyon:** Cenin pozisyonunda kalın, hayati organlarınızı koruyun.\n**4. Umut:** Kurtarma ekipleri gelene kadar (günler sürse bile) umudunuzu kaybetmeyin. İnsan vücudu susuzluğa 3 gün dayanabilir.`,
    tags: ['enkaz', 'göçük', 'psikoloji', 'ses', 'ritim'],
    category: 'earthquake',
  },
  {
    id: 'scen-002',
    title: 'Gaz Kokusu Alınca (Acil Protokol)',
    content: `**1. DOKUNMA:** Lamba düğmesine, telefona veya elektrikli hiçbir şeye dokunmayın. Kıvılcım çıkarabilir.\n**2. HAVALANDIR:** Pencereleri ve kapıları ardına kadar açın.\n**3. KAÇ:** Binayı hemen terk edin.\n**4. ARA:** Güvenli bir mesafeye (sokağın başına) gidince 187 Doğalgaz Acil'i arayın.`,
    tags: ['gaz', 'koku', 'sızıntı', 'patlama', 'doğalgaz'],
    category: 'fire',
  },
  {
    id: 'scen-003',
    title: 'Bebeklerde Tıkanma (Heimlich)',
    content: `**1. Pozisyon:** Bebeği yüzü koyun kolunuzun üzerine yatırın, çenesinden destekleyin.\n**2. Vuruş:** İki kürek kemiğinin ortasına el topuğunuzla 5 kez süpürür tarzda vurun.\n**3. Kontrol:** Cisim çıktı mı bakın. Çıkmadıysa sırt üstü çevirip göğüs kafesine 5 kez iki parmakla bastırın.\n**4. Tekrar:** Cisim çıkana veya bebek ağlayana kadar devam edin.`,
    tags: ['bebek', 'tıkanma', 'boğulma', 'heimlich', 'nefes', 'çocuk'],
    category: 'first_aid',
  },
  {
    id: 'scen-004',
    title: 'Bebeklerde Kalp Masajı (CPR)',
    content: `**1. Kontrol:** Ayak tabanına vurarak tepki veriyor mu bakın.\n**2. Masaj Yeri:** İki meme ucunu birleştiren hayali çizginin hemen altı.\n**3. Tekniği:** Sadece iki parmağınızı (işaret ve orta) kullanın.\n**4. Hız:** Dakikada 100-120 bası. Göğüs kafesi 4cm çökmeli.\n**5. Oran:** 30 bası, 2 kurtarıcı nefes (Ağız ve burnu aynı anda kaplayacak şekilde üfleyin).`,
    tags: ['bebek', 'cpr', 'kalp', 'masaj', 'ilk yardım'],
    category: 'first_aid',
  },
  {
    id: 'scen-005',
    title: 'Ciddi Kesik ve Uzuv Kopması',
    content: `**1. Kopan Parça:** Temiz bir poşete koyun. O poşeti de BUZ DOLU başka bir poşete koyun (Doğrudan buza temas etmesin, doku donar).\n**2. Turnike:** Kopan yerin 5-10cm üzerine turnike uygulayın. Asla gevşetmeyin.\n**3. Zaman:** Turnikeyi uyguladığınız saati alnına yazın.\n**4. Şok:** Yaralıyı sırt üstü yatırıp ayaklarını kaldırın.`,
    tags: ['kesik', 'kopma', 'uzuv', 'turnike', 'kanama'],
    category: 'first_aid',
  },
  {
    id: 'scen-006',
    title: 'Yanık Tedavisi (İlk Müdahale)',
    content: `**1. Soğut:** Yanık bölgeyi en az 10-20 dakika AKAN SOĞUK SU (buzlu değil) altında tutun.\n**2. Çıkarma:** Yapışmamış kıyafetleri ve takıları (şişme riskine karşı) hemen takın.\n**3. Kaplama:** Temiz, tüysüz bir bezle veya streç filmle gevşekçe sarın.\n**4. ASLA:** Diş macunu, yoğurt, salça sürmeyin. Enfeksiyon riskini artırır.`,
    tags: ['yanık', 'ateş', 'haşlanma', 'sıcak', 'su'],
    category: 'first_aid',
  },
  {
    id: 'scen-007',
    title: 'Asansörde Mahsur Kalma (Deprem)',
    content: `**1. Panik Yok:** Asansörlerin havalandırması vardır, havasız kalmazsınız.\n**2. Kat Düğmeleri:** Tüm kat düğmelerine basın.\n**3. Kapı:** Kapıyı zorlayarak açmaya çalışmayın, boşluğa düşebilirsiniz.\n**4. İletişim:** Alarm butonuna basın veya metal bir cisimle kapıya vurarak ses verin.`,
    tags: ['asansör', 'mahsur', 'kapalı', 'alan', 'kurtarma'],
    category: 'earthquake',
  },
  {
    id: 'scen-008',
    title: 'Evcil Hayvanlar (Afet Anı)',
    content: `**1. Saklanma:** Korktuklarında saklanırlar (Yatak altı vb.). Zorla çıkarmaya çalışırken ısırabilirler, dikkatli olun.\n**2. Taşıma:** Önceden hazırlanmış taşıma kutusuna (box) koyun.\n**3. Kayıp:** Tasmalarına mutlaka telefon numaranızı yazın.\n**4. Mama:** Tahliye çantanızda onlar için de 3 günlük kuru mama bulundurun.`,
    tags: ['kedi', 'köpek', 'hayvan', 'evcil', 'mama'],
    category: 'general',
  },
  {
    id: 'scen-009',
    title: 'Sel Sularında Araç Kullanımı',
    content: `**1. GİRME:** Suyun derinliğini bilmiyorsanız asla girmeyin. 30cm su aracı yüzdürebilir.\n**2. Stop Ederse:** Aracı hemen terk edip yüksek bir yere çıkın.\n**3. Kapı Açılmazsa:** Camı kırarak çıkın (Koltuk başlığı demirini kullanın).\n**4. Akıntı:** Akıntıya karşı yürümeyin, sürüklenebilirsiniz.`,
    tags: ['sel', 'su', 'araç', 'araba', 'boğulma'],
    category: 'general',
  },
  {
    id: 'scen-010',
    title: 'Elektrik Çarpması',
    content: `**1. DOKUNMA:** Yaralıya elektriği kesmeden dokunmayın.\n**2. Şalter:** Ana şalteri indirin.\n**3. İletken Olmayan Cisim:** Elektrik kaynağını tahta sopa veya plastik bir süpürge sapı ile yaralıdan uzaklaştırın.\n**4. CPR:** Elektrik kesildikten sonra nefes almıyorsa kalp masajına başlayın.`,
    tags: ['elektrik', 'çarpma', 'akım', 'kablo', 'priz'],
    category: 'first_aid',
  },
  {
    id: 'scen-011',
    title: 'Burun Kanaması',
    content: `**1. Baş Pozisyonu:** Başı ASLA geriye atmayın (Kan genize kaçar). Hafifçe öne eğin.\n**2. Baskı:** Burun kanatlarına (yumuşak kısım) 5-10 dakika kesintisiz baskı yapın.\n**3. Buz:** Burun köküne buz tatbik edin.\n**4. Temizleme:** Kanama durunca sümkürmeyin.`,
    tags: ['burun', 'kanama', 'kan', 'baş', 'eğme'],
    category: 'first_aid',
  },
  {
    id: 'scen-012',
    title: 'Sara (Epilepsi) Nöbeti',
    content: `**1. Tutma:** Hastayı sabitlemeye veya hareketlerini engellemeye çalışmayın.\n**2. Güvenlik:** Başını çarpabileceği sert cisimleri uzaklaştırın, başının altına yastık/ceket koyun.\n**3. Ağız:** Ağzına kaşık, parmak vb. sokmaya ÇALIŞMAYIN.\n**4. Süre:** Nöbet bitince yan çevirin (Recovery position) ve dinlenmesine izin verin.`,
    tags: ['sara', 'epilepsi', 'nöbet', 'kriz', 'bayılma'],
    category: 'first_aid',
  },
  {
    id: 'scen-013',
    title: 'Su Kesintisinde Hijyen',
    content: `**1. Eller:** Bebek mendili veya kolonya ile sık sık temizleyin.\n**2. Tuvalet:** Sifonu çekmeyin. Poşet geçirerek kullanın ve poşeti ağzını bağlayarak atın.\n**3. Bulaşık:** Kağıt tabak/bardak kullanın.\n**4. İçme Suyu:** Stoktaki suyu sadece içmek için kullanın, yıkama için değil.`,
    tags: ['su', 'kesinti', 'hijyen', 'tuvalet', 'temizlik'],
    category: 'survival',
  },
  {
    id: 'scen-014',
    title: 'Psikolojik İlk Yardım (Çocuklar)',
    content: `**1. Dürüstlük:** "Bir şey yok" demeyin. "Korkunçtu ama geçti, şimdi güvendeyiz" deyin.\n**2. Temas:** Sarılmak en iyi ilaçtır.\n**3. Rutin:** Mümkünse uyku/yemek saatlerini koruyun.\n**4. Oyun:** Oyun oynamalarına izin verin, travmayı oyunla atarlar.`,
    tags: ['çocuk', 'psikoloji', 'korku', 'travma', 'oyun'],
    category: 'general',
  },
  {
    id: 'scen-015',
    title: 'Hipotermi (Donma) Belirtileri',
    content: `**1. Titreme:** Vücut ısısı düşünce başlar.\n**2. Durma:** Titreme aniden durursa DURUM KRİTİKTİR.\n**3. Uyuşukluk:** Konuşma bozulur, uyku hali başlar.\n**4. Müdahale:** Kuru kıyafet giydirin, vücut ısısıyla (sarılın) ısıtın. ASLA sıcak suyla veya ovalayarak ısıtmayın.`,
    tags: ['donma', 'soğuk', 'hipotermi', 'titreme', 'kış'],
    category: 'first_aid',
  },
];

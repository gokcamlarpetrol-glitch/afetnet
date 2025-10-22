export type Suggestion = {
  id: string;
  title: string;
  why: string;
  how: string;
  impact: 'low' | 'med' | 'high';
};

export function computeSuggestions(ctx: {
  tests: Record<string, boolean>;
  batteryRisk: boolean;
  ios: boolean;
  android: boolean;
}): Suggestion[] {
  const out: Suggestion[] = [];

  if (!ctx.tests['tiles']) {
    out.push({
      id: 'tiles-preload',
      title: 'Harita Karo Ön Yükleme',
      why: 'Uçak modunda görünürlük zayıf',
      how: 'Daha geniş yarıçap ve zoom setini güvenli aralıklarla indir',
      impact: 'high',
    });
  }

  if (!ctx.tests['bgfetch']) {
    out.push({
      id: 'bg-fetch',
      title: 'Arka Plan Deprem Çekimi',
      why: 'Kritik uyarılar kaçabilir',
      how: 'BackgroundFetch interval 5–15dk, izin kontrolleri',
      impact: 'high',
    });
  }

  if (!ctx.tests['notif']) {
    out.push({
      id: 'notif-perm',
      title: 'Bildirim İzin Akışı',
      why: 'Uyarıların kullanıcıya ulaşması',
      how: 'İlk açılışta açıklamalı izin sihirbazı',
      impact: 'high',
    });
  }

  if (!ctx.tests['location']) {
    out.push({
      id: 'location-perm',
      title: 'Konum İzin Akışı',
      why: 'PDR ve harita özellikleri çalışmaz',
      how: 'Kullanıcı dostu izin açıklaması ve ret durumunda yönlendirme',
      impact: 'high',
    });
  }

  if (ctx.batteryRisk) {
    out.push({
      id: 'battery-opt',
      title: 'Batarya Optimizasyonu',
      why: 'Arka plan işlemler bataryayı tüketiyor',
      how: 'Adaptif tarama sıklığı ve güç yönetimi',
      impact: 'med',
    });
  }

  if (!ctx.tests['sensors']) {
    out.push({
      id: 'sensor-calib',
      title: 'Sensör Kalibrasyonu',
      why: 'PDR ve pusula doğruluğu düşük',
      how: 'Sensör kalibrasyon rehberi ve doğrulama',
      impact: 'med',
    });
  }

  return out;
}

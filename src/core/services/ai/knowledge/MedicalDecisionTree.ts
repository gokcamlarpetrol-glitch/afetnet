/**
 * MEDICAL DECISION TREE - ELITE EDITION
 * Interactive offline diagnosis engine.
 * Instead of just dumping text, it asks questions to narrow down the issue.
 */

export interface DecisionNode {
    id: string;
    question?: string; // If diagnostic node
    options?: { label: string; nextNodeId: string }[];
    diagnosis?: KnowledgeArticle; // If leaf node
}

import { KnowledgeArticle } from '../KnowledgeBase';

export class MedicalDecisionTree {
  private nodes: Record<string, DecisionNode> = {
    // ROOTS
    'root_bleeding': {
      id: 'root_bleeding',
      question: 'Kanama nerede ve ne şiddette?',
      options: [
        { label: 'Fışkırır tarzda (Açık Kırmızı)', nextNodeId: 'bleeding_arterial' },
        { label: 'Sızıntı şeklinde (Koyu Kırmızı)', nextNodeId: 'bleeding_venous' },
        { label: 'Burun Kanaması', nextNodeId: 'bleeding_nose' },
        { label: 'Uzuv Kopması', nextNodeId: 'bleeding_amputation' },
      ],
    },
    'root_consciousness': {
      id: 'root_consciousness',
      question: 'Hastanın durumu nedir?',
      options: [
        { label: 'Tepki vermiyor, nefes ALIYOR', nextNodeId: 'cons_coma' },
        { label: 'Tepki vermiyor, nefes ALMIYOR', nextNodeId: 'cons_cpr' },
        { label: 'Baygınlık geçirdi', nextNodeId: 'cons_faint' },
      ],
    },

    // LEAVES (Bleeding)
    'bleeding_arterial': {
      id: 'bleeding_arterial',
      diagnosis: {
        id: 'med-arterial',
        title: 'Atardamar Kanaması (Hayati Tehlike!)',
        content: `**DURUM:** Atardamar kanaması. Çok hızlı kan kaybedilir.\n\n**MÜDAHALE:**\n1. Yara üzerine temiz bezle **TÜM GÜCÜNÜZLE BASTIRIN**.\n2. Uzuvdaysa ve durmuyorsa, yara ile kalp arasına **TURNİKE** uygulayın.\n3. Turnikeyi sıkın (kan durana kadar) ve saati not edin.\n4. Hastayı şok pozisyonuna getirin (Ayaklar yukarı).`,
        tags: ['kanama', 'atardamar', 'turnike', 'acil'],
        category: 'first_aid',
      },
    },
    'bleeding_venous': {
      id: 'bleeding_venous',
      diagnosis: {
        id: 'med-venous',
        title: 'Toplardamar Kanaması',
        content: `**DURUM:** Toplardamar kanaması.\n\n**MÜDAHALE:**\n1. Yara üzerine temiz bezle bastırın (Tampon).\n2. Kan sızarsa bezi kaldırmadan üzerine ikinci bir bez koyup sargı yapın.\n3. Yaralı bölgeyi kalp seviyesinden yukarı kaldırın.`,
        tags: ['kanama', 'yara', 'tampon'],
        category: 'first_aid',
      },
    },
    'bleeding_nose': {
      id: 'bleeding_nose',
      diagnosis: {
        id: 'med-nose',
        title: 'Burun Kanaması',
        content: `**MÜDAHALE:**\n1. Başını hafifçe **ÖNE EĞİN** (Geriye atmayın, kan akciğere kaçabilir!).\n2. Burun kanatlarını parmaklarınızla 5 dakika sıkın.\n3. Enseye soğuk uygulama yapın.`,
        tags: ['burun', 'kanama'],
        category: 'first_aid',
      },
    },
    'bleeding_amputation': {
      id: 'bleeding_amputation',
      diagnosis: {
        id: 'med-amp',
        title: 'Uzuv Kopması',
        content: `**1. Hasta:** Kopan uzvun köküne acilen **TURNİKE** uygulayın. Şok pozisyonu verin.\n**2. Uzuv:** Kopan parçayı temiz bir poşete koyun. Bu poşeti, buzlu su dolu başka bir poşetin içine koyun. (Parça direkt buza değmemeli!).`,
        tags: ['kopma', 'uzuv', 'turnike', 'buz'],
        category: 'first_aid',
      },
    },

    // LEAVES (Consciousness)
    'cons_cpr': {
      id: 'cons_cpr',
      diagnosis: {
        id: 'med-cpr',
        title: 'KALP MASAJI (CPR) BAŞLA',
        content: `**DURUM:** Kardiyak Arrest (Kalp Durması).\n\n**ACİL:** 112 ARANMALI.\n\n**CPR:**\n1. Sert zemine yatır.\n2. Göğüs ortasına el topuğunu koy, diğer elini üstüne kenetle.\n3. Dakikada 100-120 kez, göğüs 5cm çökecek şekilde bas.\n4. **30 BASI / 2 NEFES** döngüsü yap.\n5. Tepki gelene veya sağlıkçı gelene kadar DURMA.`,
        tags: ['cpr', 'kalp', 'masaj', 'ölüm'],
        category: 'first_aid',
      },
    },
    'cons_coma': {
      id: 'cons_coma',
      diagnosis: {
        id: 'med-koma',
        title: 'Koma Pozisyonu',
        content: `**DURUM:** Bilinç kapalı ama yaşıyor.\n\n**MÜDAHALE:**\n1. Hastayı kusmuğunda boğulmaması için YAN ÇEVİRİN (Koma Pozisyonu).\n2. Nefes yolunu açık tutun.\n3. Asla su/yiyecek vermeyin.\n4. Sık sık nefesini kontrol edin.`,
        tags: ['koma', 'bilinç', 'yan', 'pozisyon'],
        category: 'first_aid',
      },
    },
  };

  /**
     * Start the diagnosis process based on implicit intent
     */
  startDiagnosis(intent: 'bleeding' | 'consciousness' | 'fracture' | 'burn'): DecisionNode {
    return this.nodes[`root_${intent}`];
  }

  getNode(nodeId: string): DecisionNode | undefined {
    return this.nodes[nodeId];
  }
}

export const medicalDecisionTree = new MedicalDecisionTree();

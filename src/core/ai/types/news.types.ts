/**
 * NEWS TYPES - Type Definitions for News Features
 * News articles, categories, state management
 */

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  imageUrl?: string;
  category: NewsCategory;
  magnitude?: number; // Deprem buyuklugu (varsa)
  location?: string; // Deprem yeri (varsa)
}

export type NewsCategory = 'earthquake' | 'disaster' | 'preparedness' | 'general';

export interface NewsState {
  articles: NewsArticle[];
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
}


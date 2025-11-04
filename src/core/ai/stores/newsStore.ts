/**
 * NEWS STORE
 * State management for news articles
 * Fetches and caches earthquake-related news
 */

import { create } from 'zustand';
import { NewsArticle } from '../types/news.types';

interface NewsState {
  articles: NewsArticle[];
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
}

interface NewsActions {
  setArticles: (articles: NewsArticle[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

const initialState: NewsState = {
  articles: [],
  loading: false,
  error: null,
  lastUpdate: null,
};

export const useNewsStore = create<NewsState & NewsActions>((set) => ({
  ...initialState,

  setArticles: (articles) => set({ articles, lastUpdate: Date.now(), error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  clear: () => set(initialState),
}));


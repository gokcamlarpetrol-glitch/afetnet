/**
 * ALL EARTHQUAKES SCREEN
 * Display all earthquakes with filtering
 */

import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../theme';
import { useEarthquakes } from '../hooks/useEarthquakes';
import EarthquakeCard from '../components/cards/EarthquakeCard';

export default function AllEarthquakesScreen({ navigation }: any) {
  const { earthquakes, loading, refresh } = useEarthquakes();
  const [filter, setFilter] = useState<'all' | 'strong' | 'moderate'>('all');

  const filteredEarthquakes = earthquakes.filter(eq => {
    if (filter === 'strong') return eq.magnitude >= 5.0;
    if (filter === 'moderate') return eq.magnitude >= 4.0 && eq.magnitude < 5.0;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Tüm Depremler</Text>
        <Pressable onPress={refresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={colors.brand.primary} />
        </Pressable>
      </View>

      {/* Filter */}
      <View style={styles.filterContainer}>
        <Pressable
          onPress={() => setFilter('all')}
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Tümü ({earthquakes.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter('strong')}
          style={[styles.filterButton, filter === 'strong' && styles.filterButtonActive]}
        >
          <Text style={[styles.filterText, filter === 'strong' && styles.filterTextActive]}>
            Güçlü (≥5.0)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter('moderate')}
          style={[styles.filterButton, filter === 'moderate' && styles.filterButtonActive]}
        >
          <Text style={[styles.filterText, filter === 'moderate' && styles.filterTextActive]}>
            Orta (4.0-5.0)
          </Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={filteredEarthquakes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EarthquakeCard
            earthquake={item}
            onPress={() => {/* TODO: Navigate to details */}}
          />
        )}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={refresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={colors.text.muted} />
            <Text style={styles.emptyText}>Deprem bulunamadı</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  filterText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.text.primary,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xxxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
});


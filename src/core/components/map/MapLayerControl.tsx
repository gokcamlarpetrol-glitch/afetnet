/**
 * MAP LAYER CONTROL
 * Toggle visibility of different map layers
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors } from '../../theme';
import * as haptics from '../../utils/haptics';

export interface MapLayers {
  earthquakes: boolean;
  family: boolean;
  pois: boolean;
  trappedUsers: boolean;
  hazardZones: boolean;
}

interface Props {
  layers: MapLayers;
  onLayerToggle: (layer: keyof MapLayers) => void;
  earthquakeCount: number;
  familyCount: number;
  poisCount: number;
  trappedUsersCount: number;
}

export default function MapLayerControl({
  layers,
  onLayerToggle,
  earthquakeCount,
  familyCount,
  poisCount,
  trappedUsersCount,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    haptics.impactLight();
    setIsExpanded(!isExpanded);
  };

  const handleLayerToggle = (layer: keyof MapLayers) => {
    haptics.impactLight();
    onLayerToggle(layer);
  };

  return (
    <View style={styles.container}>
      {/* Toggle Button */}
      <Pressable style={styles.toggleButton} onPress={handleToggle}>
        <BlurView intensity={50} tint="dark" style={styles.toggleBlur}>
          <Ionicons
            name={isExpanded ? 'close' : 'layers'}
            size={24}
            color={colors.text.primary}
          />
        </BlurView>
      </Pressable>

      {/* Layer List */}
      {isExpanded && (
        <View style={styles.layerList}>
          <BlurView intensity={50} tint="dark" style={styles.listBlur}>
            {/* Earthquakes */}
            <Pressable
              style={styles.layerItem}
              onPress={() => handleLayerToggle('earthquakes')}
            >
              <View style={styles.layerInfo}>
                <Ionicons
                  name="pulse"
                  size={20}
                  color={layers.earthquakes ? '#ef4444' : colors.text.tertiary}
                />
                <Text
                  style={[
                    styles.layerLabel,
                    !layers.earthquakes && styles.layerLabelDisabled,
                  ]}
                >
                  Depremler
                </Text>
                <Text style={styles.layerCount}>({earthquakeCount})</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  layers.earthquakes && styles.checkboxActive,
                ]}
              >
                {layers.earthquakes && (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                )}
              </View>
            </Pressable>

            {/* Family */}
            <Pressable
              style={styles.layerItem}
              onPress={() => handleLayerToggle('family')}
            >
              <View style={styles.layerInfo}>
                <Ionicons
                  name="people"
                  size={20}
                  color={layers.family ? '#3b82f6' : colors.text.tertiary}
                />
                <Text
                  style={[
                    styles.layerLabel,
                    !layers.family && styles.layerLabelDisabled,
                  ]}
                >
                  Aile
                </Text>
                <Text style={styles.layerCount}>({familyCount})</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  layers.family && styles.checkboxActive,
                ]}
              >
                {layers.family && (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                )}
              </View>
            </Pressable>

            {/* POIs */}
            <Pressable
              style={styles.layerItem}
              onPress={() => handleLayerToggle('pois')}
            >
              <View style={styles.layerInfo}>
                <Ionicons
                  name="location"
                  size={20}
                  color={layers.pois ? '#10b981' : colors.text.tertiary}
                />
                <Text
                  style={[
                    styles.layerLabel,
                    !layers.pois && styles.layerLabelDisabled,
                  ]}
                >
                  Önemli Noktalar
                </Text>
                <Text style={styles.layerCount}>({poisCount})</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  layers.pois && styles.checkboxActive,
                ]}
              >
                {layers.pois && (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                )}
              </View>
            </Pressable>

            {/* Trapped Users */}
            {trappedUsersCount > 0 && (
              <Pressable
                style={styles.layerItem}
                onPress={() => handleLayerToggle('trappedUsers')}
              >
                <View style={styles.layerInfo}>
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color={layers.trappedUsers ? '#dc2626' : colors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.layerLabel,
                      !layers.trappedUsers && styles.layerLabelDisabled,
                    ]}
                  >
                    Enkaz Altında
                  </Text>
                  <Text style={styles.layerCount}>({trappedUsersCount})</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    layers.trappedUsers && styles.checkboxActive,
                  ]}
                >
                  {layers.trappedUsers && (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  )}
                </View>
              </Pressable>
            )}

            {/* Hazard Zones */}
            <Pressable
              style={styles.layerItem}
              onPress={() => handleLayerToggle('hazardZones')}
            >
              <View style={styles.layerInfo}>
                <Ionicons
                  name="warning"
                  size={20}
                  color={layers.hazardZones ? '#f59e0b' : colors.text.tertiary}
                />
                <Text
                  style={[
                    styles.layerLabel,
                    !layers.hazardZones && styles.layerLabelDisabled,
                  ]}
                >
                  Tehlike Bölgeleri
                </Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  layers.hazardZones && styles.checkboxActive,
                ]}
              >
                {layers.hazardZones && (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                )}
              </View>
            </Pressable>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 120,
  },
  toggleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  toggleBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerList: {
    position: 'absolute',
    right: 0,
    bottom: 56,
    width: 220,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  listBlur: {
    padding: 8,
  },
  layerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  layerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  layerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  layerLabelDisabled: {
    color: colors.text.tertiary,
  },
  layerCount: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
});



import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors } from '../../theme';
import { MeshGraphView } from './MeshGraphView';

interface MeshNetworkModalProps {
    visible: boolean;
    onClose: () => void;
}

export const MeshNetworkModal = ({ visible, onClose }: MeshNetworkModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Mesh Ağı Durumu</Text>
              <Text style={styles.subtitle}>Bağlı Cihazlar ve Sinyal Gücü</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.graphContainer}>
            <MeshGraphView />
          </View>

          {/* Legend / Info */}
          <View style={styles.footer}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.status.safe }]} />
              <Text style={styles.legendText}>Güçlü Sinyal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.status.warning }]} />
              <Text style={styles.legendText}>Orta Sinyal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.status.danger }]} />
              <Text style={styles.legendText}>Zayıf Sinyal</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    height: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
  },
  graphContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
});

/**
 * ADD FAMILY MEMBER SCREEN - Premium Design
 * Provides QR code scanning and manual input to add new family members.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, StatusBar, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import { useFamilyStore } from '../../stores/familyStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { isValidDeviceId } from '../../../lib/device';


export default function AddFamilyMemberScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualId, setManualId] = useState('');

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    haptics.notificationSuccess();
    
    // Extract device ID from QR code
    const deviceId = data.trim();
    
    // Validate QR code contains valid device ID
    if (!isValidDeviceId(deviceId)) {
      Alert.alert('Geçersiz QR Kod', 'QR kod geçerli bir device ID içermiyor. Lütfen geçerli bir QR kod tarayın.');
      setScanned(false);
      return;
    }
    
    Alert.alert('Üye Bulundu', `ID: ${deviceId}\nBu üyeyi eklemek istiyor musunuz?`, [
      { text: 'İptal', onPress: () => setScanned(false), style: 'cancel' },
      { 
        text: 'Ekle', 
        onPress: async () => {
          // Add member with device ID
          await useFamilyStore.getState().addMember({
            name: `Üye ${deviceId.slice(-4)}`, // Last 4 chars as name
            status: 'unknown',
            lastSeen: Date.now(),
            latitude: 0,
            longitude: 0,
            deviceId: deviceId,
          });
          haptics.notificationSuccess();
          navigation.goBack();
        }
      },
    ]);
  };

  const handleManualAdd = () => {
    const id = manualId.trim();
    if (!id) {
      Alert.alert('Hata', 'Lütfen geçerli bir üye ID girin.');
      return;
    }
    
    // Validate ID format (should be afn-XXXXXXXX format)
    if (!isValidDeviceId(id)) {
      Alert.alert('Hata', 'Geçersiz ID formatı. ID "afn-" ile başlamalı ve 8 karakter içermeli (örn: afn-abc12345)');
      return;
    }
    
    haptics.notificationSuccess();
    Alert.alert('Üye Bulundu', `ID: ${id}\nBu üyeyi eklemek istiyor musunuz?`, [
      { text: 'İptal', style: 'cancel' },
      { 
        text: 'Ekle', 
        onPress: async () => {
          // Add member with device ID
          await useFamilyStore.getState().addMember({
            name: `Üye ${id.slice(-4)}`, // Last 4 chars as name
            status: 'unknown',
            lastSeen: Date.now(),
            latitude: 0,
            longitude: 0,
            deviceId: id,
          });
          haptics.notificationSuccess();
          navigation.goBack();
        }
      },
    ]);
  };

  return (
    <LinearGradient colors={[colors.background.primary, '#0b1220']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Yeni Üye Ekle</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>QR Kod ile Ekle</Text>
        <View style={styles.scannerContainer}>
          {!permission && (
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.permissionButtonText}>Kamera İzni İste</Text>
            </Pressable>
          )}
          {permission && !permission.granted && (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionDeniedText}>Kamera izni reddedildi.</Text>
              <Pressable style={styles.permissionButton} onPress={requestPermission}>
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.permissionButtonText}>Tekrar İzni İste</Text>
              </Pressable>
            </View>
          )}
          {permission?.granted && (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
          )}
          <View style={styles.scannerOverlay} />
        </View>

        <Text style={styles.sectionTitle}>Manuel Olarak Ekle</Text>
        <View style={styles.manualAddContainer}>
          <TextInput
            style={styles.input}
            placeholder="Üye ID'sini buraya girin..."
            placeholderTextColor={colors.text.tertiary}
            value={manualId}
            onChangeText={(text) => {
              // Elite Security: Sanitize input - only allow alphanumeric and dash
              const sanitized = text.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 20); // Max 20 chars
              setManualId(sanitized);
            }}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.addButton} onPress={handleManualAdd}>
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: StatusBar.currentHeight,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    ...typography.h3,
  },
  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32, // Add some padding at the bottom for the manual add section
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: 12,
  },
  scannerContainer: {
    width: '100%',
    aspectRatio: 1, // Make it a square
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#fff',
    ...typography.body,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  permissionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  permissionDeniedText: {
    color: colors.text.tertiary,
    ...typography.body,
    textAlign: 'center',
    marginBottom: 12,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualAddContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
});

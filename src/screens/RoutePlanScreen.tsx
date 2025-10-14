import React from "react";
import { Alert, Pressable, Text, View, StyleSheet } from "react-native";

export default function RoutePlanScreen(){
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🗺️ Rota Planlama</Text>
      <Text style={styles.subtitle}>Production build'de aktif olacak</Text>
      
      <View style={styles.featureContainer}>
        <Text style={styles.featureTitle}>🚀 Özellikler</Text>
        <Text style={styles.featureItem}>• Güvenli rota planlama</Text>
        <Text style={styles.featureItem}>• Enkaz bölgelerinden kaçınma</Text>
        <Text style={styles.featureItem}>• A* algoritması ile optimizasyon</Text>
        <Text style={styles.featureItem}>• QR kod ile rota paylaşımı</Text>
      </View>

      <Pressable 
        style={styles.actionButton}
        onPress={() => Alert.alert('Bilgi', 'Rota planlama production build\'de aktif olacak')}
      >
        <Text style={styles.actionButtonText}>🗺️ Rota Oluştur</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  featureContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 40,
    width: '100%',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  featureItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: '#C62828',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
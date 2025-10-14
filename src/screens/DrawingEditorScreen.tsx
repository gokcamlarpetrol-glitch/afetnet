import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, StyleSheet } from "react-native";

export default function DrawingEditorScreen(){
  return (
    <View style={styles.container}>
      <Text style={styles.title}>✏️ Çizim Editörü</Text>
      <Text style={styles.subtitle}>Production build'de aktif olacak</Text>
      
      <View style={styles.featureContainer}>
        <Text style={styles.featureTitle}>🎨 Özellikler</Text>
        <Text style={styles.featureItem}>• Enkaz çizimi</Text>
        <Text style={styles.featureItem}>• Güvenli bölge işaretleme</Text>
        <Text style={styles.featureItem}>• Harita üzerinde çizim</Text>
        <Text style={styles.featureItem}>• Mesh ağı ile paylaşım</Text>
      </View>

      <Pressable 
        style={styles.actionButton}
        onPress={() => Alert.alert('Bilgi', 'Çizim editörü production build\'de aktif olacak')}
      >
        <Text style={styles.actionButtonText}>🎨 Çizim Başlat</Text>
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
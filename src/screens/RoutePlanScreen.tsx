import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
// MapView temporarily disabled for Expo Go compatibility
// import MapView, { Polyline, Marker } from 'react-native-maps';

export default function RoutePlanScreen() {
  const [routeCoordinates, setRouteCoordinates] = useState([
    { latitude: 41.0082, longitude: 28.9784 },
    { latitude: 41.0092, longitude: 28.9794 },
    { latitude: 41.0102, longitude: 28.9804 },
    { latitude: 41.0112, longitude: 28.9814 },
  ]);

  const handlePlanRoute = () => {
    Alert.alert('Rota Planlandı', 'Güvenli rota oluşturuldu');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Rota Planlama</Text>
        <Text style={styles.subtitle}>Güvenli rota oluşturun</Text>
      </View>

      <View style={styles.map}>
        <Text style={styles.mapPlaceholder}>🗺️ Rota Planlama Haritası</Text>
        <Text style={styles.mapSubtext}>GPS koordinatları: {routeCoordinates.length} nokta</Text>
        <Text style={styles.mapSubtext}>Başlangıç: 41.0082, 28.9784</Text>
        <Text style={styles.mapSubtext}>Hedef: 41.0112, 28.9814</Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.planButton} onPress={handlePlanRoute}>
          <Text style={styles.buttonText}>🚀 Rota Planla</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#2c2c2c',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginTop: 8,
  },
  map: {
    flex: 1,
    margin: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholder: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  controls: {
    padding: 20,
    backgroundColor: '#ffffff',
  },
  planButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
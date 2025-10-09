import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePDRFuse } from '../hooks/usePDRFuse';
import { haversineDistance } from '../lib/geo';
import { Incident, useIncidents } from '../store/incidents';

export default function IncidentBoard() {
  const [myId] = useState('device_' + Date.now().toString(36));
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  
  const { 
    getAllIncidents, 
    getSortedIncidents, 
    mark, 
    assignTo, 
    updateIncident 
  } = useIncidents();
  
  const { currentPos } = usePDRFuse();
  
  const incidents = getSortedIncidents();

  const calculateDistance = (incident: Incident): number => {
    if (!currentPos || !incident.lat || !incident.lon) return 0;
    return haversineDistance(
      currentPos.lat, currentPos.lon,
      incident.lat, incident.lon
    );
  };

  const formatTimeAgo = (timestamp: number): string => {
    const minutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes}dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}sa önce`;
    const days = Math.floor(hours / 24);
    return `${days}gün önce`;
  };

  const getPriorityColor = (priority: number): string => {
    if (priority >= 8) return '#ef4444'; // High
    if (priority >= 5) return '#f59e0b'; // Medium
    if (priority >= 3) return '#3b82f6'; // Low
    return '#6b7280'; // Very Low
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return '#6b7280';
      case 'enroute': return '#f59e0b';
      case 'arrived': return '#3b82f6';
      case 'resolved': return '#10b981';
      default: return '#6b7280';
    }
  };

  const handleAssignToMe = (incident: Incident) => {
    assignTo(incident.id, myId);
    Alert.alert('Görev Alındı', 'Bu olay size atandı');
  };

  const handleMarkStatus = (incident: Incident, field: 'sound' | 'listen' | 'arrived') => {
    mark(incident.id, field, myId);
    
    let message = '';
    switch (field) {
      case 'sound': message = 'Ses var işaretlendi'; break;
      case 'listen': message = 'Dinleme yapıldı işaretlendi'; break;
      case 'arrived': message = 'Ulaştım işaretlendi'; break;
    }
    
    Alert.alert('Durum Güncellendi', message);
  };

  const handleSetStatus = (incident: Incident, status: Incident['status']) => {
    updateIncident(incident.id, { status });
    
    let message = '';
    switch (status) {
      case 'enroute': message = 'GİDİYORUM durumu güncellendi'; break;
      case 'arrived': message = 'ULAŞTIM durumu güncellendi'; break;
      case 'resolved': message = 'ÇÖZÜLDÜ durumu güncellendi'; break;
    }
    
    Alert.alert('Durum Güncellendi', message);
  };

  const renderIncident = ({ item }: { item: Incident }) => {
    const distance = calculateDistance(item);
    const isAssignedToMe = item.assignedTo === myId;
    
    return (
      <Pressable
        onPress={() => setSelectedIncident(item)}
        style={[
          styles.incidentItem,
          isAssignedToMe && styles.incidentItemAssigned
        ]}
      >
        <View style={styles.incidentHeader}>
          <View style={styles.priorityContainer}>
            <View 
              style={[
                styles.priorityBadge, 
                { backgroundColor: getPriorityColor(item.priority) }
              ]}
            >
              <Text style={styles.priorityText}>
                {item.priority.toFixed(1)}
              </Text>
            </View>
            <Text style={styles.incidentId}>#{item.id.slice(-6)}</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <View 
              style={[
                styles.statusBadge, 
                { backgroundColor: getStatusColor(item.status) }
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.incidentDetails}>
          <Text style={styles.timeAgo}>
            {formatTimeAgo(item.firstTs)}
          </Text>
          
          {distance > 0 && (
            <Text style={styles.distance}>
              ~{Math.round(distance)}m
            </Text>
          )}
          
          <Text style={styles.confirmations}>
            Ses:{item.confirmations.sound} | Dinleme:{item.confirmations.listen} | Ulaşan:{item.confirmations.arrived}
          </Text>
        </View>

        {item.statuses && item.statuses.length > 0 && (
          <View style={styles.statusesContainer}>
            {item.statuses.map((status, index) => (
              <View key={index} style={styles.statusTag}>
                <Text style={styles.statusTagText}>{status}</Text>
              </View>
            ))}
          </View>
        )}

        {isAssignedToMe && (
          <Text style={styles.assignedText}>✓ Size atandı</Text>
        )}
      </Pressable>
    );
  };

  const renderDetailActions = () => {
    if (!selectedIncident) return null;

    const isAssignedToMe = selectedIncident.assignedTo === myId;

    return (
      <View style={styles.detailActions}>
        <Text style={styles.detailTitle}>
          Olay Detayı - #{selectedIncident.id.slice(-6)}
        </Text>

        {!isAssignedToMe && selectedIncident.status === 'open' && (
          <Pressable
            onPress={() => handleAssignToMe(selectedIncident)}
            style={styles.assignButton}
          >
            <Text style={styles.assignButtonText}>Üzerime Al</Text>
          </Pressable>
        )}

        {isAssignedToMe && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => handleSetStatus(selectedIncident, 'enroute')}
              style={[styles.actionButton, styles.enrouteButton]}
            >
              <Text style={styles.actionButtonText}>GİDİYORUM</Text>
            </Pressable>
            
            <Pressable
              onPress={() => handleSetStatus(selectedIncident, 'arrived')}
              style={[styles.actionButton, styles.arrivedButton]}
            >
              <Text style={styles.actionButtonText}>ULAŞTIM</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.confirmationRow}>
          <Pressable
            onPress={() => handleMarkStatus(selectedIncident, 'listen')}
            style={[styles.confirmationButton, styles.listenButton]}
          >
            <Text style={styles.confirmationButtonText}>Dinleme Yapıldı</Text>
          </Pressable>
          
          <Pressable
            onPress={() => handleMarkStatus(selectedIncident, 'sound')}
            style={[styles.confirmationButton, styles.soundButton]}
          >
            <Text style={styles.confirmationButtonText}>Ses Var/Yok</Text>
          </Pressable>
        </View>

        {isAssignedToMe && (
          <Pressable
            onPress={() => handleSetStatus(selectedIncident, 'resolved')}
            style={[styles.actionButton, styles.resolvedButton]}
          >
            <Text style={styles.actionButtonText}>ÇÖZÜLDÜ</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Olay Panosu</Text>
      <Text style={styles.subtitle}>
        {incidents.length} aktif olay • {incidents.filter(i => i.assignedTo === myId).length} size atanmış
      </Text>

      <FlatList
        data={incidents}
        renderItem={renderIncident}
        keyExtractor={(item) => item.id}
        style={styles.incidentsList}
        showsVerticalScrollIndicator={false}
      />

      {renderDetailActions()}
    </View>
  );
}

function getStatusText(status: string): string {
  switch (status) {
    case 'open': return 'Açık';
    case 'enroute': return 'Yolda';
    case 'arrived': return 'Ulaştı';
    case 'resolved': return 'Çözüldü';
    default: return 'Bilinmiyor';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  incidentsList: {
    flex: 1,
    marginBottom: 16,
  },
  incidentItem: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#374151',
  },
  incidentItemAssigned: {
    borderLeftColor: '#3b82f6',
    backgroundColor: '#1e293b',
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  incidentId: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  incidentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeAgo: {
    color: '#94a3b8',
    fontSize: 12,
  },
  distance: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmations: {
    color: '#94a3b8',
    fontSize: 11,
  },
  statusesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  statusTag: {
    backgroundColor: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusTagText: {
    color: '#e5e7eb',
    fontSize: 10,
  },
  assignedText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  detailActions: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  detailTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  assignButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  assignButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  enrouteButton: {
    backgroundColor: '#f59e0b',
  },
  arrivedButton: {
    backgroundColor: '#3b82f6',
  },
  resolvedButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  listenButton: {
    backgroundColor: '#8b5cf6',
  },
  soundButton: {
    backgroundColor: '#ef4444',
  },
  confirmationButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

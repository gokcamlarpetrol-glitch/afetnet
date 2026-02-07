/**
 * COMMUNICATION SCREEN (Hybrid)
 * Formerly Mesh Network Screen.
 * Now handles both Online (Firebase) and Offline (Mesh) messaging.
 * Updated: Soft & Premium Theme
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, Animated, Easing, KeyboardAvoidingView, Platform, Alert, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useMeshStore, MeshNode, MeshMessage } from '../../services/mesh/MeshStore';
import { meshNetworkService } from '../../services/mesh/MeshNetworkService';
import { connectionManager, ConnectionMode } from '../../services/ConnectionManager';
import { hybridMessageService } from '../../services/HybridMessageService';
import { createLogger } from '../../utils/logger';
import type { StackNavigationProp } from '@react-navigation/stack';

const logger = createLogger('CommunicationScreen');

// ELITE: Proper navigation typing for type safety
interface CommunicationScreenProps {
  navigation?: StackNavigationProp<Record<string, undefined>>;
}

export default function CommunicationScreen({ navigation }: CommunicationScreenProps) {
  const insets = useSafeAreaInsets();
  const { peers, messages, isEnabled } = useMeshStore();
  const [inputText, setInputText] = useState('');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(connectionManager.getConnectionMode());

  // Radar Animation
  const scannerRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start Mesh Service (Always good to have it ready)
    meshNetworkService.start();

    // Subscribe to Connection Changes
    const unsubscribe = connectionManager.subscribe((mode) => {
      setConnectionMode(mode);
    });

    // Radar Animation Loop
    Animated.loop(
      Animated.timing(scannerRotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const success = await hybridMessageService.sendMessage(inputText);
    if (success) {
      setInputText('');
    } else {
      Alert.alert('Hata', 'Mesaj gönderilemedi.');
    }
  };

  const spin = scannerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderPeerNode = (peer: MeshNode) => {
    const normalizedDist = Math.max(0.2, Math.min(1.0, (Math.abs(peer.rssi) - 40) / 60));
    const hash = peer.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const angle = (hash % 360) * (Math.PI / 180);
    const x = Math.cos(angle) * (normalizedDist * 140);
    const y = Math.sin(angle) * (normalizedDist * 140);

    return (
      <View
        key={peer.id}
        style={[
          styles.peerNode,
          {
            transform: [{ translateX: x }, { translateY: y }],
            backgroundColor: peer.status === 'danger' ? colors.status.danger : colors.status.success,
          },
        ]}
      >
        <View style={styles.peerLabel}>
          <Text style={styles.peerName}>{peer.name}</Text>
          <Text style={styles.peerRssi}>{peer.rssi}dBm</Text>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: MeshMessage }) => (
    <View style={[
      styles.messageBubble,
      item.senderId === 'ME' ? styles.messageMine : styles.messageOther,
    ]}>
      <Text style={[styles.messageSender, item.senderId === 'ME' && { color: 'rgba(255,255,255,0.8)' }]}>{item.senderId}</Text>
      <Text style={[styles.messageText, item.senderId === 'ME' && { color: '#fff' }]}>{item.content}</Text>
      <Text style={[styles.messageTime, item.senderId === 'ME' && { color: 'rgba(255,255,255,0.6)' }]}>
        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  // Status Bar Color & Text
  const getStatusColor = () => {
    switch (connectionMode) {
      case 'ONLINE': return colors.status.success; // Green
      case 'MESH': return colors.status.info;    // Blue
      default: return colors.status.danger;      // Red
    }
  };

  const getStatusText = () => {
    switch (connectionMode) {
      case 'ONLINE': return 'Online (Bulut + Mesh)';
      case 'MESH': return 'Offline (Sadece Mesh)';
      default: return 'Bağlantı Yok';
    }
  };

  const StatusIcon = () => {
    switch (connectionMode) {
      case 'ONLINE': return <Ionicons name="cloud-done" size={12} color="#fff" />;
      case 'MESH': return <Ionicons name="radio" size={12} color="#fff" />;
      default: return <Ionicons name="cloud-offline" size={12} color="#fff" />;
    }
  };

  return (
    <ImageBackground
      source={require('../../../../assets/images/premium/mesh_city_network.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Header */}
      <BlurView intensity={80} tint="light" style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Haberleşme Merkezi</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <StatusIcon />
              <Text style={styles.statusBadgeText}>{getStatusText()}</Text>
            </View>
            <Text style={styles.headerSubtitle}>• {peers.length} Cihaz</Text>
          </View>
        </View>
      </BlurView>

      {/* Radar Visualization - Glassy Container */}
      <View style={styles.radarContainer}>
        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.radarCircle}>
          <View style={styles.radarInnerCircle} />
          <View style={styles.radarCenterMe} />
          {/* Scanner Line */}
          <Animated.View style={[styles.scannerLine, { transform: [{ rotate: spin }] }]}>
            <LinearGradient
              colors={['rgba(14, 165, 233, 0.5)', 'transparent']}
              style={styles.scannerGradient}
            />
          </Animated.View>
          {/* Peers */}
          {peers.map(renderPeerNode)}
        </View>
      </View>

      {/* Chat Area */}
      <View style={styles.chatContainer}>
        {/* Remove GradientOverlay, let background show through slightly or use plain white with opacity */}
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatList}
          inverted
          // ELITE: Performance optimizations
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          getItemLayout={(data, index) => ({
            length: 80, // Approximate message height
            offset: 80 * index,
            index,
          })}
        />
      </View>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <BlurView intensity={80} tint="light" style={[styles.inputContainer, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.input}
            placeholder={connectionMode === 'ONLINE' ? "Bulut veya Mesh üzerinden yaz..." : "Mesh üzerinden yaz..."}
            placeholderTextColor={colors.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
          />
          <Pressable style={[styles.sendButton, { backgroundColor: connectionMode === 'ONLINE' ? colors.brand.primary : colors.status.info }]} onPress={handleSend}>
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </BlurView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    zIndex: 10,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  radarContainer: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  radarCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  radarInnerCircle: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.05)',
  },
  radarCenterMe: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand.primary,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 20,
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scannerLine: {
    position: 'absolute',
    width: 260,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerGradient: {
    position: 'absolute',
    top: 0,
    left: 130,
    width: 130,
    height: 130,
    borderTopRightRadius: 260,
  },
  peerNode: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  peerLabel: {
    position: 'absolute',
    top: 14,
    left: -34,
    width: 80,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  peerName: {
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  peerRssi: {
    color: colors.text.secondary,
    fontSize: 8,
  },
  chatContainer: {
    flex: 1,
  },
  chatList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageSender: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginBottom: 2,
    fontWeight: '700',
  },
  messageText: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 9,
    color: colors.text.tertiary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

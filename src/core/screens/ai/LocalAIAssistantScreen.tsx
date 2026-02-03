import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, StatusBar, ImageBackground, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { localAIService } from '../../services/ai/LocalAIService';
import * as haptics from '../../utils/haptics';

// ELITE: Typed navigation and interfaces
type LocalAINavigationProp = StackNavigationProp<Record<string, object>>;

// ELITE: Decision node for AI conversation tree
interface DecisionNode {
  id: string;
  question: string;
  options?: string[];
  next?: DecisionNode;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  decisionNode?: DecisionNode;
  suggestions?: string[];
  isOnline?: boolean;
}

const QUICK_SCENARIOS = [
  { id: 's1', label: 'Gaz Kokusu', icon: 'flame', intent: 'Gaz sızıntısı var ne yapmalıyım?' },
  { id: 's2', label: 'Enkaz', icon: 'cube', intent: 'Enkaz altındayım' },
  { id: 's3', label: 'Bebek Boğulma', icon: 'medkit', intent: 'Bebek boğuluyor heimlich' },
  { id: 's4', label: 'Toplanma', icon: 'people', intent: 'Toplanma alanı neresi?' },
];

export default function LocalAIAssistantScreen({ navigation }: { navigation: LocalAINavigationProp }) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', text: 'Merhaba! Ben Afet Asistanı. Hem online hem offline modda hizmetinizdeyim.', sender: 'ai', timestamp: Date.now() },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isOnlineMode, setIsOnlineMode] = useState(true); // Mock connectivity
  const flatListRef = useRef<FlatList>(null);

  // Initial check
  useEffect(() => {
    // In real app, listen to NetInfo
  }, []);

  const toggleConnectivity = () => {
    haptics.selectionChanged();
    setIsOnlineMode(!isOnlineMode);
  };

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || inputText.trim();
    if (!text) return;

    const userMsg: Message = { id: Math.random().toString(), text, sender: 'user', timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    haptics.impactLight();

    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);

    try {
      // Call Hybrid Service
      const response = await localAIService.query(text, undefined, !isOnlineMode);

      const aiMsg: Message = {
        id: Math.random().toString(),
        text: response.text,
        sender: 'ai',
        timestamp: Date.now(),
        isOnline: response.isOnline !== false, // default true unless explicitly false
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Math.random().toString(), text: 'Bir hata oluştu.', sender: 'ai', timestamp: Date.now() }]);
    }
  };

  const toggleVoice = () => {
    haptics.impactMedium();
    if (isListening) {
      setIsListening(false);
      handleSend("Sesli komut simülasyonu: Yardım edin!");
    } else {
      setIsListening(true);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={{ marginBottom: 20 }}>
        <View style={[styles.messageBubble, isUser ? styles.messageUser : styles.messageAi]}>
          <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAi]}>{item.text}</Text>
          {!isUser && (
            <View style={styles.sourceTag}>
              <Ionicons name={item.isOnline ? "cloud-done" : "save"} size={10} color={item.isOnline ? "#10b981" : "#f59e0b"} />
              <Text style={[styles.sourceText, { color: item.isOnline ? "#059669" : "#d97706" }]}>
                {item.isOnline ? "AI (Canlı)" : "Offline Veri"}
              </Text>
            </View>
          )}
        </View>
        {!isUser && item.timestamp === messages[messages.length - 1].timestamp && (
          <Text style={styles.timestamp}>Şimdi</Text>
        )}
      </View>
    );
  };

  return (
    <ImageBackground
      source={require('../../../../assets/images/premium/violet_ai_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.7)']} style={StyleSheet.absoluteFill} />
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#5b21b6" />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 24, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={{ fontSize: 13, color: '#8b5cf6', fontWeight: '700', letterSpacing: 2, marginBottom: 4 }}>HİBRİT ZEKA</Text>
          <Text style={{ fontSize: 28, fontWeight: '300', color: '#4c1d95', letterSpacing: -0.5 }}>Afet Asistanı</Text>
        </View>

        {/* Connection Toggle (Simulation) */}
        <TouchableOpacity onPress={toggleConnectivity} style={[styles.offlineBadge, { borderColor: isOnlineMode ? '#bbf7d0' : '#fecaca', backgroundColor: isOnlineMode ? '#f0fdf4' : '#fef2f2' }]}>
          <Ionicons name={isOnlineMode ? "wifi" : "wifi-outline"} size={14} color={isOnlineMode ? '#16a34a' : '#dc2626'} />
          <Text style={[styles.offlineText, { color: isOnlineMode ? '#15803d' : '#b91c1c' }]}>
            {isOnlineMode ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenarioList}>
        {QUICK_SCENARIOS.map(s => (
          <TouchableOpacity key={s.id} style={styles.scenarioChip} onPress={() => handleSend(s.intent)}>
            <Ionicons name={s.icon as any} size={16} color="#7c3aed" />
            <Text style={styles.scenarioText}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatList}
        // ELITE: Performance optimizations
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={7}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 100, // Approximate message height
          offset: 100 * index,
          index,
        })}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
            onPress={toggleVoice}
            onLongPress={toggleVoice}
          >
            <Ionicons name={isListening ? "mic" : "mic-outline"} size={26} color="#fff" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={isListening ? "Dinliyorum..." : "Yazın..."}
            placeholderTextColor="#a78bfa"
            value={inputText}
            onChangeText={setInputText}
          />

          {inputText.length > 0 && (
            <Pressable style={styles.sendButton} onPress={() => handleSend()}>
              <Ionicons name="arrow-up" size={24} color="#fff" />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3ff' },
  header: { paddingHorizontal: 24, paddingBottom: 10, alignItems: 'flex-start' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  offlineText: { fontSize: 10, fontWeight: '800' },

  scenarioList: { paddingHorizontal: 24, gap: 10, maxHeight: 50, marginBottom: 8 },
  scenarioChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 20, shadowColor: "#8b5cf6", shadowOpacity: 0.05, shadowRadius: 4 },
  scenarioText: { fontSize: 13, fontWeight: '600', color: '#5b21b6' },

  chatList: { padding: 24, paddingVertical: 10 },
  messageBubble: { padding: 16, borderRadius: 24, maxWidth: '85%' },
  messageUser: { alignSelf: 'flex-end', backgroundColor: '#8b5cf6', borderBottomRightRadius: 4 },
  messageAi: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: "#8b5cf6", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, minWidth: '40%' },
  messageText: { fontSize: 15, lineHeight: 24 },
  messageTextUser: { color: '#fff' },
  messageTextAi: { color: '#4c1d95' },

  sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, opacity: 0.8 },
  sourceText: { fontSize: 10, fontWeight: '700' },

  timestamp: { fontSize: 10, color: '#a78bfa', marginLeft: 12, marginTop: 4 },

  inputContainer: { flexDirection: 'row', padding: 20, alignItems: 'center', gap: 12, backgroundColor: 'transparent' },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 16, color: '#4c1d95', fontSize: 16, shadowColor: "#8b5cf6", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  voiceButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', shadowColor: "#8b5cf6", shadowOpacity: 0.3, shadowRadius: 8 },
  voiceButtonActive: { backgroundColor: '#ef4444', transform: [{ scale: 1.1 }] },
  sendButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', shadowColor: "#8b5cf6", shadowOpacity: 0.3, shadowRadius: 8 },
});

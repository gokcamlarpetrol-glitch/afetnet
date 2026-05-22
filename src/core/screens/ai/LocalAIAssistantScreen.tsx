import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, StatusBar, ImageBackground, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import { aiAssistantCoordinator, HybridAIResponse } from '../../ai/services/AIAssistantCoordinator';
import { firebaseAnalyticsService } from '../../services/FirebaseAnalyticsService';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';

// ELITE: Typed navigation and interfaces
type LocalAINavigationProp = StackNavigationProp<Record<string, object>>;

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  source?: 'openai' | 'offline' | 'hybrid';
  emergencyLevel?: 'normal' | 'urgent' | 'critical';
  responseTime?: number;
  suggestedActions?: SuggestedAction[];
}

interface SuggestedAction {
  id: string;
  label: string;
  icon: string;
  action: 'call' | 'navigate' | 'share' | 'info';
  data?: string;
}

// ELITE: Expanded quick scenarios for all emergency situations
const QUICK_SCENARIOS = [
  // Critical Emergency
  { id: 's1', label: '🚨 Deprem!', icon: 'pulse', intent: 'Deprem oluyor ne yapmalıyım?' },
  { id: 's2', label: '🏚️ Enkaz', icon: 'cube', intent: 'Enkaz altındayım yardım edin' },
  { id: 's3', label: '🔥 Yangın', icon: 'flame', intent: 'Yangın var ne yapmalıyım?' },
  { id: 's4', label: '🌊 Sel', icon: 'water', intent: 'Sel baskını var ne yapmalıyım?' },

  // First Aid
  { id: 's5', label: '🩹 İlk Yardım', icon: 'medkit', intent: 'İlk yardım nasıl yapılır?' },
  { id: 's6', label: '🩸 Kanama', icon: 'water', intent: 'Kanama durdurmak için ne yapmalıyım?' },
  { id: 's7', label: '💔 CPR', icon: 'heart-dislike', intent: 'CPR nasıl yapılır?' },
  { id: 's8', label: '🦴 Kırık', icon: 'bandage', intent: 'Kırık durumunda ne yapmalı?' },

  // Safety & Preparation
  { id: 's9', label: '📍 Toplanma', icon: 'location', intent: 'Toplanma alanı neresi?' },
  { id: 's10', label: '📋 Hazırlık', icon: 'list', intent: 'Depreme nasıl hazırlanmalıyım?' },
  { id: 's11', label: '🎒 Çanta', icon: 'briefcase', intent: 'Acil durum çantasında ne olmalı?' },
  { id: 's12', label: '👨‍👩‍👧 Aile', icon: 'people', intent: 'Aile acil durum planı nasıl yapılır?' },

  // Psychological Support
  { id: 's13', label: '😰 Panik', icon: 'heart', intent: 'Panik atak geçiriyorum ne yapmalıyım?' },
  { id: 's14', label: '👧 Çocuk', icon: 'happy', intent: 'Çocuğumu nasıl sakinleştiririm?' },

  // Specific Situations
  { id: 's15', label: '💨 Gaz', icon: 'cloud', intent: 'Gaz sızıntısı var ne yapmalıyım?' },
  { id: 's16', label: '⚡ Elektrik', icon: 'flash', intent: 'Elektrik çarpması durumunda ne yapmalı?' },
];

// PERF: TypeWriterText defined at file level to prevent recreation on every parent render
const TypeWriterText = React.memo(({ text, onComplete }: { text: string; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 15);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, onComplete]);

  return (
    <Markdown
      style={{
        body: styles.messageTextAi,
        heading1: { fontSize: 20, fontWeight: '800', marginBottom: 8, color: '#4c1d95' },
        heading2: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#4c1d95' },
        strong: { fontWeight: '800', color: '#3b0764' },
        paragraph: { marginVertical: 4 },
        list_item: { marginVertical: 2 },
      }}
    >
      {displayedText}
    </Markdown>
  );
});

export default function LocalAIAssistantScreen({ navigation }: { navigation: LocalAINavigationProp }) {
  const insets = useSafeAreaInsets();
  const setAiDataSharingConsented = useSettingsStore((s) => s.setAiDataSharingConsented);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: '👋 Merhaba! Ben AfetNet Yapay Zeka Asistanı.\n\n🌍 **Deprem & Afet Güvenliği**\nDeprem öncesi, sırası ve sonrası yapılması gerekenler\n\n🏥 **İlk Yardım Rehberi**\nKanama, kırık, yanık, CPR ve acil müdahale\n\n📋 **Hazırlık Planı**\nAcil durum çantası, aile planı, toplanma alanları\n\n💚 **Psikolojik Destek**\nPanik yönetimi, çocukları sakinleştirme\n\n✅ Hem **online** hem **offline** modda çalışıyorum!\n\n⚠️ *Bu asistan genel bilgi amaçlıdır ve profesyonel tıbbi ya da acil durum hizmetinin yerini almaz. Acil durumlarda mutlaka 112\'yi arayın.*\n\n👆 Yukarıdaki hızlı erişim butonlarını kullanın veya sorunuzu yazın.',
      sender: 'ai',
      timestamp: Date.now(),
      source: 'offline',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const isSendingRef = useRef(false);
  const [isOnlineMode, setIsOnlineMode] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Apple Guideline 5.1.2(i): Prompt for AI data sharing consent before first OpenAI interaction
  const promptAiConsent = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        'AI Asistan Veri Kullanımı',
        'Bu özellik sorularınızı işlemek için OpenAI yapay zekâ servisini kullanır.\n\nMesajlarınız güvenli sunucu proxy\'si üzerinden OpenAI\'ye iletilir. Kişisel bilgileriniz (TC kimlik, telefon, e-posta) otomatik olarak filtrelenir.\n\nOpenAI, API verilerini model eğitiminde kullanmaz.\n\nDevam etmek istiyor musunuz?',
        [
          {
            text: 'Hayır',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Kabul Ediyorum',
            onPress: () => {
              setAiDataSharingConsented(true);
              resolve(true);
            },
          },
        ],
        { cancelable: false },
      );
    });
  }, [setAiDataSharingConsented]);

  // ELITE: Check actual network connectivity
  useEffect(() => {
    checkConnectivity();
  }, []);

  // SSE bağlantısını ekran kapanınca iptal et — açık fetch ve unmounted
  // component'e setState yazımı kaynaklı bellek sızıntısını önler.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const checkConnectivity = async () => {
    try {
      const online = await aiAssistantCoordinator.isOnline();
      setIsOnlineMode(online);
    } catch {
      setIsOnlineMode(false);
    }
  };

  const toggleConnectivity = async () => {
    haptics.selectionChanged();
    await checkConnectivity();
  };

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || inputText.trim();
    if (!text || isSendingRef.current) return;
    const requestStartedAt = Date.now();

    // Apple Guideline 5.1.2(i): Require explicit consent before sending data to OpenAI
    // If user declines, STILL serve offline AI response (no data sent to OpenAI)
    let forceOfflineOnly = false;
    const online = await aiAssistantCoordinator.isOnline().catch(() => false);
    setIsOnlineMode(online);
    if (!online) {
      forceOfflineOnly = true;
    } else if (!useSettingsStore.getState().aiDataSharingConsented) {
      const consented = await promptAiConsent();
      if (!consented) {
        forceOfflineOnly = true;
      }
    }

    isSendingRef.current = true;

    const userMsg: Message = {
      id: Math.random().toString(),
      text,
      sender: 'user',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    haptics.impactLight();

    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);

    try {
      // ELITE: Extract context history (memory) for the AI
      // Exclude welcome/hints to save tokens and focus on actual conversation
      const history = messages
        .filter(m => m.id !== 'welcome' && !m.id.startsWith('voice_hint'))
        .map(m => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text
        }));

      // ELITE: Use new hybrid AI coordinator with memory
      // If user declined AI data sharing, use offline-only mode (no OpenAI call)
      let response: HybridAIResponse;
      if (forceOfflineOnly) {
        const { offlineAIService } = await import('../../ai/services/OfflineAIService');
        const offlineResult = await offlineAIService.getResponse(text);
        response = { ...offlineResult, source: 'offline', responseTime: Date.now() - requestStartedAt };
      } else {
        // Streaming UX: insert a placeholder AI bubble immediately, then mutate its text as
        // tokens arrive over SSE. The user sees the answer materialize in real time
        // instead of waiting 3-5s for the full payload.
        const streamingId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let receivedAnyChunk = false;
        setMessages(prev => [...prev, {
          id: streamingId,
          text: '',
          sender: 'ai',
          timestamp: Date.now(),
        }]);
        setIsTyping(false); // streaming bubble replaces the typing indicator

        // SSE çağrısını iptal edilebilir kıl — kullanıcı yanıt gelmeden ekrandan
        // çıkarsa unmount cleanup bu controller'ı abort eder.
        const controller = new AbortController();
        abortControllerRef.current = controller;
        response = await aiAssistantCoordinator.chat(text, history, (_delta, accumulated) => {
          receivedAnyChunk = true;
          setMessages(prev => prev.map(m => (m.id === streamingId ? { ...m, text: accumulated } : m)));
        }, controller.signal);

        // Finalize the streaming bubble with full metadata so suggested actions etc. render.
        // Fallback to response.answer when no chunks arrived (offline route or sync path).
        const finalText = receivedAnyChunk ? (response.answer || '') : response.answer;
        setMessages(prev => prev.map(m => (m.id === streamingId ? {
          ...m,
          text: finalText,
          source: response.source,
          emergencyLevel: response.emergencyLevel,
          responseTime: response.responseTime,
          suggestedActions: response.suggestedActions,
        } : m)));

        // ELITE: Emergency haptic feedback
        if (response.emergencyLevel === 'critical') {
          haptics.notificationError();
        } else if (response.emergencyLevel === 'urgent') {
          haptics.notificationWarning();
        } else {
          haptics.notificationSuccess();
        }

        // Track AI conversation metrics (unchanged)
        firebaseAnalyticsService.logEvent('ai_conversation', {
          source: response.source,
          response_time_ms: response.responseTime,
          emergency_level: response.emergencyLevel,
          query_length: text.length,
        });
        return; // streaming path already rendered the message
      }

      const aiMsg: Message = {
        id: Math.random().toString(),
        text: response.answer,
        sender: 'ai',
        timestamp: Date.now(),
        source: response.source,
        emergencyLevel: response.emergencyLevel,
        responseTime: response.responseTime,
        suggestedActions: response.suggestedActions,
      };

      // ELITE: Emergency haptic feedback
      if (response.emergencyLevel === 'critical') {
        haptics.notificationError();
      } else if (response.emergencyLevel === 'urgent') {
        haptics.notificationWarning();
      } else {
        haptics.notificationSuccess();
      }

      setMessages(prev => [...prev, aiMsg]);

      // ELITE: Track AI conversation metrics
      firebaseAnalyticsService.logEvent('ai_conversation', {
        source: response.source,
        response_time_ms: response.responseTime,
        emergency_level: response.emergencyLevel,
        query_length: text.length,
      });
    } catch (e) {
      haptics.notificationError();
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        text: '⚠️ Bir hata oluştu. Acil durumlarda 112\'yi arayın.',
        sender: 'ai',
        timestamp: Date.now(),
        emergencyLevel: 'urgent',
      }]);
    } finally {
      setIsTyping(false);
      isSendingRef.current = false;
    }
  };

  const handleSuggestedAction = async (action: SuggestedAction) => {
    haptics.impactLight();
    try {
      if (action.action === 'call') {
        await Linking.openURL(`tel:${action.data || '112'}`);
        return;
      }

      if (action.action === 'navigate') {
        const routeMap: Record<string, string> = {
          first_aid: 'PanicAssistant',
          preparedness: 'PreparednessPlan',
          map: 'DisasterMap',
          risk: 'RiskScore',
        };
        const routeName = routeMap[action.data || ''] || action.data;
        if (routeName) {
          (navigation as any).navigate(routeName);
        }
        return;
      }

      if (action.action === 'share') {
        if (action.id === 'sos') {
          (navigation as any).navigate('FlashlightWhistle');
        } else {
          (navigation as any).navigate('DisasterMap');
        }
        return;
      }

      Alert.alert(action.label, 'Bu aksiyon için ilgili ekran açılacak.');
    } catch {
      Alert.alert('Aksiyon açılamadı', 'Lütfen bağlantınızı ve cihaz izinlerinizi kontrol edin.');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    const isEmergency = item.emergencyLevel === 'critical';
    const isUrgent = item.emergencyLevel === 'urgent';
    // Sadece karşılama mesajı ('welcome') veya yeni AI mesajlarında TypeWriter kullan. (Kapanıp açılmalarda yeniden oynatmaması için gelişmiş bir mantık da kurulabilirdi, şimdilik tüm AI mesajları daktilo)

    const handleCopy = async () => {
      await Clipboard.setStringAsync(item.text);
      haptics.notificationSuccess(); // Haptic feedback indicating successful copy
    };

    return (
      <View style={{ marginBottom: 16 }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={handleCopy}
          style={[
            styles.messageBubble,
            isUser ? styles.messageUser : styles.messageAi,
            isEmergency && styles.messageEmergency,
            isUrgent && styles.messageUrgent,
          ]}
        >
          {isUser ? (
            <Text style={[styles.messageText, styles.messageTextUser]}>{item.text}</Text>
          ) : (
            <TypeWriterText text={item.text} />
          )}

          {/* Source indicator */}
          {!isUser && item.source && (
            <View style={styles.sourceTag}>
              <Ionicons
                name={item.source === 'openai' ? 'cloud' : item.source === 'hybrid' ? 'globe' : 'save'}
                size={10}
                color={item.source === 'offline' ? '#f59e0b' : '#10b981'}
              />
              <Text style={[styles.sourceText, {
                color: item.source === 'offline' ? '#d97706' : '#059669'
              }]}>
                {item.source === 'openai' ? 'AI' : item.source === 'hybrid' ? 'Hibrit' : 'Offline'}
                {item.responseTime ? ` • ${item.responseTime}ms` : ''}
              </Text>
            </View>
          )}

          {!isUser && item.suggestedActions && item.suggestedActions.length > 0 && (
            <View style={styles.actionChips}>
              {item.suggestedActions.slice(0, 3).map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.actionChip}
                  onPress={() => handleSuggestedAction(action)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={action.icon as any} size={13} color="#6d28d9" />
                  <Text style={styles.actionChipText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };


  return (
    <ImageBackground
      source={require('../../../../assets/images/premium/violet_ai_bg.jpg')}
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
            {isOnlineMode ? 'ÇEVRİMİÇİ' : 'ÇEVRİMDIŞI'}
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
        /* getItemLayout removed: AI messages have variable heights (markdown),
           fixed 100px caused scroll miscalculation and clipped content */
        // ELITE: Typing indicator
        ListFooterComponent={isTyping ? (
          <View style={[styles.messageBubble, styles.messageAi, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
            <ActivityIndicator size="small" color="#8b5cf6" />
            <Text style={[styles.messageTextAi, { opacity: 0.7 }]}>Düşünüyorum...</Text>
          </View>
        ) : null}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 12 }]}>
          {/* Voice command button removed — feature not implemented.
              Apple Guideline 2.1: apps must not expose incomplete features. */}

          <TextInput
            style={styles.input}
            placeholder={"Yazın..."}
            placeholderTextColor="#a78bfa"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => { if (inputText.trim().length > 0 && !isTyping) handleSend(); }}
            returnKeyType="send"
            blurOnSubmit={false}
          />

          {inputText.length > 0 && (
            <Pressable style={[styles.sendButton, isTyping && { opacity: 0.5 }]} onPress={() => handleSend()} disabled={isTyping}>
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
  // ELITE: Emergency state styles
  messageEmergency: { backgroundColor: '#fef2f2', borderWidth: 2, borderColor: '#ef4444' },
  messageUrgent: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#f59e0b' },


  sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, opacity: 0.8 },
  sourceText: { fontSize: 10, fontWeight: '700' },
  actionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe' },
  actionChipText: { fontSize: 11, fontWeight: '700', color: '#6d28d9' },

  timestamp: { fontSize: 10, color: '#a78bfa', marginLeft: 12, marginTop: 4 },

  inputContainer: { flexDirection: 'row', padding: 20, alignItems: 'center', gap: 12, backgroundColor: 'transparent' },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 16, color: '#4c1d95', fontSize: 16, shadowColor: "#8b5cf6", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  // voiceButton styles removed — voice command feature not implemented (Apple 2.1)
  sendButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', shadowColor: "#8b5cf6", shadowOpacity: 0.3, shadowRadius: 8 },
});

import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { voiceMessageService } from '../../services/VoiceMessageService';
import { MeshMessage } from '../../services/mesh/MeshStore';
import { styles } from '../../screens/messages/ConversationScreen.styles';

/** Generate stable waveform heights from message ID hash — 12 bars, values 0.2–1.0 */
export const getWaveformHeights = (id: string): number[] => {
    const bars: number[] = [];
    for (let i = 0; i < 12; i++) {
        let hash = 0;
        for (let j = 0; j < id.length; j++) {
            hash = ((hash << 5) - hash + id.charCodeAt(j) * (i + 1)) | 0;
        }
        bars.push(0.2 + (Math.abs(hash) % 100) / 125); // range 0.2–1.0
    }
    return bars;
};

export const formatSeconds = (sec: number): string =>
    `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export interface VoicePlayerInlineProps {
    message: MeshMessage;
    isMe: boolean;
}

// ELITE: Inline Voice Player for voice messages
export const VoicePlayerInline = React.memo(({ message, isMe }: VoicePlayerInlineProps) => {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [elapsed, setElapsed] = React.useState(0);
    const elapsedRef = React.useRef<NodeJS.Timeout | null>(null);
    const durationSec = message.mediaDuration || 0;
    const waveHeights = React.useMemo(() => getWaveformHeights(message.id), [message.id]);

    const stopElapsed = () => {
        if (elapsedRef.current) {
            clearInterval(elapsedRef.current);
            elapsedRef.current = null;
        }
    };

    const handlePlay = async () => {
        try {
            if (isPlaying) {
                await voiceMessageService.stop();
                setIsPlaying(false);
                stopElapsed();
                setElapsed(0);
            } else {
                const uri = message.mediaUrl || '';
                if (!uri) {
                    Alert.alert('Ses Bulunamadı', 'Bu sesli mesajın dosyası mevcut değil.');
                    return;
                }
                // Validate local file:// URIs — iOS/Android may have cleaned temp cache
                if (uri.startsWith('file://')) {
                    try {
                        const FileSystem = require('expo-file-system');
                        const info = await FileSystem.getInfoAsync(uri);
                        if (!info.exists) {
                            Alert.alert('Ses Bulunamadı', 'Ses dosyası artık mevcut değil. Mesaj yeniden indirilmeyi bekliyor olabilir.');
                            return;
                        }
                    } catch { /* expo-file-system unavailable, try playing anyway */ }
                }
                const voiceMsg = {
                    id: message.id,
                    uri,
                    durationMs: durationSec * 1000,
                    timestamp: message.timestamp,
                    from: message.senderId,
                    to: message.to,
                    delivered: true,
                    played: false,
                };
                setIsPlaying(true);
                setElapsed(0);
                await voiceMessageService.play(voiceMsg as any);

                stopElapsed();
                elapsedRef.current = setInterval(() => {
                    setElapsed(prev => {
                        const next = prev + 1;
                        // Stop if known duration is reached.
                        // For unknown duration, use a safe cap to avoid infinite timers.
                        const maxDuration = durationSec > 0 ? durationSec : 120;
                        if (next >= maxDuration) {
                            stopElapsed();
                            setIsPlaying(false);
                            return 0;
                        }
                        return next;
                    });
                }, 1000);
            }
        } catch (error) {
            setIsPlaying(false);
            stopElapsed();
            setElapsed(0);
            Alert.alert('Ses Oynatılamadı', 'Sesli mesaj oynatılırken bir hata oluştu. Lütfen tekrar deneyin.');
        }
    };

    React.useEffect(() => () => stopElapsed(), []);

    const displayTime = isPlaying && elapsed > 0
        ? formatSeconds(elapsed)
        : (durationSec > 0 ? formatSeconds(durationSec) : '0:00');

    return (
        <Pressable onPress={handlePlay} style={styles.voicePlayer}>
            <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={36}
                color={isMe ? '#1e3a8a' : '#3b82f6'}
            />
            <View style={styles.voiceWaveform}>
                {waveHeights.map((h, i) => {
                    const playedFraction = durationSec > 0 ? elapsed / durationSec : 0;
                    const barFraction = i / waveHeights.length;
                    const isPlayed = isPlaying && barFraction < playedFraction;
                    return (
                        <View
                            key={i}
                            style={[
                                styles.voiceBar,
                                {
                                    height: h * 20,
                                    backgroundColor: isPlayed
                                        ? (isMe ? '#1e3a8a' : '#3b82f6')
                                        : (isMe ? '#1e3a8a50' : '#3b82f650'),
                                },
                            ]}
                        />
                    );
                })}
            </View>
            <Text style={[styles.voiceDuration, { color: isMe ? '#1e3a8a' : '#64748b' }]}>
                {displayTime}
            </Text>
        </Pressable>
    );
}, (prev, next) =>
  prev.message.id === next.message.id
    && prev.message.mediaUrl === next.message.mediaUrl
    && prev.message.mediaDuration === next.message.mediaDuration
    && prev.message.status === next.message.status
    && prev.isMe === next.isMe);

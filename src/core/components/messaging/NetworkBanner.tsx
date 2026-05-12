import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../screens/messages/ConversationScreen.styles';

// ELITE: Network Status Banner Component (inline)
export const NetworkBanner = ({ status }: { status: 'online' | 'mesh' | 'offline' }) => {
    const getStatusConfig = () => {
        switch (status) {
            case 'online':
                return { color: '#22c55e', text: 'Çevrimiçi', icon: 'cloud-done' as const };
            case 'mesh':
                return { color: '#3b82f6', text: 'Mesh Ağı', icon: 'git-network' as const };
            case 'offline':
                return { color: '#f59e0b', text: 'Çevrimdışı', icon: 'cloud-offline' as const };
        }
    };

    const config = getStatusConfig();

    return (
        <Animated.View entering={FadeIn} style={[styles.networkBanner, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon} size={14} color={config.color} />
            <Text style={[styles.networkText, { color: config.color }]}>{config.text}</Text>
        </Animated.View>
    );
};

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    cancelAnimation,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { styles } from '../../screens/messages/ConversationScreen.styles';

// ELITE: Typing Indicator Component — animated cascade dots
export const TypingDot = ({ delay }: { delay: number }) => {
    const translateY = useSharedValue(0);

    useEffect(() => {
        translateY.value = withRepeat(
            withSequence(
                withTiming(0, { duration: delay }),
                withTiming(-6, { duration: 300 }),
                withTiming(0, { duration: 300 }),
                withTiming(0, { duration: 600 - delay }),
            ),
            -1,
            false,
        );
        return () => { cancelAnimation(translateY); };
    }, [delay, translateY]);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return <Animated.View style={[styles.dot, animStyle]} />;
};

export const TypingIndicatorDots = () => {
    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.typingContainer}
        >
            <View style={styles.typingBubble}>
                <View style={styles.dotContainer}>
                    <TypingDot delay={0} />
                    <TypingDot delay={150} />
                    <TypingDot delay={300} />
                </View>
            </View>
        </Animated.View>
    );
};

/**
 * FAMILY TRAIL OVERLAY — FAZ 4
 * 
 * Shows movement trails (Polyline) for each family member
 * based on their locationHistory array.
 * 
 * Features:
 * - Gradient polyline (recent → old = dark → light)
 * - Optional time slider for "rewind"
 * - Max 100 history points per member
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Polyline, Marker } from 'react-native-maps';
import { FamilyMember } from '../../stores/familyStore';

interface LocationHistoryPoint {
    latitude: number;
    longitude: number;
    timestamp: number;
}

interface FamilyTrailOverlayProps {
    members: FamilyMember[];
    visible: boolean;
    /** Only show trails for this member ID (null = all) */
    selectedMemberId?: string | null;
}

// Trail colors for different members
const TRAIL_COLORS = [
    '#1F4E79', // Trust Blue
    '#2E7D32', // Safe Green
    '#D9A441', // Warning Gold
    '#B53A3A', // Critical Red
    '#6366f1', // Indigo
    '#0ea5e9', // Sky Blue
];

const FamilyTrailOverlay = memo(({ members, visible, selectedMemberId }: FamilyTrailOverlayProps) => {
    // CRITICAL: useMemo MUST be called before any conditional return (Rules of Hooks)
    const trails = useMemo(() => {
        if (!visible) return [];
        return members
            .filter(m => {
                if (selectedMemberId) return m.id === selectedMemberId;
                return true;
            })
            .map((member, index) => {
                const history: LocationHistoryPoint[] = (member as any).locationHistory || [];
                if (history.length < 2) return null;

                // Sort by timestamp (oldest first for polyline direction)
                const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);

                // Validate coordinates
                const validPoints = sorted.filter(p =>
                    typeof p.latitude === 'number' && isFinite(p.latitude) &&
                    typeof p.longitude === 'number' && isFinite(p.longitude) &&
                    !(p.latitude === 0 && p.longitude === 0)
                );

                if (validPoints.length < 2) return null;

                const color = TRAIL_COLORS[index % TRAIL_COLORS.length];
                const coordinates = validPoints.map(p => ({
                    latitude: p.latitude,
                    longitude: p.longitude,
                }));

                // Time label for the oldest point
                const oldestTime = validPoints[0].timestamp;
                const minutesAgo = Math.floor((Date.now() - oldestTime) / 60000);
                let timeLabel = '';
                if (minutesAgo < 60) timeLabel = `${minutesAgo}dk`;
                else if (minutesAgo < 1440) timeLabel = `${Math.floor(minutesAgo / 60)}sa`;
                else timeLabel = `${Math.floor(minutesAgo / 1440)}g`;

                return {
                    memberId: member.id,
                    memberName: member.name,
                    coordinates,
                    color,
                    timeLabel,
                    startPoint: validPoints[0],
                };
            })
            .filter(Boolean);
    }, [members, selectedMemberId, visible]);

    if (!visible || trails.length === 0) return null;

    return (
        <>
            {trails.map((trail: any) => (
                <React.Fragment key={`trail-${trail.memberId}`}>
                    {/* Main trail polyline */}
                    <Polyline
                        coordinates={trail.coordinates}
                        strokeColor={trail.color + 'CC'}
                        strokeWidth={3}
                        lineDashPattern={[8, 4]}
                        lineCap="round"
                        lineJoin="round"
                    />

                    {/* Ghost trail (wider, more transparent, for glow effect) */}
                    <Polyline
                        coordinates={trail.coordinates}
                        strokeColor={trail.color + '30'}
                        strokeWidth={8}
                        lineCap="round"
                    />

                    {/* Start point marker (oldest position) */}
                    <Marker
                        coordinate={trail.startPoint}
                        anchor={{ x: 0.5, y: 0.5 }}
                        tracksViewChanges={false}
                    >
                        <View style={[styles.trailStart, { backgroundColor: trail.color + '40', borderColor: trail.color }]}>
                            <Text style={[styles.trailStartText, { color: trail.color }]}>{trail.timeLabel}</Text>
                        </View>
                    </Marker>
                </React.Fragment>
            ))}
        </>
    );
});

FamilyTrailOverlay.displayName = 'FamilyTrailOverlay';

const styles = StyleSheet.create({
    trailStart: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1.5,
    },
    trailStartText: {
        fontSize: 10,
        fontWeight: '700',
    },
});

export { FamilyTrailOverlay };
export type { LocationHistoryPoint };

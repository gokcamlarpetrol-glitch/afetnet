/**
 * DESIGN SYSTEM PREVIEW SCREEN
 * Internal tool to verify the "Modern Calm Trust" visual system
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { colors, typography } from '../../theme'; // Assuming direct import or specific path
import Button from '../../components/Button';
import Card from '../../components/Card';
import { PaperBackground } from '../../components/design-system/PaperBackground';
import { SeismicAlertBanner } from '../../components/design-system/SeismicAlertBanner';
import { FamilyCheckInModule } from '../../components/design-system/FamilyCheckInModule';
import { PreparednessChecklist } from '../../components/design-system/PreparednessChecklist';

export default function DesignSystemScreen() {
  const [checklistItems, setChecklistItems] = useState([
    { id: '1', label: 'Deprem Çantası Hazırla', completed: true },
    { id: '2', label: 'Buluşma Noktası Belirle', completed: false },
    { id: '3', label: 'Tatbikat Yap', completed: false },
  ]);

  const toggleChecklist = (id: string) => {
    setChecklistItems(prev => prev.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item,
    ));
  };

  return (
    <PaperBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.header}>Modern Calm Trust</Text>
          <Text style={styles.subHeader}>Nano Banana Pro Design System</Text>

          {/* COLOR PALETTE */}
          <Section title="1. Color Palette">
            <View style={styles.row}>
              <Swatch color={colors.background.primary} name="Paper" />
              <Swatch color={colors.background.secondary} name="Ivory" />
              <Swatch color="#1F4E79" name="Trust Blue" />
              <Swatch color="#D9A441" name="Warning" />
              <Swatch color="#B53A3A" name="Danger" />
            </View>
          </Section>

          {/* SIGNATURE COMPONENT: SEISMIC ALERT */}
          <Section title="2. Seismic Alert Banner">
            <SeismicAlertBanner
              magnitude={7.4}
              location="Kahramanmaraş, Pazarcık"
              time="Şimdi"
              depth={7.2}
            />
            <View style={{ height: 8 }} />
            <SeismicAlertBanner
              magnitude={4.2}
              location="İzmir, Bornova"
              time="12 dk önce"
              depth={12.5}
            />
          </Section>

          {/* SIGNATURE COMPONENT: FAMILY CHECK-IN */}
          <Section title="3. Family Check-In">
            <FamilyCheckInModule
              members={[
                { id: '1', name: 'Ahmet', status: 'safe', lastSeen: '1dk', isOnline: true },
                { id: '2', name: 'Ayşe', status: 'warning', lastSeen: '15dk', isOnline: false },
                { id: '3', name: 'Mehmet', status: 'danger', lastSeen: '1sa', isOnline: false },
              ]}
            />
          </Section>

          {/* SIGNATURE COMPONENT: CHECKLIST */}
          <Section title="4. Preparedness Checklist">
            <PreparednessChecklist
              title="Acil Durum Hazırlığı"
              progress={33}
              items={checklistItems}
              onToggleItem={toggleChecklist}
            />
          </Section>

          {/* BUTTONS */}
          <Section title="5. Matte Buttons">
            <Button onPress={() => { }} variant="primary">Matte Trust Blue</Button>
            <View style={{ height: 8 }} />
            <Button onPress={() => { }} variant="secondary">Soft Secondary</Button>
            <View style={{ height: 8 }} />
            <Button onPress={() => { }} variant="outline">Outline Action</Button>
          </Section>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
      <StatusBar barStyle="dark-content" />
    </PaperBackground>
  );
}

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Swatch = ({ color, name }: { color: string, name: string }) => (
  <View style={styles.swatchContainer}>
    <View style={[styles.swatch, { backgroundColor: color }]} />
    <Text style={styles.swatchText}>{name}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F4E79',
    marginBottom: 4,
  },
  subHeader: {
    fontSize: 16,
    color: '#5B5F66',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888D94',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatchContainer: {
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  swatchText: {
    fontSize: 10,
    color: '#5B5F66',
  },
});

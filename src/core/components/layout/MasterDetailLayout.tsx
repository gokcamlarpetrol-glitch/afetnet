/**
 * MASTER-DETAIL LAYOUT
 *
 * iPad icin Master-Detail (split view) ortak komponenti.
 * Phone'da sadece master gosterir; tablet'te yan yana master + detail.
 *
 * Kullanim:
 *   <MasterDetailLayout
 *     master={<ContactList />}
 *     detail={<ChatPanel conversationId={selectedId} />}
 *     hasSelection={!!selectedId}
 *   />
 *
 * Phone'da `hasSelection=true` ise detail full-screen, master gizli.
 * Tablet'te ikisi yan yana her zaman.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useResponsive } from '../../utils/responsive';

interface MasterDetailLayoutProps {
  master: React.ReactNode;
  detail: React.ReactNode;
  /**
   * Telefonda gosterilen panel — true ise detail, false ise master.
   * Tablet'te ignore edilir (her ikisi de gosterilir).
   */
  hasSelection?: boolean;
  /** Master kolon genisligi (tablet, varsayilan 360). */
  masterWidth?: number;
  /** Master arka plan rengi. */
  masterBackgroundColor?: string;
  /** Detail arka plan rengi. */
  detailBackgroundColor?: string;
  /** Detail empty state (tablet'te hicbir secim yokken). */
  emptyDetail?: React.ReactNode;
}

export function MasterDetailLayout({
  master,
  detail,
  hasSelection = false,
  masterWidth = 360,
  masterBackgroundColor = '#FFFFFF',
  detailBackgroundColor = '#F5F7FA',
  emptyDetail,
}: MasterDetailLayoutProps) {
  const { isTablet } = useResponsive();

  if (!isTablet) {
    // Phone: tek panel — hasSelection true ise detail, degilse master
    return <View style={styles.fullPanel}>{hasSelection ? detail : master}</View>;
  }

  // Tablet: yan yana
  const masterStyle: ViewStyle = {
    width: masterWidth,
    backgroundColor: masterBackgroundColor,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.08)',
  };
  const detailStyle: ViewStyle = {
    flex: 1,
    backgroundColor: detailBackgroundColor,
  };

  return (
    <View style={styles.row}>
      <View style={[styles.panel, masterStyle]}>{master}</View>
      <View style={[styles.panel, detailStyle]}>
        {hasSelection ? detail : emptyDetail ?? detail}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullPanel: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  panel: { height: '100%' },
});

export default MasterDetailLayout;

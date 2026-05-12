/**
 * RESPONSIVE UTILITIES
 *
 * iPad ve diger buyuk ekranlar icin layout breakpoint'leri ve helper'lar.
 * Tum AfetNet ekranlari bu utility'i kullanarak iPad'de Master-Detail layout
 * veya 2/3 sutun grid'e gecebilir.
 *
 * Kullanim:
 *   const { isTablet, isLandscape } = useResponsive();
 *   if (isTablet) return <TwoColumnLayout />;
 *
 * Breakpoint'ler iOS/Android best practice'lerinden derlenmistir:
 *   - phone:       < 600dp width
 *   - smallTablet: 600-768dp width (kucuk tablet, 7-inch)
 *   - tablet:      768-1024dp width (iPad standard)
 *   - largeTablet: > 1024dp (iPad Pro 12.9", Surface)
 */

import { useWindowDimensions, Platform } from 'react-native';
import { useMemo } from 'react';

export type Breakpoint = 'phone' | 'smallTablet' | 'tablet' | 'largeTablet';

export interface ResponsiveInfo {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isPhone: boolean;
  isTablet: boolean;          // smallTablet | tablet | largeTablet
  isLargeTablet: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  /** iPad'de Master-Detail layout uygun mu? */
  shouldUseMasterDetail: boolean;
  /** 3-kolon layout uygun mu? (sadece largeTablet landscape) */
  shouldUseThreeColumn: boolean;
}

const BREAKPOINTS = {
  phone: 600,
  smallTablet: 768,
  tablet: 1024,
} as const;

/**
 * Hook: window dimensions'a gore responsive info.
 * Rotation'a otomatik tepki verir.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isLandscape = width > height;
    const isPortrait = !isLandscape;

    let breakpoint: Breakpoint = 'phone';
    if (width >= BREAKPOINTS.tablet) breakpoint = 'largeTablet';
    else if (width >= BREAKPOINTS.smallTablet) breakpoint = 'tablet';
    else if (width >= BREAKPOINTS.phone) breakpoint = 'smallTablet';

    const isTablet = breakpoint !== 'phone';
    const isLargeTablet = breakpoint === 'largeTablet';

    return {
      width,
      height,
      breakpoint,
      isPhone: breakpoint === 'phone',
      isTablet,
      isLargeTablet,
      isLandscape,
      isPortrait,
      shouldUseMasterDetail: isTablet,
      shouldUseThreeColumn: isLargeTablet && isLandscape,
    };
  }, [width, height]);
}

/**
 * Non-hook version — sadece imperatif kullanimlar icin.
 * useResponsive hook'undan farkli olarak, bu cagri an'a hari verir.
 */
export function getResponsiveInfo(): ResponsiveInfo {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Dimensions } = require('react-native');
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;

  let breakpoint: Breakpoint = 'phone';
  if (width >= BREAKPOINTS.tablet) breakpoint = 'largeTablet';
  else if (width >= BREAKPOINTS.smallTablet) breakpoint = 'tablet';
  else if (width >= BREAKPOINTS.phone) breakpoint = 'smallTablet';

  const isTablet = breakpoint !== 'phone';

  return {
    width,
    height,
    breakpoint,
    isPhone: breakpoint === 'phone',
    isTablet,
    isLargeTablet: breakpoint === 'largeTablet',
    isLandscape,
    isPortrait: !isLandscape,
    shouldUseMasterDetail: isTablet,
    shouldUseThreeColumn: breakpoint === 'largeTablet' && isLandscape,
  };
}

/**
 * Helper: stil degeri secimi (phone vs tablet).
 * Kullanim: `padding: pickByDevice(16, 32)` → phone:16, tablet:32
 */
export function pickByDevice<T>(phoneValue: T, tabletValue: T): T {
  return getResponsiveInfo().isTablet ? tabletValue : phoneValue;
}

/**
 * Helper: stil degeri secimi (4 breakpoint).
 */
export function pickByBreakpoint<T>(values: Partial<Record<Breakpoint, T>> & { phone: T }): T {
  const info = getResponsiveInfo();
  return (values[info.breakpoint] ?? values.phone) as T;
}

/**
 * Helper: Pixel-perfect scaling for iPad text/icons.
 * Phones: 1.0x | smallTablet: 1.1x | tablet: 1.15x | largeTablet: 1.25x
 */
export function scaleFontSize(baseSize: number): number {
  const info = getResponsiveInfo();
  switch (info.breakpoint) {
    case 'phone': return baseSize;
    case 'smallTablet': return Math.round(baseSize * 1.1);
    case 'tablet': return Math.round(baseSize * 1.15);
    case 'largeTablet': return Math.round(baseSize * 1.25);
  }
}

/**
 * iPad detection (Platform-agnostic — Android tabletler de dahil).
 */
export function isTabletDevice(): boolean {
  // Platform.isPad iOS-only ve sadece iPad. Android tabletler icin width fallback.
  if (Platform.OS === 'ios' && (Platform as { isPad?: boolean }).isPad) return true;
  return getResponsiveInfo().isTablet;
}

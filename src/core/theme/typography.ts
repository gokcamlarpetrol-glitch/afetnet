/**
 * TYPOGRAPHY SYSTEM - SF Pro / Inter Style
 * Professional, consistent, readable
 */

export const typography = {
  // Display (Hero text)
  display: {
    fontSize: 32,
    fontWeight: '900' as const,
    letterSpacing: -1,
    lineHeight: 38,
  },

  // Headings
  h1: {
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  h2: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  h4: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 20,
  },

  // Body text
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    letterSpacing: 0,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 18,
  },

  // Labels & Captions
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
    lineHeight: 14,
  },

  // Special
  mono: {
    fontSize: 13,
    fontFamily: 'SF Mono',
    letterSpacing: 0,
    lineHeight: 18,
  },

  // Button text
  button: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  buttonLarge: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: 1,
    lineHeight: 22,
  },
};

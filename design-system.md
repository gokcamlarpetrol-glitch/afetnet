# AfetNet Design System

## Brand Identity & Visual Guidelines

### Brand Mission
**"Hayatta Kal. Yardım Et."** (Stay Alive. Help Others.)

AfetNet's visual identity is inspired by emergency services design, emphasizing trust, safety, and clarity in crisis situations. The design system prioritizes accessibility, readability, and immediate recognition in high-stress environments.

---

## Color Palette

### Primary Colors
```css
/* Deep Red - Emergency/Urgent */
--primary-main: #C62828
--primary-light: #EF5350
--primary-dark: #B71C1C
--primary-contrast: #FFFFFF
```

### Secondary Colors
```css
/* Blue-Gray - Professional/Trustworthy */
--secondary-main: #263238
--secondary-light: #546E7A
--secondary-dark: #1C2833
--secondary-contrast: #FFFFFF
```

### Accent Colors
```css
/* Amber - Attention/Important */
--accent-main: #FFCA28
--accent-light: #FFF176
--accent-dark: #F57F17
--accent-contrast: #212121
```

### Background Colors
```css
--background-primary: #FAFAFA    /* Clean white */
--background-secondary: #F5F5F5  /* Light gray */
--background-tertiary: #EEEEEE   /* Medium gray */
--background-dark: #212121       /* Dark for offline mode */
```

### Text Colors
```css
--text-primary: #212121          /* High contrast */
--text-secondary: #757575        /* Medium gray */
--text-disabled: #BDBDBD         /* Light gray */
--text-on-primary: #FFFFFF
--text-on-secondary: #FFFFFF
--text-on-accent: #212121
--text-on-dark: #FFFFFF
```

### Status Colors
```css
--success-main: #388E3C
--warning-main: #F57C00
--error-main: #D32F2F
```

---

## Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Font Weights
- **Regular**: 400 (Body text)
- **Medium**: 500 (Captions, labels)
- **Semibold**: 600 (Headings, buttons)
- **Bold**: 700 (Critical alerts, emphasis)

### Font Sizes
```css
--text-xs: 12px     /* Small labels */
--text-sm: 14px     /* Captions */
--text-base: 16px   /* Body text (minimum) */
--text-lg: 18px     /* Large body */
--text-xl: 20px     /* Small headings */
--text-2xl: 24px    /* Medium headings */
--text-3xl: 30px    /* Large headings */
--text-4xl: 36px    /* Display headings */
--text-5xl: 48px    /* Hero text */
```

### Line Heights
```css
--leading-tight: 1.2    /* Headings */
--leading-normal: 1.4   /* Body text */
--leading-relaxed: 1.6  /* Long-form content */
--leading-loose: 1.8    /* Accessibility */
```

---

## Spacing System

### Spacing Scale
```css
--space-xs: 4px    /* Fine adjustments */
--space-sm: 8px    /* Small gaps */
--space-md: 12px   /* Medium gaps */
--space-lg: 16px   /* Standard padding */
--space-xl: 24px   /* Section spacing */
--space-2xl: 32px  /* Large sections */
--space-3xl: 48px  /* Page sections */
--space-4xl: 64px  /* Hero sections */
```

---

## Border Radius

### Radius Scale
```css
--radius-sm: 4px   /* Small elements */
--radius-md: 8px   /* Cards, inputs */
--radius-lg: 12px  /* Standard cards */
--radius-xl: 16px  /* Buttons */
--radius-2xl: 20px /* Large cards */
--radius-full: 9999px /* Pills, circles */
```

---

## Shadows

### Shadow System
```css
/* Small shadow - subtle elevation */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05)

/* Medium shadow - standard cards */
--shadow-md: 0 2px 4px rgba(0,0,0,0.1)

/* Large shadow - modals, sheets */
--shadow-lg: 0 4px 8px rgba(0,0,0,0.15)

/* Extra large shadow - hero elements */
--shadow-xl: 0 8px 16px rgba(0,0,0,0.2)
```

**Note**: Shadows are disabled in UltraBattery mode for performance.

---

## Component Guidelines

### Buttons

#### Primary Button
- **Background**: Primary red (#C62828)
- **Text**: White
- **Border Radius**: 16px (xl)
- **Padding**: 12px horizontal, 16px vertical
- **Min Height**: 48px
- **Shadow**: Medium shadow (disabled in UltraBattery)

#### Secondary Button
- **Background**: Blue-gray (#263238)
- **Text**: White
- **Same styling as primary**

#### Ghost Button
- **Background**: Transparent
- **Border**: Primary red
- **Text**: Primary red
- **No shadow**

#### Danger Button
- **Background**: Error red (#D32F2F)
- **Text**: White
- **Same styling as primary**

### Cards

#### Standard Card
- **Background**: White (#FAFAFA)
- **Border**: Light gray (#E0E0E0)
- **Border Radius**: 12px (lg)
- **Padding**: 16px (lg)
- **Shadow**: Small shadow

#### Priority Card
- **Same as standard**
- **Border**: Accent amber (#FFCA28)
- **Border Width**: 2px

### Status Banners

#### Critical Banner
- **Background**: Error red (#D32F2F)
- **Text**: White
- **Icon**: Warning icon
- **Border Radius**: 8px (md)

#### Info Banner
- **Background**: Blue-gray (#263238)
- **Text**: White
- **Icon**: Information icon

#### Success Banner
- **Background**: Success green (#388E3C)
- **Text**: White
- **Icon**: Checkmark icon

#### Warning Banner
- **Background**: Warning orange (#F57C00)
- **Text**: White
- **Icon**: Alert icon

---

## Emergency-Specific Design

### SOS Elements
- **Background**: Deep red (#B71C1C)
- **Text**: White, bold
- **Animation**: Pulse effect
- **Priority**: Highest visual hierarchy

### Critical Alerts
- **Background**: Error red (#D32F2F)
- **Text**: White, bold
- **Immediate attention required**

### Safe Status
- **Background**: Success green (#388E3C)
- **Text**: White
- **Reassuring, calm**

### Offline Mode
- **Background**: Dark (#212121)
- **Text**: White
- **Icons**: Amber outline (#FFCA28)
- **Subtle, non-intrusive**

---

## Accessibility Guidelines

### Color Contrast
- **Minimum Ratio**: 4.5:1 (WCAG AA)
- **Preferred Ratio**: 7:1 (WCAG AAA)
- **Text on Background**: Always meet minimum standards

### Touch Targets
- **Minimum Size**: 44x44px (iOS HIG)
- **Preferred Size**: 48x48px
- **Spacing**: Minimum 8px between targets

### Typography
- **Minimum Font Size**: 16px for body text
- **System Font Scale**: Respect user preferences
- **Line Height**: Minimum 1.4 for readability

### Color Independence
- **No Color-Only Information**: Use icons, text, or patterns
- **Status Indicators**: Multiple visual cues
- **Critical Information**: High contrast, multiple formats

---

## Animation Guidelines

### Duration
```css
--duration-fast: 150ms    /* Micro-interactions */
--duration-normal: 300ms  /* Standard transitions */
--duration-slow: 500ms    /* Complex animations */
```

### Easing
```css
--ease-ease: ease
--ease-in: ease-in
--ease-out: ease-out
--ease-in-out: ease-in-out
```

### Performance
- **UltraBattery Mode**: Disable all animations
- **Reduce Motion**: Respect system preference
- **GPU Acceleration**: Use transform and opacity
- **Frame Rate**: Maintain 60fps

---

## Responsive Design

### Breakpoints
```css
/* Mobile First */
--mobile: 320px
--mobile-lg: 414px
--tablet: 768px
--desktop: 1024px
```

### Grid System
- **Mobile**: Single column, full width
- **Tablet**: Two columns, 16px gutters
- **Desktop**: Three columns, 24px gutters

---

## Implementation Notes

### React Native Specifics
- **StyleSheet**: Use StyleSheet.create() for performance
- **Flexbox**: Primary layout system
- **SafeAreaView**: Respect device safe areas
- **Platform**: iOS/Android specific adjustments

### Performance Considerations
- **Shadow Disabled**: In UltraBattery mode
- **Animation Disabled**: In UltraBattery mode
- **Image Optimization**: Use appropriate formats
- **Bundle Size**: Minimize unused styles

### Testing Checklist
- [ ] All colors meet contrast requirements
- [ ] Touch targets are minimum 44px
- [ ] Text scales with system preferences
- [ ] Works in UltraBattery mode
- [ ] Respects reduced motion settings
- [ ] Accessible to screen readers
- [ ] Consistent across iOS/Android

---

## Brand Assets

### Logo Usage
- **Minimum Size**: 24px height
- **Clear Space**: 1x logo height on all sides
- **Background**: Never place on busy backgrounds
- **Colors**: Primary red or white only

### App Icon
- **Heartbeat "A"**: Core brand symbol
- **Background**: Primary red gradient
- **Format**: SVG source, PNG exports
- **Sizes**: All required platform sizes

### Splash Screen
- **Background**: Red to blue-gray gradient
- **Logo**: Centered, white
- **Text**: "AfetNet" + "Hayatta Kal. Yardım Et."
- **Loading**: Subtle animated dots

This design system ensures AfetNet maintains visual consistency while prioritizing usability in emergency situations.

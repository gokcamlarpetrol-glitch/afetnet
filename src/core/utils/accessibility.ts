/**
 * ELITE: ACCESSIBILITY UTILITIES
 * Centralized accessibility helpers for consistent implementation
 */

/**
 * Generate accessibility label for buttons
 */
export function getAccessibilityLabel(text: string, context?: string): string {
  if (context) {
    return `${text} - ${context}`;
  }
  return text;
}

/**
 * Generate accessibility hint for buttons
 */
export function getAccessibilityHint(action: string, disabled?: boolean): string {
  if (disabled) {
    return 'Bu buton şu anda devre dışı';
  }
  return `${action} için basın`;
}

/**
 * Standard accessibility props for buttons
 */
export function getButtonAccessibilityProps(
  label: string,
  hint?: string,
  disabled?: boolean,
): {
  accessibilityRole: 'button';
  accessibilityLabel: string;
  accessibilityHint: string;
  accessibilityState: { disabled: boolean };
} {
  return {
    accessibilityRole: 'button',
    accessibilityLabel: label,
    accessibilityHint: hint || getAccessibilityHint(label, disabled),
    accessibilityState: { disabled: disabled || false },
  };
}

/**
 * Standard accessibility props for text inputs
 */
export function getInputAccessibilityProps(
  label: string,
  hint?: string,
  required?: boolean,
): {
  accessibilityRole: 'text';
  accessibilityLabel: string;
  accessibilityHint: string;
  accessibilityRequired: boolean;
} {
  return {
    accessibilityRole: 'text',
    accessibilityLabel: label,
    accessibilityHint: hint || `${label} alanına metin girin`,
    accessibilityRequired: required || false,
  };
}

/**
 * Standard accessibility props for images
 */
export function getImageAccessibilityProps(
  description: string,
  decorative?: boolean,
): {
  accessibilityRole: 'image';
  accessibilityLabel: string | undefined;
} {
  return {
    accessibilityRole: 'image',
    accessibilityLabel: decorative ? undefined : description,
  };
}


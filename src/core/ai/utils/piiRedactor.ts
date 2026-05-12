/**
 * Redacts personally identifiable information from text before sending to AI services.
 * Patterns are focused on Turkish PII formats.
 */

export function redactPII(text: string): string {
  if (!text) return text;
  let redacted = text;

  // TC Kimlik No (11 digits starting with non-zero)
  redacted = redacted.replace(/\b[1-9]\d{10}\b/g, '[TC_KIMLIK]');

  // Turkish phone numbers (05XX XXX XXXX, +90 5XX...)
  redacted = redacted.replace(
    /(?:\+90|0090|0)[\s.-]?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g,
    '[TELEFON]'
  );

  // Email addresses
  redacted = redacted.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL]'
  );

  // IBAN (Turkish)
  redacted = redacted.replace(
    /TR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}/gi,
    '[IBAN]'
  );

  // Credit card (16 digits in groups)
  redacted = redacted.replace(
    /\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b/g,
    '[KART_NO]'
  );

  // Turkish address patterns (Mah/Cad/Sok + No)
  redacted = redacted.replace(
    /\b\w+\s+(?:Mah(?:allesi)?|Cad(?:desi)?|Sok(?:ak)?|Bulvar[ıi]?)\s*[.,]?\s*(?:No|No\.?)\s*:?\s*\d+/gi,
    '[ADRES]'
  );

  return redacted;
}

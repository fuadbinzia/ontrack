import {
  asOneOf,
  formatNumericInput,
  numericOnChangeText,
  parseFiniteNumber,
  parsePositiveNumber,
  sanitizeNumericInput,
} from '@/utils/parse';

describe('sanitizeNumericInput', () => {
  it('strips letters from decimal input', () => {
    expect(sanitizeNumericInput('123.24firiffrfi')).toBe('123.24');
    expect(sanitizeNumericInput('12a3.4b5')).toBe('123.45');
  });

  it('keeps commas and a single decimal point', () => {
    expect(sanitizeNumericInput('12,323.75')).toBe('12,323.75');
    expect(sanitizeNumericInput('1.2.3')).toBe('1.23');
  });

  it('supports integers only', () => {
    expect(sanitizeNumericInput('12a3.45', { decimals: false })).toBe('12345');
    expect(
      sanitizeNumericInput('1,234', { decimals: false, allowComma: false }),
    ).toBe('1234');
  });

  it('adds thousands separators without losing a partial decimal value', () => {
    expect(formatNumericInput('1065.32')).toBe('1,065.32');
    expect(formatNumericInput('1234567.')).toBe('1,234,567.');
    expect(formatNumericInput('001065', { decimals: false })).toBe('1,065');
  });

  it('wraps onChangeText', () => {
    const received: string[] = [];
    const onChange = numericOnChangeText((text) => received.push(text));
    onChange?.('9x9.1abc');
    expect(received).toEqual(['99.1']);
  });
});

describe('parseFiniteNumber', () => {
  it('parses decimals and comma separators', () => {
    expect(parseFiniteNumber('12,5')).toBe(12.5);
    expect(parseFiniteNumber(' 8 ')).toBe(8);
    expect(parseFiniteNumber('')).toBeUndefined();
    expect(parsePositiveNumber('0')).toBeUndefined();
    expect(parsePositiveNumber('4.2')).toBe(4.2);
  });

  it('picks allowed enum values', () => {
    expect(asOneOf('bank', ['bank', 'card'] as const)).toBe('bank');
    expect(asOneOf('nope', ['bank', 'card'] as const)).toBeUndefined();
  });
});

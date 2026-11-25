import { describe, expect, it } from 'vitest';
import {
  parseLira,
  parsePayoutRule,
  parsePercent,
  parsePriceList,
  parseSetting,
} from '../src/forms';

describe('form values', () => {
  it('reads lira as people write it', () => {
    expect(parseLira('12.500,00')).toBe(1_250_000);
    expect(parseLira('12,500.00')).toBe(1_250_000);
    expect(parseLira('₺ 1.000')).toBe(100_000);
    expect(parseLira('12500')).toBe(1_250_000);
    expect(parseLira('99,9')).toBe(9_990);
    expect(parseLira('0.01')).toBe(1);
    expect(parseLira('1,2,3')).toBeNull();
    expect(parseLira('-5')).toBeNull();
    expect(parseLira('')).toBeNull();
  });

  it('reads percentages as basis points', () => {
    expect(parsePercent('20')).toBe(2000);
    expect(parsePercent('1,5')).toBe(150);
    expect(parsePercent('7.25 %')).toBe(725);
    expect(parsePercent('100')).toBe(10_000);
    expect(parsePercent('101')).toBeNull();
    expect(parsePercent('x')).toBeNull();
  });

  it('reads settings in their units', () => {
    expect(parseSetting('claim_hours', '24')).toBe(24);
    expect(parseSetting('claim_hours', '0')).toBeNull();
    expect(parseSetting('max_active_claims', '0')).toBe(0);
    expect(parseSetting('kdv_bp', '20')).toBe(2000);
    expect(parseSetting('dual_approval_kurus', '25.000')).toBe(2_500_000);
    expect(parseSetting('cooldown_hours', '1.5')).toBeNull();
  });

  it('reads a price list', () => {
    expect(parsePriceList('10000', '* ; * ; 2015 ; ; 9000\n\nFiat;Egea;;2019;8000')).toEqual({
      ok: true,
      value: {
        default_kurus: 1_000_000,
        rules: [
          { fee_kurus: 900_000, year_from: 2015 },
          { fee_kurus: 800_000, make: 'Fiat', model: 'Egea', year_to: 2019 },
        ],
      },
    });
    expect(parsePriceList('0', '').ok).toBe(false);
    expect(parsePriceList('10000', 'Fiat;Egea;2020;2019;8000')).toEqual({
      ok: false,
      error: 'Line 1 isn’t Make;Model;From;To;Fee.',
    });
    expect(parsePriceList('10000', 'Fiat;Egea;20;;8000').ok).toBe(false);
  });

  it('reads a payout rule', () => {
    expect(parsePayoutRule({ share: '50', fixed: '', min: '', max: '' })).toEqual({
      ok: true,
      value: { share_bp: 5000 },
    });
    expect(parsePayoutRule({ share: '', fixed: '5.000', min: '', max: '' })).toEqual({
      ok: true,
      value: { fixed_kurus: 500_000 },
    });
    expect(parsePayoutRule({ share: '', fixed: '', min: '', max: '' }).ok).toBe(false);
    expect(parsePayoutRule({ share: '50', fixed: '', min: '9000', max: '100' }).ok).toBe(false);
  });
});

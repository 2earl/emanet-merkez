import type { PayoutRule, PriceList, PriceRule, Settings } from './core';
import { SETTING_UNITS } from './settings-text';

/** What staff type into forms, read into the core's units: kuruş and basis points. */

/** "12.500,00", "12500", "12500.5", "₺ 1.000" → kuruş; null if it isn't an amount. */
export function parseLira(value: string): number | null {
  let v = value.trim().replace(/\s|₺|TL$/gi, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v) || /^\d+,\d{1,2}$/.test(v)) {
    v = v.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(v)) {
    v = v.replace(/,/g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const kurus = Math.round(Number(v) * 100);
  return Number.isSafeInteger(kurus) ? kurus : null;
}

/** "20", "20,5", "7.5" percent → basis points (2000, 2050, 750); null if not 0–100. */
export function parsePercent(value: string): number | null {
  const v = value.trim().replace('%', '').replace(',', '.').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return null;
  const bp = Math.round(Number(v) * 100);
  return bp <= 10_000 ? bp : null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * The price list form: a default fee and one rule per line, "Make;Model;From;To;Fee", where * is
 * any make or model and an empty year is any year.
 */
export function parsePriceList(defaultFee: string, rules: string): Parsed<PriceList> {
  const fallback = parseLira(defaultFee);
  if (fallback === null || fallback === 0)
    return { ok: false, error: 'The default fee isn’t an amount.' };
  const out: PriceRule[] = [];
  const lines = rules
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const [index, line] of lines.entries()) {
    const parts = line.split(';').map((p) => p.trim());
    const [make = '', model = '', from = '', to = '', fee = ''] = parts;
    const bad = {
      ok: false as const,
      error: `Line ${String(index + 1)} isn’t Make;Model;From;To;Fee.`,
    };
    if (parts.length !== 5) return bad;
    const kurus = parseLira(fee);
    if (kurus === null || kurus === 0) return bad;
    const year = (y: string) => (y === '' ? undefined : /^\d{4}$/.test(y) ? Number(y) : NaN);
    const yearFrom = year(from);
    const yearTo = year(to);
    if (Number.isNaN(yearFrom) || Number.isNaN(yearTo)) return bad;
    if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) return bad;
    const rule: PriceRule = { fee_kurus: kurus };
    if (make && make !== '*') rule.make = make;
    if (model && model !== '*') rule.model = model;
    if (yearFrom !== undefined) rule.year_from = yearFrom;
    if (yearTo !== undefined) rule.year_to = yearTo;
    out.push(rule);
  }
  return { ok: true, value: { default_kurus: fallback, rules: out } };
}

/** One setting as typed in its unit (hours, a count, percent, lira, on or off) → the stored integer. */
export function parseSetting(key: keyof Settings, value: string): number | null {
  const unit = SETTING_UNITS[key];
  if (unit === 'bp') return parsePercent(value);
  if (unit === 'kurus') return parseLira(value);
  const v = value.trim();
  if (unit === 'switch') return v === '1' ? 1 : v === '0' ? 0 : null;
  if (!/^\d{1,5}$/.test(v)) return null;
  const n = Number(v);
  return (unit === 'hours' || unit === 'days' || unit === 'minutes') && n === 0 ? null : n;
}

/** The payout rule form: a share or a fixed amount, with optional bounds. */
export function parsePayoutRule(form: {
  share: string;
  fixed: string;
  min: string;
  max: string;
}): Parsed<PayoutRule> {
  const share = form.share.trim();
  const fixed = form.fixed.trim();
  if ((share === '') === (fixed === '')) {
    return { ok: false, error: 'Fill in a share or a fixed amount, not both.' };
  }
  const rule: PayoutRule = {};
  if (share) {
    const bp = parsePercent(share);
    if (bp === null) return { ok: false, error: 'The share isn’t a percentage.' };
    rule.share_bp = bp;
  } else {
    const kurus = parseLira(fixed);
    if (kurus === null) return { ok: false, error: 'The fixed amount isn’t an amount.' };
    rule.fixed_kurus = kurus;
  }
  for (const [key, raw] of [
    ['min_kurus', form.min],
    ['max_kurus', form.max],
  ] as const) {
    if (raw.trim() === '') continue;
    const kurus = parseLira(raw);
    if (kurus === null) return { ok: false, error: 'A bound isn’t an amount.' };
    rule[key] = kurus;
  }
  if (
    rule.min_kurus !== undefined &&
    rule.max_kurus !== undefined &&
    rule.min_kurus > rule.max_kurus
  ) {
    return { ok: false, error: 'The lower bound is above the upper bound.' };
  }
  return { ok: true, value: rule };
}

import { Transform } from 'class-transformer';

/**
 * Trim strings; an empty string becomes null, so a cleared form field clears
 * the column. (Omitted fields stay undefined = "don't change".)
 */
export const Trim = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    return v === '' ? null : v;
  });

/** Trim + collapse spaces + upper-case: "tn 38  ab 1234" → "TN 38 AB 1234". */
export const Upper = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.trim().replace(/\s+/g, ' ').toUpperCase();
    return v === '' ? null : v;
  });

/** Number from JSON/string; null or "" stays null (unlike @Type(() => Number), which gives 0). */
export const ToNumber = () =>
  Transform(({ value }) => {
    if (value === null || value === '') return null;
    if (value === undefined) return undefined;
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  });

export const MOBILE_RE = /^[0-9+ -]{7,15}$/;

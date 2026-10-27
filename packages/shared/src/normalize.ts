/** Digits only. */
export function digits(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

/**
 * Cédula number only (no type). Strips leading zeros.
 * V-012.345.678 and E12345678 → "12345678"
 */
export function normalizeCedulaNumero(raw: unknown): string {
  const d = digits(raw).replace(/^0+/, '');
  return d;
}

/**
 * Venezuelan mobile → 11 digits starting with 0.
 * +58 412-555-4821 / 584125554821 / 0412 555 4821 → "04125554821"
 */
export function normalizeTelefono(raw: unknown): string {
  let d = digits(raw);
  if (d.startsWith('58') && d.length === 12) d = `0${d.slice(2)}`;
  if (d.length === 10 && d.startsWith('4')) d = `0${d}`;
  return d;
}

/** Lowercase + collapse spaces for laboratorio uniqueness counting. */
export function normalizeLaboratorioKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function maskName(full: string): string {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts[0]) return '';
  if (parts.length === 1) return parts[0];
  const initial = parts[1]!.charAt(0).toUpperCase();
  return `${parts[0]} ${initial}.`;
}

export function maskCedula(numero: string): string {
  const d = digits(numero);
  return `C.I. terminada en ${d.slice(-4)}`;
}

export function formatCedula(tipo: string, numero: string): string {
  const n = digits(numero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${tipo || 'V'}-${n}`;
}

export function formatPhone(tel: string): string {
  const d = digits(tel);
  if (d.length !== 11) return d;
  return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
}

export function formatTicket(n: number | string): string {
  return String(n).padStart(4, '0');
}

export function csvEscape(v: unknown): string {
  let s = String(v ?? '');
  // Neutralize spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

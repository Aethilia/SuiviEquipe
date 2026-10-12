import type ExcelJS from 'exceljs';

export const COLORS = {
  accent: 'FF0F766E',
  dark: 'FF0B3B37',
  totalRow: 'FFE3F2EF',
  sunday: 'FFFCEBD6',
  sundayHead: 'FFB86A00',
  holiday: 'FFF9D8D6',
  holidayHead: 'FFB03A2E',
  head: 'FFDDF1EE',
  border: 'FFDCE7E4',
};

export const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
export const thin = { style: 'thin' as const, color: { argb: COLORS.border } };
export const box: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };
export const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };

export const argb = (hex: string): string => 'FF' + hex.replace('#', '').toUpperCase();

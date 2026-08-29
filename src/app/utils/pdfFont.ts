import type { jsPDF } from 'jspdf';
import notoSansUrl from '../../assets/fonts/NotoSans-Regular.ttf?url';

let cachedFontBase64: string | null = null;

const getFontBase64 = async (): Promise<string> => {
  if (cachedFontBase64) return cachedFontBase64;

  const response = await fetch(notoSansUrl);

  if (!response.ok) {
    throw new Error('Failed to load Noto Sans font.');
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  cachedFontBase64 = btoa(binary);
  return cachedFontBase64;
};

export const setupPdfPesoFont = async (doc: jsPDF): Promise<void> => {
  const base64 = await getFontBase64();

  doc.addFileToVFS('NotoSans-Regular.ttf', base64);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.setFont('NotoSans', 'normal');
};

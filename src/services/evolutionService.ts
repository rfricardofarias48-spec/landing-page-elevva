/**
 * Evolution API Service
 * Handles all communication with the Evolution API (WhatsApp gateway).
 */

const BASE_URL = (process.env.EVOLUTION_API_URL || 'https://bot-evolution-api.5mljrq.easypanel.host').replace(/\/$/, '');
const API_KEY  = process.env.EVOLUTION_API_KEY || '';

export interface ListRow {
  title: string;
  description?: string;
  rowId: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

/** Strip @s.whatsapp.net and similar suffixes from a JID */
export function cleanPhone(rawJid: string): string {
  return rawJid.replace(/@.*$/, '');
}

async function post(path: string, body: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[Evolution] ${path} → HTTP ${res.status}: ${text}`);
    }
    return res.json().catch(() => null);
  } catch (err) {
    console.error(`[Evolution] fetch error on ${path}:`, err);
    return null;
  }
}

/** Send a plain text message */
export async function sendText(instance: string, jid: string, text: string, linkPreview = true): Promise<void> {
  const phone = cleanPhone(jid);
  console.log(`[Evolution] sendText → instance: ${instance}, phone: ${phone}, text length: ${text.length}`);
  await post(`/message/sendText/${instance}`, { number: phone, text, linkPreview });
}

/** Send an interactive list message (renders as a tappable menu on WhatsApp) */
export async function sendList(
  instance: string,
  jid: string,
  title: string,
  description: string,
  buttonText: string,
  sections: ListSection[],
): Promise<void> {
  await post(`/message/sendList/${instance}`, {
    number: cleanPhone(jid),
    title,
    description,
    buttonText,
    footerText: 'Elevva · Recrutamento com IA',
    sections,
  });
}

/** Download a media file and return its base64 content */
export async function downloadMediaBase64(
  instance: string,
  messageData: { key: Record<string, unknown>; message: Record<string, unknown> },
): Promise<{ base64: string; mimetype: string } | null> {
  const result = await post(`/chat/getBase64FromMediaMessage/${instance}`, {
    message: messageData,
    convertToMp4: false,
  }) as { base64?: string; mimetype?: string } | null;

  if (!result?.base64) return null;
  return { base64: result.base64, mimetype: result.mimetype || 'application/pdf' };
}

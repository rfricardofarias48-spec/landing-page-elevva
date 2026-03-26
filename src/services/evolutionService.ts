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

/** Sanitize fileName fields deep inside a message object to prevent API failures with special chars */
function sanitizeMessageFileNames(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMessageFileNames);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === 'fileName' && typeof v === 'string') {
      // Replace problematic chars but keep extension
      result[k] = v
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
    } else {
      result[k] = sanitizeMessageFileNames(v);
    }
  }
  return result;
}

/** Download a media file and return its base64 content */
export async function downloadMediaBase64(
  instance: string,
  messageData: { key: Record<string, unknown>; message: Record<string, unknown> },
): Promise<{ base64: string; mimetype: string } | null> {
  // Sanitize fileNames in the message payload to avoid API issues with special characters
  const sanitizedData = sanitizeMessageFileNames(messageData) as typeof messageData;

  const result = await post(`/chat/getBase64FromMediaMessage/${instance}`, {
    message: sanitizedData,
    convertToMp4: false,
  }) as { base64?: string; mimetype?: string } | null;

  if (!result?.base64) {
    // Retry with original payload in case sanitization caused a mismatch
    console.log('[Evolution] Retrying getBase64FromMediaMessage with original payload...');
    const retryResult = await post(`/chat/getBase64FromMediaMessage/${instance}`, {
      message: messageData,
      convertToMp4: false,
    }) as { base64?: string; mimetype?: string } | null;
    if (!retryResult?.base64) return null;
    return { base64: retryResult.base64, mimetype: retryResult.mimetype || 'application/pdf' };
  }
  return { base64: result.base64, mimetype: result.mimetype || 'application/pdf' };
}

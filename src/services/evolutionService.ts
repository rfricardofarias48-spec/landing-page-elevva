/**
 * Evolution API Service
 * Handles communication with Evolution GO (WhatsApp gateway).
 *
 * Evolution GO uses instance tokens for auth and flat endpoints (e.g. /send/text).
 * Instance tokens are resolved via EVOLUTION_INSTANCE_TOKENS env var:
 *   EVOLUTION_INSTANCE_TOKENS=InstanceA:token1,InstanceB:token2
 */

const BASE_URL = (process.env.EVOLUTION_API_URL || 'https://api.elevva.net.br').replace(/\/$/, '');
const API_KEY  = process.env.EVOLUTION_API_KEY || '';

// Parse instance tokens: "BentoSDR:token1,OtherInstance:token2"
const INSTANCE_TOKENS: Record<string, string> = {};
(process.env.EVOLUTION_INSTANCE_TOKENS || '').split(',').forEach(pair => {
  const [name, token] = pair.split(':');
  if (name && token) INSTANCE_TOKENS[name.trim()] = token.trim();
});

/** Get the API key for an instance (instance token if available, else global key) */
function getApiKey(instance: string): string {
  return INSTANCE_TOKENS[instance] || API_KEY;
}

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

async function post(path: string, body: Record<string, unknown>, apiKey?: string): Promise<unknown> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey || API_KEY },
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

/** Send a plain text message (Evolution GO: POST /send/text) */
export async function sendText(instance: string, jid: string, text: string): Promise<void> {
  const phone = cleanPhone(jid);
  console.log(`[Evolution] sendText → instance: ${instance}, phone: ${phone}, text length: ${text.length}`);
  await post('/send/text', { number: phone, text }, getApiKey(instance));
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
  await post('/send/text', {
    number: cleanPhone(jid),
    text: `${title}\n\n${description}\n\n${sections.map(s => s.rows.map(r => `• ${r.title}`).join('\n')).join('\n')}`,
  }, getApiKey(instance));
}

/** Sanitize fileName fields deep inside a message object to prevent API failures with special chars */
function sanitizeMessageFileNames(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMessageFileNames);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === 'fileName' && typeof v === 'string') {
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
  const sanitizedData = sanitizeMessageFileNames(messageData) as typeof messageData;
  const key = getApiKey(instance);

  const result = await post(`/message/downloadimage`, {
    message: sanitizedData,
    convertToMp4: false,
  }, key) as { base64?: string; mimetype?: string } | null;

  if (!result?.base64) return null;
  return { base64: result.base64, mimetype: result.mimetype || 'application/pdf' };
}

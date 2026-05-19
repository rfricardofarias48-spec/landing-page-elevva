/**
 * Mem0 Service — Elevva
 * Memória persistente por candidato, por recrutador.
 * user_id: "{recruiterId}:{candidatePhone}"
 */

const MEM0_URL = (process.env.MEM0_API_URL || '').replace(/\/$/, '');
const MEM0_KEY = process.env.MEM0_API_KEY || '';

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(MEM0_KEY ? { Authorization: `Bearer ${MEM0_KEY}` } : {}),
  };
}

/** Busca memórias relevantes de um candidato para uma mensagem */
export async function searchMemory(
  userId: string,
  query: string,
  limit = 5,
): Promise<string[]> {
  if (!MEM0_URL) return [];
  try {
    const res = await fetch(`${MEM0_URL}/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ query, filters: { user_id: userId }, limit }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<{ memory: string }> };
    return (data.results || []).map(r => r.memory);
  } catch {
    return [];
  }
}

/** Adiciona ou atualiza memórias de um candidato */
export async function addMemory(
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<void> {
  if (!MEM0_URL) return;
  try {
    await fetch(`${MEM0_URL}/memories`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ messages, user_id: userId }),
    });
  } catch { /* best-effort */ }
}

/** Retorna todas as memórias de um candidato */
export async function getMemories(userId: string): Promise<string[]> {
  if (!MEM0_URL) return [];
  try {
    const res = await fetch(
      `${MEM0_URL}/memories?user_id=${encodeURIComponent(userId)}`,
      { headers: headers() },
    );
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<{ memory: string }> };
    return (data.results || []).map(r => r.memory);
  } catch {
    return [];
  }
}

/** Apaga todas as memórias de um candidato (reset de conversa) */
export async function deleteMemories(userId: string): Promise<boolean> {
  if (!MEM0_URL) {
    console.warn('[Mem0] MEM0_API_URL não configurado — deleteMemories ignorado');
    return true;
  }
  try {
    // Tenta DELETE /users/{userId}/memories (Mem0 v2 bulk delete)
    const bulkRes = await fetch(`${MEM0_URL}/users/${encodeURIComponent(userId)}/memories`, {
      method: 'DELETE',
      headers: headers(),
    });
    console.log(`[Mem0] DELETE /users bulk userId=${userId} status=${bulkRes.status}`);
    if (bulkRes.ok) return true;

    // Fallback: busca todos os IDs e deleta um a um
    const listRes = await fetch(
      `${MEM0_URL}/memories?user_id=${encodeURIComponent(userId)}&limit=100`,
      { headers: headers() },
    );
    if (!listRes.ok) {
      console.warn(`[Mem0] list memories falhou userId=${userId} status=${listRes.status}`);
      return false;
    }

    const data = await listRes.json() as { results?: Array<{ id: string }> };
    const ids = (data.results || []).map(r => r.id);
    console.log(`[Mem0] fallback: found ${ids.length} memories for userId=${userId}`);
    if (!ids.length) return true;

    const results = await Promise.all(ids.map(id =>
      fetch(`${MEM0_URL}/memories/${id}`, { method: 'DELETE', headers: headers() })
        .then(r => ({ id, ok: r.ok, status: r.status }))
        .catch(e => ({ id, ok: false, status: 0, error: String(e) })),
    ));
    const failed = results.filter(r => !r.ok);
    if (failed.length) console.warn(`[Mem0] ${failed.length}/${ids.length} deletions failed:`, failed);
    else console.log(`[Mem0] deleted ${ids.length} memories for userId=${userId}`);
    return failed.length === 0;
  } catch (err) {
    console.error('[Mem0] deleteMemories error:', err);
    return false;
  }
}

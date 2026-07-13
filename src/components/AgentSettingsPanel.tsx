import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, MessageCircle, Bot, RefreshCw, Loader2, ExternalLink, Save, CheckCircle2, Edit3 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const CHATWOOT_BASE_URL = (import.meta.env.VITE_CHATWOOT_URL || 'https://bot-chatwoot.5mljrq.easypanel.host').replace(/\/$/, '');

interface Props {
  userId?: string;
  evolutionInstance?: string;
  chatwootAccountId?: number;
}

// Painel único de "infraestrutura do agente" — substitui o que antes vivia
// espalhado no painel Admin (Chips WhatsApp + Controle Agente). Como só existe
// 1 número/instância nesta conta, não há mais pool de chips: é conexão ligada/
// desligada + QR pra reconectar quando cair.
export const AgentSettingsPanel: React.FC<Props> = ({ userId, evolutionInstance, chatwootAccountId }) => {
  const adminFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(input, {
      ...init,
      headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  };

  // ── WhatsApp / Evolution ──────────────────────────────────────────────
  const [connLoading, setConnLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const fetchStatus = async () => {
    if (!userId) return;
    try {
      const res = await adminFetch(`/api/admin/qr-status/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setConnected(!!data.connected);
        if (data.connected) { setQrCode(''); stopPolling(); }
        else if (data.qrCode) setQrCode(data.qrCode);
      }
    } catch { /* silencioso */ } finally { setConnLoading(false); }
  };

  const refreshQr = async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const res = await adminFetch(`/api/admin/qr-code/${userId}`);
      const data = await res.json();
      if (data.qrCode) setQrCode(data.qrCode);
      stopPolling();
      pollRef.current = setInterval(fetchStatus, 4000);
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 10000);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Personalidade do agente (prompt de atendimento) ──────────────────
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [promptLoading, setPromptLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/system-prompt/attendance');
        const data = await res.json();
        setPrompt(data.prompt || '');
        setDraft(data.prompt || '');
      } catch { /* silencioso */ } finally { setPromptLoading(false); }
    })();
  }, []);

  const savePrompt = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/system-prompt/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: draft }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      setPrompt(draft);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">

      {/* WhatsApp / Evolution */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-[0px_4px_20px_rgba(0,0,0,0.02)]">
        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 tracking-tighter">
          <Smartphone className="w-5 h-5 text-slate-400" /> WhatsApp do Agente
        </h3>

        {!userId ? (
          <p className="text-sm text-slate-400 font-medium">Carregando conta...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                {connLoading ? (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                ) : (
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                )}
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {connLoading ? 'Verificando conexão...' : connected ? 'Conectado' : 'Desconectado'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">{evolutionInstance || '—'}</p>
                </div>
              </div>
              <button
                onClick={refreshQr}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white hover:border-slate-300 transition-all disabled:opacity-50"
              >
                {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {connected ? 'Verificar novamente' : 'Gerar QR Code'}
              </button>
            </div>

            {!connected && qrCode && (
              <div className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <img src={qrCode} alt="QR Code WhatsApp" className="w-52 h-52 rounded-2xl border border-slate-200 bg-white" />
                <p className="text-[11px] text-slate-400 font-medium text-center max-w-xs">
                  Abra o WhatsApp no celular do agente → Aparelhos conectados → Conectar um aparelho, e escaneie o código.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chatwoot */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-[0px_4px_20px_rgba(0,0,0,0.02)]">
        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 tracking-tighter">
          <MessageCircle className="w-5 h-5 text-slate-400" /> Chatwoot
        </h3>
        {chatwootAccountId ? (
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-sm font-bold text-slate-900">Painel de conversas conectado</p>
            </div>
            <a
              href={`${CHATWOOT_BASE_URL}/app/accounts/${chatwootAccountId}/conversations`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#65a30d] hover:bg-[#4d7c0f] text-white text-xs font-bold transition-all"
            >
              Abrir Chatwoot <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-400 font-medium">Chatwoot ainda não configurado para esta conta.</p>
        )}
      </div>

      {/* Personalidade do agente */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-[0px_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-tighter">
            <Bot className="w-5 h-5 text-slate-400" /> Personalidade do Bento
          </h3>
          {!editing && !promptLoading && (
            <button
              onClick={() => { setDraft(prompt); setEditing(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
          )}
        </div>

        {promptLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={12}
              placeholder="Descreva como o Bento deve se comportar, que tom usar, como responder situações específicas..."
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#65a30d]/20 focus:border-[#65a30d] resize-none"
            />
            {saveError && <p className="text-xs text-red-500 font-bold">{saveError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setEditing(false); setSaveError(''); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={savePrompt}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-[#84cc16]" />} Salvar
              </button>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3 min-h-[100px] font-sans">
            {prompt || 'Nenhuma instrução personalizada definida — o Bento usa o comportamento padrão.'}
          </pre>
        )}
      </div>
    </div>
  );
};

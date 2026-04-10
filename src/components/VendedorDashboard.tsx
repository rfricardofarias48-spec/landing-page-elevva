import React, { useState, useEffect } from 'react';
import {
  DollarSign, Link, Users, TrendingUp, Copy, Check,
  Plus, ChevronDown, Loader2, LogOut, ArrowUpRight,
  Clock, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Sale {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  plan: string;
  amount: number;
  commission_amount: number;
  asaas_link_url: string | null;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  onboarding_status: string;
  paid_at: string | null;
  created_at: string;
}

interface Salesperson {
  id: string;
  name: string;
  email: string;
  commission_pct: number;
  asaas_wallet_id: string | null;
  total_commission: number;
  pending_commission: number;
  paid_sales: number;
  pending_sales: number;
}

const PLAN_LABELS: Record<string, string> = {
  ESSENCIAL: 'Essencial',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

const PLAN_PRICES: Record<string, number> = {
  ESSENCIAL:       649.90,
  ESSENCIAL_ANUAL: 6230.40,
  PRO:             999.90,
  PRO_ANUAL:       9599.04,
  ENTERPRISE:      0,
};

const STATUS_CONFIG = {
  pending:   { label: 'Aguardando',   color: 'bg-amber-100 text-amber-700',   icon: Clock },
  paid:      { label: 'Pago',         color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado',    color: 'bg-red-100 text-red-700',       icon: XCircle },
  refunded:  { label: 'Reembolsado',  color: 'bg-zinc-100 text-zinc-500',     icon: AlertCircle },
};

// ─── Componente principal ──────────────────────────────────────────────────────

export const VendedorDashboard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [salesperson, setSalesperson] = useState<Salesperson | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Trocar senha
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpNew !== cpConfirm) { setCpError('As senhas não coincidem'); return; }
    if (cpNew.length < 6) { setCpError('A nova senha deve ter pelo menos 6 caracteres'); return; }
    setCpLoading(true); setCpError('');
    try {
      const res = await fetch(`/api/salespeople/${salesperson!.id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao trocar senha');
      setCpSuccess(true);
      setTimeout(() => { setShowChangePassword(false); setCpSuccess(false); setCpCurrent(''); setCpNew(''); setCpConfirm(''); }, 2000);
    } catch (err: any) {
      setCpError(err.message);
    } finally {
      setCpLoading(false);
    }
  };

  // Gerar link
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkClientName, setLinkClientName] = useState('');
  const [linkClientEmail, setLinkClientEmail] = useState('');
  const [linkClientPhone, setLinkClientPhone] = useState('');
  const [linkPlan, setLinkPlan] = useState('ESSENCIAL');
  const [linkBilling, setLinkBilling] = useState<'mensal' | 'anual'>('mensal');
  const [linkLoading, setLinkLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Verificar se vendedor já está logado via sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('elevva_vendedor');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setSalesperson(data);
        fetchSales(data.id);
      } catch {
        sessionStorage.removeItem('elevva_vendedor');
      }
    }
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/salespeople/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Credenciais inválidas');
      }

      const data = await res.json();
      setSalesperson(data.salesperson);
      sessionStorage.setItem('elevva_vendedor', JSON.stringify(data.salesperson));
      fetchSales(data.salesperson.id);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('elevva_vendedor');
    setSalesperson(null);
    setSales([]);
    setEmail('');
    setPassword('');
  };

  // ── Buscar vendas ──────────────────────────────────────────────────────────

  const fetchSales = async (salespersonId: string) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/salespeople/${salespersonId}/sales`);
      if (res.ok) {
        const data = await res.json();
        setSales(data);
      }

      // Atualizar resumo de comissões
      const resSum = await fetch(`/api/salespeople`);
      if (resSum.ok) {
        const all = await resSum.json();
        const me = all.find((s: any) => s.id === salespersonId);
        if (me && salesperson) {
          const updated = { ...salesperson, ...me };
          setSalesperson(updated);
          sessionStorage.setItem('elevva_vendedor', JSON.stringify(updated));
        }
      }
    } finally {
      setLoadingData(false);
    }
  };

  // ── Gerar link ─────────────────────────────────────────────────────────────

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesperson) return;
    setLinkLoading(true);
    setGeneratedLink('');

    try {
      const planKey = linkPlan !== 'ENTERPRISE' && linkBilling === 'anual'
        ? `${linkPlan}_ANUAL` : linkPlan;
      const res = await fetch(`/api/salespeople/${salesperson.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: linkClientName,
          clientEmail: linkClientEmail,
          clientPhone: linkClientPhone.replace(/\D/g, ''),
          plan: planKey,
          billing: linkBilling,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar link');

      setGeneratedLink(data.paymentLink);
      fetchSales(salesperson.id);
      setLinkClientName('');
      setLinkClientEmail('');
      setLinkClientPhone('');
      setLinkPlan('ESSENCIAL');
      setLinkBilling('mensal');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Tela de Login ─────────────────────────────────────────────────────────

  if (!salesperson) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Elevva" className="h-10 mx-auto mb-6" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Painel do Vendedor</h1>
            <p className="text-zinc-500 text-sm mt-1">Acesse sua conta para gerar links e acompanhar vendas.</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-8 space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="••••••••"
                required
              />
            </div>
            {loginError && (
              <p className="text-red-500 text-xs font-medium text-center">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  const totalPaidCommission = salesperson.total_commission || 0;
  const pendingCommission = salesperson.pending_commission || 0;
  const paidSales = salesperson.paid_sales || 0;
  const pendingSales = salesperson.pending_sales || 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Elevva" className="h-8" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Painel do Vendedor</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-zinc-700">{salesperson.name}</span>
          <button onClick={() => { setShowChangePassword(true); setCpError(''); setCpSuccess(false); }}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-700 border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors">
            Trocar Senha
          </button>
          <button onClick={handleLogout} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Modal Trocar Senha */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-zinc-900">Trocar Senha</h3>
              <button onClick={() => setShowChangePassword(false)} className="text-zinc-400 hover:text-zinc-700">
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>
            {cpSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                <p className="text-emerald-700 font-bold">Senha alterada com sucesso!</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Senha atual</label>
                  <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="Sua senha atual" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nova senha</label>
                  <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="Mínimo 6 caracteres" required minLength={6} />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Confirmar nova senha</label>
                  <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="Repita a nova senha" required />
                </div>
                {cpError && <p className="text-red-500 text-xs font-medium">{cpError}</p>}
                <button type="submit" disabled={cpLoading}
                  className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {cpLoading ? <span className="animate-spin text-base">⏳</span> : 'Salvar nova senha'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black text-white rounded-3xl p-6 col-span-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Comissão Confirmada</p>
            <p className="text-4xl font-black">
              R$ {totalPaidCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-500 mt-2">{paidSales} venda{paidSales !== 1 ? 's' : ''} paga{paidSales !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-3xl p-6">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">A Confirmar</p>
            <p className="text-3xl font-black text-zinc-900">
              R$ {pendingCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-400 mt-2">{pendingSales} pendente{pendingSales !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-3xl p-6">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Comissão</p>
            <p className="text-3xl font-black text-[#65a30d]">{salesperson.commission_pct}%</p>
            <p className="text-xs text-zinc-400 mt-2">por venda</p>
          </div>
        </div>

        {/* Gerar link */}
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
          <div
            className="p-6 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors"
            onClick={() => { setShowLinkForm(!showLinkForm); setGeneratedLink(''); }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#65a30d] rounded-2xl">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-zinc-900">Gerar Link de Pagamento</p>
                <p className="text-xs text-zinc-500">Crie um link com split automático para enviar ao cliente</p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${showLinkForm ? 'rotate-180' : ''}`} />
          </div>

          {showLinkForm && (
            <div className="border-t border-zinc-100 p-6 space-y-4">
              {generatedLink ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Link gerado com sucesso!</p>
                    <p className="text-sm text-zinc-700 break-all font-mono bg-white rounded-xl p-3 border border-zinc-200">{generatedLink}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={copyLink}
                      className="flex-1 flex items-center justify-center gap-2 bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copiado!' : 'Copiar Link'}
                    </button>
                    <button
                      onClick={() => setGeneratedLink('')}
                      className="px-6 border border-zinc-200 text-zinc-600 font-bold py-3 rounded-xl text-sm hover:bg-zinc-50 transition-colors"
                    >
                      Novo Link
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleGenerateLink} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nome do Cliente</label>
                      <input
                        value={linkClientName}
                        onChange={e => setLinkClientName(e.target.value)}
                        className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                        placeholder="João Silva"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">E-mail do Cliente</label>
                      <input
                        type="email"
                        value={linkClientEmail}
                        onChange={e => setLinkClientEmail(e.target.value)}
                        className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                        placeholder="joao@empresa.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">WhatsApp do Cliente</label>
                      <input
                        value={linkClientPhone}
                        onChange={e => setLinkClientPhone(e.target.value)}
                        className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                        placeholder="(11) 99999-9999"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Plano</label>
                      <select
                        value={linkPlan}
                        onChange={e => setLinkPlan(e.target.value)}
                        className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
                      >
                        <option value="ESSENCIAL">Essencial</option>
                        <option value="PRO">Pro</option>
                        <option value="ENTERPRISE">Enterprise — personalizado</option>
                      </select>
                    </div>
                  </div>

                  {/* Toggle Mensal / Anual */}
                  {linkPlan !== 'ENTERPRISE' && (
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Período</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setLinkBilling('mensal')}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${linkBilling === 'mensal' ? 'bg-black text-white border-black' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>
                          Mensal
                        </button>
                        <button type="button" onClick={() => setLinkBilling('anual')}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${linkBilling === 'anual' ? 'bg-black text-white border-black' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>
                          Anual <span className="text-[10px] text-[#84cc16] font-black">20% OFF</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preview valor + comissão */}
                  {linkPlan !== 'ENTERPRISE' && (() => {
                    const planKey = linkBilling === 'anual' ? `${linkPlan}_ANUAL` : linkPlan;
                    const valor = PLAN_PRICES[planKey] || 0;
                    const comissao = valor * salesperson.commission_pct / 100;
                    return (
                      <div className="bg-zinc-50 rounded-2xl p-4 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-zinc-500">Valor do plano:</span>
                          <span className="text-sm font-black text-zinc-900">
                            R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            {linkBilling === 'mensal' ? '/mês' : '/ano'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-zinc-500">Sua comissão ({salesperson.commission_pct}%):</span>
                          <span className="text-lg font-black text-[#65a30d]">
                            R$ {comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    type="submit"
                    disabled={linkLoading}
                    className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link className="w-4 h-4" /> Gerar Link</>}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Histórico de vendas */}
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="font-black text-zinc-900">Minhas Vendas</h2>
            <button
              onClick={() => fetchSales(salesperson.id)}
              className="text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors flex items-center gap-1"
            >
              {loadingData ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              Atualizar
            </button>
          </div>

          {sales.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <ArrowUpRight className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma venda ainda.</p>
              <p className="text-sm mt-1">Gere seu primeiro link acima.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {sales.map(sale => {
                const statusCfg = STATUS_CONFIG[sale.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                return (
                  <div key={sale.id} className="p-6 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 truncate">{sale.client_name}</p>
                      <p className="text-xs text-zinc-400 truncate">{sale.client_email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black bg-zinc-100 text-zinc-500 px-2 py-1 rounded-full uppercase">
                          {PLAN_LABELS[sale.plan] || sale.plan}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 ${statusCfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-[#65a30d]">
                        +R$ {sale.commission_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-zinc-400">
                        de R$ {sale.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {sale.asaas_link_url && sale.status === 'pending' && (
                        <a
                          href={sale.asaas_link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-blue-500 hover:underline mt-1 block"
                        >
                          Abrir link
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Bot, Calendar, FileText, BarChart2, Zap,
  MessageSquare, Star, ChevronRight, Play,
  ShieldCheck, Server, BadgeCheck, Lock,
} from 'lucide-react';

import { BorderBeam } from './ui/border-beam';
import { Glow } from './ui/glow';
import { Mockup } from './ui/mockup';
import VideoPlayer from './ui/video-player';
import { SocialProofAvatars } from './ui/social-proof-avatars';
import { AnimatedBackground } from './ui/animated-background';
import { LogosSlider } from './ui/logos-slider';

// ─── Dados ───────────────────────────────────────────────────────────────────


const features = [
  {
    icon: Bot,
    tag: 'IA Conversacional',
    title: 'Agente que recruta por você',
    description: 'Triagem via WhatsApp 24/7. O agente qualifica candidatos, coleta currículos e agenda entrevistas automaticamente — sem intervenção da sua equipe.',
    stat: '80%', statLabel: 'menos tempo no processo',
  },
  {
    icon: FileText,
    tag: 'Análise Inteligente',
    title: 'Currículos avaliados em segundos',
    description: 'O nosso agente lê cada currículo com base nos critérios definidos pelo RH e gera um ranking objetivo, com pontuação (0 a 10), pontos fortes e fracos e um resumo técnico do candidato.',
    stat: '10x', statLabel: 'mais rápido que análise manual',
  },
  {
    icon: Calendar,
    tag: 'Ecossistema Google',
    tagGreen: true,
    title: 'Integrações inteligentes',
    description: 'Além da triagem, nossa IA consegue agendar entrevistas direto no seu Google Agenda, ela é capaz de gerar e enviar automaticamente os links do Google Meet para entrevistas online.',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg',
      'https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg',
    ],
  },
];

// ─── Dashboard Mockup ────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="bg-white flex w-full" style={{ minHeight: 'clamp(320px, 80vw, 620px)' }}>
      {/* Sidebar */}
      <div className="w-56 border-r border-slate-100 bg-white flex-col shrink-0 hidden lg:flex">
        <div className="h-16 flex items-center justify-center border-b border-slate-100 px-4">
          <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png?updatedAt=1773974222345" alt="Elevva" className="h-7 w-auto object-contain" />
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {[
            { label: 'Visão Geral', active: true },
            { label: 'Minhas Vagas', active: false },
            { label: 'Entrevistas', active: false },
            { label: 'Aprovados', active: false },
            { label: 'Minha Assinatura', active: false },
            { label: 'Configurações', active: false },
          ].map(({ label, active }) => (
            <div key={label}
              className={`flex items-center px-3 py-2.5 rounded-xl text-xs font-bold transition-all
                ${active ? 'bg-black text-white' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full mr-2.5 shrink-0 ${active ? 'bg-[#65a30d]' : 'bg-slate-200'}`} />
              {label}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-600">A</div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">Ana Beatriz</p>
              <p className="text-[10px] text-slate-400 truncate">ana@empresa.com.br</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 bg-slate-50/60 p-5 flex flex-col gap-4 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-[#65a30d] rounded-xl translate-x-0.5 translate-y-0.5" />
            <div className="w-9 h-9 bg-black rounded-xl relative flex items-center justify-center text-white text-sm font-black border-2 border-black z-10">A</div>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tighter leading-none">Olá, Ana</h2>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Bem-vinda ao seu painel</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Vagas Ativas', value: '4' },
            { label: 'Currículos Analisados', value: '127' },
            { label: 'Entrevistas', value: '23' },
            { label: 'Aprovados', value: '8' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0px_2px_12px_rgba(0,0,0,0.03)]">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
              <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</p>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
          {/* Candidate list */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-[0px_2px_12px_rgba(0,0,0,0.03)]">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Candidatos Recentes</p>
            <div className="space-y-0.5">
              {[
                { name: 'Mariana Costa',  role: 'Desenvolvedora Front-end', score: 94, status: 'Aprovado',   color: 'bg-emerald-50 text-emerald-700' },
                { name: 'Rafael Almeida', role: 'Designer UX/UI',           score: 87, status: 'Em análise', color: 'bg-sky-50 text-sky-700' },
                { name: 'Juliana Pires',  role: 'Product Manager',          score: 79, status: 'Entrevista', color: 'bg-violet-50 text-violet-700' },
                { name: 'Bruno Souza',    role: 'Backend Node.js',           score: 71, status: 'Analisando', color: 'bg-amber-50 text-amber-700' },
                { name: 'Camila Rocha',   role: 'Data Analyst',             score: 68, status: 'Triagem',    color: 'bg-slate-50 text-slate-600' },
              ].map(({ name, role, score, status, color }) => (
                <div key={name} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">{name.charAt(0)}</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-none">{name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${color}`}>{status}</span>
                    <div className="flex items-center gap-1 bg-[#65a30d]/10 rounded-full px-2 py-0.5">
                      <Star className="w-2.5 h-2.5 text-[#65a30d]" />
                      <span className="text-[10px] font-black text-[#65a30d]">{score}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0px_2px_12px_rgba(0,0,0,0.03)]">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Próximas Entrevistas</p>
              {[
                { name: 'Mariana Costa',  time: '14:00', day: 'Hoje' },
                { name: 'Rafael Almeida', time: '10:30', day: 'Amanhã' },
                { name: 'Juliana Pires',  time: '15:00', day: 'Sex' },
              ].map(({ name, time, day }) => (
                <div key={name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-600">{name.charAt(0)}</div>
                    <p className="text-[11px] font-bold text-slate-700">{name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-slate-900">{time}</p>
                    <p className="text-[9px] text-slate-400">{day}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-black rounded-2xl p-4 flex-1 flex flex-col justify-between">
              <div className="w-7 h-7 rounded-xl bg-[#65a30d]/20 flex items-center justify-center mb-2">
                <Zap className="w-3.5 h-3.5 text-[#65a30d]" />
              </div>
              <div>
                <p className="text-white font-black text-xs mb-1">Agente ativo</p>
                <p className="text-slate-400 text-[11px] font-medium leading-relaxed">12 candidatos em triagem agora via WhatsApp</p>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#65a30d] animate-pulse" />
                <span className="text-[9px] font-bold text-[#65a30d]">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

// ─── Modal de Checkout ────────────────────────────────────────────────────────

type CheckoutPlan = 'ESSENCIAL' | 'PRO' | 'ENTERPRISE';

const PLAN_LABELS: Record<string, string> = {
  ESSENCIAL: 'Essencial',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

const PLAN_PRICES_DISPLAY: Record<string, Record<string, string>> = {
  ESSENCIAL: { mensal: 'R$ 549,00/mês', anual: 'R$ 439,20/mês' },
  PRO:       { mensal: 'R$ 899,00/mês', anual: 'R$ 719,20/mês' },
  ENTERPRISE:{ mensal: 'A consultar',   anual: 'A consultar' },
};

function CheckoutModal({ plan, billing, onClose }: {
  plan: CheckoutPlan;
  billing: 'mensal' | 'anual';
  onClose: () => void;
}) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState('');

  const planKey = billing === 'anual' && plan !== 'ENTERPRISE' ? `${plan}_ANUAL` : plan;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError('Preencha todos os campos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sales/direct-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: name.trim(),
          clientEmail: email.trim(),
          clientPhone: phone.trim(),
          plan: planKey,
          billing,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar link de pagamento.');
      window.open(data.paymentLink, '_blank');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-white rounded-[2rem] shadow-[0_32px_80px_rgba(0,0,0,0.18)] w-full max-w-md p-8 z-10">
        {/* Fechar */}
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors text-lg font-bold">×</button>

        {/* Plano selecionado */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#65a30d]/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#65a30d]" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano selecionado</p>
            <p className="text-base font-black text-slate-900">{PLAN_LABELS[plan]} — {PLAN_PRICES_DISPLAY[plan][billing]}</p>
          </div>
        </div>

        <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">Seus dados</h3>
        <p className="text-sm text-slate-500 font-medium mb-6">Preencha para gerar seu link de pagamento seguro.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nome completo</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="João Silva"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#65a30d]/30 focus:border-[#65a30d] transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">E-mail</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="joao@empresa.com.br"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#65a30d]/30 focus:border-[#65a30d] transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">WhatsApp</label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="(51) 99999-9999"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#65a30d]/30 focus:border-[#65a30d] transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-black hover:bg-zinc-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-4 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Gerando link...</>
            ) : (
              <>Ir para o pagamento <ChevronRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-400 font-medium">
            Você será redirecionado para o checkout seguro Asaas.<br />CPF e cartão são informados lá.
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function DemonstracaoPage() {
  const [visible, setVisible] = useState(false);
  const [billing, setBilling] = useState<'mensal' | 'anual'>('mensal');
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);
  const whatsapp = 'https://wa.me/5551999999999?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20Elevva!';

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  return (
    <div
      className="min-h-screen text-slate-900 selection:bg-[#65a30d] selection:text-white relative"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflowX: 'hidden', maxWidth: '100vw' }}
    >
      <AnimatedBackground />

{/* ── MODAL DE CHECKOUT ─────────────────────────────────────────────── */}
      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          billing={billing}
          onClose={() => setCheckoutPlan(null)}
        />
      )}

      {/* ── NAVBAR FIXO ───────────────────────────────────────────────────── */}
      <nav
        style={{
          transform: scrolled ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
        }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png?updatedAt=1773974222345" alt="Elevva" className="h-10 md:h-8 w-auto object-contain max-w-[140px] md:max-w-[120px] shrink-0" />

          {/* Links centrais */}
          <div className="hidden md:flex items-center gap-1">
            <a
              href="#inicio"
              onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
            >
              Início
            </a>

            {/* Plataforma com dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all">
                Plataforma
                <svg className="w-3.5 h-3.5 mt-0.5 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {/* Dropdown */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-52 bg-white border border-slate-100 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] py-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 origin-top scale-95 group-hover:scale-100">
                {[
                  { label: 'Funcionalidades', id: 'funcionalidades' },
                  { label: 'Como Funciona',   id: 'como-funciona' },
                  { label: 'Segurança',        id: 'seguranca' },
                ].map(({ label, id }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}
                    className="block px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 mx-1 rounded-xl transition-colors"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <a
              href="#planos"
              onClick={e => { e.preventDefault(); document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
            >
              Planos
            </a>
          </div>

          {/* Entrar */}
          <a
            href="https://app.elevva.net.br" target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 bg-black hover:bg-zinc-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors duration-200"
          >
            Entrar
          </a>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section id="inicio" className="relative pt-16 border-b border-slate-100">

        {/* ── SPLIT: Título | Subtítulo ───────────────────────────────── */}
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 md:border-x md:border-slate-100">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">

            {/* LEFT — Título */}
            <div className="pt-10 pb-8 lg:pt-32 lg:pb-20 lg:pr-20 flex flex-col justify-center">

              {/* Título principal */}
              <h1
                className="font-black tracking-tighter text-slate-900 leading-[0.9]"
                style={{
                  fontSize: 'clamp(2.6rem, 8vw, 6rem)',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(18px)',
                  transition: 'opacity 0.65s ease 0.1s, transform 0.65s ease 0.1s',
                }}
              >
                {/* Mobile: 2 linhas */}
                <span className="lg:hidden">
                  Chega de pilhas<br />
                  <span className="text-[#65a30d]">de currículos.</span>
                </span>
                {/* Desktop: 3 linhas */}
                <span className="hidden lg:inline">
                  Chega de<br />
                  pilhas de<br />
                  <span className="text-[#65a30d]">currículos.</span>
                </span>
              </h1>

              {/* Linha decorativa */}
              <div
                className="flex items-center gap-2 mt-6 lg:mt-12"
                style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease 0.5s' }}
              >
                <div className="h-[3px] w-14 bg-[#65a30d] rounded-full" />
                <div className="h-[3px] w-5 bg-slate-200 rounded-full" />
                <div className="h-[3px] w-2 bg-slate-100 rounded-full" />
              </div>

              {/* Social proof */}
              <div
                className="mt-4 lg:mt-8"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 0.6s ease 0.6s, transform 0.6s ease 0.6s' }}
              >
                <SocialProofAvatars />
              </div>
            </div>

            {/* RIGHT — Descrição + Stats + CTAs */}
            <div className="pt-4 pb-16 lg:pt-32 lg:pb-20 lg:pl-20 flex flex-col justify-center gap-6 lg:gap-10">

              {/* Descrição */}
              <p
                className="text-base md:text-2xl text-slate-500 font-medium leading-[1.55] max-w-lg"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease 0.25s, transform 0.6s ease 0.25s' }}
              >
                Conheça o Bento, Agente de IA que atende no WhatsApp, qualifica currículos e{' '}
                <span className="text-slate-900 font-black">agenda entrevistas automaticamente.</span>
              </p>

              {/* Stats */}
              <div
                className="grid grid-cols-3 gap-4 lg:gap-6 py-6 lg:py-8 border-y border-slate-100"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s' }}
              >
                {[
                  { value: '80%', label: 'menos tempo\nno processo' },
                  { value: '10×',  label: 'mais rápido\nque o manual' },
                  { value: '0',   label: 'conflitos\nde agenda' },
                ].map(({ value, label }) => (
                  <div key={value} className="flex flex-col gap-1.5">
                    <span className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</span>
                    <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-pre-line leading-snug">{label}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div
                className="flex flex-col sm:flex-row gap-3"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease 0.45s, transform 0.6s ease 0.45s' }}
              >
                <a
                  href={whatsapp} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 bg-black hover:bg-zinc-800 text-white font-bold px-7 py-4 rounded-2xl text-sm transition-all duration-200 shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                >
                  <MessageSquare className="w-4 h-4" />
                  Falar com Especialista
                </a>
                <button
                  onClick={() => document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center gap-2.5 border-2 border-slate-200 hover:border-[#65a30d] text-slate-600 hover:text-[#65a30d] font-bold px-7 py-4 rounded-2xl text-sm transition-all duration-200"
                >
                  <Play className="w-4 h-4" />
                  Assinar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── ÁREA DE VÍDEO ──────────────────────────────────────────────── */}
        <div id="demo-section" className="relative max-w-7xl mx-auto px-4 md:px-6 pb-12 md:border-x md:border-slate-100">
          <div
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)', transition: 'opacity 0.8s ease 0.55s, transform 0.8s ease 0.55s' }}
          >
            <div className="w-full rounded-3xl border border-slate-200 bg-white shadow-[0_48px_120px_-24px_rgba(0,0,0,0.08)]" style={{ minHeight: 'clamp(220px, 50vw, 480px)' }} />
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="bg-transparent py-16 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6 md:border-x md:border-slate-100">
          <div className="w-full mb-10 md:mb-16 text-center">
            <h2
              className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05]"
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Tudo que o seu time precisa para<br />Contratar Melhor
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map(({ icon: Icon, tag, tagGreen, title, description, stat, statLabel, images }: any) => (
              <div
                key={title}
                className="relative bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0px_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300 group overflow-hidden"
              >

                <BorderBeam size={280} duration={12} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={1.5} />

                <div className="flex items-start justify-between mb-6">
                  {images ? (
                    <div className="flex items-center gap-3">
                      {images.map((src: string, i: number) => (
                        <div key={i} className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center shadow-md overflow-hidden p-2">
                          <img src={src} alt="" className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-[#65a30d]/10 group-hover:border-[#65a30d]/20 transition-all duration-300">
                      <Icon className="w-5 h-5 text-slate-400 group-hover:text-[#65a30d] transition-colors duration-300" />
                    </div>
                  )}
                  <span className={`text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 ${tagGreen ? 'text-[#65a30d] bg-[#65a30d]/10 border border-[#65a30d]/20' : 'text-slate-400 bg-slate-50 border border-slate-100'}`}>
                    {tag}
                  </span>
                </div>

                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-3 leading-snug">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-8">{description}</p>

                {stat && (
                  <div className="pt-6 border-t border-slate-50 flex items-baseline gap-2">
                    <span className="text-3xl md:text-5xl font-black tracking-tighter text-slate-900">{stat}</span>
                    <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">{statLabel}</span>
                  </div>
                )}
              </div>
            ))}

            {/* 4º card — desktop only */}
            <div className="hidden md:block relative bg-white rounded-[2rem] border border-slate-100 p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0px_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300 group overflow-hidden">
              <BorderBeam size={280} duration={12} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={1.5} />
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-[#65a30d]/10 group-hover:border-[#65a30d]/20 transition-all duration-300">
                  <BarChart2 className="w-5 h-5 text-slate-400 group-hover:text-[#65a30d] transition-colors duration-300" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 text-slate-400 bg-slate-50 border border-slate-100">
                  Custo de Ociosidade
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-3 leading-snug">O Prejuízo Oculto da Vaga Aberta</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">Falta de braço é perda de receita. Com o nosso agente o seu recrutamento fica até 80% mais rápido e seu faturamento é menos afetado por falta de pessoal.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ─────────────────────────────────────────────────── */}
      <section id="como-funciona" className="pt-10 pb-20 md:py-20 bg-transparent border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6 md:border-x md:border-slate-100">

          {/* Cabeçalho */}
          <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-[1.05]">
                Pronto para recuperar<br />
                <span className="text-[#65a30d]">12 horas por semana?</span>
              </h2>
            </div>
            <a
              href={whatsapp} target="_blank" rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 bg-black hover:bg-zinc-800 text-white font-bold px-7 py-3.5 rounded-2xl text-sm transition-all duration-200 self-start md:self-auto"
            >
              Começar agora <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Steps — 3 colunas divididas por linhas finas, sem fundo extra */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-x border-slate-100 md:border-x-0">
            {[
              {
                n: '01',
                title: 'Qualificação no WhatsApp',
                desc: 'O candidato chama no WhatsApp, Bento atende na hora, 24/7, recolhe o currículo em PDF e envia para análise.',
                accent: false,
              },
              {
                n: '02',
                title: 'Scoring Instantâneo',
                desc: 'Bento analisa o currículo em segundos e gera nota (0 a 10), pontos fortes e fracos e um resumo completo do candidato.',
                accent: false,
              },
              {
                n: '03',
                title: 'Agendamento na Agenda',
                desc: 'Se aprovado, Bento cruza a disponibilidade com a sua agenda e marca a entrevista no Google Meet — inclusive com reagendamentos.',
                accent: true,
              },
            ].map(({ n, title, desc, accent }) => (
              <div key={n} className={`relative flex flex-col gap-5 p-8 md:p-10 ${accent ? 'bg-[#65a30d]/[0.04]' : ''}`}>

                {/* Número grande decorativo */}
                <span
                  className="absolute top-4 right-6 text-[5.5rem] font-black leading-none select-none pointer-events-none tracking-tighter"
                  style={{ color: accent ? 'rgba(101,163,13,0.12)' : 'rgba(15,23,42,0.045)' }}
                >
                  {n}
                </span>

                {/* Badge do passo */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black ${accent ? 'bg-[#65a30d] text-white shadow-[0_4px_16px_rgba(101,163,13,0.3)]' : 'bg-slate-100 text-slate-500'}`}>
                  {n}
                </div>

                <div>
                  <h3 className={`font-black text-xl mb-2 tracking-tight leading-snug ${accent ? 'text-[#3d6b07]' : 'text-slate-900'}`}>
                    {title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>

                {accent && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#65a30d] rounded-t-none md:rounded-none" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEGURANÇA ─────────────────────────────────────────────────────── */}
      <section id="seguranca" className="pt-10 pb-20 md:py-20 bg-transparent border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6 md:border-x md:border-slate-100">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">

            {/* LEFT — declaração principal */}
            <div className="relative bg-slate-950 rounded-[2rem] p-6 md:p-14 overflow-hidden flex flex-col justify-between min-h-[180px] md:min-h-[360px]">
              {/* Escudo decorativo de fundo */}
              <ShieldCheck
                className="absolute -bottom-8 -right-8 text-white/[0.08]"
                style={{ width: 260, height: 260 }}
                strokeWidth={1}
              />

              <div>
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-[1.05] mb-4 md:mb-5">
                  Plataforma<br />Segura
                </h2>
                <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-sm">
                  O Elevva processa a informação, extrai o essencial e descarta o documento original. Sua empresa blindada contra vazamentos e multas.
                </p>
              </div>

            </div>

            {/* RIGHT — itens de segurança */}
            <div className="flex flex-col gap-4">
              {[
                {
                  icon: Lock,
                  title: 'Exclusão Automática (5 Dias)',
                  desc: 'PDF original é deletado permanentemente 5 dias após a análise. Zero passivo de dados para a sua empresa.',
                  badge: '5 dias',
                },
                {
                  icon: ShieldCheck,
                  title: 'Proteção Legal',
                  desc: 'Processamos apenas o essencial para o ranqueamento da vaga, blindando o seu CNPJ contra multas e sanções da LGPD.',
                  badge: 'LGPD',
                },
                {
                  icon: Server,
                  title: 'Ambiente Fechado',
                  desc: 'Acesso restrito a usuários autorizados pela sua gestão. Elimina o risco de vazamento de informações internas.',
                  badge: 'Acesso restrito',
                },
              ].map(({ icon: Icon, title, desc, badge }) => (
                <div
                  key={title}
                  className="flex items-start gap-5 bg-white border border-slate-100 rounded-2xl p-5 md:p-6 shadow-[0px_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0px_8px_32px_rgba(0,0,0,0.07)] transition-all duration-300 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-[#65a30d]/10 group-hover:border-[#65a30d]/20 transition-all duration-300">
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-[#65a30d] transition-colors duration-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">{title}</h3>
                      <span className="text-[9px] font-black text-[#65a30d] bg-[#65a30d]/8 border border-[#65a30d]/15 rounded-full px-2 py-0.5 uppercase tracking-wider shrink-0">{badge}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── CLIENTES ──────────────────────────────────────────────────────── */}
      <section className="py-14 max-w-7xl mx-auto px-4 md:px-6 bg-transparent md:border md:border-slate-100 md:border-t-0">
        <p className="text-center text-[11px] font-black text-slate-400 uppercase tracking-widest mb-10">
          Empresas que confiam na Elevva
        </p>
        <LogosSlider />
      </section>

      {/* ── PLANOS ────────────────────────────────────────────────────────── */}
      <section id="planos" className="py-20 bg-transparent border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6 md:border-x md:border-slate-100">

          {/* Cabeçalho */}
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05] text-slate-900">
              Planos e Preços
            </h2>
            <p className="mt-4 text-base text-slate-500 font-medium max-w-lg mx-auto">
              Escolha o plano ideal para o tamanho da sua operação.
            </p>

            {/* Toggle mensal / anual */}
            <div className="inline-flex items-center gap-1 mt-8 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
              <button
                onClick={() => setBilling('mensal')}
                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 ${billing === 'mensal' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Mensal
              </button>
              <button
                onClick={() => setBilling('anual')}
                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 flex items-center gap-2 ${billing === 'anual' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Anual
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${billing === 'anual' ? 'bg-[#65a30d] text-white' : 'bg-[#65a30d]/15 text-[#65a30d]'}`}>
                  -20%
                </span>
              </button>
            </div>
          </div>

          {/* Cards de plano */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

            {/* ESSENCIAL */}
            <div className="relative bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] flex flex-col">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Essencial</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                  R$ {billing === 'mensal' ? '549,00' : '439,20'}
                </span>
                <span className="text-sm text-slate-400 font-medium mb-1">/mês</span>
              </div>
              {billing === 'anual' && (
                <p className="text-xs text-[#65a30d] font-bold mb-4">Cobrado como R$ 5.270,40/ano</p>
              )}
              <p className="text-sm text-slate-500 font-medium mt-3 mb-8 leading-relaxed">
                Para equipes enxutas e recrutamento ágil.
              </p>
              <ul className="space-y-3 flex-1 mb-8">
                {['Até 3 vagas em simultâneo', 'Triagem e ranking', 'Relatórios individuais automáticos', 'Agendamento autônomo (WhatsApp)', 'Integração Google Calendar e Meet'].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="w-4 h-4 rounded-full bg-[#65a30d]/15 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 text-[#65a30d]" fill="none" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setCheckoutPlan('ESSENCIAL')}
                className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-slate-900 text-slate-700 hover:text-slate-900 font-bold py-3.5 rounded-2xl text-sm transition-all duration-200"
              >
                Assinar Essencial
              </button>
            </div>

            {/* PRO — destaque */}
            <div className="relative bg-black rounded-[2rem] border border-black p-6 md:p-8 shadow-[0px_16px_48px_rgba(0,0,0,0.16)] flex flex-col md:scale-[1.02] overflow-hidden">
              <BorderBeam size={400} duration={6} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={2} />
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pro</p>
                <span className="text-[10px] font-black bg-[#65a30d] text-white px-3 py-1 rounded-full uppercase tracking-widest">
                  Mais popular
                </span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-white tracking-tighter leading-none">
                  R$ {billing === 'mensal' ? '899,00' : '719,20'}
                </span>
                <span className="text-sm text-slate-500 font-medium mb-1">/mês</span>
              </div>
              {billing === 'anual' && (
                <p className="text-xs text-[#65a30d] font-bold mb-4">Cobrado como R$ 8.630,40/ano</p>
              )}
              <p className="text-sm text-slate-400 font-medium mt-3 mb-8 leading-relaxed">
                Tração total para seu RH com mais vagas.
              </p>
              <ul className="space-y-3 flex-1 mb-8">
                {['Até 10 vagas em simultâneo', 'Todas as funções do Essencial', 'Portal de Admissão', 'Conformidade LGPD (Exclusão em 5 dias)'].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="w-4 h-4 rounded-full bg-[#65a30d]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 text-[#65a30d]" fill="none" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setCheckoutPlan('PRO')}
                className="w-full flex items-center justify-center gap-2 bg-[#65a30d] hover:bg-[#4d7c0f] text-white font-bold py-3.5 rounded-2xl text-sm transition-all duration-200 shadow-[0_4px_20px_rgba(101,163,13,0.4)]"
              >
                Assinar Pro
              </button>
            </div>

            {/* ENTERPRISE */}
            <div className="relative bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] flex flex-col">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Enterprise</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                  Sob consulta
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium mt-3 mb-8 leading-relaxed">
                Solução sob medida para grandes operações.
              </p>
              <ul className="space-y-3 flex-1 mb-8">
                {['Vagas Ilimitadas', 'Atendimento Prioritário'].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="w-4 h-4 rounded-full bg-[#65a30d]/15 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 text-[#65a30d]" fill="none" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={whatsapp}
                target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-slate-900 text-slate-700 hover:text-slate-900 font-bold py-3.5 rounded-2xl text-sm transition-all duration-200"
              >
                Falar com Especialista
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="bg-zinc-950 mt-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 md:border-x md:border-white/5">

          {/* Corpo principal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 py-16 border-b border-white/10">

            {/* Coluna 1 — Logo + descrição */}
            <div className="md:col-span-1">
              <img
                src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png?updatedAt=1773974222345"
                alt="Elevva"
                className="h-8 w-auto object-contain brightness-0 invert mb-5"
              />
              <p className="text-sm text-zinc-400 font-medium leading-relaxed max-w-xs">
                Plataforma de Recrutamento e Seleção Autogerida por IA. Escale suas contratações e recupere seu tempo.
              </p>
            </div>

            {/* Coluna 2 — Plataforma */}
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">Plataforma</p>
              <ul className="space-y-3">
                {[
                  { label: 'Funcionalidades', id: 'funcionalidades' },
                  { label: 'Como Funciona',   id: 'como-funciona' },
                  { label: 'Segurança',        id: 'seguranca' },
                  { label: 'Planos',           id: 'planos' },
                ].map(({ label, id }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}
                      className="text-sm text-zinc-400 hover:text-white font-medium transition-colors duration-150"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coluna 3 — Legal */}
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">Legal</p>
              <ul className="space-y-3">
                {[
                  { label: 'Termos de Uso',  href: '#' },
                  { label: 'Privacidade',    href: '#' },
                  { label: 'Cookies',        href: '#' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-sm text-zinc-400 hover:text-white font-medium transition-colors duration-150">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Rodapé inferior */}
          <div className="py-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-zinc-600 font-medium">
              © {new Date().getFullYear()} Elevva. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium">Feito no Brasil</span>
              <span className="w-2 h-2 rounded-full bg-[#65a30d] animate-pulse" />
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}

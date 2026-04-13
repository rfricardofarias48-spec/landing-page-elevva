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
  {
    icon: BarChart2,
    tag: 'Custo de Ociosidade',
    title: 'O Prejuízo Oculto da Vaga Aberta',
    description: 'Falta de braço é perda de receita, com o nosso agente o seu recrutamento fica até 80% mais rápido e seu faturamento é menos afetado por falta de pessoal.',
    stat: null, statLabel: null,
  },
];

const testimonials = [
  { name: 'Ana Beatriz', role: 'Diretora de RH · Grupo Meridian', initials: 'AB',
    text: 'Contratamos 3 pessoas em 2 semanas usando o Elevva. Antes levávamos 2 meses. A diferença é absurda.' },
  { name: 'Thiago Nunes', role: 'Head de Pessoas · Nexora Tech', initials: 'TN',
    text: 'O agente de WhatsApp realmente funciona. Candidatos respondem muito mais do que no e-mail tradicional.' },
  { name: 'Carla Mendes', role: 'Recrutadora Sênior · VitalCare', initials: 'CM',
    text: 'A análise de currículos é impressionante. O sistema pontua com critérios que eu mesmo defino para cada vaga.' },
];

// ─── Dashboard Mockup ────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="bg-white flex w-full" style={{ minHeight: '620px' }}>
      {/* Sidebar */}
      <div className="w-56 border-r border-slate-100 bg-white flex-col shrink-0 hidden lg:flex">
        <div className="h-16 flex items-center justify-center border-b border-slate-100 px-4">
          <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png" alt="Elevva" className="h-7 w-auto object-contain" />
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
  ESSENCIAL: { mensal: 'R$ 649,90/mês', anual: 'R$ 519,20/mês' },
  PRO:       { mensal: 'R$ 999,90/mês', anual: 'R$ 799,92/mês' },
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

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);


  return (
    <div
      className="min-h-screen text-slate-900 selection:bg-[#65a30d] selection:text-white relative"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
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

      {/* ── NAVBAR flutuante ──────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png"
            alt="Elevva"
            className="h-12 w-auto object-contain"
          />
          <a
            href="https://app.elevva.net.br" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-black hover:bg-zinc-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors duration-200"
          >
            Entrar
          </a>
        </div>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative">

        {/* ── SPLIT: Título | Subtítulo ───────────────────────────────── */}
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">

            {/* LEFT — Título */}
            <div className="pt-24 pb-10 lg:pt-32 lg:pb-20 lg:pr-20 flex flex-col justify-center">

              {/* Título principal */}
              <h1
                className="font-black tracking-tighter text-slate-900 leading-[0.9]"
                style={{
                  fontSize: 'clamp(3.2rem, 6vw, 6rem)',
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
                className="flex items-center gap-2 mt-12"
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
            <div className="pb-10 lg:pt-32 lg:pb-20 lg:pl-20 flex flex-col justify-center gap-4 lg:gap-10">

              {/* Descrição */}
              <p
                className="text-xl md:text-2xl text-slate-500 font-medium leading-[1.55] max-w-lg"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease 0.25s, transform 0.6s ease 0.25s' }}
              >
                Conheça o Bento, Agente de IA que atende no WhatsApp, qualifica currículos e{' '}
                <span className="text-slate-900 font-black">agenda entrevistas automaticamente.</span>
              </p>

              {/* Stats */}
              <div
                className="grid grid-cols-3 gap-3 lg:gap-6 py-4 lg:py-8 border-y border-slate-100"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s' }}
              >
                {[
                  { value: '80%', label: 'menos tempo\nno processo' },
                  { value: '10×',  label: 'mais rápido\nque o manual' },
                  { value: '0',   label: 'conflitos\nde agenda' },
                ].map(({ value, label }) => (
                  <div key={value} className="flex flex-col gap-1">
                    <span className="text-xl lg:text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</span>
                    <span className="text-[0.5rem] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-pre-line leading-snug">{label}</span>
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

        {/* ── MOCKUP ─────────────────────────────────────────────────── */}
        <div id="demo-section" className="relative max-w-7xl mx-auto px-6 pb-12">
          <div
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)', transition: 'opacity 0.8s ease 0.55s, transform 0.8s ease 0.55s' }}
          >
            <Mockup className="relative w-full shadow-[0_48px_120px_-24px_rgba(0,0,0,0.18)] border-slate-200/80">
              <BorderBeam size={600} duration={7} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={2} />
              <div className="w-full bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center gap-3 shrink-0">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-slate-300" />
                  <span className="w-3 h-3 rounded-full bg-slate-300" />
                  <span className="w-3 h-3 rounded-full bg-slate-300" />
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-medium flex items-center gap-2 max-w-xs mx-auto">
                  <span className="w-2 h-2 rounded-full bg-[#65a30d] shrink-0" />
                  app.elevva.net.br
                </div>
              </div>
              <DashboardMockup />
            </Mockup>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="bg-transparent py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="w-full mb-16 text-center">
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
                className="relative bg-white rounded-[2rem] border border-slate-100 p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0px_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300 group overflow-hidden"
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
                    <span className="text-5xl font-black tracking-tighter text-slate-900">{stat}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{statLabel}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ─────────────────────────────────────────────────── */}
      <section className="py-16 bg-transparent">
        <div className="max-w-7xl mx-auto px-6">

          {/* Cabeçalho */}
          <div className="w-full mb-20 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-[1.05]">
              Pronto para recuperar<br />12 horas por semana?
            </h2>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">

            {/* Linha conectora — só desktop */}
            <div className="hidden md:flex absolute top-7 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] items-center">
              <div className="flex-1 border-t-2 border-dashed border-slate-200" />
            </div>

            {[
              {
                n: '1',
                title: 'Qualificação no WhatsApp',
                desc: 'O candidato chama no WhatsApp, Bento atende na hora, 24/7, recolhe o currículo em PDF e envia para análise.',
                green: false,
              },
              {
                n: '2',
                title: 'Scoring Instantâneo',
                desc: 'Bento analisa o currículo em segundos e gera um relatório completo com nota (0 a 10), Pontos Fortes e fracos e um resumo do currículo.',
                green: false,
              },
              {
                n: '3',
                title: 'Agendamento na Agenda',
                desc: 'Se aprovado, Bento cruza a disponibilidade do candidato com a sua agenda e agenda a entrevista em vídeo no Google Meet ou presencial, ele é capaz de fazer reagendamentos caso solicitado.',
                green: true,
              },
            ].map(({ n, title, desc, green }) => (
              <div key={n} className="relative bg-white border border-slate-100 rounded-[1.75rem] p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0px_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300">
                {/* Número */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black mb-6 z-10 relative ${green ? 'bg-[#65a30d] text-white shadow-[0_4px_16px_rgba(101,163,13,0.35)]' : 'bg-slate-50 border border-slate-200 text-slate-400'}`}>
                  {n}
                </div>
                <h3 className="text-slate-900 font-black text-lg mb-3 leading-snug">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                {green && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#65a30d] rounded-t-[1.75rem]" />
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-14 flex justify-center">
            <a
              href={whatsapp} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-black hover:bg-zinc-800 text-white font-bold px-8 py-4 rounded-2xl text-sm transition-all duration-200 shadow-[0_4px_24px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
            >
              Começar agora
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── SEGURANÇA ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-transparent">
        <div className="max-w-7xl mx-auto px-6">

          {/* Título */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05] text-slate-900">
              Plataforma Segura
            </h2>
            <p className="mt-6 text-base text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
              O Elevva processa a informação, extrai os dados essenciais e descarta o documento original. Sua empresa blindada contra vazamentos e multas.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
            {[
              {
                icon: Lock,
                title: 'Exclusão Automática (5 Dias)',
                desc: 'PDF original é deletado permanentemente 5 dias após a análise. Zero passivo de dados para a sua empresa.',
              },
              {
                icon: ShieldCheck,
                title: 'Proteção Legal',
                desc: 'Processamos apenas o essencial para o ranqueamento da vaga, blindando o seu CNPJ contra multas e sanções.',
              },
              {
                icon: Server,
                title: 'Ambiente Fechado',
                desc: 'Acesso restrito a utilizadores autorizados pela sua gestão. Elimina o risco de vazamento de informações internas.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="relative bg-white rounded-[2rem] border border-slate-100 p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0px_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#65a30d]/10 border border-[#65a30d]/20 flex items-center justify-center mb-6 group-hover:bg-[#65a30d]/15 transition-all duration-300">
                  <Icon className="w-5 h-5 text-[#65a30d]" />
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mb-3">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="py-16 max-w-7xl mx-auto px-6 bg-transparent">
        <div className="w-full mb-16 text-center">
          <h2
            className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05] text-slate-900"
          >
            Quem já usa o Elevva
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map(({ name, role, text, initials }) => (
            <div
              key={name}
              className="relative bg-white rounded-[2rem] border border-slate-100 p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] flex flex-col gap-6 overflow-hidden"
            >
              <BorderBeam size={200} duration={16} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={1} />
              {/* Quote mark */}
              <span className="text-7xl font-black text-[#65a30d]/15 leading-none -mb-4 select-none">"</span>
              <p className="text-sm text-slate-600 leading-relaxed font-medium flex-1">{text}</p>
              <div className="flex items-center gap-3 pt-5 border-t border-slate-50">
                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-xs font-black shrink-0">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{name}</p>
                  <p className="text-xs text-slate-400 font-medium">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PLANOS ────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-transparent">
        <div className="max-w-7xl mx-auto px-6">

          {/* Cabeçalho */}
          <div className="text-center mb-12">
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
            <div className="relative bg-white rounded-[2rem] border border-slate-100 p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] flex flex-col">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Essencial</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                  R$ {billing === 'mensal' ? '649,90' : '519,20'}
                </span>
                <span className="text-sm text-slate-400 font-medium mb-1">/mês</span>
              </div>
              {billing === 'anual' && (
                <p className="text-xs text-[#65a30d] font-bold mb-4">Cobrado como R$ 6.230,40/ano</p>
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
            <div className="relative bg-black rounded-[2rem] border border-black p-8 shadow-[0px_16px_48px_rgba(0,0,0,0.16)] flex flex-col scale-[1.02]">
              <BorderBeam size={400} duration={6} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={2} />
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pro</p>
                <span className="text-[10px] font-black bg-[#65a30d] text-white px-3 py-1 rounded-full uppercase tracking-widest">
                  Mais popular
                </span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-white tracking-tighter leading-none">
                  R$ {billing === 'mensal' ? '999,90' : '799,92'}
                </span>
                <span className="text-sm text-slate-500 font-medium mb-1">/mês</span>
              </div>
              {billing === 'anual' && (
                <p className="text-xs text-[#65a30d] font-bold mb-4">Cobrado como R$ 9.599,04/ano</p>
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
            <div className="relative bg-white rounded-[2rem] border border-slate-100 p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] flex flex-col">
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

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section className="relative mx-4 md:mx-6 mb-8 rounded-[2rem] overflow-hidden">
        {/* Fundo preto com glow verde */}
        <div className="absolute inset-0 bg-black" />
        <Glow variant="center" className="opacity-60" />
        <BorderBeam size={800} duration={5} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={2} />

        <div className="relative py-24 px-8 text-center">
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png"
            alt="Elevva"
            className="h-10 w-auto object-contain mx-auto mb-10 brightness-0 invert opacity-90"
          />
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-tight text-white">
            Pronto para transformar<br />seu recrutamento?
          </h2>
          <p className="text-slate-400 font-medium mb-10 max-w-md mx-auto">
            Fale com um especialista e veja o Elevva em ação com um processo real da sua empresa.
          </p>
          <a
            href={whatsapp} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#65a30d] hover:bg-[#4d7c0f] text-white font-bold px-9 py-4 rounded-2xl transition-all duration-200 text-sm shadow-[0_8px_32px_rgba(101,163,13,0.35)] group"
          >
            <MessageSquare className="w-4 h-4" />
            Falar com Especialista
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="bg-transparent max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
        <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png" alt="Elevva" className="h-6 w-auto object-contain opacity-30" />
        <p className="text-xs text-slate-400 font-medium">© {new Date().getFullYear()} Elevva. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

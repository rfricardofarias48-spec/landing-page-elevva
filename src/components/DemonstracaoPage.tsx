import React, { useState, useEffect } from 'react';
import { Bot, Users, Calendar, FileText, BarChart2, Zap, MessageSquare, Check, ArrowRight, Star, ChevronRight } from 'lucide-react';

const features = [
  {
    icon: Bot,
    tag: 'IA Conversacional',
    title: 'Agente que recruta por você',
    description: 'Triagem via WhatsApp 24/7. O agente qualifica candidatos, coleta currículos e agenda entrevistas automaticamente — sem intervenção da sua equipe.',
    stat: '80%',
    statLabel: 'menos tempo no processo',
  },
  {
    icon: FileText,
    tag: 'Análise Inteligente',
    title: 'Currículos avaliados em segundos',
    description: 'Claude AI lê cada currículo com base nos critérios da vaga e gera um ranking objetivo com pontuação, pontos fortes e pontos de atenção.',
    stat: '10x',
    statLabel: 'mais rápido que análise manual',
  },
  {
    icon: Calendar,
    tag: 'Agendamento Automático',
    title: 'Entrevistas no calendário sem esforço',
    description: 'Integração com Google Calendar. O candidato escolhe o horário disponível e o evento com Google Meet é criado automaticamente.',
    stat: '0',
    statLabel: 'conflitos de agenda',
  },
  {
    icon: BarChart2,
    tag: 'Visibilidade Total',
    title: 'Dashboard com métricas em tempo real',
    description: 'Acompanhe cada etapa do funil: candidatos recebidos, analisados, entrevistados e aprovados. Decisões baseadas em dados, não em achismos.',
    stat: '100%',
    statLabel: 'visibilidade do processo',
  },
];

const testimonials = [
  {
    name: 'Ana Beatriz',
    role: 'Diretora de RH · Grupo Meridian',
    text: 'Contratamos 3 pessoas em 2 semanas usando o Elevva. Antes levávamos 2 meses. A diferença é absurda.',
    initials: 'AB',
  },
  {
    name: 'Thiago Nunes',
    role: 'Head de Pessoas · Nexora Tech',
    text: 'O agente de WhatsApp realmente funciona. Candidatos respondem muito mais do que no e-mail tradicional.',
    initials: 'TN',
  },
  {
    name: 'Carla Mendes',
    role: 'Recrutadora Sênior · VitalCare',
    text: 'A análise de currículos é impressionante. O sistema pontua com critérios que eu mesmo defino para cada vaga.',
    initials: 'CM',
  },
];

export function DemonstracaoPage() {
  const [visible, setVisible] = useState(false);
  const whatsapp = 'https://wa.me/5551999999999?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20Elevva!';

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#65a30d] selection:text-white"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png"
            alt="Elevva"
            className="h-9 w-auto object-contain"
          />
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-black hover:bg-slate-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            Falar com Especialista
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
        <div
          className="transition-all duration-700"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)' }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#65a30d]/10 text-[#65a30d] border border-[#65a30d]/20 rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase mb-8">
            <Zap className="w-3 h-3" />
            Recrutamento com Inteligência Artificial
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.03] text-slate-900 mb-6">
            Contrate mais rápido.<br />
            <span className="text-[#65a30d]">Sem retrabalho.</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto mb-10">
            O Elevva automatiza todo o processo seletivo — da triagem à entrevista — usando um agente de IA que trabalha pelo seu time no WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-black hover:bg-slate-800 text-white font-bold px-7 py-4 rounded-2xl transition-all duration-200 shadow-md shadow-black/10 text-sm group"
            >
              Ver demonstração ao vivo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-7 py-4 rounded-2xl transition-all duration-200 border border-slate-200 text-sm"
            >
              <MessageSquare className="w-4 h-4 text-slate-400" />
              Falar com especialista
            </a>
          </div>

          {/* Social proof pills */}
          <div className="flex flex-wrap items-center justify-center gap-5 mt-8">
            {['Triagem automática via WhatsApp', 'Análise de currículos por IA', 'Google Calendar integrado'].map(item => (
              <div key={item} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                <Check className="w-4 h-4 text-[#65a30d]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCREEN MOCKUP ── */}
      <section
        className="px-4 md:px-8 pb-24 transition-all duration-700 delay-200"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)' }}
      >
        {/* Browser frame */}
        <div className="rounded-[2rem] border border-slate-200 shadow-[0px_40px_120px_rgba(0,0,0,0.12)] overflow-hidden max-w-[1400px] mx-auto">
          {/* Browser chrome */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
            <div className="flex gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-slate-300" />
              <span className="w-3.5 h-3.5 rounded-full bg-slate-300" />
              <span className="w-3.5 h-3.5 rounded-full bg-slate-300" />
            </div>
            <div className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-400 font-medium flex items-center gap-2 max-w-sm mx-auto">
              <div className="w-2.5 h-2.5 rounded-full bg-[#65a30d]" />
              app.elevva.net.br
            </div>
          </div>

          {/* App mockup interior */}
          <div className="bg-white flex" style={{ minHeight: '680px' }}>
            {/* Sidebar mockup */}
            <div className="w-64 border-r border-slate-100 bg-white flex flex-col shrink-0 hidden md:flex">
              <div className="h-20 flex items-center justify-center border-b border-slate-100 px-5">
                <img
                  src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png"
                  alt="Elevva"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <nav className="p-4 space-y-1.5 flex-1">
                {[
                  { label: 'Visão Geral', active: true },
                  { label: 'Minhas Vagas', active: false },
                  { label: 'Entrevistas', active: false },
                  { label: 'Aprovados', active: false },
                  { label: 'Minha Assinatura', active: false },
                  { label: 'Configurações', active: false },
                ].map(({ label, active }) => (
                  <div
                    key={label}
                    className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? 'bg-black text-white' : 'text-slate-400'}`}
                  >
                    <div className={`w-3 h-3 rounded-full mr-3 shrink-0 ${active ? 'bg-[#65a30d]' : 'bg-slate-200'}`} />
                    {label}
                  </div>
                ))}
              </nav>
              {/* User bottom */}
              <div className="p-4 border-t border-slate-100">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-black text-slate-600">A</div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Ana Beatriz</p>
                    <p className="text-xs text-slate-400">ana@empresa.com.br</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content mockup */}
            <div className="flex-1 bg-slate-50/50 p-6 md:p-8 flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-1">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-[#65a30d] rounded-xl translate-x-1 translate-y-1" />
                  <div className="w-11 h-11 bg-black rounded-xl relative flex items-center justify-center text-white text-base font-black border-2 border-black z-10">A</div>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Olá, Ana</h2>
                  <p className="text-xs text-slate-400 font-medium">Bem-vinda ao seu painel</p>
                </div>
              </div>

              {/* Top stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Vagas Ativas', value: '4' },
                  { label: 'Currículos Analisados', value: '127' },
                  { label: 'Entrevistas', value: '23' },
                  { label: 'Aprovados', value: '8' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-[1.5rem] border border-slate-100 p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.02)]">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
                    <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{value}</p>
                  </div>
                ))}
              </div>

              {/* Bottom area */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
                {/* Candidate list */}
                <div className="lg:col-span-2 bg-white rounded-[1.5rem] border border-slate-100 p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.02)]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Candidatos Recentes</p>
                  <div className="space-y-1">
                    {[
                      { name: 'Mariana Costa', role: 'Desenvolvedora Front-end', score: 94, status: 'Aprovado', color: 'bg-emerald-50 text-emerald-700' },
                      { name: 'Rafael Almeida', role: 'Designer UX/UI', score: 87, status: 'Em análise', color: 'bg-sky-50 text-sky-700' },
                      { name: 'Juliana Pires', role: 'Product Manager', score: 79, status: 'Entrevista', color: 'bg-violet-50 text-violet-700' },
                      { name: 'Bruno Souza', role: 'Backend Node.js', score: 71, status: 'Analisando', color: 'bg-amber-50 text-amber-700' },
                      { name: 'Camila Rocha', role: 'Data Analyst', score: 68, status: 'Triagem', color: 'bg-slate-50 text-slate-600' },
                    ].map(({ name, role, score, status, color }) => (
                      <div key={name} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-black text-slate-600 shrink-0">
                            {name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{name}</p>
                            <p className="text-xs text-slate-400">{role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-black rounded-full px-2.5 py-1 ${color}`}>{status}</span>
                          <div className="flex items-center gap-1 bg-[#65a30d]/10 rounded-full px-2.5 py-1">
                            <Star className="w-3 h-3 text-[#65a30d]" />
                            <span className="text-xs font-black text-[#65a30d]">{score}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right panel */}
                <div className="flex flex-col gap-4">
                  <div className="bg-white rounded-[1.5rem] border border-slate-100 p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.02)]">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Próximas Entrevistas</p>
                    {[
                      { name: 'Mariana Costa', time: '14:00', day: 'Hoje' },
                      { name: 'Rafael Almeida', time: '10:30', day: 'Amanhã' },
                      { name: 'Juliana Pires', time: '15:00', day: 'Sex' },
                    ].map(({ name, time, day }) => (
                      <div key={name} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600">{name.charAt(0)}</div>
                          <p className="text-xs font-bold text-slate-700">{name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-900">{time}</p>
                          <p className="text-[10px] text-slate-400">{day}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-black rounded-[1.5rem] p-5 flex-1 flex flex-col justify-between">
                    <div className="w-8 h-8 rounded-xl bg-[#65a30d]/20 flex items-center justify-center mb-3">
                      <Zap className="w-4 h-4 text-[#65a30d]" />
                    </div>
                    <div>
                      <p className="text-white font-black text-sm mb-1">Agente ativo</p>
                      <p className="text-slate-400 text-xs font-medium leading-relaxed">12 candidatos em triagem agora via WhatsApp</p>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#65a30d] animate-pulse" />
                      <span className="text-[10px] font-bold text-[#65a30d]">Online</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mb-14">
            <p className="text-xs font-black text-[#65a30d] uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-4xl font-black tracking-tighter text-slate-900 leading-tight">
              Tudo que seu time precisa para contratar melhor
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map(({ icon: Icon, tag, title, description, stat, statLabel }) => (
              <div
                key={title}
                className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0px_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-[#65a30d]/10 group-hover:border-[#65a30d]/20 transition-all">
                    <Icon className="w-5 h-5 text-slate-400 group-hover:text-[#65a30d] transition-colors" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
                    {tag}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">{description}</p>
                <div className="pt-5 border-t border-slate-50 flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">{stat}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-14">
          <p className="text-xs font-black text-[#65a30d] uppercase tracking-widest mb-3">Depoimentos</p>
          <h2 className="text-4xl font-black tracking-tighter text-slate-900 leading-tight">
            Quem já usa o Elevva
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map(({ name, role, text, initials }) => (
            <div
              key={name}
              className="bg-white rounded-[2rem] border border-slate-100 p-7 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] flex flex-col gap-5"
            >
              <p className="text-sm text-slate-600 leading-relaxed font-medium flex-1">"{text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-black shrink-0">
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

      {/* ── CTA FINAL ── */}
      <section className="bg-black mx-4 md:mx-6 mb-8 rounded-[2rem] py-16 px-8 text-center overflow-hidden relative">
        {/* Subtle green glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(101,163,13,0.15) 0%, transparent 70%)' }}
        />
        <div className="relative">
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png"
            alt="Elevva"
            className="h-10 w-auto object-contain mx-auto mb-8 brightness-0 invert"
          />
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter mb-3 leading-tight">
            Pronto para transformar<br />seu recrutamento?
          </h2>
          <p className="text-slate-400 font-medium mb-8 max-w-md mx-auto text-sm">
            Fale com um especialista e veja o Elevva em ação com um processo real da sua empresa.
          </p>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-[#65a30d] hover:bg-[#4d7c0f] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 text-sm shadow-lg shadow-[#65a30d]/20 group"
          >
            <MessageSquare className="w-4 h-4" />
            Falar com Especialista
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
        <img
          src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png"
          alt="Elevva"
          className="h-6 w-auto object-contain opacity-40"
        />
        <p className="text-xs text-slate-400 font-medium">
          © {new Date().getFullYear()} Elevva. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}

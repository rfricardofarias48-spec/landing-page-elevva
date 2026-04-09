import React, { useState, useEffect } from 'react';
import {
  Bot, Calendar, FileText, BarChart2, Zap,
  MessageSquare, Star, ChevronRight,
} from 'lucide-react';
import { BorderBeam } from './ui/border-beam';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Glow } from './ui/glow';
import { Mockup } from './ui/mockup';
import VideoPlayer from './ui/video-player';

// ─── Dados ───────────────────────────────────────────────────────────────────

const demoTabs = [
  { id: 'whatsapp',    label: 'Atendimento via WhatsApp',     icon: MessageSquare, videoUrl: 'https://ik.imagekit.io/xsbrdnr0y/Untitled%20design.mp4' },
  { id: 'curriculos',  label: 'Triagem de Currículos',         icon: FileText,      videoUrl: '' },
  { id: 'entrevistas', label: 'Agendamento de Entrevistas',    icon: Calendar,      videoUrl: '' },
  { id: 'documentos',  label: 'Coleta de Documentos',          icon: BarChart2,     videoUrl: '' },
];

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
    description: 'Claude AI lê cada currículo com base nos critérios da vaga e gera um ranking objetivo com pontuação, pontos fortes e pontos de atenção.',
    stat: '10x', statLabel: 'mais rápido que análise manual',
  },
  {
    icon: Calendar,
    tag: 'Agendamento Automático',
    title: 'Entrevistas no calendário sem esforço',
    description: 'Integração com Google Calendar. O candidato escolhe o horário disponível e o evento com Google Meet é criado automaticamente.',
    stat: '0', statLabel: 'conflitos de agenda',
  },
  {
    icon: BarChart2,
    tag: 'Custo de Ociosidade',
    title: 'O Prejuízo Oculto da Vaga Aberta',
    description: 'Quanto dinheiro a sua operação sangra a cada dia que uma equipe trabalha desfalcada? A lentidão da triagem manual não atrasa apenas o RH, ela paralisa a sua capacidade de entrega. A inteligência artificial assume o processo instantaneamente para garantir que a sua operação não perca faturamento por falta de mão de obra.',
    stat: '100%', statLabel: 'visibilidade do processo',
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

export function DemonstracaoPage() {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('whatsapp');
  const whatsapp = 'https://wa.me/5551999999999?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20Elevva!';
  const currentTab = demoTabs.find(t => t.id === activeTab);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);


  return (
    <div
      className="min-h-screen bg-white text-slate-900 selection:bg-[#65a30d] selection:text-white overflow-x-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 1px 0 rgba(15,23,42,0.04)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png"
            alt="Elevva"
            className="h-12 w-auto object-contain"
          />
          <a
            href={whatsapp} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-black hover:bg-slate-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors duration-200"
          >
            <MessageSquare className="w-4 h-4" />
            Falar com Especialista
          </a>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative py-20 px-4 md:py-28 overflow-hidden">

        {/* Glow de fundo atrás do mockup */}
        <div className="absolute inset-0 pointer-events-none">
          <Glow variant="above" className={`transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`} />
        </div>

        <div className="relative max-w-7xl mx-auto flex flex-col gap-16">

          {/* Texto central */}
          <div className="flex flex-col items-center text-center gap-8">

            {/* Heading com gradiente preto → verde */}
            <h1
              className="text-5xl md:text-7xl xl:text-8xl font-black tracking-tighter leading-[1.02] text-slate-900"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(14px)',
                transition: 'opacity 0.6s ease, transform 0.6s ease',
              }}
            >
              Contrate mais rápido.<br />
              <span className="text-[#65a30d]">Sem retrabalho.</span>
            </h1>

            {/* Descrição */}
            <p
              className="max-w-xl text-lg md:text-xl text-slate-500 font-medium leading-relaxed"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(14px)',
                transition: 'opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s',
              }}
            >
              O Elevva automatiza todo o processo seletivo — da triagem à admissão — veja na demonstração abaixo como nossa IA trabalha.
            </p>

            {/* Tabs de navegação */}
            <div
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(14px)',
                transition: 'opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s',
              }}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-slate-100/80 border border-slate-200 p-1.5 rounded-2xl h-auto gap-1.5 flex-wrap justify-center backdrop-blur-sm">
                  {demoTabs.map(({ id, label, icon: Icon }) => (
                    <TabsTrigger
                      key={id} value={id}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200
                        text-slate-500 hover:text-slate-700
                        data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >
                      <Icon
                        className={`w-4 h-4 transition-colors ${activeTab === id ? 'text-[#65a30d]' : 'text-slate-400'}`}
                      />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* ── MOCKUP ────────────────────────────────────────────────────── */}
          <div
            className="w-full"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)',
              transition: 'opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s',
            }}
          >
            <Mockup className="relative w-full shadow-[0_48px_120px_-24px_rgba(0,0,0,0.18)] border-slate-200/80">
              <BorderBeam size={600} duration={7} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={2} />

              {/* Chrome do browser */}
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

              {/* Conteúdo: vídeo ou dashboard */}
              {currentTab?.videoUrl ? (
                <video
                  key={currentTab.videoUrl}
                  src={currentTab.videoUrl}
                  className="w-full block"
                  controls
                  autoPlay
                  playsInline
                  style={{ maxHeight: '680px', background: '#000' }}
                />
              ) : (
                <DashboardMockup />
              )}
            </Mockup>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="bg-slate-50/70 py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-xl mb-16">
            <p className="text-xs font-black text-[#65a30d] uppercase tracking-[0.2em] mb-4">Funcionalidades</p>
            <h2
              className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05]"
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Tudo que seu time precisa para contratar melhor
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map(({ icon: Icon, tag, title, description, stat, statLabel }) => (
              <div
                key={title}
                className="relative bg-white rounded-[2rem] border border-slate-100 p-8 shadow-[0px_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0px_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300 group overflow-hidden"
              >
                <BorderBeam size={280} duration={12} colorFrom="#65a30d" colorTo="#a3e635" borderWidth={1.5} />

                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-[#65a30d]/10 group-hover:border-[#65a30d]/20 transition-all duration-300">
                    <Icon className="w-5 h-5 text-slate-400 group-hover:text-[#65a30d] transition-colors duration-300" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5">
                    {tag}
                  </span>
                </div>

                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-3 leading-snug">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-8">{description}</p>

                <div className="pt-6 border-t border-slate-50 flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter text-slate-900">{stat}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="py-28 max-w-7xl mx-auto px-6">
        <div className="max-w-xl mb-16">
          <p className="text-xs font-black text-[#65a30d] uppercase tracking-[0.2em] mb-4">Depoimentos</p>
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
      <footer className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
        <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png" alt="Elevva" className="h-6 w-auto object-contain opacity-30" />
        <p className="text-xs text-slate-400 font-medium">© {new Date().getFullYear()} Elevva. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

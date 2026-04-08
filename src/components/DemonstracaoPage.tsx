import React from 'react';
import { Bot, Users, Calendar, FileText, BarChart2, Zap, MessageSquare } from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'Agente de IA para Recrutamento',
    description: 'Um agente inteligente conduz triagens via WhatsApp, qualifica candidatos automaticamente e agenda entrevistas — tudo sem intervenção humana.',
  },
  {
    icon: Users,
    title: 'Gestão Completa de Candidatos',
    description: 'Visualize, filtre e gerencie todos os candidatos em um único painel. Acompanhe cada etapa do funil com clareza.',
  },
  {
    icon: Calendar,
    title: 'Agendamento Inteligente de Entrevistas',
    description: 'Integração com Google Calendar e slots configuráveis. O candidato escolhe o horário e o evento é criado automaticamente.',
  },
  {
    icon: FileText,
    title: 'Análise Automática de Currículos',
    description: 'Claude AI lê e pontua cada currículo com base nos critérios da vaga, gerando um ranking objetivo em segundos.',
  },
  {
    icon: BarChart2,
    title: 'Dashboard SDR com Métricas Reais',
    description: 'Acompanhe contatos feitos, demos agendadas e conversões mensais. Dados em tempo real para decisões mais rápidas.',
  },
  {
    icon: Zap,
    title: 'Automação de Ponta a Ponta',
    description: 'Da divulgação da vaga à contratação, cada etapa é automatizada. Reduza custos operacionais e aumente a velocidade do processo.',
  },
];

export function DemonstracaoPage() {
  const whatsappUrl = 'https://wa.me/5511999999999?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20Elevva!';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-lime-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight">elevva</span>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Falar com Especialista
        </a>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-10">
        <span className="text-xs font-semibold tracking-widest text-lime-400 uppercase mb-4">
          Plataforma de Recrutamento com IA
        </span>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight max-w-3xl">
          Recrutamento mais rápido,{' '}
          <span className="text-lime-400">inteligente</span> e escalável
        </h1>
        <p className="mt-5 text-zinc-400 text-lg max-w-xl">
          Veja como o Elevva automatiza todo o processo seletivo — do primeiro contato à contratação — usando inteligência artificial.
        </p>
      </section>

      {/* Screen / Demo Area */}
      <section className="px-6 md:px-16 pb-10">
        <div className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl shadow-black/60">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 bg-zinc-800 px-4 py-3 border-b border-zinc-700">
            <span className="w-3 h-3 rounded-full bg-zinc-600" />
            <span className="w-3 h-3 rounded-full bg-zinc-600" />
            <span className="w-3 h-3 rounded-full bg-zinc-600" />
            <div className="ml-3 flex-1 bg-zinc-700 rounded-md px-3 py-1 text-xs text-zinc-400">
              app.elevva.net
            </div>
          </div>
          {/* Screen content placeholder */}
          <div className="bg-zinc-900 flex flex-col items-center justify-center min-h-[400px] md:min-h-[520px] gap-6 p-10">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Bot className="w-10 h-10 text-lime-400" />
            </div>
            <p className="text-zinc-500 text-sm text-center max-w-sm">
              Demonstração interativa em breve. Entre em contato para ver o sistema ao vivo com um especialista.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-lime-500 hover:bg-lime-400 text-black font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Agendar demonstração ao vivo
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-16 py-12 max-w-6xl mx-auto w-full">
        <h2 className="text-center text-2xl font-bold mb-10 text-white">
          Tudo que você precisa para contratar melhor
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-3 hover:border-zinc-600 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-lime-500/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-lime-400" />
              </div>
              <h3 className="font-semibold text-white text-sm">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center text-center px-6 py-16">
        <h2 className="text-3xl font-bold mb-3">Pronto para transformar seu recrutamento?</h2>
        <p className="text-zinc-400 mb-8 max-w-md">
          Fale com um especialista e descubra como o Elevva pode ser adaptado para o seu negócio.
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-lime-500 hover:bg-lime-400 text-black font-bold text-base px-8 py-4 rounded-2xl transition-colors shadow-lg shadow-lime-500/20"
        >
          <MessageSquare className="w-5 h-5" />
          Falar com Especialista
        </a>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-800 px-8 py-5 flex items-center justify-between text-zinc-600 text-xs">
        <span>© {new Date().getFullYear()} Elevva. Todos os direitos reservados.</span>
        <span>app.elevva.net</span>
      </footer>
    </div>
  );
}

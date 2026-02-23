import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Componente de Barreira de Erro para evitar a Tela Branca da Morte (White Screen of Death)
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly declare state to satisfy TypeScript in some environments
  public state: ErrorBoundaryState;
  // Explicitly declare props to satisfy TypeScript
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans text-slate-900">
          <div className="bg-white p-8 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-2 border-black max-w-md w-full animate-slide-up">
             <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-red-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
             </div>
             <h1 className="text-2xl font-black mb-2 tracking-tight">Ops! Algo deu errado.</h1>
             <p className="text-slate-500 font-bold text-sm mb-6 leading-relaxed">
               Ocorreu um erro inesperado na aplicação.
             </p>
             
             {this.state.error && (
               <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-100 text-[10px] font-mono text-left text-slate-500 mb-6 overflow-auto max-h-32 break-all shadow-inner">
                 <strong>Erro Técnico:</strong><br/>
                 {this.state.error.message}
               </div>
             )}

             <button 
               onClick={() => {
                 // Limpa cache e recarrega para a home
                 window.location.href = window.location.origin;
               }} 
               className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-4 rounded-xl transition-all shadow-[4px_4px_0px_0px_rgba(204,243,0,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(204,243,0,1)] active:scale-95 flex items-center justify-center gap-2 border-2 border-black"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
               Recarregar Aplicação
             </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Monkey patch para evitar crash do Google Translate/Extensões
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function(child) {
    if (child.parentNode !== this) {
      if (console) {
        console.warn('[React Fix] Cannot remove a child from a different parent', child, this);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments as any);
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
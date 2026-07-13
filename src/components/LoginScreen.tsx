
import React, { useState } from 'react';
import { Lock, Mail, Loader2, ShieldAlert, CheckCircle2, Key } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, pass: string, name?: string, phone?: string, isRegister?: boolean) => Promise<{ success: boolean; error?: string; message?: string }>;
  onResetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  onShowTerms: () => void;
  onShowPrivacy: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onResetPassword, onShowTerms, onShowPrivacy }) => {
  // Login com Google e cadastro público removidos — app de uso interno.
  // Contas são criadas só via admin ("Nova Conta Interna") ou pelo
  // onboarding automático (convite por e-mail).
  const [authMode, setAuthMode] = useState<'LOGIN' | 'FORGOT'>('LOGIN');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = () => {
    if (error) setError('');
    if (successMessage) setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage(null);

    // FLUXO DE RECUPERAÇÃO DE SENHA
    if (authMode === 'FORGOT') {
        try {
            const result = await onResetPassword(email);
            if (!result.success) {
                setError(result.error || 'Erro ao enviar email.');
            } else {
                setSuccessMessage(result.message || 'Email enviado!');
            }
        } catch {
            setError("Ocorreu um erro inesperado.");
        } finally {
            setIsLoading(false);
        }
        return;
    }

    // FLUXO DE LOGIN
    try {
      const result = await onLogin(email, password);

      if (!result.success) {
        setError(result.error || 'Erro ao autenticar. Tente novamente.');
      } else if (result.message) {
        setSuccessMessage(result.message);
        setPassword('');
      }
    } catch {
      setError("Ocorreu um erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#84cc16] selection:text-black flex items-center justify-center p-4 relative overflow-hidden">

       {/* Card Centralizado */}
       <div className="bg-white rounded-3xl w-full max-w-md p-8 md:p-10 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] relative z-10 animate-slide-up border border-slate-100">

          <div className="flex flex-col items-center text-center mb-8">
             <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png" alt="ELEVVA" className="h-16 w-auto mb-6 object-contain" />

             <div className="inline-flex p-3 rounded-2xl bg-[#84cc16]/10 mb-5 border border-[#84cc16]/20">
                {authMode === 'FORGOT' ? <Key className="w-6 h-6 text-[#84cc16]" /> : <Lock className="w-6 h-6 text-[#84cc16]" />}
             </div>

             <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                {authMode === 'LOGIN' ? 'Bem-vindo' : 'Recuperar Senha'}
             </h2>
             <p className="text-slate-500 text-sm font-bold mt-2 leading-relaxed max-w-xs">
                {authMode === 'LOGIN' ? '' : 'Digite seu email para receber o link de redefinição.'}
             </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                  <Mail className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input type="email" value={email} onChange={e=>{setEmail(e.target.value); clearMessages();}} placeholder="Email" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
              </div>

              {authMode !== 'FORGOT' && (
                  <div className="relative group">
                      <Lock className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                      <input type="password" value={password} onChange={e=>{setPassword(e.target.value); clearMessages();}} placeholder="Senha" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
                  </div>
              )}

              {/* Botão Esqueci minha senha (Apenas no modo Login) */}
              {authMode === 'LOGIN' && (
                  <div className="flex justify-end">
                      <button type="button" onClick={() => { setAuthMode('FORGOT'); clearMessages(); }} className="text-[10px] font-bold text-slate-500 hover:text-black hover:underline uppercase tracking-wide">
                          Esqueci minha senha
                      </button>
                  </div>
              )}

              {error && (
                  <div className="bg-red-50 text-red-600 text-xs font-bold p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-fade-in">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      <span className="flex-1">{error}</span>
                  </div>
              )}

              {successMessage && (
                  <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-4 rounded-xl flex items-center gap-3 border border-emerald-100 animate-fade-in">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                      <span className="flex-1">{successMessage}</span>
                  </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full bg-black text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-70 disabled:transform-none mt-4">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : (
                      authMode === 'LOGIN' ? 'Acessar Painel' : 'Enviar Link de Recuperação'
                  )}
              </button>
          </form>

          {authMode === 'FORGOT' && (
              <div className="mt-8 text-center">
                  <button onClick={() => { setAuthMode('LOGIN'); clearMessages(); }} className="text-xs font-bold text-slate-500 hover:text-black transition-colors uppercase tracking-widest border-b border-transparent hover:border-black pb-0.5">
                      Voltar ao Login
                  </button>
              </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <button onClick={onShowTerms} className="hover:text-black transition-colors">Termos de Uso</button>
              <button onClick={onShowPrivacy} className="hover:text-black transition-colors">Privacidade</button>
          </div>
       </div>

       {/* Footer Branding */}
       <div className="absolute bottom-6 left-0 w-full text-center pointer-events-none opacity-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by Elevva AI &copy; {new Date().getFullYear()}</p>
       </div>
    </div>
  );
};

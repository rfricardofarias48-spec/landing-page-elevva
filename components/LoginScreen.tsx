
import React, { useState } from 'react';
import { Lock, Mail, Loader2, ShieldAlert, User, Phone, CheckCircle2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, pass: string, name?: string, phone?: string, isRegister?: boolean) => Promise<{ success: boolean; error?: string }>;
  onGoogleLogin?: () => Promise<void>;
  onShowTerms: () => void;
  onShowPrivacy: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onGoogleLogin, onShowTerms, onShowPrivacy }) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const isRegistering = authMode === 'REGISTER';

    try {
      const result = await onLogin(email, password, name, phone, isRegistering);
      
      if (!result.success) {
        setError(result.error || 'Erro ao autenticar. Tente novamente.');
      }
    } catch (err) {
      setError("Ocorreu um erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    if (!onGoogleLogin) return;
    setIsGoogleLoading(true);
    try {
      await onGoogleLogin();
      setTimeout(() => {
          setIsGoogleLoading(false);
      }, 8000); 
    } catch (e) {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#CCF300] selection:text-black flex items-center justify-center p-4 relative overflow-hidden">
       
       {/* Background Grid Pattern */}
       <div className="absolute inset-0 z-0 h-full w-full bg-slate-50 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
       
       {/* Card Centralizado */}
       <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 md:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative z-10 animate-slide-up border-2 border-black">
          
          <div className="flex flex-col items-center text-center mb-8">
             <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="ELEVVA" className="h-12 w-auto mb-6 object-contain" />
             
             <div className="inline-flex p-3 rounded-2xl bg-[#CCF300] mb-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <Lock className="w-6 h-6 text-black" />
             </div>
             
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {authMode === 'LOGIN' ? 'Bem-vindo de volta' : 'Crie sua conta'}
             </h2>
             <p className="text-slate-500 text-sm font-bold mt-2 leading-relaxed max-w-xs">
                {authMode === 'LOGIN' 
                  ? 'Acesse o painel do recrutador para gerenciar suas vagas com IA.' 
                  : 'Comece a otimizar seu recrutamento hoje mesmo.'}
             </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              {/* Google Login Button */}
              {onGoogleLogin && (
                  <button type="button" onClick={handleGoogleClick} disabled={isGoogleLoading} className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-50 hover:border-black transition-all flex items-center justify-center gap-3 relative shadow-sm active:scale-[0.98]">
                      {isGoogleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                          <>
                          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
                          <span>Continuar com Google</span>
                          </>
                      )}
                  </button>
              )}

              {onGoogleLogin && (
                <div className="flex items-center gap-4 my-3">
                    <div className="flex-1 h-px bg-slate-100"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ou email</span>
                    <div className="flex-1 h-px bg-slate-100"></div>
                </div>
              )}

              {authMode === 'REGISTER' && (
                  <>
                      <div className="relative group">
                          <User className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-black transition-colors" />
                          <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Nome Completo" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
                      </div>
                      <div className="relative group">
                          <Phone className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-black transition-colors" />
                          <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="WhatsApp" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
                      </div>
                  </>
              )}
              
              <div className="relative group">
                  <Mail className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-black transition-colors" />
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email Corporativo" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
              </div>

              <div className="relative group">
                  <Lock className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-black transition-colors" />
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
              </div>

              {error && (
                  <div className="bg-red-50 text-red-600 text-xs font-bold p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-fade-in">
                      <ShieldAlert className="w-5 h-5 shrink-0" /> {error}
                  </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full bg-black text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(204,243,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(204,243,0,1)] hover:translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-70 disabled:transform-none border-2 border-black mt-4">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : (authMode === 'LOGIN' ? 'Acessar Painel' : 'Criar Conta Grátis')}
              </button>
          </form>
          
          <div className="mt-8 text-center">
              <button onClick={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="text-xs font-bold text-slate-500 hover:text-black transition-colors uppercase tracking-widest border-b border-transparent hover:border-black pb-0.5">
                  {authMode === 'LOGIN' ? 'Não tem conta? Crie agora' : 'Já tem conta? Fazer Login'}
              </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <button onClick={onShowTerms} className="hover:text-black transition-colors">Termos de Uso</button>
              <button onClick={onShowPrivacy} className="hover:text-black transition-colors">Privacidade
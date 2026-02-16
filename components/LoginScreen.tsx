import React, { useState } from 'react';
import { Lock, Mail, Loader2, ShieldAlert, User, Phone, CheckCircle2, Key } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, pass: string, name?: string, phone?: string, isRegister?: boolean) => Promise<{ success: boolean; error?: string; message?: string }>;
  onGoogleLogin?: () => Promise<void>;
  onResetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  onShowTerms: () => void;
  onShowPrivacy: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onGoogleLogin, onResetPassword, onShowTerms, onShowPrivacy }) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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
        } catch (err) {
            setError("Ocorreu um erro inesperado.");
        } finally {
            setIsLoading(false);
        }
        return;
    }

    // FLUXO NORMAL (LOGIN / REGISTER)
    const isRegistering = authMode === 'REGISTER';
    try {
      const result = await onLogin(email, password, name, phone, isRegistering);
      
      if (!result.success) {
        setError(result.error || 'Erro ao autenticar. Tente novamente.');
      } else if (result.message) {
        // Sucesso com mensagem (ex: verificar email)
        setSuccessMessage(result.message);
        // Limpa campos sensíveis
        setPassword('');
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
    clearMessages();
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
       
       {/* Card Centralizado */}
       <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 md:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative z-10 animate-slide-up border-2 border-black">
          
          <div className="flex flex-col items-center text-center mb-8">
             <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="ELEVVA" className="h-12 w-auto mb-6 object-contain" />
             
             <div className="inline-flex p-3 rounded-2xl bg-[#CCF300] mb-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                {authMode === 'FORGOT' ? <Key className="w-6 h-6 text-black" /> : <Lock className="w-6 h-6 text-black" />}
             </div>
             
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {authMode === 'LOGIN' ? 'Bem-vindo' : 
                 authMode === 'REGISTER' ? 'Crie sua conta' : 
                 'Recuperar Senha'}
             </h2>
             <p className="text-slate-500 text-sm font-bold mt-2 leading-relaxed max-w-xs">
                {authMode === 'LOGIN' ? '' : 
                 authMode === 'REGISTER' ? 'Comece a otimizar seu recrutamento hoje mesmo.' : 
                 'Digite seu email para receber o link de redefinição.'}
             </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              {/* Google Login Button (Apenas em Login/Register) */}
              {onGoogleLogin && authMode !== 'FORGOT' && (
                  <button type="button" onClick={handleGoogleClick} disabled={isGoogleLoading} className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-50 hover:border-black transition-all flex items-center justify-center gap-3 relative shadow-sm active:scale-[0.98]">
                      {isGoogleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                          <>
                          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
                          <span>Continuar com Google</span>
                          </>
                      )}
                  </button>
              )}

              {onGoogleLogin && authMode !== 'FORGOT' && (
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
                          <input type="text" value={name} onChange={e=>{setName(e.target.value); clearMessages();}} placeholder="Nome Completo" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
                      </div>
                      <div className="relative group">
                          <Phone className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-black transition-colors" />
                          <input type="tel" value={phone} onChange={e=>{setPhone(e.target.value); clearMessages();}} placeholder="WhatsApp" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
                      </div>
                  </>
              )}
              
              <div className="relative group">
                  <Mail className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-black transition-colors" />
                  <input type="email" value={email} onChange={e=>{setEmail(e.target.value); clearMessages();}} placeholder="Email Corporativo" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
              </div>

              {authMode !== 'FORGOT' && (
                  <div className="relative group">
                      <Lock className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-black transition-colors" />
                      <input type="password" value={password} onChange={e=>{setPassword(e.target.value); clearMessages();}} placeholder="Senha" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium text-slate-900 placeholder:text-slate-400" required />
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

              <button type="submit" disabled={isLoading} className="w-full bg-black text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(204,243,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(204,243,0,1)] hover:translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-70 disabled:transform-none border-2 border-black mt-4">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : (
                      authMode === 'LOGIN' ? 'Acessar Painel' : 
                      authMode === 'REGISTER' ? 'Criar Conta Grátis' : 
                      'Enviar Link de Recuperação'
                  )}
              </button>
          </form>
          
          <div className="mt-8 text-center">
              {authMode === 'FORGOT' ? (
                  <button onClick={() => { setAuthMode('LOGIN'); clearMessages(); }} className="text-xs font-bold text-slate-500 hover:text-black transition-colors uppercase tracking-widest border-b border-transparent hover:border-black pb-0.5">
                      Voltar ao Login
                  </button>
              ) : (
                  <button onClick={() => { setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); clearMessages(); }} className="text-xs font-bold text-slate-500 hover:text-black transition-colors uppercase tracking-widest border-b border-transparent hover:border-black pb-0.5">
                      {authMode === 'LOGIN' ? 'Não tem conta? Crie agora' : 'Já tem conta? Fazer Login'}
                  </button>
              )}
          </div>

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
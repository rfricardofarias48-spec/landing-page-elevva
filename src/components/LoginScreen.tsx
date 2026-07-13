
import React, { useState } from 'react';
import { Lock, Loader2, ShieldAlert } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (password: string) => Promise<{ success: boolean; error?: string }>;
}

// Acesso simplificado — só senha, sem e-mail. Por trás dos panos autentica
// com a conta interna fixa (ver handleSimpleLogin em App.tsx). Dentro do
// app, a conta normal tem um botão "Admin" que dá acesso a todas as
// sub-abas administrativas na mesma sessão.
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const result = await onLogin(password);
      if (!result.success) {
        setError(result.error || 'Senha incorreta.');
        setPassword('');
      }
    } catch {
      setError('Ocorreu um erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#84cc16] selection:text-black flex items-center justify-center p-4 relative overflow-hidden">

       <div className="bg-white rounded-3xl w-full max-w-sm p-8 md:p-10 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] relative z-10 animate-slide-up border border-slate-100">

          <div className="flex flex-col items-center text-center mb-8">
             <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png" alt="ELEVVA" className="h-16 w-auto mb-6 object-contain" />
             <div className="inline-flex p-3 rounded-2xl bg-[#84cc16]/10 mb-5 border border-[#84cc16]/20">
                <Lock className="w-6 h-6 text-[#84cc16]" />
             </div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Acesso Restrito</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                  <Lock className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                      type="password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
                      placeholder="Senha"
                      autoFocus
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-center tracking-widest focus:outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:font-medium placeholder:tracking-normal text-slate-900 placeholder:text-slate-400"
                      required
                  />
              </div>

              {error && (
                  <div className="bg-red-50 text-red-600 text-xs font-bold p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-fade-in">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      <span className="flex-1">{error}</span>
                  </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full bg-black text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-70 disabled:transform-none mt-4">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Entrar'}
              </button>
          </form>
       </div>

       <div className="absolute bottom-6 left-0 w-full text-center pointer-events-none opacity-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by Elevva AI &copy; {new Date().getFullYear()}</p>
       </div>
    </div>
  );
};

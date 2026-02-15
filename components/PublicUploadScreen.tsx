
import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, ArrowLeft, FileText, Loader2, ShieldCheck, AlertTriangle, X, ArrowUp, CloudUpload, User, Phone, Send, Briefcase, Zap } from 'lucide-react';

interface Props {
  jobTitle: string;
  onUpload: (files: File[]) => Promise<void>;
  onBack: () => void;
}

export const PublicUploadScreen: React.FC<Props> = ({ jobTitle, onUpload, onBack }) => {
  // Estados do Formulário
  const [candidateName, setCandidateName] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Estados de Interface e Controle
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null); // Campo armadilha para robôs

  // CONSTANTES DE SEGURANÇA
  const MAX_FILE_SIZE_MB = 5;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const STORAGE_KEY = `veloRH_applied_${jobTitle.replace(/\s/g, '_')}`;

  useEffect(() => {
    // 3. Limitação por Sessão (Verifica se já se candidatou)
    const appliedTimestamp = localStorage.getItem(STORAGE_KEY);
    if (appliedTimestamp) {
        // Bloqueia se aplicou nas últimas 24 horas
        const oneDay = 24 * 60 * 60 * 1000;
        if (Date.now() - parseInt(appliedTimestamp) < oneDay) {
            setHasApplied(true);
        }
    }
  }, [STORAGE_KEY]);

  const validateFile = (file: File): string | null => {
      // 2. Segurança de Arquivos
      // Validação de Extensão e MIME Type
      if (file.type !== 'application/pdf') {
          return "Apenas arquivos PDF são permitidos para segurança.";
      }
      
      // Validação de Tamanho (Max 5MB)
      if (file.size > MAX_FILE_SIZE_BYTES) {
          return `O arquivo é muito grande. O limite máximo é de ${MAX_FILE_SIZE_MB}MB.`;
      }

      return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!hasApplied) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (hasApplied) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const validationError = validateFile(file);
      
      if (validationError) {
          setError(validationError);
          setSelectedFile(null);
      } else {
          setError(null);
          setSelectedFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validationError = validateFile(file);
      
      if (validationError) {
          setError(validationError);
          setSelectedFile(null);
      } else {
          setError(null);
          setSelectedFile(file);
      }
    }
  };

  // Máscara simples de telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    // Formatação visual (XX) XXXXX-XXXX
    if (value.length > 2) {
        value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 9) {
        value = `${value.slice(0, 9)}-${value.slice(9)}`; // Adjust dash position based on length
    }
    setCandidatePhone(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 3. Proteção contra Robôs (Honeypot)
    if (honeypotRef.current && honeypotRef.current.value !== '') {
        console.warn("Bot detectado via Honeypot");
        // Simula sucesso para enganar o bot, mas não envia nada
        setSuccess(true);
        return;
    }

    if (hasApplied) return;

    // 1. Validação de Nome Completo (Frontend)
    const nameParts = candidateName.trim().split(/\s+/);
    if (nameParts.length < 2 || candidateName.trim().length < 8) {
        setError("Por favor, insira seu nome completo (Nome e Sobrenome).");
        return;
    }

    // Validação de Telefone (Mínimo 10 dígitos: DDD + 8 números)
    const cleanPhone = candidatePhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        setError("Por favor, insira um telefone válido com DDD.");
        return;
    }

    if (!selectedFile) {
        setError("Por favor, anexe seu currículo em PDF.");
        return;
    }

    setUploading(true);

    try {
        // Envia o arquivo
        await onUpload([selectedFile]);
        
        // Marca como aplicado no LocalStorage
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        
        setSuccess(true);
    } catch (err) {
        setError("Erro ao enviar currículo. Tente novamente.");
    } finally {
        setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col items-center justify-center p-6 animate-fade-in font-jakarta relative overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 z-0 h-full w-full bg-white bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>

        <div className="w-full max-w-md text-center relative z-10">
           <div className="w-24 h-24 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] animate-slide-up border border-emerald-200">
             <CheckCircle2 className="w-12 h-12 text-emerald-500" />
           </div>
           
           <h2 className="text-3xl font-extrabold text-zinc-900 mb-4 tracking-tight animate-slide-up delay-100">Candidatura Enviada</h2>
           <p className="text-zinc-500 mb-10 text-lg leading-relaxed animate-slide-up delay-200">
             Obrigado pelo interesse na vaga de <strong className="text-zinc-900">{jobTitle}</strong>. 
             <br/>Nossa equipe analisará seu perfil em breve.
           </p>
           
           <div className="mt-12 pt-8 border-t border-zinc-100 animate-fade-in delay-500">
              <div className="flex items-center justify-center gap-2 text-zinc-400">
                 <ShieldCheck className="w-4 h-4" />
                 <span className="text-xs font-bold uppercase tracking-widest">Processado com Segurança</span>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col font-sans text-zinc-900 selection:bg-zinc-200 selection:text-black overflow-hidden relative">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 h-full w-full bg-white bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      
      {/* Luz de fundo suave */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/30 to-transparent pointer-events-none z-0"></div>

      {/* Header Compacto */}
      <div className="w-full py-4 px-6 md:px-12 flex justify-between items-center absolute top-0 left-0 z-50">
        <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="Logo" className="h-16 md:h-20 w-auto object-contain select-none drop-shadow-sm" />
        
        <button onClick={onBack} className="bg-white/80 backdrop-blur-md hover:bg-white border border-zinc-200 text-zinc-600 hover:text-black transition-all text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full flex items-center gap-2 group shadow-sm hover:shadow-md">
           <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> Voltar
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 overflow-y-auto custom-scrollbar">
        
        <div className="w-full max-w-[620px] animate-slide-up relative z-10 my-auto">
            
            {/* Título e Ícone */}
            <div className="flex items-center justify-center gap-4 mb-8 px-4 animate-slide-up">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100 shadow-sm transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                     <Zap className="w-5 h-5 text-blue-600" fill="currentColor" />
                </div>
                <p className="text-lg md:text-xl text-zinc-700 font-semibold leading-tight text-left md:text-center tracking-tight">
                    Envie seu currículo em segundos. Simples, rápido e seguro.
                </p>
            </div>

            <div className="bg-white rounded-[2rem] p-6 md:p-10 shadow-xl shadow-zinc-100/50 border border-zinc-200 relative">
                
                {hasApplied ? (
                    <div className="text-center py-12">
                         <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                         </div>
                         <h3 className="text-lg font-bold text-zinc-900">Candidatura Enviada</h3>
                         <p className="text-zinc-500 mt-1 text-sm">Você já enviou um currículo para esta vaga recentemente.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* HONEYPOT */}
                        <div className="absolute opacity-0 -z-10 w-0 h-0 overflow-hidden">
                            <label htmlFor="website_hp">Website</label>
                            <input type="text" id="website_hp" name="website_hp" ref={honeypotRef} tabIndex={-1} autoComplete="off" />
                        </div>

                        {/* NOVO CAMPO CARGO */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cargo</label>
                            <div className="relative group">
                                <input 
                                    type="text" 
                                    value={jobTitle}
                                    readOnly
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-4 px-5 text-zinc-700 font-bold text-sm focus:outline-none cursor-default select-none shadow-sm"
                                />
                                <div className="absolute right-4 top-3.5 text-zinc-400">
                                    <Briefcase className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Seus Dados</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative group">
                                        <input 
                                            type="text" 
                                            value={candidateName}
                                            onChange={e => setCandidateName(e.target.value)}
                                            placeholder="Nome Completo"
                                            className="w-full bg-white border border-zinc-200 rounded-xl py-4 px-5 text-zinc-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all placeholder-zinc-400 shadow-sm hover:border-zinc-300"
                                            required
                                        />
                                    </div>
                                    <div className="relative group">
                                        <input 
                                            type="tel" 
                                            value={candidatePhone}
                                            onChange={handlePhoneChange}
                                            placeholder="(00) 00000-0000"
                                            className="w-full bg-white border border-zinc-200 rounded-xl py-4 px-5 text-zinc-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all placeholder-zinc-400 shadow-sm hover:border-zinc-300"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                             <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Currículo PDF</label>
                             </div>
                             
                             <div 
                                className={`
                                    relative rounded-2xl p-8 transition-all cursor-pointer group flex flex-col items-center justify-center h-48 border-2 border-dashed
                                    ${isDragging 
                                        ? 'bg-zinc-50 border-zinc-900' 
                                        : 'bg-white border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400'}
                                `}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    className="hidden" 
                                    accept="application/pdf"
                                    onChange={handleFileSelect}
                                />
                                
                                {selectedFile ? (
                                    <div className="flex items-center justify-center gap-4 animate-fade-in w-full">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-black shrink-0 shadow-sm border border-zinc-200">
                                            <FileText className="w-6 h-6" strokeWidth={2} />
                                        </div>
                                        <div className="text-left overflow-hidden flex-1">
                                            <p className="font-bold text-zinc-900 text-sm truncate">{selectedFile.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                               <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold uppercase border border-zinc-200">PDF</span>
                                               <p className="text-[10px] text-zinc-500 font-bold uppercase">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                                            className="p-2 hover:bg-zinc-100 text-zinc-400 hover:text-red-500 rounded-full transition-colors"
                                            title="Remover arquivo"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-center gap-3">
                                        <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-1 shadow-lg transition-transform duration-300 group-hover:scale-110">
                                            <ArrowUp className="w-5 h-5 text-white" strokeWidth={3} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-zinc-900 uppercase tracking-wider">Upload do Currículo</p>
                                            <p className="text-[10px] text-zinc-500 font-medium">Clique ou arraste seu PDF aqui (Max 5MB)</p>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3 animate-fade-in text-red-600">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <p className="text-xs font-bold leading-tight">{error}</p>
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={uploading || !selectedFile}
                            className="w-full rounded-xl py-4 bg-black hover:bg-zinc-800 text-white font-bold shadow-lg transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                                        <span className="text-xs tracking-widest uppercase">Enviando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xs tracking-widest uppercase">Enviar Candidatura</span>
                                        <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
                                    </>
                                )}
                        </button>

                        {/* FOOTER DO CARTÃO COM LOGO */}
                        <div className="flex justify-between items-end pt-4 mt-2 border-t border-zinc-100">
                            <p className="text-[9px] text-zinc-400 flex items-center gap-1.5 font-medium">
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                Dados criptografados
                            </p>
                            <div className="flex flex-col items-end opacity-60 hover:opacity-100 transition-opacity">
                                <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Powered by</span>
                                <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="Logo" className="h-8 w-auto object-contain select-none" />
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

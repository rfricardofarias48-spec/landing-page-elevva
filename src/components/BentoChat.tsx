import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Send, Bot, X, Minus, Maximize2 } from 'lucide-react';

export interface BentoMessage {
  id: string;
  entrevista_id: string;
  remetente: 'Bento' | 'Recrutador';
  mensagem: string;
  created_at: string;
}

interface BentoChatProps {
  entrevistaId: string;
  candidateName: string;
  onClose: () => void;
  webhookUrl?: string; // URL do n8n
}

// --- Lógica Separada (Custom Hook) ---
function useBentoChat(entrevistaId: string, webhookUrl: string) {
  const [messages, setMessages] = useState<BentoMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Carregar mensagens iniciais
  useEffect(() => {
    if (!entrevistaId) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('mensagens_bento')
        .select('*')
        .eq('entrevista_id', entrevistaId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
      } else {
        setMessages(data as BentoMessage[] || []);
      }
      setLoading(false);
    };

    fetchMessages();

    // Inscrever no Supabase Realtime
    const channel = supabase
      .channel(`mensagens_bento_${entrevistaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens_bento',
          filter: `entrevista_id=eq.${entrevistaId}`,
        },
        (payload) => {
          const newMessage = payload.new as BentoMessage;
          setMessages((prev) => {
            // Evitar duplicidade caso a mensagem já tenha sido adicionada localmente (optimistic update)
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entrevistaId]);

  // Enviar mensagem
  const sendMessage = async (text: string) => {
    if (!text.trim() || !entrevistaId) return;
    
    setSending(true);
    
    // 1. Inserir no Supabase
    const { data: insertedData, error } = await supabase
      .from('mensagens_bento')
      .insert({
        entrevista_id: entrevistaId,
        remetente: 'Recrutador',
        mensagem: text.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir mensagem:', error);
      setSending(false);
      return;
    }

    // Adiciona localmente para resposta imediata (Optimistic Update)
    if (insertedData) {
       setMessages((prev) => [...prev, insertedData as BentoMessage]);
    }

    // 2. Disparar Webhook para o n8n
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entrevista_id: entrevistaId,
            mensagem: text.trim(),
          }),
        });
      } catch (webhookError) {
        console.error('Erro ao disparar webhook do n8n:', webhookError);
        // Não bloqueamos a UI se o webhook falhar, mas logamos o erro
      }
    }

    setSending(false);
  };

  return {
    messages,
    loading,
    sending,
    sendMessage,
  };
}

// --- Interface de Usuário (UI) ---
export const BentoChat: React.FC<BentoChatProps> = ({ 
  entrevistaId, 
  candidateName,
  onClose,
  webhookUrl = 'https://bot-n8n.5mljrq.easypanel.host/webhook/chat-recrutador' // Fallback
}) => {
  const { messages, loading, sending, sendMessage } = useBentoChat(entrevistaId, webhookUrl);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  const scrollToBottom = () => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isMinimized]);

  const handleSend = () => {
    if (!inputValue.trim() || sending) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex flex-col w-full max-w-[380px] border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xl font-sans transition-all duration-300 ease-in-out ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
      {/* Header */}
      <div 
        className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Bot size={18} />
          </div>
          <div className="overflow-hidden">
            <h3 className="font-semibold text-gray-800 text-sm truncate">Chat: {candidateName}</h3>
            {!isMinimized && <p className="text-xs text-gray-500 truncate">Assistente Virtual Bento</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-1 text-gray-400">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minus size={16} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 hover:bg-red-100 hover:text-red-500 rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
              <Bot size={32} className="opacity-50" />
              <p className="text-sm">Nenhuma mensagem ainda.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isBento = msg.remetente === 'Bento';
              return (
                <div
                  key={msg.id}
                  className={`flex w-full ${isBento ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 text-sm shadow-sm ${
                      isBento
                        ? 'bg-white border border-gray-100 text-gray-700 rounded-2xl rounded-tl-sm'
                        : 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.mensagem}</p>
                    <span
                      className={`text-[10px] mt-1.5 block text-right ${
                        isBento ? 'text-gray-400' : 'text-emerald-100'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Area */}
      {!isMinimized && (
        <div className="p-3 bg-white border-t border-gray-200">
          <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 p-1 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              className="flex-1 max-h-32 min-h-[40px] bg-transparent border-none focus:ring-0 resize-none py-2.5 px-3 text-sm text-gray-700 placeholder-gray-400"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || sending}
              className="p-2.5 mb-0.5 mr-0.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors flex-shrink-0"
            >
              <Send size={16} className={sending ? 'opacity-50' : ''} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Pressione Enter para enviar, Shift + Enter para pular linha
          </p>
        </div>
      )}
    </div>
  );
};

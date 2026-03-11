import React, { useState } from 'react';
import { X, Calendar, Clock, Send, Plus, Trash2, MapPin, Video } from 'lucide-react';
import { Job } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  job: Job;
  user_id: string;
  has_calendar_integration?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DaySlot {
  date: string;
  times: string[];
}

export const ScheduleInterviewsModal: React.FC<Props> = ({ job, user_id, has_calendar_integration, onClose, onSuccess }) => {
  const [days, setDays] = useState<DaySlot[]>([{ date: '', times: [''] }]);
  const [interviewFormat, setInterviewFormat] = useState<'ONLINE' | 'PRESENCIAL'>('ONLINE');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedCandidates = job.candidates.filter(c => c.isSelected);

  const addDay = () => {
    setDays([...days, { date: '', times: [''] }]);
  };

  const removeDay = (index: number) => {
    setDays(days.filter((_, i) => i !== index));
  };

  const updateDayDate = (index: number, date: string) => {
    const newDays = [...days];
    newDays[index].date = date;
    setDays(newDays);
  };

  const addTime = (dayIndex: number) => {
    const newDays = [...days];
    newDays[dayIndex].times.push('');
    setDays(newDays);
  };

  const removeTime = (dayIndex: number, timeIndex: number) => {
    const newDays = [...days];
    newDays[dayIndex].times = newDays[dayIndex].times.filter((_, i) => i !== timeIndex);
    setDays(newDays);
  };

  const updateTime = (dayIndex: number, timeIndex: number, time: string) => {
    const newDays = [...days];
    newDays[dayIndex].times[timeIndex] = time;
    setDays(newDays);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate days and times
    const validDays = days.filter(d => d.date && d.times.some(t => t));
    
    if (validDays.length === 0) {
      setError('Por favor, adicione pelo menos um dia e horário disponível completo.');
      return;
    }

    if (interviewFormat === 'PRESENCIAL' && !address.trim()) {
      setError('Por favor, informe o endereço para a entrevista presencial.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 1. Insert into interview_slots
      const slotsToInsert: any[] = [];
      validDays.forEach(day => {
        day.times.filter(t => t).forEach(time => {
          slotsToInsert.push({
            job_id: job.id,
            format: interviewFormat,
            location: interviewFormat === 'PRESENCIAL' ? address.trim() : null,
            slot_date: day.date,
            slot_time: time,
            is_booked: false
          });
        });
      });

      const { data: insertedSlots, error: slotsError } = await supabase
        .from('interview_slots')
        .insert(slotsToInsert)
        .select();

      if (slotsError) throw slotsError;

      // 2. Insert into interviews
      const interviewsToInsert = selectedCandidates.map(candidate => ({
        job_id: job.id,
        candidate_id: candidate.id,
        status: 'AGUARDANDO_RESPOSTA',
      }));

      const { data: insertedInterviews, error: insertError } = await supabase
        .from('interviews')
        .insert(interviewsToInsert)
        .select();

      if (insertError) throw insertError;

      // 3. Call n8n webhook
      const webhookUrl = import.meta.env.VITE_N8N_INTERVIEW_WEBHOOK || 'https://seu-n8n.com/webhook/agendar-entrevista';
      
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calendar_integrated: has_calendar_integration || false,
            job: {
              id: job.id,
              title: job.title,
              company: 'Empresa' // Você pode adicionar o nome da empresa se tiver no job
            },
            candidates: selectedCandidates.map(c => {
              const interview = insertedInterviews?.find(i => i.candidate_id === c.id);
              return {
                id: c.id,
                interview_id: interview?.id,
                name: c.result?.candidateName || c.fileName,
                phone: c.whatsapp || c.result?.phoneNumbers?.[0] || ''
              };
            }),
            slots: insertedSlots
          })
        });
      } catch (webhookError) {
        console.error('Erro ao chamar webhook do n8n:', webhookError);
        // Não vamos bloquear o sucesso se o webhook falhar, mas logamos o erro
      }

      onSuccess();
    } catch (err: any) {
      console.error('Erro ao agendar entrevistas:', err);
      setError(err.message || 'Erro ao agendar entrevistas. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl relative animate-slide-up border-4 border-black max-h-[95vh] flex flex-col">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 hover:border-black text-slate-400 hover:text-black z-10">
          <X className="w-5 h-5"/>
        </button>
        
        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
          <div className="w-12 h-12 bg-[#CCF300] rounded-xl flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Calendar className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Agendar Entrevistas</h2>
            <p className="text-sm font-bold text-slate-500">Para {selectedCandidates.length} candidato(s) selecionado(s)</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
          
          {/* Formato da Entrevista */}
          <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
            <label className="block text-xs font-black text-slate-900 uppercase tracking-widest mb-3">
              Formato da Entrevista
            </label>
            <div className="flex gap-3 mb-4">
              <button
                type="button"
                onClick={() => setInterviewFormat('ONLINE')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                  interviewFormat === 'ONLINE' 
                    ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(132,204,22,1)]' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Video className="w-4 h-4" /> Online
              </button>
              <button
                type="button"
                onClick={() => setInterviewFormat('PRESENCIAL')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                  interviewFormat === 'PRESENCIAL' 
                    ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(132,204,22,1)]' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <MapPin className="w-4 h-4" /> Presencial
              </button>
            </div>

            {interviewFormat === 'PRESENCIAL' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Endereço Completo
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Rua das Flores, 123 - Centro, São Paulo/SP"
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-black focus:ring-0 transition-colors"
                  required
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#84cc16]" /> Dias e Horários Disponíveis
            </label>
            
            <div className="space-y-4">
              {days.map((day, dayIndex) => (
                <div key={dayIndex} className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 relative">
                  {days.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(dayIndex)}
                      className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover dia"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="mb-4 pr-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Data</label>
                    <input
                      type="date"
                      value={day.date}
                      onChange={(e) => updateDayDate(dayIndex, e.target.value)}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-black focus:ring-0 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Horários de Início</label>
                    <div className="flex flex-wrap gap-2">
                      {day.times.map((time, timeIndex) => (
                        <div key={timeIndex} className="flex items-center bg-white border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-black transition-colors">
                          <input
                            type="time"
                            value={time}
                            onChange={(e) => updateTime(dayIndex, timeIndex, e.target.value)}
                            className="px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none border-none"
                            required
                          />
                          {day.times.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTime(dayIndex, timeIndex)}
                              className="px-2 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-slate-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={() => addTime(dayIndex)}
                        className="flex items-center justify-center gap-1 bg-white border-2 border-dashed border-slate-300 text-slate-500 hover:text-black hover:border-black rounded-xl px-3 py-2 text-sm font-bold transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Horário
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addDay}
              className="mt-4 flex items-center justify-center w-full gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-transparent hover:border-slate-300 rounded-xl px-4 py-3 text-sm font-bold transition-colors"
            >
              <Calendar className="w-4 h-4" /> Adicionar outro dia
            </button>

            <p className="text-xs text-slate-500 font-bold mt-4">
              O agente entrará em contato com os candidatos via WhatsApp oferecendo essas opções.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#CCF300] hover:bg-[#b8db00] text-black px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Seguir com agendamentos <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

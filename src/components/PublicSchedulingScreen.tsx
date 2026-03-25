import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Calendar, Clock, MapPin, User } from 'lucide-react';

interface Slot {
  id: string;
  slot_date: string;
  slot_time: string;
  format: string;
  location: string | null;
  interviewer_name: string | null;
}

interface Props {
  token: string;
}

export const PublicSchedulingScreen: React.FC<Props> = ({ token }) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [candidateName, setCandidateName] = useState<string>('');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookedSlot, setBookedSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/agendar/${token}/data`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || 'Link de agendamento inválido ou expirado.');
        setLoading(false);
        return;
      }

      if (data.status === 'AGENDADA' || data.status === 'ENTREVISTA_CONFIRMADA') {
        setSuccess(true);
        setLoading(false);
        return;
      }

      if (!data.slots || data.slots.length === 0) {
        setError('Não há horários disponíveis no momento. Entre em contato com o recrutador.');
        setLoading(false);
        return;
      }

      setCandidateName(data.candidateName?.split(' ')[0] || '');
      setJobTitle(data.jobTitle || '');
      setSlots(data.slots);
      setLoading(false);
    };

    load();
  }, [token]);

  const handleBookSlot = async (slot: Slot) => {
    if (booking) return;
    setBooking(true);

    const res = await fetch(`/api/agendar/${token}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: slot.id }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.error || 'Erro ao confirmar horário. Tente novamente.');
      setBooking(false);
      return;
    }

    setBookedSlot(slot);
    setSuccess(true);
    setBooking(false);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (timeStr: string) => timeStr.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-black" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-md w-full text-center">
          <p className="text-red-500 font-bold text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-md w-full text-center">
          <div className="w-16 h-16 bg-lime-100 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-lime-300">
            <CheckCircle2 className="w-8 h-8 text-lime-600" />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Entrevista Confirmada!</h1>
          {bookedSlot && (
            <p className="text-slate-600 font-medium mb-4">
              {formatDate(bookedSlot.slot_date)} às {formatTime(bookedSlot.slot_time)}
            </p>
          )}
          <p className="text-slate-500 text-sm">Você receberá uma confirmação no WhatsApp em breve. Boa sorte! 🍀</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Escolha seu horário
          </h1>
          {candidateName && (
            <p className="text-slate-500 font-medium mt-1">Olá, {candidateName}! 👋</p>
          )}
          {jobTitle && (
            <p className="text-slate-500 text-sm mt-1">Vaga: <span className="font-bold text-slate-700">{jobTitle}</span></p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => handleBookSlot(slot)}
              disabled={booking}
              className="bg-white border-2 border-black rounded-xl p-4 text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-slate-500 shrink-0" />
                <span className="font-bold text-slate-900 capitalize">{formatDate(slot.slot_date)}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-sm">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{formatTime(slot.slot_time)}</span>
                {slot.format && <span className="ml-2 bg-slate-100 px-2 py-0.5 rounded-full text-xs font-medium">{slot.format}</span>}
              </div>
              {slot.interviewer_name && (
                <div className="flex items-center gap-3 text-slate-500 text-sm mt-1">
                  <User className="w-4 h-4 shrink-0" />
                  <span>{slot.interviewer_name}</span>
                </div>
              )}
              {slot.location && (
                <div className="flex items-center gap-3 text-slate-500 text-sm mt-1">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>{slot.location}</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {booking && (
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Confirmando...</span>
          </div>
        )}
      </div>
    </div>
  );
};

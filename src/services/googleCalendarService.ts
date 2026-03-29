import { calendar, auth } from '@googleapis/calendar';

const calendarId = process.env.GOOGLE_CALENDAR_ID || '';

function buildCalendar(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const oauth2 = new auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
  oauth2.setCredentials({ refresh_token: refreshToken });
  return calendar({ version: 'v3', auth: oauth2 });
}

// Calendário padrão (conta mestre)
const cal = process.env.GOOGLE_REFRESH_TOKEN
  ? buildCalendar(process.env.GOOGLE_REFRESH_TOKEN)
  : null;

// Calendário SDR (conta rfricardofarias48@gmail.com) — usa token próprio se configurado
const sdrCal = process.env.SDR_GOOGLE_REFRESH_TOKEN
  ? buildCalendar(process.env.SDR_GOOGLE_REFRESH_TOKEN)
  : cal; // fallback para o padrão se não tiver token SDR

if (cal) console.log('[Google Calendar] Conta mestre configurada');
if (process.env.SDR_GOOGLE_REFRESH_TOKEN) console.log('[Google Calendar] Conta SDR configurada com token próprio');

export async function createMeetingEvent(eventData: {
  candidateName: string;
  jobTitle: string;
  slotDate: string;
  slotTime: string;
  interviewerName?: string;
  candidateEmail?: string;
  recruiterEmail?: string;
  candidatePhone?: string;
  calendarId?: string;
  useSdrCredentials?: boolean;
}): Promise<{ meetLink: string; eventId: string } | null> {
  const targetCalendarId = eventData.calendarId || calendarId;
  const client = eventData.useSdrCredentials ? sdrCal : cal;

  if (!client || !targetCalendarId) {
    console.warn('[Google Calendar] Serviço não configurado — client:', !!client, 'calendarId:', !!targetCalendarId);
    return null;
  }

  try {
    const [year, month, day] = eventData.slotDate.split('-').map(Number);
    const [hours, minutes] = eventData.slotTime.split(':').map(Number);

    const pad = (n: number) => String(n).padStart(2, '0');
    const startISO = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
    const endISO   = `${year}-${pad(month)}-${pad(day)}T${pad(hours + 1)}:${pad(minutes)}:00`;

    const nameParts = eventData.candidateName.trim().split(/\s+/);
    const shortName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : nameParts[0];

    const whatsappLink = eventData.candidatePhone
      ? `\nWhatsApp: https://wa.me/55${eventData.candidatePhone.replace(/\D/g, '')}`
      : '';

    const event = {
      summary: `${eventData.useSdrCredentials ? 'Demo Elevva' : 'Entrevista'} - ${shortName}`,
      description: `${eventData.useSdrCredentials ? 'Lead' : 'Candidato'}: ${eventData.candidateName}\n${eventData.useSdrCredentials ? 'Produto' : 'Vaga'}: ${eventData.jobTitle}${
        eventData.interviewerName ? `\nResponsável: ${eventData.interviewerName}` : ''
      }${whatsappLink}`,
      start: { dateTime: startISO, timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: endISO,   timeZone: 'America/Sao_Paulo' },
      conferenceData: {
        createRequest: {
          requestId: `event-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      attendees: [
        ...(eventData.recruiterEmail ? [{ email: eventData.recruiterEmail }] : []),
        ...(eventData.candidateEmail ? [{ email: eventData.candidateEmail, displayName: eventData.candidateName }] : []),
      ],
    };

    console.log('[Google Calendar] Criando evento:', event.summary, 'em', eventData.slotDate, eventData.slotTime, '| calendário:', targetCalendarId);

    const response = await client.events.insert({
      calendarId: targetCalendarId,
      requestBody: event as any,
      conferenceDataVersion: 1,
      sendUpdates: 'none',
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri || response.data.hangoutLink;

    console.log('[Google Calendar] Evento criado:', response.data.id, '| Meet:', meetLink);

    return { meetLink: meetLink || '', eventId: response.data.id || '' };
  } catch (err: any) {
    console.error('[Google Calendar] Erro ao criar evento:', err?.message || err);
    if (err?.response?.data) {
      console.error('[Google Calendar] Resposta da API:', JSON.stringify(err.response.data));
    }
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string, useSdrCredentials?: boolean): Promise<boolean> {
  const client = useSdrCredentials ? sdrCal : cal;
  const targetCalendarId = useSdrCredentials
    ? (process.env.SDR_GOOGLE_CALENDAR_ID || calendarId)
    : calendarId;

  if (!client || !targetCalendarId) {
    console.warn('[Google Calendar] Serviço não configurado — não foi possível deletar evento');
    return false;
  }

  try {
    await client.events.delete({ calendarId: targetCalendarId, eventId, sendUpdates: 'none' });
    console.log('[Google Calendar] Evento deletado:', eventId);
    return true;
  } catch (err: any) {
    console.error('[Google Calendar] Erro ao deletar evento:', err?.message || err);
    return false;
  }
}

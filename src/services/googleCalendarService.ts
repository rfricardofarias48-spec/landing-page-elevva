import { calendar_v3 } from '@googleapis/calendar';
import { OAuth2Client } from 'google-auth-library';

const calendarId = process.env.GOOGLE_CALENDAR_ID || '';

function getCalendar(): calendar_v3.Calendar | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new OAuth2Client(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2.setCredentials({ refresh_token: refreshToken });
    console.log('[Google Calendar] Using OAuth2 authentication');
    return new calendar_v3.Calendar({ auth: oauth2 });
  }

  console.warn('[Google Calendar] No credentials configured');
  return null;
}

const calendar = getCalendar();

export async function createMeetingEvent(eventData: {
  candidateName: string;
  jobTitle: string;
  slotDate: string;
  slotTime: string;
  interviewerName?: string;
  candidateEmail?: string;
  recruiterEmail?: string;
  candidatePhone?: string;
}): Promise<{ meetLink: string; eventId: string } | null> {
  if (!calendar || !calendarId) {
    console.warn('[Google Calendar] Service not configured — calendar:', !!calendar, 'calendarId:', !!calendarId);
    return null;
  }

  try {
    const [year, month, day] = eventData.slotDate.split('-').map(Number);
    const [hours, minutes] = eventData.slotTime.split(':').map(Number);

    // Build ISO-like string WITHOUT 'Z' so Google respects the timeZone field (America/Sao_Paulo)
    const pad = (n: number) => String(n).padStart(2, '0');
    const startISO = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
    const endISO = `${year}-${pad(month)}-${pad(day)}T${pad(hours + 1)}:${pad(minutes)}:00`;

    // Use only first + last name for the calendar card
    const nameParts = eventData.candidateName.trim().split(/\s+/);
    const shortName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : nameParts[0];

    const whatsappLink = eventData.candidatePhone
      ? `\nWhatsApp: https://wa.me/55${eventData.candidatePhone.replace(/\D/g, '')}`
      : '';

    const event = {
      summary: `Entrevista - ${shortName}`,
      description: `Candidato: ${eventData.candidateName}\nVaga: ${eventData.jobTitle}${
        eventData.interviewerName ? `\nEntrevistador: ${eventData.interviewerName}` : ''
      }${whatsappLink}`,
      start: {
        dateTime: startISO,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endISO,
        timeZone: 'America/Sao_Paulo',
      },
      conferenceData: {
        createRequest: {
          requestId: `interview-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
      attendees: [
        ...(eventData.recruiterEmail ? [{ email: eventData.recruiterEmail }] : []),
        ...(eventData.candidateEmail ? [{ email: eventData.candidateEmail, displayName: eventData.candidateName }] : []),
      ],
    };

    console.log('[Google Calendar] Creating event:', event.summary, 'at', eventData.slotDate, eventData.slotTime);

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event as any,
      conferenceDataVersion: 1,
      sendUpdates: 'none',
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri || response.data.hangoutLink;

    console.log('[Google Calendar] Event created:', response.data.id, 'Meet Link:', meetLink);

    return {
      meetLink: meetLink || '',
      eventId: response.data.id || '',
    };
  } catch (err: any) {
    console.error('[Google Calendar] Error creating event:', err?.message || err);
    if (err?.response?.data) {
      console.error('[Google Calendar] API response:', JSON.stringify(err.response.data));
    }
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  if (!calendar || !calendarId) {
    console.warn('[Google Calendar] Service not configured — cannot delete event');
    return false;
  }

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'none',
    });
    console.log('[Google Calendar] Event deleted:', eventId);
    return true;
  } catch (err: any) {
    console.error('[Google Calendar] Error deleting event:', err?.message || err);
    return false;
  }
}

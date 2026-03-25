import { google } from 'googleapis';

const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?
  JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) : null;

const calendarId = process.env.GOOGLE_CALENDAR_ID || '';

const auth = serviceAccountKey ? new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/calendar'],
}) : null;

const calendar = auth ? google.calendar({ version: 'v3', auth }) : null;

export async function createMeetingEvent(eventData: {
  candidateName: string;
  jobTitle: string;
  slotDate: string; // YYYY-MM-DD
  slotTime: string; // HH:mm
  interviewerName?: string;
  candidateEmail?: string;
}): Promise<{ meetLink: string; eventId: string } | null> {
  if (!calendar || !calendarId) {
    console.warn('[Google Calendar] Service not configured');
    return null;
  }

  try {
    // Parse date and time
    const [year, month, day] = eventData.slotDate.split('-').map(Number);
    const [hours, minutes] = eventData.slotTime.split(':').map(Number);

    const startTime = new Date(year, month - 1, day, hours, minutes, 0);
    const endTime = new Date(year, month - 1, day, hours + 1, minutes, 0);

    const event = {
      summary: `Entrevista - ${eventData.candidateName} (${eventData.jobTitle})`,
      description: `Candidato: ${eventData.candidateName}\nVaga: ${eventData.jobTitle}${
        eventData.interviewerName ? `\nEntrevistador: ${eventData.interviewerName}` : ''
      }`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      conferenceData: {
        createRequest: {
          requestId: `interview-${Date.now()}`,
          conferenceSolutionKey: {
            key: 'hangoutsMeet',
          },
        },
      },
      ...(eventData.candidateEmail && {
        attendees: [
          {
            email: eventData.candidateEmail,
            displayName: eventData.candidateName,
            responseStatus: 'needsAction',
          },
        ],
      }),
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event as any,
      conferenceDataVersion: 1,
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri || response.data.hangoutLink;

    console.log('[Google Calendar] Event created:', response.data.id, 'Meet Link:', meetLink);

    return {
      meetLink: meetLink || '',
      eventId: response.data.id || '',
    };
  } catch (err) {
    console.error('[Google Calendar] Error creating event:', err);
    return null;
  }
}

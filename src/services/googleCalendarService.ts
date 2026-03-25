import { google } from 'googleapis';

const calendarId = process.env.GOOGLE_CALENDAR_ID || '';

function getAuth() {
  // Priority 1: OAuth2 with refresh token (required for Meet links on Gmail accounts)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2.setCredentials({ refresh_token: refreshToken });
    console.log('[Google Calendar] Using OAuth2 authentication');
    return oauth2;
  }

  // Priority 2: Service Account (works for Workspace, no Meet links on Gmail)
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const key = JSON.parse(saJson);
      console.log('[Google Calendar] Using Service Account authentication');
      return new google.auth.GoogleAuth({
        credentials: key,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
    } catch (err) {
      console.error('[Google Calendar] Failed to parse service account JSON:', err);
    }
  }

  console.warn('[Google Calendar] No credentials configured');
  return null;
}

const auth = getAuth();
const calendar = auth ? google.calendar({ version: 'v3', auth }) : null;

export async function createMeetingEvent(eventData: {
  candidateName: string;
  jobTitle: string;
  slotDate: string;
  slotTime: string;
  interviewerName?: string;
  candidateEmail?: string;
}): Promise<{ meetLink: string; eventId: string } | null> {
  if (!calendar || !calendarId) {
    console.warn('[Google Calendar] Service not configured — calendar:', !!calendar, 'calendarId:', !!calendarId);
    return null;
  }

  try {
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
            type: 'hangoutsMeet',
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

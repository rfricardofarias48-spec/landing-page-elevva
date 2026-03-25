/**
 * Scheduling Page — Server-rendered HTML page for candidates to pick interview slots.
 *
 * Flow:
 *   1. Recruiter triggers scheduling → each interview gets a unique token
 *   2. Bento sends WhatsApp: "Clique no link para agendar: /api/agendar/{token}"
 *   3. Candidate opens → sees available slots grouped by date
 *   4. Candidate picks a slot → page confirms booking
 *   5. Same link allows rescheduling later
 */

export interface SchedulingPageData {
  token: string;
  candidateName: string;
  jobTitle: string;
  interviewerName: string | null;
  format: string; // ONLINE | PRESENCIAL
  location: string | null;
  currentBooking: {
    slotId: string;
    date: string;
    time: string;
  } | null;
  slots: Array<{
    id: string;
    date: string;       // YYYY-MM-DD
    time: string;       // HH:MM
    dateLabel: string;   // "terça-feira, 25 de mar."
    timeLabel: string;   // "14:00"
    isBooked: boolean;
  }>;
}

export function renderSchedulingPage(data: SchedulingPageData): string {
  const { token, candidateName, jobTitle, interviewerName, format, location, currentBooking, slots } = data;

  // Group slots by date
  const slotsByDate: Record<string, typeof slots> = {};
  for (const slot of slots) {
    if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
    slotsByDate[slot.date].push(slot);
  }

  const firstName = candidateName?.split(' ')[0] || 'Candidato';
  const isReschedule = !!currentBooking;

  const formatBadge = format === 'ONLINE'
    ? '<span style="background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">💻 Online</span>'
    : '<span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">🏢 Presencial</span>';

  const locationLine = format === 'PRESENCIAL' && location
    ? `<p style="color:#64748b;font-size:13px;margin:4px 0">📍 ${location}</p>`
    : '';

  const interviewerLine = interviewerName
    ? `<p style="color:#64748b;font-size:13px;margin:4px 0">👤 Entrevistador(a): <strong>${interviewerName}</strong></p>`
    : '';

  const currentBookingHTML = currentBooking
    ? `<div id="current-booking" style="background:#f0fdf4;border:2px solid #84cc16;border-radius:16px;padding:16px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:700">✅ Entrevista agendada</p>
        <p style="margin:4px 0 0;font-size:15px;font-weight:800;color:#15803d">${formatDatePTBR(currentBooking.date)} às ${currentBooking.time}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#166534">Deseja reagendar? Escolha um novo horário abaixo.</p>
      </div>`
    : '';

  // Build slot cards grouped by date
  let slotsHTML = '';
  for (const [date, dateSlots] of Object.entries(slotsByDate)) {
    const availableSlots = dateSlots.filter(s => !s.isBooked || s.id === currentBooking?.slotId);
    if (availableSlots.length === 0) continue;

    slotsHTML += `<div style="margin-bottom:16px">
      <p style="font-size:13px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;padding-left:4px">📅 ${formatDatePTBR(date)}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">`;

    for (const slot of availableSlots) {
      const isCurrent = slot.id === currentBooking?.slotId;
      const style = isCurrent
        ? 'background:#84cc16;color:white;border:2px solid #65a30d'
        : 'background:white;color:#1e293b;border:2px solid #e2e8f0';
      const hoverClass = isCurrent ? '' : 'slot-btn';
      const label = isCurrent ? `${slot.timeLabel} ✓` : slot.timeLabel;

      slotsHTML += `<button class="${hoverClass}" data-slot-id="${slot.id}" data-date="${slot.date}" data-time="${slot.time}"
        style="${style};padding:12px 8px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s;text-align:center"
        ${isCurrent ? 'disabled' : ''}>${label}</button>`;
    }

    slotsHTML += `</div></div>`;
  }

  if (!slotsHTML) {
    slotsHTML = `<div style="text-align:center;padding:40px 20px;color:#64748b">
      <p style="font-size:48px;margin:0">😔</p>
      <p style="font-weight:700;font-size:16px">Todos os horários foram preenchidos</p>
      <p style="font-size:13px">Aguarde contato do recrutador com novas opções.</p>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agendar Entrevista — ${jobTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; min-height: 100vh; }
    .slot-btn:hover { background: #f0fdf4 !important; border-color: #84cc16 !important; transform: scale(1.05); }
    .slot-btn:active { transform: scale(0.97); }
    #confirmation { display: none; }
    #loading { display: none; position: fixed; inset: 0; background: rgba(255,255,255,0.85); z-index: 100; justify-content: center; align-items: center; }
    #loading.active { display: flex; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #84cc16; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
    .animate { animation: slideUp 0.4s ease-out; }
  </style>
</head>
<body>
  <div id="loading"><div class="spinner"></div></div>

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:24px 20px;text-align:center">
    <p style="font-size:20px;font-weight:900;color:white;letter-spacing:-0.5px;margin-bottom:2px">Elevva</p>
    <p style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px">Recrutamento Inteligente</p>
  </div>

  <!-- MAIN CONTENT -->
  <div id="slot-selection" class="animate" style="max-width:480px;margin:0 auto;padding:20px">
    <!-- Greeting -->
    <div style="text-align:center;margin-bottom:20px">
      <p style="font-size:14px;color:#64748b;font-weight:600">Olá, <strong style="color:#1e293b">${firstName}</strong>!</p>
      <h1 style="font-size:20px;font-weight:900;color:#0f172a;margin:4px 0;line-height:1.3">
        ${isReschedule ? 'Reagendar Entrevista' : 'Agendar Entrevista'}
      </h1>
    </div>

    <!-- Job info card -->
    <div style="background:white;border-radius:16px;padding:16px;margin-bottom:20px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <p style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:8px">${jobTitle}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
        ${formatBadge}
      </div>
      ${interviewerLine}
      ${locationLine}
    </div>

    ${currentBookingHTML}

    <!-- Slots -->
    <h2 style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:12px">Horários disponíveis</h2>
    ${slotsHTML}
  </div>

  <!-- CONFIRMATION (shown after booking) -->
  <div id="confirmation" class="animate" style="max-width:480px;margin:0 auto;padding:20px;text-align:center">
    <div style="width:80px;height:80px;background:#f0fdf4;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:40px auto 20px;border:3px solid #84cc16">
      <span style="font-size:36px">✅</span>
    </div>
    <h1 style="font-size:22px;font-weight:900;color:#0f172a;margin-bottom:8px">Entrevista Confirmada!</h1>
    <p id="conf-details" style="font-size:15px;color:#475569;font-weight:600;margin-bottom:24px"></p>
    <div style="background:white;border-radius:16px;padding:20px;border:1px solid #e2e8f0;text-align:left;margin-bottom:20px">
      <p style="font-size:13px;color:#64748b;margin-bottom:4px">Vaga</p>
      <p style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px">${jobTitle}</p>
      ${interviewerName ? `<p style="font-size:13px;color:#64748b;margin-bottom:4px">Entrevistador(a)</p><p style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px">${interviewerName}</p>` : ''}
      <p style="font-size:13px;color:#64748b;margin-bottom:4px">Formato</p>
      <p style="font-size:15px;font-weight:700;color:#0f172a">${format === 'ONLINE' ? '💻 Online' : '🏢 Presencial'}${location ? ' — ' + location : ''}</p>
    </div>
    <a id="cal-link" href="#" target="_blank" style="display:inline-block;background:#1e293b;color:white;padding:14px 28px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;margin-bottom:12px">🗓️ Adicionar ao Google Agenda</a>
    <br>
    <button onclick="showReschedule()" style="background:none;border:none;color:#64748b;font-size:13px;font-weight:600;cursor:pointer;padding:8px;text-decoration:underline">Preciso reagendar</button>
  </div>

  <script>
    const TOKEN = '${token}';
    const BASE = window.location.origin;
    const IS_RESCHEDULE = ${isReschedule};
    const JOB_TITLE = ${JSON.stringify(jobTitle)};
    const FORMAT = ${JSON.stringify(format)};
    const LOCATION = ${JSON.stringify(location || '')};
    const INTERVIEWER = ${JSON.stringify(interviewerName || '')};

    document.querySelectorAll('.slot-btn').forEach(btn => {
      btn.addEventListener('click', () => bookSlot(btn.dataset.slotId, btn.dataset.date, btn.dataset.time));
    });

    async function bookSlot(slotId, date, time) {
      const endpoint = IS_RESCHEDULE ? 'reschedule' : 'book';
      document.getElementById('loading').classList.add('active');

      try {
        const res = await fetch(BASE + '/api/agendar/' + TOKEN + '/' + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot_id: slotId })
        });
        const data = await res.json();
        if (!data.ok) {
          alert(data.error || 'Erro ao agendar. Tente novamente.');
          window.location.reload();
          return;
        }

        // Show confirmation
        document.getElementById('slot-selection').style.display = 'none';
        document.getElementById('confirmation').style.display = 'block';

        const dateObj = new Date(date + 'T' + time + ':00');
        const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        document.getElementById('conf-details').textContent = dateStr + ' as ' + time;

        // Google Calendar link
        const startDate = date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
        const [h, m] = time.split(':').map(Number);
        const endH = String(h + 1).padStart(2, '0');
        const endDate = date.replace(/-/g, '') + 'T' + endH + m.toString().padStart(2, '0') + '00';
        const calParams = new URLSearchParams({
          action: 'TEMPLATE',
          text: 'Entrevista - ' + JOB_TITLE,
          dates: startDate + '/' + endDate,
          details: INTERVIEWER ? 'Entrevistador(a): ' + INTERVIEWER : 'Entrevista para ' + JOB_TITLE,
          location: FORMAT === 'ONLINE' ? 'Online' : LOCATION
        });
        document.getElementById('cal-link').href = 'https://calendar.google.com/calendar/event?' + calParams.toString();

      } catch (err) {
        alert('Erro de conexao. Verifique sua internet e tente novamente.');
      } finally {
        document.getElementById('loading').classList.remove('active');
      }
    }

    function showReschedule() {
      window.location.reload();
    }
  </script>
</body>
</html>`;
}

function formatDatePTBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

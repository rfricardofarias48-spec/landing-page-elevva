/**
 * Scheduling Page — Server-rendered HTML page for candidates to pick interview slots.
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
    date: string;
    time: string;
    dateLabel: string;
    timeLabel: string;
    isBooked: boolean;
  }>;
}

export function renderSchedulingPage(data: SchedulingPageData): string {
  const { token, candidateName, jobTitle, interviewerName, format, location, currentBooking, slots } = data;

  const slotsByDate: Record<string, typeof slots> = {};
  for (const slot of slots) {
    if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
    slotsByDate[slot.date].push(slot);
  }

  const firstName = candidateName?.split(' ')[0] || 'Candidato';
  const isReschedule = !!currentBooking;

  const formatBadge = format === 'ONLINE'
    ? '<span class="badge badge-online">💻 Online</span>'
    : '<span class="badge badge-presencial">🏢 Presencial</span>';

  const locationLine = format === 'PRESENCIAL' && location
    ? `<div class="info-row"><span class="info-icon">📍</span><span>${location}</span></div>`
    : '';

  const interviewerLine = interviewerName
    ? `<div class="info-row"><span class="info-icon">👤</span><span>Entrevistador(a): <strong>${interviewerName}</strong></span></div>`
    : '';

  const currentBookingHTML = currentBooking
    ? `<div class="current-booking">
        <div class="current-booking-icon">✅</div>
        <div>
          <p class="current-booking-label">Entrevista agendada</p>
          <p class="current-booking-time">${formatDatePTBR(currentBooking.date)} às ${currentBooking.time}</p>
          <p class="current-booking-hint">Deseja reagendar? Escolha um novo horário abaixo.</p>
        </div>
      </div>`
    : '';

  let slotsHTML = '';
  for (const [date, dateSlots] of Object.entries(slotsByDate)) {
    const availableSlots = dateSlots.filter(s => !s.isBooked || s.id === currentBooking?.slotId);
    if (availableSlots.length === 0) continue;

    slotsHTML += `<div class="date-group">
      <div class="date-label">
        <span class="date-icon">📅</span>
        <span>${formatDatePTBR(date).toUpperCase()}</span>
      </div>
      <div class="slots-grid">`;

    for (const slot of availableSlots) {
      const isCurrent = slot.id === currentBooking?.slotId;
      slotsHTML += `<button
        class="slot-btn${isCurrent ? ' slot-btn--active' : ''}"
        data-slot-id="${slot.id}"
        data-date="${slot.date}"
        data-time="${slot.time}"
        ${isCurrent ? 'disabled' : ''}>
        <span class="slot-time">${slot.timeLabel}</span>
        ${isCurrent ? '<span class="slot-check">✓</span>' : ''}
      </button>`;
    }

    slotsHTML += `</div></div>`;
  }

  if (!slotsHTML) {
    slotsHTML = `<div class="empty-state">
      <div class="empty-icon">😔</div>
      <p class="empty-title">Todos os horários foram preenchidos</p>
      <p class="empty-subtitle">Aguarde contato do recrutador com novas opções.</p>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agendar Entrevista — ${jobTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --brand: hsl(82, 84%, 35%);
      --brand-light: hsl(82, 84%, 45%);
      --brand-pale: hsl(82, 80%, 95%);
      --brand-border: hsl(82, 60%, 75%);
      --navy: #0f172a;
      --navy-mid: #1e293b;
      --slate: #334155;
      --muted: #64748b;
      --border: #e2e8f0;
      --bg: #f1f5f9;
      --white: #ffffff;
      --success: #16a34a;
      --success-pale: #f0fdf4;
      --radius: 16px;
      --shadow: 0 4px 24px rgba(15,23,42,0.08);
      --shadow-sm: 0 1px 4px rgba(15,23,42,0.06);
    }

    body {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background: var(--bg);
      min-height: 100vh;
      color: var(--navy);
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, var(--navy-mid) 0%, var(--navy) 100%);
      padding: 20px 24px 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 200px; height: 200px;
      background: var(--brand);
      border-radius: 50%;
      opacity: 0.07;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -40px; left: -40px;
      width: 150px; height: 150px;
      background: var(--brand-light);
      border-radius: 50%;
      opacity: 0.06;
    }
    .header-logo {
      font-size: 22px;
      font-weight: 900;
      color: var(--white);
      letter-spacing: -0.5px;
      position: relative;
    }
    .header-logo span {
      color: var(--brand-light);
    }
    .header-tagline {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 2px;
      position: relative;
    }

    /* ── Main ── */
    .main {
      max-width: 480px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }

    /* ── Greeting ── */
    .greeting {
      text-align: center;
      margin-bottom: 24px;
      animation: slideUp 0.4s ease-out;
    }
    .greeting-hi {
      font-size: 14px;
      color: var(--muted);
      font-weight: 500;
      margin-bottom: 4px;
    }
    .greeting-hi strong { color: var(--slate); }
    .greeting-title {
      font-size: 24px;
      font-weight: 900;
      color: var(--navy);
      line-height: 1.2;
    }
    .greeting-title span { color: var(--brand); }

    /* ── Job card ── */
    .job-card {
      background: var(--white);
      border-radius: var(--radius);
      padding: 18px 20px;
      margin-bottom: 20px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      animation: slideUp 0.4s ease-out 0.05s both;
    }
    .job-title {
      font-size: 17px;
      font-weight: 800;
      color: var(--navy);
      margin-bottom: 10px;
    }
    .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .badge {
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .badge-online { background: #dbeafe; color: #1d4ed8; }
    .badge-presencial { background: #fef3c7; color: #92400e; }
    .info-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
      margin-top: 4px;
    }
    .info-icon { font-size: 14px; }

    /* ── Current booking ── */
    .current-booking {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      background: var(--success-pale);
      border: 2px solid var(--brand-border);
      border-radius: var(--radius);
      padding: 16px;
      margin-bottom: 20px;
      animation: slideUp 0.4s ease-out 0.1s both;
    }
    .current-booking-icon { font-size: 22px; flex-shrink: 0; }
    .current-booking-label { font-size: 11px; font-weight: 700; color: var(--success); text-transform: uppercase; letter-spacing: 0.5px; }
    .current-booking-time { font-size: 16px; font-weight: 800; color: #14532d; margin-top: 2px; }
    .current-booking-hint { font-size: 12px; color: var(--success); margin-top: 4px; }

    /* ── Slots section ── */
    .slots-heading {
      font-size: 13px;
      font-weight: 800;
      color: var(--slate);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideUp 0.4s ease-out 0.1s both;
    }
    .slots-heading::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    .date-group { margin-bottom: 20px; animation: slideUp 0.4s ease-out 0.15s both; }
    .date-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 800;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
      background: var(--brand-pale);
      padding: 6px 12px;
      border-radius: 8px;
      width: fit-content;
    }
    .date-icon { font-size: 13px; }

    .slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 10px;
    }

    .slot-btn {
      position: relative;
      background: var(--white);
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 14px 8px;
      cursor: pointer;
      transition: all 0.18s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      box-shadow: var(--shadow-sm);
    }
    .slot-btn:hover {
      border-color: var(--brand);
      background: var(--brand-pale);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(100,163,13,0.15);
    }
    .slot-btn:active { transform: scale(0.96); }
    .slot-btn--active {
      background: var(--brand);
      border-color: var(--brand);
      box-shadow: 0 4px 16px rgba(100,163,13,0.3);
    }
    .slot-btn--active .slot-time { color: var(--white); }
    .slot-time {
      font-size: 16px;
      font-weight: 800;
      color: var(--navy);
      font-variant-numeric: tabular-nums;
    }
    .slot-check { font-size: 11px; color: var(--white); font-weight: 700; }

    /* ── Empty state ── */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-title { font-size: 16px; font-weight: 700; color: var(--slate); margin-bottom: 6px; }
    .empty-subtitle { font-size: 13px; color: var(--muted); }

    /* ── Confirmation ── */
    #confirmation {
      display: none;
      text-align: center;
      animation: slideUp 0.45s ease-out;
    }
    .conf-check {
      width: 88px; height: 88px;
      background: var(--brand);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 40px auto 24px;
      font-size: 40px;
      box-shadow: 0 8px 32px rgba(100,163,13,0.35);
      animation: pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275);
    }
    @keyframes pop {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .conf-title {
      font-size: 26px;
      font-weight: 900;
      color: var(--navy);
      margin-bottom: 6px;
    }
    .conf-subtitle {
      font-size: 15px;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 28px;
    }
    .conf-card {
      background: var(--white);
      border-radius: var(--radius);
      padding: 20px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      text-align: left;
      margin-bottom: 20px;
    }
    .conf-row { margin-bottom: 14px; }
    .conf-row:last-child { margin-bottom: 0; }
    .conf-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 2px; }
    .conf-value { font-size: 15px; font-weight: 700; color: var(--navy); }
    .conf-value--date { font-size: 17px; color: var(--brand); }

    .btn-cal {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: var(--navy);
      color: var(--white);
      padding: 14px 28px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14px;
      text-decoration: none;
      margin-bottom: 12px;
      transition: background 0.2s;
    }
    .btn-cal:hover { background: var(--navy-mid); }
    .btn-reschedule {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 8px;
      font-family: inherit;
      text-decoration: underline;
    }

    /* ── Loading overlay ── */
    #loading {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,0.4);
      backdrop-filter: blur(4px);
      z-index: 100;
      justify-content: center;
      align-items: center;
    }
    #loading.active { display: flex; }
    .spinner-wrap {
      background: var(--white);
      border-radius: 20px;
      padding: 28px 36px;
      text-align: center;
      box-shadow: var(--shadow);
    }
    .spinner {
      width: 44px; height: 44px;
      border: 4px solid var(--border);
      border-top-color: var(--brand);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto 12px;
    }
    .spinner-text { font-size: 13px; font-weight: 600; color: var(--slate); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>

<div id="loading">
  <div class="spinner-wrap">
    <div class="spinner"></div>
    <p class="spinner-text">Confirmando horário…</p>
  </div>
</div>

<!-- HEADER -->
<div class="header">
  <p class="header-logo">Ele<span>vva</span></p>
  <p class="header-tagline">Recrutamento Inteligente</p>
</div>

<!-- SLOT SELECTION -->
<div id="slot-selection" class="main">
  <div class="greeting">
    <p class="greeting-hi">Olá, <strong>${firstName}</strong>! 👋</p>
    <h1 class="greeting-title">${isReschedule ? 'Reagendar <span>Entrevista</span>' : 'Agendar <span>Entrevista</span>'}</h1>
  </div>

  <div class="job-card">
    <p class="job-title">${jobTitle}</p>
    <div class="badges">${formatBadge}</div>
    ${interviewerLine}
    ${locationLine}
  </div>

  ${currentBookingHTML}

  <div class="slots-heading">Horários disponíveis</div>
  ${slotsHTML}
</div>

<!-- CONFIRMATION -->
<div id="confirmation" class="main">
  <div class="conf-check">✅</div>
  <h1 class="conf-title">Tudo certo!</h1>
  <p id="conf-details" class="conf-subtitle"></p>

  <div class="conf-card">
    <div class="conf-row">
      <p class="conf-label">📅 Data e Horário</p>
      <p class="conf-value conf-value--date" id="conf-datetime"></p>
    </div>
    <div class="conf-row">
      <p class="conf-label">💼 Vaga</p>
      <p class="conf-value">${jobTitle}</p>
    </div>
    ${interviewerName ? `<div class="conf-row"><p class="conf-label">👤 Entrevistador(a)</p><p class="conf-value">${interviewerName}</p></div>` : ''}
    <div class="conf-row">
      <p class="conf-label">📡 Formato</p>
      <p class="conf-value">${format === 'ONLINE' ? '💻 Online' : '🏢 Presencial'}${location ? ' — ' + location : ''}</p>
    </div>
  </div>

  <a id="cal-link" href="#" target="_blank" class="btn-cal">🗓️ Adicionar ao Google Agenda</a>
  <br>
  <button onclick="showReschedule()" class="btn-reschedule">Preciso reagendar</button>
</div>

<script>
  const TOKEN = '${token}';
  const BASE = window.location.origin;
  const IS_RESCHEDULE = ${isReschedule};
  const JOB_TITLE = ${JSON.stringify(jobTitle)};
  const FORMAT = ${JSON.stringify(format)};
  const LOCATION = ${JSON.stringify(location || '')};
  const INTERVIEWER = ${JSON.stringify(interviewerName || '')};

  document.querySelectorAll('.slot-btn:not([disabled])').forEach(btn => {
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

      document.getElementById('slot-selection').style.display = 'none';
      document.getElementById('confirmation').style.display = 'block';

      const dateObj = new Date(date + 'T12:00:00');
      const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      const capitalised = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      document.getElementById('conf-datetime').textContent = capitalised + ' às ' + time;
      document.getElementById('conf-details').textContent = 'Sua entrevista está confirmada!';

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
      alert('Erro de conexão. Verifique sua internet e tente novamente.');
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

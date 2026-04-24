/**
 * Scheduling Page — Server-rendered HTML page for candidates to pick interview slots.
 */

export interface SchedulingPageData {
  token: string;
  candidateName: string;
  jobTitle: string;
  interviewerName: string | null;
  format: string;
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

  const currentBookingHTML = currentBooking
    ? `<div class="notice">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style="flex-shrink:0;margin-top:1px">
          <circle cx="7.5" cy="7.5" r="6.75" stroke="#4a7a0f" stroke-width="1.5"/>
          <path d="M4.5 7.5l2 2 4-4" stroke="#4a7a0f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Agendada para <strong>${formatDatePTBR(currentBooking.date)} às ${currentBooking.time}</strong>. Selecione outro horário para reagendar.</span>
      </div>`
    : '';

  let slotsHTML = '';
  for (const [date, dateSlots] of Object.entries(slotsByDate)) {
    const available = dateSlots.filter(s => !s.isBooked || s.id === currentBooking?.slotId);
    if (available.length === 0) continue;

    const dateLabel = formatDatePTBR(date);
    const [weekday, rest] = dateLabel.split(',');

    slotsHTML += `<div class="date-group">
      <p class="date-label">
        <span class="date-weekday">${weekday.trim()}</span>${rest ? `<span class="date-rest">,${rest}</span>` : ''}
      </p>
      <div class="slots-row">`;

    for (const slot of available) {
      const active = slot.id === currentBooking?.slotId;
      slotsHTML += `<button
        class="slot${active ? ' slot--on' : ''}"
        data-slot-id="${slot.id}"
        data-date="${slot.date}"
        data-time="${slot.time}"
        ${active ? 'disabled' : ''}>
        ${slot.timeLabel}${active ? '&nbsp;✓' : ''}
      </button>`;
    }

    slotsHTML += `</div></div>`;
  }

  if (!slotsHTML) {
    slotsHTML = `<div class="empty">
      <p class="empty-title">Nenhum horário disponível</p>
      <p class="empty-sub">Aguarde contato do recrutador com novas opções.</p>
    </div>`;
  }

  const infoRows = [
    { key: 'Cargo', val: jobTitle },
    ...(interviewerName ? [{ key: 'Entrevistador', val: interviewerName }] : []),
    ...(format === 'PRESENCIAL' && location ? [{ key: 'Local', val: location }] : []),
    { key: 'Formato', val: format === 'ONLINE' ? 'Online' : 'Presencial' },
  ];

  const infoHTML = infoRows.map(r =>
    `<div class="info-row"><span class="info-k">${r.key}</span><span class="info-v">${r.val}</span></div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isReschedule ? 'Reagendar' : 'Agendar'} Entrevista — ${jobTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --g:       #5c8f0e;
      --g-pale:  #f2f8e8;
      --g-mid:   #d4eaa0;
      --ink:     #18181b;
      --ink2:    #3f3f46;
      --muted:   #71717a;
      --line:    #e4e4e7;
      --bg:      #f5f4f0;
      --card:    #ffffff;
      --serif:   'DM Serif Display', Georgia, serif;
      --sans:    'DM Sans', system-ui, sans-serif;
      --radius:  12px;
    }

    body {
      font-family: var(--sans);
      background: var(--bg);
      color: var(--ink);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* ─── Header ─── */
    header {
      background: var(--card);
      border-bottom: 1px solid var(--line);
      padding: 0 24px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    header img { height: 24px; width: auto; display: block; }

    /* ─── Layout ─── */
    .wrap {
      max-width: 420px;
      margin: 0 auto;
      padding: 44px 20px 72px;
      animation: rise 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    /* ─── Hero ─── */
    .eyebrow {
      font-family: var(--sans);
      font-size: 13px;
      font-weight: 500;
      color: var(--muted);
      margin-bottom: 8px;
      letter-spacing: 0.1px;
    }
    h1 {
      font-family: var(--serif);
      font-style: italic;
      font-size: 36px;
      font-weight: 400;
      color: var(--ink);
      line-height: 1.1;
      margin-bottom: 40px;
      letter-spacing: -0.5px;
    }

    /* ─── Info card ─── */
    .info-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
      margin-bottom: 36px;
    }
    .info-row {
      display: grid;
      grid-template-columns: 108px 1fr;
      align-items: baseline;
      gap: 0;
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
    }
    .info-row:last-child { border-bottom: none; }
    .info-k {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.7px;
      padding-top: 1px;
    }
    .info-v {
      font-size: 14px;
      font-weight: 500;
      color: var(--ink2);
      line-height: 1.4;
    }

    /* ─── Notice ─── */
    .notice {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      background: var(--g-pale);
      border: 1px solid var(--g-mid);
      border-radius: var(--radius);
      padding: 13px 15px;
      font-size: 13px;
      color: #2d4d06;
      line-height: 1.55;
      margin-bottom: 32px;
    }

    /* ─── Slots ─── */
    .slots-section { }
    .slots-heading {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.9px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .slots-heading::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--line);
    }

    .date-group { margin-bottom: 28px; }
    .date-label { margin-bottom: 12px; }
    .date-weekday {
      font-family: var(--sans);
      font-size: 13px;
      font-weight: 700;
      color: var(--ink);
      text-transform: capitalize;
    }
    .date-rest {
      font-size: 13px;
      font-weight: 400;
      color: var(--muted);
    }

    .slots-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .slot {
      font-family: var(--sans);
      font-size: 14px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.2px;
      color: var(--ink2);
      background: var(--card);
      border: 1.5px solid var(--line);
      border-radius: 999px;
      padding: 9px 22px;
      cursor: pointer;
      transition: border-color 0.14s, background 0.14s, color 0.14s, transform 0.1s, box-shadow 0.14s;
      white-space: nowrap;
    }
    .slot:hover {
      border-color: var(--g);
      color: var(--g);
      background: var(--g-pale);
      transform: translateY(-1px);
      box-shadow: 0 3px 12px rgba(92,143,14,0.14);
    }
    .slot:active { transform: scale(0.96); }
    .slot--on {
      background: var(--g);
      border-color: var(--g);
      color: #fff;
      box-shadow: 0 2px 10px rgba(92,143,14,0.28);
      cursor: default;
    }

    /* ─── Empty ─── */
    .empty { padding: 48px 0; text-align: center; }
    .empty-title { font-size: 15px; font-weight: 600; color: var(--ink2); margin-bottom: 5px; }
    .empty-sub { font-size: 13px; color: var(--muted); }

    /* ─── Confirmation ─── */
    #confirmation { display: none; }
    .conf-check {
      width: 52px; height: 52px;
      background: var(--g);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 18px;
      animation: pop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }
    .conf-check svg { width: 24px; height: 24px; }
    .conf-h {
      font-family: var(--serif);
      font-style: italic;
      font-size: 30px;
      font-weight: 400;
      color: var(--ink);
      margin-bottom: 6px;
      letter-spacing: -0.3px;
    }
    .conf-p { font-size: 14px; color: var(--muted); margin-bottom: 32px; line-height: 1.5; }

    .conf-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
      margin-bottom: 24px;
    }
    .conf-row {
      display: grid;
      grid-template-columns: 108px 1fr;
      align-items: baseline;
      gap: 0;
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
    }
    .conf-row:last-child { border-bottom: none; }
    .conf-k { font-size: 10.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.7px; }
    .conf-v { font-size: 14px; font-weight: 500; color: var(--ink2); }
    .conf-v--date { color: var(--g); font-weight: 600; }

    .btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 13px 20px;
      font-family: var(--sans); font-size: 14px; font-weight: 600;
      border-radius: var(--radius); border: none; cursor: pointer;
      text-decoration: none; transition: opacity 0.15s;
      margin-bottom: 10px;
    }
    .btn--dark { background: var(--ink); color: #fff; }
    .btn--dark:hover { opacity: 0.85; }
    .btn--ghost { background: none; color: var(--muted); text-decoration: underline; font-size: 13px; }

    /* ─── Loading ─── */
    #loading {
      display: none; position: fixed; inset: 0;
      background: rgba(245,244,240,0.8); backdrop-filter: blur(8px);
      z-index: 99; align-items: center; justify-content: center;
    }
    #loading.on { display: flex; }
    .spin {
      width: 34px; height: 34px;
      border: 3px solid var(--line); border-top-color: var(--g);
      border-radius: 50%; animation: spin 0.65s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes rise {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pop {
      from { transform: scale(0.55); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }
  </style>
</head>
<body>

<div id="loading"><div class="spin"></div></div>

<header>
  <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png" alt="Elevva">
</header>

<!-- SLOT SELECTION -->
<div id="slot-selection" class="wrap">
  <p class="eyebrow">Olá, ${firstName} 👋</p>
  <h1>${isReschedule ? 'Reagende sua entrevista' : 'Escolha seu horário'}</h1>

  <div class="info-card">${infoHTML}</div>

  ${currentBookingHTML}

  <div class="slots-section">
    <p class="slots-heading">Horários disponíveis</p>
    ${slotsHTML}
  </div>
</div>

<!-- CONFIRMATION -->
<div id="confirmation" class="wrap">
  <div class="conf-check">
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 12l5 5L20 6" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <h1 class="conf-h" style="font-style:italic">Tudo confirmado!</h1>
  <p class="conf-p">Sua entrevista foi agendada com sucesso.</p>

  <div class="conf-card">
    <div class="conf-row">
      <span class="conf-k">Data e horário</span>
      <span class="conf-v conf-v--date" id="conf-datetime">—</span>
    </div>
    <div class="conf-row">
      <span class="conf-k">Cargo</span>
      <span class="conf-v">${jobTitle}</span>
    </div>
    ${interviewerName ? `<div class="conf-row"><span class="conf-k">Entrevistador</span><span class="conf-v">${interviewerName}</span></div>` : ''}
    <div class="conf-row">
      <span class="conf-k">Formato</span>
      <span class="conf-v">${format === 'ONLINE' ? 'Online' : 'Presencial'}${location ? ' · ' + location : ''}</span>
    </div>
  </div>

  <a id="cal-link" href="#" target="_blank" class="btn btn--dark">
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="2" width="13" height="12" rx="2" stroke="white" stroke-width="1.3"/>
      <path d="M1 5.5h13M5 1v2.5M10 1v2.5" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    Adicionar ao Google Agenda
  </a>
  <button onclick="showReschedule()" class="btn btn--ghost">Preciso reagendar</button>
</div>

<script>
  const TOKEN = '${token}';
  const BASE = window.location.origin;
  const IS_RESCHEDULE = ${isReschedule};
  const JOB_TITLE = ${JSON.stringify(jobTitle)};
  const FORMAT = ${JSON.stringify(format)};
  const LOCATION = ${JSON.stringify(location || '')};
  const INTERVIEWER = ${JSON.stringify(interviewerName || '')};

  document.querySelectorAll('.slot:not([disabled])').forEach(b =>
    b.addEventListener('click', () => book(b.dataset.slotId, b.dataset.date, b.dataset.time))
  );

  async function book(slotId, date, time) {
    document.getElementById('loading').classList.add('on');
    try {
      const res = await fetch(BASE + '/api/agendar/' + TOKEN + '/' + (IS_RESCHEDULE ? 'reschedule' : 'book'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId })
      });
      const data = await res.json();
      if (!data.ok) { alert(data.error || 'Erro ao agendar. Tente novamente.'); window.location.reload(); return; }

      document.getElementById('slot-selection').style.display = 'none';
      const conf = document.getElementById('confirmation');
      conf.style.display = 'block';
      conf.classList.add('wrap');

      const d = new Date(date + 'T12:00:00');
      const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      document.getElementById('conf-datetime').textContent =
        label.charAt(0).toUpperCase() + label.slice(1) + ' às ' + time;

      const s = date.replace(/-/g,'') + 'T' + time.replace(':','') + '00';
      const [h, m] = time.split(':').map(Number);
      const e = date.replace(/-/g,'') + 'T' + String(h+1).padStart(2,'0') + String(m).padStart(2,'0') + '00';
      const p = new URLSearchParams({ action:'TEMPLATE', text:'Entrevista - '+JOB_TITLE, dates:s+'/'+e,
        details: INTERVIEWER ? 'Entrevistador(a): '+INTERVIEWER : 'Entrevista para '+JOB_TITLE,
        location: FORMAT==='ONLINE' ? 'Online' : LOCATION });
      document.getElementById('cal-link').href = 'https://calendar.google.com/calendar/event?' + p;
    } catch { alert('Erro de conexão. Verifique sua internet.'); }
    finally { document.getElementById('loading').classList.remove('on'); }
  }

  function showReschedule() { window.location.reload(); }
</script>
</body>
</html>`;
}

function formatDatePTBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}

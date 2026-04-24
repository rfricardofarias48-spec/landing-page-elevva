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

  const metaLine = [
    format === 'ONLINE' ? 'Online' : 'Presencial',
    interviewerName ? interviewerName : null,
    format === 'PRESENCIAL' && location ? location : null,
  ].filter(Boolean).join(' · ');

  const currentBookingHTML = currentBooking
    ? `<div class="rebooking-notice">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.25" stroke="#5a7a2e" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#5a7a2e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Agendada para <strong>${formatDatePTBR(currentBooking.date)} às ${currentBooking.time}</strong> — escolha outro horário para reagendar.
      </div>`
    : '';

  let slotsHTML = '';
  for (const [date, dateSlots] of Object.entries(slotsByDate)) {
    const available = dateSlots.filter(s => !s.isBooked || s.id === currentBooking?.slotId);
    if (available.length === 0) continue;

    slotsHTML += `<div class="date-group">
      <p class="date-label">${formatDatePTBR(date)}</p>
      <div class="slots-grid">`;

    for (const slot of available) {
      const active = slot.id === currentBooking?.slotId;
      slotsHTML += `<button
        class="slot${active ? ' slot--active' : ''}"
        data-slot-id="${slot.id}"
        data-date="${slot.date}"
        data-time="${slot.time}"
        ${active ? 'disabled' : ''}>
        ${slot.timeLabel}${active ? ' ✓' : ''}
      </button>`;
    }

    slotsHTML += `</div></div>`;
  }

  if (!slotsHTML) {
    slotsHTML = `<div class="empty">
      <p class="empty-title">Sem horários disponíveis</p>
      <p class="empty-sub">Aguarde contato do recrutador com novas opções.</p>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isReschedule ? 'Reagendar' : 'Agendar'} Entrevista — ${jobTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --green: #6aa017;
      --green-dim: #f4f9ec;
      --green-border: #c9e08a;
      --ink: #111827;
      --ink-2: #374151;
      --muted: #6b7280;
      --line: #e5e7eb;
      --bg: #fafafa;
      --white: #ffffff;
      --r: 10px;
    }

    body {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      min-height: 100vh;
    }

    /* ── Top bar ── */
    .topbar {
      background: var(--white);
      border-bottom: 1px solid var(--line);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .topbar img { height: 28px; width: auto; }

    /* ── Page ── */
    .page {
      max-width: 440px;
      margin: 0 auto;
      padding: 40px 20px 64px;
    }

    /* ── Hero text ── */
    .hero { margin-bottom: 32px; }
    .hero-eyebrow {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .hero-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--ink);
      line-height: 1.2;
      margin-bottom: 4px;
    }
    .hero-sub {
      font-size: 14px;
      color: var(--muted);
    }

    /* ── Job info ── */
    .job-info {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: var(--r);
      padding: 14px 18px;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .job-info-row { display: flex; align-items: baseline; gap: 6px; }
    .job-info-key { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; min-width: 90px; }
    .job-info-val { font-size: 13px; font-weight: 600; color: var(--ink-2); }

    /* ── Rebooking notice ── */
    .rebooking-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--green-dim);
      border: 1px solid var(--green-border);
      border-radius: var(--r);
      padding: 12px 14px;
      font-size: 13px;
      color: #3d5a10;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    .rebooking-notice svg { flex-shrink: 0; }

    /* ── Section label ── */
    .section-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 16px;
    }

    /* ── Date group ── */
    .date-group { margin-bottom: 24px; }
    .date-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-2);
      margin-bottom: 10px;
    }
    .slots-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* ── Slot button ── */
    .slot {
      background: var(--white);
      border: 1.5px solid var(--line);
      border-radius: var(--r);
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;
      color: var(--ink);
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.12s;
      letter-spacing: -0.2px;
    }
    .slot:hover {
      border-color: var(--green);
      background: var(--green-dim);
      color: var(--green);
      transform: translateY(-1px);
    }
    .slot:active { transform: scale(0.97); }
    .slot--active {
      background: var(--green);
      border-color: var(--green);
      color: var(--white);
      cursor: default;
    }

    /* ── Empty ── */
    .empty {
      padding: 40px 0;
      text-align: center;
    }
    .empty-title { font-size: 15px; font-weight: 700; color: var(--ink-2); margin-bottom: 4px; }
    .empty-sub { font-size: 13px; color: var(--muted); }

    /* ── Divider ── */
    .divider { height: 1px; background: var(--line); margin: 28px 0; }

    /* ── Confirmation ── */
    #confirmation { display: none; }
    .conf-icon {
      width: 56px; height: 56px;
      background: var(--green);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 20px;
      animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .conf-icon svg { width: 26px; height: 26px; }
    .conf-title { font-size: 22px; font-weight: 800; color: var(--ink); margin-bottom: 4px; }
    .conf-sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }
    .conf-table {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: var(--r);
      overflow: hidden;
      margin-bottom: 24px;
    }
    .conf-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      gap: 16px;
    }
    .conf-row:last-child { border-bottom: none; }
    .conf-key { font-size: 12px; color: var(--muted); font-weight: 500; white-space: nowrap; }
    .conf-val { font-size: 13px; font-weight: 700; color: var(--ink-2); text-align: right; }
    .conf-val--date { color: var(--green); font-size: 14px; }

    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 13px;
      background: var(--ink);
      color: var(--white);
      border-radius: var(--r);
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: opacity 0.15s;
      margin-bottom: 10px;
    }
    .btn-primary:hover { opacity: 0.88; }
    .btn-ghost {
      width: 100%;
      padding: 10px;
      background: none;
      border: none;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      text-decoration: underline;
    }

    /* ── Loading ── */
    #loading {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(250,250,250,0.75);
      backdrop-filter: blur(6px);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    #loading.active { display: flex; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid var(--line);
      border-top-color: var(--green);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pop {
      from { transform: scale(0.6); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }
    @keyframes up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .page { animation: up 0.35s ease-out; }
  </style>
</head>
<body>

<div id="loading"><div class="spinner"></div></div>

<!-- TOP BAR -->
<div class="topbar">
  <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png" alt="Elevva">
</div>

<!-- SLOT SELECTION -->
<div id="slot-selection" class="page">

  <div class="hero">
    <p class="hero-eyebrow">Olá, ${firstName} 👋</p>
    <h1 class="hero-title">${isReschedule ? 'Reagendar sua entrevista' : 'Escolha seu horário'}</h1>
    <p class="hero-sub">${isReschedule ? 'Selecione um novo horário abaixo.' : 'Selecione o melhor horário para sua entrevista.'}</p>
  </div>

  <div class="job-info">
    <div class="job-info-row">
      <span class="job-info-key">Cargo</span>
      <span class="job-info-val">${jobTitle}</span>
    </div>
    ${interviewerName ? `<div class="job-info-row"><span class="job-info-key">Entrevistador</span><span class="job-info-val">${interviewerName}</span></div>` : ''}
    ${format === 'PRESENCIAL' && location ? `<div class="job-info-row"><span class="job-info-key">Local</span><span class="job-info-val">${location}</span></div>` : ''}
  </div>

  ${currentBookingHTML}

  <p class="section-label">Horários disponíveis</p>
  ${slotsHTML}

</div>

<!-- CONFIRMATION -->
<div id="confirmation" class="page">
  <div class="conf-icon">
    <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 13l5 5L21 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <h1 class="conf-title">Entrevista confirmada!</h1>
  <p class="conf-sub">Você receberá uma mensagem de confirmação em breve.</p>

  <div class="conf-table">
    <div class="conf-row">
      <span class="conf-key">Data e horário</span>
      <span class="conf-val conf-val--date" id="conf-datetime">—</span>
    </div>
    <div class="conf-row">
      <span class="conf-key">Vaga</span>
      <span class="conf-val">${jobTitle}</span>
    </div>
    ${interviewerName ? `<div class="conf-row"><span class="conf-key">Entrevistador(a)</span><span class="conf-val">${interviewerName}</span></div>` : ''}
    <div class="conf-row">
      <span class="conf-key">Formato</span>
      <span class="conf-val">${format === 'ONLINE' ? 'Online' : 'Presencial'}${location ? ' · ' + location : ''}</span>
    </div>
  </div>

  <a id="cal-link" href="#" target="_blank" class="btn-primary">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2.5" width="14" height="12.5" rx="2" stroke="white" stroke-width="1.4"/><path d="M1 6h14M5 1v3M11 1v3" stroke="white" stroke-width="1.4" stroke-linecap="round"/></svg>
    Adicionar ao Google Agenda
  </a>
  <button onclick="showReschedule()" class="btn-ghost">Preciso reagendar</button>
</div>

<script>
  const TOKEN = '${token}';
  const BASE = window.location.origin;
  const IS_RESCHEDULE = ${isReschedule};
  const JOB_TITLE = ${JSON.stringify(jobTitle)};
  const FORMAT = ${JSON.stringify(format)};
  const LOCATION = ${JSON.stringify(location || '')};
  const INTERVIEWER = ${JSON.stringify(interviewerName || '')};

  document.querySelectorAll('.slot:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => bookSlot(btn.dataset.slotId, btn.dataset.date, btn.dataset.time));
  });

  async function bookSlot(slotId, date, time) {
    document.getElementById('loading').classList.add('active');
    try {
      const res = await fetch(BASE + '/api/agendar/' + TOKEN + '/' + (IS_RESCHEDULE ? 'reschedule' : 'book'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId })
      });
      const data = await res.json();
      if (!data.ok) { alert(data.error || 'Erro ao agendar. Tente novamente.'); window.location.reload(); return; }

      document.getElementById('slot-selection').style.display = 'none';
      document.getElementById('confirmation').style.display = 'block';

      const d = new Date(date + 'T12:00:00');
      const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      document.getElementById('conf-datetime').textContent = label.charAt(0).toUpperCase() + label.slice(1) + ' às ' + time;

      const start = date.replace(/-/g,'') + 'T' + time.replace(':','') + '00';
      const [h, m] = time.split(':').map(Number);
      const end = date.replace(/-/g,'') + 'T' + String(h+1).padStart(2,'0') + String(m).padStart(2,'0') + '00';
      const p = new URLSearchParams({ action:'TEMPLATE', text:'Entrevista - '+JOB_TITLE, dates:start+'/'+end,
        details: INTERVIEWER ? 'Entrevistador(a): '+INTERVIEWER : 'Entrevista para '+JOB_TITLE,
        location: FORMAT==='ONLINE' ? 'Online' : LOCATION });
      document.getElementById('cal-link').href = 'https://calendar.google.com/calendar/event?' + p;
    } catch { alert('Erro de conexão. Verifique sua internet.'); }
    finally { document.getElementById('loading').classList.remove('active'); }
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

let STATE = { applications: [], blocks: [] };
let CAL = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Signing in…';
    const res = await Api.login(document.getElementById('username').value.trim(), document.getElementById('password').value);
    btn.disabled = false; btn.textContent = 'Sign in';
    if (res.ok) { showApp(); await loadAll(); }
    else errEl.textContent = res.error || 'Sign in failed';
  });
  document.getElementById('logoutBtn').addEventListener('click', () => { Api.logout(); window.location.reload(); });
  document.getElementById('partialSummaryBtn').addEventListener('click', async () => {
    const btn = document.getElementById('partialSummaryBtn');
    btn.disabled = true; btn.textContent = 'Sending…';
    const res = await Api.sendPartialSummary();
    btn.disabled = false; btn.textContent = "📧 Send month's summary so far (to me only)";
    alert(res.ok ? 'Sent — check your own inbox.' : 'Could not send: ' + (res.error || 'unknown error'));
  });
  if (Api.getToken()) boot();
});

async function boot() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('hidden');
  const check = await Api.getApplications();
  overlay.classList.add('hidden');
  if (!check.ok) return;
  showApp();
  await loadAll();
}
function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}
async function loadAll() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('hidden');
  const [appsRes, blocksRes] = await Promise.all([Api.getApplications(), Api.getBlocks()]);
  overlay.classList.add('hidden');
  if (appsRes.ok) STATE.applications = appsRes.applications;
  if (blocksRes.ok) STATE.blocks = blocksRes.blocks;
  renderCalendar();
}

function renderCalendar() {
  const el = document.getElementById('calendar');
  const events = buildEvents();
  if (CAL) { CAL.removeAllEvents(); events.forEach(ev => CAL.addEvent(ev)); return; }
  CAL = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
    height: 'auto',
    events: events,
    eventClick: (info) => {
      const props = info.event.extendedProps;
      if (props.kind === 'application') openReadOnlyCard(props.appId);
    },
    editable: false,
    selectable: false,
    eventContent: (arg) => {
      const props = arg.event.extendedProps;
      const wrap = document.createElement('div');
      wrap.className = 'fc-evt-wrap';
      if (props.kind === 'application') {
        const badge = document.createElement('span');
        badge.className = 'paybadge ' + payBadgeClass(props.paymentStatus);
        if (payBadgeClass(props.paymentStatus) === 'paid-pay') badge.textContent = '$';
        wrap.appendChild(badge);
      }
      const label = document.createElement('span');
      label.className = 'fc-evt-label';
      label.textContent = arg.event.title;
      wrap.appendChild(label);
      return { domNodes: [wrap] };
    }
    // No eventClick handler at all — nothing is editable from this view.
  });
  CAL.render();
}

function buildEvents() {
  const apps = STATE.applications.filter(a => a.Status === 'Pending' || a.Status === 'Accepted');
  const appEvents = apps.map(a => ({
    title: (a.ApplicantName || 'Booking'), start: a.StartDateTime, end: a.EndDateTime,
    classNames: ['evt-' + slug(a.Status)], extendedProps: { kind: 'application', appId: a.ID, paymentStatus: a.PaymentStatus }
  }));
  const blockEvents = STATE.blocks.map(b => ({
    title: '[' + b.Type + '] ' + b.Label, start: b.StartDateTime, end: b.EndDateTime,
    classNames: ['evt-block'], extendedProps: { kind: 'block' }
  }));
  return appEvents.concat(blockEvents);
}
function payBadgeClass(status) { if (status === 'Paid') return 'paid-pay'; if (status === 'Partial') return 'partial-pay'; return 'pending-pay'; }
function slug(s) { return String(s || '').toLowerCase(); }

// Read-only view of an application — no fields are editable, no save/
// action buttons exist at all, matching the "view but not edit" scope
// agreed for this page.
function openReadOnlyCard(appId) {
  const a = STATE.applications.find(x => x.ID === appId);
  if (!a) return;
  const card = document.getElementById('detailModalCard');
  const nonZero = (label, val) => (val && val !== 'No' && Number(val) !== 0) ? `<div>${label}<strong>${escapeHtml(String(val))}</strong></div>` : '';
  card.innerHTML = `
    <h2>${escapeHtml(a.ApplicantName || '')} <span class="pill pill-${slug(a.Status)}">${a.Status}</span></h2>
    <div class="detail-section">
      <div class="field-grid">
        <div>Email<strong>${escapeHtml(a.ApplicantEmail || '')}</strong></div>
        <div>Phone<strong>${escapeHtml(a.ApplicantPhone || '')}</strong></div>
        <div>Event type<strong>${escapeHtml(a.EventType || '')}</strong></div>
        <div>Date<strong>${fmtDate(a.StartDateTime)}</strong></div>
        <div>Guest count<strong>${escapeHtml(String(a.GuestCount || ''))}</strong></div>
        <div>Payment status<strong>${escapeHtml(a.PaymentStatus || 'Pending')}</strong></div>
      </div>
      ${a._amountsHidden ? '<p class="hint">Payment amounts for this event are no longer shown here (over a month old).</p>' : `
        <div class="field-grid">
          <div>Quote total<strong>R${Number(a.QuoteTotal || 0).toFixed(2)}</strong></div>
          <div>Amount received<strong>R${Number(a.AmountReceived || 0).toFixed(2)}</strong></div>
        </div>`}
    </div>
    <div class="modal-close-row"><button id="closeDetailBtn" class="secondary-btn">Close</button></div>
  `;
  document.getElementById('detailModal').classList.remove('hidden');
  document.getElementById('closeDetailBtn').addEventListener('click', closeReadOnlyCard);
}
function closeReadOnlyCard() { document.getElementById('detailModal').classList.add('hidden'); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReadOnlyCard(); });
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeReadOnlyCard();
  });
});
function fmtDate(d) { if (!d) return ''; const dt = new Date(d); if (isNaN(dt)) return String(d); return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0') + '/' + dt.getFullYear(); }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

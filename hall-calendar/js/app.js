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
    classNames: ['evt-' + slug(a.Status)], extendedProps: { kind: 'application', paymentStatus: a.PaymentStatus }
  }));
  const blockEvents = STATE.blocks.map(b => ({
    title: '[' + b.Type + '] ' + b.Label, start: b.StartDateTime, end: b.EndDateTime,
    classNames: ['evt-block'], extendedProps: { kind: 'block' }
  }));
  return appEvents.concat(blockEvents);
}
function payBadgeClass(status) { if (status === 'Paid') return 'paid-pay'; if (status === 'Partial') return 'partial-pay'; return 'pending-pay'; }
function slug(s) { return String(s || '').toLowerCase(); }

/**
 * CALENDAR.js (manager app)
 * Renders STATE.applications (Pending/Accepted only) + STATE.blocks
 * onto a FullCalendar instance. Colour = planning status. A small
 * CSS-drawn badge (no emoji) = payment status, in its own blue-toned
 * family so it never gets confused with the green/amber/red status
 * colours. Overlapping events get an outlined warning — informational
 * only, never blocking.
 */

let CAL = null;

window.onCalendarTabShown = function () {
  renderCalendar();
  setTimeout(() => CAL && CAL.updateSize(), 50);
};

function renderCalendar() {
  const el = document.getElementById('calendar');
  if (!el) return;
  const events = buildCalendarEvents();

  if (CAL) {
    CAL.removeAllEvents();
    events.forEach(ev => CAL.addEvent(ev));
    return;
  }

  CAL = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
    height: 'auto',
    events: events,
    eventContent: (arg) => {
      const props = arg.event.extendedProps;
      const wrapper = document.createElement('div');
      wrapper.classList.add('fc-evt-wrap');
      if (props.kind === 'application') {
        const badge = document.createElement('span');
        badge.className = 'paybadge ' + payBadgeClass(props.paymentStatus);
        if (payBadgeClass(props.paymentStatus) === 'paid-pay') badge.textContent = '$';
        wrapper.appendChild(badge);
      }
      const label = document.createElement('span');
      label.className = 'fc-evt-label';
      label.textContent = arg.event.title;
      wrapper.appendChild(label);
      return { domNodes: [wrapper] };
    },
    eventClick: (info) => {
      const props = info.event.extendedProps;
      if (props.kind === 'application') {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelector('[data-tab="listView"]').classList.add('active');
        document.getElementById('listView').classList.add('active');
        openDetail(props.appId);
      } else if (props.kind === 'block') {
        const block = STATE.blocks.find(b => b.ID === props.blockId);
        if (block) openBlockModal(block.ID, {
          label: block.Label, type: block.Type, linkedApplicationId: block.LinkedApplicationID,
          startDateTime: block.StartDateTime, endDateTime: block.EndDateTime, notes: block.Notes
        });
      }
    },
    selectable: true,
    select: (info) => openBlockModal(null, { type: 'Internal', startDateTime: info.startStr, endDateTime: info.endStr })
  });
  CAL.render();
}

function buildCalendarEvents() {
  const apps = STATE.applications.filter(a => a.Status === 'Pending' || a.Status === 'Accepted');
  const clashingIds = findClashes(apps, STATE.blocks);

  const appEvents = apps.map(a => ({
    id: 'app-' + a.ID,
    title: (a.ApplicantName || 'Booking') + ' · ' + a.ID,
    start: a.StartDateTime,
    end: a.EndDateTime,
    classNames: [
      'evt-' + slug(a.Status),
      clashingIds.has('app-' + a.ID) ? 'evt-clash' : ''
    ],
    extendedProps: { kind: 'application', appId: a.ID, paymentStatus: a.PaymentStatus }
  }));

  const blockEvents = STATE.blocks.map(b => ({
    id: 'blk-' + b.ID,
    title: '[' + b.Type + '] ' + b.Label,
    start: b.StartDateTime,
    end: b.EndDateTime,
    classNames: ['evt-block', 'evt-block-' + slug(b.Type), clashingIds.has('blk-' + b.ID) ? 'evt-clash' : ''],
    extendedProps: { kind: 'block', blockId: b.ID }
  }));

  return appEvents.concat(blockEvents);
}

function payBadgeClass(status) {
  if (status === 'Paid') return 'paid-pay';
  if (status === 'Partial') return 'partial-pay';
  return 'pending-pay';
}

// Overlap check across applications + blocks. Informational only —
// never blocks anything, since the hall can genuinely host concurrent
// or adjacent events (setup overlapping another booking's operation).
function findClashes(apps, blocks) {
  const items = apps.map(a => ({ id: 'app-' + a.ID, s: new Date(a.StartDateTime), e: new Date(a.EndDateTime) }))
    .concat(blocks.map(b => ({ id: 'blk-' + b.ID, s: new Date(b.StartDateTime), e: new Date(b.EndDateTime) })));
  const clashing = new Set();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].s < items[j].e && items[j].s < items[i].e) { clashing.add(items[i].id); clashing.add(items[j].id); }
    }
  }
  return clashing;
}

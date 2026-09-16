let STATE = {
  applications: [],
  blocks: [],
  config: { reasons: [], rateLines: [], floorSections: [], depositDefaultPct: 20, discountMinPct: -200, discountMaxPct: 200, vatRatePct: 15 },
  currentFilter: 'all',
  secondaryFilter: 'all',
  searchText: '',
  pendingReasonCallback: null,
  pendingEmail: null // { id, emailType }
};

// Items with a per-line discount input in the quote builder (must match
// Config's rate-line "Item" names exactly, since discounts are keyed by name).
const TABLE_ITEMS = [
  { field: 'RoundTableCount', item: 'Round Table', label: 'Round Tables', type: 'number', seatsField: true },
  { field: 'RectTableCount', item: 'Rectangular Table', label: 'Rectangular Tables', type: 'number', seatsField: true },
  { field: 'LongRectTableCount', item: 'Long Rectangular Table', label: 'Long Rectangular Tables', type: 'number', seatsField: true }
];
const QUOTE_ITEMS = [
  { field: 'ChairCount', item: 'Chairs', label: 'Chairs', type: 'number' },
  { field: 'StageRequired', item: 'Stage', label: 'Stage', type: 'yesno' },
  { field: 'KitchenRequired', item: 'Kitchen', label: 'Kitchen', type: 'yesno' },
  { field: 'TuckshopRequired', item: 'Tuckshop', label: 'Tuckshop', type: 'yesno' },
  { field: 'MainPlates', item: 'Main Plates', label: 'Main plates', type: 'number' },
  { field: 'SidePlates', item: 'Side Plates', label: 'Side plates', type: 'number' },
  { field: 'Knives', item: 'Knives', label: 'Knives (packs of 10)', type: 'number' },
  { field: 'Forks', item: 'Forks', label: 'Forks (packs of 10)', type: 'number' },
  { field: 'TableSpoons', item: 'Table Spoons', label: 'Table spoons (packs of 10)', type: 'number' },
  { field: 'TeaSpoons', item: 'Tea Spoons', label: 'Tea spoons (packs of 10)', type: 'number' },
  { field: 'Mugs', item: 'Mugs', label: 'Mugs', type: 'number' },
  { field: 'TeaCups', item: 'Tea Cups', label: 'Tea cups', type: 'number' },
  { field: 'LargeTumblers', item: 'Large Tumblers', label: 'Large tumblers', type: 'number' },
  { field: 'SmallTumblers', item: 'Small Tumblers', label: 'Small tumblers', type: 'number' },
  { field: 'WineGlasses', item: 'Wine Glasses', label: 'Wine glasses', type: 'number' },
  { field: 'Projector', item: 'Projector', label: 'Projector', type: 'yesno' },
  { field: 'PullDownScreen', item: 'Pull-Down Screen', label: 'Pull-down screen', type: 'yesno' },
  { field: 'Microphones', item: 'Microphones', label: 'Microphones', type: 'number' },
  { field: 'SoundSystem', item: 'Sound System', label: 'Sound system', type: 'yesno' }
];

// ---------------------------------------------------------------
// BOOTSTRAP
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  wireLoginForm();
  wireLogout();
  wireTabs();
  wireSearchAndFilter();
  wireNewApplication();
  wireEmailModal();
  wireReasonModal();
  wireChargeModal();
  wireBlockModal();
  wireHelpButton();
  // Esc / click-away closes the applicant detail card only (per the
  // agreed scope — not the other modals), same as the Close button.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('detailModal').classList.contains('hidden')) {
      document.getElementById('detailModal').classList.add('hidden');
    }
  });
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') e.target.classList.add('hidden');
  });
  if (Api.getToken()) boot();
});

async function withLoading(fn) {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('hidden');
  try { return await fn(); } finally { overlay.classList.add('hidden'); }
}

// disables a button for the duration of an async action — the main
// defense against double/triple-click duplicate actions
async function withButtonLoading(btn, label, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = original; }
}

async function boot() {
  const check = await withLoading(() => Api.getApplications());
  if (!check.ok) return;
  showApp();
  await loadAll();
}
function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}
async function loadAll() {
  const [appsRes, cfgRes, blocksRes] = await withLoading(() => Promise.all([Api.getApplications(), Api.getConfig(), Api.getBlocks()]));
  if (appsRes.ok) STATE.applications = appsRes.applications;
  if (cfgRes.ok) STATE.config = cfgRes;
  if (blocksRes.ok) STATE.blocks = blocksRes.blocks;
  renderList();
  if (window.onCalendarTabShown) window.onCalendarTabShown();
}

function wireLoginForm() {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    await withButtonLoading(btn, 'Signing in…', async () => {
      const res = await Api.login(document.getElementById('username').value.trim(), document.getElementById('password').value);
      if (res.ok) { showApp(); await loadAll(); }
      else errEl.textContent = res.error || 'Sign in failed';
    });
  });
}
function wireLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => { Api.logout(); window.location.reload(); });
}

// ---------------------------------------------------------------
// TABS / SEARCH / FILTER
// ---------------------------------------------------------------
function wireTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'calendarView' && window.onCalendarTabShown) window.onCalendarTabShown();
    });
  });
}
function wireSearchAndFilter() {
  document.getElementById('searchBox').addEventListener('input', (e) => {
    STATE.searchText = e.target.value.trim().toLowerCase();
    renderList();
  });
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.currentFilter = chip.dataset.status;
      renderList();
    });
  });
  document.querySelectorAll('.filter-chip-secondary').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip-secondary').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.secondaryFilter = chip.dataset.secondary;
      renderList();
    });
  });
}

function wireNewApplication() {
  document.getElementById('newAppBtn').addEventListener('click', () => openDetail(null));
}
function wireHelpButton() {
  document.getElementById('helpBtn').addEventListener('click', () => {
    window.open('help.html?token=' + encodeURIComponent(Api.getToken()), '_blank');
  });
}

// ---------------------------------------------------------------
// LIST VIEW
// ---------------------------------------------------------------
function renderList() {
  const container = document.getElementById('applicationList');
  let items = STATE.applications.filter(a => STATE.currentFilter === 'all' || a.Status === STATE.currentFilter);
  if (STATE.secondaryFilter && STATE.secondaryFilter !== 'all') {
    const now = new Date();
    items = items.filter(a => {
      if (STATE.secondaryFilter === 'Unpaid') return (a.PaymentStatus || 'Pending') === 'Pending';
      if (STATE.secondaryFilter === 'Partial') return a.PaymentStatus === 'Partial';
      if (STATE.secondaryFilter === 'Paid') return a.PaymentStatus === 'Paid';
      if (STATE.secondaryFilter === 'Upcoming') return a.Status === 'Accepted' && a.StartDateTime && new Date(a.StartDateTime) > now;
      return true;
    });
  }
  if (STATE.searchText) {
    items = items.filter(a =>
      (a.ApplicantName || '').toLowerCase().includes(STATE.searchText) ||
      (a.EventType || '').toLowerCase().includes(STATE.searchText) ||
      (a.ID || '').toLowerCase().includes(STATE.searchText) ||
      fmtDate(a.StartDateTime).toLowerCase().includes(STATE.searchText)
    );
  }
  items = items.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

  if (!items.length) { container.innerHTML = '<p class="empty-state">No applications found.</p>'; return; }

  container.innerHTML = items.map(a => `
    <div class="app-card status-${slug(a.Status)}" data-id="${a.ID}">
      <div class="app-card-top">
        <strong>${escapeHtml(a.ApplicantName || 'Unnamed')} <span class="id-tag">${a.ID}</span></strong>
        <span class="pill pill-${slug(a.Status)}">${a.Status}</span>
      </div>
      <div class="app-card-mid">${escapeHtml(a.EventType || '')} — ${fmtDate(a.StartDateTime)}</div>
      <div class="app-card-bottom"><span class="pill pill-pay pill-${slug(a.PaymentStatus)}">${a.PaymentStatus || 'Pending'}</span></div>
    </div>
  `).join('');
  container.querySelectorAll('.app-card').forEach(card => card.addEventListener('click', () => openDetail(card.dataset.id)));
}

// ---------------------------------------------------------------
// DETAIL MODAL — view mode by default; pencil toggles edit mode
// ---------------------------------------------------------------
function openDetail(id) {
  const isNew = id === null;
  const a = isNew ? blankApplication() : STATE.applications.find(x => x.ID === id);
  if (!a) return;

  const modal = document.getElementById('detailModal');
  const card = document.getElementById('detailModalCard');
  card.dataset.mode = isNew ? 'edit' : 'view';
  card.dataset.id = isNew ? '' : id;
  renderDetail(card, a, isNew);
  modal.classList.remove('hidden');
}

function blankApplication() {
  const blank = {};
  QUOTE_ITEMS.forEach(qi => blank[qi.field] = qi.type === 'yesno' ? 'No' : 0);
  blank.Status = 'Pending'; blank.LineDiscountsJSON = '{}'; blank.OverallDiscountPct = 0;
  return blank;
}

function renderDetail(card, a, isNew) {
  const mode = card.dataset.mode;
  const editing = mode === 'edit';

  card.innerHTML = `
    <div class="modal-header-row">
      <h2>${isNew ? 'New Application' : escapeHtml(a.ApplicantName || '') + ' <span class="id-tag">' + a.ID + '</span>'}</h2>
      ${!isNew ? `<button id="editToggleBtn" class="icon-btn" title="Edit">${editing ? '👁 View' : '✏️ Edit'}</button>` : ''}
    </div>

    <div class="detail-section contact-section">
      <h3>Contact</h3>
      <div class="field-grid">
        ${field('ApplicantName', 'Name', a.ApplicantName, editing, 'text')}
        ${field('ApplicantEmail', 'Email', a.ApplicantEmail, editing, 'email')}
        ${field('ApplicantPhone', 'Phone', a.ApplicantPhone, editing, 'tel')}
      </div>
      ${!isNew ? `<div class="contact-actions">
        <a class="secondary-btn contact-btn" href="tel:${escapeAttr(a.ApplicantPhone || '')}">Call applicant</a>
        <a class="secondary-btn contact-btn" href="${whatsappLink(a.ApplicantPhone, a.ApplicantName)}" target="_blank" rel="noopener">WhatsApp applicant</a>
        <a class="secondary-btn contact-btn" href="mailto:${escapeAttr(a.ApplicantEmail || '')}">Email applicant</a>
      </div>` : ''}
    </div>

    <div class="detail-section">
      <h3>Booking Details</h3>
      <div class="field-grid">
        ${field('EventType', 'Event type', a.EventType, editing, 'text')}
        ${numField('GuestCount', 'Guest count', a.GuestCount, editing)}
        ${dtField('StartDateTime', 'Start', a.StartDateTime, editing)}
        ${dtField('EndDateTime', 'End', a.EndDateTime, editing)}
        ${field('FormNotes', "Applicant's own notes", a.FormNotes, editing, 'text')}
      </div>
      <label>Notes log
        <textarea data-field="NotesLog" rows="3" ${editing ? '' : 'readonly'}>${escapeHtml(a.NotesLog || '')}</textarea>
      </label>
      ${editing ? '<p class="hint">Add a new line below the existing text — older entries are kept, not overwritten.</p>' : ''}
    </div>

    <div class="detail-section">
      <h3>Quote Parameters</h3>
      <button type="button" id="toggleQuoteParamsBtn" class="secondary-btn">${editing ? 'Hide' : 'See'} quoting parameters</button>
      <div id="quoteParamsBody" class="${editing ? '' : 'hidden'}">
        <h4 class="section-heading-label">Tables</h4>
        ${renderTableFields(a, editing)}
        <p id="unseatedLine" class="hint"></p>
        ${renderQuoteFields(a, editing)}
        <div class="two-col-section">
          <div class="floor-section-picker">
            <label class="section-heading-label">Floor Section(s) — select all that apply</label>
            ${renderFloorSectionCheckboxes(a, editing)}
          </div>
          <div class="guard-time-col">
            ${dtField('CarGuardStart', 'Car guard start', a.CarGuardStart, editing)}
            ${dtField('CarGuardEnd', 'Car guard end', a.CarGuardEnd, editing)}
            <img src="img/sectional_layout.png" class="sectional-layout-img" alt="Hall sectional layout diagram" onerror="this.style.display='none'">
          </div>
        </div>
        <p id="capWarnings" class="warning-text"></p>
        <div class="detail-section-sub">
          <h4 class="section-heading-label">Custom Items</h4>
          <div id="customItemsList">${renderCustomItems(a, editing)}</div>
          ${editing ? '<button type="button" id="addCustomItemBtn" class="secondary-btn">+ Add custom item</button>' : ''}
        </div>
        <div class="field-grid">
          <label>Overall discount % (${STATE.config.discountMinPct} to ${STATE.config.discountMaxPct})
            <input type="number" data-field="OverallDiscountPct" value="${Number(a.OverallDiscountPct) || 0}" ${editing ? '' : 'disabled'}
                   min="${STATE.config.discountMinPct}" max="${STATE.config.discountMaxPct}">
          </label>
          <label>Deposit %
            <input type="number" data-field="DepositPct" value="${a.DepositPct != null ? a.DepositPct : STATE.config.depositDefaultPct}" ${editing ? '' : 'disabled'} min="0" max="100">
          </label>
        </div>
      </div>
      ${editing ? `<button id="generatePriceBtn" class="primary-btn" ${isNew ? 'disabled title="Save the application first"' : ''}>Generate Price</button>` : ''}
      <div id="quoteOutput">${a.QuoteTotal ? renderQuoteOutput(a) : ''}</div>
    </div>

    ${!isNew ? renderStatusSection(a) : ''}
    ${!isNew ? renderEmailSection(a) : ''}
    ${!isNew ? renderPaymentSection(a) : ''}
    ${!isNew ? renderChargesSection(a) : ''}
    ${!isNew ? renderMediaSection(a, editing) : ''}

    <div class="modal-actions">
      <button id="closeDetailBtn" class="secondary-btn">Close</button>
      ${editing ? '<button id="saveDetailBtn" class="primary-btn">Save Changes</button>' : ''}
    </div>
  `;

  wireDetailInteractions(card, a, isNew, editing);
  if (editing) { updateUnseatedAndCaps(card); wireLiveValidation(card); }
  if (!isNew) { loadCharges(card, a.ID); loadMedia(card, a.ID); loadProofs(card, a.ID); }
}

function renderQuoteFields(a, editing) {
  let discounts = {};
  try { discounts = JSON.parse(a.LineDiscountsJSON || '{}'); } catch (e) {}
  return QUOTE_ITEMS.map(qi => {
    const val = a[qi.field];
    if (!editing && (qi.type === 'number' ? (!val || Number(val) === 0) : val !== 'Yes')) return ''; // hide zero-quantity in view mode
    if (qi.type === 'yesno') {
      return `<div class="quote-row">
        <label class="quote-label">${qi.label}
          <select data-field="${qi.field}" ${editing ? '' : 'disabled'}>
            <option value="No" ${val !== 'Yes' ? 'selected' : ''}>No</option>
            <option value="Yes" ${val === 'Yes' ? 'selected' : ''}>Yes</option>
          </select>
        </label>
        ${editing ? discountInput(qi.item, discounts[qi.item]) : ''}
      </div>`;
    }
    return `<div class="quote-row">
      <label class="quote-label">${qi.label}
        <input type="number" data-field="${qi.field}" data-numeric="true" value="${val || 0}" min="0" ${editing ? '' : 'disabled'}>
      </label>
      ${editing ? discountInput(qi.item, discounts[qi.item]) : ''}
    </div>`;
  }).join('');
}
function renderTableFields(a, editing) {
  let discounts = {};
  try { discounts = JSON.parse(a.LineDiscountsJSON || '{}'); } catch (e) {}
  return TABLE_ITEMS.map(qi => {
    const val = a[qi.field];
    if (!editing && (!val || Number(val) === 0)) return '';
    const rl = STATE.config.rateLines.find(r => r.item === qi.item);
    const seats = rl ? rl.seatingCapacity : '?';
    return `<div class="quote-row">
      <label class="quote-label">${qi.label} (seats ${seats} each)
        <input type="number" data-field="${qi.field}" data-numeric="true" value="${val || 0}" min="0" ${editing ? '' : 'disabled'}>
      </label>
      ${editing ? discountInput(qi.item, discounts[qi.item]) : ''}
    </div>`;
  }).join('');
}

// Manager-defined custom quote items: name, unit price, quantity — no
// preset rate list, no discount field (the manager sets the price
// directly). Stored as JSON on the application.
function renderCustomItems(a, editing) {
  let items = [];
  try { items = JSON.parse(a.CustomQuoteItemsJSON || '[]'); } catch (e) {}
  if (!items.length) return editing ? '<p class="hint">None added.</p>' : '<p class="hint">No custom items.</p>';
  return items.map((ci, i) => editing ? `
    <div class="quote-row custom-item-row" data-index="${i}">
      <input type="text" class="custom-item-name" placeholder="Item name" value="${escapeAttr(ci.name)}">
      <input type="number" class="custom-item-rate" placeholder="R per unit" value="${ci.unitPrice}" step="0.01" style="width:110px">
      <input type="number" class="custom-item-qty" placeholder="Qty" value="${ci.qty}" min="0" style="width:80px">
      <button type="button" class="icon-btn remove-custom-item" data-index="${i}">✕</button>
    </div>` : `<div class="charge-row"><span>${escapeHtml(ci.name)} x${ci.qty}</span><span>R${(Number(ci.unitPrice) * Number(ci.qty)).toFixed(2)}</span></div>`
  ).join('');
}

function discountInput(itemName, value) {
  return `<label class="discount-label">disc %
    <input type="number" class="line-discount" data-item="${escapeAttr(itemName)}" value="${value || 0}"
           min="${STATE.config.discountMinPct}" max="${STATE.config.discountMaxPct}">
  </label>`;
}

// An applicant can hire more than one section at once — FloorSection is
// stored as a comma-separated list, one checkbox per section, each with
// its own discount input (matching the per-section line the backend prices).
function renderFloorSectionCheckboxes(a, editing) {
  let discounts = {};
  try { discounts = JSON.parse(a.LineDiscountsJSON || '{}'); } catch (e) {}
  const selected = String(a.FloorSection || '').split(',').map(s => s.trim()).filter(Boolean);
  return STATE.config.floorSections.map(s => {
    const isChecked = selected.includes(s.section);
    if (!editing && !isChecked) return '';
    return `<div class="quote-row">
      <label class="quote-label">
        <input type="checkbox" class="floor-section-checkbox" data-section="${s.section}" ${isChecked ? 'checked' : ''} ${editing ? '' : 'disabled'}>
        Section ${s.section} (R${s.rate})
      </label>
      ${editing ? discountInput('Floor Section ' + s.section, discounts['Floor Section ' + s.section]) : ''}
    </div>`;
  }).join('') || (!editing ? '<p class="hint">No section selected yet.</p>' : '');
}

function renderQuoteOutput(a) {
  return `<div class="quote-summary">
    <strong>Quote total: R${Number(a.QuoteTotal).toFixed(2)}</strong> (generated ${fmtDate(a.QuoteGeneratedDate)})<br>
    Deposit required: R${Number(a.DepositRequired || 0).toFixed(2)}
  </div>`;
}

function renderStatusSection(a) {
  const isAccepted = a.Status === 'Accepted';
  return `<div class="detail-section">
    <div class="status-line"><h3>Status:</h3> <span class="pill pill-${slug(a.Status)}">${a.Status}</span></div>
    <div class="status-row">
      ${!isAccepted ? '<button class="secondary-btn" data-act="accept">Accept</button>' : ''}
      ${!isAccepted ? '<button class="secondary-btn" data-act="deny">Deny</button>' : ''}
      ${isAccepted ? '<button class="secondary-btn" data-act="cancel">Cancel</button>' : ''}
    </div>
    ${a.DenialReason ? `<p class="hint">Reason on file: ${escapeHtml(a.DenialReason)}${a.DenialReasonOther ? ' — ' + escapeHtml(a.DenialReasonOther) : ''}</p>` : ''}
    ${a.RefundAmount ? `<p class="hint">Refund: R${Number(a.RefundAmount).toFixed(2)} (${a.RefundStatus})</p>` : ''}
    <div class="status-row">
      <button class="secondary-btn" data-act="addSetup">+ Add Setup</button>
      <button class="secondary-btn" data-act="addTeardown">+ Add Teardown</button>
    </div>
  </div>`;
}

function renderEmailSection(a) {
  return `<div class="detail-section">
    <h3>Emails</h3>
    <div class="status-row">
      <button class="secondary-btn" data-email="Quote">Email Quote</button>
      <button class="secondary-btn" data-email="Rules">Rules & Sectional Layout</button>
      <button class="secondary-btn" data-email="DepositInvoice">Send Deposit Invoice</button>
      <button class="secondary-btn" data-email="BalanceInvoice">Send Balance Invoice</button>
    </div>
    <p class="hint">${a.RulesSentDate ? 'Rules last sent: ' + fmtDate(a.RulesSentDate) : ''} ${a.DepositInvoiceSentDate ? ' · Deposit invoice sent: ' + fmtDate(a.DepositInvoiceSentDate) : ''} ${a.BalanceInvoiceSentDate ? ' · Balance invoice sent: ' + fmtDate(a.BalanceInvoiceSentDate) : ''}</p>
  </div>`;
}

function renderPaymentSection(a) {
  return `<div class="detail-section">
    <h3>Payment <span class="pill pill-pay pill-${slug(a.PaymentStatus)}">${a.PaymentStatus || 'Pending'}</span></h3>
    <div class="field-grid">
      <div>Amount due: <strong>R${Number(a.AmountDue || 0).toFixed(2)}</strong></div>
      <label>Amount received (R)
        <input type="number" id="amountReceivedInput" data-numeric="true" value="${a.AmountReceived || 0}" min="0" step="0.01">
      </label>
    </div>
    <button id="savePaymentBtn" class="secondary-btn">Save Payment</button>
    <div class="status-row" style="margin-top:10px">
      <label class="file-btn secondary-btn">Upload Proof of Payment<input type="file" id="proofUploadInput" accept="image/*,.pdf" hidden></label>
    </div>
    <div id="proofList" class="media-list"></div>
  </div>`;
}

function renderChargesSection(a) {
  return `<div class="detail-section">
    <h3>Additional Charges <span class="hint">(damages, overage, sundries — never affects commission)</span></h3>
    <div id="chargesList" class="card-list"></div>
    <div class="status-row">
      <button id="addChargeBtn" class="secondary-btn">+ Add charge</button>
      <button id="sendChargesInvoiceBtn" class="secondary-btn">Send charges invoice</button>
    </div>
  </div>`;
}

function renderMediaSection(a, editing) {
  return `<div class="detail-section">
    <h3>Damages Media</h3>
    <label>Damages notes
      <textarea data-field="DamagesNotes" rows="3" ${editing ? '' : 'readonly'} placeholder="Explain any damages shown in the photos/videos below">${escapeHtml(a.DamagesNotes || '')}</textarea>
    </label>
    <label class="file-btn secondary-btn">Upload photo/video<input type="file" id="damageUploadInput" accept="image/*,video/*" hidden></label>
    <div id="damageMediaList" class="media-list"></div>
  </div>`;
}

// ---------------------------------------------------------------
// FIELD HELPERS
// ---------------------------------------------------------------
function field(name, label, value, editing, type) {
  return `<label>${label}<input type="${type}" data-field="${name}" value="${escapeAttr(value)}" ${editing ? '' : 'disabled'}></label>`;
}
function numField(name, label, value, editing) {
  return `<label>${label}<input type="text" inputmode="numeric" data-field="${name}" data-numeric="true" value="${escapeAttr(value)}" ${editing ? '' : 'disabled'}></label>`;
}
function dtField(name, label, value, editing) {
  return `<label>${label}<input type="datetime-local" data-field="${name}" value="${toLocalInput(value)}" ${editing ? '' : 'disabled'}></label>`;
}

// Blocks non-numeric characters from ever registering in numeric fields,
// and flags out-of-range values with a clear inline warning.
function wireLiveValidation(card) {
  card.querySelectorAll('[data-numeric="true"]').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (!/[0-9.]/.test(e.key)) e.preventDefault();
    });
    input.addEventListener('input', () => validateNumericField(input));
  });
  card.querySelectorAll('.line-discount, [data-field="OverallDiscountPct"]').forEach(input => {
    input.addEventListener('input', () => validateDiscountField(input));
  });
  card.querySelectorAll('[data-field], .line-discount').forEach(input => {
    input.addEventListener('input', () => updateUnseatedAndCaps(card));
  });
}
function validateNumericField(input) {
  const val = input.value.trim();
  const warnId = input.id + '-warn';
  let warn = input.parentElement.querySelector('.field-warning');
  if (val !== '' && isNaN(Number(val))) {
    if (!warn) { warn = document.createElement('div'); warn.className = 'field-warning'; input.after(warn); }
    warn.textContent = 'This must be a number.';
    input.classList.add('invalid');
  } else {
    if (warn) warn.remove();
    input.classList.remove('invalid');
  }
}
function validateDiscountField(input) {
  const val = Number(input.value);
  let warn = input.parentElement.querySelector('.field-warning');
  if (val < STATE.config.discountMinPct || val > STATE.config.discountMaxPct) {
    if (!warn) { warn = document.createElement('div'); warn.className = 'field-warning'; input.after(warn); }
    warn.textContent = `Must be between ${STATE.config.discountMinPct}% and ${STATE.config.discountMaxPct}%.`;
    input.classList.add('invalid');
  } else {
    if (warn) warn.remove();
    input.classList.remove('invalid');
  }
}

function updateUnseatedAndCaps(card) {
  const get = (f) => Number(card.querySelector(`[data-field="${f}"]`)?.value) || 0;
  const guestCount = get('GuestCount');
  const seated = get('RoundTableCount') * 10 + get('RectTableCount') * 10 + get('LongRectTableCount') * 10; // Config default capacity=10; real per-item capacity is applied server-side on Generate Price
  const unseated = guestCount - seated;
  const line = card.querySelector('#unseatedLine');
  if (line) line.textContent = 'Unseated guests (informational, based on default capacities — final figure confirmed on Generate Price): ' + unseated;

  const warnings = [];
  QUOTE_ITEMS.forEach(qi => {
    if (qi.type !== 'number') return;
    const rl = STATE.config.rateLines.find(r => r.item === qi.item);
    if (!rl || rl.inventoryCap == null) return;
    const qty = get(qi.field);
    if (qty > rl.inventoryCap) warnings.push(`${qi.label}: requested ${qty}, only ${rl.inventoryCap} owned`);
  });
  const capEl = card.querySelector('#capWarnings');
  if (capEl) capEl.textContent = warnings.join(' · ');
}

// ---------------------------------------------------------------
// SAVE / EDIT TOGGLE
// ---------------------------------------------------------------
function wireDetailInteractions(card, a, isNew, editing) {
  document.getElementById('closeDetailBtn').addEventListener('click', () => document.getElementById('detailModal').classList.add('hidden'));

  const editBtn = document.getElementById('editToggleBtn');
  if (editBtn) editBtn.addEventListener('click', () => {
    card.dataset.mode = editing ? 'view' : 'edit';
    renderDetail(card, a, false);
  });

  const saveBtn = document.getElementById('saveDetailBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => withButtonLoading(saveBtn, 'Saving…', async () => {
    const invalid = card.querySelector('.invalid');
    if (invalid) { alert('Please fix the highlighted field before saving.'); return; }
    const fields = collectFields(card);
    if (isNew) {
      const res = await Api.createApplication(fields);
      if (res.ok) { document.getElementById('detailModal').classList.add('hidden'); await loadAll(); }
      else alert(res.error || 'Could not create application');
    } else {
      const res = await Api.updateApplication(a.ID, fields);
      if (res.ok) { card.dataset.mode = 'view'; await loadAll(); openDetail(a.ID); }
      else alert(res.error || 'Could not save changes');
    }
  }));

  const genBtn = document.getElementById('generatePriceBtn');
  if (genBtn) genBtn.addEventListener('click', () => withButtonLoading(genBtn, 'Calculating…', async () => {
    // Save current fields first so the server calculates from the latest values.
    const fields = collectFields(card);
    await Api.updateApplication(a.ID, fields);
    const res = await Api.generatePrice(a.ID);
    if (res.ok) { await loadAll(); openDetail(a.ID); }
    else alert(res.error || 'Could not generate price');
  }));

  const toggleBtn = document.getElementById('toggleQuoteParamsBtn');
  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    const body = document.getElementById('quoteParamsBody');
    const nowHidden = body.classList.toggle('hidden');
    toggleBtn.textContent = (nowHidden ? 'See' : 'Hide') + ' quoting parameters';
  });

  if (editing) {
    const addCustomBtn = document.getElementById('addCustomItemBtn');
    if (addCustomBtn) addCustomBtn.addEventListener('click', () => {
      const list = document.getElementById('customItemsList');
      const row = document.createElement('div');
      row.className = 'quote-row custom-item-row';
      row.innerHTML = `
        <input type="text" class="custom-item-name" placeholder="Item name">
        <input type="number" class="custom-item-rate" placeholder="R per unit" step="0.01" style="width:110px">
        <input type="number" class="custom-item-qty" placeholder="Qty" min="0" style="width:80px">
        <button type="button" class="icon-btn remove-custom-item">✕</button>`;
      list.appendChild(row);
      row.querySelector('.remove-custom-item').addEventListener('click', () => row.remove());
    });
    card.querySelectorAll('.remove-custom-item').forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.custom-item-row').remove()));
  }

  if (!isNew) {
    card.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', () => handleStatusAction(btn.dataset.act, a)));
    card.querySelectorAll('[data-email]').forEach(btn => btn.addEventListener('click', () => openEmailPopup(a.ID, btn.dataset.email)));

    const payBtn = document.getElementById('savePaymentBtn');
    if (payBtn) payBtn.addEventListener('click', () => withButtonLoading(payBtn, 'Saving…', async () => {
      const amount = Number(document.getElementById('amountReceivedInput').value);
      if (isNaN(amount) || amount < 0) { alert('Enter a valid amount.'); return; }
      const res = await Api.logPayment(a.ID, amount);
      if (res.ok) {
        await loadAll();
        if (res.justBecamePaid) { document.getElementById('detailModal').classList.add('hidden'); openEmailPopup(a.ID, 'PaymentThankYou'); }
        else openDetail(a.ID);
      } else alert(res.error || 'Could not save payment');
    }));

    const proofInput = document.getElementById('proofUploadInput');
    if (proofInput) proofInput.addEventListener('change', () => handleFileUpload(proofInput, a.ID, 'proof'));
    const damageInput = document.getElementById('damageUploadInput');
    if (damageInput) damageInput.addEventListener('change', () => handleFileUpload(damageInput, a.ID, 'damage'));

    const addChargeBtn = document.getElementById('addChargeBtn');
    if (addChargeBtn) addChargeBtn.addEventListener('click', () => openChargeModal(a.ID));
    const sendChargesBtn = document.getElementById('sendChargesInvoiceBtn');
    if (sendChargesBtn) sendChargesBtn.addEventListener('click', () => openEmailPopup(a.ID, 'ChargesInvoice'));
  }
}

function collectFields(card) {
  const fields = {};
  card.querySelectorAll('[data-field]').forEach(el => { fields[el.dataset.field] = el.value; });
  const checkedSections = Array.from(card.querySelectorAll('.floor-section-checkbox:checked')).map(el => el.dataset.section);
  fields.FloorSection = checkedSections.join(',');
  const discounts = {};
  card.querySelectorAll('.line-discount').forEach(el => { if (Number(el.value)) discounts[el.dataset.item] = Number(el.value); });
  fields.LineDiscountsJSON = JSON.stringify(discounts);

  const customItems = [];
  card.querySelectorAll('.custom-item-row').forEach(row => {
    const name = row.querySelector('.custom-item-name')?.value?.trim();
    const unitPrice = Number(row.querySelector('.custom-item-rate')?.value) || 0;
    const qty = Number(row.querySelector('.custom-item-qty')?.value) || 0;
    if (name && qty > 0) customItems.push({ name, unitPrice, qty });
  });
  fields.CustomQuoteItemsJSON = JSON.stringify(customItems);

  return fields;
}

// ---------------------------------------------------------------
// STATUS / REASON / REFUND
// ---------------------------------------------------------------
function handleStatusAction(act, a) {
  if (act === 'accept') return doSetStatus(a.ID, 'Accepted');
  if (act === 'deny') return askReasonThen(a.ID, 'Denied', false);
  if (act === 'cancel') return askReasonThen(a.ID, 'Cancelled', Number(a.AmountReceived) > 0);
  if (act === 'addSetup') return quickAddBlock(a.ID, 'Setup');
  if (act === 'addTeardown') return quickAddBlock(a.ID, 'Teardown');
}
async function doSetStatus(id, status, reason, reasonOther, refundAmount, refundStatus) {
  const res = await Api.setStatus(id, status, reason, reasonOther, refundAmount, refundStatus);
  if (res.ok) {
    await loadAll();
    if (status === 'Accepted') openEmailPopupAsk(id, 'Accept');
    else if (status === 'Denied') openEmailPopupAsk(id, 'Deny');
    else if (status === 'Cancelled') openEmailPopupAsk(id, res.hadPayment ? 'RefundConfirmation' : 'CancelConfirmation');
    else openDetail(id);
  } else alert(res.error || 'Could not update status');
}
function openEmailPopupAsk(id, type) {
  if (confirm('Draft an email to the applicant now?')) openEmailPopup(id, type);
  else openDetail(id);
}

function askReasonThen(id, status, needsRefund) {
  document.getElementById('reasonModalTitle').textContent = status === 'Denied' ? 'Reason for denial' : 'Reason for cancellation';
  document.getElementById('reasonSelect').innerHTML = STATE.config.reasons.map(r => `<option value="${escapeAttr(r)}">${escapeHtml(r)}</option>`).join('');
  document.getElementById('reasonOtherWrap').classList.add('hidden');
  document.getElementById('reasonOther').value = '';
  document.getElementById('refundWrap').classList.toggle('hidden', !needsRefund);
  document.getElementById('reasonModal').classList.remove('hidden');
  STATE.pendingReasonCallback = (reason, other, refundAmount, refundStatus) => doSetStatus(id, status, reason, other, refundAmount, refundStatus);
}
function wireReasonModal() {
  document.getElementById('reasonSelect').addEventListener('change', (e) => {
    document.getElementById('reasonOtherWrap').classList.toggle('hidden', e.target.value !== 'Other');
  });
  document.getElementById('reasonCancelBtn').addEventListener('click', () => document.getElementById('reasonModal').classList.add('hidden'));
  document.getElementById('reasonConfirmBtn').addEventListener('click', () => {
    const reason = document.getElementById('reasonSelect').value;
    const other = document.getElementById('reasonOther').value;
    const refundAmount = document.getElementById('refundAmount').value;
    const refundStatus = document.getElementById('refundStatus').value;
    document.getElementById('reasonModal').classList.add('hidden');
    if (STATE.pendingReasonCallback) STATE.pendingReasonCallback(reason, other, refundAmount, refundStatus);
  });
}

// ---------------------------------------------------------------
// EMAIL POPUP — Cancel / Send / Save to Draft
// ---------------------------------------------------------------
async function openEmailPopup(id, emailType) {
  const res = await withLoading(() => Api.prepareEmail(id, emailType));
  if (!res.ok) { alert(res.error || 'Could not prepare email'); openDetail(id); return; }
  STATE.pendingEmail = { id, emailType };
  document.getElementById('emailModalTitle').textContent = emailType.replace(/([A-Z])/g, ' $1').trim();
  document.getElementById('emailTo').value = res.to || '';
  document.getElementById('emailSubject').value = res.subject;
  document.getElementById('emailBody').value = res.body;
  document.getElementById('emailAttachmentList').innerHTML = (res.attachments || []).map(a => `<li>${escapeHtml(a)}</li>`).join('') || '<li>None</li>';
  document.getElementById('emailModal').classList.remove('hidden');
}
function wireEmailModal() {
  document.getElementById('emailCancelBtn').addEventListener('click', () => finishEmail('cancel'));
  document.getElementById('emailDraftBtn').addEventListener('click', () => finishEmail('draft'));
  document.getElementById('emailSendBtn').addEventListener('click', () => finishEmail('send'));
}
async function finishEmail(action) {
  const pending = STATE.pendingEmail;
  const btn = action === 'send' ? document.getElementById('emailSendBtn') : action === 'draft' ? document.getElementById('emailDraftBtn') : document.getElementById('emailCancelBtn');
  await withButtonLoading(btn, action === 'send' ? 'Sending…' : action === 'draft' ? 'Saving…' : 'Cancelling…', async () => {
    if (action !== 'cancel' && pending) {
      const res = await Api.dispatchEmail(pending.id, pending.emailType,
        document.getElementById('emailSubject').value, document.getElementById('emailBody').value, action);
      if (!res.ok) {
        // Surface the real failure instead of silently closing the popup —
        // this was previously swallowed, making every failure look like
        // nothing happened at all.
        alert('Could not ' + (action === 'send' ? 'send' : 'save') + ' this email: ' + (res.error || 'unknown error'));
        return; // leave the popup open so the manager can retry
      }
    }
    document.getElementById('emailModal').classList.add('hidden');
    document.getElementById('detailModal').classList.add('hidden');
    if (pending) { await loadAll(); }
    STATE.pendingEmail = null;
  });
}

// ---------------------------------------------------------------
// BLOCKS — modal shared by the detail page's quick-add buttons and
// the calendar's own "+ Add block" / click-to-edit.
// ---------------------------------------------------------------
function quickAddBlock(applicationId, type) {
  const app = STATE.applications.find(a => a.ID === applicationId);
  const suggestion = suggestBlockTimes(app, type);
  openBlockModal(null, {
    label: (type === 'Setup' ? 'Setup' : 'Teardown') + ' - ' + (app ? app.ApplicantName : applicationId),
    type: type, linkedApplicationId: applicationId,
    startDateTime: suggestion.start, endDateTime: suggestion.end
  });
}

// Mirrors the Config midday-split rule client-side for an instant
// suggestion; the manager can always adjust before saving.
function suggestBlockTimes(app, type) {
  if (!app || !app.StartDateTime) return { start: '', end: '' };
  const start = new Date(app.StartDateTime), end = new Date(app.EndDateTime || app.StartDateTime);
  const isMorning = start.getHours() < 12;
  let s, e;
  if (type === 'Setup') {
    if (isMorning) { s = new Date(start); s.setDate(s.getDate() - 1); s.setHours(13, 0, 0, 0); e = new Date(start); }
    else { s = new Date(start); s.setHours(8, 0, 0, 0); e = new Date(start); }
  } else {
    if (isMorning) { s = new Date(end); e = new Date(end); e.setHours(e.getHours() + 2); }
    else { s = new Date(end); s.setDate(s.getDate() + 1); s.setHours(8, 0, 0, 0); e = new Date(s); e.setHours(11, 0, 0, 0); }
  }
  return { start: toLocalInput(s), end: toLocalInput(e) };
}

function openBlockModal(existingId, prefill) {
  document.getElementById('blockModalTitle').textContent = existingId ? 'Edit block' : 'New block';
  document.getElementById('blockModal').dataset.blockId = existingId || '';
  document.getElementById('blockLabel').value = prefill?.label || '';
  document.getElementById('blockType').value = prefill?.type || 'Setup';
  document.getElementById('blockLinkedId').value = prefill?.linkedApplicationId || '';
  document.getElementById('blockStart').value = prefill?.startDateTime ? (existingId ? toLocalInput(prefill.startDateTime) : prefill.startDateTime) : '';
  document.getElementById('blockEnd').value = prefill?.endDateTime ? (existingId ? toLocalInput(prefill.endDateTime) : prefill.endDateTime) : '';
  document.getElementById('blockNotes').value = prefill?.notes || '';
  document.getElementById('blockModal').classList.remove('hidden');
}
function wireBlockModal() {
  document.getElementById('addBlockBtn')?.addEventListener('click', () => openBlockModal(null, { type: 'Internal' }));
  document.getElementById('blockCancelBtn').addEventListener('click', () => document.getElementById('blockModal').classList.add('hidden'));
  document.getElementById('blockSaveBtn').addEventListener('click', () => withButtonLoading(document.getElementById('blockSaveBtn'), 'Saving…', async () => {
    const id = document.getElementById('blockModal').dataset.blockId;
    const block = {
      label: document.getElementById('blockLabel').value,
      type: document.getElementById('blockType').value,
      linkedApplicationId: document.getElementById('blockLinkedId').value,
      startDateTime: document.getElementById('blockStart').value,
      endDateTime: document.getElementById('blockEnd').value,
      notes: document.getElementById('blockNotes').value
    };
    const res = id ? await Api.updateBlock(id, block) : await Api.createBlock(block);
    document.getElementById('blockModal').classList.add('hidden');
    if (res.ok) await loadAll(); else alert(res.error || 'Could not save block');
  }));
}

// ---------------------------------------------------------------
// ADDITIONAL CHARGES
// ---------------------------------------------------------------
async function loadCharges(card, applicationId) {
  const res = await Api.getCharges(applicationId);
  const list = card.querySelector('#chargesList');
  if (!list) return;
  if (!res.ok || !res.charges.length) { list.innerHTML = '<p class="hint">No additional charges recorded.</p>'; return; }
  list.innerHTML = res.charges.map(c => `
    <div class="charge-row">
      <span>${escapeHtml(c.ItemType === 'Catalog' ? c.CatalogItemName + ' x' + c.Quantity : c.Description)}</span>
      <span>R${Number(c.Amount).toFixed(2)}</span>
      <span class="pill pill-${slug(c.PaymentStatus)}">${c.PaymentStatus}</span>
    </div>`).join('');
}
function openChargeModal(applicationId) {
  const sel = document.getElementById('chargeCatalogItem');
  sel.innerHTML = STATE.config.rateLines.filter(r => r.active).map(r => `<option value="${escapeAttr(r.item)}">${escapeHtml(r.item)} (R${r.rate})</option>`).join('');
  document.getElementById('chargeType').value = 'Catalog';
  document.getElementById('chargeCatalogWrap').classList.remove('hidden');
  document.getElementById('chargeCustomWrap').classList.add('hidden');
  document.getElementById('chargeModal').classList.remove('hidden');
  document.getElementById('chargeModal').dataset.applicationId = applicationId;
}
function wireChargeModal() {
  document.getElementById('chargeType').addEventListener('change', (e) => {
    const isCatalog = e.target.value === 'Catalog';
    document.getElementById('chargeCatalogWrap').classList.toggle('hidden', !isCatalog);
    document.getElementById('chargeCustomWrap').classList.toggle('hidden', isCatalog);
  });
  document.getElementById('chargeCancelBtn').addEventListener('click', () => document.getElementById('chargeModal').classList.add('hidden'));
  document.getElementById('chargeSaveBtn').addEventListener('click', () => withButtonLoading(document.getElementById('chargeSaveBtn'), 'Saving…', async () => {
    const applicationId = document.getElementById('chargeModal').dataset.applicationId;
    const isCatalog = document.getElementById('chargeType').value === 'Catalog';
    const payload = { applicationId, itemType: isCatalog ? 'Catalog' : 'Custom' };
    if (isCatalog) { payload.catalogItemName = document.getElementById('chargeCatalogItem').value; payload.quantity = document.getElementById('chargeQty').value; }
    else { payload.description = document.getElementById('chargeDescription').value; payload.amount = document.getElementById('chargeAmount').value; }
    const res = await Api.addCharge(payload);
    document.getElementById('chargeModal').classList.add('hidden');
    if (res.ok) openDetail(applicationId); else alert(res.error || 'Could not add charge');
  }));
}

// ---------------------------------------------------------------
// FILE UPLOADS (damages media, proof of payment) — multi-upload
// ---------------------------------------------------------------
function handleFileUpload(input, applicationId, kind) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    await withLoading(async () => {
      if (kind === 'proof') await Api.uploadProofOfPayment(applicationId, file.name, file.type, base64);
      else await Api.uploadDamageMedia(applicationId, file.name, file.type, base64);
    });
    input.value = '';
    openDetail(applicationId);
  };
  reader.readAsDataURL(file);
}
async function loadMedia(card, applicationId) {
  const res = await Api.getDamageMedia(applicationId);
  const list = card.querySelector('#damageMediaList');
  if (!list) return;
  if (!res.ok || !res.media.length) { list.innerHTML = '<p class="hint">No media uploaded.</p>'; return; }
  list.innerHTML = res.media.map(m => `<a href="${m.url}" target="_blank" class="media-item">${escapeHtml(m.name)}</a>`).join('');
}
async function loadProofs(card, applicationId) {
  const res = await Api.getProofOfPayment(applicationId);
  const list = card.querySelector('#proofList');
  if (!list) return;
  if (!res.ok || !res.proofs.length) { list.innerHTML = '<p class="hint">No proof of payment uploaded yet.</p>'; return; }
  list.innerHTML = res.proofs.map(p => `<a href="${p.url}" target="_blank" class="media-item">${escapeHtml(p.name)}</a>`).join('');
}

// ---------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------
function slug(s) { return String(s || '').toLowerCase().replace(/\s+/g, '-'); }
// Explicit dd/mm/yyyy formatting — never relies on toLocaleString(),
// which renders inconsistently across browsers/OSes/locales even with
// 'en-ZA' specified. This is the one true date format across the app.
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
  return hasTime ? `${dd}/${mm}/${yyyy} ${hh}:${min}` : `${dd}/${mm}/${yyyy}`;
}
function toLocalInput(d) { if (!d) return ''; const dt = new Date(d); if (isNaN(dt)) return ''; return dt.toISOString().slice(0, 16); }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return escapeHtml(s); }

// Converts a South African local number (082...) to the international
// form wa.me needs (27...), and pre-addresses a short message.
function whatsappLink(phone, name) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '27' + digits.slice(1);
  const msg = encodeURIComponent(`Hi ${name || ''}, this is the hall manager regarding your booking.`);
  return digits ? `https://wa.me/${digits}?text=${msg}` : '#';
}

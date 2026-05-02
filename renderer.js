import { updateDealField } from './datastore.js';

const STATUS_OPTIONS = [
  'New',
  'Pending Finance',
  'Being Worked On',
  'At Sublet',
  'Delivered',
  'Pending',
  'Cancelled'
];

const PAYMENT_OPTIONS = [
  'Unknown / Pending',
  'Cash',
  'EFT',
  'Dealer Finance',
  'Novated Lease',
  'External Finance',
  'Fleet / Salary Packaging'
];

const PRIORITY_OPTIONS = [
  'Low',
  'Normal',
  'High'
];

export function renderDashboard(deals) {
  renderKPIs(deals);
  renderTable(deals);
  renderMobileCards(deals);
  updateCounts(deals);
  syncTopScrollbarWidth();
}

function renderKPIs(deals) {
  const totalGross = deals.reduce((sum, d) => sum + (Number(d.gross) || 0), 0);

  const financeDeals = deals.filter(d => d.payment_method === 'Dealer Finance').length;
  const financePenetration = deals.length ? Math.round((financeDeals / deals.length) * 100) : 0;

  const pendingFinance = deals.filter(d => d.status === 'Pending Finance').length;

  const overdue = deals.filter(d => {
    if (!d.eta_date) return false;

    const eta = new Date(d.eta_date + 'T00:00:00');
    const today = startOfDay(new Date());

    return eta < today &&
      d.status !== 'Delivered' &&
      d.status !== 'Cancelled';
  }).length;

  setText('kpiDeliveries', deals.length);
  setText('kpiGross', formatMoney(totalGross));
  setText('kpiFinance', `${financePenetration}%`);
  setText('kpiPendingFinance', pendingFinance);
  setText('kpiOverdue', overdue);
  setText('kpiTopBrand', detectTopBrand(deals));
}

function renderTable(deals) {
  const tbody = document.getElementById('dealsTableBody');

  if (!tbody) return;

  tbody.innerHTML = '';

  deals.forEach(deal => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td class="deal-no">${escapeHtml(deal.deal_no || '')}</td>
      <td>${escapeHtml(deal.dept_code || '')}</td>
      <td>${escapeHtml(deal.customer_name || '')}</td>
      <td>${escapeHtml(deal.salesperson || '')}</td>
      <td title="${escapeAttr(deal.vehicle_description || '')}">${escapeHtml(shorten(deal.vehicle_description || '', 90))}</td>
      <td class="${getEtaClass(deal)}">${formatDate(deal.eta_date)}</td>
      <td class="${Number(deal.gross) < 0 ? 'negative-money' : 'money'}">${formatMoney(deal.gross)}</td>
      <td>${formatMoney(deal.deposit)}</td>
      <td>
        <select class="status-select" data-id="${deal.id || ''}" data-field="status">
          ${renderOptions(STATUS_OPTIONS, deal.status || 'New')}
        </select>
      </td>
      <td>
        <select class="payment-select" data-id="${deal.id || ''}" data-field="payment_method">
          ${renderOptions(PAYMENT_OPTIONS, deal.payment_method || 'Unknown / Pending')}
        </select>
      </td>
      <td>
        <select class="priority-select" data-id="${deal.id || ''}" data-field="priority">
          ${renderOptions(PRIORITY_OPTIONS, deal.priority || 'Normal')}
        </select>
      </td>
      <td>
        <input class="notes-input" data-id="${deal.id || ''}" data-field="notes" value="${escapeAttr(deal.notes || '')}" placeholder="Add notes..." />
      </td>
      <td>${timeAgo(deal.updated_at)}</td>
    `;

    tbody.appendChild(row);
  });

  bindEditableFields();
}

function renderMobileCards(deals) {
  const container = document.getElementById('mobileCards');

  if (!container) return;

  container.innerHTML = '';

  deals.forEach(deal => {
    const card = document.createElement('div');

    card.className = 'mobile-card';

    card.innerHTML = `
      <div class="mobile-card-top">
        <div>
          <h4>${escapeHtml(deal.customer_name || '')}</h4>
          <div>${escapeHtml(deal.deal_no || '')} · ${escapeHtml(deal.dept_code || '')}</div>
        </div>
        <div class="badge">${escapeHtml(deal.status || 'New')}</div>
      </div>
      <div class="mobile-row"><div class="mobile-label">Vehicle</div><div>${escapeHtml(deal.vehicle_description || '')}</div></div>
      <div class="mobile-row"><div class="mobile-label">Salesperson</div><div>${escapeHtml(deal.salesperson || '')}</div></div>
      <div class="mobile-row"><div class="mobile-label">ETA</div><div class="${getEtaClass(deal)}">${formatDate(deal.eta_date)}</div></div>
      <div class="mobile-row"><div class="mobile-label">Gross</div><div class="${Number(deal.gross) < 0 ? 'negative-money' : 'money'}">${formatMoney(deal.gross)}</div></div>
    `;

    container.appendChild(card);
  });
}

function bindEditableFields() {
  document.querySelectorAll('[data-field]').forEach(el => {
    if (el.dataset.bound === 'true') return;

    el.dataset.bound = 'true';

    const eventName = el.tagName === 'SELECT' ? 'change' : 'blur';

    el.addEventListener(eventName, async e => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const value = e.target.value;

      if (!id || !field) return;

      try {
        await updateDealField(id, field, value);
      } catch (err) {
        console.error(err);
        alert(err.message || 'Update failed');
      }
    });
  });
}

function renderOptions(options, currentValue) {
  return options.map(option => `
    <option value="${escapeAttr(option)}" ${option === currentValue ? 'selected' : ''}>
      ${escapeHtml(option)}
    </option>
  `).join('');
}

function detectTopBrand(deals) {
  const brands = {};

  deals.forEach(deal => {
    const source = `${deal.brand || ''} ${deal.vehicle_description || ''}`.toLowerCase();

    let brand = 'Other';

    if (source.includes('kia')) brand = 'Kia';
    else if (source.includes('nissan') || source.includes('qashqai') || source.includes('patrol')) brand = 'Nissan';
    else if (source.includes('gwm') || source.includes('haval') || source.includes('cannon') || source.includes('tank')) brand = 'GWM/Haval';
    else if (source.includes('xpeng') || source.includes('rwd')) brand = 'Xpeng';

    brands[brand] = (brands[brand] || 0) + 1;
  });

  return Object.keys(brands).sort((a, b) => brands[b] - brands[a])[0] || '-';
}

function updateCounts(deals) {
  setText('tableCount', `${deals.length} deal${deals.length === 1 ? '' : 's'} showing`);
}

function syncTopScrollbarWidth() {
  const table = document.getElementById('dealsTable');
  const inner = document.getElementById('topScrollbarInner');

  if (table && inner) {
    inner.style.width = `${table.scrollWidth}px`;
  }
}

function getEtaClass(deal) {
  if (!deal.eta_date || deal.status === 'Delivered' || deal.status === 'Cancelled') {
    return '';
  }

  const eta = startOfDay(new Date(deal.eta_date + 'T00:00:00'));
  const today = startOfDay(new Date());
  const diff = (eta - today) / 86400000;

  if (diff < 0) return 'eta-overdue';
  if (diff < 7) return 'eta-warning';

  return 'eta-good';
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0
  });
}

function formatDate(value) {
  if (!value) return '-';

  return new Date(value + 'T00:00:00').toLocaleDateString('en-AU');
}

function timeAgo(value) {
  if (!value) return '-';

  const seconds = Math.floor((new Date() - new Date(value)) / 1000);
  const intervals = { year: 31536000, month: 2592000, day: 86400, hour: 3600, minute: 60 };

  for (const key in intervals) {
    const interval = Math.floor(seconds / intervals[key]);

    if (interval >= 1) {
      return `${interval} ${key}${interval > 1 ? 's' : ''} ago`;
    }
  }

  return 'Just now';
}

function shorten(text, max) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('\n', ' ');
}

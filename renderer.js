import { updateDealField } from './datastore.js';

export function renderDashboard(deals) {

  renderKPIs(deals);

  renderTable(deals);

  renderMobileCards(deals);

  updateCounts(deals);
}

function renderKPIs(deals) {

  const totalGross =
    deals.reduce(
      (sum, d) => sum + (Number(d.gross) || 0),
      0
    );

  const overdue =
    deals.filter(d => {

      if (!d.eta_date) return false;

      const eta =
        new Date(d.eta_date + 'T00:00:00');

      const today = startOfDay(new Date());

      return (
        eta < today &&
        d.status !== 'Delivered' &&
        d.status !== 'Cancelled'
      );
    }).length;

  const topBrand =
    detectTopBrand(deals);

  setText('kpiDeliveries', deals.length);

  setText('kpiGross', formatMoney(totalGross));

  setText('kpiFinance', '0%');

  setText('kpiPendingFinance', 0);

  setText('kpiOverdue', overdue);

  setText('kpiTopBrand', topBrand);
}

function renderTable(deals) {

  const tbody =
    document.getElementById(
      'dealsTableBody'
    );

  if (!tbody) return;

  tbody.innerHTML = '';

  deals.forEach(deal => {

    const row =
      document.createElement('tr');

    row.innerHTML = `
      <td class="deal-no">
        ${escapeHtml(deal.deal_no || '')}
      </td>

      <td>
        ${escapeHtml(deal.dept_code || '')}
      </td>

      <td>
        ${escapeHtml(deal.customer_name || '')}
      </td>

      <td>
        ${escapeHtml(deal.salesperson || '')}
      </td>

      <td title="${escapeAttr(deal.vehicle_description || '')}">
        ${escapeHtml(shorten(deal.vehicle_description || '', 90))}
      </td>

      <td class="${getEtaClass(deal)}">
        ${formatDate(deal.eta_date)}
      </td>

      <td class="${Number(deal.gross) < 0 ? 'negative-money' : 'money'}">
        ${formatMoney(deal.gross)}
      </td>

      <td>
        <select
          class="status-select"
          data-id="${deal.id || ''}"
          data-field="status"
        >
          ${renderStatusOptions(deal.status)}
        </select>
      </td>

      <td>
        <input
          class="notes-input"
          data-id="${deal.id || ''}"
          data-field="notes"
          value="${escapeAttr(deal.notes || '')}"
          placeholder="Add notes..."
        />
      </td>
    `;

    tbody.appendChild(row);
  });

  bindEditableFields();
}

function renderMobileCards(deals) {

  const container =
    document.getElementById(
      'mobileCards'
    );

  if (!container) return;

  container.innerHTML = '';

  deals.forEach(deal => {

    const card =
      document.createElement('div');

    card.className = 'mobile-card';

    card.innerHTML = `
      <div class="mobile-card-top">

        <div>
          <h4>
            ${escapeHtml(deal.customer_name || '')}
          </h4>

          <div>
            ${escapeHtml(deal.deal_no || '')}
          </div>
        </div>

        <div class="badge">
          ${escapeHtml(deal.status || 'New')}
        </div>
      </div>

      <div class="mobile-row">
        <div class="mobile-label">Vehicle</div>
        <div>
          ${escapeHtml(deal.vehicle_description || '')}
        </div>
      </div>

      <div class="mobile-row">
        <div class="mobile-label">Salesperson</div>
        <div>
          ${escapeHtml(deal.salesperson || '')}
        </div>
      </div>

      <div class="mobile-row">
        <div class="mobile-label">ETA</div>
        <div class="${getEtaClass(deal)}">
          ${formatDate(deal.eta_date)}
        </div>
      </div>

      <div class="mobile-row">
        <div class="mobile-label">Gross</div>
        <div class="money">
          ${formatMoney(deal.gross)}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function bindEditableFields() {

  document
    .querySelectorAll('[data-field]')
    .forEach(el => {

      if (el.dataset.bound === 'true') {
        return;
      }

      el.dataset.bound = 'true';

      if (el.tagName === 'SELECT') {

        el.addEventListener(
          'change',
          async e => {

            await updateDealField(
              e.target.dataset.id,
              e.target.dataset.field,
              e.target.value
            );
          }
        );

      } else {

        el.addEventListener(
          'blur',
          async e => {

            await updateDealField(
              e.target.dataset.id,
              e.target.dataset.field,
              e.target.value
            );
          }
        );
      }
    });
}

function renderStatusOptions(current) {

  const statuses = [
    'New',
    'Pending Finance',
    'Being Worked On',
    'At Sublet',
    'Delivered',
    'Pending',
    'Cancelled'
  ];

  return statuses
    .map(status => `
      <option
        value="${status}"
        ${current === status ? 'selected' : ''}
      >
        ${status}
      </option>
    `)
    .join('');
}

function detectTopBrand(deals) {

  const brands = {};

  deals.forEach(deal => {

    const vehicle =
      String(deal.vehicle_description || '');

    let brand = 'Other';

    if (vehicle.includes('Kia')) brand = 'Kia';
    else if (vehicle.includes('Nissan')) brand = 'Nissan';
    else if (vehicle.includes('GWM')) brand = 'GWM';
    else if (vehicle.includes('Xpeng')) brand = 'Xpeng';

    brands[brand] =
      (brands[brand] || 0) + 1;
  });

  return Object.keys(brands)
    .sort((a,b) => brands[b] - brands[a])[0] || '-';
}

function updateCounts(deals) {

  const count =
    document.getElementById(
      'tableCount'
    );

  if (!count) return;

  count.textContent =
    `${deals.length} deals showing`;
}

function getEtaClass(deal) {

  if (!deal.eta_date) {
    return '';
  }

  if (
    deal.status === 'Delivered' ||
    deal.status === 'Cancelled'
  ) {
    return '';
  }

  const eta =
    startOfDay(
      new Date(deal.eta_date + 'T00:00:00')
    );

  const today =
    startOfDay(new Date());

  const diff =
    (eta - today) / 86400000;

  if (diff < 0) {
    return 'eta-overdue';
  }

  if (diff < 7) {
    return 'eta-warning';
  }

  return 'eta-good';
}

function formatMoney(value) {

  return Number(value || 0)
    .toLocaleString(
      'en-AU',
      {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 0
      }
    );
}

function formatDate(value) {

  if (!value) {
    return '-';
  }

  return new Date(
    value + 'T00:00:00'
  ).toLocaleDateString('en-AU');
}

function shorten(text, max) {

  if (!text) return '';

  return text.length > max
    ? text.slice(0, max) + '...'
    : text;
}

function setText(id, value) {

  const el =
    document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}

function startOfDay(date) {

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
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

  return escapeHtml(value)
    .replaceAll('\n', ' ');
}
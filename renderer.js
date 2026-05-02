import { updateDealField } from './datastore.js';

export function renderDashboard(deals) {

  renderKPIs(deals);

  renderTable(deals);

  updateCounts(deals);
}

function renderKPIs(deals) {

  const totalGross =
    deals.reduce(
      (sum, d) => sum + (Number(d.gross) || 0),
      0
    );

  const negativeGrossDeals =
    deals.filter(d =>
      Number(d.gross) < 0
    );

  const negativeExposure =
    negativeGrossDeals.reduce(
      (sum, d) => sum + Number(d.gross || 0),
      0
    );

  const overdueETAs =
    deals.filter(d => {

      if (!d.eta) return false;

      const eta =
        parseAUDate(d.eta);

      if (!eta) return false;

      return (
        eta < startOfDay(new Date()) &&
        d.status !== 'Delivered' &&
        d.status !== 'Cancelled'
      );
    });

  const next7Days =
    deals.filter(d => {

      if (!d.eta) return false;

      const eta =
        parseAUDate(d.eta);

      if (!eta) return false;

      const diff =
        (eta - startOfDay(new Date()))
        / 86400000;

      return diff >= 0 && diff <= 7;
    });

  const pendingFinance =
    deals.filter(d =>
      String(d.payment || '')
        .toLowerCase()
        .includes('finance')
    );

  const staleDeals =
    deals.filter(d => {

      if (!d.updated) return true;

      const updated =
        new Date(d.updated);

      const diff =
        (Date.now() - updated.getTime())
        / 86400000;

      return diff > 5;
    });

  const topSalesperson =
    detectTopSalesperson(deals);

  setText(
    'kpiDeliveries',
    overdueETAs.length
  );

  setText(
    'kpiDeliveriesSub',
    'Deals at operational risk'
  );

  setText(
    'kpiGross',
    formatMoney(totalGross)
  );

  setText(
    'kpiGrossSub',
    `${negativeGrossDeals.length} negative deals`
  );

  setText(
    'kpiFinance',
    pendingFinance.length
  );

  setText(
    'kpiFinanceSub',
    'Awaiting finance outcome'
  );

  setText(
    'kpiPendingFinance',
    staleDeals.length
  );

  setText(
    'kpiPendingFinanceSub',
    'Untouched >5 days'
  );

  setText(
    'kpiOverdue',
    next7Days.length
  );

  setText(
    'kpiOverdueSub',
    'Deliveries next 7 days'
  );

  setText(
    'kpiTopBrand',
    topSalesperson.name
  );

  setText(
    'kpiTopBrandSub',
    `${topSalesperson.count} active deals`
  );

  const exposureTile =
    document.getElementById(
      'kpiExposure'
    );

  const exposureSub =
    document.getElementById(
      'kpiExposureSub'
    );

  if (exposureTile) {

    exposureTile.textContent =
      formatMoney(negativeExposure);
  }

  if (exposureSub) {

    exposureSub.textContent =
      'Negative gross exposure';
  }
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
        ${escapeHtml(deal.dealNo || '')}
      </td>

      <td>
        ${escapeHtml(deal.department || '')}
      </td>

      <td>
        ${escapeHtml(deal.customer || '')}
      </td>

      <td>
        ${escapeHtml(deal.salesperson || '')}
      </td>

      <td title="${escapeAttr(deal.vehicle || '')}">
        ${escapeHtml(shorten(deal.vehicle || '', 90))}
      </td>

      <td class="${getEtaClass(deal)}">
        ${escapeHtml(deal.eta || '-')}
      </td>

      <td class="${Number(deal.gross) < 0 ? 'negative-money' : 'money'}">
        ${formatMoney(deal.gross)}
      </td>

      <td>
        ${formatMoney(deal.deposit)}
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
        <select
          class="status-select"
          data-id="${deal.id || ''}"
          data-field="payment_method"
        >
          <option ${
            deal.payment === 'Cash'
              ? 'selected' : ''
          }>
            Cash
          </option>

          <option ${
            deal.payment === 'Dealer Finance'
              ? 'selected' : ''
          }>
            Dealer Finance
          </option>

          <option ${
            deal.payment === 'Unknown / Pending'
              ? 'selected' : ''
          }>
            Unknown / Pending
          </option>
        </select>
      </td>

      <td>
        <select
          class="status-select"
          data-id="${deal.id || ''}"
          data-field="priority"
        >
          <option ${
            deal.priority === 'Normal'
              ? 'selected' : ''
          }>
            Normal
          </option>

          <option ${
            deal.priority === 'Hot'
              ? 'selected' : ''
          }>
            Hot
          </option>

          <option ${
            deal.priority === 'Critical'
              ? 'selected' : ''
          }>
            Critical
          </option>
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

      <td>
        ${formatUpdated(deal.updated)}
      </td>
    `;

    tbody.appendChild(row);
  });

  bindEditableFields();
}

function detectTopSalesperson(deals) {

  const counts = {};

  deals.forEach(deal => {

    const person =
      deal.salesperson || 'Unknown';

    counts[person] =
      (counts[person] || 0) + 1;
  });

  const top =
    Object.entries(counts)
      .sort((a,b) => b[1] - a[1])[0];

  if (!top) {
    return {
      name: '-',
      count: 0
    };
  }

  return {
    name: top[0],
    count: top[1]
  };
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

  if (!deal.eta) {
    return '';
  }

  const eta =
    parseAUDate(deal.eta);

  if (!eta) {
    return '';
  }

  const diff =
    (eta - startOfDay(new Date()))
    / 86400000;

  if (diff < 0) {
    return 'eta-overdue';
  }

  if (diff <= 7) {
    return 'eta-warning';
  }

  return 'eta-good';
}

function renderStatusOptions(current) {

  const statuses = [
    'New',
    'Pending Finance',
    'Being Worked On',
    'Delivered',
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

function bindEditableFields() {

  document
    .querySelectorAll('[data-field]')
    .forEach(el => {

      if (el.dataset.bound === 'true') {
        return;
      }

      el.dataset.bound = 'true';

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
    });
}

function parseAUDate(value) {

  if (!value) return null;

  const parts =
    value.split('/');

  if (parts.length !== 3) {
    return null;
  }

  const day =
    Number(parts[0]);

  const month =
    Number(parts[1]) - 1;

  const year =
    2000 + Number(parts[2]);

  return new Date(
    year,
    month,
    day
  );
}

function startOfDay(date) {

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
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

function formatUpdated(value) {

  if (!value) return '-';

  return new Date(value)
    .toLocaleString('en-AU');
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
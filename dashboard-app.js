import { setupDragAndDrop } from './dragdrop.js';
import { loadDeals, setupRealtime, validateSession, logout } from './datastore.js';
import { renderDashboard } from './renderer.js';

let allDeals = [];
let activeView = 'current';
let columnFilters = {};

async function bootDashboard() {
  try {
    console.log('Booting dashboard...');

    await validateSession();

    setupLogout();
    setupDragAndDrop(handleImportedDeals);
    setupSearch();
    setupViewFilters();
    setupColumnFilters();
    setupSyncedScrollbars();

    allDeals = await loadDeals();
    renderCurrentView();

    setupRealtime(async () => {
      console.log('Realtime refresh triggered');
      allDeals = await loadDeals();
      renderCurrentView();
    });

    console.log('Dashboard boot complete');
  } catch (err) {
    console.error('Dashboard boot failed:', err);
    alert('Dashboard failed to load. Check console.');
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

function setupSearch() {
  const searchInput = document.getElementById('globalSearch');

  if (!searchInput) return;

  searchInput.addEventListener('input', renderCurrentView);
}

function setupViewFilters() {
  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      activeView = button.dataset.view;

      document.querySelectorAll('[data-view]').forEach(item => {
        item.classList.toggle('active', item.dataset.view === activeView);
      });

      renderCurrentView();
    });
  });
}

function setupColumnFilters() {
  populateColumnFilterOptions();

  document.querySelectorAll('[data-column-filter]').forEach(input => {
    const update = () => {
      columnFilters[input.dataset.columnFilter] = input.value.trim();
      renderCurrentView();
    };

    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  const clearButton = document.getElementById('clearColumnFilters');

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      columnFilters = {};

      document.querySelectorAll('[data-column-filter]').forEach(input => {
        input.value = '';
      });

      renderCurrentView();
    });
  }
}

function populateColumnFilterOptions() {
  const statusOptions = ['New', 'Pending Finance', 'Being Worked On', 'At Sublet', 'Delivered', 'Pending', 'Cancelled'];
  const paymentOptions = ['Unknown / Pending', 'Cash', 'EFT', 'Dealer Finance', 'Novated Lease', 'External Finance', 'Fleet / Salary Packaging'];
  const priorityOptions = ['Low', 'Normal', 'High'];
  const deptOptions = ['BLK', 'BKF', 'BLG', 'BLN', 'BLU', 'BWH', 'BWN', 'BWU', 'BX'];

  fillSelect('dept_code', deptOptions);
  fillSelect('status', statusOptions);
  fillSelect('payment_method', paymentOptions);
  fillSelect('priority', priorityOptions);
}

function fillSelect(field, options) {
  const select = document.querySelector(`[data-column-filter="${field}"]`);

  if (!select || select.dataset.filled === 'true') return;

  options.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.dataset.filled = 'true';
}

function renderCurrentView() {
  let source = applyViewFilter(allDeals);
  source = applySearch(source);
  source = applyColumnFilters(source);

  renderDashboard(source);
}

function applyViewFilter(deals) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0);

  return deals.filter(deal => {
    const eta = deal.eta_date ? new Date(deal.eta_date + 'T00:00:00') : null;

    if (activeView === 'all') return true;
    if (activeView === 'delivered') return deal.status === 'Delivered';
    if (activeView === 'cancelled') return deal.status === 'Cancelled';
    if (activeView === 'pendingFinance') return deal.status === 'Pending Finance' || deal.payment_method === 'Dealer Finance';
    if (activeView === 'future') return eta && eta > endOfCurrentMonth && deal.status !== 'Delivered' && deal.status !== 'Cancelled';

    return eta &&
      eta.getMonth() === currentMonth &&
      eta.getFullYear() === currentYear &&
      deal.status !== 'Delivered' &&
      deal.status !== 'Cancelled';
  });
}

function applySearch(deals) {
  const searchInput = document.getElementById('globalSearch');
  const term = String(searchInput?.value || '').toLowerCase().trim();

  if (!term) return deals;

  return deals.filter(deal => [
    deal.customer_name,
    deal.salesperson,
    deal.vehicle_description,
    deal.deal_no,
    deal.dept_code,
    deal.brand
  ].join(' ').toLowerCase().includes(term));
}

function applyColumnFilters(deals) {
  return deals.filter(deal => {
    return Object.entries(columnFilters).every(([field, rawValue]) => {
      const value = String(rawValue || '').toLowerCase().trim();

      if (!value) return true;

      if (field === 'eta_date') {
        const iso = String(deal.eta_date || '').toLowerCase();
        const au = deal.eta_date ? new Date(deal.eta_date + 'T00:00:00').toLocaleDateString('en-AU').toLowerCase() : '';

        return iso.includes(value) || au.includes(value);
      }

      return String(deal[field] || '').toLowerCase().includes(value);
    });
  });
}

function setupSyncedScrollbars() {
  const top = document.getElementById('topScrollbar');
  const wrapper = document.getElementById('tableWrapper');

  if (!top || !wrapper) return;

  let syncing = false;

  top.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    wrapper.scrollLeft = top.scrollLeft;
    syncing = false;
  });

  wrapper.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    top.scrollLeft = wrapper.scrollLeft;
    syncing = false;
  });
}

async function handleImportedDeals(parsedDeals) {
  console.log('Imported deals:', parsedDeals);

  allDeals = await loadDeals();

  activeView = 'current';

  document.querySelectorAll('[data-view]').forEach(item => {
    item.classList.toggle('active', item.dataset.view === activeView);
  });

  renderCurrentView();
}

bootDashboard();

import { setupDragAndDrop } from './dragdrop.js';
import { loadDeals, setupRealtime } from './datastore.js';
import { renderDashboard } from './renderer.js';

let allDeals = [];

async function bootDashboard() {
  try {
    console.log('Booting dashboard...');

    setupDragAndDrop(handleImportedDeals);

    allDeals = await loadDeals();

    renderDashboard(allDeals);

    setupRealtime(async () => {
      console.log('Realtime refresh triggered');

      allDeals = await loadDeals();

      renderDashboard(allDeals);
    });

    setupSearch();

    console.log('Dashboard boot complete');

  } catch (err) {
    console.error('Dashboard boot failed:', err);
    alert('Dashboard failed to load. Check console.');
  }
}

function setupSearch() {
  const searchInput = document.getElementById('globalSearch');

  if (!searchInput) return;

  searchInput.addEventListener('input', e => {

    const term = String(e.target.value || '')
      .toLowerCase()
      .trim();

    if (!term) {
      renderDashboard(allDeals);
      return;
    }

    const filtered = allDeals.filter(deal => {

      return [
        deal.customer_name,
        deal.salesperson,
        deal.vehicle_description,
        deal.deal_no,
        deal.dept_code
      ]
      .join(' ')
      .toLowerCase()
      .includes(term);
    });

    renderDashboard(filtered);
  });
}

async function handleImportedDeals(parsedDeals) {

  console.log('Imported deals:', parsedDeals);

  allDeals = await loadDeals();

  renderDashboard(allDeals);
}

bootDashboard();
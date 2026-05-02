// parser.js

export function parseDeals(rows = []) {

  const deals = [];

  for (const rawRow of rows) {

    const row = String(rawRow || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!row) continue;

    // Ignore headers / junk
    if (
      row.includes('Deal Dat') ||
      row.includes('MODEL DESCRIPTION') ||
      row.includes('records listed') ||
      row.startsWith('--------') ||
      row.includes('Page #')
    ) {
      continue;
    }

    // Must contain deal number
    const dealMatch = row.match(/\b(BK|BLG|BLN|BLU|BWH|BWN|BX|KF)\d+\b/i);

    if (!dealMatch) continue;

    const dealNo = dealMatch[0];

    // ============================================
    // ETA + SALE TYPE (MOST IMPORTANT FIX)
    // ============================================

    let eta = '';
    let saleType = '';

    const etaMatch = row.match(/\b([RFGD])\s+(\d{2}\/\d{2}\/\d{2})\s*$/i);

    if (etaMatch) {
      saleType = etaMatch[1];
      eta = etaMatch[2];
    }

    // ============================================
    // DEPOSIT
    // ============================================

    let deposit = 0;

    const depositMatches = row.match(/(\d+\.\d{2})/g);

    if (depositMatches && depositMatches.length >= 2) {
      deposit = parseFloat(depositMatches[1]) || 0;
    }

    // ============================================
    // GROSS
    // ============================================

    let gross = 0;

    const grossMatch = row.match(/(-?\d+\.\d{2})/);

    if (grossMatch) {
      gross = parseFloat(grossMatch[1]) || 0;
    }

    // ============================================
    // CUSTOMER
    // ============================================

    let customer = '';

    const customerMatch = row.match(
      /\b(?:Kia|Nissan|GWM\/Hava|Used|Xpeng)\s+(.+?)\s+(?:Liam|Mark|Ross|Jarrah|Stephen|Jason|David|Louie|Tim|Theo|Nik|Jonathan|Chelsy|Victoria|Kassie|Michael|Peter)/i
    );

    if (customerMatch) {
      customer = customerMatch[1].trim();
    }

    // ============================================
    // SALESPERSON
    // ============================================

    let salesperson = '';

    const salespersonMatch = row.match(
      /\b(Liam WIlli|Mark Thoma|Ross Walsh|Jarrah Mar|Stephen Fr|Jason Eng|David Wang|Louie Liu|Tim Pevitt|Theo Mavri|Nik Gatsio|Jonathan C|Chelsy Cor|Victoria B|Kassie Zha|Michael Li|Peter Reid)\b/i
    );

    if (salespersonMatch) {
      salesperson = salespersonMatch[1];
    }

    // ============================================
    // DEPARTMENT
    // ============================================

    let department = '';

    const deptMatch = row.match(/\b(BLK|BLG|BLN|BLU|BWH|BWN|BX|BKF)\b/);

    if (deptMatch) {
      department = deptMatch[1];
    }

    // ============================================
    // VEHICLE
    // ============================================

    let vehicle = '';

    const stockMatch = row.match(/\b([A-Z]?\d{4,6})\b/);

    if (stockMatch) {

      const stockIndex = row.indexOf(stockMatch[0]);

      if (stockIndex !== -1) {

        const afterStock =
          row.substring(stockIndex + stockMatch[0].length);

        const vehicleMatch =
          afterStock.match(
            /(.+?)\s+(-?\d+\.\d{2})/
          );

        if (vehicleMatch) {
          vehicle = vehicleMatch[1]
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
    }

    // ============================================
    // STATUS
    // ============================================

    let status = 'New';

    if (eta) {

      const etaDate = convertETA(eta);

      if (etaDate) {

        const today = new Date();

        if (etaDate < today) {
          status = 'Overdue';
        }
      }
    }

    deals.push({
      dealNo,
      department,
      customer,
      salesperson,
      vehicle,
      eta,
      saleType,
      gross,
      deposit,
      status,
      rawRow: row,
      updated: new Date().toISOString()
    });
  }

  return deals;
}

function convertETA(value) {

  if (!value) return null;

  const parts = value.split('/');

  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = 2000 + Number(parts[2]);

  return new Date(year, month, day);
}
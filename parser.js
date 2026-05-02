const DEPT_CODES = [
  'BLK',
  'BKF',
  'BLG',
  'BLN',
  'BLU',
  'BWH',
  'BWN',
  'BWU',
  'BX'
];

const DEPT_INFO = {
  BLK: { name: 'B/Burn Kia', brand: 'Kia', site: 'Blackburn' },
  BKF: { name: 'B/Burn Kia Flt', brand: 'Kia Fleet', site: 'Blackburn' },
  BLG: { name: 'B/Burn GWM/Hava', brand: 'GWM/Haval', site: 'Blackburn' },
  BLN: { name: 'B/Burn Nissan', brand: 'Nissan', site: 'Blackburn' },
  BLU: { name: 'B/Burn Used', brand: 'Used', site: 'Blackburn' },
  BWH: { name: 'Burwood HA/GR', brand: 'GWM/Haval', site: 'Burwood' },
  BWN: { name: 'Burwood Nissan', brand: 'Nissan', site: 'Burwood' },
  BWU: { name: 'Burwood Used', brand: 'Used', site: 'Burwood' },
  BX: { name: 'Burwood Xpeng', brand: 'Xpeng', site: 'Burwood' }
};

const SALESPEOPLE = [
  'Liam Williamson',
  'Mark Thomas',
  'Jarrah Martin',
  'Stephen Frick',
  'Ross Walsh',
  'Tim Pevitt',
  'Peter Reid',
  'Louie Liu',
  'Jason Eng',
  'David Wang',
  'Teagan McLaughlin',
  'Francis Chua',
  'Kassie Zhang',
  'Cody Meyer',
  'Victoria Blaszczyk',
  'Michael Liu',
  'Chelsy Corcoran',
  'Nik Gatsios',
  'Jonathan Chen',
  'Theo Mavridis',
  'Mark Wee',
  'Brad Lister',
  'Scott Van Hauen',
  'Yekta Karimifar',
  'Jeremy James'
];

const VEHICLE_KEYWORDS = [
  'Carnival',
  'Sorento',
  'Sportage',
  'Cerato',
  'Stonic',
  'Picanto',
  'Seltos',
  'EV3',
  'EV5',
  'EV6',
  'EV9',
  'K4',
  'Tasman',
  'Tank',
  'Haval',
  'Cannon',
  'Jolion',
  'Patrol',
  'QASHQAI',
  'Qashqai',
  'X-TRAIL',
  'X-Trail',
  'Navara',
  'RWD',
  'AWD',
  'PV5',
  'NIRO'
];

export function parseRowsIntoDeals(rows) {
  const groupedDeals = [];
  let currentDeal = [];

  for (const rawRow of rows || []) {
    const row = cleanLine(rawRow);

    if (!row || isHeaderLine(row)) {
      continue;
    }

    if (isDealStart(row)) {
      if (currentDeal.length) {
        groupedDeals.push(currentDeal);
      }

      currentDeal = [row];
    } else if (currentDeal.length) {
      currentDeal.push(row);
    }
  }

  if (currentDeal.length) {
    groupedDeals.push(currentDeal);
  }

  console.log('GROUPED DEALS:', groupedDeals);

  const parsed = groupedDeals
    .map(parseDealBlock)
    .filter(Boolean);

  const deduped = new Map();

  parsed.forEach(deal => {
    if (deal.deal_no) {
      deduped.set(deal.deal_no, deal);
    }
  });

  return Array.from(deduped.values());
}

function isHeaderLine(row) {
  return row.includes('AG-DAILY-LOG') ||
    row.includes('Deal Dat') ||
    row.includes('--------') ||
    row.includes('Page #') ||
    row.includes('records listed') ||
    row.startsWith('[(') ||
    row.startsWith('For:') ||
    row.startsWith('Port:');
}

function isDealStart(row) {
  return /^\d{2}\/\d{2}\/\d{2}\s+[A-Z]{1,4}\d{3,6}\s+[A-Z]\s+(BLK|BKF|BLG|BLN|BLU|BWH|BWN|BWU|BX)\b/.test(row);
}

function parseDealBlock(lines) {
  try {
    const combined = cleanLine(lines.join(' '));

    const header = combined.match(/^(\d{2}\/\d{2}\/\d{2})\s+([A-Z]{1,4}\d{3,6})\s+([A-Z])\s+(BLK|BKF|BLG|BLN|BLU|BWH|BWN|BWU|BX)\s+(.+)$/);

    if (!header) {
      return null;
    }

    const dealDate = toISODate(header[1]);
    const dealNo = header[2];
    const dmsStatus = header[3];
    const deptCode = header[4];
    const deptInfo = DEPT_INFO[deptCode] || {};
    let body = cleanLine(header[5]);

    if (deptInfo.name && body.startsWith(deptInfo.name)) {
      body = cleanLine(body.slice(deptInfo.name.length));
    }

    const etaDateRaw = findEtaDate(body);
    const etaDate = etaDateRaw ? toISODate(etaDateRaw) : null;

    const saleTypeMatch = body.match(/\b([RFGS])\s+(\d{2}\/\d{2}\/\d{2})\s*$/);
    const saleType = saleTypeMatch ? saleTypeMatch[1] : '';

    if (saleTypeMatch) {
      body = cleanLine(body.slice(0, saleTypeMatch.index));
    }

    const moneyMatches = [...body.matchAll(/-?\d{1,8}\.\d{2}/g)];
    const gross = moneyMatches[0] ? Number(moneyMatches[0][0]) : 0;
    const deposit = moneyMatches[1] ? Number(moneyMatches[1][0]) : 0;

    const beforeMoney = moneyMatches[0]
      ? cleanLine(body.slice(0, moneyMatches[0].index))
      : body;

    const customerNoMatch = body.match(/\b\d{5,8}\b/);
    const customerNo = customerNoMatch ? customerNoMatch[0] : '';

    const front = parseFrontSection(beforeMoney);

    return {
      deal_no: dealNo,
      deal_date: dealDate,
      dms_status: dmsStatus,
      dept_code: deptCode,
      dept_name: deptInfo.name || '',
      dealership: deptInfo.site || '',
      department: deptInfo.name || '',
      brand: deptInfo.brand || '',
      customer_name: front.customerName || '',
      salesperson: front.salesperson || '',
      stock_no: front.stockNo || '',
      vehicle_description: front.vehicleDescription || '',
      eta_date: etaDate,
      gross,
      deposit,
      sale_type: saleType,
      customer_no: customerNo,
      last_imported_at: new Date().toISOString()
    };
  } catch (err) {
    console.error('PARSE DEAL FAILED:', err, lines);
    return null;
  }
}

function parseFrontSection(text) {
  let working = cleanLine(text);
  let salesperson = '';
  let salespersonIndex = -1;

  for (const person of SALESPEOPLE) {
    const match = findLoosePersonMatch(working, person);

    if (match && (salespersonIndex === -1 || match.index < salespersonIndex)) {
      salesperson = person;
      salespersonIndex = match.index;
    }
  }

  let customerName = working;
  let afterSalesperson = '';

  if (salespersonIndex >= 0) {
    customerName = cleanLine(working.slice(0, salespersonIndex));
    afterSalesperson = cleanLine(working.slice(salespersonIndex));

    const firstName = salesperson.split(' ')[0];
    afterSalesperson = cleanLine(afterSalesperson.replace(new RegExp('^' + escapeRegExp(firstName) + '\\s+\\S+', 'i'), ''));
  }

  const stockMatch = afterSalesperson.match(/\b([A-Z]{0,3}\d{3,7}|UC\d{4,7}|NI\d{4,7}|G\d{3,7}|K\d{3,7}|N\d{3,7}|XP\d{3,7}|[A-Z0-9]{1,8}\*O)\b/);
  let stockNo = '';

  if (stockMatch) {
    stockNo = stockMatch[1];
    afterSalesperson = cleanLine(afterSalesperson.replace(stockMatch[0], ''));
  }

  let vehicleDescription = afterSalesperson;

  if (!vehicleDescription) {
    vehicleDescription = extractVehicleFromText(working);
  }

  return {
    customerName,
    salesperson,
    stockNo,
    vehicleDescription
  };
}

function findLoosePersonMatch(text, person) {
  const [first, last = ''] = person.split(' ');
  const lastStem = last.slice(0, Math.min(5, last.length));
  const regex = new RegExp('\\b' + escapeRegExp(first) + '\\s+' + escapeRegExp(lastStem), 'i');
  return text.match(regex);
}

function extractVehicleFromText(text) {
  for (const keyword of VEHICLE_KEYWORDS) {
    const idx = text.indexOf(keyword);

    if (idx >= 0) {
      return cleanLine(text.slice(idx, idx + 130));
    }
  }

  return '';
}

function findEtaDate(text) {
  const saleTypeEta = text.match(/\b[RFGS]\s+(\d{2}\/\d{2}\/\d{2})\s*$/);

  if (saleTypeEta) {
    return saleTypeEta[1];
  }

  const dates = [...text.matchAll(/\d{2}\/\d{2}\/\d{2}/g)];

  if (dates.length < 2) {
    return null;
  }

  return dates[dates.length - 1][0];
}

function toISODate(value) {
  const [day, month, year] = value.split('/');
  const fullYear = Number(year) >= 70 ? `19${year}` : `20${year}`;
  return `${fullYear}-${month}-${day}`;
}

function cleanLine(value) {
  return String(value || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

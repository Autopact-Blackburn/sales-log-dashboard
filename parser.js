// parser.js

const DEPT_CODES = [
  'BLK', 'BKF', 'BLG', 'BLN', 'BLU',
  'BWH', 'BWN', 'BWU', 'BX'
];

const DEPT_NAMES = {
  BLK: 'B/Burn Kia',
  BKF: 'B/Burn Kia Flt',
  BLG: 'B/Burn GWM/Hava',
  BLN: 'B/Burn Nissan',
  BLU: 'B/Burn Used',
  BWH: 'Burwood HA/GR',
  BWN: 'Burwood Nissan',
  BWU: 'Burwood Used',
  BX: 'Burwood Xpeng'
};

const SALESPEOPLE = [
  { raw: /Liam\s+WIlli(?:\s*amson)?/i, name: 'Liam Williamson' },
  { raw: /Mark\s+Thoma(?:\s*s)?/i, name: 'Mark Thomas' },
  { raw: /Jarrah\s+Mar(?:\s*tin)?/i, name: 'Jarrah Martin' },
  { raw: /Stephen\s+Fr(?:\s*ick)?/i, name: 'Stephen Frick' },
  { raw: /Ross\s+Walsh/i, name: 'Ross Walsh' },
  { raw: /Tim\s+Pevitt/i, name: 'Tim Pevitt' },
  { raw: /Peter\s+Reid/i, name: 'Peter Reid' },
  { raw: /Louie\s+Liu/i, name: 'Louie Liu' },
  { raw: /Jason\s+Eng/i, name: 'Jason Eng' },
  { raw: /David\s+Wang/i, name: 'David Wang' },
  { raw: /Teagan\s+McL(?:\s*aughlin)?/i, name: 'Teagan McLaughlin' },
  { raw: /Francis\s+Ch(?:\s*ua)?/i, name: 'Francis Chua' },
  { raw: /Kassie\s+Zha(?:\s*ng)?/i, name: 'Kassie Zhang' },
  { raw: /Cody\s+Meyer/i, name: 'Cody Meyer' },
  { raw: /Victoria\s+B(?:\s*laszczyk)?/i, name: 'Victoria Blaszczyk' },
  { raw: /Michael\s+Li(?:\s*u)?/i, name: 'Michael Liu' },
  { raw: /Chelsy\s+Cor(?:\s*coran)?/i, name: 'Chelsy Corcoran' },
  { raw: /Nik\s+Gatsio(?:\s*s)?/i, name: 'Nik Gatsios' },
  { raw: /Jonathan\s+C(?:\s*hen)?/i, name: 'Jonathan Chen' },
  { raw: /Theo\s+Mavri(?:\s*dis)?/i, name: 'Theo Mavridis' },
  { raw: /Mark\s+Wee/i, name: 'Mark Wee' },
  { raw: /Brad\s+Liste(?:\s*r)?/i, name: 'Brad Lister' },
  { raw: /Scott\s+Van(?:\s*Hauen)?/i, name: 'Scott Van Hauen' },
  { raw: /Yekta\s+Kari(?:\s*mifar)?/i, name: 'Yekta Karimifar' },
  { raw: /Jeremy\s+Jam(?:\s*es)?/i, name: 'Jeremy James' }
];

export function parseRowsIntoDeals(rows = []) {
  return parseDeals(rows);
}

export function parseDeals(rows = []) {
  const blocks = groupDealBlocks(rows);

  const parsed = blocks
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

function groupDealBlocks(rows) {
  const blocks = [];
  let current = [];

  for (const raw of rows) {
    const row = clean(raw);

    if (!row || isJunk(row)) {
      continue;
    }

    if (isDealStart(row)) {
      if (current.length) {
        blocks.push(current);
      }

      current = [row];
      continue;
    }

    if (current.length) {
      current.push(row);
    }
  }

  if (current.length) {
    blocks.push(current);
  }

  return blocks;
}

function parseDealBlock(lines) {
  const combined = clean(lines.join(' '));

  const header = combined.match(
    /^(\d{2}\/\d{2}\/\d{2})\s+([A-Z]{1,4}\d{3,6})\s+([A-Z])\s+(BLK|BKF|BLG|BLN|BLU|BWH|BWN|BWU|BX)\b\s+(.+)$/i
  );

  if (!header) {
    return null;
  }

  const dealDateRaw = header[1];
  const dealNo = header[2].toUpperCase();
  const dmsStatus = header[3].toUpperCase();
  const deptCode = header[4].toUpperCase();

  let body = clean(header[5]);

  const deptName = DEPT_NAMES[deptCode] || '';

  if (deptName && body.toLowerCase().startsWith(deptName.toLowerCase())) {
    body = clean(body.slice(deptName.length));
  }

  const etaInfo = extractEtaAndSaleType(combined);
  const moneyInfo = extractMoney(body);
  const personInfo = extractSalesperson(body);
  const customerName = extractCustomer(body, personInfo);
  const vehicleDescription = extractVehicle(body, personInfo, moneyInfo);

  const brand = getBrand(deptCode, vehicleDescription);

  return {
    deal_no: dealNo,
    deal_date: toISODate(dealDateRaw),
    dms_status: dmsStatus,
    dept_code: deptCode,
    dept_name: deptName,
    dealership: deptName,
    department: deptName,
    brand,

    customer_name: customerName,
    salesperson: personInfo.name,
    vehicle_description: vehicleDescription,

    eta_date: etaInfo.eta_date,
    sale_type: etaInfo.sale_type,

    gross: moneyInfo.gross,
    deposit: moneyInfo.deposit,

    status: 'New',
    payment_method: 'Unknown / Pending',
    priority: 'Normal',

    raw_row: combined,
    last_imported_at: new Date().toISOString()
  };
}

function extractEtaAndSaleType(text) {
  const matches = [
    ...text.matchAll(/\b([RFG])\s+(\d{2}\/\d{2}\/\d{2})\b/gi)
  ];

  if (!matches.length) {
    return {
      sale_type: '',
      eta_date: null
    };
  }

  const last = matches[matches.length - 1];

  return {
    sale_type: last[1].toUpperCase(),
    eta_date: toISODate(last[2])
  };
}

function extractMoney(text) {
  const matches = [
    ...text.matchAll(/-?\d{1,8}\.\d{2}/g)
  ];

  const values = matches.map(m => Number(m[0]));

  const gross = values.length ? values[0] : 0;

  let deposit = 0;

  if (values.length >= 2) {
    const possibleDeposit = values[1];

    if (possibleDeposit >= 0 && possibleDeposit <= 100000) {
      deposit = possibleDeposit;
    }
  }

  return {
    gross,
    deposit,
    firstMoneyIndex: matches.length ? matches[0].index : -1
  };
}

function extractSalesperson(text) {
  for (const person of SALESPEOPLE) {
    const match = text.match(person.raw);

    if (match) {
      return {
        name: person.name,
        raw: match[0],
        index: match.index
      };
    }
  }

  return {
    name: '',
    raw: '',
    index: -1
  };
}

function extractCustomer(text, personInfo) {
  if (personInfo.index < 0) {
    return '';
  }

  return clean(text.slice(0, personInfo.index));
}

function extractVehicle(text, personInfo, moneyInfo) {
  if (personInfo.index < 0) {
    return '';
  }

  let start = personInfo.index + personInfo.raw.length;
  let end = moneyInfo.firstMoneyIndex > start
    ? moneyInfo.firstMoneyIndex
    : text.length;

  let vehicle = clean(text.slice(start, end));

  vehicle = vehicle.replace(/\b[A-Z]{0,3}\d{3,7}\b/, '');
  vehicle = vehicle.replace(/\b\d+\*O\b/gi, '');
  vehicle = vehicle.replace(/\b[A-Z]-?A\*O\b/gi, '');
  vehicle = vehicle.replace(/\s+/g, ' ').trim();

  return vehicle;
}

function isDealStart(row) {
  return /^\d{2}\/\d{2}\/\d{2}\s+[A-Z]{1,4}\d{3,6}\s+[A-Z]\s+(BLK|BKF|BLG|BLN|BLU|BWH|BWN|BWU|BX)\b/i.test(row);
}

function isJunk(row) {
  return (
    row.includes('AG-DAILY-LOG') ||
    row.includes('Deal Dat') ||
    row.includes('MODEL DESCRIPTION') ||
    row.includes('records listed') ||
    row.includes('Page #') ||
    row.startsWith('--------') ||
    row.startsWith('[(') ||
    row.startsWith('For:')
  );
}

function getBrand(deptCode, vehicle) {
  if (deptCode === 'BX') return 'Xpeng';
  if (deptCode === 'BLG' || deptCode === 'BWH') return 'GWM/Haval';
  if (deptCode === 'BLN' || deptCode === 'BWN') return 'Nissan';
  if (deptCode === 'BLU' || deptCode === 'BWU') return 'Used';

  const text = String(vehicle || '').toLowerCase();

  if (text.includes('xpeng')) return 'Xpeng';
  if (text.includes('haval') || text.includes('gwm')) return 'GWM/Haval';
  if (text.includes('nissan') || text.includes('qashqai') || text.includes('patrol')) return 'Nissan';

  return 'Kia';
}

function toISODate(value) {
  if (!value) return null;

  const parts = value.split('/');

  if (parts.length !== 3) return null;

  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = Number(parts[2]) >= 70
    ? `19${parts[2]}`
    : `20${parts[2]}`;

  return `${year}-${month}-${day}`;
}

function clean(value) {
  return String(value || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
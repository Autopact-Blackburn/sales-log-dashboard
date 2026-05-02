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

export function parseRowsIntoDeals(rows) {

  const groupedDeals = [];

  let currentDeal = [];

  for (const row of rows) {

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

  return groupedDeals
    .map(parseDealBlock)
    .filter(Boolean);
}

function isDealStart(row) {

  return (
    /\\d{2}\\/\\d{2}\\/\\d{2}/.test(row) &&
    /[A-Z]{1,4}\\d{3,6}/.test(row) &&
    DEPT_CODES.some(code => row.includes(code))
  );
}

function parseDealBlock(lines) {

  try {

    const combined =
      lines.join(' ')
        .replace(/\\s+/g, ' ')
        .trim();

    const dateMatch =
      combined.match(/\\d{2}\\/\\d{2}\\/\\d{2}/);

    const dealNoMatch =
      combined.match(/[A-Z]{1,4}\\d{3,6}/);

    const deptMatch =
      combined.match(/\\b(BLK|BKF|BLG|BLN|BLU|BWH|BWN|BWU|BX)\\b/);

    if (
      !dateMatch ||
      !dealNoMatch ||
      !deptMatch
    ) {
      return null;
    }

    const etaMatch =
      findLastDate(combined);

    let etaDate = null;

    if (etaMatch) {

      const [d, m, y] =
        etaMatch.split('/');

      etaDate =
        `20${y}-${m}-${d}`;
    }

    const salesperson =
      detectSalesperson(combined);

    const customerName =
      extractCustomerName(
        combined,
        salesperson,
        dealNoMatch[0],
        deptMatch[0]
      );

    const vehicleDescription =
      extractVehicle(combined);

    const gross =
      extractGross(combined);

    return {

      deal_no: dealNoMatch[0],

      dept_code: deptMatch[0],

      customer_name: customerName,

      salesperson,

      vehicle_description: vehicleDescription,

      eta_date: etaDate,

      gross,

      last_imported_at:
        new Date().toISOString()
    };

  } catch (err) {

    console.error(
      'PARSE DEAL FAILED:',
      err
    );

    return null;
  }
}

function detectSalesperson(text) {

  for (const person of SALESPEOPLE) {

    if (
      text.toLowerCase()
        .includes(person.toLowerCase())
    ) {
      return person;
    }
  }

  return '';
}

function extractCustomerName(
  text,
  salesperson,
  dealNo,
  deptCode
) {

  let working = text;

  working =
    working.replace(dealNo, '');

  working =
    working.replace(deptCode, '');

  if (salesperson) {

    const split =
      working.split(salesperson);

    working = split[0];
  }

  working =
    working.replace(/\\d{2}\\/\\d{2}\\/\\d{2}/, '');

  return working
    .replace(/\\s+/g, ' ')
    .trim();
}

function extractVehicle(text) {

  const vehicleKeywords = [
    'Carnival',
    'Sorento',
    'Sportage',
    'Cerato',
    'Stonic',
    'Picanto',
    'Seltos',
    'EV5',
    'EV6',
    'Xpeng',
    'G6',
    'GWM',
    'Haval',
    'Cannon',
    'X-Trail',
    'Qashqai',
    'Patrol',
    'Navara'
  ];

  for (const keyword of vehicleKeywords) {

    const idx =
      text.indexOf(keyword);

    if (idx > -1) {

      return text
        .slice(idx, idx + 120)
        .trim();
    }
  }

  return '';
}

function extractGross(text) {

  const matches =
    [...text.matchAll(/-?\\d+\\.\\d{2}/g)];

  if (!matches.length) {
    return 0;
  }

  return Number(matches[0][0]);
}

function findLastDate(text) {

  const matches =
    [...text.matchAll(/\\d{2}\\/\\d{2}\\/\\d{2}/g)];

  if (!matches.length) {
    return null;
  }

  return matches[matches.length - 1][0];
}
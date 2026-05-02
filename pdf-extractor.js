// pdf-extractor.js

import { CONFIG } from './config.js';

const COLUMN_RANGES = {
  deal_date: [0, 70],
  deal_no: [70, 150],
  dms_status: [150, 210],
  dept_code: [210, 320],
  customer_name: [320, 620],
  salesperson: [620, 760],
  vehicle_description: [760, 1220],
  gross: [1220, 1320],
  deposit: [1320, 1420],
  eta: [1420, 1600]
};

export async function extractRowsFromPDF(file) {

  if (!window.pdfjsLib) {
    throw new Error('PDF.js not loaded');
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    CONFIG.PDF_WORKER;

  const arrayBuffer =
    await file.arrayBuffer();

  const pdf =
    await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise;

  const extractedDeals = [];

  console.log(
    'PDF PAGE COUNT:',
    pdf.numPages
  );

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {

    console.log(
      `PROCESSING PAGE ${pageNumber}`
    );

    const page =
      await pdf.getPage(pageNumber);

    const content =
      await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false
      });

    const items = content.items
      .map(item => ({
        text: clean(item.str),
        x: Number(item.transform[4]),
        y: Number(item.transform[5])
      }))
      .filter(item =>
        item.text &&
        item.text.length
      );

    console.log(
      `PAGE ${pageNumber} ITEMS`,
      items
    );

    const groupedRows =
      buildCoordinateRows(items);

    console.log(
      `PAGE ${pageNumber} GROUPED ROWS`,
      groupedRows
    );

    extractedDeals.push(...groupedRows);
  }

  console.log(
    'FINAL STRUCTURED DEALS:',
    extractedDeals
  );

  return extractedDeals;
}

function buildCoordinateRows(items) {

  const tolerance = 6;

  const rowGroups = [];

  const sorted =
    [...items].sort((a, b) => {

      if (
        Math.abs(b.y - a.y) > tolerance
      ) {
        return b.y - a.y;
      }

      return a.x - b.x;
    });

  sorted.forEach(item => {

    let row =
      rowGroups.find(group =>
        Math.abs(group.y - item.y)
        <= tolerance
      );

    if (!row) {

      row = {
        y: item.y,
        items: []
      };

      rowGroups.push(row);
    }

    row.items.push(item);
  });

  const structuredRows = [];

  rowGroups
    .sort((a, b) => b.y - a.y)
    .forEach(group => {

      const rowObject =
        buildStructuredRow(group.items);

      if (
        rowObject &&
        rowObject.deal_no
      ) {
        structuredRows.push(rowObject);
      }
    });

  return structuredRows;
}

function buildStructuredRow(items) {

  const row = {
    raw_items: items,
    raw_row: items
      .map(i => i.text)
      .join(' ')
  };

  Object.entries(COLUMN_RANGES)
    .forEach(([field, range]) => {

      const [minX, maxX] = range;

      const text =
        items
          .filter(item =>
            item.x >= minX &&
            item.x < maxX
          )
          .sort((a, b) => a.x - b.x)
          .map(item => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

      row[field] = text || null;
    });

  if (
    !row.deal_no ||
    !/[A-Z]{1,4}\d{3,6}/i
      .test(row.deal_no)
  ) {
    return null;
  }

  row.deal_no =
    extractDealNo(row.deal_no);

  row.dept_code =
    extractDept(row.dept_code);

  row.customer_name =
    clean(row.customer_name);

  row.salesperson =
    cleanSalesperson(
      row.salesperson
    );

  row.vehicle_description =
    cleanVehicle(
      row.vehicle_description
    );

  row.gross =
    parseMoney(row.gross);

  row.deposit =
    parseMoney(row.deposit);

  row.eta_date =
    extractETA(row);

  row.sale_type =
    extractSaleType(row);

  row.brand =
    detectBrand(
      row.dept_code,
      row.vehicle_description
    );

  row.status = 'New';

  row.payment_method =
    'Unknown / Pending';

  row.priority = 'Normal';

  row.last_imported_at =
    new Date().toISOString();

  return row;
}

function extractDealNo(value) {

  const match =
    String(value || '')
      .match(/[A-Z]{1,4}\d{3,6}/i);

  return match
    ? match[0].toUpperCase()
    : null;
}

function extractDept(value) {

  const match =
    String(value || '')
      .match(
        /\b(BLK|BKF|BLG|BLN|BLU|BWH|BWN|BWU|BX)\b/i
      );

  return match
    ? match[1].toUpperCase()
    : null;
}

function extractETA(row) {

  const combined =
    [
      row.vehicle_description,
      row.eta,
      row.raw_row
    ].join(' ');

  const matches =
    [
      ...combined.matchAll(
        /\b\d{2}\/\d{2}\/\d{2}\b/g
      )
    ];

  if (!matches.length) {
    return null;
  }

  const last =
    matches[matches.length - 1][0];

  return toISODate(last);
}

function extractSaleType(row) {

  const combined =
    [
      row.vehicle_description,
      row.eta,
      row.raw_row
    ].join(' ');

  const match =
    combined.match(
      /\b([RFGD])\s+\d{2}\/\d{2}\/\d{2}\b/i
    );

  return match
    ? match[1].toUpperCase()
    : null;
}

function parseMoney(value) {

  if (!value) return 0;

  const match =
    String(value)
      .replace(/,/g, '')
      .match(/-?\d+\.\d{2}/);

  return match
    ? Number(match[0])
    : 0;
}

function cleanVehicle(value) {

  if (!value) return '';

  return String(value)
    .replace(/\b(R|F|G|D)\s+\d{2}\/\d{2}\/\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSalesperson(value) {

  if (!value) return '';

  return String(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function detectBrand(
  deptCode,
  vehicle
) {

  if (deptCode === 'BX') {
    return 'Xpeng';
  }

  if (
    deptCode === 'BLG' ||
    deptCode === 'BWH'
  ) {
    return 'GWM/Haval';
  }

  if (
    deptCode === 'BLN' ||
    deptCode === 'BWN'
  ) {
    return 'Nissan';
  }

  if (
    deptCode === 'BLU' ||
    deptCode === 'BWU'
  ) {
    return 'Used';
  }

  const text =
    String(vehicle || '')
      .toLowerCase();

  if (
    text.includes('gwm') ||
    text.includes('haval')
  ) {
    return 'GWM/Haval';
  }

  if (
    text.includes('xpeng')
  ) {
    return 'Xpeng';
  }

  if (
    text.includes('nissan')
  ) {
    return 'Nissan';
  }

  return 'Kia';
}

function toISODate(value) {

  if (!value) return null;

  const parts =
    value.split('/');

  if (parts.length !== 3) {
    return null;
  }

  const day =
    parts[0].padStart(2, '0');

  const month =
    parts[1].padStart(2, '0');

  const year =
    Number(parts[2]) >= 70
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
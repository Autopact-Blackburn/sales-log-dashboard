import { CONFIG } from './config.js';

export async function extractRowsFromPDF(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js not loaded');
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.PDF_WORKER;

  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer
  }).promise;

  const allRows = [];

  console.log('PDF PAGE COUNT:', pdf.numPages);

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const content = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false
    });

    const items = content.items
      .map(item => ({
        text: String(item.str || '').trim(),
        x: Number(item.transform[4]),
        y: Number(item.transform[5])
      }))
      .filter(item => item.text);

    console.log(`PAGE ${pageNumber} RAW ITEMS`, items);

    const rows = rebuildVisualRows(items);

    console.log(`PAGE ${pageNumber} REBUILT ROWS`, rows);

    allRows.push(...rows);
  }

  const cleanedRows = allRows
    .map(row => String(row || '').replace(/\s+/g, ' ').trim())
    .filter(row => row && row.length >= 4);

  console.log('FINAL CLEANED ROWS:', cleanedRows);

  return cleanedRows;
}

function rebuildVisualRows(items) {
  const tolerance = 6;
  const rowGroups = [];

  const sorted = [...items].sort((a, b) => {
    if (Math.abs(b.y - a.y) > tolerance) {
      return b.y - a.y;
    }

    return a.x - b.x;
  });

  sorted.forEach(item => {
    let row = rowGroups.find(group => Math.abs(group.y - item.y) <= tolerance);

    if (!row) {
      row = {
        y: item.y,
        items: []
      };

      rowGroups.push(row);
    }

    row.items.push(item);
  });

  return rowGroups
    .sort((a, b) => b.y - a.y)
    .map(group => group.items
      .sort((a, b) => a.x - b.x)
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    )
    .filter(Boolean);
}

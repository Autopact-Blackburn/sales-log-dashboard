import { extractRowsFromPDF } from './pdf-extractor.js';
import { parseRowsIntoDeals } from './parser.js';
import { upsertDeals } from './datastore.js';

export function setupDragAndDrop(onComplete) {

  const uploadZone = document.getElementById('uploadZone');

  const pdfInput = document.getElementById('pdfInput');

  const uploadStatus = document.getElementById('uploadStatus');

  if (!uploadZone || !pdfInput) {
    console.error('Upload elements missing');
    return;
  }

  ['dragenter', 'dragover'].forEach(eventName => {

    uploadZone.addEventListener(eventName, e => {

      e.preventDefault();
      e.stopPropagation();

      uploadZone.classList.add('dragover');

    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {

    uploadZone.addEventListener(eventName, e => {

      e.preventDefault();
      e.stopPropagation();

      uploadZone.classList.remove('dragover');

    }, false);
  });

  uploadZone.addEventListener('drop', async e => {

    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;

    if (!files || !files.length) {
      return;
    }

    const file = files[0];

    console.log('DROP CAPTURED:', file.name);

    await processPDF(file);

  });

  uploadZone.addEventListener('click', () => {
    pdfInput.click();
  });

  pdfInput.addEventListener('change', async e => {

    const file = e.target.files[0];

    if (file) {
      await processPDF(file);
    }

    e.target.value = '';

  });

  async function processPDF(file) {

    try {

      if (
        file.type !== 'application/pdf' &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {

        uploadStatus.innerHTML =
          '<div class=\"upload-error\">Only PDF files allowed</div>';

        return;
      }

      uploadStatus.innerHTML =
        '<div class=\"upload-processing\">Reading PDF...</div>';

      const rows = await extractRowsFromPDF(file);

      console.log('EXTRACTED ROWS:', rows);

      uploadStatus.innerHTML =
        '<div class=\"upload-processing\">Parsing deals...</div>';

      const parsedDeals = parseRowsIntoDeals(rows);

      console.log('PARSED DEALS:', parsedDeals);

      if (!parsedDeals.length) {

        uploadStatus.innerHTML =
          '<div class=\"upload-error\">No valid deals parsed</div>';

        return;
      }

      const etaCount =
        parsedDeals.filter(d => d.eta_date).length;

      uploadStatus.innerHTML =
        `<div class=\"upload-processing\">
          Uploading ${parsedDeals.length} deals...
        </div>`;

      await upsertDeals(parsedDeals);

      uploadStatus.innerHTML =
        `<div class=\"upload-success\">
          ${parsedDeals.length} deals imported<br>
          ${etaCount} ETA dates detected
        </div>`;

      if (typeof onComplete === 'function') {
        await onComplete(parsedDeals);
      }

    } catch (err) {

      console.error('PDF PROCESS FAILED:', err);

      uploadStatus.innerHTML =
        `<div class=\"upload-error\">
          ${err.message || 'Import failed'}
        </div>`;
    }
  }
}
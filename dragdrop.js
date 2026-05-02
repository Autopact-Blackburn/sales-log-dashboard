import { extractRowsFromPDF } from './pdf-extractor.js';
import { parseDeals } from './parser.js';
import { upsertDeals } from './datastore.js';

export function setupDragAndDrop(onComplete) {

  const uploadZone =
    document.getElementById('uploadZone');

  const pdfInput =
    document.getElementById('pdfInput');

  const uploadStatus =
    document.getElementById('uploadStatus');

  if (
    !uploadZone ||
    !pdfInput ||
    !uploadStatus
  ) {
    console.error(
      'Upload elements missing'
    );

    return;
  }

  setupGlobalDropProtection(uploadZone);

  ['dragenter', 'dragover']
    .forEach(eventName => {

      uploadZone.addEventListener(
        eventName,
        e => {

          e.preventDefault();
          e.stopPropagation();

          if (e.dataTransfer) {
            e.dataTransfer.dropEffect =
              'copy';
          }

          uploadZone.classList.add(
            'dragover'
          );
        }
      );
    });

  ['dragleave', 'drop']
    .forEach(eventName => {

      uploadZone.addEventListener(
        eventName,
        e => {

          e.preventDefault();
          e.stopPropagation();

          uploadZone.classList.remove(
            'dragover'
          );
        }
      );
    });

  uploadZone.addEventListener(
    'drop',
    async e => {

      e.preventDefault();
      e.stopPropagation();

      const files =
        Array.from(
          e.dataTransfer?.files || []
        );

      const file =
        files.find(item =>
          item.type === 'application/pdf' ||
          item.name
            .toLowerCase()
            .endsWith('.pdf')
        );

      if (!file) {

        uploadStatus.innerHTML = `
          <div class="upload-error">
            No PDF detected in drop.
          </div>
        `;

        return;
      }

      console.log(
        'DROP CAPTURED:',
        file.name
      );

      await processPDF(file);
    }
  );

  uploadZone.addEventListener(
    'click',
    () => pdfInput.click()
  );

  uploadZone.addEventListener(
    'keydown',
    e => {

      if (
        e.key === 'Enter' ||
        e.key === ' '
      ) {

        e.preventDefault();

        pdfInput.click();
      }
    }
  );

  pdfInput.addEventListener(
    'change',
    async e => {

      const file =
        e.target.files?.[0];

      if (file) {
        await processPDF(file);
      }

      e.target.value = '';
    }
  );

  async function processPDF(file) {

    try {

      uploadStatus.innerHTML = `
        <div class="upload-processing">
          Reading PDF...
        </div>
      `;

      const rows =
        await extractRowsFromPDF(file);

      console.log(
        'EXTRACTED ROWS:',
        rows
      );

      uploadStatus.innerHTML = `
        <div class="upload-processing">
          Parsing ${rows.length} rows...
        </div>
      `;

      const parsedDeals =
        parseDeals(rows);

      console.log(
        'PARSED DEALS:',
        parsedDeals
      );

      if (!parsedDeals.length) {

        uploadStatus.innerHTML = `
          <div class="upload-error">
            No valid deals parsed.
          </div>
        `;

        return;
      }

      uploadStatus.innerHTML = `
        <div class="upload-processing">
          Uploading ${parsedDeals.length} deals...
        </div>
      `;

      await upsertDeals(parsedDeals);

      document.getElementById(
        'lastImport'
      ).textContent =
        new Date()
          .toLocaleString('en-AU');

      document.getElementById(
        'newDeals'
      ).textContent =
        parsedDeals.length;

      document.getElementById(
        'updatedDeals'
      ).textContent =
        '0';

      const etaCount =
        parsedDeals.filter(
          d => d.eta
        ).length;

      uploadStatus.innerHTML = `
        <div class="upload-success">
          Import complete<br>
          ${parsedDeals.length} deals imported<br>
          ${etaCount} ETA dates detected
        </div>
      `;

      if (
        typeof onComplete === 'function'
      ) {

        await onComplete(parsedDeals);
      }

    } catch (err) {

      console.error(
        'PDF PROCESS FAILED:',
        err
      );

      uploadStatus.innerHTML = `
        <div class="upload-error">
          ${err.message || 'Import failed'}
        </div>
      `;
    }
  }
}

function setupGlobalDropProtection(
  uploadZone
) {

  ['dragenter', 'dragover', 'drop']
    .forEach(eventName => {

      window.addEventListener(
        eventName,
        e => {

          e.preventDefault();

          if (e.dataTransfer) {

            e.dataTransfer.dropEffect =
              'copy';
          }
        }
      );
    });

  window.addEventListener(
    'dragleave',
    e => {

      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {

        uploadZone.classList.remove(
          'dragover'
        );
      }
    }
  );
}
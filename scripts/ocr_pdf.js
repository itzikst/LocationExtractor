import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 'tsvika';
const INPUT_URI = `gs://${BUCKET}/input/document.pdf`;
const OUTPUT_PREFIX = `gs://${BUCKET}/output/`;

function getAccessToken() {
  console.log('Fetching Google Cloud access token...');
  return execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
}

async function startOcrJob(token) {
  console.log(`Starting OCR job for ${INPUT_URI} -> ${OUTPUT_PREFIX}...`);
  const endpoint = 'https://vision.googleapis.com/v1/files:asyncBatchAnnotate';
  const body = {
    requests: [
      {
        inputConfig: {
          gcsSource: {
            uri: INPUT_URI
          },
          mimeType: 'application/pdf'
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION'
          }
        ],
        outputConfig: {
          gcsDestination: {
            uri: OUTPUT_PREFIX
          },
          batchSize: 20
        }
      }
    ]
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': 'geotrends-2026'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to initiate OCR job (${res.status} ${res.statusText}): ${errorText}`);
  }

  const data = await res.json();
  console.log('OCR job initiated successfully:', JSON.stringify(data, null, 2));
  return data.name;
}

async function pollOperation(operationName, token) {
  console.log(`Polling operation: ${operationName}...`);
  const endpoint = `https://vision.googleapis.com/v1/${operationName}`;

  while (true) {
    const currentToken = getAccessToken();
    const res = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'X-Goog-User-Project': 'geotrends-2026'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to check operation status (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    if (data.done) {
      if (data.error) {
        throw new Error(`OCR operation failed: ${JSON.stringify(data.error, null, 2)}`);
      }
      console.log('OCR operation completed successfully!');
      return data;
    }

    console.log(`[${new Date().toLocaleTimeString()}] OCR is in progress, waiting 6 seconds...`);
    await new Promise((r) => setTimeout(r, 6000));
  }
}

async function consolidateResults() {
  console.log('Listing output files in Cloud Storage...');
  const lsOutput = execSync(`gcloud storage ls "${OUTPUT_PREFIX}*.json"`, { encoding: 'utf-8' });
  const jsonFiles = lsOutput.split(/\r?\n/).map(s => s.trim()).filter(s => s.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} JSON result batch file(s):`);
  jsonFiles.forEach(f => console.log(` - ${f}`));

  const allPages = [];

  const tempDir = join(process.cwd(), '.ocr_tmp');
  mkdirSync(tempDir, { recursive: true });

  for (const gcsPath of jsonFiles) {
    const filename = gcsPath.split('/').pop();
    const localPath = join(tempDir, filename);
    console.log(`Downloading ${filename}...`);
    execSync(`gcloud storage cp "${gcsPath}" "${localPath}"`, { stdio: 'inherit' });

    const content = JSON.parse(await import('node:fs').then(fs => fs.promises.readFile(localPath, 'utf-8')));
    if (content.responses) {
      for (const resp of content.responses) {
        const pageNumber = resp.context?.pageNumber || allPages.length + 1;
        const text = resp.fullTextAnnotation?.text || '';
        allPages.push({ pageNumber, text });
      }
    }
  }

  // Sort pages by pageNumber
  allPages.sort((a, b) => a.pageNumber - b.pageNumber);
  console.log(`Total extracted pages: ${allPages.length}`);

  // Build Plain Text document
  let plainText = `OCR Extracted Text\nSource: ${INPUT_URI}\nDate: ${new Date().toISOString()}\nTotal Pages: ${allPages.length}\n${'='.repeat(60)}\n\n`;
  for (const page of allPages) {
    plainText += `--- Page ${page.pageNumber} ---\n\n${page.text}\n\n`;
  }

  // Build Markdown document
  let markdown = `# OCR Extracted Document\n\n- **Source File**: \`${INPUT_URI}\`\n- **Extracted Date**: ${new Date().toISOString()}\n- **Total Pages**: ${allPages.length}\n\n---\n\n`;
  for (const page of allPages) {
    markdown += `## Page ${page.pageNumber}\n\n${page.text}\n\n---\n\n`;
  }

  const localTxtPath = join(tempDir, 'document_extracted.txt');
  const localMdPath = join(tempDir, 'document_extracted.md');

  writeFileSync(localTxtPath, plainText, 'utf-8');
  writeFileSync(localMdPath, markdown, 'utf-8');

  console.log('Uploading consolidated text files to GCS...');
  execSync(`gcloud storage cp "${localTxtPath}" "${OUTPUT_PREFIX}document_extracted.txt"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${localMdPath}" "${OUTPUT_PREFIX}document_extracted.md"`, { stdio: 'inherit' });

  console.log('\n================ OCR Sample Preview (First 500 chars) ================');
  const preview = (allPages[0]?.text || '').slice(0, 500);
  console.log(preview);
  console.log('======================================================================\n');
  console.log(`All OCR results successfully saved to ${OUTPUT_PREFIX}`);
}

async function main() {
  try {
    const token = getAccessToken();
    const operationName = await startOcrJob(token);
    await pollOperation(operationName, token);
    await consolidateResults();
  } catch (err) {
    console.error('Error running OCR pipeline:', err);
    process.exit(1);
  }
}

main();

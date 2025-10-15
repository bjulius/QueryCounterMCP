import { promises as fs } from 'fs';
import path from 'path';

// Helper function to escape CSV fields
function escapeCsvField(field) {
  if (!field) return '';
  field = String(field);
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

async function convertMdToCsv() {
  const mdPath = 'QueryTrackMCP.md';
  const csvPath = 'QueryTrackMCP.csv';

  try {
    // Read the markdown file
    const content = await fs.readFile(mdPath, 'utf-8');

    // Split into entries (each entry starts with ##)
    const entries = content.split(/^## /m).slice(1); // Skip header

    const csvRows = [];

    // Add CSV header
    csvRows.push('timestamp,date,model,category,query_summary,notes');

    for (const entry of entries) {
      const lines = entry.split('\n');
      const date = lines[0].trim();

      let model = '';
      let category = '';
      let query = '';
      let notes = '';
      let timestamp = '';

      for (const line of lines) {
        if (line.includes('**Model**:')) {
          model = line.replace(/.*\*\*Model\*\*:\s*/, '').trim();
        } else if (line.includes('**Category**:')) {
          category = line.replace(/.*\*\*Category\*\*:\s*/, '').trim();
        } else if (line.includes('**Query**:')) {
          query = line.replace(/.*\*\*Query\*\*:\s*/, '').trim();
        } else if (line.includes('**Notes**:')) {
          notes = line.replace(/.*\*\*Notes\*\*:\s*/, '').trim();
        } else if (line.includes('**Timestamp**:')) {
          timestamp = line.replace(/.*\*\*Timestamp\*\*:\s*/, '').trim();
        }
      }

      // Only add if we have the required fields
      if (timestamp && model && query) {
        const row = [
          timestamp,
          date,
          escapeCsvField(model),
          escapeCsvField(category),
          escapeCsvField(query),
          escapeCsvField(notes)
        ].join(',');

        csvRows.push(row);
      }
    }

    // Write to CSV file
    await fs.writeFile(csvPath, csvRows.join('\n') + '\n', 'utf-8');

    console.log(`Successfully converted ${entries.length} entries from ${mdPath} to ${csvPath}`);
    console.log(`Total rows written: ${csvRows.length - 1}`); // -1 for header

  } catch (error) {
    console.error('Error converting file:', error.message);
    process.exit(1);
  }
}

convertMdToCsv();

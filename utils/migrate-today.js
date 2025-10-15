import { readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mdPath = join(__dirname, 'QueryTrackMCP.md');
const csvPath = join(__dirname, 'QueryTrackMCP.csv');

function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function parseMdEntries() {
  const content = readFileSync(mdPath, 'utf-8');
  const entries = [];

  // Split by entry separator
  const blocks = content.split('---\n').filter(b => b.trim());

  let currentEntry = null;

  for (const block of blocks) {
    const lines = block.split('\n');

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Start new entry
        if (currentEntry && currentEntry.timestamp) {
          entries.push(currentEntry);
        }
        currentEntry = { date: line.replace('## ', '').trim() };
      } else if (line.includes('**Model**:')) {
        currentEntry.model = line.split('**Model**:')[1].trim();
      } else if (line.includes('**Category**:')) {
        currentEntry.category = line.split('**Category**:')[1].trim();
      } else if (line.includes('**Query**:')) {
        currentEntry.query = line.split('**Query**:')[1].trim();
      } else if (line.includes('**Notes**:')) {
        currentEntry.notes = line.split('**Notes**:')[1].trim();
      } else if (line.includes('**Timestamp**:')) {
        currentEntry.timestamp = line.split('**Timestamp**:')[1].trim();
      }
    }
  }

  // Add last entry
  if (currentEntry && currentEntry.timestamp) {
    entries.push(currentEntry);
  }

  return entries;
}

// Parse all entries
const allEntries = parseMdEntries();

// Filter for today (10/14/2025)
const todayEntries = allEntries.filter(entry => {
  return entry.timestamp && entry.timestamp.startsWith('2025-10-14');
});

console.log(`Found ${todayEntries.length} entries for today (10/14/2025)`);

// Append to CSV
const csvRows = todayEntries.map(entry => {
  return [
    entry.timestamp,
    escapeCsvField(entry.date),
    escapeCsvField(entry.model || ''),
    escapeCsvField(entry.category || ''),
    escapeCsvField(entry.query || ''),
    escapeCsvField(entry.notes || '')
  ].join(',');
});

if (csvRows.length > 0) {
  appendFileSync(csvPath, csvRows.join('\n') + '\n', 'utf-8');
  console.log(`✓ Migrated ${csvRows.length} entries to ${csvPath}`);

  // Show what was migrated
  todayEntries.forEach((entry, i) => {
    console.log(`  ${i + 1}. [${entry.category || 'no category'}] ${entry.query ? entry.query.substring(0, 60) : 'no query'}...`);
  });
} else {
  console.log('No entries found for today');
}

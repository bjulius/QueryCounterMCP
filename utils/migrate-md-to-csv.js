import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the MD file
const mdPath = path.join(__dirname, 'QueryTrackMCP.md');
const csvPath = path.join(__dirname, 'QueryTrackMCP.csv');

const mdContent = fs.readFileSync(mdPath, 'utf-8');

// Parse MD entries
const entries = [];
const sections = mdContent.split('---').filter(s => s.trim());

sections.forEach(section => {
  if (section.includes('## ')) {
    const lines = section.trim().split('\n');
    let date = '';
    let model = '';
    let category = '';
    let query = '';
    let notes = '';
    let timestamp = '';

    lines.forEach(line => {
      if (line.startsWith('## ')) {
        date = line.replace('## ', '').trim();
      } else if (line.includes('**Model**:')) {
        model = line.split('**Model**:')[1].trim();
      } else if (line.includes('**Category**:')) {
        category = line.split('**Category**:')[1].trim();
      } else if (line.includes('**Query**:')) {
        query = line.split('**Query**:')[1].trim();
      } else if (line.includes('**Notes**:')) {
        notes = line.split('**Notes**:')[1].trim();
      } else if (line.includes('**Timestamp**:')) {
        timestamp = line.split('**Timestamp**:')[1].trim();
      }
    });

    if (timestamp && model && query) {
      entries.push({
        timestamp,
        date,
        model,
        category: category || 'general',
        query_summary: query,
        notes
      });
    }
  }
});

// Filter entries that are newer than the last CSV entry
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const csvLines = csvContent.trim().split('\n');
const lastCsvLine = csvLines[csvLines.length - 1];
const lastCsvTimestamp = lastCsvLine.split(',')[0];
const lastCsvDate = new Date(lastCsvTimestamp);

const newEntries = entries.filter(e => new Date(e.timestamp) > lastCsvDate);

console.log(`Found ${newEntries.length} new entries to migrate from MD to CSV`);

// Helper to escape CSV fields
function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Append new entries to CSV
if (newEntries.length > 0) {
  const newRows = newEntries.map(e => {
    return [
      e.timestamp,
      escapeCsvField(e.date),
      escapeCsvField(e.model),
      escapeCsvField(e.category),
      escapeCsvField(e.query_summary),
      escapeCsvField(e.notes)
    ].join(',');
  }).join('\n');

  fs.appendFileSync(csvPath, '\n' + newRows, 'utf-8');
  console.log(`Successfully migrated ${newEntries.length} entries to CSV`);

  // Show the migrated entries
  console.log('\nMigrated entries:');
  newEntries.forEach(e => {
    console.log(`  - ${e.date}: ${e.query_summary}`);
  });
}

// Fix the .mcp.json configuration
const mcpPath = path.join(__dirname, '.mcp.json');
const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));

// Remove the duplicate "query-counter" configuration
if (mcpConfig.mcpServers['query-counter']) {
  delete mcpConfig.mcpServers['query-counter'];
  fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
  console.log('\n✓ Removed duplicate "query-counter" configuration from .mcp.json');
}

console.log('\n✓ Migration complete! Your queries should now log to CSV format.');
console.log('Note: You may need to restart Claude Code for the configuration changes to take effect.');
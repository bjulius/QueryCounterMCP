import { readFileSync, writeFileSync } from 'fs';

function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

const mdContent = readFileSync('QueryTrackMCP.md', 'utf-8');

// Parse the markdown format
const entries = [];
const sections = mdContent.split('---').slice(1); // Skip header

for (const section of sections) {
  const lines = section.trim().split('\n');
  const entry = {};

  for (const line of lines) {
    if (line.startsWith('## ')) {
      entry.date = line.replace('## ', '').trim();
    } else if (line.includes('**Model**:')) {
      entry.model = line.split('**Model**:')[1].trim();
    } else if (line.includes('**Category**:')) {
      entry.category = line.split('**Category**:')[1].trim();
    } else if (line.includes('**Query**:')) {
      entry.query_summary = line.split('**Query**:')[1].trim();
    } else if (line.includes('**Notes**:')) {
      entry.notes = line.split('**Notes**:')[1].trim();
    } else if (line.includes('**Timestamp**:')) {
      entry.timestamp = line.split('**Timestamp**:')[1].trim();
    }
  }

  if (entry.timestamp) {
    entries.push({
      timestamp: entry.timestamp,
      date: entry.date || '',
      model: entry.model || '',
      category: entry.category || '',
      query_summary: entry.query_summary || '',
      notes: entry.notes || ''
    });
  }
}

// Write to CSV
const csvLines = ['timestamp,date,model,category,query_summary,notes'];

for (const entry of entries) {
  const line = [
    entry.timestamp,
    escapeCsvField(entry.date),
    entry.model,
    entry.category,
    escapeCsvField(entry.query_summary),
    escapeCsvField(entry.notes)
  ].join(',');

  csvLines.push(line);
}

writeFileSync('QueryTrackMCP.csv', csvLines.join('\n') + '\n', 'utf-8');

console.log(`Converted ${entries.length} entries from Markdown to CSV`);
console.log('QueryTrackMCP.csv has been updated with all historical data');

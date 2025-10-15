import { readFileSync, writeFileSync } from 'fs';

// Read the current CSV
const content = readFileSync('QueryTrackMCP.csv', 'utf-8');
const lines = content.split('\n');

// Helper function to escape CSV fields
function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Keep the header
const fixedLines = [lines[0]];

// Fix each data line
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Parse the broken CSV: the date field has an unquoted comma
  // Format: timestamp,date_part1, date_part2,model,category,query_summary,notes
  // We need to find the timestamp (ends with Z), then everything until the next field that looks like a model

  const parts = line.split(',');
  if (parts.length < 6) continue; // Skip invalid lines

  // timestamp is always field 0
  const timestamp = parts[0];

  // The date is split across fields 1 and 2 due to the comma
  const datePart1 = parts[1];
  const datePart2 = parts[2];
  const formattedDate = `${datePart1},${datePart2}`;

  // model starts at field 3
  const model = parts[3];

  // category at field 4
  const category = parts[4];

  // query_summary at field 5
  const querySummary = parts[5];

  // notes is everything remaining (might contain commas)
  const notes = parts.slice(6).join(',');

  // Rebuild the line with proper escaping
  const fixedLine = [
    timestamp,
    escapeCsvField(formattedDate),
    escapeCsvField(model),
    escapeCsvField(category),
    escapeCsvField(querySummary),
    escapeCsvField(notes)
  ].join(',');

  fixedLines.push(fixedLine);
}

// Write the fixed CSV
const fixedContent = fixedLines.join('\n') + '\n';
writeFileSync('QueryTrackMCP.csv', fixedContent, 'utf-8');

console.log(`Fixed ${fixedLines.length - 1} records in QueryTrackMCP.csv`);

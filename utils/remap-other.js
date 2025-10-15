import { readFileSync, writeFileSync } from 'fs';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function recategorizeOther(querySummary) {
  const query = querySummary.toLowerCase().trim();

  // Navigation/command patterns
  if (query === '/init' || query === 'exitr' || query === 'dir') {
    return 'navigation';
  }

  // Debugging patterns
  if (query.includes('still getting') || query.includes('expected expression') ||
      query === 'fix problems') {
    return 'debugging';
  }

  // Refactoring patterns
  if (query.includes('redo in') || query.includes('shorten step names') ||
      query === 'remove it') {
    return 'refactoring';
  }

  // Clarification patterns
  if (query.includes('tell me which version') ||
      query.includes('can we break') ||
      query.includes('should i keep')) {
    return 'clarification';
  }

  // Keep as other
  return 'other';
}

const csvPath = 'QueryTrackMCP.csv';
const content = readFileSync(csvPath, 'utf-8');
const lines = content.trim().split('\n');

if (lines.length <= 1) {
  console.log('No data to process');
  process.exit(0);
}

const header = lines[0];
const updatedLines = [header];
let remappedCount = 0;

for (let i = 1; i < lines.length; i++) {
  const fields = parseCsvLine(lines[i]);

  if (fields.length >= 6) {
    const category = fields[3].toLowerCase();

    // Only remap "other" category
    if (category === 'other') {
      const querySummary = fields[4];
      const newCategory = recategorizeOther(querySummary);

      if (newCategory !== 'other') {
        fields[3] = newCategory;
        remappedCount++;
        console.log(`Remapped: "${querySummary}" -> ${newCategory}`);
      }
    }

    // Reconstruct the line
    const newLine = fields.map(escapeCsvField).join(',');
    updatedLines.push(newLine);
  } else {
    updatedLines.push(lines[i]);
  }
}

// Write back to file
writeFileSync(csvPath, updatedLines.join('\n') + '\n', 'utf-8');
console.log(`\nRemapped ${remappedCount} entries from "other" to specific categories`);

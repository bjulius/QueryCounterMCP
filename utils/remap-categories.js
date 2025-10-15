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

function categorizeQuery(querySummary) {
  const query = querySummary.toLowerCase().trim();

  // Selection patterns (short responses, option picking)
  if (/^(y|n|yes|no|\d+|option\s*\d+)$/i.test(query)) {
    return 'selection';
  }

  // Navigation patterns (viewing, opening, showing files/UI)
  if (/^(view|show|open|display|cat|ls|cd|pwd)/i.test(query)) {
    return 'navigation';
  }

  // Clarification patterns (questions, follow-ups)
  if (query.includes('will it') || query.includes('can it') || query.includes('does it') ||
      query.includes('how') || query.includes('why') || query.includes('what') ||
      query.includes('?')) {
    return 'clarification';
  }

  // Conversation patterns (greetings, feedback, casual chat)
  if (query.includes('good') || query.includes('thanks') || query.includes('hello') ||
      query.includes('hi ') || query.startsWith('hi')) {
    return 'conversation';
  }

  // Unknown/unclear queries
  if (query.includes('unknown') || query.trim() === '') {
    return 'other';
  }

  // Default: keep as other
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

    // Only remap "general" category
    if (category === 'general') {
      const querySummary = fields[4];
      const newCategory = categorizeQuery(querySummary);
      fields[3] = newCategory;
      remappedCount++;
      console.log(`Remapped: "${querySummary}" -> ${newCategory}`);
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
console.log(`\nRemapped ${remappedCount} entries from "general" to specific categories`);

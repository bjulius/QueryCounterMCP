# Utility Scripts

This directory contains various utility scripts used for data migration and testing during development.

## Scripts

- **migrate-md-to-csv.js** - Migrates query logs from Markdown format to CSV format
- **convert-md-to-csv.js** - Converts existing Markdown logs to CSV
- **convert-to-csv.js** - General conversion utility for CSV format
- **fix-csv.js** - Fixes any CSV formatting issues
- **migrate-today.js** - Migrates today's queries specifically
- **remap-categories.js** - Remaps query categories to standardized values
- **remap-other.js** - Remaps queries marked as "other" to more specific categories
- **test-dashboard.js** - Test script for dashboard generation functionality

## Usage

These scripts are primarily for development and migration purposes. They are not part of the main MCP server functionality.

```bash
# Example: Migrate from Markdown to CSV
node utils/migrate-md-to-csv.js

# Example: Test dashboard generation
node utils/test-dashboard.js
```

## Note

These scripts may modify your query log files. Always backup your data before running migration scripts.
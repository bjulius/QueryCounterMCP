# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Query Counter MCP is an MCP (Model Context Protocol) server that logs all LLM queries to a local file for tracking and analysis. By default, it logs to CSV format (`QueryTrackMCP.csv`) for easy data analysis, but can also output to Markdown. It tracks timestamp, date, model, category, query summary, and optional notes for each query.

## Architecture

The project follows a simple MCP server pattern:

- **src/index.ts**: Main MCP server implementation using the `@modelcontextprotocol/sdk`
  - Exposes a single tool: `log_query`
  - Handles stdio transport for communication with MCP clients
  - Supports both CSV and Markdown logging formats
  - Implements structured file logging (configurable via environment variables)

The server runs as a stdio-based MCP server that can be integrated with any MCP-compatible client (Claude Desktop, VS Code extensions, etc.).

## Build and Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Build and watch for changes
npm run watch

# Build and run the server
npm run dev
```

## Testing the Server

Since this is an MCP server, it communicates via stdio. Test it by:

1. Building the project: `npm run build`
2. Configuring it in an MCP client's settings (e.g., Claude Desktop)
3. Using the `log_query` tool from within the client

## Configuration

### Log Format
- **Default**: CSV format for easy data analysis
- **Change format**: Set `QUERY_LOG_FORMAT` environment variable to `"csv"` or `"md"`
  - CSV: Structured data, easy to import into Excel/Pandas/etc.
  - Markdown: Human-readable, formatted documentation

### Log File Path
- **Default**: `QueryTrackMCP.csv` (or `.md` if using markdown format) in the current working directory
- **Custom path**: Set `QUERY_LOG_PATH` environment variable to specify a different location

### Example Configuration
```bash
# Use Markdown format instead of CSV
export QUERY_LOG_FORMAT="md"

# Custom log location
export QUERY_LOG_PATH="/path/to/custom/query-log.csv"
```

## Tool Schema

**log_query** - Logs a query to the tracking file
- `model` (required): The LLM model name (e.g., "Claude", "ChatGPT", "Gemini")
- `query_summary` (required): Brief summary of the query
- `category` (optional): Query category - see Category Guidelines below
- `notes` (optional): Additional notes about the query

**show_dashboard** - Generate and display an interactive HTML analytics dashboard
- No parameters required
- Reads data from QueryTrackMCP.csv
- Displays KPI cards: Total Queries Today, Average Queries Per Day, Total Categories
- Shows charts: Categories by Percent, Models by Percent, Queries by Day
- Automatically opens the dashboard in your default browser

## Category Guidelines

The category field helps organize and analyze your LLM queries. Use these specific categories for better tracking:

### Development & Code
- **coding** - Writing, debugging, or explaining code
- **refactoring** - Code improvements, restructuring, optimization
- **testing** - Writing or running tests, test analysis
- **debugging** - Troubleshooting errors, investigating issues

### Analysis & Research
- **data-analysis** - Analyzing data, creating visualizations, statistics
- **research** - Looking up information, documentation searches, learning

### Project Management
- **documentation** - Writing/updating docs, README files, comments
- **configuration** - Settings, setup, tool configuration, environment setup

### Interaction
- **clarification** - Follow-up questions, asking for more details
- **selection** - Short confirmations, choosing options (e.g., "y", "2", "option 2")
- **navigation** - UI commands, viewing files, moving around the codebase
- **conversation** - General chat, greetings, feedback, casual interaction

### Catchall
- **other** - Anything that doesn't fit the above categories (use sparingly)

### Tips for Categorization
- Be specific: prefer "debugging" over "coding" when troubleshooting
- Use "selection" for one-word responses to prompts like "y", "2", "option 2"
- Use "navigation" for commands like viewing files or moving between sections
- Use "clarification" for follow-up questions
- Use "conversation" for greetings, feedback, general chat
- **Avoid using "other"** - only use when no other category fits
- Never use "general" - it's too vague and should be replaced with a specific category

## CSV Format

When using CSV format (default), the log file contains:
```csv
timestamp,date,model,category,query_summary,notes
2025-10-11T18:20:37.516Z,10/11/2025 2:20:37 PM,Claude Sonnet 4.5,coding,implement CSV logging,Auto-logged
```

This format is optimized for:
- Importing into spreadsheet applications (Excel, Google Sheets)
- Data analysis with Python (pandas), R, or other tools
- Generating reports and visualizations
- Querying and filtering data efficiently

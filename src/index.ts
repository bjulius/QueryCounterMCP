#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration: Format and log file location
const LOG_FORMAT = process.env.QUERY_LOG_FORMAT || "csv"; // "csv" or "md"
const DEFAULT_EXTENSION = LOG_FORMAT === "csv" ? ".csv" : ".md";
const DEFAULT_FILENAME = `QueryTrackMCP${DEFAULT_EXTENSION}`;
const LOG_FILE_PATH = process.env.QUERY_LOG_PATH || path.join(process.cwd(), DEFAULT_FILENAME);

interface LogQueryArgs {
  model: string;
  query_summary: string;
  notes?: string;
  category?: string;
}

// Helper function to escape CSV fields
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

async function logQuery(model: string, querySummary: string, notes?: string, category?: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const formattedDate = new Date().toLocaleString();

  try {
    // Check if file exists
    let fileExists = false;
    try {
      await fs.access(LOG_FILE_PATH);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    if (LOG_FORMAT === "csv") {
      // CSV format
      if (!fileExists) {
        const header = "timestamp,date,model,category,query_summary\n";
        await fs.writeFile(LOG_FILE_PATH, header, "utf-8");
      }

      const row = [
        timestamp,
        escapeCsvField(formattedDate),
        escapeCsvField(model),
        escapeCsvField(category || ""),
        escapeCsvField(querySummary)
      ].join(',') + '\n';

      await fs.appendFile(LOG_FILE_PATH, row, "utf-8");
    } else {
      // Markdown format (original)
      if (!fileExists) {
        const header = `# LLM Query Log

This file tracks all queries made to various LLM models.

---
`;
        await fs.writeFile(LOG_FILE_PATH, header, "utf-8");
      }

      const logEntry = `
## ${formattedDate}

- **Model**: ${model}
${category ? `- **Category**: ${category}` : ""}
- **Query**: ${querySummary}
${notes ? `- **Notes**: ${notes}` : ""}
- **Timestamp**: ${timestamp}

---
`;
      await fs.appendFile(LOG_FILE_PATH, logEntry, "utf-8");
    }
  } catch (error) {
    throw new Error(`Failed to write to log file: ${error}`);
  }
}

interface QueryRecord {
  timestamp: string;
  date: string;
  model: string;
  category: string;
  query_summary: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
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

async function parseCsvData(): Promise<QueryRecord[]> {
  const csvPath = path.join(process.cwd(), 'QueryTrackMCP.csv');

  try {
    const content = await fs.readFile(csvPath, 'utf-8');
    const lines = content.trim().split('\n');

    if (lines.length <= 1) {
      return [];
    }

    const records: QueryRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      if (fields.length >= 5) {
        records.push({
          timestamp: fields[0],
          date: fields[1],
          model: fields[2],
          category: fields[3],
          query_summary: fields[4]
        });
      }
    }

    return records;
  } catch (error) {
    throw new Error(`Failed to read CSV file: ${error}`);
  }
}

async function generateDashboard(): Promise<string> {
  const records = await parseCsvData();

  if (records.length === 0) {
    throw new Error('No query data available to display');
  }

  // Calculate metrics - use the most recent date in the data
  const allDates = records.map(r => new Date(r.timestamp));
  const mostRecentDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const mostRecentDateString = mostRecentDate.toDateString();
  const todayQueries = records.filter(r => new Date(r.timestamp).toDateString() === mostRecentDateString).length;

  // Get unique dates and calculate average
  const dateSet = new Set(records.map(r => new Date(r.timestamp).toDateString()));
  const totalDays = dateSet.size;
  const avgQueriesPerDay = (records.length / totalDays).toFixed(1);

  // Get unique categories
  const categories = new Set(records.map(r => r.category).filter(c => c.length > 0));
  const totalCategories = categories.size;

  // Category distribution
  const categoryCount: Record<string, number> = {};
  records.forEach(r => {
    if (r.category) {
      categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
    }
  });

  const categorySorted = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({
      category: cat,
      count,
      percent: ((count / records.length) * 100).toFixed(1)
    }));

  // Model distribution
  const modelCount: Record<string, number> = {};
  records.forEach(r => {
    if (r.model) {
      modelCount[r.model] = (modelCount[r.model] || 0) + 1;
    }
  });

  const modelSorted = Object.entries(modelCount)
    .sort((a, b) => b[1] - a[1])
    .map(([model, count]) => ({
      model,
      count,
      percent: ((count / records.length) * 100).toFixed(1)
    }));

  // Queries by day
  const queryByDay: Record<string, number> = {};
  records.forEach(r => {
    const date = new Date(r.timestamp).toLocaleDateString();
    queryByDay[date] = (queryByDay[date] || 0) + 1;
  });

  const queryByDaySorted = Object.entries(queryByDay)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, count]) => ({ date, count }));

  // Calculate max queries in a day
  const maxQueriesInDay = Math.max(...Object.values(queryByDay));

  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Query Analytics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f8f9fa;
      padding: 2rem;
      color: #2c3e50;
    }

    .dashboard {
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #2c3e50;
      font-weight: 600;
    }

    .subtitle {
      font-size: 1.25rem;
      color: #657786;
      font-weight: 400;
      margin-bottom: 2rem;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .kpi-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid #e1e8ed;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .kpi-card.highlighted {
      border: 2px solid #4a90e2;
      box-shadow: 0 2px 8px rgba(74, 144, 226, 0.15);
    }

    .kpi-label {
      font-size: 0.875rem;
      color: #657786;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .kpi-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #4a5f7f;
    }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .chart-container {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid #e1e8ed;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .chart-container.full-width {
      grid-column: 1 / -1;
    }

    .chart-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .chart-subtitle {
      font-size: 0.875rem;
      color: #657786;
      margin-bottom: 1rem;
    }

    canvas {
      max-height: 400px;
    }
  </style>
</head>
<body>
  <div class="dashboard">
    <h1>Query Analytics Dashboard</h1>
    <div class="subtitle">Brian Julius</div>

    <div class="kpi-grid">
      <div class="kpi-card highlighted">
        <div class="kpi-label">Total Queries Today</div>
        <div class="kpi-value">${todayQueries}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Average Queries Per Day</div>
        <div class="kpi-value">${avgQueriesPerDay}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Number of Categories</div>
        <div class="kpi-value">${totalCategories}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Max Queries in a Day</div>
        <div class="kpi-value">${maxQueriesInDay}</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="chart-container">
        <div class="chart-title">Categories by Percent</div>
        <div class="chart-subtitle">Distribution of query categories</div>
        <canvas id="categoryChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">Models by Percent</div>
        <div class="chart-subtitle">Distribution of AI models used</div>
        <canvas id="modelChart"></canvas>
      </div>

      <div class="chart-container full-width">
        <div class="chart-title">Total Queries by Day</div>
        <div class="chart-subtitle">Query volume over time</div>
        <canvas id="dailyChart"></canvas>
      </div>
    </div>
  </div>

  <script>
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
    Chart.defaults.color = '#657786';

    // Category Chart
    new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(categorySorted.map(c => c.category))},
        datasets: [{
          label: 'Percentage',
          data: ${JSON.stringify(categorySorted.map(c => parseFloat(c.percent)))},
          backgroundColor: '#5a7a9f',
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.x.toFixed(1) + '%';
              }
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            offset: 4,
            color: '#2c3e50',
            font: {
              weight: 'bold',
              size: 12
            },
            formatter: function(value) {
              return Math.round(value) + '%';
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            },
            grid: {
              color: '#e1e8ed'
            }
          },
          y: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    // Model Chart
    new Chart(document.getElementById('modelChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(modelSorted.map(m => m.model))},
        datasets: [{
          label: 'Percentage',
          data: ${JSON.stringify(modelSorted.map(m => parseFloat(m.percent)))},
          backgroundColor: '#7591b3',
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.x.toFixed(1) + '%';
              }
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            offset: 4,
            color: '#2c3e50',
            font: {
              weight: 'bold',
              size: 12
            },
            formatter: function(value) {
              return Math.round(value) + '%';
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            },
            grid: {
              color: '#e1e8ed'
            }
          },
          y: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    // Daily Queries Chart
    new Chart(document.getElementById('dailyChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(queryByDaySorted.map(d => d.date))},
        datasets: [{
          label: 'Queries',
          data: ${JSON.stringify(queryByDaySorted.map(d => d.count))},
          backgroundColor: '#5a7a9f',
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            offset: 4,
            color: '#2c3e50',
            font: {
              weight: 'bold',
              size: 12
            },
            formatter: function(value) {
              return Math.round(value);
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            grid: {
              color: '#e1e8ed'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;

  // Write HTML to file
  const dashboardPath = path.join(process.cwd(), 'query-dashboard.html');
  await fs.writeFile(dashboardPath, html, 'utf-8');

  // Open in browser (Windows)
  try {
    await execAsync(`start ${dashboardPath}`);
  } catch (error) {
    // If start fails, just return the path
  }

  return dashboardPath;
}

const server = new Server(
  {
    name: "query-counter-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "log_query",
        description: "Log an LLM query to the query tracking file with timestamp, model, category, and notes",
        inputSchema: {
          type: "object",
          properties: {
            model: {
              type: "string",
              description: "The LLM model being queried (e.g., 'Claude', 'ChatGPT', 'Gemini')",
            },
            query_summary: {
              type: "string",
              description: "A brief summary of what you're asking the model",
            },
            category: {
              type: "string",
              description: "Optional category for the query. Use specific categories: 'coding', 'refactoring', 'testing', 'debugging', 'data-analysis', 'research', 'documentation', 'configuration', 'clarification', 'selection', 'navigation', 'conversation'",
            },
            notes: {
              type: "string",
              description: "Optional additional notes about the query",
            },
          },
          required: ["model", "query_summary"],
        },
      },
      {
        name: "show_dashboard",
        description: "Generate and display an HTML dashboard with analytics from QueryTrackMCP.csv including KPI cards (Total Queries Today, Average Queries Per Day, Total Categories) and charts (Categories by Percent, Models by Percent, Queries by Day)",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "log_query") {
    const args = request.params.arguments as LogQueryArgs;

    if (!args.model || !args.query_summary) {
      throw new Error("Missing required arguments: model and query_summary");
    }

    await logQuery(args.model, args.query_summary, args.notes, args.category);

    return {
      content: [
        {
          type: "text",
          text: `Query logged successfully to ${LOG_FILE_PATH}`,
        },
      ],
    };
  }

  if (request.params.name === "show_dashboard") {
    try {
      const dashboardPath = await generateDashboard();
      return {
        content: [
          {
            type: "text",
            text: `Dashboard generated and opened successfully at: ${dashboardPath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to generate dashboard: ${error}`);
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Query Counter MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';

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

function parseCsvData() {
  const csvPath = 'QueryTrackMCP.csv';
  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length <= 1) {
    return [];
  }

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length >= 6) {
      records.push({
        timestamp: fields[0],
        date: fields[1],
        model: fields[2],
        category: fields[3],
        query_summary: fields[4],
        notes: fields[5]
      });
    }
  }

  return records;
}

const records = parseCsvData();

if (records.length === 0) {
  console.error('No query data available to display');
  process.exit(1);
}

// Calculate metrics - use the most recent date in the data
const allDates = records.map(r => new Date(r.timestamp));
const mostRecentDate = new Date(Math.max(...allDates));
const mostRecentDateString = mostRecentDate.toDateString();
const todayQueries = records.filter(r => new Date(r.timestamp).toDateString() === mostRecentDateString).length;

const dateSet = new Set(records.map(r => new Date(r.timestamp).toDateString()));
const totalDays = dateSet.size;
const avgQueriesPerDay = (records.length / totalDays).toFixed(1);

const categories = new Set(records.map(r => r.category).filter(c => c.length > 0));
const totalCategories = categories.size;

// Category distribution
const categoryCount = {};
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
const modelCount = {};
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
const queryByDay = {};
records.forEach(r => {
  const date = new Date(r.timestamp).toLocaleDateString();
  queryByDay[date] = (queryByDay[date] || 0) + 1;
});

const queryByDaySorted = Object.entries(queryByDay)
  .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
  .map(([date, count]) => ({ date, count }));

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
      margin-bottom: 2rem;
      color: #2c3e50;
      font-weight: 600;
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
    const categoryCounts = ${JSON.stringify(categorySorted.map(c => c.count))};
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
                return context.parsed.x.toFixed(1) + '% (' + categoryCounts[context.dataIndex] + ' queries)';
              }
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'left',
            offset: -4,
            color: '#ffffff',
            font: {
              weight: 'bold',
              size: 12
            },
            formatter: function(value, context) {
              return categoryCounts[context.dataIndex];
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
    const modelCounts = ${JSON.stringify(modelSorted.map(m => m.count))};
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
                return context.parsed.x.toFixed(1) + '% (' + modelCounts[context.dataIndex] + ' queries)';
              }
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'left',
            offset: -4,
            color: '#ffffff',
            font: {
              weight: 'bold',
              size: 12
            },
            formatter: function(value, context) {
              return modelCounts[context.dataIndex];
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
            align: 'bottom',
            offset: -4,
            color: '#ffffff',
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
const dashboardPath = join(process.cwd(), 'query-dashboard.html');
writeFileSync(dashboardPath, html, 'utf-8');

console.log(`Dashboard generated at: ${dashboardPath}`);

// Open in browser (Windows)
exec(`start ${dashboardPath}`);

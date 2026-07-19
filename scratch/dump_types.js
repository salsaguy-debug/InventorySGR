const https = require('https');

function fetchCsv(url) {
  if (!url) {
    url = "https://docs.google.com/spreadsheets/d/1IPZznR7kK-oCoThEHmACgMOW6KJfP8NSwzGKv3q-ITY/export?format=csv";
  }
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchCsv(res.headers.location));
      } else if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch CSV: Status code ${res.statusCode}`));
      } else {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      }
    }).on('error', (err) => reject(err));
  });
}

function parseCsv(csvText) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let cell = '';
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i+1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(cell);
      lines.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    lines.push(row);
  }
  return lines;
}

async function run() {
  try {
    const csvText = await fetchCsv();
    const rows = parseCsv(csvText);
    const headers = rows[0].map(h => h.toString().toLowerCase().trim());
    console.log("Headers:", headers);
    const typeCol = headers.indexOf("type");
    if (typeCol === -1) {
      console.log("Type column not found!");
      return;
    }
    
    const types = rows.slice(1).map(r => r[typeCol]).filter(Boolean);
    const uniqueTypes = [...new Set(types)];
    console.log("Unique Types in Sheet:", uniqueTypes);
    
    // Print first 5 rows with Danza or Instruments
    console.log("Sample rows containing Danza or Instruments:");
    rows.slice(1).forEach((r, idx) => {
      const typeVal = r[typeCol];
      if (typeVal === "Danza" || typeVal === "Instruments") {
        console.log(`Row ${idx + 2}:`, r);
      }
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

run();

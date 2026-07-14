const fs = require('fs');
const path = require('path');
const https = require('https');

// Helper to fetch CSV data from spreadsheet (following redirects)
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

// Parse CSV manually
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
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // skip \n
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

// Emulate backend logic in Code.gs
function getPerformerInventory(email, csvRows) {
  if (!email) return [];
  const headers = csvRows[0].map(h => h.toString().toLowerCase().trim());
  console.log("Headers found:", headers);
  const idCol = headers.indexOf("id");
  const descCol = headers.indexOf("item description");
  const assignedCol = headers.indexOf("assigned");
  const picsCol = headers.indexOf("pics");
  const picCol = headers.indexOf("pic");
  const costCol = headers.indexOf("replacement cost");
  const statusCol = headers.indexOf("status");
  const performerNotesCol = headers.indexOf("performer notes") !== -1 ? headers.indexOf("performer notes") : headers.length; // mock notes at the end

  const items = [];
  for (let i = 1; i < csvRows.length; i++) {
    const row = csvRows[i];
    if (row.length <= assignedCol) continue;
    const rowEmail = row[assignedCol].toString().trim().toLowerCase();
    if (rowEmail === email) {
      const itemId = idCol !== -1 ? row[idCol].toString().trim() : "N/A";
      const itemDesc = descCol !== -1 ? row[descCol].toString().trim() : "Unlabeled Costume/Prop";
      let rawPic = "";
      if (picsCol !== -1 && row[picsCol]) rawPic = row[picsCol].toString().trim();
      else if (picCol !== -1 && row[picCol]) rawPic = row[picCol].toString().trim();
      const replacementCost = costCol !== -1 ? row[costCol].toString().trim() : "N/A";
      const currentStatus = statusCol !== -1 ? row[statusCol].toString().trim() : "-";
      const notes = performerNotesCol !== -1 && row.length > performerNotesCol ? row[performerNotesCol].toString().trim() : "";

      items.push({
        rowIndex: i + 1,
        id: itemId,
        description: itemDesc,
        picUrl: rawPic,
        cost: replacementCost,
        status: currentStatus || "-",
        notes: notes
      });
    }
  }
  return items;
}

async function runDryRun() {
  console.log("Fetching live spreadsheet data for dry run...");
  let csvRows;
  try {
    const csvText = await fetchCsv();
    csvRows = parseCsv(csvText);
    if (!csvRows || csvRows.length === 0 || !csvRows[0].map(h => h.toString().toLowerCase().trim()).includes("assigned")) {
      throw new Error("Invalid spreadsheet CSV format returned.");
    }
    console.log(`Parsed ${csvRows.length} rows from spreadsheet.`);
  } catch (err) {
    console.warn("⚠️ Warning: Fetching live spreadsheet failed or returned invalid format. Using mock CSV data for dry run...", err.message);
    csvRows = [
      ["ID", "Item Description", "Pics", "Replacement Cost", "Status", "Assigned", "Type", "Performer Notes"],
      ["1", "Bomba Skirt - Red/White Flower Pattern", "https://example.com/bomba.jpg", "75", "Yes. I got it", "ednatradicion@gmail.com", "Bomba", "Practice notes"],
      ["2", "Plena Panderos Set (3 drums)", "", "150", "Yes. I got it", "ednatradicion@gmail.com", "Plena", ""],
      ["3", "Spanish Hand Fan - Large Black Lace", "", "20", "-", "ednatradicion@gmail.com", "Props", ""]
    ];
  }

  try {
    // Test with a registered email to verify evaluation with actual data
    const testEmail = "ednatradicion@gmail.com"; 
    console.log(`Running dry run for email: ${testEmail}`);

    const items = getPerformerInventory(testEmail, csvRows);
    const performerName = "Edna";
    const errorMsg = "";
    const webAppUrl = "https://script.google.com/macros/s/AKfycb-DRYRUN/exec";

    console.log(`Performer inventory items found: ${items.length}`);

    const htmlPath = path.join(__dirname, 'Index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Compile Index.html template
    let code = "let output = '';\n";
    let pos = 0;
    const regex = /<(?:\?=|\?!=|\?)([\s\S]*?)\?>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const textBefore = html.substring(pos, match.index);
      code += `output += ${JSON.stringify(textBefore)};\n`;

      const scriptletContent = match[1].trim();
      const tagType = html.substring(match.index, match.index + 4);

      if (tagType.startsWith('<?!=')) {
        code += `output += (${scriptletContent});\n`;
      } else if (tagType.startsWith('<?=')) {
        code += `output += (${scriptletContent});\n`;
      } else {
        code += `${scriptletContent}\n`;
      }
      pos = regex.lastIndex;
    }
    code += `output += ${JSON.stringify(html.substring(pos))};\n`;
    code += "return output;\n";

    const compileFn = new Function('email', 'items', 'performerName', 'errorMsg', 'webAppUrl', 'performersList', code);
    console.log("✅ Dry Run: Template compilation passed!");
    const result = compileFn(testEmail, items, performerName, errorMsg, webAppUrl, []);
    console.log("✅ Dry Run: Template execution passed!");
    
    // Write output to verification file
    const outputPath = path.join(__dirname, 'dry_run_output.html');
    fs.writeFileSync(outputPath, result, 'utf8');
    console.log(`✅ Dry Run: Rendered output saved to ${outputPath}`);
  } catch (err) {
    console.error("❌ Dry Run Failed: Compilation/Execution Error:");
    console.error(err);
  }
}

runDryRun();

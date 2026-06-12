const fs = require('fs');
const path = require('path');

function validateApp() {
  console.log("Starting code validation checks...");
  
  const codeGsPath = path.join(__dirname, 'Code.gs');
  const indexHtmlPath = path.join(__dirname, 'index.html');
  
  // 1. Verify files exist
  if (!fs.existsSync(codeGsPath)) {
    console.error("❌ Error: Code.gs does not exist.");
    process.exit(1);
  }
  console.log("✅ Code.gs file exists.");
  
  if (!fs.existsSync(indexHtmlPath)) {
    console.error("❌ Error: index.html does not exist.");
    process.exit(1);
  }
  console.log("✅ index.html file exists.");
  
  // 2. Read contents
  const codeGs = fs.readFileSync(codeGsPath, 'utf8');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // 3. Verify dropdown options in index.html
  const requiredOptions = [
    "-",
    "Yes. I got it",
    "I returned it",
    "I never received it.",
    "I lost it and need to replace it",
    "I loaned it to another performer (See Notes)",
    "I damaged it and need to replace it",
    "I cannot read the label ID.",
    "Yes I have one with a diferent number. See \"PERFORMER NOTES\" NOTES",
    "Yes, I have the item with a different number. (See Performer Notes)"
  ];
  
  console.log("Checking required dropdown options in index.html select tag...");
  let allOptionsFound = true;
  for (const option of requiredOptions) {
    // Escape special regex characters and normalize quotes for HTML
    let escaped = option.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    escaped = escaped.replace(/"/g, '(?:&quot;|")');
    const regex = new RegExp(`option\\s+value="${escaped}"`, 'i');
    
    if (regex.test(indexHtml)) {
      console.log(`  ✅ Found option: "${option}"`);
    } else {
      console.error(`  ❌ Missing option: "${option}"`);
      allOptionsFound = false;
    }
  }
  
  if (!allOptionsFound) {
    console.error("❌ Validation failed: One or more required dropdown options are missing.");
    process.exit(1);
  }
  console.log("✅ All required dropdown options are correctly defined in index.html.");
  
  // 4. Verify spreadsheet connection
  const sheetIdMatch = codeGs.includes("1IPZznR7kK-oCoThEHmACgMOW6KJfP8NSwzGKv3q-ITY");
  if (sheetIdMatch) {
    console.log("✅ Authoritative Spreadsheet ID configured in Code.gs.");
  } else {
    console.error("❌ Spreadsheet ID is misconfigured or missing in Code.gs.");
    process.exit(1);
  }

  // 5. Verify basic HTML structures
  if (indexHtml.includes('<style>') && indexHtml.includes('</style>') && indexHtml.includes('<script>') && indexHtml.includes('</script>')) {
    console.log("✅ index.html includes CSS and JS blocks.");
  } else {
    console.error("❌ index.html is missing styling or scripts blocks.");
    process.exit(1);
  }

  console.log("\n🚀 All validation checks passed successfully!");
}

validateApp();

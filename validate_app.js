const fs = require('fs');
const path = require('path');

function validateApp() {
  console.log("Starting code validation checks...");
  
  const codeGsPath = path.join(__dirname, 'Code.gs');
  const indexHtmlPath = path.join(__dirname, 'Index.html');
  
  // 1. Verify files exist
  if (!fs.existsSync(codeGsPath)) {
    console.error("❌ Error: Code.gs does not exist.");
    process.exit(1);
  }
  console.log("✅ Code.gs file exists.");
  
  if (!fs.existsSync(indexHtmlPath)) {
    console.error("❌ Error: Index.html does not exist.");
    process.exit(1);
  }
  console.log("✅ Index.html file exists.");
  
  // 2. Read contents
  const codeGs = fs.readFileSync(codeGsPath, 'utf8');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // 3. Verify dropdown options in Index.html
  const requiredOptions = [
    "-",
    "Yes. I got it",
    "I returned it",
    "I never received it.",
    "I lost it and need to replace it",
    "I loaned it to another performer (See Notes)",
    "I damaged it and need to replace it",
    "I cannot read the label ID."
  ];
  
  console.log("Checking required dropdown options in Index.html select tag...");
  let allOptionsFound = true;
  for (const option of requiredOptions) {
    // Escape special regex characters
    const escaped = option.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
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
  console.log("✅ All required dropdown options are correctly defined in Index.html.");
  
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
    console.log("✅ Index.html includes CSS and JS blocks.");
  } else {
    console.error("❌ Index.html is missing styling or scripts blocks.");
    process.exit(1);
  }

  console.log("\n🚀 All validation checks passed successfully!");
}

validateApp();

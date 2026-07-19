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
  
  // 3b. Verify "Inventory Location", "Type", and "Sex" headers checking in Code.gs
  console.log("Checking header validation logic in Code.gs...");
  const hasTypeHeaderCheck = codeGs.includes('indexOf("type")') || codeGs.includes("indexOf('type')");
  const hasLocationHeaderCheck = codeGs.includes('indexOf("inventory location")') || codeGs.includes("indexOf('inventory location')");
  const hasSexHeaderCheck = codeGs.includes('indexOf("sex")') || codeGs.includes("indexOf('sex')");
  
  if (hasTypeHeaderCheck) {
    console.log("  ✅ Found 'Type' header lookup in Code.gs.");
  } else {
    console.error("  ❌ Missing 'Type' header lookup in Code.gs.");
    process.exit(1);
  }
  
  if (hasLocationHeaderCheck) {
    console.log("  ✅ Found 'Inventory Location' header lookup in Code.gs.");
  } else {
    console.error("  ❌ Missing 'Inventory Location' header lookup in Code.gs.");
    process.exit(1);
  }

  if (hasSexHeaderCheck) {
    console.log("  ✅ Found 'Sex' header lookup in Code.gs.");
  } else {
    console.error("  ❌ Missing 'Sex' header lookup in Code.gs.");
    process.exit(1);
  }

  // 3c. Verify "— (Unassigned)" and "Sex" options in index.html
  console.log("Checking default options and new Sex dropdown in index.html...");
  const hasUnassignedType = indexHtml.includes('— (Unassigned)') && indexHtml.includes('formInputType');
  const hasUnassignedLocation = indexHtml.includes('value=""') && indexHtml.includes('— (Unassigned)') && indexHtml.includes('formInputLocation');
  const hasSexDropdown = indexHtml.includes('id="formInputSex"') && indexHtml.includes('value="Girl"') && indexHtml.includes('value="Boy"') && indexHtml.includes('value="Woman"') && indexHtml.includes('value="Man"') && indexHtml.includes('value="All"');
  
  if (hasUnassignedType) {
    console.log("  ✅ Found default '— (Unassigned)' option logic for formInputType.");
  } else {
    console.error("  ❌ Missing default '— (Unassigned)' option logic for formInputType.");
    process.exit(1);
  }
  
  if (hasUnassignedLocation) {
    console.log("  ✅ Found default '— (Unassigned)' option in HTML for formInputLocation.");
  } else {
    console.error("  ❌ Missing default '— (Unassigned)' option in HTML for formInputLocation.");
    process.exit(1);
  }

  if (hasSexDropdown) {
    console.log("  ✅ Found 'Sex' dropdown with required options (All, Boy, Girl, Man, Woman) in index.html.");
  } else {
    console.error("  ❌ Missing or incorrect 'Sex' dropdown options in index.html.");
    process.exit(1);
  }

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

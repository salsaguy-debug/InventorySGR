const fs = require('fs');
const path = require('path');

function debugTemplate() {
  const htmlPath = path.join(__dirname, 'Index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  console.log("Simulating Apps Script template compilation...");

  // Mock template variables
  const email = "test@example.com";
  const items = [{ id: "1", description: "Test Item", status: "Yes. I got it", cost: "$50", notes: "" }];
  const performerName = "Test Dancer";
  const errorMsg = "";
  const webAppUrl = "https://script.google.com/macros/s/123/exec";

  // Translate template to JavaScript code
  // Apps Script translates HTML into a function that compiles strings and evaluates code blocks.
  let code = "let output = '';\n";
  let pos = 0;

  // Pattern to find scriptlets: <? ... ?>, <?= ... ?>, <?!= ... ?>
  const regex = /<(?:\?=|\?!=|\?)([\s\S]*?)\?>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    // Add text before the scriptlet as a string literal
    const textBefore = html.substring(pos, match.index);
    code += `output += ${JSON.stringify(textBefore)};\n`;

    const scriptletContent = match[1].trim();
    const tagType = html.substring(match.index, match.index + 4);

    if (tagType.startsWith('<?!=')) {
      // Unescaped print scriptlet
      code += `output += (${scriptletContent});\n`;
    } else if (tagType.startsWith('<?=')) {
      // Escaped print scriptlet
      code += `output += (${scriptletContent});\n`; // Simple simulation
    } else {
      // Standard scriptlet (code statement)
      code += `${scriptletContent}\n`;
    }

    pos = regex.lastIndex;
  }

  // Add remaining text
  const remainingText = html.substring(pos);
  code += `output += ${JSON.stringify(remainingText)};\n`;
  code += "return output;\n";

  try {
    // Attempt to compile the translated code using new Function
    const compileFn = new Function('email', 'items', 'performerName', 'errorMsg', 'webAppUrl', code);
    console.log("✅ Code compiled successfully inside Javascript compiler!");
    
    // Attempt to run the compiled code
    const result = compileFn(email, items, performerName, errorMsg, webAppUrl);
    console.log("✅ Code executed successfully without errors!");
  } catch (err) {
    console.error("❌ Compilation or Execution Error found:");
    console.error(err);
    
    // Dump compiled code around the syntax error area to inspect
    console.log("\n--- Debugging Compiled JS Code ---");
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
      // Print lines around where error might be
      if (idx < 50 || (idx > lines.length - 50)) {
        console.log(`${idx + 1}: ${line}`);
      }
    });
  }
}

debugTemplate();

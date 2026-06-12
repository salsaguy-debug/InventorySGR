/**
 * PROJECT: Tradici\u00f3n Performer Inventory Web App
 * FILE: Code.gs
 * VERSION: v2.0.0
 * AUTHOR: Angel Alberto Rodriguez Serrano
 * ORGANIZATION: Salsa Guy Richmond, LLC / Tradici\u00f3n Dance Company
 * DATE: 2026-06-11
 * 
 * CHANGE LOG (BTG):
 * - VERSION 2.0.0: Converted to REST API backend for GitHub Pages hosted frontend. Added doPost and doGet API handlers.
 * - VERSION 1.2.4: Implemented getInitialLoadData for asynchronous loading to bypass compile-time scriptlet limits.
 * - VERSION 1.2.3: Synchronized versioning for line-length safety limit fix.
 * - VERSION 1.2.2: Synchronized versioning for base64 line length parsing fixes.
 * - VERSION 1.2.1: Synchronized versioning for iframe sandboxing crash fixes.
 * - VERSION 1.2.0: Added Administrator/Director inventory viewer, performer switcher, and assignment badges.
 * - VERSION 1.1.1: Converted non-ASCII characters to safe Unicode escapes to prevent clipboard encoding corruption.
 * - VERSION 1.1.0: Co-synchronized versioning with frontend layout selector and light theme visibility fixes.
 * - INITIAL RELEASE (v1.0.0): Created Apps Script backend logic for performer inventory verification.
 * - FEATURE (Code by Header): Programmed dynamic header search using low-cased indices mapping to avoid hardcoded column indexes.
 * - FEATURE: Added doGet(e) parameter handling for both raw email parameters and secure Base64-obfuscated performer IDs.
 * - FEATURE: Created getOrCreatePerformerNotesColumn helper to dynamically auto-create and format the "Performer notes" column if missing in the sheet.
 * - FEATURE: Built a Row Collision Shift Guard in updateItemStatusAndNotes that compares target row item IDs to verify alignment, falling back to a full-sheet scan to resolve correct row coordinates.
 * - FEATURE: Created sendPerformerInventoryEmails for bulk email dispatch of secure links and dynamic sheet menu triggers.
 */

// Authoritative Spreadsheet ID
const INVENTORY_SPREADSHEET_ID = "1IPZznR7kK-oCoThEHmACgMOW6KJfP8NSwzGKv3q-ITY";

// Authorized Administrator Emails (Director and Subdirector)
const ADMIN_EMAILS = ["rodriguez2113@gmail.com", "darienl140@gmail.com"];

/**
 * Checks if a given email belongs to an administrator.
 */
function isAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.indexOf(email.trim().toLowerCase()) !== -1;
}

/**
 * Serves the Web App API or redirects web users to GitHub Pages.
 */
function doGet(e) {
  let email = "";
  let action = "";
  
  if (e && e.parameter) {
    action = e.parameter.action ? e.parameter.action.trim() : "";
    if (e.parameter.email) {
      email = e.parameter.email.trim().toLowerCase();
    } else if (e.parameter.id) {
      try {
        let rawId = e.parameter.id.trim();
        // Normalize web-safe base64 characters back to standard base64
        let standardBase64 = rawId.replace(/-/g, '+').replace(/_/g, '/');
        // Re-append standard padding if missing
        while (standardBase64.length % 4 !== 0) {
          standardBase64 += '=';
        }
        const decodedBytes = Utilities.base64Decode(standardBase64);
        email = Utilities.newBlob(decodedBytes).getDataAsString().trim().toLowerCase();
      } catch (err) {
        Logger.log("Failed to decode base64 id parameter: " + err.toString());
      }
    }
  }

  // If this is a REST API call to retrieve the data payload
  if (action === "getInitialData") {
    const data = getInitialLoadData(email);
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // If this is an admin switcher API request to load another performer's profile
  if (action === "getPerformerInventoryForAdmin") {
    let selectedEmail = e.parameter.selectedEmail ? e.parameter.selectedEmail.trim().toLowerCase() : "";
    const data = getPerformerInventoryForAdmin(email, selectedEmail);
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Otherwise, redirect to the GitHub Pages hosted frontend
  const gitHubPagesUrl = "https://salsaguy-debug.github.io/InventorySGR/";
  let queryParams = "";
  if (e && e.queryString) {
    queryParams = "?" + e.queryString;
  }
  const redirectUrl = gitHubPagesUrl + queryParams;

  return HtmlService.createHtmlOutput(
    "<!DOCTYPE html><html><head><title>Redirecting...</title></head><body>" +
    "<div style='font-family: sans-serif; text-align: center; padding: 50px;'>" +
    "<h2>Redirecting to Tradici&oacute;n Inventory Portal...</h2>" +
    "<p>If you are not redirected automatically, <a href='" + redirectUrl + "'>click here</a>.</p>" +
    "</div>" +
    "<script>window.location.href = '" + redirectUrl + "';</script>" +
    "</body></html>"
  ).setTitle("Redirecting...");
}

/**
 * Handles incoming JSON POST API requests from the GitHub Pages frontend.
 * Bypasses preflight options check by expecting a simple text/plain body.
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    if (postData.action === "updateStatus") {
      const result = updateItemStatusAndNotes(
        postData.rowIndex,
        postData.expectedId,
        postData.newStatus,
        postData.performerNotes
      );
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (postData.action === "sendEmails") {
      const summary = sendPerformerInventoryEmails();
      return ContentService.createTextOutput(JSON.stringify({ success: true, summary: summary }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (postData.action === "requestAccessLink") {
      const result = requestAccessLink(postData.email);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Standard helper to include external files (CSS/JS) inside HTML templates.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Resolves the Google Sheet instance.
 */
function getInventorySpreadsheet() {
  try {
    return SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  } catch (err) {
    // If running as container-bound, try falling back to active sheet
    const activeSS = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSS) {
      return activeSS;
    }
    throw new Error("Unable to connect to the spreadsheet. Please verify the spreadsheet ID: " + INVENTORY_SPREADSHEET_ID);
  }
}

/**
 * Attempts to retrieve a user's name from a "Profiles" sheet if it exists,
 * fallback to formatting the email.
 */
function getPerformerNameFromProfile(email) {
  try {
    const ss = getInventorySpreadsheet();
    const profilesSheet = ss.getSheetByName("Profiles") || ss.getSheetByName("Profile") || ss.getSheetByName("Sheet1") || ss.getSheetByName("Crosswalk");
    if (!profilesSheet) return "";
    
    const values = profilesSheet.getDataRange().getValues();
    if (values.length <= 1) return "";
    
    const headers = values[0].map(h => h.toString().toLowerCase().trim());
    const emailCol = headers.findIndex(h => h.includes("email") || h.includes("correo"));
    const nameCol = headers.findIndex(h => (h.includes("name") || h.includes("nombre") || h.includes("fullname") || h.includes("full name")) && 
                                          !h.includes("contact") && !h.includes("emergency"));
                                          
    if (emailCol === -1 || nameCol === -1) return "";
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][emailCol].toString().trim().toLowerCase() === email) {
        return values[i][nameCol].toString().trim();
      }
    }
  } catch (e) {
    Logger.log("Failed to resolve name from Profiles: " + e.toString());
  }
  return "";
}

/**
 * Scans the inventory sheet for all unique performer emails,
 * resolves names from Profiles sheet where possible, and returns a sorted list.
 */
function getPerformersList() {
  try {
    const ss = getInventorySpreadsheet();
    const sheet = ss.getSheetByName("Inventory") || ss.getSheets()[0];
    if (!sheet) return [];
    
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    
    const headers = values[0].map(h => h.toString().toLowerCase().trim());
    const assignedCol = headers.indexOf("assigned");
    if (assignedCol === -1) return [];
    
    const emailToName = {};
    
    // Scan profiles to map emails to names
    try {
      const profilesSheet = ss.getSheetByName("Profiles") || ss.getSheetByName("Profile") || ss.getSheetByName("Sheet1") || ss.getSheetByName("Crosswalk");
      if (profilesSheet) {
        const profileValues = profilesSheet.getDataRange().getValues();
        if (profileValues.length > 1) {
          const profileHeaders = profileValues[0].map(h => h.toString().toLowerCase().trim());
          const emailCol = profileHeaders.findIndex(h => h.includes("email") || h.includes("correo"));
          const nameCol = profileHeaders.findIndex(h => (h.includes("name") || h.includes("nombre") || h.includes("fullname") || h.includes("full name")) && 
                                                !h.includes("contact") && !h.includes("emergency"));
          if (emailCol !== -1 && nameCol !== -1) {
            for (let i = 1; i < profileValues.length; i++) {
              const email = profileValues[i][emailCol].toString().trim().toLowerCase();
              const name = profileValues[i][nameCol].toString().trim();
              if (email) {
                emailToName[email] = name;
              }
            }
          }
        }
      }
    } catch (e) {
      Logger.log("Failed to load names from Profiles in getPerformersList: " + e.toString());
    }
    
    const uniqueEmails = {};
    for (let i = 1; i < values.length; i++) {
      if (values[i].length > assignedCol) {
        const email = values[i][assignedCol].toString().trim().toLowerCase();
        if (email && email.indexOf("@") !== -1) {
          uniqueEmails[email] = true;
        }
      }
    }
    
    const list = Object.keys(uniqueEmails).map(email => {
      return {
        email: email,
        name: emailToName[email] || formatEmailToName(email)
      };
    });
    
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  } catch (err) {
    Logger.log("Error in getPerformersList: " + err.toString());
    return [];
  }
}

/**
 * Standard utility to format email handle as capitalized name.
 */
function formatEmailToName(email) {
  const parts = email.split('@')[0].split('.');
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/**
 * Retrieves all items in the inventory sheet, appending assignee emails.
 */
function getAllInventory() {
  const ss = getInventorySpreadsheet();
  const sheet = ss.getSheetByName("Inventory") || ss.getSheets()[0];
  if (!sheet) {
    throw new Error("System Error: Inventory database sheet not found.");
  }
  
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }
  
  const headers = values[0];
  const lowerHeaders = headers.map(h => h.toString().toLowerCase().trim());
  
  const idCol = lowerHeaders.indexOf("id");
  const descCol = lowerHeaders.indexOf("item description");
  const assignedCol = lowerHeaders.indexOf("assigned");
  const picsCol = lowerHeaders.indexOf("pics");
  const picCol = lowerHeaders.indexOf("pic");
  const costCol = lowerHeaders.indexOf("replacement cost");
  const statusCol = lowerHeaders.indexOf("status");
  const typeCol = lowerHeaders.indexOf("type");
  
  const performerNotesCol = getOrCreatePerformerNotesColumn(sheet, lowerHeaders);
  
  const items = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.length <= assignedCol) continue;
    
    const rowEmail = row[assignedCol].toString().trim().toLowerCase();
    const itemId = idCol !== -1 && row.length > idCol ? row[idCol].toString().trim() : "N/A";
    const itemDesc = descCol !== -1 && row.length > descCol ? row[descCol].toString().trim() : "Unlabeled Costume/Prop";
    
    let rawPic = "";
    if (picsCol !== -1 && row.length > picsCol && row[picsCol]) {
      rawPic = row[picsCol].toString().trim();
    } else if (picCol !== -1 && row.length > picCol && row[picCol]) {
      rawPic = row[picCol].toString().trim();
    }
    
    const replacementCost = costCol !== -1 && row.length > costCol ? row[costCol].toString().trim() : "N/A";
    const currentStatus = statusCol !== -1 && row.length > statusCol ? row[statusCol].toString().trim() : "-";
    const notes = performerNotesCol !== -1 && row.length > performerNotesCol ? row[performerNotesCol].toString().trim() : "";
    const itemType = typeCol !== -1 && row.length > typeCol ? row[typeCol].toString().trim() : "General";
    
    items.push({
      rowIndex: i + 1,
      id: itemId,
      description: itemDesc,
      picUrl: rawPic,
      cost: replacementCost,
      status: currentStatus || "-",
      notes: notes,
      assigned: rowEmail,
      type: itemType
    });
  }
  
  return items;
}

/**
 * Administrator gateway endpoint. Fetches specific performer inventory
 * or all items after validating requester admin privileges.
 */
function getPerformerInventoryForAdmin(adminEmail, performerEmail) {
  if (!isAdmin(adminEmail)) {
    throw new Error("Unauthorized access. Admin privileges required.");
  }
  
  if (!performerEmail || performerEmail === "all") {
    return getAllInventory();
  }
  
  return getPerformerInventory(performerEmail);
}

/**
 * Retrives inventory items assigned to a performer by their email address.
 */
function getPerformerInventory(email) {
  if (!email) return [];
  
  const ss = getInventorySpreadsheet();
  const sheet = ss.getSheetByName("Inventory") || ss.getSheets()[0];
  if (!sheet) {
    throw new Error("System Error: Inventory database sheet not found.");
  }
  
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }
  
  const headers = values[0];
  const lowerHeaders = headers.map(h => h.toString().toLowerCase().trim());
  
  // Find column indices dynamically (Code by Header)
  const idCol = lowerHeaders.indexOf("id");
  const descCol = lowerHeaders.indexOf("item description");
  const assignedCol = lowerHeaders.indexOf("assigned");
  const picsCol = lowerHeaders.indexOf("pics");
  const picCol = lowerHeaders.indexOf("pic");
  const costCol = lowerHeaders.indexOf("replacement cost");
  const statusCol = lowerHeaders.indexOf("status");
  const typeCol = lowerHeaders.indexOf("type");
  
  if (assignedCol === -1) {
    throw new Error("System Error: 'Assigned' performer column was not found in the spreadsheet headers.");
  }
  
  // Resolve or create "Performer notes" column dynamically
  const performerNotesCol = getOrCreatePerformerNotesColumn(sheet, lowerHeaders);
  
  const items = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.length <= assignedCol) continue;
    
    const rowEmail = row[assignedCol].toString().trim().toLowerCase();
    if (rowEmail === email) {
      // Extract properties safely
      const itemId = idCol !== -1 ? row[idCol].toString().trim() : "N/A";
      const itemDesc = descCol !== -1 ? row[descCol].toString().trim() : "Unlabeled Costume/Prop";
      
      // Get image link (check pics first, then fallback to pic)
      let rawPic = "";
      if (picsCol !== -1 && row[picsCol]) {
        rawPic = row[picsCol].toString().trim();
      } else if (picCol !== -1 && row[picCol]) {
        rawPic = row[picCol].toString().trim();
      }
      
      const replacementCost = costCol !== -1 ? row[costCol].toString().trim() : "N/A";
      const currentStatus = statusCol !== -1 ? row[statusCol].toString().trim() : "-";
      const notes = performerNotesCol !== -1 && row.length > performerNotesCol ? row[performerNotesCol].toString().trim() : "";
      const itemType = typeCol !== -1 && row.length > typeCol ? row[typeCol].toString().trim() : "General";
      
      items.push({
        rowIndex: i + 1, // 1-based spreadsheet row number
        id: itemId,
        description: itemDesc,
        picUrl: rawPic,
        cost: replacementCost,
        status: currentStatus || "-",
        notes: notes,
        type: itemType
      });
    }
  }
  
  return items;
}

/**
 * Locates or creates a 'Performer notes' column in the spreadsheet dynamically.
 * Self-heals the sheet structure if column doesn't exist yet.
 */
function getOrCreatePerformerNotesColumn(sheet, lowerHeaders) {
  let index = lowerHeaders.indexOf("performer notes");
  if (index !== -1) {
    return index;
  }
  
  // If not found, insert column at the end
  const nextColNum = sheet.getLastColumn() + 1;
  sheet.getRange(1, nextColNum).setValue("Performer notes");
  
  // Format the header style to match adjacent headers
  try {
    const adjacentHeader = sheet.getRange(1, nextColNum - 1);
    const newHeader = sheet.getRange(1, nextColNum);
    newHeader.setFontWeight(adjacentHeader.getFontWeight());
    newHeader.setFontColor(adjacentHeader.getFontColor());
    newHeader.setBackground(adjacentHeader.getBackground());
    newHeader.setHorizontalAlignment(adjacentHeader.getHorizontalAlignment());
  } catch (err) {
    Logger.log("Failed to mirror header styles: " + err.toString());
  }
  
  // Return new index (0-based)
  return nextColNum - 1;
}

/**
 * Server-side endpoint to save updates. Called via google.script.run from client JS.
 * Employs row validation check to prevent collision in case of concurrent edits.
 */
function updateItemStatusAndNotes(rowIndex, expectedId, newStatus, performerNotes) {
  try {
    const ss = getInventorySpreadsheet();
    const sheet = ss.getSheetByName("Inventory") || ss.getSheets()[0];
    if (!sheet) {
      throw new Error("Inventory database sheet not found.");
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lowerHeaders = headers.map(h => h.toString().toLowerCase().trim());
    
    const idCol = lowerHeaders.indexOf("id");
    const statusCol = lowerHeaders.indexOf("status");
    const notesCol = getOrCreatePerformerNotesColumn(sheet, lowerHeaders);
    
    if (statusCol === -1) {
      throw new Error("Unable to locate 'Status' column in spreadsheet headers.");
    }
    
    const rowNum = parseInt(rowIndex, 10);
    if (isNaN(rowNum) || rowNum <= 1 || rowNum > sheet.getLastRow()) {
      throw new Error("Invalid spreadsheet row number: " + rowIndex);
    }
    
    // Check if the ID at this row matches the expected ID (Self-Shift Guard)
    let actualId = "";
    if (idCol !== -1) {
      actualId = sheet.getRange(rowNum, idCol + 1).getValue().toString().trim();
    }
    
    let targetRow = rowNum;
    
    if (actualId !== expectedId) {
      Logger.log(`Collision Guard: ID at row ${rowNum} is '${actualId}' but expected '${expectedId}'. Scanning spreadsheet to find correct row...`);
      // ID shifted, scan spreadsheet for the correct item row
      const values = sheet.getDataRange().getValues();
      let foundRow = -1;
      for (let i = 1; i < values.length; i++) {
        if (idCol !== -1 && values[i][idCol].toString().trim() === expectedId) {
          foundRow = i + 1;
          break;
        }
      }
      
      if (foundRow === -1) {
        throw new Error("Data Integrity Error: Item ID '" + expectedId + "' could not be located in the sheet.");
      }
      targetRow = foundRow;
      Logger.log(`Collision Guard: Correct row resolved at index ${targetRow}.`);
    }
    
    // Write values to target row
    sheet.getRange(targetRow, statusCol + 1).setValue(newStatus);
    sheet.getRange(targetRow, notesCol + 1).setValue(performerNotes);
    
    return {
      success: true,
      resolvedRowIndex: targetRow
    };
  } catch (error) {
    Logger.log("Error in updateItemStatusAndNotes: " + error.toString());
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * Direct request gateway. If email matches rows in the spreadsheet,
 * sends their unique, obfuscated login link to their email address.
 */
function requestAccessLink(email) {
  try {
    if (!email) {
      return { success: false, error: "Please enter a valid email address." };
    }
    const cleanEmail = email.trim().toLowerCase();
    
    // Verify email is in inventory (bypass check for administrators)
    if (!isAdmin(cleanEmail)) {
      const items = getPerformerInventory(cleanEmail);
      if (items.length === 0) {
        return { 
          success: false, 
          error: "This email is not registered in our inventory database or has no items currently checked out." 
        };
      }
    }
    
    // Generate secure link using base64 URL safe format
    let webAppUrl = "";
    try {
      webAppUrl = ScriptApp.getService().getUrl();
    } catch (e) {
      throw new Error("The Web App is not fully deployed yet. Please deploy the Web App and make sure you run as Owner and allow 'Anyone' access.");
    }
    
    if (!webAppUrl || webAppUrl.includes("/dev")) {
      // Fallback for development runs or testing
      webAppUrl = "https://script.google.com/macros/s/AKfycb-PLACEHOLDER/exec";
    }
    
    const base64Id = Utilities.base64EncodeWebSafe(Utilities.newBlob(cleanEmail).getBytes());
    const accessLink = webAppUrl + "?id=" + base64Id;
    
    // Fetch performer name for personalized email greeting (use Director/Subdirector title for admins)
    let performerName = "";
    if (isAdmin(cleanEmail)) {
      performerName = cleanEmail === "rodriguez2113@gmail.com" ? "Director" : "Subdirector";
    } else {
      performerName = getPerformerNameFromProfile(cleanEmail) || "Performer";
    }
    
    // Send email
    const subject = "\ud83d\udd11 Your Secure Access Link: Tradici\u00f3n Costume & Prop Inventory";
    const body = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 700;">Tradici\u00f3n Dance Company</h2>
          <p style="color: #ef4444; margin: 5px 0 0 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Costume &amp; Prop Inventory Verification</p>
        </div>
        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
          Hola <strong>${performerName}</strong>,
        </p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 25px;">
          Use the secure button below to access your private inventory list. From your portal, you can confirm you have your assigned costumes and props, or update their status.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accessLink}" style="background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 16px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2), 0 2px 4px -1px rgba(239, 68, 68, 0.06); transition: all 0.2s ease-in-out;">
            Access My Private Inventory Portal
          </a>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 30px; background-color: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <strong>Security Note:</strong> This is a secure link tied directly to your profile. Please do not forward this email or share your link with other performers.
        </p>
        <div style="margin-top: 35px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">Salsa Guy Richmond, LLC / Tradici\u00f3n Dance Company</p>
          <p style="font-size: 12px; color: #ef4444; font-weight: bold; margin-top: 5px;">Smile, Jesus loves you \ud83d\ude42</p>
        </div>
      </div>
    `;
    
    MailApp.sendEmail({
      to: cleanEmail,
      subject: subject,
      htmlBody: body
    });
    
    return { 
      success: true, 
      message: "We have emailed your secure access link to: " + email 
    };
  } catch (error) {
    Logger.log("Error in requestAccessLink: " + error.toString());
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * Scans the inventory sheet for all unique performer emails,
 * generates their secure links, and dispatches them via GmailApp.
 * Can be run manually from Google Apps Script editor or via a custom Spreadsheet menu.
 */
function sendPerformerInventoryEmails() {
  try {
    const ss = getInventorySpreadsheet();
    const sheet = ss.getSheetByName("Inventory") || ss.getSheets()[0];
    if (!sheet) {
      throw new Error("Inventory sheet not found.");
    }
    
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      Logger.log("Inventory sheet is empty.");
      return "The inventory sheet contains no data.";
    }
    
    const headers = values[0];
    const lowerHeaders = headers.map(h => h.toString().toLowerCase().trim());
    const assignedCol = lowerHeaders.indexOf("assigned");
    
    if (assignedCol === -1) {
      throw new Error("Assigned column header not found.");
    }
    
    // Extract unique email addresses
    const emailsSet = new Set();
    for (let r = 1; r < values.length; r++) {
      if (values[r].length > assignedCol) {
        const email = values[r][assignedCol].toString().trim().toLowerCase();
        if (email && email.indexOf('@') !== -1) {
          emailsSet.add(email);
        }
      }
    }
    
    const emailsList = Array.from(emailsSet);
    Logger.log(`Found ${emailsList.length} unique performer emails: ` + JSON.stringify(emailsList));
    
    let sentCount = 0;
    let failedCount = 0;
    
    emailsList.forEach(email => {
      try {
        const res = requestAccessLink(email);
        if (res.success) {
          sentCount++;
        } else {
          failedCount++;
          Logger.log(`Failed to send email to ${email}: ${res.error}`);
        }
      } catch (err) {
        failedCount++;
        Logger.log(`Exception sending email to ${email}: ${err.toString()}`);
      }
    });
    
    const summary = `Inventory Email Dispatch Completed. Sent: ${sentCount}, Failed: ${failedCount}`;
    Logger.log(summary);
    return summary;
  } catch (error) {
    Logger.log("Error in sendPerformerInventoryEmails: " + error.toString());
    return "Error: " + error.toString();
  }
}

/**
 * Creates a custom menu in the spreadsheet window to easily run administrative actions.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Tradici\u00f3n Inventory')
    .addItem('Send Inventory Links to Performers', 'sendPerformerInventoryEmails')
    .addToUi();
}

/**
 * Asynchronously loads all initial data needed by the performer inventory portal,
 * avoiding long-line scriptlet evaluation failures during HTML template compilation.
 */
function getInitialLoadData(email) {
  let isAdminUser = false;
  let items = [];
  let performersList = [];
  let performerName = "";
  let errorMsg = "";
  
  if (email) {
    try {
      isAdminUser = isAdmin(email.trim().toLowerCase());
      if (isAdminUser) {
        items = getAllInventory();
        performersList = getPerformersList();
        performerName = "Director";
      } else {
        items = getPerformerInventory(email.trim().toLowerCase());
        performerName = getPerformerNameFromProfile(email.trim().toLowerCase());
      }
    } catch (err) {
      errorMsg = err.toString();
    }
  }
  
  // Safe default webapp service URL fallback
  let webAppUrl = "";
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (err) {
    Logger.log("Could not detect Web App URL: " + err.toString());
  }

  return {
    email: email,
    isAdminUser: isAdminUser,
    items: items,
    performersList: performersList,
    performerName: performerName,
    errorMsg: errorMsg,
    webAppUrl: webAppUrl
  };
}

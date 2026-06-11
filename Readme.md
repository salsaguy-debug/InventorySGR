# Tradición Performer Inventory Web App

This directory contains the codebase for the **Tradición Costume & Prop Performer Inventory Web App**. This app allows performers to securely view their assigned inventory from a mobile-friendly private portal and update the statuses/notes, which instantly sync back to the master spreadsheet in the background.

## Repository Contents

*   [`Code.gs`](file:///C:/Users/Angel%20A%20Rodriguez/.gemini/antigravity-ide/scratch/performer-inventory-app/Code.gs): Google Apps Script server-side code handling doGet queries, loading performer data, updating cells, and triggering email dispatches.
*   [`Index.html`](file:///C:/Users/Angel%20A%20Rodriguez/.gemini/antigravity-ide/scratch/performer-inventory-app/Index.html): The complete frontend SPA built with premium responsive layouts (dark/light theme, image lightbox, auto-saving text inputs, and dynamic badge statuses).

---

## Step-by-Step Deployment Instructions

### Step 1: Open Google Apps Script editor
1. Open the master Google Sheet: [Google Sheet Link](https://docs.google.com/spreadsheets/d/1IPZznR7kK-oCoThEHmACgMOW6KJfP8NSwzGKv3q-ITY/edit?usp=sharing)
2. In the top navigation menu, click on **Extensions** > **Apps Script**.
3. Clear out any existing placeholder code in `Code.gs`.

### Step 2: Paste the Code
1. Copy the contents of [`Code.gs`](file:///C:/Users/Angel%20A%20Rodriguez/.gemini/antigravity-ide/scratch/performer-inventory-app/Code.gs) and paste it into the editor's `Code.gs` file. Save it (press `Ctrl + S` or click the disk icon).
2. In the Apps Script editor, click the **+** button next to Files and select **HTML**.
3. Name this new file exactly `Index` (Apps Script will append `.html` to it).
4. Paste the complete contents of [`Index.html`](file:///C:/Users/Angel%20A%20Rodriguez/.gemini/antigravity-ide/scratch/performer-inventory-app/Index.html) into this file, replacing any template content. Save the project.

### Step 3: Deploy as a Web App
1. At the top right of the Apps Script page, click **Deploy** > **New deployment**.
2. Click the gear icon (**Select type**) and choose **Web app**.
3. Configure the deployment details:
    *   **Description**: `Tradición Inventory Tracker v1.0`
    *   **Execute as**: **Me (your-google-account@gmail.com)** *(This ensures the script runs with permissions to edit the spreadsheet on behalf of users)*
    *   **Who has access**: **Anyone** *(This lets performers load the webapp interface without requiring a Google sign-in)*
4. Click **Deploy**.
5. Copy the **Web App URL** provided at the end of the deployment wizard (e.g., `https://script.google.com/macros/s/AKfycb.../exec`). You will need this URL.

### Step 4: Run the Dispatcher / Set Up Menu
1. Go back to your Google Sheets tab and refresh the page.
2. You will see a new menu item in the spreadsheet navigation toolbar titled **Tradición Inventory**.
3. Click on **Tradición Inventory** > **Send Inventory Links to Performers**.
4. *First-time Run Permission Check:* Google Sheets will ask you to authorize execution. Click **Continue**, select your Google account, click **Advanced**, click **Go to Tradición Inventory (unsafe)**, and click **Allow**.
5. Once authorized, click the menu option again to execute the dispatch script. This scans all rows, determines unique assigned emails, encodes them, and sends them their login link.

---

## How It Works

### Secure Obfuscated Access Links
To ensure performers cannot easily guess or access each other's inventory checklists, emails are encoded using a URL-safe Base64 representation.
*   **Plain email**: `performer@gmail.com`
*   **Secure token**: `cGVyZm9ybWVyQGdtYWlsLmNvbQ==`
*   **Private URL**: `https://script.google.com/macros/s/AKfycb.../exec?id=cGVyZm9ybWVyQGdtYWlsLmNvbQ`

If a user tries to access the Web App URL directly without the `?id=` parameter (or an invalid parameter), the app displays a secure email request portal. Entering their email checks the spreadsheet. If they have items checked out, the system automatically emails them their secure access link.

### Dropbox Picture Previews
Dropbox links are automatically translated on-the-fly in the frontend. The URL:
`https://www.dropbox.com/scl/fi/abc/image.jpeg?dl=0`
is converted to:
`https://dl.dropboxusercontent.com/scl/fi/abc/image.jpeg?raw=1`
This enables the webapp to fetch the image binary directly and render a high-quality picture preview next to the item metadata, allowing dancers to instantly recognize their costumes.

### Zero-Click Save Flow
1. **Dropdown selections**: Changing the dropdown writes the new selection to the `Status` column of that item immediately. A visual green `✓ Saved!` message flashes next to the field.
2. **Performer notes**: Auto-saves in the background with a 1.2-second typing debounce, or immediately when the user clicks away (blur event).
3. **Double-check / Shift Guard**: When a cell updates, the server checks that the ID at the row index matches. If the spreadsheet rows shifted due to concurrent edits or sort filters, the server scans the sheet to locate the corrected row, writes the update, and returns the new row position back to the client.

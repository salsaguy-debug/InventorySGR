import urllib.request
import csv
import io
import os
import re
import json

def fetch_csv():
    # Fetch CSV containing the inventory
    url = "https://docs.google.com/spreadsheets/d/1IPZznR7kK-oCoThEHmACgMOW6KJfP8NSwzGKv3q-ITY/export?format=csv"
    print(f"Fetching spreadsheet from {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching CSV: {e}")
        return None

def get_performer_inventory(email, csv_rows):
    if not email:
        return []
    headers = [h.strip().lower() for h in csv_rows[0]]
    id_col = headers.index("id") if "id" in headers else -1
    desc_col = headers.index("item description") if "item description" in headers else -1
    assigned_col = headers.index("assigned") if "assigned" in headers else -1
    pics_col = headers.index("pics") if "pics" in headers else -1
    pic_col = headers.index("pic") if "pic" in headers else -1
    cost_col = headers.index("replacement cost") if "replacement cost" in headers else -1
    status_col = headers.index("status") if "status" in headers else -1
    type_col = headers.index("type") if "type" in headers else (headers.index("types") if "types" in headers else -1)
    
    # Check performer notes column
    performer_notes_col = headers.index("performer notes") if "performer notes" in headers else -1

    items = []
    for i, row in enumerate(csv_rows[1:], 1):
        if len(row) <= assigned_col:
            continue
        row_email = row[assigned_col].strip().lower()
        if row_email == email:
            item_id = row[id_col].strip() if id_col != -1 and len(row) > id_col else "N/A"
            item_desc = row[desc_col].strip() if desc_col != -1 and len(row) > desc_col else "Unlabeled Costume/Prop"
            raw_pic = ""
            if pics_col != -1 and len(row) > pics_col and row[pics_col]:
                raw_pic = row[pics_col].strip()
            elif pic_col != -1 and len(row) > pic_col and row[pic_col]:
                raw_pic = row[pic_col].strip()
            replacement_cost = row[cost_col].strip() if cost_col != -1 and len(row) > cost_col else "N/A"
            current_status = row[status_col].strip() if status_col != -1 and len(row) > status_col else "-"
            notes = row[performer_notes_col].strip() if performer_notes_col != -1 and len(row) > performer_notes_col else ""
            item_type = row[type_col].strip() if type_col != -1 and len(row) > type_col else "General"

            items.append({
                "rowIndex": i + 1,
                "id": item_id,
                "description": item_desc,
                "picUrl": raw_pic,
                "cost": replacement_cost,
                "status": current_status or "-",
                "notes": notes,
                "type": item_type
            })
    return items

def compile_and_run_template(email, items, performer_name, error_msg, web_app_url):
    print("Compiling Index.html template...")
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # We will simulate Google Apps Script evaluate() by replacing scriptlets.
    # Replace <?= email ?> style scriptlets:
    def replace_val(match):
        expr = match.group(1).strip()
        if expr == "email":
            return email
        elif expr == "performerName":
            return performer_name
        elif expr == "errorMsg":
            return error_msg
        elif expr == "webAppUrl":
            return web_app_url
        return ""

    html_evaluated = re.sub(r'<\?=\s*([\s\S]*?)\s*\?>', replace_val, html)

    # Replace <?!= JSON.stringify(items || []) ?> style scriptlets:
    def replace_unescaped(match):
        expr = match.group(1).strip()
        if "JSON.stringify(items" in expr:
            return json.dumps(items)
        return ""

    html_evaluated = re.sub(r'<\?!=([\s\S]*?)\?>', replace_unescaped, html_evaluated)

    return html_evaluated

def main():
    csv_data = fetch_csv()
    if not csv_data:
        print("Failed to load CSV spreadsheet data.")
        return

    reader = csv.reader(io.StringIO(csv_data))
    csv_rows = list(reader)
    print(f"Successfully loaded and parsed {len(csv_rows)} rows from spreadsheet.")

    # Edna has registered items
    test_email = "ednatradicion@gmail.com"
    print(f"Running dry run for: {test_email}")
    items = get_performer_inventory(test_email, csv_rows)
    print(f"Found {len(items)} items assigned to {test_email}.")

    try:
        output_html = compile_and_run_template(
            email=test_email,
            items=items,
            performer_name="Edna",
            error_msg="",
            web_app_url="https://script.google.com/macros/s/AKfycb-DRYRUN/exec"
        )
        with open('dry_run_output.html', 'w', encoding='utf-8') as f:
            f.write(output_html)
        print("[OK] Dry run passed! Output successfully written to dry_run_output.html")
    except Exception as e:
        print(f"[ERROR] Dry run failed: {e}")

if __name__ == "__main__":
    main()

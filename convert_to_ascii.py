with open('Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace any character > 127 with its JS Unicode escape sequence
output = ""
for char in content:
    o = ord(char)
    if o > 127:
        # Check if it's a surrogate pair (for emojis)
        if o > 0xffff:
            # Calculate high and low surrogates
            o -= 0x10000
            high = 0xd800 + (o >> 10)
            low = 0xdc00 + (o & 0x3ff)
            output += f"\\u{high:04x}\\u{low:04x}"
        else:
            output += f"\\u{o:04x}"
    else:
        output += char

with open('Code.gs', 'w', encoding='utf-8') as f:
    f.write(output)

print("Code.gs successfully converted to safe ASCII Unicode escapes.")

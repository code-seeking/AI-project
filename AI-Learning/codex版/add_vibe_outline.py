
import json
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject

pdf_path, outline_path = sys.argv[1], sys.argv[2]
reader = PdfReader(pdf_path)
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
if reader.metadata:
    metadata = {str(k): str(v) for k, v in reader.metadata.items() if v is not None}
    if metadata:
        writer.add_metadata(metadata)
with open(outline_path, "r", encoding="utf-8") as f:
    outline = json.load(f)
def add_items(items, parent=None):
    for item in items:
        page_index = int(item["page"]) - 1
        if 0 <= page_index < len(writer.pages):
            node = writer.add_outline_item(item["title"], page_index, parent=parent)
            add_items(item.get("children", []), node)
add_items(outline)
writer.root_object.update({NameObject("/PageMode"): NameObject("/UseOutlines")})
tmp_path = pdf_path + ".tmp"
with open(tmp_path, "wb") as f:
    writer.write(f)
import os
os.replace(tmp_path, pdf_path)

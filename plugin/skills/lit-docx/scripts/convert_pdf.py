import os as _os
import sys as _sys

_sys.dont_write_bytecode = True  # the installed skill directory stays read-only
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..", "lit-pptx", "scripts"))
from office_runtime_bootstrap import ensure_runtime  # noqa: E402

ensure_runtime(["pymupdf"])

import sys
import pymupdf as fitz
import re

def clean_text(text):
    """
    Cleans up common PDF extraction artifacts.
    """
    # Replace non-breaking spaces with regular spaces
    text = text.replace('\xa0', ' ')
    
    # Remove excessive whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    
    # Remove common journal header/footer noise (simple heuristics)
    # Example: "Journal Pre-proof", PAGE numbers alone, DOIs repeated at edges
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        stripped = line.strip()
        # Skip empty lines
        if not stripped:
            continue
            
        # Skip page numbers (just digits)
        if re.match(r'^\d+$', stripped):
            continue
            
        # Example heuristic: Skip lines that look like standard journal headers
        if stripped.lower() in ["journal pre-proof", "accepted manuscript"]:
            continue
            
        cleaned_lines.append(line)
        
    return "\n".join(cleaned_lines)

def merge_paragraphs(text_blocks):
    """
    Merges text blocks into coherent paragraphs.
    PDFs often break lines; we need to reassemble them.
    text_blocks is a list of strings, each representing a block of text.
    """
    full_text = ""
    for block in text_blocks:
        # Clean the block first
        block = block.strip()
        if not block:
            continue
            
        # Split block into lines to process internal line breaks
        lines = block.split('\n')
        merged_block = ""
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            if not merged_block:
                merged_block = line
            else:
                # specific check for hyphenation
                if merged_block.endswith('-'):
                    # Remove hyphen and join (e.g. "for- \n mation" -> "formation")
                    merged_block = merged_block[:-1] + line
                else:
                    # If the previous line ends with a sentence ender, usually keep separate or add space?
                    # In standard paragraphs, just add space.
                    merged_block += " " + line
        
        full_text += merged_block + "\n\n"
        
    return full_text

def convert_pdf_to_md(pdf_path, md_path):
    doc = fitz.open(pdf_path)
    output_text = []

    for page_num, page in enumerate(doc):
        # get_text("blocks") returns a list of items like:
        # (x0, y0, x1, y1, "text", block_no, block_type)
        # sort=True sorts by top-left to bottom-right, handling columns effectively.
        blocks = page.get_text("blocks", sort=True)
        
        page_content = []
        
        # Exclude header/footer area by coordinate
        page_height = page.rect.height
        margin_top = page_height * 0.05  # Top 5%
        margin_bottom = page_height * 0.95 # Bottom 5% checks
        
        for b in blocks:
            # Block structure: (x0, y0, x1, y1, text, block_no, block_type)
            if b[6] == 0:  # text block
                y0 = b[1]
                y1 = b[3]
                text = b[4]
                
                # Simple filter for obvious header/footers based on position
                if y1 < margin_top or y0 > margin_bottom:
                     continue
                
                page_content.append(text)
        
        # Process the page's blocks
        merged_page_text = merge_paragraphs(page_content)
        cleaned_page_text = clean_text(merged_page_text)
        
        output_text.append(cleaned_page_text)
        
        # Add a visual separator between pages (optional, but helpful for debugging context)
        # output_text.append(f"\n<!-- Page {page_num + 1} -->\n")

    full_text = "\n".join(output_text)
    
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(full_text)
    
    print(f"Successfully converted {pdf_path} to {md_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_pdf.py <input.pdf> <output.md>")
        sys.exit(1)
        
    pdf_file = sys.argv[1]
    md_file = sys.argv[2]
    
    convert_pdf_to_md(pdf_file, md_file)

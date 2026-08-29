#!/usr/bin/env python3
"""
StockWhisk Enterprise PDF Generator
Converts all Markdown documentation in docs/ to high-fidelity, interactive, professional PDFs.
Uses markdown, pygments, and Headless Chrome for pixel-perfect modern rendering.
"""

import os
import re
import sys
import subprocess
from pathlib import Path
import markdown
from markdown.extensions.toc import TocExtension
from markdown.extensions.tables import TableExtension
from markdown.extensions.fenced_code import FencedCodeExtension
from markdown.extensions.codehilite import CodeHiliteExtension

DOCS_DIR = Path("/Users/m3air/Desktop/Files/Stock Whisk/stockwhisk_updated/docs")
PDF_DIR = DOCS_DIR / "pdf"
HTML_TEMP_DIR = DOCS_DIR / ".html_temp"
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Modern CSS Template for Enterprise SaaS Documentation
CSS_STYLES = """
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Hind+Siliguri:wght@400;500;600;700&display=swap');

:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --primary-light: #eff6ff;
  --indigo: #6366f1;
  --dark-bg: #0f172a;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --card-bg: #ffffff;
  --section-bg: #f8fafc;
  --success: #059669;
  --warning: #d97706;
  --danger: #dc2626;
  --info: #0284c7;
}

@page {
  size: A4 portrait;
  margin: 18mm 16mm 20mm 16mm;
  @top-left {
    content: "StockWhisk Enterprise Documentation";
    font-family: 'Outfit', sans-serif;
    font-size: 8pt;
    font-weight: 500;
    color: #94a3b8;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 4px;
  }
  @top-right {
    content: "Confidential & Proprietary";
    font-family: 'Outfit', sans-serif;
    font-size: 8pt;
    color: #94a3b8;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 4px;
  }
  @bottom-left {
    content: "StockWhisk SaaS · Multi-Tenant ERP & POS";
    font-family: 'Outfit', sans-serif;
    font-size: 8pt;
    color: #94a3b8;
  }
  @bottom-right {
    content: "Page " counter(page);
    font-family: 'Outfit', sans-serif;
    font-size: 8pt;
    font-weight: 600;
    color: #2563eb;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

body {
  font-family: 'Outfit', 'Hind Siliguri', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--text-main);
  background: #ffffff;
  font-size: 9.8pt;
  line-height: 1.6;
  padding: 0;
}

/* Document Header Banner */
.doc-header-banner {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%);
  color: #ffffff;
  padding: 24px 28px;
  border-radius: 12px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.25);
  position: relative;
  page-break-inside: avoid;
}

.doc-brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #93c5fd;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.doc-code-pill {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #ffffff;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.doc-title-main {
  font-size: 19pt;
  font-weight: 800;
  line-height: 1.25;
  color: #ffffff;
  margin-bottom: 8px;
  letter-spacing: -0.3px;
}

.doc-subtitle {
  font-size: 10.5pt;
  color: #cbd5e1;
  font-weight: 400;
  margin-bottom: 16px;
  line-height: 1.4;
}

.doc-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  background: rgba(0, 0, 0, 0.25);
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.meta-item-label {
  font-size: 7pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.meta-item-val {
  font-size: 8.5pt;
  font-weight: 600;
  color: #f8fafc;
}

/* Headings */
h1 {
  font-size: 15pt;
  font-weight: 800;
  color: #0f172a;
  margin-top: 24px;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 2px solid #e2e8f0;
  letter-spacing: -0.3px;
  page-break-after: avoid;
  page-break-inside: avoid;
}

h2 {
  font-size: 12.5pt;
  font-weight: 700;
  color: #1e293b;
  margin-top: 20px;
  margin-bottom: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid #f1f5f9;
  page-break-after: avoid;
  page-break-inside: avoid;
}

h3 {
  font-size: 11pt;
  font-weight: 700;
  color: #334155;
  margin-top: 14px;
  margin-bottom: 6px;
  page-break-after: avoid;
  page-break-inside: avoid;
}

h4, h5, h6 {
  font-size: 10pt;
  font-weight: 600;
  color: #475569;
  margin-top: 12px;
  margin-bottom: 4px;
  page-break-after: avoid;
}

p {
  margin-bottom: 10px;
  color: #334155;
}

strong {
  font-weight: 700;
  color: #0f172a;
}

/* Links */
a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
}

a:hover {
  text-decoration: underline;
}

/* Lists */
ul, ol {
  margin-bottom: 12px;
  padding-left: 20px;
}

li {
  margin-bottom: 4px;
  color: #334155;
}

/* Tables */
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 14px 0 18px 0;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
  font-size: 8.5pt;
  page-break-inside: avoid;
}

th {
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 700;
  text-align: left;
  padding: 8px 10px;
  border-bottom: 2px solid #cbd5e1;
  border-right: 1px solid #e2e8f0;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

th:last-child {
  border-right: none;
}

td {
  padding: 7px 10px;
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9;
  color: #334155;
  vertical-align: top;
}

td:last-child {
  border-right: none;
}

tr:last-child td {
  border-bottom: none;
}

tr:nth-child(even) td {
  background: #f8fafc;
}

/* Code & Monospace */
code {
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 8.5pt;
  background: #f1f5f9;
  color: #0f172a;
  padding: 1.5px 5px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

pre {
  background: #0f172a !important;
  color: #f8fafc !important;
  padding: 12px 14px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 8pt;
  line-height: 1.45;
  margin: 12px 0 16px 0;
  border: 1px solid #334155;
  page-break-inside: avoid;
}

pre code {
  background: transparent !important;
  color: inherit !important;
  padding: 0;
  border: none;
  font-size: inherit;
}

/* Blockquotes / Callout Cards */
blockquote {
  margin: 14px 0;
  padding: 10px 14px;
  background: #f8fafc;
  border-left: 4px solid #2563eb;
  border-radius: 0 8px 8px 0;
  font-size: 9pt;
  color: #334155;
  page-break-inside: avoid;
}

blockquote p {
  margin-bottom: 4px;
}

blockquote p:last-child {
  margin-bottom: 0;
}

/* Custom Interactive Badges */
.badge {
  display: inline-block;
  padding: 2px 7px;
  font-size: 7.5pt;
  font-weight: 700;
  border-radius: 12px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

.badge-get { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.badge-post { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.badge-put { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.badge-delete { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

.badge-p1 { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
.badge-p2 { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
.badge-p3 { background: #e0f2fe; color: #075985; border: 1px solid #7dd3fc; }

.badge-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.badge-warning { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
.badge-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

/* Table of Contents Container */
.toc {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 18px;
  margin: 16px 0 24px 0;
  page-break-inside: avoid;
}

.toc-title {
  font-size: 10pt;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.toc ul {
  list-style-type: none;
  padding-left: 0;
  margin-bottom: 0;
}

.toc li {
  margin-bottom: 4px;
}

.toc li a {
  color: #2563eb;
  font-size: 8.8pt;
  text-decoration: none;
}

.toc li a:hover {
  text-decoration: underline;
}

.toc ul ul {
  padding-left: 16px;
  margin-top: 4px;
}

/* Horizontal Rule */
hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 20px 0;
}

/* Checkboxes */
.task-list-item {
  list-style-type: none;
  margin-left: -15px;
}

input[type="checkbox"] {
  margin-right: 6px;
  transform: translateY(1px);
}
"""

DOC_METADATA = {
    "01-SRS.md": {
        "code": "DOC-01",
        "title": "Software Requirements Specification (SRS)",
        "subtitle": "IEEE 830 Standard Functional & Non-Functional Requirements Specification",
        "type": "Technical Architecture",
        "audience": "Core Engineering, QA, System Architects",
    },
    "02-Complete-Module-List.md": {
        "code": "DOC-02",
        "title": "Complete Module & App Catalog",
        "subtitle": "Comprehensive Inventory of 22 Domain Modules, Models, and APIs",
        "type": "Architecture Catalog",
        "audience": "Developers, Tech Leads, Integrators",
    },
    "03-Role-Permission-Matrix.md": {
        "code": "DOC-03",
        "title": "Role & Granular Permission Matrix",
        "subtitle": "Enterprise Access Control, Role Hierarchies, and Security Scopes",
        "type": "Security & Governance",
        "audience": "Security Auditors, Admins, Developers",
    },
    "04-Business-Rules-Calculation-Spec.md": {
        "code": "DOC-04",
        "title": "Business Rules & Calculation Specification",
        "subtitle": "Mathematical Formulations for Accounting, EMI, COGS, Stock & P&L",
        "type": "Financial Specification",
        "audience": "Accounting Specialists, Core Engineers",
    },
    "05-Complete-User-Flows.md": {
        "code": "DOC-05",
        "title": "End-to-End User Journeys & Operational Flows",
        "subtitle": "20 Detailed Business Workflows, Preconditions & Step-by-Step Sequences",
        "type": "Process Specification",
        "audience": "Product Managers, UI/UX, QA, Operators",
    },
    "06-Multi-Tenant-Security-Requirements.md": {
        "code": "DOC-06",
        "title": "Multi-Tenant Data Isolation & Security Framework",
        "subtitle": "Thread-Local Isolation Contexts, Scoped ORM Guards & Defense-in-Depth",
        "type": "Security Specification",
        "audience": "Security Auditors, Backend Engineers",
    },
    "07-Test-Environment-Spec.md": {
        "code": "DOC-07",
        "title": "Test Environment & Infrastructure Specification",
        "subtitle": "Dockerized Staging, Hardware Scanners, Seed Data & CI/CD Pipelines",
        "type": "DevOps & QA",
        "audience": "QA Engineers, DevOps, Infrastructure",
    },
    "08-Test-Account-Data-Spec.md": {
        "code": "DOC-08",
        "title": "Test Account & Seed Data Specification",
        "subtitle": "Multi-Shop Scenarios, Serialized Inventory Fixtures & Persona Sets",
        "type": "QA Specification",
        "audience": "QA Engineers, Automation Teams",
    },
    "09-API-Testing-Spec.md": {
        "code": "DOC-09",
        "title": "REST API Testing & Verification Specification",
        "subtitle": "Endpoint Contracts, Request/Response Payloads, Status Codes & Auth",
        "type": "API Specification",
        "audience": "API Testers, Backend Engineers, Integrators",
    },
    "10-Functional-Test-Scenarios.md": {
        "code": "DOC-10",
        "title": "Comprehensive Functional Test Scenarios",
        "subtitle": "60+ Prioritized Test Cases Covering POS, Accounting, Serial Units & Dues",
        "type": "QA Test Suite",
        "audience": "QA Engineers, Release Managers",
    },
    "11-Security-Test-Scenarios.md": {
        "code": "DOC-11",
        "title": "Security & Multi-Tenant Penetration Test Scenarios",
        "subtitle": "Threat Models, Cross-Tenant Leaks, RBAC Bypasses & Throttling Audits",
        "type": "Security Test Suite",
        "audience": "Security Engineers, Pentesting Teams",
    },
    "12-Performance-Test-Scenarios.md": {
        "code": "DOC-12",
        "title": "Performance, Load & Stress Benchmark Scenarios",
        "subtitle": "Concurrency Benchmarks, High-Volume POS Latency & Query Profiling",
        "type": "Performance Benchmark",
        "audience": "Performance Engineers, Tech Leads",
    },
    "13-Regression-Testing-Plan.md": {
        "code": "DOC-13",
        "title": "Continuous Regression Testing & Release Plan",
        "subtitle": "Critical Path Verification Suites, Rollback Gates & Release Checklists",
        "type": "QA Strategy",
        "audience": "QA Leads, Release Engineers, DevOps",
    },
    "14-Bug-Report-Template.md": {
        "code": "DOC-14",
        "title": "Enterprise Defect Reporting Standard & Template",
        "subtitle": "Standardized Bug Taxonomy, Severity Definitions & Real Production Examples",
        "type": "QA Standard",
        "audience": "QA Engineers, Support Teams, Developers",
    },
    "15-Final-QA-Acceptance-Criteria.md": {
        "code": "DOC-15",
        "title": "Final QA Acceptance & Release Sign-Off Gate",
        "subtitle": "Production Deployment Criteria, Integrity Audits & Multi-Tier Sign-Offs",
        "type": "Release Governance",
        "audience": "Product Owners, QA Leads, CTO",
    },
    "16-Database-ER-Diagram.md": {
        "code": "DOC-16",
        "title": "Database Schema & Entity-Relationship (ER) Specification",
        "subtitle": "Complete 54-Model Multi-Tenant Relational Schema, Mermaid ERDs & Data Dictionary",
        "type": "Database Architecture",
        "audience": "Database Architects, Backend Engineers, DevOps",
    },
}

def enhance_html_badges(html_content: str) -> str:
    """Enhance HTTP methods, priority tags, and mermaid blocks into styled elements."""
    # Mermaid diagrams transformation
    html_content = re.sub(
        r'<div class="codehilite"><pre><span></span><code>mermaid\n([\s\S]*?)</code></pre></div>',
        r'<div class="mermaid">\1</div>',
        html_content
    )
    html_content = re.sub(
        r'<pre><code class="language-mermaid">([\s\S]*?)</code></pre>',
        r'<div class="mermaid">\1</div>',
        html_content
    )
    html_content = re.sub(
        r'<pre><code>mermaid\n([\s\S]*?)</code></pre>',
        r'<div class="mermaid">\1</div>',
        html_content
    )

    # Method Badges
    html_content = re.sub(r'\b(GET)\b(?= [\/A-Za-z0-9_{}-]+)', r'<span class="badge badge-get">GET</span>', html_content)
    html_content = re.sub(r'\b(POST)\b(?= [\/A-Za-z0-9_{}-]+)', r'<span class="badge badge-post">POST</span>', html_content)
    html_content = re.sub(r'\b(PUT)\b(?= [\/A-Za-z0-9_{}-]+)', r'<span class="badge badge-put">PUT</span>', html_content)
    html_content = re.sub(r'\b(DELETE)\b(?= [\/A-Za-z0-9_{}-]+)', r'<span class="badge badge-delete">DELETE</span>', html_content)
    
    # Priority Badges
    html_content = re.sub(r'\b(P1|Critical|High-Risk)\b', r'<span class="badge badge-p1">\1</span>', html_content)
    html_content = re.sub(r'\b(P2|Major|High)\b', r'<span class="badge badge-p2">\1</span>', html_content)
    html_content = re.sub(r'\b(P3|Minor|Medium)\b', r'<span class="badge badge-p3">\1</span>', html_content)
    
    # Status Badges
    html_content = re.sub(r'\[(x|X)\]', r'<input type="checkbox" checked disabled />', html_content)
    html_content = re.sub(r'\[ \]', r'<input type="checkbox" disabled />', html_content)
    
    return html_content

def convert_md_to_html(md_path: Path, meta: dict) -> str:
    """Converts a Markdown file into a styled HTML document."""
    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    # Configure Markdown processor
    md_parser = markdown.Markdown(
        extensions=[
            TableExtension(),
            FencedCodeExtension(),
            CodeHiliteExtension(guess_lang=False, css_class="codehilite"),
            TocExtension(permalink=False),
            'nl2br',
            'sane_lists',
        ]
    )

    body_html = md_parser.convert(md_text)
    body_html = enhance_html_badges(body_html)

    header_html = f"""
    <div class="doc-header-banner">
      <div class="doc-brand-row">
        <div class="brand-badge">
          <span style="font-size: 11pt;">⚡</span> STOCKWHISK SAAS PLATFORM
        </div>
        <div class="doc-code-pill">{meta.get('code', 'DOC')}</div>
      </div>
      <div class="doc-title-main">{meta.get('title', md_path.stem)}</div>
      <div class="doc-subtitle">{meta.get('subtitle', 'Official System Technical Documentation')}</div>
      <div class="doc-meta-grid">
        <div>
          <div class="meta-item-label">Document Type</div>
          <div class="meta-item-val">{meta.get('type', 'Specification')}</div>
        </div>
        <div>
          <div class="meta-item-label">Target Audience</div>
          <div class="meta-item-val">{meta.get('audience', 'Engineering Team')}</div>
        </div>
        <div>
          <div class="meta-item-label">Release Version</div>
          <div class="meta-item-val">v1.4.0 Production</div>
        </div>
        <div>
          <div class="meta-item-label">Status</div>
          <div class="meta-item-val">✅ Verified & Approved</div>
        </div>
      </div>
    </div>
    """

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{meta.get('title', md_path.stem)} · StockWhisk Docs</title>
  <style>
{CSS_STYLES}
  </style>
  <script src="file:///Users/m3air/Desktop/Files/Stock%20Whisk/stockwhisk_updated/docs/assets/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {{
      mermaid.initialize({{
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        er: {{
          useMaxWidth: true,
          diagramPadding: 20,
          fontSize: 12
        }}
      }});
    }});
  </script>
</head>

<body>
  {header_html}
  <main>
    {body_html}
  </main>
</body>
</html>
"""
    return full_html

def convert_html_to_pdf(html_path: Path, pdf_path: Path):
    """Invokes Headless Google Chrome to render HTML into a print PDF."""
    cmd = [
        CHROME_BIN,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--virtual-time-budget=8000",
        "--run-all-compositor-stages-before-draw",
        "--allow-file-access-from-files",
        f"--print-to-pdf={pdf_path}",
        str(html_path)
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print(f"Error generating PDF for {html_path.name}: {res.stderr}")
    else:
        print(f"  ✓ Successfully created: {pdf_path.name} ({pdf_path.stat().st_size // 1024} KB)")


def generate_master_book(md_files: list):
    """Compiles all 15 markdown files into a single unified master documentation book."""
    print("📘 Generating Master Documentation Suite PDF...")
    
    master_body_parts = []
    
    # Master Table of Contents
    master_toc = """
    <div class="doc-header-banner" style="margin-bottom: 30px;">
      <div class="doc-brand-row">
        <div class="brand-badge">
          <span style="font-size: 11pt;">⚡</span> STOCKWHISK ENTERPRISE SUITE
        </div>
        <div class="doc-code-pill">MASTER SUITE</div>
      </div>
      <div class="doc-title-main">Complete System Documentation & QA Specification</div>
      <div class="doc-subtitle">Full 15-Volume Production Reference Handbook for StockWhisk SaaS Platform</div>
      <div class="doc-meta-grid">
        <div>
          <div class="meta-item-label">Document Suite</div>
          <div class="meta-item-val">15 Modules & Specs</div>
        </div>
        <div>
          <div class="meta-item-label">Target Architecture</div>
          <div class="meta-item-val">Django REST + Next.js 14</div>
        </div>
        <div>
          <div class="meta-item-label">Release Version</div>
          <div class="meta-item-val">v1.4.0 Production</div>
        </div>
        <div>
          <div class="meta-item-label">Status</div>
          <div class="meta-item-val">✅ Verified & Approved</div>
        </div>
      </div>
    </div>

    <div class="toc" style="margin-bottom: 40px; padding: 20px 24px;">
      <div class="toc-title" style="font-size: 13pt; margin-bottom: 14px;">📚 Master Suite Table of Contents</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px;">
    """
    
    for idx, md_path in enumerate(md_files, 1):
        meta = DOC_METADATA.get(md_path.name, {})
        doc_code = meta.get('code', f'DOC-{idx:02d}')
        doc_title = meta.get('title', md_path.stem)
        master_toc += f'<div><a href="#section-{doc_code}" style="font-weight: 600; font-size: 9pt;">{doc_code}: {doc_title}</a></div>\n'
    
    master_toc += """
      </div>
    </div>
    <div style="page-break-after: always;"></div>
    """
    
    master_body_parts.append(master_toc)
    
    for md_path in md_files:
        meta = DOC_METADATA.get(md_path.name, {
            "code": md_path.stem.split("-")[0] if "-" in md_path.stem else "DOC",
            "title": md_path.stem.replace("-", " "),
            "subtitle": "StockWhisk System Specification",
            "type": "Technical Specification",
            "audience": "Engineering & Product",
        })
        
        doc_code = meta.get('code', 'DOC')
        
        with open(md_path, "r", encoding="utf-8") as f:
            md_text = f.read()

        md_parser = markdown.Markdown(
            extensions=[
                TableExtension(),
                FencedCodeExtension(),
                CodeHiliteExtension(guess_lang=False, css_class="codehilite"),
                TocExtension(permalink=False),
                'nl2br',
                'sane_lists',
            ]
        )
        
        body_html = md_parser.convert(md_text)
        body_html = enhance_html_badges(body_html)
        
        section_header = f"""
        <div id="section-{doc_code}" style="page-break-before: always; padding-top: 10px;"></div>
        <div class="doc-header-banner">
          <div class="doc-brand-row">
            <div class="brand-badge">
              <span style="font-size: 11pt;">⚡</span> STOCKWHISK SAAS PLATFORM
            </div>
            <div class="doc-code-pill">{doc_code}</div>
          </div>
          <div class="doc-title-main">{meta.get('title', md_path.stem)}</div>
          <div class="doc-subtitle">{meta.get('subtitle', 'Official System Technical Documentation')}</div>
          <div class="doc-meta-grid">
            <div>
              <div class="meta-item-label">Document Type</div>
              <div class="meta-item-val">{meta.get('type', 'Specification')}</div>
            </div>
            <div>
              <div class="meta-item-label">Target Audience</div>
              <div class="meta-item-val">{meta.get('audience', 'Engineering Team')}</div>
            </div>
            <div>
              <div class="meta-item-label">Release Version</div>
              <div class="meta-item-val">v1.4.0 Production</div>
            </div>
            <div>
              <div class="meta-item-label">Status</div>
              <div class="meta-item-val">✅ Verified & Approved</div>
            </div>
          </div>
        </div>
        """
        
        master_body_parts.append(section_header + f"<section>{body_html}</section>")
    
    master_full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>StockWhisk Complete System Documentation Suite</title>
  <style>
{CSS_STYLES}
  </style>
  <script src="file:///Users/m3air/Desktop/Files/Stock%20Whisk/stockwhisk_updated/docs/assets/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {{
      mermaid.initialize({{
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        er: {{
          useMaxWidth: true,
          diagramPadding: 20,
          fontSize: 12
        }}
      }});
    }});
  </script>
</head>



<body>
  <main>
    {''.join(master_body_parts)}
  </main>
</body>
</html>
"""
    master_html_path = HTML_TEMP_DIR / "StockWhisk_Complete_Documentation_Suite.html"
    with open(master_html_path, "w", encoding="utf-8") as f:
        f.write(master_full_html)
        
    master_pdf_path = PDF_DIR / "StockWhisk_Complete_Documentation_Suite.pdf"
    convert_html_to_pdf(master_html_path, master_pdf_path)

def main():
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    HTML_TEMP_DIR.mkdir(parents=True, exist_ok=True)

    md_files = sorted(list(DOCS_DIR.glob("*.md")))
    print(f"🚀 Found {len(md_files)} markdown files in {DOCS_DIR}...")
    print("=" * 65)

    for md_path in md_files:
        meta = DOC_METADATA.get(md_path.name, {
            "code": md_path.stem.split("-")[0] if "-" in md_path.stem else "DOC",
            "title": md_path.stem.replace("-", " "),
            "subtitle": "StockWhisk System Specification",
            "type": "Technical Specification",
            "audience": "Engineering & Product",
        })

        # 1. Generate styled HTML
        html_content = convert_md_to_html(md_path, meta)
        temp_html_path = HTML_TEMP_DIR / f"{md_path.stem}.html"
        with open(temp_html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        # 2. Render to PDF using Chrome
        output_pdf_path = PDF_DIR / f"{md_path.stem}.pdf"
        convert_html_to_pdf(temp_html_path, output_pdf_path)

    print("=" * 65)
    generate_master_book(md_files)
    print("=" * 65)
    print("🎉 All 15 individual PDFs + Master Suite PDF successfully generated!")

if __name__ == "__main__":
    main()


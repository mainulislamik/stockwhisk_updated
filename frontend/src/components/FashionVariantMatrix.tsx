'use client';

import React, { useState, useEffect } from 'react';

export type FashionVariantItem = {
  size: string;
  color: string;
  stock: number;
  sku?: string;
  barcode?: string;
  price?: number | string;
};

interface FashionVariantMatrixProps {
  variants: FashionVariantItem[];
  onChange: (variants: FashionVariantItem[]) => void;
  parentSku?: string;
  parentName?: string;
  basePrice?: number | string;
  lang?: 'bn' | 'en';
}

const PRESET_SIZE_GROUPS = [
  {
    id: 'standard',
    labelBn: '👕 স্ট্যান্ডার্ড (S, M, L, XL, XXL, 3XL)',
    labelEn: '👕 Standard (S - 3XL)',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  {
    id: 'pants',
    labelBn: '👖 প্যান্ট/জিন্স (28, 30, 32, 34, 36, 38, 40)',
    labelEn: '👖 Pants/Jeans (28 - 40)',
    sizes: ['28', '30', '32', '34', '36', '38', '40'],
  },
  {
    id: 'chest',
    labelBn: '👔 শার্ট/পাঞ্জাবি (36, 38, 40, 42, 44, 46)',
    labelEn: '👔 Shirt/Panjabi (36 - 46)',
    sizes: ['36', '38', '40', '42', '44', '46'],
  },
  {
    id: 'kids',
    labelBn: '👶 বাচ্চাদের বয়স (1-2Y, 3-4Y, 5-6Y, 7-8Y, 9-10Y)',
    labelEn: '👶 Kids (1-10Y)',
    sizes: ['1-2Y', '3-4Y', '5-6Y', '7-8Y', '9-10Y'],
  },
  {
    id: 'freesize',
    labelBn: '✨ ফ্রি সাইজ (Free Size)',
    labelEn: '✨ Free Size',
    sizes: ['Free Size'],
  },
];

const PRESET_COLORS = [
  { name: 'Black', nameBn: 'কালো', hex: '#18181b', code: 'BLK' },
  { name: 'White', nameBn: 'সাদা', hex: '#ffffff', code: 'WHT' },
  { name: 'Navy Blue', nameBn: 'নেভি ব্লু', hex: '#1e3a8a', code: 'NVY' },
  { name: 'Maroon', nameBn: 'মেরুন', hex: '#831843', code: 'MRN' },
  { name: 'Red', nameBn: 'লাল', hex: '#dc2626', code: 'RED' },
  { name: 'Olive Green', nameBn: 'অলিভ/সবুজ', hex: '#15803d', code: 'OLV' },
  { name: 'Grey', nameBn: 'অ্যাশ/গ্রে', hex: '#64748b', code: 'GRY' },
  { name: 'Mustard Yellow', nameBn: 'হলুদ', hex: '#ca8a04', code: 'YEL' },
  { name: 'Brown', nameBn: 'বাদামী', hex: '#78350f', code: 'BRN' },
  { name: 'Pink', nameBn: 'গোলাপি', hex: '#ec4899', code: 'PNK' },
  { name: 'Sky Blue', nameBn: 'আকাশি', hex: '#0ea5e9', code: 'SKY' },
  { name: 'Purple', nameBn: 'বেগুনি', hex: '#9333ea', code: 'PRP' },
  { name: 'Orange', nameBn: 'কমলা', hex: '#ea580c', code: 'ORG' },
  { name: 'Beige', nameBn: 'অফ-হোয়াইট/বেইজ', hex: '#e4d5b7', code: 'BGE' },
];

function getColorCode(colorName: string): string {
  const found = PRESET_COLORS.find(
    (c) => c.name.toLowerCase() === colorName.toLowerCase() || c.nameBn === colorName
  );
  if (found) return found.code;
  const clean = colorName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.substring(0, 3) || 'CLR';
}

function generateSku(parentSku: string, parentName: string, color: string, size: string): string {
  const pSku = parentSku?.trim() ? parentSku.trim().toUpperCase() : '';
  const pName = parentName?.trim()
    ? parentName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4)
    : 'APP';
  const base = pSku || pName;
  const cCode = getColorCode(color);
  const sCode = size.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${base}-${cCode}-${sCode}`;
}

function generateBarcode(seed: number): string {
  const rand = Math.floor(10000000 + Math.random() * 90000000);
  return `880${rand}`;
}

export default function FashionVariantMatrix({
  variants,
  onChange,
  parentSku = '',
  parentName = '',
  basePrice = '',
  lang = 'bn',
}: FashionVariantMatrixProps) {
  const isBn = lang === 'bn';

  // Selected sizes & colors for generation
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [customColorInput, setCustomColorInput] = useState('');
  const [bulkStockVal, setBulkStockVal] = useState<string>('10');
  const [activeView, setActiveView] = useState<'matrix' | 'table'>('matrix');

  // Initialize selected sizes & colors from existing variants if any
  useEffect(() => {
    if (variants && variants.length > 0) {
      const existingSizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
      const existingColors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean)));
      if (existingSizes.length > 0 && selectedSizes.length === 0) {
        setSelectedSizes(existingSizes);
      }
      if (existingColors.length > 0 && selectedColors.length === 0) {
        setSelectedColors(existingColors.length > 0 ? existingColors : ['Standard']);
      }
    }
  }, [variants]);

  // Toggle single size
  function toggleSize(sz: string) {
    if (selectedSizes.includes(sz)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== sz));
    } else {
      setSelectedSizes([...selectedSizes, sz]);
    }
  }

  // Toggle group preset
  function selectPresetGroup(sizes: string[]) {
    const allIn = sizes.every((s) => selectedSizes.includes(s));
    if (allIn) {
      // Unselect all in this group
      setSelectedSizes(selectedSizes.filter((s) => !sizes.includes(s)));
    } else {
      // Add all missing in this group
      const next = Array.from(new Set([...selectedSizes, ...sizes]));
      setSelectedSizes(next);
    }
  }

  // Toggle single color
  function toggleColor(colName: string) {
    if (selectedColors.includes(colName)) {
      setSelectedColors(selectedColors.filter((c) => c !== colName));
    } else {
      setSelectedColors([...selectedColors, colName]);
    }
  }

  // Add custom size
  function addCustomSize() {
    const val = customSizeInput.trim();
    if (!val) return;
    if (!selectedSizes.includes(val)) {
      setSelectedSizes([...selectedSizes, val]);
    }
    setCustomSizeInput('');
  }

  // Add custom color
  function addCustomColor() {
    const val = customColorInput.trim();
    if (!val) return;
    if (!selectedColors.includes(val)) {
      setSelectedColors([...selectedColors, val]);
    }
    setCustomColorInput('');
  }

  // ⚡ GENERATE MATRIX GRID
  function handleGenerateMatrix() {
    if (selectedSizes.length === 0) {
      alert(isBn ? 'অনুগ্রহ করে অন্তত একটি সাইজ নির্বাচন করুন।' : 'Please select at least one size.');
      return;
    }

    const colorsToUse = selectedColors.length > 0 ? selectedColors : ['Default'];
    const newVariants: FashionVariantItem[] = [];
    let idx = 1;

    colorsToUse.forEach((col) => {
      selectedSizes.forEach((sz) => {
        // Look up if this variant already exists to preserve stock / sku / barcode
        const existing = variants.find((v) => v.size === sz && v.color === col);
        if (existing) {
          newVariants.push(existing);
        } else {
          newVariants.push({
            size: sz,
            color: col,
            stock: Number(bulkStockVal) || 0,
            sku: generateSku(parentSku, parentName, col, sz),
            barcode: generateBarcode(idx++),
            price: basePrice || undefined,
          });
        }
      });
    });

    onChange(newVariants);
    setActiveView('matrix');
  }

  // Update a single variant cell in matrix
  function updateCellStock(size: string, color: string, stock: number) {
    const next = [...variants];
    const idx = next.findIndex((v) => v.size === size && v.color === color);
    if (idx >= 0) {
      next[idx] = { ...next[idx], stock: Math.max(0, stock) };
    } else {
      next.push({
        size,
        color,
        stock: Math.max(0, stock),
        sku: generateSku(parentSku, parentName, color, size),
        barcode: generateBarcode(next.length + 1),
        price: basePrice || undefined,
      });
    }
    onChange(next);
  }

  // Bulk set all cells in matrix
  function applyBulkStock() {
    const val = Number(bulkStockVal) || 0;
    const next = variants.map((v) => ({ ...v, stock: val }));
    onChange(next);
  }

  // Auto regenerate all SKUs and Barcodes
  function regenerateSkusAndBarcodes() {
    const next = variants.map((v, i) => ({
      ...v,
      sku: generateSku(parentSku, parentName, v.color, v.size),
      barcode: v.barcode || generateBarcode(i + 1),
    }));
    onChange(next);
  }

  // Delete single variant
  function deleteVariant(index: number) {
    onChange(variants.filter((_, i) => i !== index));
  }

  // Total calculated stock
  const totalVariantStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  return (
    <div className="card shadow-sm border-0 mt-3" style={{ background: '#fdfcfe', border: '1px solid #e9d5ff', borderRadius: '12px' }}>
      <div className="card-header py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: '1.25rem' }}>👗</span>
          <div>
            <div className="fw-bold" style={{ fontSize: '0.95rem' }}>
              {isBn ? 'স্বয়ংক্রিয় সাইজ ও কালার ম্যাট্রিক্স গ্রিড (Size/Color SKU Matrix)' : 'Automated Size & Color Matrix SKU Generator'}
            </div>
            <div className="small text-white-50" style={{ fontSize: '0.75rem' }}>
              {isBn ? 'এক ক্লিকে সকল সাইজ ও রঙের কম্বিনেশন তৈরি এবং নিজস্ব SKU/বারকোড ম্যানেজমেন্ট' : '1-click combinatorial size/color grid with variant-level SKU, barcodes & stock.'}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-white text-dark px-2 py-1 fw-bold shadow-sm" style={{ fontSize: '0.8rem' }}>
            {isBn ? `মোট ভেরিয়েন্ট: ${variants.length} টি` : `Total Variants: ${variants.length}`}
          </span>
          <span className="badge bg-warning text-dark px-2 py-1 fw-bold shadow-sm" style={{ fontSize: '0.8rem' }}>
            {isBn ? `মোট স্টক: ${totalVariantStock} পিস` : `Total Stock: ${totalVariantStock} pcs`}
          </span>
        </div>
      </div>

      <div className="card-body p-3">
        {/* ── STEP 1: SIZE SELECTION ── */}
        <div className="mb-3 p-2 rounded" style={{ background: '#f5f3ff', border: '1px dashed #c084fc' }}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>
              1️⃣ {isBn ? 'সাইজ বেছে নিন (Quick Size Presets):' : 'Select Sizes (Presets & Custom):'}
            </span>
            <span className="badge bg-purple text-white px-2 py-0" style={{ background: '#7c3aed', fontSize: '0.72rem' }}>
              {selectedSizes.length} {isBn ? 'টি সাইজ নির্বাচিত' : 'sizes chosen'}
            </span>
          </div>

          {/* Quick preset buttons */}
          <div className="d-flex flex-wrap gap-1 mb-2">
            {PRESET_SIZE_GROUPS.map((grp) => {
              const allSelected = grp.sizes.every((s) => selectedSizes.includes(s));
              return (
                <button
                  key={grp.id}
                  type="button"
                  className={`btn btn-xs py-1 px-2 fw-medium ${allSelected ? 'btn-primary shadow-sm' : 'btn-outline-secondary'}`}
                  style={{
                    fontSize: '0.73rem',
                    background: allSelected ? '#7c3aed' : '#fff',
                    borderColor: allSelected ? '#6d28d9' : '#d1d5db',
                    color: allSelected ? '#fff' : '#374151',
                  }}
                  onClick={() => selectPresetGroup(grp.sizes)}
                >
                  {isBn ? grp.labelBn : grp.labelEn}
                </button>
              );
            })}
          </div>

          {/* Individual toggle chips */}
          <div className="d-flex flex-wrap gap-1 align-items-center mb-2">
            {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '40', '42', '44', 'Free Size'].map((sz) => {
              const isSel = selectedSizes.includes(sz);
              return (
                <button
                  key={sz}
                  type="button"
                  className={`btn btn-sm py-0 px-2 rounded-pill fw-bold ${isSel ? 'btn-primary' : 'btn-light border'}`}
                  style={{
                    fontSize: '0.75rem',
                    background: isSel ? '#7c3aed' : '#fff',
                    color: isSel ? '#fff' : '#4b5563',
                    borderColor: isSel ? '#6d28d9' : '#e5e7eb',
                  }}
                  onClick={() => toggleSize(sz)}
                >
                  {sz} {isSel && '✓'}
                </button>
              );
            })}
          </div>

          {/* Custom size input */}
          <div className="input-group input-group-sm" style={{ maxWidth: '320px' }}>
            <input
              type="text"
              className="form-control"
              placeholder={isBn ? '+ অন্য কোনো সাইজ লিখুন (যেমন: 48, Semi)...' : '+ Custom size (e.g. 48, Semi)...'}
              value={customSizeInput}
              onChange={(e) => setCustomSizeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomSize();
                }
              }}
            />
            <button type="button" className="btn btn-outline-primary fw-medium" onClick={addCustomSize}>
              {isBn ? '+ যোগ' : '+ Add'}
            </button>
          </div>
        </div>

        {/* ── STEP 2: COLOR SELECTION ── */}
        <div className="mb-3 p-2 rounded" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>
              2️⃣ {isBn ? 'রং বেছে নিন (Popular Color Palette):' : 'Select Colors (Palette & Custom):'}
            </span>
            <span className="badge bg-secondary px-2 py-0" style={{ fontSize: '0.72rem' }}>
              {selectedColors.length} {isBn ? 'টি রং নির্বাচিত' : 'colors chosen'}
            </span>
          </div>

          {/* Color palette swatches */}
          <div className="d-flex flex-wrap gap-1 align-items-center mb-2">
            {PRESET_COLORS.map((col) => {
              const isSel = selectedColors.includes(col.name);
              return (
                <button
                  key={col.name}
                  type="button"
                  className={`btn btn-sm py-1 px-2 rounded-pill d-flex align-items-center gap-1 fw-medium ${isSel ? 'border-2 border-primary shadow-sm' : 'border'}`}
                  style={{
                    fontSize: '0.75rem',
                    background: isSel ? '#ede9fe' : '#fff',
                    borderColor: isSel ? '#7c3aed' : '#e2e8f0',
                    color: isSel ? '#5b21b6' : '#334155',
                  }}
                  onClick={() => toggleColor(col.name)}
                >
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: col.hex,
                      border: '1px solid #94a3b8',
                      display: 'inline-block',
                    }}
                  />
                  <span>{isBn ? col.nameBn : col.name}</span>
                  {isSel && <span className="fw-bold">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Custom color input */}
          <div className="input-group input-group-sm" style={{ maxWidth: '320px' }}>
            <input
              type="text"
              className="form-control"
              placeholder={isBn ? '+ অন্য কোনো কালার লিখুন (যেমন: Off-White)...' : '+ Custom color (e.g. Off-White)...'}
              value={customColorInput}
              onChange={(e) => setCustomColorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomColor();
                }
              }}
            />
            <button type="button" className="btn btn-outline-secondary fw-medium" onClick={addCustomColor}>
              {isBn ? '+ যোগ' : '+ Add'}
            </button>
          </div>
        </div>

        {/* ── STEP 3: ACTION BAR TO GENERATE MATRIX ── */}
        <div className="p-2 mb-3 rounded d-flex flex-wrap align-items-center justify-content-between gap-2" style={{ background: '#f3e8ff', border: '1px solid #d8b4fe' }}>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm py-2 px-3 fw-bold text-white shadow-sm d-flex align-items-center gap-1"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}
              onClick={handleGenerateMatrix}
            >
              <span>⚡</span>
              <span>
                {variants.length > 0
                  ? isBn
                    ? 'ম্যাট্রিক্স গ্রিড রি-জেনারেট করুন'
                    : 'Re-generate Matrix Grid'
                  : isBn
                  ? 'ম্যাট্রিক্স গ্রিড তৈরি করুন (Generate)'
                  : 'Generate Matrix Grid'}
              </span>
            </button>

            <div className="d-flex align-items-center gap-1">
              <span className="small text-muted">{isBn ? 'সব ঘরে পরিমাণ:' : 'Bulk Stock:'}</span>
              <input
                type="number"
                min="0"
                className="form-control form-control-sm text-center"
                style={{ width: '70px' }}
                value={bulkStockVal}
                onChange={(e) => setBulkStockVal(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline-purple py-1 px-2"
                style={{ borderColor: '#7c3aed', color: '#7c3aed', background: '#fff' }}
                onClick={applyBulkStock}
                disabled={variants.length === 0}
              >
                {isBn ? 'সবগুলোতে দিন' : 'Apply All'}
              </button>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary py-1 px-2"
              onClick={regenerateSkusAndBarcodes}
              disabled={variants.length === 0}
              title={isBn ? 'প্যারেন্ট SKU অনুযায়ী নতুন ভেরিয়েন্ট SKU আপডেট করুন' : 'Refresh SKUs/Barcodes'}
            >
              🏷️ {isBn ? 'SKU/বারকোড রিফ্রেশ' : 'Sync SKUs'}
            </button>

            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn btn-xs py-1 px-2 ${activeView === 'matrix' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ background: activeView === 'matrix' ? '#7c3aed' : '#fff', color: activeView === 'matrix' ? '#fff' : '#374151' }}
                onClick={() => setActiveView('matrix')}
              >
                ▦ {isBn ? '২D গ্রিড' : '2D Grid'}
              </button>
              <button
                type="button"
                className={`btn btn-xs py-1 px-2 ${activeView === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ background: activeView === 'table' ? '#7c3aed' : '#fff', color: activeView === 'table' ? '#fff' : '#374151' }}
                onClick={() => setActiveView('table')}
              >
                ≡ {isBn ? 'ডিটেইলড তালিকা' : 'Table View'}
              </button>
            </div>
          </div>
        </div>

        {/* ── VIEW 1: 2D MATRIX GRID ── */}
        {activeView === 'matrix' && variants.length > 0 && (
          <div className="table-responsive mb-3 border rounded shadow-sm">
            <table className="table table-bordered table-sm align-middle text-center mb-0" style={{ background: '#fff' }}>
              <thead style={{ background: '#f8fafc', color: '#1e293b' }}>
                <tr>
                  <th style={{ width: '160px', background: '#f1f5f9', fontWeight: 600 }}>
                    {isBn ? 'রং / সাইজ' : 'Color \\ Size'}
                  </th>
                  {Array.from(new Set(variants.map((v) => v.size))).map((sz) => (
                    <th key={sz} style={{ minWidth: '95px', fontWeight: 600 }}>
                      <span className="badge bg-purple-subtle text-purple px-2 py-1" style={{ background: '#ede9fe', color: '#6d28d9', fontSize: '0.8rem' }}>
                        {sz}
                      </span>
                    </th>
                  ))}
                  <th style={{ width: '110px', background: '#f1f5f9', fontWeight: 600 }}>
                    {isBn ? 'রং অনুযায়ী স্টক' : 'Row Total'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(variants.map((v) => v.color))).map((col) => {
                  const preset = PRESET_COLORS.find((c) => c.name === col);
                  const rowVariants = variants.filter((v) => v.color === col);
                  const rowTotal = rowVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
                  const allSizes = Array.from(new Set(variants.map((v) => v.size)));

                  return (
                    <tr key={col}>
                      <td className="text-start ps-3 fw-medium" style={{ background: '#fafaf9' }}>
                        <div className="d-flex align-items-center gap-2">
                          <span
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              backgroundColor: preset?.hex || '#94a3b8',
                              border: '1px solid #cbd5e1',
                              display: 'inline-block',
                            }}
                          />
                          <span style={{ fontSize: '0.85rem' }}>{preset && isBn ? preset.nameBn : col}</span>
                        </div>
                      </td>

                      {allSizes.map((sz) => {
                        const variant = variants.find((v) => v.size === sz && v.color === col);
                        const stockVal = variant ? variant.stock : 0;
                        return (
                          <td key={sz} className="p-1">
                            <input
                              type="number"
                              min="0"
                              className="form-control form-control-sm text-center fw-bold"
                              style={{
                                borderColor: stockVal > 0 ? '#c084fc' : '#e2e8f0',
                                background: stockVal > 0 ? '#faf5ff' : '#fff',
                                color: stockVal > 0 ? '#581c87' : '#94a3b8',
                              }}
                              value={stockVal}
                              onChange={(e) => updateCellStock(sz, col, Number(e.target.value))}
                            />
                            {variant?.sku && (
                              <div className="text-muted text-truncate" style={{ fontSize: '0.62rem', maxWidth: '90px' }} title={variant.sku}>
                                {variant.sku}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="fw-bold text-primary" style={{ background: '#fafaf9', fontSize: '0.85rem' }}>
                        {rowTotal} {isBn ? 'পিস' : 'pcs'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── VIEW 2: DETAILED TABLE WITH SKU, BARCODE & PRICE ── */}
        {(activeView === 'table' || variants.length === 0) && (
          <div className="table-responsive border rounded shadow-sm mb-3">
            <table className="table table-sm table-hover align-middle mb-0" style={{ background: '#fff' }}>
              <thead style={{ background: '#f8fafc', color: '#334155' }}>
                <tr style={{ fontSize: '0.8rem' }}>
                  <th style={{ width: '40px' }}>#</th>
                  <th>{isBn ? 'সাইজ' : 'Size'}</th>
                  <th>{isBn ? 'রং (Color)' : 'Color'}</th>
                  <th>{isBn ? 'ভেরিয়েন্ট SKU' : 'Variant SKU'}</th>
                  <th>{isBn ? 'বারকোড (Barcode)' : 'Barcode'}</th>
                  <th style={{ width: '100px' }}>{isBn ? 'স্টক (Qty)' : 'Stock (Qty)'}</th>
                  <th style={{ width: '120px' }}>{isBn ? 'বিক্রয় মূল্য (ঐচ্ছিক)' : 'Price (Optional)'}</th>
                  <th style={{ width: '50px' }} className="text-center">{isBn ? 'মুছুন' : 'Del'}</th>
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      {isBn
                        ? 'কোনো ভেরিয়েন্ট তৈরি করা হয়নি। উপরের সাইজ ও কালার সিলেক্ট করে "ম্যাট্রিক্স গ্রিড তৈরি করুন" বাটনে ক্লিক করুন।'
                        : 'No variants created yet. Select sizes and colors above and click "Generate Matrix Grid".'}
                    </td>
                  </tr>
                ) : (
                  variants.map((v, i) => {
                    const preset = PRESET_COLORS.find((c) => c.name === v.color);
                    return (
                      <tr key={i} style={{ fontSize: '0.83rem' }}>
                        <td className="text-muted small">{i + 1}</td>
                        <td>
                          <span className="badge bg-purple-subtle text-purple fw-bold" style={{ background: '#ede9fe', color: '#6d28d9' }}>
                            {v.size}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-1">
                            <span
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: preset?.hex || '#94a3b8',
                                border: '1px solid #cbd5e1',
                                display: 'inline-block',
                              }}
                            />
                            <span>{preset && isBn ? preset.nameBn : v.color}</span>
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm font-monospace py-0"
                            style={{ fontSize: '0.75rem' }}
                            value={v.sku || ''}
                            onChange={(e) => {
                              const next = [...variants];
                              next[i] = { ...next[i], sku: e.target.value };
                              onChange(next);
                            }}
                            placeholder="SKU..."
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm font-monospace py-0"
                            style={{ fontSize: '0.75rem' }}
                            value={v.barcode || ''}
                            onChange={(e) => {
                              const next = [...variants];
                              next[i] = { ...next[i], barcode: e.target.value };
                              onChange(next);
                            }}
                            placeholder="Barcode..."
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm fw-bold text-center py-0"
                            value={v.stock}
                            onChange={(e) => {
                              const next = [...variants];
                              next[i] = { ...next[i], stock: Number(e.target.value) || 0 };
                              onChange(next);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control form-control-sm text-end py-0"
                            placeholder={basePrice ? String(basePrice) : '৳...'}
                            value={v.price || ''}
                            onChange={(e) => {
                              const next = [...variants];
                              next[i] = { ...next[i], price: e.target.value };
                              onChange(next);
                            }}
                          />
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-xs py-0 px-2"
                            onClick={() => deleteVariant(i)}
                            title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── MANUAL ADD SINGLE ROW ── */}
        <div className="d-flex align-items-center justify-content-between pt-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-purple d-flex align-items-center gap-1"
            style={{ borderColor: '#a855f7', color: '#7c3aed', background: '#fff' }}
            onClick={() => {
              onChange([
                ...variants,
                {
                  size: 'M',
                  color: 'Black',
                  stock: 1,
                  sku: generateSku(parentSku, parentName, 'Black', 'M'),
                  barcode: generateBarcode(variants.length + 1),
                  price: basePrice || undefined,
                },
              ]);
            }}
          >
            <span>+</span>
            <span>{isBn ? 'কাস্টম রো যোগ করুন' : '+ Add Custom Row'}</span>
          </button>

          {variants.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-link text-danger text-decoration-none"
              onClick={() => {
                if (confirm(isBn ? 'আপনি কি সব ভেরিয়েন্ট মুছে ফেলতে চান?' : 'Clear all variants?')) {
                  onChange([]);
                }
              }}
            >
              {isBn ? 'সব ভেরিয়েন্ট মুছুন' : 'Clear All'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

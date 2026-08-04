"use client";

const TUTORIALS = [
  { n: 1, title: "Getting started with StockWhisk", desc: "Set up your shop, add products, and make your first sale." },
  { n: 2, title: "Point of sale (POS)", desc: "Ring up sales, apply discounts, and take payments." },
  { n: 3, title: "Managing inventory", desc: "Track stock, set reorder levels, and record adjustments." },
  { n: 4, title: "Purchases & suppliers", desc: "Create purchase orders and receive stock." },
  { n: 5, title: "Reports & accounting", desc: "Understand profit, expenses, and financial position." },
];

export default function TutorialsPage() {
  return (
    <div className="vstack gap-3">
      <h1 className="h4 fw-bold text-brand mb-0">Video tutorials</h1>
      <div className="row g-3">
        {TUTORIALS.map((v) => (
          <div className="col-md-6 col-lg-4" key={v.n}>
            <div className="card shadow-sm h-100">
              <div
                className="d-flex align-items-center justify-content-center bg-brand text-white"
                style={{ aspectRatio: "16/9", borderTopLeftRadius: "var(--radius)", borderTopRightRadius: "var(--radius)" }}
              >
                <i className="bi bi-play-circle-fill" style={{ fontSize: "3rem" }}></i>
              </div>
              <div className="card-body">
                <div className="fw-semibold">
                  {v.n}. {v.title}
                </div>
                <div className="small text-secondary">{v.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

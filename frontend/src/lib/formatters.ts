export function formatProductName(product: any, isRepairShop: boolean = false): string {
  if (!product) return "";
  if (product.display_name && isRepairShop) return product.display_name;
  const rawName = (product.name || "").trim();
  if (!isRepairShop) return rawName;

  const brandName = (
    typeof product.brand === "object" && product.brand !== null
      ? product.brand.name
      : (product.brand_name || (product.brand_detail ? product.brand_detail.name : ""))
  ).trim();

  const categoryName = (
    typeof product.category === "object" && product.category !== null
      ? product.category.name
      : (product.category_name || (product.category_detail ? product.category_detail.name : ""))
  ).trim();

  const parts: string[] = [];
  if (brandName && !rawName.toLowerCase().includes(brandName.toLowerCase())) {
    parts.push(brandName);
  }
  parts.push(rawName);
  if (categoryName && !rawName.toLowerCase().includes(categoryName.toLowerCase())) {
    parts.push(categoryName);
  }

  return parts.join(" ").trim();
}

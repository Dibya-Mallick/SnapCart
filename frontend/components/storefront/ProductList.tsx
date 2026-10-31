"use client";

import { Plus } from "lucide-react";
import { Product, money, productEmoji } from "../../lib/api";

export function ProductList({ products, quantities, onAdd }: { products: Product[]; quantities: Record<number, number>; onAdd: (product: Product) => void }) {
  const categories = [...new Set(products.map((product) => product.category))];
  return <div className="product-list">{categories.map((category) => {
    const items = products.filter((product) => product.category === category);
    return <section key={category}><div className="category-heading"><span>{category}</span><small>{items.length} items</small></div><div className="product-grid">{items.map((product) => {
      const inCart = quantities[product.id] || 0;
      return <article className={`product-card${inCart ? " in-cart" : ""}`} key={product.id}><div className="product-art" aria-hidden="true">{productEmoji(product)}</div><div className="product-info"><h3>{product.name}</h3><p>{product.description}</p><div className="tag-list">{product.dietary_tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><div className="product-buy"><strong>{money(product.price_minor, product.currency)}</strong><button className="small-button" onClick={() => onAdd(product)} aria-label={`Add ${product.name} to cart`}>{inCart ? <>In cart · {inCart}</> : <><Plus size={12} /> Add</>}</button></div></div></article>;
    })}</div></section>;
  })}</div>;
}

export function ProductListSkeleton() {
  return <div className="product-grid">{[0, 1, 2, 3].map((key) => <div className="product-card skeleton-card" key={key}><div className="skeleton" style={{ width: 63, height: 63 }} /><div style={{ flex: 1 }}><div className="skeleton" style={{ width: "60%", height: 14 }} /><div className="skeleton" style={{ width: "90%", height: 10, marginTop: 10 }} /><div className="skeleton" style={{ width: "40%", height: 10, marginTop: 8 }} /></div></div>)}</div>;
}

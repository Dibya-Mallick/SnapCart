"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Product, money, productEmoji } from "../../lib/api";

export function ProductList({ products, quantities, onAdd }: { products: Product[]; quantities: Record<number, number>; onAdd: (product: Product) => void }) {
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(products.map((product) => product.category))];
  const visible = category === "All" ? products : products.filter((product) => product.category === category);
  return <div className="product-list">
    <div className="category-chips" role="tablist" aria-label="Menu categories">{categories.map((name) => <button key={name} role="tab" aria-selected={category === name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}<span>{name === "All" ? products.length : products.filter((product) => product.category === name).length}</span></button>)}</div>
    <div className="product-grid">{visible.map((product) => {
      const inCart = quantities[product.id] || 0;
      return <article className={`product-card${inCart ? " in-cart" : ""}`} key={product.id}><div className="product-art" aria-hidden="true">{productEmoji(product)}</div><div className="product-info"><span className="product-category">{product.category}</span><h3>{product.name}</h3><p>{product.description}</p><div className="tag-list">{product.dietary_tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><div className="product-buy"><strong>{money(product.price_minor, product.currency)}</strong><button className="small-button" onClick={() => onAdd(product)} aria-label={`Add ${product.name} to cart`}>{inCart ? <>In cart · {inCart}</> : <><Plus size={13} /> Add</>}</button></div></div></article>;
    })}</div>
  </div>;
}

export function ProductListSkeleton() {
  return <div className="product-grid">{[0, 1, 2, 3].map((key) => <div className="product-card skeleton-card" key={key}><div className="skeleton" style={{ width: 76, height: 76 }} /><div style={{ flex: 1 }}><div className="skeleton" style={{ width: "60%", height: 16 }} /><div className="skeleton" style={{ width: "90%", height: 12, marginTop: 10 }} /><div className="skeleton" style={{ width: "40%", height: 12, marginTop: 8 }} /></div></div>)}</div>;
}

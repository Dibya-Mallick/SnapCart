"use client";

import { Product, money } from "../../lib/api";

export function ProductList({ products, onAdd }: { products: Product[]; onAdd: (product: Product) => void }) {
  const categories = [...new Set(products.map((product) => product.category))];
  return <div className="product-list">{categories.map((category) => <section key={category}><div className="category-heading"><span>{category}</span><small>{products.filter((p) => p.category === category).length} items</small></div><div className="product-grid">{products.filter((product) => product.category === category).map((product) => <article className="product-card" key={product.id}><div className="product-art">{product.category === "Drinks" ? "🥭" : product.category === "Mains" ? "🌯" : "🥟"}</div><div className="product-info"><h3>{product.name}</h3><p>{product.description}</p><div className="tag-list">{product.dietary_tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><div className="product-buy"><strong>{money(product.price_minor, product.currency)}</strong><button className="small-button" onClick={() => onAdd(product)}>Add</button></div></div></article>)}</div></section>)}</div>;
}

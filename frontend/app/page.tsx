import { ArrowRight, Bot, Camera, Check, CircleDollarSign } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";

const features = [
  { icon: Camera, title: "Snap your menu", text: "AI turns a menu photo into structured products and prices." },
  { icon: Check, title: "Review with confidence", text: "Fix anything ambiguous before your catalog goes live." },
  { icon: Bot, title: "Sell to people and agents", text: "A storefront and agent-ready ordering node in one place." },
];

export default function Home() {
  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="/" aria-label="SnapCart home">
          <span className="brand-mark"><BrandLogo size={34} /></span>
          <span>SnapCart</span>
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#payments">Payments</a>
          <a className="nav-button" href="/dashboard">Open dashboard <ArrowRight size={16} /></a>
        </div>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> Built for small businesses</div>
          <h1>From menu photo to <span>digital storefront.</span></h1>
          <p className="hero-text">Give your business a beautiful online presence and let customers shop with a click or with an AI assistant.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/dashboard/catalog/new">Try the demo <ArrowRight size={18} /></a>
            <a className="secondary-button" href="/store/rinas-stall">View sample store</a>
          </div>
          <div className="trust-row"><CircleDollarSign size={17} /> Secure checkout with PayPal Sandbox <span>·</span> Human-approved payments</div>
        </div>
        <div className="hero-visual" aria-label="Storefront preview">
          <div className="glow" />
          <div className="phone-card">
            <div className="phone-top"><span className="mini-logo">P</span><span className="live-pill">● Live store</span><span>•••</span></div>
            <div className="store-banner"><span>Rina&apos;s Stall</span><small>Fresh street food · Dhaka</small></div>
            <div className="menu-label">Today&apos;s favorites</div>
            <div className="product-row"><span className="food food-one">🥟</span><span><b>Veg samosa</b><small>Spiced potato &amp; peas</small></span><strong>$1.50</strong></div>
            <div className="product-row"><span className="food food-two">🥭</span><span><b>Mango lassi</b><small>Chilled and creamy</small></span><strong>$2.00</strong></div>
            <div className="product-row"><span className="food food-three">🍢</span><span><b>Chaat bites</b><small>Tangy · vegetarian</small></span><strong>$2.50</strong></div>
            <button className="paypal-button"><span>Pay</span><em>Pal</em> checkout <ArrowRight size={15} /></button>
          </div>
          <div className="agent-bubble"><span className="agent-icon"><Bot size={16} /></span><div><small>AI shopping assistant</small><b>“Find me two dairy-free snacks”</b></div><Check size={18} /></div>
        </div>
      </section>

      <section className="feature-section shell" id="how-it-works">
        <div className="section-heading"><p className="eyebrow">A simpler way to sell online</p><h2>Everything you need to get moving.</h2></div>
        <div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <article className="feature-card" key={title}><span className="feature-icon"><Icon size={20} /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="payment-strip shell" id="payments"><div><span className="payment-mark">P</span><b>Payments your customers already trust.</b><p>Explicit buyer approval. Server-verified capture. PayPal Sandbox ready.</p></div><a href="/dashboard">Get started <ArrowRight size={17} /></a></section>
      <footer className="shell footer"><span>© 2026 SnapCart</span><span>Built for micro-merchants · PayPal Sandbox demo</span></footer>
    </main>
  );
}


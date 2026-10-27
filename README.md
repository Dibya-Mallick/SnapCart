# Snap-a-Store

Snap-a-Store turns a menu photo into a reviewed catalog, a mobile storefront, and an agent-ready ordering node with PayPal Sandbox checkout.

## Repository layout

- `frontend/` — Next.js App Router UI, AG Grid review/order screens, storefront, and PayPal approval UI.
- `backend/` — FastAPI modular monolith containing API routes, models, schemas, services, and tests.
- `docs/` — project documentation and integration notes.

## Local setup

1. Copy `.env.example` to `.env` and fill in PayPal/AI credentials when using live integrations.
2. Start the backend:

   ```powershell
   cd backend
   .\.venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload --port 8000
   ```

3. Start the frontend in a second terminal:

   ```powershell
   cd frontend
   npm run dev
   ```

The frontend runs at `http://localhost:3000`; API docs are at `http://localhost:8000/docs`.

The initial scaffold uses a mock vision provider and SQLite so it can run without external credentials. PayPal Sandbox and a real vision provider can be enabled through environment variables as implementation proceeds.

## Implementation progress

The build is being completed one milestone at a time. Steps 1–4 are implemented currently. Agent orchestration and PayPal payment processing remain intentionally untouched.

| Step | Capability | Status |
|---|---|---|
| 1 | Menu upload and AI extraction | Complete |
| 2 | Catalog review and publishing | Complete |
| 3 | Public storefront APIs | Complete |
| 4 | Server-validated cart and pending orders | Complete |
| 5 | Shopping-agent tools and orchestration | Next |
| 6 | PayPal create, capture, and verification | Planned |

### Step 1 — Menu upload and AI extraction (complete)

The backend now exposes `POST /api/v1/catalog/extract`. It accepts a JPEG, PNG, or WebP menu image and:

1. validates the declared MIME type, file signature, upload size, and image dimensions;
2. stores the image under a UUID filename in `UPLOAD_DIRECTORY`;
3. creates an `AIExtraction` record with processing status;
4. runs the configured extraction boundary (the deterministic `mock` provider works without credentials);
5. validates the structured result with Pydantic;
6. converts decimal prices to integer minor units, such as `$1.50` → `150`;
7. converts unreadable or invalid prices to `null` and marks the draft product as needing review;
8. persists the extracted result and creates draft `Product` rows.

The endpoint does not publish a store or create orders. Publishing is handled by Step 2.

```mermaid
flowchart LR
    A[Menu image upload] --> B{Signature, MIME,
    size and dimensions valid?}
    B -- No --> C[Reject request]
    B -- Yes --> D[Save UUID image]
    D --> E[Create AIExtraction: processing]
    E --> F[Vision extraction boundary]
    F --> G[Pydantic schema validation]
    G --> H[Convert prices to minor units]
    H --> I[Create draft Product rows]
    I --> J[AIExtraction: completed]
    H --> K[Unreadable price:
    null + needs_review]
```

Example request:

```powershell
curl.exe -X POST http://localhost:8000/api/v1/catalog/extract `
  -F "file=@menu.png" `
  -F "store_slug=rinas-stall"
```

Important configuration values are documented in `.env.example`: `UPLOAD_DIRECTORY`, `MAX_UPLOAD_BYTES`, `VISION_PROVIDER`, and `VISION_MODEL`. The default provider is `mock`; a real provider should implement the extraction service boundary before changing `VISION_PROVIDER`.

Step 1 tests cover invalid image rejection and extraction-schema currency normalization. The full backend test suite can be run with:

```powershell
cd backend
pytest
```

### Step 2 — Catalog review and publishing (complete)

The merchant review workflow is now enforced by the backend. Extracted products can be edited through:

```text
GET   /api/v1/dashboard/catalog?store_slug=rinas-stall
PATCH /api/v1/dashboard/catalog/{product_id}?store_slug=rinas-stall
```

The update endpoint scopes the product lookup to the selected store. It accepts incomplete draft prices so an AI extraction can remain editable, but it automatically keeps `ai_needs_review=true` when the price is missing. Names and categories cannot be blank.

Publishing is explicit and server-validated:

```text
POST /api/v1/stores/{slug}/publish
POST /api/v1/stores/{slug}/unpublish
```

The publish operation refuses to change the store to `published` when:

- there are no active products;
- an active product has no positive integer price;
- an active product uses a currency different from the store currency; or
- an active product still has `ai_needs_review=true`.

The response includes the store status, active catalog count, and currency. A failed publish returns HTTP 422 with an itemized list of catalog problems for the review UI. Unpublishing returns the store to `draft` without deleting products.

```mermaid
flowchart TD
    A[Draft products from Step 1] --> B[Merchant edits catalog]
    B --> C[PATCH product]
    C --> D[Store-scoped validation]
    D --> E["POST /stores/{slug}/publish"]
    E --> F{All active rows valid
    and reviewed?}
    F -- No --> G[HTTP 422 with
    itemized errors]
    F -- Yes --> H[Store status: published]
    H --> I[Ready for next step:
    public storefront]
    H --> J[POST /unpublish]
    J --> K[Store status: draft]
```

Step 2 tests cover successful publishing, rejection of items needing review, positive-price validation, and store-scoped catalog updates. It does not create orders or process payments.

### Step 3 — Public storefront APIs (complete)

Published stores can now be read through public, database-backed endpoints:

```text
GET /api/v1/stores/{slug}
GET /api/v1/stores/{slug}/catalog
```

Both endpoints return HTTP 404 for draft or unknown stores, so an unpublished store is not exposed through the public API. The catalog endpoint returns only active products with a non-null price and exposes only storefront-safe fields: name, description, integer minor-unit price, currency, category, and dietary tags. Internal fields such as `source_text`, `ai_needs_review`, and database relationships are excluded.

The catalog is ordered by category and then product ID to keep storefront rendering deterministic. The API does not create orders or calculate cart totals; those behaviors are implemented in Step 4.

```mermaid
flowchart TD
    A["Customer requests /stores/{slug}"] --> B{Store exists and is published?}
    B -- No --> C[HTTP 404]
    B -- Yes --> D[Return public store metadata]
    D --> E["GET /stores/{slug}/catalog"]
    E --> F[Select active products with prices]
    F --> G[Remove internal review and source fields]
    G --> H[Return storefront-safe catalog]
```

Example requests:

```powershell
curl.exe http://localhost:8000/api/v1/stores/rinas-stall
curl.exe http://localhost:8000/api/v1/stores/rinas-stall/catalog
```

Step 3 tests verify published-store metadata, draft-store isolation, deterministic catalog output, and removal of internal product fields. Cart creation is implemented in Step 4; agent tools and PayPal remain intentionally unimplemented.

### Step 4 — Server-validated cart and pending orders (complete)

The backend now creates a local pending order from either the visual storefront (`web`) or a future shopping agent (`ai_agent`):

```text
POST /api/v1/orders
```

Request body:

```json
{
  "store_slug": "rinas-stall",
  "source": "web",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 2, "quantity": 1 }
  ]
}
```

The cart service only accepts products from a published store that are active and priced. It ignores any client-supplied total, reloads product prices from the database, calculates each line total and the subtotal in integer minor units, and creates an order with `status="pending"`. There are currently no taxes, discounts, shipping fees, or service fees, so `total_minor` equals `subtotal_minor`.

Each order stores an `OrderItem` with a product ID, quantity, line total, and name/price snapshots. Snapshots preserve the amount and display name that were used when the order was prepared, even if the catalog is edited later. Invalid or unavailable product IDs return HTTP 422 and do not create a usable order.

```mermaid
flowchart TD
    A[Web cart or future agent] --> B[POST /api/v1/orders]
    B --> C{Store is published?}
    C -- No --> D[HTTP 404]
    C -- Yes --> E[Load active products by store and ID]
    E --> F{Every product is available and priced?}
    F -- No --> G[HTTP 422 with unavailable IDs]
    F -- Yes --> H[Read prices from database]
    H --> I[Calculate integer line totals]
    I --> J[Create Order and OrderItem snapshots]
    J --> K[Return pending order receipt]
```

Step 4 tests cover web-cart totals, unavailable products, AI-agent order source tracking, and persisted name/price snapshots. This step prepares a local order only; it does not call an AI model, create a PayPal order, capture funds, or mark an order as paid.

## Hackathon integrations

- PayPal Agentic Commerce: `backend/app/services/shopping_agent_service.py`
- AG Grid: `frontend/components/catalog/CatalogReviewGrid.tsx` and `frontend/components/dashboard/OrdersLedgerGrid.tsx`
- APIMatic: `backend/app/services/paypal_service.py` and `docs/apimatic-integration.md`


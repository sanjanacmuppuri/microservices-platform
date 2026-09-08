# Microservices Platform with CI/CD, Monitoring, and API Gateway

A production-realistic microservices backend built from scratch: three independent services, each with its own database, automated tests, and CI/CD pipeline — unified behind an Nginx API gateway and observed with Prometheus and Grafana.

## Architecture

```
                              ┌──────────────┐
   localhost/auth/*    ──────►│              │──► auth-service (3000) ──► auth-db
   localhost/products/* ─────►│    Nginx     │──► products-service (3001) ──► products-db
   localhost/orders/*   ─────►│  (port 80)   │──► orders-service (3002) ──► orders-db
                              └──────────────┘

   Prometheus (9090) ──scrapes──► auth-service /metrics
   Grafana (3001*)    ──queries──► Prometheus ──► dashboard

   * Grafana's external port (3001) is separate from products-service's internal port
```

Each service:
- Owns its own Postgres database (no shared database between services — a core microservices principle)
- Is independently built, tested, and deployed via its own GitHub Actions pipeline
- Runs in its own Docker container, networked together via Docker Compose

## Services

### auth-service (port 3000 internally)
- `POST /register` — creates a user, hashes password with bcrypt
- `POST /login` — verifies credentials, issues a JWT (1 hour expiry)
- `GET /metrics` — Prometheus-compatible metrics endpoint
- `GET /health` — health check
- Database: `auth-db` (Postgres) — table: `users`

### products-service (port 3001 internally, 3002 externally)
- `POST /products` — create a product
- `GET /products` — list all products
- `GET /products/:id` — get one product
- `PUT /products/:id` — update a product (partial updates supported)
- `DELETE /products/:id` — delete a product
- `GET /health` — health check
- Database: `products-db` (Postgres) — table: `products`

### orders-service (port 3002 internally, 3003 externally)
- `POST /orders` — create an order (references a `product_id`)
- `GET /orders` — list all orders
- `GET /orders/:id` — get one order
- `PUT /orders/:id/status` — update order status
- `DELETE /orders/:id` — delete an order
- `GET /health` — health check
- Database: `orders-db` (Postgres) — table: `orders`

## Gateway: Nginx

All three services sit behind a single Nginx reverse proxy on port 80. Nginx strips the service prefix before forwarding:

| External URL | Forwarded to |
|---|---|
| `localhost/auth/*` | `auth-service:3000/*` |
| `localhost/products/*` | `products-service:3001/*` |
| `localhost/orders/*` | `orders-service:3002/*` |

This means the outside world only needs to know one address (`localhost`), and Nginx handles routing internally using Docker Compose's service-name-based networking.

## Monitoring: Prometheus + Grafana

- `auth-service` exposes a `/metrics` endpoint using `prom-client`, tracking a custom `http_requests_total` counter (labeled by method, route, and status code) plus default Node.js process metrics.
- Prometheus scrapes this endpoint every 5 seconds and stores the time-series data.
- Grafana connects to Prometheus as a data source and renders a live dashboard panel showing request volume over time.

## CI/CD

Each service has its own GitHub Actions workflow (`.github/workflows/`), triggered only when files inside that specific service's folder change (using `paths` filters). Each pipeline:

1. Checks out the code
2. Installs Node.js dependencies
3. Runs the service's Jest test suite
4. Logs into Docker Hub (using repository secrets)
5. Builds a Docker image
6. Pushes the image to Docker Hub

This means a broken test blocks the image from ever being built or published — the pipeline only pushes verified, working code.

## Testing

Each service has a `tests/` folder with Jest + Supertest tests that exercise the Express app directly (via `app.js`) without needing a real database connection — achieved by separating route/logic definitions (`app.js`) from the server startup code (`index.js`), so tests can import the app in isolation.

## Project structure

```
microservices-platform/
├── .github/workflows/
│   ├── auth-service-ci.yml
│   ├── products-service-ci.yml
│   └── orders-service-ci.yml
├── auth-service/
│   ├── app.js
│   ├── db.js
│   ├── index.js
│   ├── Dockerfile
│   ├── .dockerignore
│   └── tests/auth.test.js
├── products-service/
│   ├── app.js
│   ├── db.js
│   ├── index.js
│   ├── Dockerfile
│   ├── .dockerignore
│   └── tests/products.test.js
├── orders-service/
│   ├── app.js
│   ├── db.js
│   ├── index.js
│   ├── Dockerfile
│   ├── .dockerignore
│   └── tests/orders.test.js
├── nginx/
│   └── nginx.conf
├── prometheus/
│   └── prometheus.yml
├── docker-compose.yml
└── README.md
```

## Running the project

Requires Docker and Docker Compose.

```bash
docker compose up --build
```

This starts 8 containers: 3 services, 3 databases, Nginx, Prometheus, and Grafana. Databases use healthchecks (`pg_isready`) so dependent services wait until Postgres is genuinely ready to accept connections, not just started — avoiding race conditions on startup.

Once running:

| What | URL |
|---|---|
| Auth service (via gateway) | `http://localhost/auth/...` |
| Products service (via gateway) | `http://localhost/products/...` |
| Orders service (via gateway) | `http://localhost/orders/...` |
| Auth service (direct) | `http://localhost:3000` |
| Products service (direct) | `http://localhost:3002` |
| Orders service (direct) | `http://localhost:3003` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3001` (login: admin / admin) |

### Example requests (through the gateway)

```bash
# Register a user
curl -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"mypassword"}'

# Log in
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"mypassword"}'

# Create a product
curl -X POST http://localhost/products/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":49.99,"stock":25}'

# Create an order
curl -X POST http://localhost/orders/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":2}'
```

## Running tests locally

From any service folder:

```bash
cd auth-service   # or products-service / orders-service
npm install
npm test
```

## Key engineering decisions and lessons

- **Separate databases per service** — no service directly queries another service's database. Services reference each other only by ID (e.g., an order stores a `product_id`, not a join to the products table).
- **`app.js` / `index.js` separation** — routes and logic live in `app.js` (exported, no server started); `index.js` is a thin entry point that connects to the database and calls `.listen()`. This makes routes testable in isolation with Supertest.
- **`.dockerignore` with `node_modules`** — prevents host-machine-compiled native dependencies (like `bcrypt`'s compiled binary) from being copied into the Linux container, which previously caused an `Exec format error` due to CPU architecture mismatch between host and container.
- **Healthchecks over `depends_on` alone** — `depends_on` only waits for a container to *start*, not for the service inside it to be *ready*. Postgres healthchecks (`pg_isready -U <user> -d <db>`) ensure dependent services wait for a real, working database connection before attempting to connect.
- **Path-filtered CI/CD triggers** — each service's GitHub Actions workflow only runs when files inside that service's own folder change, avoiding wasted builds when unrelated services are updated.

## Possible extensions

- Add authentication middleware so `products-service` and `orders-service` verify JWTs issued by `auth-service`
- Add mocked/isolated database tests for full CRUD coverage (not just validation-layer tests)
- Add Grafana dashboards for `products-service` and `orders-service`, not just `auth-service`
- Move from Docker Compose to Kubernetes for multi-node scaling and self-healing
- Add rate limiting and request logging at the Nginx layer
- Add a `.env` file and `env_file` directive in Compose instead of inline environment variables, for cleaner secret management

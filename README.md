# Google Maps Business Scraper

Google Maps se business data scrape karo, Turso (LibSQL) mein store karo, aur Express REST API se serve karo.

## Features

- Puppeteer-based Google Maps scraping
- Website crawl se email extraction
- LinkedIn company search URL generation
- Turso cloud database storage
- On-demand scraping via API
- Search, filter, and pagination on results

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Browser Automation | Puppeteer |
| HTML Parsing | Cheerio |
| HTTP Requests | Axios |
| API Server | Express.js |
| Database | Turso (LibSQL) |
| DB Client | @libsql/client |

## Project Structure

```
google-maps-scraper/
├── src/
│   ├── scraper.js
│   ├── emailFinder.js
│   ├── linkedinFinder.js
│   └── utils.js
├── server/
│   ├── app.js
│   ├── routes/scraper.routes.js
│   └── controllers/scraper.controller.js
├── db/
│   ├── client.js
│   └── queries.js
├── config.js
├── index.js
└── package.json
```

## Turso Setup

```bash
# 1. Turso CLI install karo
curl -sSfL https://get.tur.so/dev/cli | bash

# 2. Login karo
turso auth login

# 3. Database banao
turso db create maps-scraper-db

# 4. URL aur token lo
turso db show maps-scraper-db --url
turso db tokens create maps-scraper-db

# 5. .env mein paste karo
```

## Setup & Run

```bash
# Install dependencies
npm install

# Create .env from example
cp .env.example .env
# Edit .env with your Turso credentials

# Start server
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/scrape` | Trigger scraping |
| GET | `/api/scrape/status` | Check scraping progress |
| GET | `/api/results` | List all results (with filters) |
| GET | `/api/results/:id` | Get single result |
| DELETE | `/api/results` | Clear all data |

### POST /api/scrape

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"query": "digital marketing agency Delhi", "maxResults": 10}'
```

### GET /api/results (with filters)

```bash
curl "http://localhost:3000/api/results?hasEmail=true&search=digital&page=1&limit=5"
```

## Scraped Data

Each business record includes:

- Business Name
- Address
- Phone
- Website
- Rating
- Emails (from website crawl)
- LinkedIn Search URL
- Google Maps URL

## Environment Variables

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `PORT` | Server port (default: 3000) |
| `DEFAULT_SEARCH_QUERY` | Default Maps search query |
| `DEFAULT_MAX_RESULTS` | Default max results (default: 10) |
| `HEADLESS` | Run browser headless (`true`/`false`) |

## Data Flow

```
POST /api/scrape → Puppeteer (Google Maps) → emailFinder + linkedinFinder → Turso DB → GET /api/results
```

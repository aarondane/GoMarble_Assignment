# Review Scraper

A web application that scrapes product reviews from various e-commerce websites using Playwright and Gemini , then displays them in a clean, organized interface.

## Project Flowchart

```mermaid
graph TD;
    A[Start Server 8000] --> B[User Requests /api/reviews]
    B --> C[URL Parameter Check]
    C -->|If missing| D[Return 400 Error URL required]
    C -->|If present| E[Launch Chromium Headless Mode]
    E --> F[Navigate to URL and Wait for Body Load]
    F --> G[Check and Close Popup if exists]
    G --> H[Review Selectors Cached?]
    H -->|Yes| I[Use Cached Selectors]
    H -->|No| J[Process HTML in Chunk]
    J --> K[Extract Selectors using Gemini api]
    K --> L[Extract Reviews from HTML]
    L --> M[Collect Enough Reviews?]
    M -->|Yes| N[Send Reviews]
    M -->|No| O[Next Page Button, Click, Wait]
    N --> P[End Process]
    O --> L
    D --> P
```

## Features

- Scrapes product reviews from any website
- Clean and responsive UI built with React and Tailwind CSS
- Real-time review fetching and display
- Configurable maximum review limit
- Star rating visualization
- Error handling and loading states

## Tech Stack

- **Frontend:**
  - React
  - Tailwind CSS
  - Vite

- **Backend:**
  - Node.js
  - Express
  - Playwright
  - CORS

## Prerequisites

- Node.js 14.x or higher
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Running the Application

1. Go into the backend folder, start the backend server :
```bash
node index.js
```

2. In a separate terminal, start the frontend development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## Usage

1. Open the application in your browser
2. Enter a product URL in the input field
3. Set the maximum number of reviews to fetch
4. Click "Get Reviews" to fetch and display the reviews
5. Reviews will be displayed with:
   - Reviewer name
   - Rating (in stars)
   - Review date
   - Review content

## API Endpoints

### GET /api/reviews

Fetches reviews from a specified URL.

**Parameters:**
- `url` (required): The product URL to scrape reviews from
- `maxReviews` (optional): Maximum number of reviews to fetch

**Response:**
```json
{
  "reviews_count": number,
  "reviews": [
    {
      "title": string,
      "body": string,
      "rating": number,
      "reviewer": string,
      "date": string
    }
  ]
}
```

## Error Handling

The application handles various error cases:
- Invalid URLs
- Network errors
- Timeout errors
- Missing review elements
- Server errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - feel free to use this project for any purpose.

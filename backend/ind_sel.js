import express from 'express';
import cors from 'cors';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });


const app = express();
app.use(cors());

// Helper function to chunk HTML
function chunkHtml(html, chunkSize = 20000) {
  const chunks = [];
  for (let i = 0; i < html.length; i += chunkSize) {
    chunks.push(html.slice(i, i + chunkSize));
  }
  return chunks;
}

// Helper function to filter chunks containing reviews
function filterChunksWithReviews(chunks) {
  return chunks.filter((chunk) => chunk.toLowerCase().includes('rating'));
}

// Helper function to log review details
function logReviewDetails(reviews) {
  console.log('\n=== Review Details ===\n');
  reviews.forEach((review, index) => {
    console.log(`Review #${index + 1}`);
    console.log('Reviewer:', review.reviewer);
    console.log('Rating:', '⭐'.repeat(Math.min(review.rating, 5)));
    console.log('Date:', review.date);
    console.log('Review:', review.body);
    console.log('-------------------\n');
  });
  console.log(`Total Reviews: ${reviews.length}\n`);
}


// Process HTML chunks to extract selectors
async function extractSelectors(reviewChunks) {
  let selectors = {};
  let selectorsFound = false;

  for (let i = 0; i < reviewChunks.length; i++) {
    if (selectorsFound) {
      console.log('All selectors found. Skipping remaining chunks.');
      break;
    }

    console.log(`Processing chunk ${i + 1} of ${reviewChunks.length}`);
    const prompt = `
      Analyze this HTML chunk and identify CSS selectors for review elements. 
      Return the CSS selectors only when you find multiple reviews with the same CSS selecors and you're sure of it.
      Focus on the following:
      - container: The outer container of the review element.
      - name: The selector for the reviewer name.
      - rating: The selector for the rating element (do not select inner-most if not necessary).
      - review: The selector for the review text.
      - date: The selector for the review date (inner-most).
      - nextPageSelector: The selector for the next page button (usually within a link or button with "next" in the class or aria-label).

      Please ensure that the selectors are consistent across all chunks. Only return valid CSS selectors. Format:
      {
        "container": ".selector",
        "name": ".selector",
        "rating": ".selector",
        "review": ".selector",
        "date": ".selector",
        "nextPageSelector": ".selector"
      }
      HTML Chunk:
    ${reviewChunks[i]}
    `;

    try {
      const result = await model.generateContent(prompt, { temperature: 0 });
      const response = result.response.text().trim();

      if (response) {
        const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
        console.log(`Model response for chunk ${i + 1}:`, jsonStr);

        try {
          const chunkSelectors = JSON.parse(jsonStr);

          if (chunkSelectors) {
            selectors = {
              container: chunkSelectors.container || selectors.container,
              name: chunkSelectors.name || selectors.name,
              rating: chunkSelectors.rating || selectors.rating,
              review: chunkSelectors.review || selectors.review,
              date: chunkSelectors.date || selectors.date,
              nextPageSelector: chunkSelectors.nextPageSelector || selectors.nextPageSelector,
            };
          }

          // Check if all selectors are populated
          selectorsFound = Object.values(selectors).every((selector) => !!selector);
          if (selectorsFound) {
            console.log('All required selectors found:', selectors);
          }
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
        }
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
    }
  }

  if (!selectorsFound) {
    console.warn('Failed to find all required selectors after processing all chunks.');
  }

  return selectors;
}


app.get('/api/reviews', async (req, res) => {
  const { url, numReviews = 5 } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const options = new chrome.Options();
  options.addArguments('--headless', '--disable-gpu', '--no-sandbox','--disable-dev-shm-usage','--disable-logging', '--mute-audio');

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  let allReviews = [];
  let selectors = null;

  try {
    console.log(`Scraping reviews from ${url}, aiming for ${numReviews} reviews.`);

    await driver.get(url);
    await driver.wait(until.elementLocated(By.css('body')), 10000);

    // Close popup if present
    const closePopupSelector = '.store-selection-popup--close';
    const popupCloseButton = await driver.findElements(By.css(closePopupSelector));
    if (popupCloseButton.length > 0) {
      console.log('Popup found, closing it...');
      await popupCloseButton[0].click();
      await driver.sleep(1000);
    } else {
      console.log('No popup found.');
    }

    while (allReviews.length < numReviews) {
      const fullHtml = await driver.executeScript('return document.documentElement.outerHTML');

      // Extract selectors if not already done
      if (!selectors) {
        const htmlChunks = chunkHtml(fullHtml);
        const reviewChunks = filterChunksWithReviews(htmlChunks);        
        reviewChunks.reverse(); // Process chunks from the end
        selectors = await extractSelectors(reviewChunks); // Assume this is unchanged

        if (!selectors.container) {
          await driver.quit();
          return res.status(404).json({ error: 'Review selectors not found.' });
        }
        console.log('Extracted selectors:', selectors);
        } 
        else {
        console.log('Reusing cached selectors:', selectors);
      }

      // Extract reviews using selectors
      const reviews = await driver.executeScript((selectors) => {
        const reviewElements = document.querySelectorAll(selectors.container);
        return Array.from(reviewElements).map((review) => {
          const nameElement = review.querySelector(selectors.name);
          const ratingElement = review.querySelector(selectors.rating);
          const reviewElement = review.querySelector(selectors.review);
          const dateElement = review.querySelector(selectors.date);

          let rating = 0;
          if (ratingElement) {
            const ariaLabel = ratingElement.getAttribute('aria-label');
            if (ariaLabel) {
              const match = ariaLabel.match(/(\d+)\s+star/);
              if (match) {
                rating = parseInt(match[1], 10);
              }
            }
            else {
              rating = 0;
            }
          }

          return {
            title: nameElement?.textContent?.trim() || '',
            body: reviewElement?.textContent?.trim() || '',
            rating: rating,
            reviewer: nameElement?.textContent?.trim() || '',
            date: dateElement?.textContent?.trim() || '',
          };
        });
      }, selectors);

      allReviews = [...allReviews, ...reviews];

      // Check if we have collected enough reviews
      if (allReviews.length >= numReviews) {
        console.log('Collected required number of reviews.');
        break;
      }

      // Navigate to the next page
      const nextPageButton = await driver.findElements(By.css(selectors.nextPageSelector));
      if (nextPageButton.length > 0) {
        console.log('Loading next page...');
        await nextPageButton[0].click();
        await driver.sleep(3000);
      } else {
        console.log('No next page found, stopping.');
        break;
      }
    }

    const filteredReviews = allReviews.slice(0, numReviews).filter((review) => review.title && review.body);

    logReviewDetails(filteredReviews);

    return res.json({
      reviews_numReviews: filteredReviews.length,
      reviews: filteredReviews,
    });
  } catch (error) {
    console.error('Exception occurred:', error);
    return res.status(500).json({ error: 'An error occurred while processing reviews.' });
  } finally {
    await driver.quit();
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(process.env.PORT, () => {
  console.log('Server running on port 8000');
});


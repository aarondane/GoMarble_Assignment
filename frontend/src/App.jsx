import { useState } from 'react';

function App() {
  const [url, setUrl] = useState('');
  const [numReviews, setNumReviews] = useState(); // Default to 5 reviews
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Convert numReviews to a number before passing to the API

      const response = await fetch(`http://18.212.94.61:8000/api/reviews?url=${encodeURIComponent(url)}&numReviews=${Number(numReviews)}`);

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reviews');
      }
      
      setReviews(data.reviews);
    } catch (err) {
      setError(err.message);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Review Scraper</h1>
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter product URL"
              required
              className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={numReviews}
              onChange={(e) => setNumReviews(e.target.value)}  // Ensure correct number input
              min="1"
              placeholder="Number of reviews"
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Get Reviews'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-6 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {reviews.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">
              Reviews ({reviews.length})
            </h2>
            {reviews.map((review, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{review.reviewer}</h3>
                    <div className="text-yellow-400 text-lg">
                      {'⭐'.repeat(review.rating)}
                    </div>
                  </div>
                  <span className="text-gray-500">{review.date}</span>
                </div>
                <p className="text-gray-700 whitespace-pre-line">{review.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

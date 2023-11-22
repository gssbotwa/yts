const express = require('express');
const ytSearch = require('yt-search');

const app = express();
const port = process.env.PORT || 3000;

app.get('/api', async (req, res) => {
  try {
    const searchQuery = req.query.search;

    if (!searchQuery && searchQuery !== '') {
      res.json({ error: 'Please provide a valid search query.' });
      return;
    }

    const searchResults = await performSearch(searchQuery);
    res.json(searchResults);
  } catch (error) {
    console.error(error);
    res.json({ error: 'Error processing request.' });
  }
});

async function performSearch(searchQuery) {
  try {
    if (!searchQuery || searchQuery.trim() === '') {
      throw new Error('Invalid search query.');
    }

    const { videos } = await ytSearch(searchQuery);

    // Extracting video title and URL from the search results
    const formattedResults = videos.slice(0, 10).map((video, i) => {
      return {
        title: video.title,
        url: video.url,
      };
    });

    return { type: 'search', data: formattedResults };
  } catch (error) {
    throw new Error('Error performing YouTube search.');
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

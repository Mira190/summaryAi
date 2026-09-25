import { useState } from "preact/hooks";

// Temporary fetch-based replacement for the former RTK Query endpoint.
// Replaced by services/summarizer.js + hooks/useSummary.js in the next commits.
const rapidApiKey = import.meta.env.VITE_RAPID_API_ARTICLE_KEY;

export const useLazyGetSummaryQuery = () => {
  const [state, setState] = useState({ error: null, isFetching: false });

  const getSummary = async ({ articleUrl }) => {
    setState({ error: null, isFetching: true });
    try {
      const res = await fetch(
        `https://article-extractor-and-summarizer.p.rapidapi.com/summarize?url=${encodeURIComponent(articleUrl)}&length=3`,
        {
          headers: {
            "X-RapidAPI-Key": rapidApiKey,
            "X-RapidAPI-Host": "article-extractor-and-summarizer.p.rapidapi.com",
          },
        }
      );
      const data = await res.json();
      if (!res.ok) throw { data };
      setState({ error: null, isFetching: false });
      return { data };
    } catch (error) {
      setState({ error, isFetching: false });
      return { error };
    }
  };

  return [getSummary, state];
};

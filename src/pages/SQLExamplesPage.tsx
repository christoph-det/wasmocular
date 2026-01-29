import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import { Link } from "react-router-dom";

const sqlExamples = [
  {
    title: "Additions by author (Stacked Area Chart)",
    description: "Shows the number of additions made by each author over time.",
    query: `SELECT authored_at AS date, author_signature AS series, additions AS value FROM commits`
  },
  {
    title: "Additions and deletions by author (Stacked Area Chart)",
    description:
      "Shows the number of additions and deletions made by each author over time in a diverging stacked area chart.",
    query: `SELECT authored_at AS date, author_signature || ' (additions)' AS series, CAST(additions AS INTEGER) AS value FROM commits
UNION ALL
SELECT authored_at AS date, author_signature || ' (deletions)' AS series, -CAST(deletions AS INTEGER) AS value FROM commits`
  },
  {
    title: "Commit count by author (Stacked Area Chart)",
    description:
      "Displays the number of commits made by each author over time.",
    query: `SELECT authored_at AS date, author_signature AS series, 1 AS value FROM commits`
  },
  {
    title: "Commits by Day of Week and Hour of Day (Heatmap)",
    description:
      "Visualizes the distribution of commits across different days of the week and hours of the day.",
    query: `SELECT 
    dayname(authored_at) as x, -- weekdays
    EXTRACT(HOUR FROM authored_at) as y, -- hour of day
    COUNT(sha) as value -- number of commits
FROM commits
GROUP BY 1,2, EXTRACT(DOW FROM authored_at)
ORDER BY y, EXTRACT(DOW FROM authored_at);`
  },
  {
    title: "Top 20 Words in Commit Messages (Text)",
    description:
      "Analyzes commit messages to find the most frequently used words. Source: DuckDB documentation.",
    query: `-- source: https://duckdb.org/docs/stable/guides/snippets/analyze_git_repository
WITH words AS (
    SELECT unnest(
        message
            .lower()
            .regexp_replace('\\W', ' ', 'g') -- Added 'g' for global replacement
            .trim()
            .string_split_regex('\\s+')      -- Split by whitespace
        ) AS word    
    FROM commits
)
SELECT word, count(*) AS count 
FROM words
-- Filter out empty strings and your specific black words here
WHERE word <> '' 
GROUP BY ALL
ORDER BY count DESC
LIMIT 10;`
  },
  {
    title: "Issues Opened / Closed Over Time (Stacked Area Chart)",
    description: "Shows the number of issues opened and closed over time.",
    query: `SELECT created_at AS date, author || '(opened)' AS series, 1 AS value FROM github_issues
UNION ALL
SELECT closed_at AS date, author || '(closed)' AS series, -1 AS value FROM github_issues WHERE closed_at IS NOT NULL`
  }
];

/**
 * Page displays example SQL queries for users to get started.
 */
const SQLExamplesPage = () => {
  return (
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <Link
            to="/explore-customquery?mode=manual"
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            Back to Custom Query
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">SQL Examples</h1>
        <p className="text-gray-600 mb-8">
          To help you get started with querying your data.
        </p>

        <div className="grid gap-6">
          {sqlExamples.map((example, index) => (
            <div key={index} className="bg-white rounded-md shadow-sm p-5">
              <h2 className="text-xl font-semibold mb-2">{example.title}</h2>
              <p className="text-gray-600 mb-3">{example.description}</p>
              <div className="relative">
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-md overflow-x-auto text-sm font-mono">
                  {example.query}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SQLExamplesPage;

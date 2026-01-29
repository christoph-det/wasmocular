import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import DatabaseSchemaSidebar from "@/components/DatabaseSchemaSidebar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useStores } from "@/store/StoreContext";
import { Spinner } from "@/components/ui/spinner";
import { EditorView, basicSetup } from "codemirror";
import { sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import CreateDashboardWidgetDialog from "@/components/CreateDashboardWidgetDialog";

// custom CodeMirror theme 
const customSQLTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#0f172a"
    },
    ".cm-content, .cm-gutters": {
      color: "#e2e8f0" // default text (affects punctuation that keeps the base color)
    },
    ".cm-activeLine": {
      backgroundColor: "transparent"
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent"
    },
    ".cm-content": {
      fontFamily: '"JetBrains Mono", Menlo, monospace',
      fontSize: "0.85rem",
      padding: "0.75rem"
    }
  },
  { dark: true }
);

// custom syntax highlighting for SQL in CodeMirror
const customSQLHighlighting = HighlightStyle.define([
  { tag: tags.keyword, color: "#7dd3fc", fontWeight: 600 },
  {
    tag: [tags.name, tags.variableName],
    color: "#c4b5fd"
  },
  { tag: tags.string, color: "#fbbf24" },
  { tag: tags.number, color: "#fb7185" },
  { tag: tags.operator, color: "#6ee7b7" },
  { tag: tags.comment, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.literal, color: "#f87171" },
  // make delimiters (semicolon, commas, parens) stand out
  { tag: [tags.punctuation, tags.separator], color: "#ffffff" }
]);

/**
 * Page component for exploring the database with SQL queries, tables and creating dashboard widgets.
 */
const ExplorePageCustomQuery = () => {
  const databaseStore = useStores().dbStore;

  const [searchParams] = useSearchParams();
  const [queryState, setQueryState] = useState({
    select: [] as string[],
    from: "" as string,
    limit: 100 as number
  });
  const [tablesAndColumns, setTablesAndColumns] = useState<
    Record<string, { column_name: string; data_type: string }[]>
  >({});
  const [queryResult, setQueryResult] = useState<Record<string, unknown>[]>([]);
  const [queryTime, setQueryTime] = useState<number | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualQueryMode, setManualQueryMode] = useState(
    searchParams.get("mode") === "manual"
  );
  const [manualSQLQuery, setManualSQLQuery] = useState(
    "-- Write your SQL query here"
  );


  const editorRef: React.MutableRefObject<HTMLDivElement | null> = useRef(null);
  const viewRef: React.MutableRefObject<EditorView | null> = useRef(null);
  const sqlDisplayRef: React.MutableRefObject<HTMLDivElement | null> =
    useRef(null);
  const sqlDisplayViewRef: React.MutableRefObject<EditorView | null> =
    useRef(null);

  // Exports the current query results to a CSV file and triggers a download.
  const handleExportCsv = () => {
    const headers = Object.keys(queryResult[0] ?? {});

    const csvRows: string[] = [];

    csvRows.push(headers.map((h) => `"${h}"`).join(","));

    queryResult.forEach((row) => {
      const values = Object.values(row);
      const csvRow = values
        .map((value) => {
          const strValue = value == null ? "" : JSON.stringify(value);
          return `"${strValue.replace(/"/g, '""')}"`;
        })
        .join(",");
      csvRows.push(csvRow);
    });

    const csvContent = csvRows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `query_results_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Executes the current SQL query in the database and updates the results state.
  const handleRunQuery = () => {
    setLoading(true);
    setQueryError(null);
    setQueryTime(null);
    const startTime = performance.now();
    const sqlToRun = manualQueryMode ? manualSQLQuery : buildSqlQueryString();
    databaseStore
      .runQuery(sqlToRun)
      .then((result) => {
        setQueryResult(result as Record<string, unknown>[]);
        setQueryTime(performance.now() - startTime);
        setLoading(false);
      })
      .catch((error: Error) => {
        console.error("Error running query:", error);
        setQueryError(error.message ?? "Unknown error");
        setLoading(false);
      });
  };

  // Puts together the SQL query string based on the current query state for both query builder and manual mode.
  const buildSqlQueryString = useCallback(() => {
    return `SELECT ${queryState.select.length > 0 ? queryState.select.join(", ") : "*"} FROM ${queryState.from} ${
      queryState.limit > 0 ? `LIMIT ${queryState.limit};` : ";"
    }`;
  }, [queryState]);

  const currentSqlQuery = manualQueryMode
    ? manualSQLQuery
    : buildSqlQueryString();

  useEffect(() => {
    databaseStore
      .getTableAndColumnNames()
      .then((result) => {
        setTablesAndColumns(result);
      })
      .catch((error: Error) => {
        console.error("Error fetching tables and columns:", error);
      });
  }, [databaseStore.tablesAndColumns, databaseStore]);

  // Initialize CodeMirror editor for manual SQL query mode
  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const view = new EditorView({
        doc: manualSQLQuery,
        extensions: [
          basicSetup,
          sql(),
          customSQLTheme,
          syntaxHighlighting(customSQLHighlighting),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const value = update.state.doc.toString();
              setManualSQLQuery(value);
            }
          })
        ],
        parent: editorRef.current
      });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- manualSQLQuery intentionally excluded; editor only needs initial value
  }, [manualQueryMode]);

  // setup CodeMirror view to display generated SQL query
  useEffect(() => {
    if (sqlDisplayRef.current) {
      const view = new EditorView({
        doc: buildSqlQueryString(),
        extensions: [
          basicSetup,
          sql(),
          customSQLTheme,
          syntaxHighlighting(customSQLHighlighting),
          EditorView.editable.of(false)
        ],
        parent: sqlDisplayRef.current
      });
      sqlDisplayViewRef.current = view;

      return () => {
        view.destroy();
        //sqlDisplayViewRef.current = null;
      };
    }
  }, [manualQueryMode, buildSqlQueryString]);

  return (
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="flex flex-col md:flex-row">
        <DatabaseSchemaSidebar />

        <div className="flex-1 min-w-0 p-4">
          <div className="mx-auto">
            <div className="mb-8">
              <div className="flex items-center mb-4 cursor-pointer">
                <h2
                  className={`text-2xl font-bold mb-4 mr-5 border-1 px-3 py-1 ${!manualQueryMode ? "bg-gray-600 text-white" : ""}`}
                  onClick={() => setManualQueryMode(false)}
                >
                  Query Builder
                </h2>
                <h2
                  className={`text-2xl font-bold mb-4 mr-5 border-1 px-3 py-1 ${manualQueryMode ? "bg-gray-600 text-white" : ""}`}
                  onClick={() => setManualQueryMode(true)}
                >
                  Manual Query Mode
                </h2>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-5 space-y-5">
                {manualQueryMode && (
                  <>
                    <p className="text-gray-600">
                      You have read access to the database. Refer to the{" "}
                      <a
                        href="https://duckdb.org/docs/stable/sql/introduction"
                        className="text-blue-600"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        DuckDB documentation
                      </a>{" "}
                      for more details about queries, or check out the{" "}
                      <Link
                        to="/sql-examples"
                        className="text-blue-600 hover:underline"
                      >
                        SQL Examples
                      </Link>{" "}
                      page to get started.
                    </p>
                    <div
                      ref={editorRef}
                      className="border border-gray-300 rounded-md"
                    ></div>
                  </>
                )}
                {!manualQueryMode && (
                  <div id="query-builder">
                    {/* SELECT */}
                    <div>
                      <label
                        htmlFor="select-fields"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        SELECT
                      </label>
                      <select
                        id="select-fields"
                        multiple
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={queryState.select}
                        onChange={(e) => {
                          const values = Array.from(
                            e.target.selectedOptions,
                            (option) => option.value
                          );
                          setQueryState({ ...queryState, select: values });
                        }}
                      >
                        {tablesAndColumns[queryState.from]?.map(
                          ({ column_name }) => (
                            <option key={column_name} value={column_name}>
                              {column_name}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {/* FROM */}
                    <div>
                      <label
                        htmlFor="from-table-select"
                        className="block text-sm font-medium text-gray-700 mt-3 mb-1"
                      >
                        FROM
                      </label>
                      <select
                        id="from-table-select"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={queryState.from}
                        onChange={(e) =>
                          setQueryState({ ...queryState, from: e.target.value })
                        }
                      >
                        <option value="">Select table...</option>
                        {Object.entries(tablesAndColumns).map(([tableName]) => (
                          <option key={tableName} value={tableName}>
                            {tableName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* LIMIT */}
                    <div>
                      <label
                        htmlFor="limit-input"
                        className="block text-sm font-medium text-gray-700 mt-3 mb-1"
                      >
                        LIMIT
                      </label>
                      <input
                        id="limit-input"
                        type="number"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={queryState.limit}
                        onChange={(e) =>
                          setQueryState({
                            ...queryState,
                            limit: parseInt(e.target.value) || 100
                          })
                        }
                      />
                    </div>

                    {/* Display SQL Query  CodeMirror*/}
                    <div
                      ref={sqlDisplayRef}
                      className="border border-gray-300 rounded-md mt-5"
                    ></div>
                  </div>
                )}
                <div className="flex justify-between space-x-4 mt-4">
                  <Button onClick={handleRunQuery}>
                    Run Query {loading && <Spinner />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold my-1 mx-2">Results</h2>
                <CreateDashboardWidgetDialog
                  sqlQuery={currentSqlQuery}
                  trigger={
                    <Button type="button" disabled={queryResult.length === 0}>
                      Create Dashboard Widget from Query
                    </Button>
                  }
                />
                <Button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={queryResult.length === 0}
                  variant="outline"
                >
                  Export to CSV
                </Button>
              </div>
              <br />
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-gray-500">
                  {loading ? (
                    <Spinner />
                  ) : (
                    `${queryResult.length} rows returned in ${queryTime ? queryTime.toFixed(2) : "0"} ms.`
                  )}
                </p>
                {queryError && (
                  <p className="text-red-600 font-medium mt-2">
                    Error: {queryError}
                  </p>
                )}
                <div className="mt-4">
                  {/* Table to display results */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto border-collapse border border-gray-200">
                      <thead>
                        <tr>
                          {queryResult.length > 0 &&
                            Object.keys(queryResult[0]).map((col) => (
                              <th
                                key={col}
                                className="border border-gray-300 px-4 py-2 bg-gray-100 text-left"
                              >
                                {col}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className={
                              rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            {Object.values(row).map((value, colIndex) => (
                              <td
                                key={colIndex}
                                className="border border-gray-300 px-4 py-2"
                              >
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorePageCustomQuery;

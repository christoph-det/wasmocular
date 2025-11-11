import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import DatabaseSchemaSidebar from "@/components/DatabaseSchemaSidebar";
import { DatabaseDataModel } from "@/store/database/DatabaseModel";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStores } from "@/store/StoreContext";
import { Spinner } from "@/components/ui/spinner";

const ExplorePageCustomQuery = () => {
  const [queryState, setQueryState] = useState({
    select: [] as string[],
    from: "" as string,
    limit: 100 as number
  });
  const [tablesAndColumns, setTablesAndColumns] = useState<
      Record<string, string[]>
  >({});
  const [queryResult, setQueryResult] = useState<any[]>([]);
  const [queryError , setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);


  const databaseStore = useStores().dbStore;

  const handleRunQuery = () => {
    setLoading(true);
    databaseStore.runQuery(
      `SELECT ${queryState.select.length > 0 ? queryState.select.join(", ") : "*"} FROM ${queryState.from} ${
        queryState.limit > 0 ? `LIMIT ${queryState.limit}` : ""}`
    ).then((result) => {
      console.log("Query result:", result);
      setQueryResult(result as any[]);
      setLoading(false);
    }).catch((error) => {
      console.error("Error running query:", error);
      setQueryError(error.message || "Unknown error");
      setLoading(false);
    });
  }

  useEffect(() => {
    databaseStore.listTablesAndColumns().then((result) => {
      const reducedByTable = result.reduce((acc, { table_name, column_name }) => {
        if (!acc[table_name]) {
          acc[table_name] = [];
        }
        acc[table_name].push(column_name);
        return acc;
      }, {} as Record<string, string[]>);
      setTablesAndColumns(reducedByTable);
    });
  }, []);

  return (
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="flex flex-col md:flex-row">
        <DatabaseSchemaSidebar />

        <div className="flex-1 p-4">
          <div className="mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-5">Query Builder</h2>

              <div className="bg-white rounded-lg shadow-sm p-5 space-y-5">
                {/* SELECT */}
                <div>
                  <label
                    htmlFor="select-fields"
                    className="block text-sm font-medium text-gray-700 mb-2"
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
                    {tablesAndColumns[queryState.from]?.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </div>

                {/* FROM */}
                <div>
                  <label
                    htmlFor="from-table-select"
                    className="block text-sm font-medium text-gray-700 mb-2"
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
                    className="block text-sm font-medium text-gray-700 mb-2"
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

                {/* SQL Query Display */}
                <div className="mt-6">
                  <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm">
                    <div className="text-gray-300">
                      <span className="text-blue-400 font-semibold">
                        SELECT
                      </span>{" "}
                      <span className="text-green-300">
                        {queryState.select.length > 0
                          ? queryState.select.join(", ")
                          : "*"}
                      </span>
                      <br />
                      <span className="text-blue-400 font-semibold">
                        FROM
                      </span>{" "}
                      <span className="text-yellow-300">
                        {queryState.from || "?"}
                      </span>
                      {queryState.limit > 0 && (
                        <>
                          <br />
                          <span className="text-blue-400 font-semibold">
                            LIMIT
                          </span>{" "}
                          <span className="text-purple-300">
                            {queryState.limit}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between space-x-4 mt-4">
                  <Button onClick={handleRunQuery}>Run Query {loading && <Spinner />}</Button>
                  <Button className="font-light">
                    (Todo) Switch to Manual Query mode
                  </Button>
                </div>
              </div>
            </div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Results</h2>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-gray-500">
                  {loading ? <Spinner /> : `${queryResult.length} rows returned.`}
                </p>
                {queryError && (
                  <p className="text-red-600 font-medium mt-2">
                    Error: {queryError}
                  </p>
                )}
                <p className="mt-4">
                  {/* Simple table to display results */}
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
                          <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>
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
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorePageCustomQuery;

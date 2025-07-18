import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import DatabaseSchemaSidebar from "@/components/DatabaseSchemaSidebar";
import { DatabaseDataModel } from "@/store/database/DatabaseModel";
import { useState } from "react";
import Button from "@/components/button/Button";

const ExplorePageCustomQuery = () => {
  const [queryState, setQueryState] = useState({
    select: [] as string[],
    from: "" as string,
    limit: 0 as number
  });

  const getAllFields = () => {
    return Object.entries(DatabaseDataModel).flatMap(([table, tableFields]) =>
      Object.entries(tableFields).map((field) => `${table}.${field[0]}`)
    );
  };

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
                    {getAllFields().map((field) => (
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
                    {Object.entries(DatabaseDataModel).map(
                      ([tableName, fields]) => (
                        <option key={tableName} value={tableName}>
                          {tableName}
                        </option>
                      )
                    )}
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
                        limit: parseInt(e.target.value) || 0
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
                <div className="flex justify-end">
                  <Button
                    secondary
                    text="(Todo) Switch to Manual Query mode"
                    className="font-light"
                  />
                </div>
                <Button text="Run Query" className="" />
              </div>
            </div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Results</h2>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-gray-500">
                  Query results will appear here...
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

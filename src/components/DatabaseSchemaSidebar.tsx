import { useStores } from "@/store/StoreContext";
import { useEffect, useState } from "react";
import { Spinner } from "./ui/spinner";
import { useToast } from "@/hooks/useToast";

const DatabaseSchemaSidebar = () => {
  const { showError } = useToast();
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tablesAndColumns, setTablesAndColumns] = useState<
    Record<string, { column_name: string; data_type: string }[]>
  >({});
  const databaseStore = useStores().dbStore;

  useEffect(() => {
    databaseStore
      .getTableAndColumnNames()
      .then((result) => {
        setTablesAndColumns(result);
      })
      .catch((error: Error) => {
        showError("Failed to load database schema: " + error.message);
      });
  });

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  return (
    <div className="w-full md:w-64 flex-shrink-0 bg-white shadow-md p-4 md:min-h-[calc(100vh-64px)]">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Data Schema</h2>
      <p className="text-sm text-gray-600 mb-5">
        Use this to explore the data model of the database and create your own
        queries.
      </p>
      <div className="space-y-2">
        {Object.keys(tablesAndColumns).length === 0 ? (
          <Spinner />
        ) : (
          Object.entries(tablesAndColumns).map(([table_name, column_name]) => (
            <div key={table_name} className="border border-gray-200">
              <button
                onClick={() => toggleTable(table_name)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 flex items-center justify-between"
              >
                <span className="font-medium text-gray-700">{table_name}</span>
                <span className="text-gray-400">
                  {expandedTables.has(table_name) ? "-" : "+"}
                </span>
              </button>
              {expandedTables.has(table_name) && (
                <div className="px-3 pb-2 border-t border-gray-100">
                  {column_name.map(({ column_name, data_type }) => (
                    <div
                      key={column_name}
                      className="py-1 text-sm flex justify-between"
                    >
                      <span className="text-gray-600">{column_name}</span>
                      <span className="text-gray-400">{data_type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DatabaseSchemaSidebar;

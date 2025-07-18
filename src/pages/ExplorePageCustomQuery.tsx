import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import { DatabaseDataModel } from "@/store/database/DatabaseModel";
import { useState } from "react";

const ExplorePageCustomQuery = () => {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

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
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-white shadow-md p-4 md:min-h-[calc(100vh-64px)]">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Data Schema
          </h2>
          <div className="space-y-2">
            {Object.entries(DatabaseDataModel).map(([tableName, fields]) => (
              <div key={tableName} className="border border-gray-200">
                <button
                  onClick={() => toggleTable(tableName)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 flex items-center justify-between"
                >
                  <span className="font-medium text-gray-700">{tableName}</span>
                  <span className="text-gray-400">
                    {expandedTables.has(tableName) ? "-" : "+"}
                  </span>
                </button>
                {expandedTables.has(tableName) && (
                  <div className="px-3 pb-2 border-t border-gray-100">
                    {Object.entries(fields).map(([fieldName, fieldType]) => (
                      <div
                        key={fieldName}
                        className="py-1 text-sm flex justify-between"
                      >
                        <span className="text-gray-600">{fieldName}</span>
                        <span className="text-gray-400 text-xs">
                          {fieldType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main view */}
        <div className="flex-1 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 text-center">CustomQuery</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorePageCustomQuery;

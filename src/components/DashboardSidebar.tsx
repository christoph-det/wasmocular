import { useState } from "react";
import { Button } from "./ui/button";
import { useStores } from "@/store/StoreContext";
import { useToast } from "@/hooks/useToast";

const DashboardSidebar = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const dashboardStore = useStores().dashboardStore;
  const { showSuccess } = useToast();

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // handle export dashboard action to json and download it
  const handleExportDashboard = () => {
    dashboardStore.exportActiveDashboard();
    showSuccess("Dashboard exported successfully!");
  };

  const handleImportDashboard = () => {
    if (
      confirm(
        "Importing a dashboard will overwrite your current dashboard. Do you want to continue?"
      )
    ) {
      // open file picker to select json file
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          const reader = new FileReader();
          reader.onload = (event: ProgressEvent<FileReader>) => {
            const jsonData = event.target?.result;
            if (typeof jsonData === "string") {
              dashboardStore.importDashboardFromJSON(jsonData);
              showSuccess("Dashboard imported successfully!");
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }
  };

  return (
    <div
      className={`bg-white shadow-md p-4 min-h-screen transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        {!sidebarCollapsed && (
          <h2 className="text-xl font-semibold text-gray-800">
            Dashboard Settings
          </h2>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-full hover:bg-gray-200"
        >
          {sidebarCollapsed ? (
            <img
              src="./icons/expand.svg"
              alt="Expand Sidebar"
              className="h-5 w-5"
            />
          ) : (
            <img
              src="./icons/collapse.svg"
              alt="Collapse Sidebar"
              className="h-5 w-5"
            />
          )}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="mt-4">
          <p className="text-gray-600">
            Use the options below to customize your dashboard view and data
            representation.
          </p>
          <p>TODO</p>
          {/* TODO: Implement actual settings controls here */}
          <p className="mt-4">Dashboard Actions:</p>
          <div className="flex">
            <Button onClick={handleExportDashboard} className="" variant="link">
              Export
            </Button>
            <Button onClick={handleImportDashboard} className="" variant="link">
              Import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardSidebar;

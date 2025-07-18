import { useState } from "react";

interface DashboardSidebarProps {
  children?: React.ReactNode;
}

const DashboardSidebar = ({ children }: DashboardSidebarProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
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
          {children || <div>{/* TODO: Dashboard overview */}</div>}
        </div>
      )}
    </div>
  );
};

export default DashboardSidebar;

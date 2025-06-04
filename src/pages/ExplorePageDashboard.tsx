import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import { useState } from "react";



const ExplorePageDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="flex">
        {/* Sidebar */}
        <div 
          className={`bg-white shadow-md p-4 min-h-screen transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? "w-16" : "w-64"
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            {!sidebarCollapsed && (
              <h2 className="text-xl font-semibold text-gray-800">Dashboard Settings</h2>
            )}
            <button 
              onClick={toggleSidebar}
              className="p-1 rounded-full hover:bg-gray-200"
            >
              {sidebarCollapsed ? (
                <img src="./icons/expand.svg" alt="Expand Sidebar" className="h-5 w-5" />
              ) : (
                <img src="./icons/collapse.svg" alt="Collapse Sidebar" className="h-5 w-5" />
              )}
            </button>
          </div>
          
          {!sidebarCollapsed && (
            <div className="mt-4">
              {/* TODO: Dashboard overview */}
            </div>
          )}
        </div>
        
        {/* Main view */}
        <div className="flex-1 p-6">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 text-center">Dashboard Content</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorePageDashboard;

import { useEffect, useState } from "react";

const ExploreNavigationBar = () => {

const [current, setCurrent] = useState(window.location.hash || "#/");

    useEffect(() => {
    const onHashChange = () => setCurrent(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

  return (
    <nav className="relative flex items-center h-15 bg-white/80 backdrop-blur shadow-sm">
      <div className="w-full flex justify-center">
        <div className="flex space-x-10 text-lg font-medium">
          <a
            href="#explore-customquery"
            className={`mx-4 transition-colors duration-150 hover:text-blue-700 hover:border-b focus:text-blue-900 ${
              current === "#explore-customquery" ? "border-b" : ""
            }`}
          >
            Custom Query
          </a>
          <a
            href="#explore-dashboard"
            className={`mx-4 transition-colors duration-150 hover:text-blue-700 hover:border-b focus:text-blue-900 ${
              current === "#explore-dashboard" ? "border-b" : ""
            }`}
          >
            Dashboard
          </a>
        </div>
      </div>
    </nav>
  );
};

export default ExploreNavigationBar;

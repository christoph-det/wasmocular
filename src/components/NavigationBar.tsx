import { useEffect, useState } from "react";

const NavigationBar = () => {
  const [current, setCurrent] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setCurrent(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <nav className="relative flex items-center p-4 bg-white/80 backdrop-blur border-b shadow-sm">
      <div className="absolute left-6 flex items-center">
        <img
          src="./plattform-logo.webp"
          alt="RepMiner Logo"
          className="w-8 h-8 drop-shadow"
        />
        <span className="ml-3 text-xl font-extrabold text-blue-700 tracking-wide select-none">
          RepMiner
        </span>
      </div>
      <div className="w-full flex justify-center">
        <div className="flex space-x-10 text-lg font-medium">
          <a
            href="#/"
            className={`px-4 py-2 rounded-lg transition-colors duration-150 hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-100 focus:text-blue-900 ${
              current === "#/" || current === ""
                ? "bg-blue-100 text-blue-900 shadow"
                : ""
            }`}
          >
            LOAD
          </a>
          <a
            href="#index"
            className={`px-4 py-2 rounded-lg transition-colors duration-150 hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-100 focus:text-blue-900 ${
              current === "#index" ? "bg-blue-100 text-blue-900 shadow" : ""
            }`}
          >
            INDEX
          </a>
          <a
            href="#explore"
            className={`px-4 py-2 rounded-lg transition-colors duration-150 hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-100 focus:text-blue-900 ${
              current === "#explore" ? "bg-blue-100 text-blue-900 shadow" : ""
            }`}
          >
            EXPLORE
          </a>
        </div>
      </div>
      <div className="absolute right-6 flex items-center">
        <span className="ml-3 text-xl text-black-700 tracking-wide select-none">
          My Project
        </span>
      </div>
    </nav>
  );
};
export default NavigationBar;

export function NavigationBarView() {
  return (
    <nav className="relative flex items-center p-4 border-b">
      {/* Logo and brand name positioned absolutely to the left */}
      <div className="absolute left-4 flex items-center">
        <img
          src="/plattform-logo.webp"
          alt="RepMiner Logo"
          className="w-6 h-6"
        />
        <span className="ml-2.5 font-bold">RepMiner</span>
      </div>

      {/* Navigation links centered in the entire navbar */}
      <div className="w-full flex justify-center">
        <div className="flex space-x-30 text-lg">
          <a href="#" className="hover:text-gray-500 py-2">
            LOAD
          </a>
          {/* Displays information about the repo */}
          <a href="#" className="hover:text-gray-500 py-2">
            INDEX
          </a>
          {/* Displays information about the analysis and graphs */}
          <a href="#" className="hover:text-gray-500 py-2">
            EXPLORE
          </a>
        </div>
      </div>
    </nav>
  );
}

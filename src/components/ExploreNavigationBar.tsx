const ExploreNavigationBar = () => {
  return (
    <nav className="relative flex items-center h-15 bg-white/80 backdrop-blur shadow-sm">
      <div className="w-full flex justify-center">
        <div className="flex space-x-10 text-lg font-medium">
          <a
            href="#/"
            className={`mx-4 transition-colors duration-150 hover:text-blue-700 hover:border-b focus:text-blue-900`}
          >
            Custom Query
          </a>
          <a
            href="#/"
            className={`mx-4 transition-colors duration-150 hover:text-blue-700 hover:border-b focus:text-blue-900`}
          >
            Dashboard
          </a>
        </div>
      </div>
    </nav>
  );
};

export default ExploreNavigationBar;

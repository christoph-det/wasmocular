import ExploreNavigationBar from "@/components/ExploreNavigationBar";

const ExplorePageCustomQuery = () => {
  return (
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-white shadow-md p-4 md:min-h-[calc(100vh-64px)]">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Schema</h2>
          {/* TODO: Schema overview */}
        </div>
        
        {/* Main content */}
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

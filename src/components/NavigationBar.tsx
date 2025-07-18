import { DataLoadingState } from "@/store/IndexingStore";
import { useStores } from "@/store/StoreContext";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const NavigationBar = observer(() => {
  const indexingStore = useStores().indexingStore;

  const [current, setCurrent] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setCurrent(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isRepoLoaded =
    indexingStore.dataLoadingState !== DataLoadingState.NOT_STARTED;

  const getIndexStatusIcon = (state: DataLoadingState) => {
    switch (state) {
      case DataLoadingState.INDEXING_STARTED:
        return "⏳";
      case DataLoadingState.INDEXING_FINISHED:
        return "✅";
      default:
        return "";
    }
  };

  const handleCreateNewProjectClick = () => {
    window.location.hash = "#";
    indexingStore.removeProject();
  };

  const handleSettingsClick = () => {
    window.location.hash = "#settings";
  };

  return (
    <nav className="flex items-center justify-between p-4 bg-white/80 backdrop-blur border-b shadow-sm">
      <div className="flex items-center w-1/4">
        <img
          src="./plattform-logo.webp"
          alt="RepMiner Logo"
          className="w-8 h-8 drop-shadow"
        />
        <span className="ml-3 text-xl font-extrabold text-blue-700 tracking-wide select-none">
          RepMiner
        </span>
      </div>
      <div className="flex justify-center w-2/4">
        <div className="flex space-x-10 text-lg font-medium">
          <a
            href={"#/"}
            onClick={(e) => isRepoLoaded && e.preventDefault()}
            className={`px-4 py-2 rounded-lg transition-colors duration-150 ${
              isRepoLoaded
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-100 focus:text-blue-900"
            } ${
              current === "#/" || current === ""
                ? "bg-blue-100 text-blue-900 shadow"
                : ""
            }`}
          >
            {isRepoLoaded ? "✅" : ""} LOAD
          </a>
          <img
            src="./icons/arrow-right-solid.svg"
            alt="Progress Arrow"
            className="h-4 w-4 self-center text-gray-500"
          />
          <a
            href="#index"
            onClick={(e) =>
              (indexingStore.dataLoadingState ==
                DataLoadingState.INDEXING_FINISHED ||
                !isRepoLoaded) &&
              e.preventDefault()
            }
            className={`px-4 py-2 rounded-lg transition-colors duration-150 ${
              indexingStore.dataLoadingState ==
                DataLoadingState.INDEXING_FINISHED || !isRepoLoaded
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-100 focus:text-blue-900"
            } ${
              current === "#index" ? "bg-blue-100 text-blue-900 shadow" : ""
            }`}
          >
            {getIndexStatusIcon(indexingStore.dataLoadingState)} INDEX
          </a>
          <img
            src="./icons/arrow-right-solid.svg"
            alt="Progress Arrow"
            className="h-4 w-4 self-center text-gray-500"
          />
          <a
            onClick={(e) =>
              indexingStore.dataLoadingState !==
                DataLoadingState.INDEXING_STARTED &&
              indexingStore.dataLoadingState !==
                DataLoadingState.INDEXING_FINISHED &&
              e.preventDefault()
            }
            href="#explore-dashboard"
            className={`px-4 py-2 rounded-lg transition-colors duration-150  ${
              indexingStore.dataLoadingState !==
                DataLoadingState.INDEXING_STARTED &&
              indexingStore.dataLoadingState !==
                DataLoadingState.INDEXING_FINISHED
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-100 focus:text-blue-900"
            } ${
              current === "#explore-dashboard" ||
              current === "#explore-customquery"
                ? "bg-blue-100 text-blue-900 shadow"
                : ""
            }`}
          >
            EXPLORE
          </a>
        </div>
      </div>
      <div className="flex justify-end w-1/4 pr-4">
        {indexingStore.project && (
          <DropdownMenu>
            <DropdownMenuTrigger className="max-w-[280px] truncate text-xl text-black-700 tracking-wide px-4 py-2 rounded-lg transition-colors cursor-pointer duration-150 hover:bg-blue-50 hover:text-blue-700">
              Project: {indexingStore.project?.name}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                {indexingStore.project?.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSettingsClick}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem>Load other project</DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreateNewProjectClick}>
                Create new Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
});
export default NavigationBar;

import { useEffect, useState, useRef, SetStateAction } from "react";
import Button from "../components/button/Button";
import init, { sum_rs } from "wasm-lib";
import { observer } from "mobx-react-lite";
import { useStores } from "../store/StoreContext";
import {
  DatabaseMessageType,
  DatabaseQueryMessage,
  DatabaseTerminateMessage
} from "../workers/dbWorker.types";
import { DataLoadingState } from "@/store/IndexingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// initialize rust code
init().catch((err) => {
  console.error("Error initializing Rust WASM module:", err);
});

const LoadPage = observer(() => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const sumStore = useStores().testStore;
  const dbStore = useStores().dbStore;
  const indexingStore = useStores().indexingStore;
  const [projectName, setProjectName] = useState<string>("");

  const handleprojectNameInputChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setProjectName(event.target.value);
  };

  useEffect(() => {
    const newWorker = new Worker(
      new URL("../workers/sumWorker.js", import.meta.url)
    );
    newWorker.onmessage = (event: MessageEvent) => {
      sumStore.setCalcSum(Number(event.data));
    };
    setWorker(newWorker);

    return () => {
      newWorker.terminate();
    };
  }, [sumStore]);

  return (
    <div className="p-10 pb-14 mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold mb-2 text-blue-900 drop-shadow">
            Welcome to <span className="text-blue-700">RepMiner</span>!
          </h1>
          <h2 className="text-xl mb-6 text-gray-700 font-medium">
            Start by selecting a repository to begin your analysis.
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="px-6 py-4 border-b bg-blue-50 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-blue-800">
              Local Repository
            </h3>
          </div>
          <div className="p-6">
            <p className="mb-6 text-gray-600">
              Select the folder containing your Git repository. Your data will
              remain on your device and will not be uploaded to any server.
            </p>
            <Label className="mb-2" htmlFor="text">
              Project Name:
            </Label>
            <Input
              type="text"
              onChange={handleprojectNameInputChange}
              hasError={projectName == "state::Error"}
            />
            <Label className="mt-8 mb-2" htmlFor="email">
              Select Repository Folder:
            </Label>
            {
              // TODO: add file picker functionality and error handling
            }
            <Input className="mb-8" type="file" id="repository" />
            <Button text={"Connect API Data (optional)"} secondary />
            <Button
              text={"Create Project"}
              onClick={clickCreateProject}
              center
              className="mt-8"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mt-5">
          <div className="px-6 py-4 border-b bg-blue-50 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-blue-800">Testing</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <Button text={"Test WASM"} onClick={() => clickButtonCB_WASM()} />
              <Button text={"Test JS"} onClick={() => clickButtonCB_JS()} />
              <Button text={"Reset"} onClick={() => resetCB()} />
              <Button text={"Test DuckDB"} onClick={() => testDuckDB()} />
              <Button text={"Read DuckDB"} onClick={() => readDuckDB()} />
              <Button
                text={"Disconnect DuckDB"}
                onClick={() => disconnectDuckDB()}
              />

              <Button
                text={"Export DuckDB"}
                onClick={handleExportDuckDBClick}
              />
            </div>
            <div className="mt-4">
              <div className="inline-block px-6 py-3 rounded-xl bg-blue-50 border border-blue-200 shadow text-blue-900 font-mono text-lg">
                <span className="font-semibold">Sum:</span> {sumStore.calc_sum}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function clickCreateProject() {
    // Get project name from input
    if (!projectName || projectName.trim() === "") {
      setProjectName("state::Error");
      alert("Please enter a project name.");
      return;
    }

    //navigate to index page
    window.location.hash = "#index";
    indexingStore.setDataLoadingState(DataLoadingState.REPOSITORY_LOADED);

    indexingStore.createNewProject(projectName);
  }

  function clickButtonCB_WASM() {
    const startTS = Date.now();
    sumStore.setCalcSum(sum_rs(1, 11));
    console.log("WASM Button clicked, time: ", Date.now() - startTS);
  }

  function clickButtonCB_JS() {
    if (worker) {
      worker.postMessage({ a: 1, b: 11 });
    }
  }

  function resetCB() {
    sumStore.setCalcSum(0);
  }

  function testDuckDB() {
    // Send queries to dbWorker instead of running directly
    for (let i = 0; i < 10000; i++) {
      const queryMessage: DatabaseQueryMessage = {
        type: DatabaseMessageType.QUERY,
        sql: "INSERT INTO people VALUES (1, 'Alice'), (2, 'Bob')",
        returnResult: false
      };
      dbStore.postMessage(queryMessage);
    }

    // Results will be logged in the dbWorker.onmessage handler
  }

  function readDuckDB() {
    const queryMessage: DatabaseQueryMessage = {
      type: DatabaseMessageType.QUERY,
      sql: "SELECT count(*) FROM people",
      returnResult: true
    };
    dbStore.postMessage(queryMessage);
  }

  function disconnectDuckDB() {
    const terminateMessage: DatabaseTerminateMessage = {
      type: DatabaseMessageType.TERMINATE
    };
    dbStore.postMessage(terminateMessage);
  }

  function handleExportDuckDBClick() {
    exportDuckDB().catch((error) => {
      console.error("Error exporting DuckDB:", error);
    });
  }

  async function exportDuckDB() {
    const opfsRoot = await navigator.storage.getDirectory();
    const fileHandle = await opfsRoot.getFileHandle("repminer_database.db");
    fileHandle
      .getFile()
      .then((file) => {
        const reader = new FileReader();
        reader.onload = function (event) {
          const arrayBuffer = event.target?.result;
          if (arrayBuffer) {
            const blob = new Blob([arrayBuffer], {
              type: "application/octet-stream"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "repminer_database.db";
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
          }
        };
        reader.readAsArrayBuffer(file);
      })
      .catch((error: Error) => {
        return Promise.reject(error);
      });
  }
});

export default LoadPage;

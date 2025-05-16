import { useEffect, useState } from "react";
import Button from "../components/button/Button";
import init, { sum_rs } from "wasm-lib";
import { observer } from "mobx-react-lite";
import { useStores } from "../store/StoreContext";

// initialize rust code
init();

const LoadPage = observer(() => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const sumStore = useStores().testStore;
  const dbStore = useStores().dbStore;

  useEffect(() => {
    const newWorker = new Worker(
      new URL("../containers/sumWorker.js", import.meta.url)
    );
    newWorker.onmessage = (event: MessageEvent) => {
      sumStore.setCalcSum(Number(event.data));
    };
    setWorker(newWorker);

    return () => {
      newWorker.terminate();
    };
  }, []);

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
            <h3 className="text-lg font-semibold text-blue-800">Local Repository</h3>
          </div>
          <div className="p-6">
            <p className="mb-6 text-gray-600">
              Select the folder containing your Git repository. Your data will
              remain on your device and will not be uploaded to any server.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <Button text={"Select Repository"} />
              <Button
                text={"Test WASM"}
                onClick={() => clickButtonCB_WASM()}
              />
              <Button
                text={"Test JS"}
                onClick={() => clickButtonCB_JS()}
              />
              <Button
                text={"Reset"}
                onClick={() => resetCB()}
              />
              <Button
                text={"Test DuckDB"}
                onClick={() => testDuckDB()}
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

  async function testDuckDB() {
    // Send queries to dbWorker instead of running directly
    for (let i = 0; i < 100; i++) {
      dbStore.postMessage({
        type: "query",
        sql: "INSERT INTO people VALUES (1, 'Alice'), (2, 'Bob')",
        returnResult: false
      });
    }
    dbStore.postMessage({
      type: "query",
      sql: "SELECT count(*) FROM people",
      returnResult: true
    });
    // Results will be logged in the dbWorker.onmessage handler
  }
});

export default LoadPage;

import { useState, useEffect } from "react";
import Button from "../components/button/Button";
import init, { sum_rs } from "wasm-lib";

const LoadPage = () => {
  const [ans, setAns] = useState(0);
  const [worker, setWorker] = useState<Worker | null>(null);

  useEffect(() => {
    init().then(() => {
      setAns(0);
    }).catch(console.error);
  }, [])

  useEffect(() => {
    const newWorker = new Worker(new URL('./sumWorker.js', import.meta.url));
    newWorker.onmessage = (event) => {
      setAns(event.data);
    };
    setWorker(newWorker);
    return () => {
      newWorker.terminate();
    };
  }, []);

  return (
    <div className="p-5 pb-14 my-10 mx-0">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Welcome to RepMiner!</h1>
        <h2 className="text-lg mb-6">
          Start by selecting a repository to start the process of analyzing.
        </h2>

        <div className="mt-5 p-3 rounded-xl shadow-md">
          <div className="px-4 py-2 border-b">
            <h3>Local Repository</h3>
          </div>
          <div className="p-4">
            <p className=" mb-4">
              Select the folder containing your Git repository. Your data will
              remain on your device and will not be uploaded to any server.
            </p>
            <Button text={"Select Repository"} />
            <br />
            <br />
            <Button text={"Test WASM"} onClick={() => clickButtonCB_WASM()} />
            <br />
            <br />
            <Button text={"Test JS"} onClick={() => clickButtonCB_JS()} />
            <br />
            <br />
            <Button text={"Reset"} onClick={() => resetCB()} />
            <p>Summe: {ans}</p>
          </div>
        </div>
      </div>
    </div>
  );

  function clickButtonCB_WASM() {
    const startTS = Date.now();
    setAns(sum_rs(1,11));
    console.log("WASM Button clicked, time: ", Date.now() - startTS);
  }

  function clickButtonCB_JS() {
    if (worker) {
      worker.postMessage({ a: 1, b: 11 });
    }
  }

  function resetCB() {
    setAns(0);
  }

}

export default LoadPage;
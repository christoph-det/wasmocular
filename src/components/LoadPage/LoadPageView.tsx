import { useEffect, useState } from "react";
import { Button } from "../button/ButtonPresenter";
import init, { add } from "wasm-lib";


export function LoadPageView() {
  const [ans, setAns] = useState(0);
  useEffect(() => {
    init()
      .then(() => {
        setAns(add(1, 1));
      })
      .catch(console.error);
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
            <Button text={"Test WASM"} />
            <p>1 + 1 = {ans}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

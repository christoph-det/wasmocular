import { useStores } from "@/store/StoreContext";
import { observer } from "mobx-react-lite";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Button from "@/components/button/Button";
import { useState } from "react";

const SettingsPage = observer(() => {
  const indexingStore = useStores().indexingStore;
  const [projectName, setProjectName] = useState<string>("");

  const handleprojectNameInputChange = (event: {
    target: { value: string };
  }) => {
    setProjectName(event.target.value);
  };

  const handleProjectNameSaveClick = () => {
    if (indexingStore.project) {
      indexingStore.changeProjectName(projectName);
      setProjectName(""); // Clear the input after saving
    } else {
      console.warn("No project loaded to change name");
    }
  };

  function handleExportDuckDBClick() {
    exportDuckDB().catch((error) => {
      console.error("Error exporting DuckDB:", error);
    });
  }

  function handleDeleteProjectClick() {
    throw new Error("Not implemented.");
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

  return (
    <div className="p-10 pb-14 mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold mb-2 text-blue-900 drop-shadow">
            Settings
          </h1>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="px-6 py-4 border-b bg-blue-50 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-blue-800">
              Settings for Project{" "}
              {indexingStore.project?.name ?? "No Project Loaded"}
            </h3>
          </div>
          <div className="p-6">
            <Label className="mb-2" htmlFor="text">
              Change Project Name:
            </Label>
            <Input
              type="text"
              onChange={handleprojectNameInputChange}
              value={projectName}
              placeholder={indexingStore.project?.name ?? ""}
            />
            <Button
              className="mt-2"
              onClick={handleProjectNameSaveClick}
              text={"Save"}
            />
            <br />
            <Button
              className="mt-8"
              onClick={handleExportDuckDBClick}
              text={"Export Database"}
            />
            <br />
            <Button
              className="mt-8"
              onClick={handleDeleteProjectClick}
              text={"Delete Project and Database"}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default SettingsPage;

import { useStores } from "@/store/StoreContext";
import { observer } from "mobx-react-lite";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Button from "@/components/button/Button";

const SettingsPage = observer(() => {
  const indexingStore = useStores().indexingStore;

  const handleprojectNameInputChange = (event: {
    target: { value: string };
  }) => {
    indexingStore.changeProjectName(event.target.value);
  };

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
              Settings for {indexingStore.project?.name || "No Project Loaded"}
            </h3>
          </div>
          <div className="p-6">
            <Label className="mb-2" htmlFor="text">
              Project Name:
            </Label>
            <Input
              type="text"
              onChange={handleprojectNameInputChange}
              defaultValue={indexingStore.project?.name || ""}
            />
            <Button text={"Save"} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default SettingsPage;

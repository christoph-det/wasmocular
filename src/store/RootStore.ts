import { DashboardStore } from "./DashboardStore";
import { DatabaseStore } from "./DatabaseStore";
import { IndexingStore } from "./IndexingStore";
import { WasmGitStore } from "./WasmGitStore";
import { WasmGixStore } from "./WasmGixStore";

export class RootStore {
  dbStore: DatabaseStore;
  indexingStore: IndexingStore;
  wasmGitStore: WasmGitStore;
  wasmGixStore: WasmGixStore;
  dashboardStore: DashboardStore;

  constructor() {
    this.dbStore = new DatabaseStore();
    this.indexingStore = new IndexingStore(this);
    this.wasmGitStore = new WasmGitStore();
    this.wasmGixStore = new WasmGixStore(this);
    this.dashboardStore = new DashboardStore();
  }
}

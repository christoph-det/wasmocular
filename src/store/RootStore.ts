import { DashboardStore } from "./DashboardStore";
import { DatabaseStore } from "./DatabaseStore";
import { GithubAPIStore } from "./GithubAPIStore";
import { IndexingStore } from "./IndexingStore";
import { WasmGitStore } from "./WasmGitStore";
import { WasmGixStore } from "./WasmGixStore";

export class RootStore {
  dbStore: DatabaseStore;
  indexingStore: IndexingStore;
  wasmGitStore: WasmGitStore;
  wasmGixStore: WasmGixStore;
  dashboardStore: DashboardStore;
  githubAPIStore: GithubAPIStore;

  constructor() {
    this.dbStore = new DatabaseStore();
    this.indexingStore = new IndexingStore(this);
    this.wasmGitStore = new WasmGitStore();
    this.wasmGixStore = new WasmGixStore(this);
    this.dashboardStore = new DashboardStore(this);
    this.githubAPIStore = new GithubAPIStore();
  }
}

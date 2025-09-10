import { DatabaseStore } from "./database/DatabaseStore";
import { IndexingStore } from "./IndexingStore";
import { TestStore } from "./TestStore";
import { WasmGitStore } from "./wasmgit/WasmGitStore";

export class RootStore {
  testStore: TestStore;
  dbStore: DatabaseStore;
  indexingStore: IndexingStore;
  wasmGitStore: WasmGitStore;

  constructor() {
    this.testStore = new TestStore(this);
    this.dbStore = new DatabaseStore();
    this.indexingStore = new IndexingStore(this);
    this.wasmGitStore = new WasmGitStore();
  }
}

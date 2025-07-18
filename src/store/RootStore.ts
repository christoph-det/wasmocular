import { DatabaseStore } from "./database/DatabaseStore";
import { IndexingStore } from "./IndexingStore";
import { TestStore } from "./TestStore";

export class RootStore {
  testStore: TestStore;
  dbStore: DatabaseStore;
  indexingStore: IndexingStore;

  constructor() {
    this.testStore = new TestStore(this);
    this.dbStore = new DatabaseStore();
    this.indexingStore = new IndexingStore(this);
  }
}

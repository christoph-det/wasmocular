import { DatabaseStore } from './DatabaseStore';
import { TestStore } from './TestStore';

export class RootStore {
    testStore: TestStore;
    dbStore: DatabaseStore;
  
    constructor() {
      this.testStore = new TestStore(this);
      this.dbStore = new DatabaseStore();
    }
  }
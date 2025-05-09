import { TestStore } from './TestStore';

export class RootStore {
    testStore: TestStore;
  
    constructor() {
      this.testStore = new TestStore(this);
    }
  }
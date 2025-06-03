import { makeAutoObservable } from "mobx";
import { RootStore } from "./RootStore";

export class IndexingStore {
  rootStore: RootStore;
  indexingProgress: number = 0; // Percentage of indexing progress

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  setIndexingProgress(progress: number) {
    this.indexingProgress = progress;
  }
}

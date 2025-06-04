import { makeAutoObservable } from "mobx";
import { RootStore } from "./RootStore";

export enum DataLoadingState {
    NOT_STARTED = "NOT_STARTED",
    REPOSITORY_LOADED = "REPOSITORY_LOADED",
    INDEXING_STARTED = "INDEXING_STARTED",
    INDEXING_FINISHED = "INDEXING_FINISHED",
}
export class IndexingStore {
  rootStore: RootStore;
  indexingProgress = 0; // Percentage of indexing progress
  dataLoadingState = DataLoadingState.NOT_STARTED; 

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  setIndexingProgress(progress: number) {
    this.indexingProgress = progress;
    if (progress >= 100) {
      this.dataLoadingState = DataLoadingState.INDEXING_FINISHED;
    } else if (this.dataLoadingState != DataLoadingState.INDEXING_STARTED && progress > 0) {
      this.dataLoadingState = DataLoadingState.INDEXING_STARTED;
    }
  }

  setDataLoadingState(state: DataLoadingState) {
    this.dataLoadingState = state;
  } 

}

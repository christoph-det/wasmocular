import { makeAutoObservable } from "mobx";
import { RootStore } from "./RootStore";

export class TestStore {
  rootStore: RootStore;
  calc_sum = 0;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  setCalcSum(val: number) {
    this.calc_sum = val;
  }
}

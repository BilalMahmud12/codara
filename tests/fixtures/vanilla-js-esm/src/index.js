import { add, subtract } from "./math.js";

export class Calculator {
  constructor(initial) {
    this.value = initial;
  }

  apply(operation, amount) {
    if (operation === "add") {
      this.value = add(this.value, amount);
    } else {
      this.value = subtract(this.value, amount);
    }
    return this.value;
  }
}

export const createCalculator = (initial) => new Calculator(initial);

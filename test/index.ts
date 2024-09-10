import { baseContext } from "./context";
// Test suites
import { functionalTestsContracts } from "./contracts";

baseContext("Functionnal tests", function () {
  functionalTestsContracts();
});

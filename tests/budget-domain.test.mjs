import assert from "node:assert/strict";
import test from "node:test";
import {
  allocatedQuantity,
  allocationTotal,
  matchDefinition,
  requirementTotal,
  safeSpreadsheetText,
  unallocatedQuantity,
} from "../app/budget-domain.mjs";

const posm = {
  quantity: 1200,
  unitPrice: 0,
  allocations: [
    { quantity: 600, unitPrice: 10, additionalCostEstimate: 500 },
    { quantity: 400, unitPrice: 11, additionalCostEstimate: 300 },
    { quantity: 200, unitPrice: 2, additionalCostEstimate: 0 },
  ],
};

test("POSM allocations replace the parent requirement total and reconcile quantity", () => {
  assert.equal(allocationTotal(posm.allocations), 11600);
  assert.equal(requirementTotal(posm), 11600);
  assert.equal(allocatedQuantity(posm.allocations), 1200);
  assert.equal(unallocatedQuantity(posm), 0);
  assert.equal(unallocatedQuantity({ ...posm, allocations: posm.allocations.slice(0, 2) }), 200);
});

test("legacy requirements still use quantity multiplied by unit price", () => {
  assert.equal(requirementTotal({ quantity: 10, unitPrice: 25, allocations: [] }), 250);
});

test("definition matching includes aliases and source wording", () => {
  const definition = { name: "Paper table-top stand", aliases: ["POSM stand"], sourceText: "A4 350 gsm" };
  assert.equal(matchDefinition(definition, "posm"), true);
  assert.equal(matchDefinition(definition, "350 gsm"), true);
  assert.equal(matchDefinition(definition, "warehouse"), false);
});

test("spreadsheet formula prefixes are neutralized", () => {
  for (const value of ["=SUM(A1:A2)", "+1", "-1", "@user"]) assert.equal(safeSpreadsheetText(value), `'${value}`);
  assert.equal(safeSpreadsheetText("001230"), "001230");
});

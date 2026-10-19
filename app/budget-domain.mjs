export function allocationSubtotal(allocation) {
  return Number(allocation.quantity || 0) * Number(allocation.unitPrice || 0) + Number(allocation.additionalCostEstimate || 0);
}

export function allocationTotal(allocations = []) {
  return allocations.reduce((total, allocation) => total + allocationSubtotal(allocation), 0);
}

export function allocatedQuantity(allocations = []) {
  return allocations.reduce((total, allocation) => total + Number(allocation.quantity || 0), 0);
}

export function requirementTotal(requirement) {
  const allocations = requirement.allocations || [];
  return allocations.length
    ? allocationTotal(allocations)
    : Number(requirement.quantity || 0) * Number(requirement.unitPrice || 0);
}

export function unallocatedQuantity(requirement) {
  return Math.max(0, Number(requirement.quantity || 0) - allocatedQuantity(requirement.allocations || []));
}

export function matchDefinition(definition, search) {
  const query = String(search || "").trim().toLowerCase();
  if (!query) return true;
  return [definition.name, definition.sourceText, ...(definition.aliases || [])]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

export function safeSpreadsheetText(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}


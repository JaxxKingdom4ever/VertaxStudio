import type { SemanticGraph } from "../../../packages/core-types/src/index.js";

export const whoIsCookingFood: SemanticGraph = {
  roots: ["cook-event"],
  objects: {
    "cook-event": {
      id: "cook-event",
      type: "Event",
      conceptId: "COOK",
      roles: { agent: ["unknown-person"], theme: ["food-entity"] },
      features: { values: { aspect: "continuous" } }
    },
    "unknown-person": {
      id: "unknown-person",
      type: "Unknown",
      conceptId: "PERSON",
      roles: {},
      features: { values: { expectedType: "Person" } }
    },
    "food-entity": {
      id: "food-entity",
      type: "Entity",
      conceptId: "FOOD",
      roles: {},
      features: { values: {} }
    }
  }
};

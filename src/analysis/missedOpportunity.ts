import { DEFAULT_MODEL_CONFIG } from "../config/model";

export function detectMissedOpportunity(previousOpponentEpLoss: number, playerEpLoss: number): boolean {
  return previousOpponentEpLoss >= DEFAULT_MODEL_CONFIG.miss.opportunityGain && playerEpLoss >= DEFAULT_MODEL_CONFIG.miss.opportunityGivenBack;
}

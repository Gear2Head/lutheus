import { RULES, PunishmentStep } from '../config/punishments';

export interface Infraction {
  id: string;
  ruleId: string;
  createdAt: Date;
}

/**
 * Calculates the punishment duration and unit based on the user's infraction history.
 * @param ruleId The ID of the rule broken (e.g. 'A1', 'B2', 'C5')
 * @param previousInfractions Array of the user's previous infractions
 * @returns The punishment step containing duration and unit
 */
export function calculatePunishmentDuration(ruleId: string, previousInfractions: Infraction[]): PunishmentStep | null {
  const rule = RULES[ruleId];
  if (!rule) {
    console.error(`Rule with ID ${ruleId} not found.`);
    return null;
  }

  // Count how many times this specific rule (or category, depending on logic) was broken.
  // Assuming escalation is per specific rule:
  const pastCount = previousInfractions.filter(inf => inf.ruleId === ruleId).length;

  const currentStepIndex = pastCount;
  
  // If the user has exceeded the defined steps, apply the final step (which is usually UNLIMITED)
  if (currentStepIndex >= rule.steps.length) {
    return rule.steps[rule.steps.length - 1];
  }

  return rule.steps[currentStepIndex];
}

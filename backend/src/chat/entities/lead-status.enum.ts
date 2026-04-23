/**
 * Qualification tier for a chat session treated as a sales lead.
 *
 * Progression is generally COLD → WARM → HOT → CLOSED, but the scoring
 * logic may jump straight to CLOSED (won or lost) from any earlier tier.
 */
export enum LeadStatus {
  COLD = 'cold',
  WARM = 'warm',
  HOT = 'hot',
  CLOSED = 'closed',
}

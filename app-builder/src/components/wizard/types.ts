/**
 * Which of the four wizard steps is showing: Prompt, Scope, Features, Review.
 *
 * This union used to be declared three times under three names —
 * `WizardStepIndex` in Wizard, `WizardStep` in Stepper, `ComingUpStep` in
 * ComingUp — so adding a fifth step meant remembering all three. The in-app
 * duplication check found it only after it started normalising identifiers the
 * way the cross-app check already did; under exact-match comparison the three
 * different names made the same declaration look like three different ones.
 */
export type WizardStepIndex = 1 | 2 | 3 | 4;

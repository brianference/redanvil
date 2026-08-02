import { z } from 'zod';
import { loadChecklistRows } from '../done/checklist.mjs';
import { DEFAULT_CHECKLIST_PATH } from '../gate/done';

/**
 * Row ids every PRD must answer, read from `docs/DONE-CHECKLIST.md`.
 *
 * Read rather than hardcoded for the same reason the gate reads it: a second
 * list is a list that drifts. Adding a row to the document immediately makes
 * every PRD that omits it invalid.
 */
export const REQUIRED_CHECKLIST_IDS: readonly string[] = loadChecklistRows(
  DEFAULT_CHECKLIST_PATH
).map((r) => r.id);

/**
 * How this specific app will satisfy one row of the definition of done.
 *
 * `plan` is prose and deliberately not scored — the gate decides whether the row
 * is met, not the PRD. What this buys is that the row cannot be *unconsidered*:
 * the builder is handed all forty requirements up front instead of discovering
 * them one gate failure at a time, which is how legal pages shipped at 81 words
 * against a prompt that asked for real content.
 */
export const ChecklistPlanSchema = z.object({
  id: z.string().regex(/^[A-G]\d{1,2}$/),
  plan: z.string().min(12)
});

export const PrdSchema = z
  .object({
    kind: z.literal('prd'),
    slug: z.string().min(2),
    title: z.string().min(2),
    summary: z.string().min(8),
    features: z.array(z.object({ name: z.string(), acceptance: z.string() })).min(1),
    pages: z.array(z.string()).min(1),
    testDesign: z.string().min(8),
    tokenEstimate: z.object({
      iterations: z.number().int().positive(),
      grokTokens: z.number().int().nonnegative(),
      claudeTokens: z.number().int().nonnegative(),
      confidence: z.enum(['low', 'medium', 'high'])
    }),
    initialPrompt: z.string().min(8),
    /**
     * One entry per row of the definition of done. Required, and completeness is
     * checked below — an optional field would be filled in for the easy rows and
     * left off the hard ones.
     */
    doneChecklist: z.array(ChecklistPlanSchema).min(1)
  })
  .superRefine((prd, ctx) => {
    const present = new Set(prd.doneChecklist.map((r) => r.id));
    const missing = REQUIRED_CHECKLIST_IDS.filter((id) => !present.has(id));
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['doneChecklist'],
        message: `missing a plan for definition-of-done row(s): ${missing.join(', ')}`
      });
    }
    const known = new Set(REQUIRED_CHECKLIST_IDS);
    const unknown = prd.doneChecklist.map((r) => r.id).filter((id) => !known.has(id));
    if (unknown.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['doneChecklist'],
        message: `plan references row(s) not in DONE-CHECKLIST.md: ${unknown.join(', ')}`
      });
    }
    const counts = new Map<string, number>();
    for (const r of prd.doneChecklist) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
    const dupes = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['doneChecklist'],
        message: `duplicate plan entries for row(s): ${dupes.join(', ')}`
      });
    }
  });

export type Prd = z.infer<typeof PrdSchema>;
export type ChecklistPlan = z.infer<typeof ChecklistPlanSchema>;

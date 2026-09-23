/**
 * Submit an n8n Wait-node form the way the browser does.
 *
 * Evidence, n8n 2.22.6 (tag n8n@2.22.6):
 * - packages/cli/templates/form-trigger.handlebars names each input `{{id}}`.
 *   prepareFormData sets that id to `field-${index}` (Form/utils/utils.ts).
 * - The submit handler builds `new FormData()` and `formData.append(filed.name, filed.value)`,
 *   then `fetch(postUrl, { method: 'POST', body: formData })`. Waiting forms
 *   post to `?signature=` + the signature already on $execution.resumeFormUrl
 *   (WAITING_TOKEN_QUERY_PARAM is `signature`, core constants.ts).
 * - prepareFormReturnItem requires `multipart/form-data`. addFormResponseDataToReturnItem
 *   reads `field-0`, `field-1`, ... and, for Wait typeVersion 1.1 (< 2.4), stores
 *   them under the field label (`Decision`, `Notes`).
 *
 * Notes are appended on the FormData body. They are never interpolated into a
 * command string.
 */

/** First form field. The generator's Decision dropdown is field 0. */
export const DECISION_FIELD = 'field-0';

/** Second form field. The generator's Notes textarea is field 1. */
export const NOTES_FIELD = 'field-1';

/**
 * POST the decision and notes to a resume URL.
 * @param {string} resumeUrl n8n form resume URL, including the signature query
 * @param {string} decision approve or redo
 * @param {string} notes free text, may be empty
 * @param {typeof fetch} [fetchImpl] injectable fetch for tests
 * @returns {Promise<{ status: number, ok: boolean }>}
 */
export async function submitGateForm(resumeUrl, decision, notes, fetchImpl = fetch) {
  const body = new FormData();
  body.append(DECISION_FIELD, decision);
  body.append(NOTES_FIELD, notes);
  const response = await fetchImpl(resumeUrl, { method: 'POST', body });
  return { status: response.status, ok: response.ok };
}

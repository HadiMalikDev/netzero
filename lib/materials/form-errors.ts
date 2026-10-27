/**
 * Why a Material Review form was not saved (QA finding 1). A save that fails
 * validation returns one of these codes instead of throwing, and the form
 * shows the message beside itself, keeping what was typed (see ActionForm).
 */

export const FORM_ERRORS = {
  smq_title: "Give the questionnaire a title.",
  smq_expiry: "Certificates expire after a whole number of years, from 1 to 50.",
  smq_boq: "The BOQ material cost must be a number above zero, e.g. 12,500,000.",
  type_name: "Give the material type a name.",
  row_text: "A row needs its required documents / parameters.",
  submittal_fields: "A submittal needs its reference and title.",
  product_name: "A product needs its name (the SMQ's Material Subject).",
  review_date: "A status needs its review date.",
  boq_qty: "Quantities must be numbers of zero or more, e.g. 1,250.5.",
  delivery: "A delivery needs its date and at least one quantity, as numbers of zero or more.",
  frozen: "This revision has been replaced by a newer one and can no longer be changed.",
} as const;

export type FormErrorCode = keyof typeof FORM_ERRORS;

/** A form action: redirects when saved, or returns why it was not. */
export type FormAction = (formData: FormData) => Promise<FormErrorCode | null>;

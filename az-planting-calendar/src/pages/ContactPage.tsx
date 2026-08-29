import { FormEvent, useState } from 'react';
import { FormStatus } from '../components/FormStatus';
import { LegalPage } from '../components/LegalPage';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import { sendContact } from '../lib/api';
import { fieldError } from '../lib/apiError';
import { formErrorMessage } from '../lib/authForm';
import '../components/Form.css';
import './ProsePage.css';

/** Contact — how to report sourced-data issues, plus the live contact form. */
export function ContactPage() {
  useDocumentMeta(en.meta.contactTitle, en.meta.contactDescription);
  return (
    <LegalPage
      title={en.contact.title}
      intro={en.contact.intro}
      updated={en.contact.updated}
      sections={en.contact.sections}
      after={<ContactForm />}
    />
  );
}

/**
 * POST /api/contact, including a visually hidden honeypot field.
 */
function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [nameErr, setNameErr] = useState<string | undefined>();
  const [emailErr, setEmailErr] = useState<string | undefined>();
  const [subjectErr, setSubjectErr] = useState<string | undefined>();
  const [messageErr, setMessageErr] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * POST the message. The honeypot `website` field is sent empty for real users.
   *
   * @param event - Form submit.
   */
  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    const nextName = trimmedName ? undefined : en.contact.nameRequired;
    const nextEmail = trimmedEmail ? undefined : en.contact.emailRequired;
    const nextSubject = trimmedSubject ? undefined : en.contact.subjectRequired;
    const nextMessage = trimmedMessage.length >= 10 ? undefined : en.contact.messageRequired;
    setNameErr(nextName);
    setEmailErr(nextEmail);
    setSubjectErr(nextSubject);
    setMessageErr(nextMessage);
    setFormError(null);
    setSuccess(null);
    if (nextName || nextEmail || nextSubject || nextMessage) return;

    setSubmitting(true);
    try {
      await sendContact({
        name: trimmedName,
        email: trimmedEmail,
        subject: trimmedSubject,
        message: trimmedMessage,
        website
      });
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setWebsite('');
      setSuccess(en.contact.success);
    } catch (err) {
      setNameErr(fieldError(err, 'name'));
      setEmailErr(fieldError(err, 'email'));
      setSubjectErr(fieldError(err, 'subject'));
      setMessageErr(fieldError(err, 'message'));
      setFormError(formErrorMessage(err, en.contact.error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
      data-testid="contact-form"
    >
      <p>{en.contact.formLead}</p>
      <div className="auth-form__field">
        <label className="auth-form__label" htmlFor="contact-name">
          {en.contact.fieldName}
        </label>
        <input
          className="auth-form__input"
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(nameErr)}
          aria-describedby={nameErr ? 'contact-name-error' : undefined}
          disabled={submitting}
        />
        {nameErr ? (
          <p id="contact-name-error" className="auth-form__error">
            {nameErr}
          </p>
        ) : null}
      </div>
      <div className="auth-form__field">
        <label className="auth-form__label" htmlFor="contact-email">
          {en.contact.fieldEmail}
        </label>
        <input
          className="auth-form__input"
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(emailErr)}
          aria-describedby={emailErr ? 'contact-email-error' : undefined}
          disabled={submitting}
        />
        {emailErr ? (
          <p id="contact-email-error" className="auth-form__error">
            {emailErr}
          </p>
        ) : null}
      </div>
      <div className="auth-form__field">
        <label className="auth-form__label" htmlFor="contact-subject">
          {en.contact.fieldSubject}
        </label>
        <input
          className="auth-form__input"
          id="contact-subject"
          name="subject"
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          aria-invalid={Boolean(subjectErr)}
          aria-describedby={subjectErr ? 'contact-subject-error' : undefined}
          disabled={submitting}
        />
        {subjectErr ? (
          <p id="contact-subject-error" className="auth-form__error">
            {subjectErr}
          </p>
        ) : null}
      </div>
      <div className="auth-form__field">
        <label className="auth-form__label" htmlFor="contact-message">
          {en.contact.fieldMessage}
        </label>
        <textarea
          className="auth-form__textarea"
          id="contact-message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={Boolean(messageErr)}
          aria-describedby={
            messageErr ? 'contact-message-hint contact-message-error' : 'contact-message-hint'
          }
          disabled={submitting}
          rows={6}
        />
        <p id="contact-message-hint" className="auth-form__hint">
          {en.contact.messageHint}
        </p>
        {messageErr ? (
          <p id="contact-message-error" className="auth-form__error">
            {messageErr}
          </p>
        ) : null}
      </div>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-website">{en.contact.fieldWebsite}</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>
      <FormStatus message={success} tone="success" />
      <FormStatus message={formError} tone="error" />
      <div className="auth-form__actions">
        <button type="submit" className="ui-btn ui-btn--primary" disabled={submitting}>
          {submitting ? en.contact.submitting : en.contact.submit}
        </button>
      </div>
    </form>
  );
}

import { sendEmail } from './emailService';
import { buildNewUserWelcomeEmail } from './newUserWelcomeEmailTemplate';

export interface SendWelcomeEmailParams {
  to: string;
  userName: string;
  temporaryPassword: string;
  confirmationLink: string;
}

type SendWelcomeEmailFn = (params: SendWelcomeEmailParams) => Promise<void>;

const defaultSendWelcomeEmail: SendWelcomeEmailFn = async ({
  to,
  userName,
  temporaryPassword,
  confirmationLink,
}: SendWelcomeEmailParams) => {
  const emailContent = buildNewUserWelcomeEmail({
    userName,
    temporaryPassword,
    confirmationLink,
  });

  await sendEmail({
    to,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
};

let sendWelcomeEmailImplementation: SendWelcomeEmailFn = defaultSendWelcomeEmail;

export const newUserWelcomeEmailService = {
  async sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<void> {
    await sendWelcomeEmailImplementation(params);
  },
};

export type NewUserWelcomeEmailService = typeof newUserWelcomeEmailService;

export const __setSendWelcomeEmailImplementationForTests = (
  fn: SendWelcomeEmailFn
) => {
  sendWelcomeEmailImplementation = fn;
};

export const __resetSendWelcomeEmailImplementationForTests = () => {
  sendWelcomeEmailImplementation = defaultSendWelcomeEmail;
};

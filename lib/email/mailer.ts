import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport(getEnv().SMTP_URL);
  }
  return transporter;
}

export type Email = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(email: Email): Promise<void> {
  await getTransporter().sendMail({
    from: getEnv().EMAIL_FROM,
    ...email,
  });
}

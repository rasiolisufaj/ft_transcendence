import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  connectionTimeout: 5000,
  socketTimeout: 5000,
});

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: "MesPapiers <no-reply@mespapiers.local>",
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error("mail send failed", subject, error);
  }
}
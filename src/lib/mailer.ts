import nodemailer, { type Transporter } from "nodemailer";
import type { IcsMethod } from "@/lib/ics";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  ics?: { method: IcsMethod; content: string };
}

/** Adresse d'expédition brute (sans nom affiché), utilisée comme ORGANIZER des invitations. */
export function senderAddress(): string {
  const from = process.env.MAIL_FROM ?? "reservations@sicaap.com";
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

let transporter: Transporter | null = null;

function smtp(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

/**
 * Envoie un e-mail. Avec MAIL_TRANSPORT=console (défaut), le message et
 * l'invitation .ics sont écrits dans les logs au lieu d'être envoyés.
 * Une erreur d'envoi ne bloque jamais la réservation : elle est journalisée.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const mode = process.env.MAIL_TRANSPORT ?? "console";
  try {
    if (mode === "smtp") {
      await smtp().sendMail({
        from: process.env.MAIL_FROM,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        icalEvent: mail.ics ? { method: mail.ics.method, content: mail.ics.content, filename: "invitation.ics" } : undefined,
      });
      return;
    }
    console.info(
      [
        "──────── E-MAIL (mode console, non envoyé) ────────",
        `À : ${mail.to}`,
        `Objet : ${mail.subject}`,
        "",
        mail.text,
        mail.ics ? `\n--- invitation.ics (${mail.ics.method}) ---\n${mail.ics.content}` : "",
        "───────────────────────────────────────────────────",
      ].join("\n"),
    );
  } catch (err) {
    console.error("Échec de l'envoi de l'e-mail à", mail.to, err);
  }
}

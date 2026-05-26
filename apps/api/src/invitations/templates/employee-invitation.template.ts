export interface InvitationEmailContext {
  restaurantName: string;
  inviterName: string;
  invitationLink: string;
  expiresInDays?: number;
}

export interface InvitationEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function buildInvitationEmailTemplate(ctx: InvitationEmailContext): InvitationEmailTemplate {
  const expiresInDays = ctx.expiresInDays ?? 7;

  const safeRestaurantName = escapeHtml(ctx.restaurantName);
  const safeInviterName = escapeHtml(ctx.inviterName);
  const safeInvitationLink = escapeAttribute(ctx.invitationLink);

  return {
    subject: buildInvitationEmailSubject(ctx),
    html: buildInvitationEmailHtml({
      restaurantName: safeRestaurantName,
      inviterName: safeInviterName,
      invitationLink: safeInvitationLink,
      expiresInDays,
    }),
    text: buildInvitationEmailText({
      restaurantName: ctx.restaurantName,
      inviterName: ctx.inviterName,
      invitationLink: ctx.invitationLink,
      expiresInDays,
    }),
  };
}

export function buildInvitationEmailSubject(ctx: InvitationEmailContext): string {
  return `[SmartTips] ${ctx.inviterName} vous invite à rejoindre ${ctx.restaurantName}`;
}

function buildInvitationEmailHtml(ctx: Required<InvitationEmailContext>): string {
  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invitation SmartTips</title>
      </head>

      <body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:32px 32px 16px 32px;">
                    <div style="font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">
                      SmartTips
                    </div>

                    <h1 style="margin:16px 0 12px 0;font-size:24px;line-height:1.3;color:#111827;">
                      Vous avez été invité à rejoindre ${ctx.restaurantName}
                    </h1>

                    <p style="margin:0;font-size:16px;line-height:1.6;color:#374151;">
                      ${ctx.inviterName} vous invite à créer votre compte employé SmartTips afin de consulter vos shifts, vos pourboires et vos informations personnelles.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px 32px;">
                    <a href="${ctx.invitationLink}"
                       style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-size:15px;font-weight:700;">
                      Accepter l’invitation
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 32px 24px 32px;">
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                      Ce lien est personnel, utilisable une seule fois et expire dans ${ctx.expiresInDays} jours.
                    </p>

                    <p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:#9ca3af;">
                      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :
                    </p>

                    <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;word-break:break-all;">
                      ${ctx.invitationLink}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                      Vous recevez cet email parce qu’un gestionnaire de ${ctx.restaurantName} vous a invité à rejoindre SmartTips.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildInvitationEmailText(ctx: Required<InvitationEmailContext>): string {
  return [
    `Vous avez été invité à rejoindre ${ctx.restaurantName} sur SmartTips.`,
    '',
    `${ctx.inviterName} vous invite à créer votre compte employé SmartTips.`,
    '',
    `Accepter l’invitation : ${ctx.invitationLink}`,
    '',
    `Ce lien est personnel, utilisable une seule fois et expire dans ${ctx.expiresInDays} jours.`,
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value: string): string {
  if (!value.startsWith('https://')) {
    throw new Error('error.email.invalidLink');
  }
  return escapeHtml(value);
}

export { buildInvitationEmailHtml, buildInvitationEmailText };

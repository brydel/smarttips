import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { buildInvitationEmailTemplate } from '../invitations/templates/employee-invitation.template';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));

    this.fromEmail = this.config.get<string>(
      'INVITATION_FROM_EMAIL',
      'SmartTips <noreply@smarttips.app>',
    );
  }

  async sendInvitationEmail(
    to: string,
    restaurantName: string,
    inviterName: string,
    invitationLink: string,
  ): Promise<void> {
    const template = buildInvitationEmailTemplate({
      restaurantName,
      inviterName,
      invitationLink,
      expiresInDays: 7,
    });

    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (error) {
      this.logger.error(`Failed to send invitation email to ${to}: ${error.message}`);

      throw new ServiceUnavailableException('error.email.sendFailed');
    }
  }
}

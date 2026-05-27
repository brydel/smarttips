import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  // AuthModule exporte JwtModule + PassportModule dont InvitationsService a besoin (JwtService)
  // EmailModule fournit EmailService pour l'envoi des magic links
  imports: [PrismaModule, EmailModule, AuthModule, AuditModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}

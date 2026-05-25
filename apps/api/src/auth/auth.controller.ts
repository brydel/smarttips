import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.signup(dto);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('error.auth.refresh_token.missing');
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
      user,
    } = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, newRefreshToken);
    return { accessToken, user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.clearRefreshCookie(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  // ─── Helpers privés sécurisés ─────────────────────────────────────

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/', // '/' garantit que le navigateur envoie le cookie sur toutes les routes
      // (middleware /dashboard, proxy /api/v1/auth/refresh, etc.)
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/', // doit être identique à setRefreshCookie — sinon clearCookie ne supprime rien
    });
  }
}

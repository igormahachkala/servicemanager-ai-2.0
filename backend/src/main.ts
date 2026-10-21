import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { RealtimeService } from './realtime/realtime.service';
import { createCorsOriginDelegate, parseCorsAllowedOrigins } from './config/cors';
import { getJwtSecret } from './config/required-env';

async function bootstrap() {
  // Fail fast before any network binding if required secrets are absent or weak.
  getJwtSecret();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  // Глобальная валидация DTO (enterprise baseline)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const allowedOrigins = parseCorsAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS || '');

  app.enableCors({
    origin: createCorsOriginDelegate(allowedOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // SMA-MOBILE-OFFLINE-INTEGRATION-113D: Idempotency-Key must be allowed here.
    //
    // 113B added the header on the server, but the browser never got to send
    // it: a request carrying a header absent from this list is blocked by the
    // preflight, and fetch fails with a bare "Failed to fetch". Every replayed
    // offline operation — comment, attachment, ticket from a round — failed
    // that way, while the one operation that sends no key went through. Found
    // by live Stage acceptance; the same gap is in Production, where nothing
    // has been sending the header yet.
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });

  const config = new DocumentBuilder()
    .setTitle('API Сервис Менеджер')
    .setDescription('Документация по серверному API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
      },
      'jwt',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  (document as any).security = [{ jwt: [] }];

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = Number(process.env.PORT) || 3000;
  const realtime = app.get(RealtimeService, { strict: false });
  realtime.attach(app.getHttpServer());

  // ВАЖНО: слушаем на всех интерфейсах, чтобы открывалось по IP (WSL/VM)
  await app.listen(port, '0.0.0.0');
}
bootstrap();

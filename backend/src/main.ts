import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { RealtimeService } from './realtime/realtime.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Глобальная валидация DTO (enterprise baseline)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const rawOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const allowedOrigins = new Set(rawOrigins);

  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header = curl / server-side request: allow
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  });

  const config = new DocumentBuilder()
    .setTitle('API ServiceManager.AI')
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

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Для Swagger UI и запросов из браузера
  app.enableCors({
    origin: true,
    credentials: true,
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

  // Ключевой фикс: помечаем API как "secured" глобально,
  // чтобы Swagger реально добавлял Authorization после Authorize.
  (document as any).security = [{ jwt: [] }];

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

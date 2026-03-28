import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as morgan from 'morgan';
import { AuthServiceModule } from './auth/auth-service.module';
import { commonAppBootstrap } from './common-setup';
import ConfigService from './config/config.service';
import { isBooleanStringTrue } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AuthServiceModule);
  app.enableShutdownHooks();
  commonAppBootstrap(app);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get('NODE_ENV');

  if (nodeEnv === 'development') {
    const config = new DocumentBuilder()
      .setTitle('CabbageMeet – Auth Service')
      .setDescription('Auth microservice API')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup('swagger', app, SwaggerModule.createDocument(app, config));
  }

  if (isBooleanStringTrue(configService.get('ENABLE_CORS'))) {
    app.enableCors({
      origin: [
        new URL(configService.get('PUBLIC_URL')).origin,
        ...(configService
          .get('EXTRA_CORS_ORIGINS')
          ?.split(',')
          .map((s) => (s.charAt(0) === '^' ? new RegExp(s) : s)) || []),
      ],
      allowedHeaders: 'Content-Type,Authorization',
    });
  }

  if (isBooleanStringTrue(configService.get('TRUST_PROXY'))) {
    app.set('trust proxy', true);
  }

  app.disable('x-powered-by');
  app.use(morgan('combined'));
  app.use(
    helmet({
      dnsPrefetchControl: false,
      hsts: nodeEnv === 'production',
      contentSecurityPolicy: nodeEnv === 'production' && !process.env.CI,
    }),
  );

  const port = configService.get('PORT');
  const host = configService.get('HOST');
  await app.listen(port, host);
}
bootstrap();

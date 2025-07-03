import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that do not have decorators in the DTO
      forbidNonWhitelisted: false, // Throw an error for non-whitelisted properties
      transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
    }),
  );
  const PORT = process.env.PORT ?? 5002;
  await app.listen(PORT, '0.0.0.0');
  console.log(`Server is running on port ${process.env.PORT}`);

}
bootstrap();

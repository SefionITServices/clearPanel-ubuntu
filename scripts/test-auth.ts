import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [AuthService],
})
class TestModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(TestModule, { logger: false });
  const auth = app.get(AuthService);
  console.log('valid?', auth.validate('hasim751', 'admin123'));
  console.log('invalid?', auth.validate('admin', 'admin123'));
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

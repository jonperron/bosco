import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsString } from 'class-validator';

/** Test-only DTO: one known field, to probe the global ValidationPipe. */
export class EchoDto {
  @IsString()
  name!: string;
}

/** Test-only route that echoes its validated body. */
@Controller('test-echo')
export class EchoController {
  @Post()
  @HttpCode(200)
  echo(@Body() body: EchoDto): EchoDto {
    return body;
  }
}

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * The single OpenAPI contract of the API, built from the routes.
 *
 * Both the running app (`/api/docs`) and the committed contract
 * (`apps/api/openapi.json`, checked by `pnpm openapi:check`) go through
 * this function, so they cannot drift apart.
 */
export function buildOpenapiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Bosco API')
    .setDescription('The socle v0 API: identity, access control, modules.')
    .setVersion('0.0')
    .setLicense('Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0')
    .addCookieAuth('__Host-bosco_session')
    .build();

  return SwaggerModule.createDocument(app, config);
}

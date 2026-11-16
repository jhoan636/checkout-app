import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { DOCS_PATH } from '../configure-app';

/** The root of the API has nothing of its own: it leads to the documentation. */
@ApiExcludeController()
@Controller()
export class RootController {
  @Get()
  @Redirect(`/${DOCS_PATH}`)
  toDocs(): void {}
}

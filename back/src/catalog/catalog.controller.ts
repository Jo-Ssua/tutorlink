import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@ApiTags('Catalog')
@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('faculties')
  @ApiOperation({ summary: 'Listar facultades' })
  faculties() {
    return this.catalogService.faculties();
  }

  @Get('programs')
  @ApiOperation({ summary: 'Listar programas academicos' })
  programs(@Query() query: CatalogQueryDto) {
    return this.catalogService.programs(query);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'Listar materias del pensum oficial' })
  subjects(@Query() query: CatalogQueryDto) {
    return this.catalogService.subjects(query);
  }

  @Get('professors')
  @ApiOperation({ summary: 'Listar profesores y sus materias' })
  professors(@Query() query: CatalogQueryDto) {
    return this.catalogService.professors(query);
  }

  @Get('programs/:programId/pensum')
  @ApiOperation({ summary: 'Obtener el pensum oficial de un programa' })
  pensum(@Param('programId', new ParseUUIDPipe()) programId: string) {
    return this.catalogService.pensum(programId);
  }
}

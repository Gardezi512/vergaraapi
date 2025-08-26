import { Controller, Get, Query } from "@nestjs/common"
import { CreatorService } from "./creator.service"

@Controller("creators")
export class CreatorController {
  constructor(private readonly creatorService: CreatorService) {}

  @Get()
  async getCreators(@Query() query: any) {
    return this.creatorService.getCreators({
      category: query.category,
      sortBy: query.sortBy || "arenaPoints",
      search: query.search,
      
    })
  }
}

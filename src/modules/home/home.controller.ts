import { Controller, Get } from "@nestjs/common"
import { HomeService } from "./home.service"

@Controller("docs/home")
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get("stats")
  async getHomeStats() {
    try {
      const data = await this.homeService.getHomePageData()
      return {
        status: true,
        data,
      }
    } catch (error) {
      return {
        status: false,
        message: "Failed to fetch home page data",
        error: error.message,
      }
    }
  }
}

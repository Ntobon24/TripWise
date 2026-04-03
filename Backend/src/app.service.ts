import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      name: 'TripWise API',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

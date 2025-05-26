import { Injectable } from '@angular/core';

import { lastValueFrom, map } from "rxjs";
import { HttpService } from './http.service';
import { environment } from '../../../environment/environment';

/**
 * Config-related Service Logic
 * @since 25th May 2025
 */
@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private baseUrl: string;
  private uri: any;

  constructor(private httpService: HttpService) {
    this.baseUrl = environment.services.passage.baseUrl;
    this.uri = environment.services.passage.uri;

  }

  getBibleConfig(): Promise<any> {
    return lastValueFrom(
      this.httpService.get(this.baseUrl, this.uri.bible)
        .pipe(map((response: any) => {
          return response;
        })));
  }

}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { catchError, Observable } from "rxjs";
import { HttpUtil } from '../util/http.util';

/**
 * HTTP-related Service Logic
 * @since 25th May 2025
 */
@Injectable({
  providedIn: 'root',
})
export class HttpService {

  constructor(private http: HttpClient) {}

  get(baseUrl: string, path: string, params?: any, pathVariables?: any): Observable<any> {
    const url = baseUrl + path;
    const headers = new HttpHeaders();

    return this.http
      .get(url, { headers: headers })
      .pipe(catchError(HttpUtil.handleError));
  }

}

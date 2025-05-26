import { APP_URI } from '../app/app.uri';

export const environment = {
  logLevel: 'INFO',
  services: {
    passage: {
      baseUrl: 'http://localhost:8081',
      uri: APP_URI.passage
    }
  }
};

import { APP_URI } from '../app/app.uri';

export const environment = {
  logLevel: 'INFO',
  services: {
    passage: {
      baseUrl: 'https://passage-oa8a.onrender.com',
      uri: APP_URI.passage
    }
  }
};

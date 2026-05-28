import 'dotenv/config';
import { startApi } from './src/api/server.js';

const port = parseInt(process.env.API_PORT || '3200', 10);
startApi(port);

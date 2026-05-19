import 'dotenv/config';
import { startProxy } from './src/proxy/server.js';

const port = parseInt(process.env.PROXY_PORT || '3100', 10);
startProxy(port);

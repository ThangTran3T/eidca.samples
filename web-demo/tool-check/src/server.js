import 'dotenv/config';
import { createApp } from './app.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 17990);
const app = createApp();

app.listen(port, host, () => {
  console.log(`VNeCA Tool Check listening at http://${host}:${port}`);
});

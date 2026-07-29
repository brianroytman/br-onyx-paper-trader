import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // process.env rather than the env() helper: env() throws when the variable is
  // absent, and `prisma generate` runs during the Docker build with no .env.
  datasource: { url: process.env.DATABASE_URL },
});

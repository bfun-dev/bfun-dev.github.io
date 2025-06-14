import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
// import dotenc from '@w'
// require('dotenv').config({  path: require('find-config')('.env') })

neonConfig.webSocketConstructor = ws;
//postgresql://neondb_owner:npg_KWqraOyIds18@ep-tiny-king-a6juqsvs.us-west-2.aws.neon.tech/neondb?sslmode=require
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
import { Controller, Get, Header } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from './common/decorators';
import { type Database, InjectDb } from './db/db.module';
import { deploymentInfo, renderHealthPage } from './health-page';

/** How long the status page waits for the database before calling it unreachable. */
const DB_TIMEOUT_MS = 3_000;

@Controller()
export class HealthController {
  constructor(@InjectDb() private readonly db: Database) {}

  /** For machines (deploy script, uptime monitors): cheap, never touches the database. */
  @Public()
  @Get('health')
  check() {
    return { status: 'ok', service: 'timbertrail-api' };
  }

  /**
   * The API's front page (GET /, outside the /api prefix): a status page for people,
   * and what Vercel shows as the deployment preview.
   */
  @Public()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async page(): Promise<string> {
    return renderHealthPage({
      database: await this.pingDatabase(),
      ...deploymentInfo(process.env),
      uptimeSeconds: process.uptime(),
      checkedAt: new Date(),
    });
  }

  private async pingDatabase(): Promise<{ ok: boolean; ms: number }> {
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.db.execute(sql`select 1`), timeout]);
      return { ok: true, ms: Date.now() - started };
    } catch {
      return { ok: false, ms: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  }
}

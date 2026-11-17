/**
 * nodereact seeder: ყველა მონაცემი nodereact_seeder.sql-იდან
 *
 * გამოყენება:
 *   npm i mysql2
 *   railway run node seed.js
 *   node seed.js --dry-run     (არაფერს წერს, მხოლოდ ამოწმებს)
 *
 * საჭირო ფაილები იმავე საქაღალდეში:
 *   nodereact_schema.sql, nodereact_seeder.sql
 *
 * ქცევა:
 *  - ცხრილები არ არსებობს -> ჯერ იქმნება სქემა
 *  - ცხრილები არსებობს     -> სქემა გამოტოვდება
 *  - ჩანაწერი ახალია       -> ემატება
 *  - ჩანაწერი (id) არსებობს -> განახლდება ფაილის მნიშვნელობებით
 *  - არაფერი იშლება
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DRY_RUN = process.argv.includes('--dry-run');

// ცხრილები, რომლებიც seeder-ში მონაცემებით არის (სწორი რაოდენობა დამპიდან)
const EXPECTED = {
  groups: 6,
  users: 12,
  drivers: 134,
  driver_groups: 140,
  user_groups: 14,
  audit_logs: 82,
  refresh_tokens: 3,
  user_sessions: 6,
};
// ცხრილები, რომლებიც დამპში ცარიელია, მაგრამ სქემაში არსებობს
const EMPTY_TABLES = ['billing', 'deleted_drivers', 'online_users', 'user_stats'];
const ALL_TABLES = [...Object.keys(EXPECTED), ...EMPTY_TABLES];

function getConnectionConfig() {
  const url =
    process.env.MYSQL_PUBLIC_URL ||
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL;

  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || 'railway',
    };
  }

  const host = process.env.DB_HOST || process.env.MYSQLHOST;
  if (!host) {
    throw new Error(
      'ბაზის მონაცემები ვერ მოიძებნა. გაუშვი: railway run node seed.js ' +
        'ან დააყენე MYSQL_PUBLIC_URL / DB_HOST, DB_USER, DB_PASSWORD, DB_NAME'
    );
  }
  return {
    host,
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
  };
}

function readSql(name) {
  const file = path.join(__dirname, name);
  if (!fs.existsSync(file)) throw new Error(`ფაილი ვერ მოიძებნა: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

async function existingTables(conn) {
  const [rows] = await conn.query('SHOW TABLES');
  return new Set(rows.map((r) => Object.values(r)[0]));
}

async function main() {
  const cfg = getConnectionConfig();
  console.log(`კავშირი: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
  if (DRY_RUN) console.log('--dry-run: ბაზაში არაფერი ჩაიწერება\n');

  const conn = await mysql.createConnection({
    ...cfg,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    await conn.query('SET NAMES utf8mb4');

    // ---------- 1. სქემა ----------
    const have = await existingTables(conn);
    const missing = ALL_TABLES.filter((t) => !have.has(t));

    if (missing.length === 0) {
      console.log('ყველა ცხრილი არსებობს, სქემა გამოტოვებულია.');
    } else if (missing.length === ALL_TABLES.length) {
      console.log('ბაზა ცარიელია, იქმნება სქემა (12 ცხრილი)...');
      if (!DRY_RUN) await conn.query(readSql('nodereact_schema.sql'));
    } else {
      throw new Error(
        'ცხრილების ნაწილი არსებობს, ნაწილი არა. აკლია: ' + missing.join(', ') +
          '. ავტომატურად ვერ შევქმნი, რომ არსებულ სტრუქტურას არ შევეხო.'
      );
    }

    // ---------- 2. მონაცემები ----------
    console.log('მონაცემების ჩაწერა...');
    if (!DRY_RUN) await conn.query(readSql('nodereact_seeder.sql'));

    // ---------- 3. შემოწმება ----------
    if (DRY_RUN) {
      console.log('\nდასრულდა (dry-run).');
      return;
    }
    console.log('\nცხრილი               ბაზაში   ფაილში');
    let ok = true;
    for (const [table, expected] of Object.entries(EXPECTED)) {
      const [r] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
      const c = r[0].c;
      const mark = c >= expected ? 'OK ' : 'ნაკლებია!';
      if (c < expected) ok = false;
      console.log(`${table.padEnd(20)} ${String(c).padStart(6)}   ${String(expected).padStart(6)}  ${mark}`);
    }
    console.log(ok ? '\nყველა მონაცემი ჩაიწერა.' : '\nგაფრთხილება: ზოგ ცხრილში ჩანაწერები აკლია.');
    if (!ok) process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nშეცდომა:', err.message);
  process.exit(1);
});

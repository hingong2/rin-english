import { createConnection } from 'mysql2/promise';

// 요청마다 Hyperdrive 를 통해 연결합니다. (풀링은 Hyperdrive 가 담당)
export async function withDb(context, fn) {
  const h = context.env.HYPERDRIVE;
  if (!h) throw new Error('HYPERDRIVE 바인딩이 설정되지 않았습니다.');
  const conn = await createConnection({
    host: h.host,
    user: h.user,
    password: h.password,
    database: h.database,
    port: h.port,
    charset: 'utf8mb4',
    dateStrings: true, // DATE 를 'YYYY-MM-DD' 문자열로
    disableEval: true, // Workers 런타임 필수
  });
  try {
    return await fn(conn);
  } finally {
    context.waitUntil(conn.end().catch(() => {}));
  }
}

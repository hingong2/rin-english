-- 기존 테이블(vocab_words, users, quiz_history)은 그대로 사용합니다.
-- 새로 필요한 것은 로그인 시도 제한용 테이블 하나뿐입니다.

CREATE TABLE IF NOT EXISTS login_attempts (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip            VARCHAR(64) NOT NULL,
  attempted_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ip_time (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 권장: 앱 전용 계정 (최소 권한). DB이름은 실제 이름으로 바꾸세요.
--   CREATE USER 'words_app'@'%' IDENTIFIED BY '강력한_비밀번호' REQUIRE SSL;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON DB이름.vocab_words    TO 'words_app'@'%';
--   GRANT SELECT, INSERT                 ON DB이름.users          TO 'words_app'@'%';
--   GRANT SELECT, INSERT                 ON DB이름.quiz_history   TO 'words_app'@'%';
--   GRANT SELECT, INSERT, DELETE         ON DB이름.login_attempts TO 'words_app'@'%';

-- 권장: 조회 속도용 인덱스 (이미 있으면 생략)
--   CREATE INDEX idx_vocab_date ON vocab_words (study_date);
--   CREATE INDEX idx_hist_user_date ON quiz_history (user_id, study_date);

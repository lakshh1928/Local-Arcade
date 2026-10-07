CREATE DATABASE IF NOT EXISTS local_arcade CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE local_arcade;

CREATE TABLE IF NOT EXISTS players (
  id CHAR(36) PRIMARY KEY,
  display_name VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  code CHAR(6) PRIMARY KEY,
  game VARCHAR(20) NOT NULL,
  host_player_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rooms_host FOREIGN KEY (host_player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_code CHAR(6) NOT NULL,
  game VARCHAR(20) NOT NULL,
  winner_player_id CHAR(36) NULL,
  result_json JSON NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  INDEX idx_matches_room (room_code),
  CONSTRAINT fk_matches_winner FOREIGN KEY (winner_player_id) REFERENCES players(id)
);

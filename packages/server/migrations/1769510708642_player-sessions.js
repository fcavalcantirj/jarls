/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('player_sessions', {
    token: {
      type: 'varchar(64)',
      primaryKey: true,
      notNull: true,
    },
    game_id: {
      type: 'varchar(36)',
      notNull: true,
      references: 'game_snapshots(game_id)',
      onDelete: 'CASCADE',
    },
    player_id: {
      type: 'varchar(36)',
      notNull: true,
    },
    player_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('player_sessions', 'game_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('player_sessions');
};

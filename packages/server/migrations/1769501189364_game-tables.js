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
  // game_snapshots table
  pgm.createTable('game_snapshots', {
    game_id: {
      type: 'varchar(36)',
      primaryKey: true,
      notNull: true,
    },
    state_snapshot: {
      type: 'jsonb',
      notNull: true,
    },
    version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'lobby',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('game_snapshots', 'status');

  // game_events table
  pgm.createTable('game_events', {
    event_id: {
      type: 'serial',
      primaryKey: true,
    },
    game_id: {
      type: 'varchar(36)',
      notNull: true,
      references: 'game_snapshots(game_id)',
      onDelete: 'CASCADE',
    },
    event_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    event_data: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('game_events', 'game_id');
  pgm.createIndex('game_events', 'event_type');
  pgm.createIndex('game_events', ['game_id', 'created_at']);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('game_events');
  pgm.dropTable('game_snapshots');
};

import { query } from './client';
import { logger } from '../utils/logger';

async function seed() {
  logger.info('Seeding database with zones...');

  await query(`
    INSERT INTO zones (id, city, name, display_name, lat, lng, flood_history_score, aqi_frequency_score, order_volume_baseline)
    VALUES
      ('a1b2c3d4-0001-0001-0001-000000000001', 'Bangalore', 'KA-BLR-07', 'Koramangala, Bengaluru', 12.9352, 77.6245, 0.72, 0.15, 500),
      ('a1b2c3d4-0002-0002-0002-000000000002', 'Bangalore', 'KA-BLR-12', 'Indiranagar, Bengaluru', 12.9784, 77.6408, 0.55, 0.18, 420),
      ('a1b2c3d4-0003-0003-0003-000000000003', 'Delhi', 'DL-NCR-01', 'Connaught Place, New Delhi', 28.6315, 77.2167, 0.45, 0.92, 780),
      ('a1b2c3d4-0004-0004-0004-000000000004', 'Delhi', 'DL-NCR-05', 'Lajpat Nagar, New Delhi', 28.5665, 77.2431, 0.40, 0.88, 560),
      ('a1b2c3d4-0005-0005-0005-000000000005', 'Mumbai', 'MH-MUM-03', 'Bandra West, Mumbai', 19.0596, 72.8295, 0.88, 0.25, 650)
    ON CONFLICT (id) DO NOTHING;
  `);

  logger.info('Database seed complete');
}

seed().catch((err) => {
  logger.error('Seed failed', err);
  process.exit(1);
});

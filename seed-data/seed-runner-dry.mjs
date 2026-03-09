process.env.DRY_RUN = 'true';
process.env.ANIMAL_COUNT = '5';
import('./seed.mjs').catch(err => { console.error(err); process.exit(1); });

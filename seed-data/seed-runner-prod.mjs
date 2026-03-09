process.env.DRY_RUN = 'false';
process.env.ANIMAL_COUNT = '300';
import('./seed.mjs').catch(err => { console.error(err); process.exit(1); });

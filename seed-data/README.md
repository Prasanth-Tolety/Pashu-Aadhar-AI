# Pashu Aadhaar AI — Seed Data Script

Automated end-to-end enrollment and data population script. Reads cow face + muzzle images, uploads them to S3, and fills **all 13 DynamoDB tables** with realistic Indian-context dummy data.

## Tables Populated

| # | Table | PK | Records Created |
|---|-------|----|-----------------|
| 1 | `animals` | `livestock_id` | 1 per cow (300 total) |
| 2 | `owners` | `owner_id` | ~75 farmers + 10 agents + vet + insurer |
| 3 | `user_role_mapping` | `mapping_id` | 1 per owner |
| 4 | `embeddings` | `embedding_id` | 1 per animal |
| 5 | `health_records` | `record_id` | 1-3 per animal |
| 6 | `milk_yields` | `yield_id` | 7-30 per female dairy cow |
| 7 | `insurance_policies` | `policy_id` | ~60% of animals |
| 8 | `loan_collateral` | `loan_id` | ~30% of animals |
| 9 | `enrollment_requests` | `request_id` | 1 per animal |
| 10 | `enrollment_sessions` | `session_id` | 1 per animal |
| 11 | `enrollment_agents` | `agent_id` | 10 agents |
| 12 | `fraud_scores` | `livestock_id` | 1 per animal |
| 13 | `access_requests` | `request_id` | ~15% of animals |

## Data Context

- **20 Indian states** with real districts and villages
- **16 Indian cattle/buffalo breeds** (Gir, Sahiwal, Tharparkar, Murrah, etc.)
- **Breed-state affinity**: 70% chance of native breed for each state
- **Gender distribution**: 65% female, 35% male
- **Fraud risk**: 70% low, 18% medium, 8% high, 4% critical
- **Enrollment dates**: Spread over last 12 months for realistic trends
- **Milk yields**: Only for female dairy/dual/buffalo breeds
- **Insurance**: Government & private providers with realistic premiums
- **Loans**: KCC, cooperative, and commercial bank loans

## Quick Start

```powershell
cd Pashu-Aadhar-AI/seed-data
npm install
npm run seed
```

## Options

| Variable | Default | Description |
|----------|---------|-------------|
| `DRY_RUN` | `false` | Preview without writes |
| `ANIMAL_COUNT` | `0` (all) | Limit number of animals |
| `AWS_REGION` | `us-east-1` | AWS region |
| `S3_BUCKET` | `pashu-aadhaar-images-prod` | S3 bucket name |

```powershell
# Dry run (preview only)
$env:DRY_RUN="true"; npm run seed

# Seed only 50 animals
$env:ANIMAL_COUNT="50"; npm run seed

# Clear seeded data
npm run clear

# Clear ALL data (dangerous)
$env:CLEAR_ALL="true"; npm run clear
```

## Verification

After seeding, verify on the dashboard:
1. **Gov Dashboard** → Analytics Summary shows total animals, farmers, sessions
2. **State Map** → State-wise distribution across India
3. **Enrollment Trends** → Daily/monthly enrollment chart
4. **Breed Distribution** → Pie chart with Indian breeds
5. **Fraud Summary** → Risk distribution (low/medium/high/critical)
6. **Agent Performance** → 10 agents with completion rates
7. **Farmer Dashboard** → Animals with photos from S3
8. **Animal Detail** → Health records, milk yields, insurance, loans

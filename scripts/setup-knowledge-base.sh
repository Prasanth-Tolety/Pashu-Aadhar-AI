#!/bin/bash
# ==========================================================
# Pashu Aadhaar AI — Knowledge Base Setup Script
# ==========================================================
# This script sets up the S3 knowledge base bucket and
# uploads veterinary reference documents for the GenAI RAG system.
#
# Usage:
#   ./setup-knowledge-base.sh <bucket-name> [region]
#
# Example:
#   ./setup-knowledge-base.sh pashu-ai-knowledge-base ap-south-1
# ==========================================================

set -euo pipefail

BUCKET_NAME="${1:-pashu-ai-knowledge-base}"
REGION="${2:-ap-south-1}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KB_DIR="$SCRIPT_DIR/knowledge-base"

echo "╔══════════════════════════════════════════════════╗"
echo "║   Pashu Aadhaar AI — Knowledge Base Setup       ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Bucket: s3://$BUCKET_NAME"
echo "Region: $REGION"
echo ""

# 1. Create bucket if not exists
echo "📦 Creating S3 bucket..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "   Bucket already exists."
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  echo "   ✅ Bucket created."
fi

# 2. Create knowledge base directory structure and content
echo "📝 Generating knowledge base documents..."
mkdir -p "$KB_DIR/diseases" "$KB_DIR/guidelines"

# --- Disease Docs ---
cat > "$KB_DIR/diseases/foot_and_mouth_disease.txt" << 'EOF'
# Foot and Mouth Disease (FMD)

## Overview
Foot and Mouth Disease is a highly contagious viral disease affecting cloven-hoofed animals including cattle, buffalo, sheep, goats, and pigs.

## Cause
Aphthovirus (Picornavirus family). Seven serotypes: O, A, C, SAT1, SAT2, SAT3, Asia1.
In India, serotypes O, A, and Asia1 are most common.

## Symptoms
- High fever (104-106°F / 40-41°C)
- Excessive salivation and drooling
- Blisters/vesicles on tongue, gums, lips, dental pad
- Blisters between hooves and on coronary band
- Lameness, reluctance to walk
- Sharp drop in milk production (up to 80%)
- Loss of appetite
- Smacking of lips

## Transmission
- Direct contact with infected animals
- Airborne (up to 60 km over land)
- Contaminated feed, water, equipment, vehicles
- People carrying virus on clothes/shoes

## Treatment
- No specific antiviral treatment
- Antiseptic mouth wash: 1% KMnO4 (potassium permanganate) or 2% alum solution
- Hoof lesions: wash with 1% KMnO4, apply antiseptic ointment
- Soft, easily digestible feed (gruel, mash)
- Antibiotics for secondary bacterial infections
- Rest and isolation

## Prevention
- **FMD Vaccination**: Every 6 months (trivalent: O, A, Asia1)
- Part of India's National FMD Control Programme (FMD-CP)
- Quarantine new animals for 28 days
- Restrict movement during outbreaks
- Disinfect premises, vehicles, equipment

## Urgency: HIGH
- Notifiable disease — must be reported to District Veterinary Officer
- Mortality: Low in adults (1-5%), high in calves (up to 50%)
- Economic impact: Severe due to production losses
EOF

cat > "$KB_DIR/diseases/lumpy_skin_disease.txt" << 'EOF'
# Lumpy Skin Disease (LSD)

## Overview
Lumpy Skin Disease is a viral disease primarily affecting cattle and buffalo, caused by Capripoxvirus.

## Symptoms
- Fever (40-41°C)
- Firm, round skin nodules (2-5 cm diameter) all over body
- Nodules may ulcerate and become necrotic
- Enlarged superficial lymph nodes
- Nasal and ocular discharge
- Reduced milk yield
- Weight loss, depression
- Edema of limbs, brisket

## Transmission
- Primarily through biting insects (mosquitoes, stable flies, ticks)
- Direct contact with lesion material
- Contaminated equipment

## Treatment
- No specific antiviral cure
- Wound management: clean lesions with antiseptic
- Antibiotics for secondary infections
- Anti-inflammatory drugs (meloxicam, flunixin)
- Supportive care: good nutrition, fluids
- Fly and tick control on affected animals

## Prevention
- **Vaccination**: Goatpox vaccine (heterologous) or LSD-specific vaccine
- Vector control: insecticide spraying, use of insect repellents
- Quarantine infected animals immediately
- Restrict animal movement in outbreak areas

## Urgency: HIGH
- Notifiable disease
- Mortality: 1-5% (can be higher in naive populations)
- Morbidity: Can exceed 50%
EOF

cat > "$KB_DIR/diseases/mastitis.txt" << 'EOF'
# Mastitis

## Overview
Mastitis is inflammation of the udder (mammary gland), most commonly caused by bacterial infection. It is the most economically important disease of dairy animals worldwide.

## Types
1. **Clinical Mastitis**: Visible symptoms — swollen udder, abnormal milk
2. **Sub-clinical Mastitis**: No visible symptoms but elevated somatic cell count (SCC)

## Common Causes
- Staphylococcus aureus (most common in India)
- Streptococcus agalactiae, S. uberis
- Escherichia coli (environmental)
- Klebsiella spp.

## Symptoms
- Swollen, hot, painful udder quarter(s)
- Abnormal milk: clots, watery, blood-tinged, foul-smelling
- Fever (in severe cases)
- Reduced appetite
- Decreased milk yield
- Animal kicks during milking

## Diagnosis
- California Mastitis Test (CMT) — field test
- Somatic Cell Count (SCC)
- Milk culture and sensitivity testing

## Treatment
- **Intramammary antibiotics** based on sensitivity testing
- **Systemic antibiotics** for severe cases (ceftiofur, amoxicillin-clavulanate)
- Anti-inflammatory drugs (meloxicam)
- Frequent milking (strip out affected quarter 4-6 times/day)
- Supportive care: fluids, proper nutrition

## Prevention
- **Pre-milking teat dipping** (0.5% iodine)
- **Post-milking teat dipping** (0.5% iodine or chlorhexidine)
- Clean, dry housing
- Proper milking technique and machine maintenance
- Dry cow therapy at end of lactation
- Cull chronically infected animals
- Regular CMT screening

## Urgency: MEDIUM-HIGH
- Treat within 24 hours for best outcome
- Chronic cases lead to permanent udder damage
EOF

cat > "$KB_DIR/diseases/brucellosis.txt" << 'EOF'
# Brucellosis

## Overview
Brucellosis is a chronic bacterial disease caused by Brucella species. It is a major zoonotic disease — transmissible to humans.

## Cause
- **Cattle/Buffalo**: Brucella abortus
- **Goats/Sheep**: Brucella melitensis
- **Pigs**: Brucella suis

## Symptoms in Animals
- Abortion in last trimester of pregnancy
- Retained placenta
- Infertility / repeat breeding
- Reduced milk yield
- Swollen joints (hygroma)
- Orchitis and epididymitis in males
- Weak calves at birth

## Symptoms in Humans (Zoonotic Risk)
- Undulant fever (intermittent)
- Joint pain, sweating
- Hepatitis, endocarditis (severe cases)

## Transmission
- Contact with aborted materials (fetus, placenta, vaginal discharge)
- Contaminated milk (unpasteurized)
- Venereal (natural mating with infected bull)

## Diagnosis
- Rose Bengal Plate Test (RBPT) — screening
- Standard Tube Agglutination Test (STAT)
- Milk Ring Test (MRT) for herd screening
- ELISA

## Treatment
- **No effective treatment in animals** — test and slaughter policy in many countries
- In humans: combination antibiotics (doxycycline + streptomycin)

## Prevention
- **Vaccination**: S19 vaccine for female calves (4-8 months), RB51 for adults
- Test-and-segregate programs
- Pasteurize milk before consumption
- Use AI (artificial insemination) instead of natural mating
- Practice hygiene when handling abortions

## Urgency: HIGH
- Notifiable disease
- Zoonotic — report to public health authorities
- National Brucellosis Control Programme in India
EOF

cat > "$KB_DIR/diseases/haemorrhagic_septicaemia.txt" << 'EOF'
# Haemorrhagic Septicaemia (HS)

## Overview
Haemorrhagic Septicaemia is an acute, fatal bacterial disease of cattle and buffalo. It is the single largest killer of cattle in India.

## Cause
Pasteurella multocida serotype B:2 (Asian type)

## Predisposing Factors
- Monsoon/rainy season
- Stress (flooding, overcrowding, transportation)
- Poor nutrition
- Young animals (6 months to 2 years most susceptible)

## Symptoms
- Sudden high fever (106-107°F)
- Severe depression
- Swelling of throat, brisket, and submandibular area
- Difficulty breathing, labored respiration
- Profuse salivation
- Blood-stained nasal discharge
- Death within 12-24 hours of onset

## Treatment
- High-dose oxytetracycline or penicillin-streptomycin if caught VERY early
- Usually fatal once symptoms are advanced
- Supportive care: fluids, anti-inflammatory drugs

## Prevention
- **HS Vaccination**: Annually, before monsoon (May-June)
- Oil-adjuvant vaccine provides 12 months protection
- Alum-precipitated vaccine: 6 months protection (give booster)
- Reduce stress, provide good nutrition
- Avoid overcrowding

## Urgency: CRITICAL
- Emergency — death can occur within hours
- Notify district veterinary officer immediately
EOF

cat > "$KB_DIR/guidelines/vaccination_schedule.txt" << 'EOF'
# Livestock Vaccination Schedule — India

## Cattle and Buffalo

| Disease | Vaccine | Age | Frequency | Best Time |
|---------|---------|-----|-----------|-----------|
| FMD | Trivalent FMD vaccine | 4 months+ | Every 6 months | Jan & Jul (or per state schedule) |
| HS | HS oil adjuvant | 6 months+ | Annual | May-June (pre-monsoon) |
| BQ | BQ vaccine | 6 months+ | Annual | May-June (pre-monsoon) |
| Brucellosis | S19 | Female calves 4-8 months | Once (lifetime) | As per age |
| Anthrax | Anthrax spore vaccine | 6 months+ | Annual | In endemic areas |
| Theileriosis | Cell culture vaccine | 3 months+ | Once | Where available |
| IBR | IBR vaccine | 6 months+ | Annual | Where available |
| Rabies | Anti-rabies | 3 months+ | Annual | Post-exposure or preventive |

## Goats and Sheep

| Disease | Vaccine | Age | Frequency |
|---------|---------|-----|-----------|
| PPR | PPR vaccine | 4 months+ | Once (long-lasting) |
| Goat Pox | Goat pox vaccine | 3 months+ | Annual |
| Enterotoxaemia | ET vaccine | 4 months+ | Annual (pre-monsoon) |
| FMD | FMD vaccine | 4 months+ | Every 6 months |
| HS | HS vaccine | 6 months+ | Annual |

## Deworming Schedule
- Every 3-4 months for adults
- Monthly for calves/kids up to 6 months
- Pre-monsoon and post-monsoon strategic deworming
- Broad spectrum: Albendazole or Fenbendazole
- Fluke areas: Triclabendazole additionally

## Important Notes
- Always deworm 10-14 days before vaccination
- Do NOT vaccinate sick or pregnant (last month) animals
- Store vaccines at 2-8°C (cold chain essential)
- Record all vaccinations with date, batch number
- Report adverse reactions to manufacturer
EOF

cat > "$KB_DIR/guidelines/symptom_reference.txt" << 'EOF'
# Quick Symptom Reference Guide

## Emergency Symptoms (Seek veterinarian IMMEDIATELY)
- Sudden inability to stand after calving → Milk Fever
- Massively distended left abdomen → Bloat (Ruminal Tympany)
- Swollen throat + high fever + difficulty breathing → Haemorrhagic Septicaemia
- Sudden lameness + swollen crepitant muscle → Black Quarter
- Profuse bloody diarrhea → Anthrax, Salmonella
- Seizures / convulsions → Poisoning, Tetanus, Hypomagnesaemia

## Urgent Symptoms (Within 24 hours)
- Fever + blisters in mouth + lameness → FMD
- Skin nodules all over body → Lumpy Skin Disease
- Swollen hot udder + abnormal milk → Mastitis
- Abortion → Brucellosis, Leptospirosis
- High fever + enlarged lymph nodes → Theileriosis

## Routine Symptoms (Schedule appointment)
- Gradual weight loss + poor coat → Parasites, poor nutrition
- Reduced milk yield → Sub-clinical mastitis, poor feed, parasites
- Itching / hair loss → Mange, ringworm, lice
- Mild diarrhea → Diet change, mild parasites
- Mild cough → Respiratory infection, dust

## Decision Matrix: When to Call the Vet
1. Animal cannot stand → EMERGENCY (within 1 hour)
2. Difficulty breathing → EMERGENCY (within 1 hour)
3. Profuse bleeding → EMERGENCY (within 1 hour)
4. High fever (>104°F) → URGENT (within 6 hours)
5. Not eating for >24 hours → URGENT (within 12 hours)
6. Abortion → URGENT (within 12 hours, save fetus for testing)
7. Lameness → Schedule within 24-48 hours
8. Skin problems → Schedule within 1 week
EOF

echo "   ✅ Knowledge base documents created."

# 3. Upload to S3
echo "📤 Uploading to S3..."
aws s3 sync "$KB_DIR/" "s3://$BUCKET_NAME/" --region "$REGION"
echo "   ✅ Upload complete."

# 4. Summary
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅ Knowledge Base Setup Complete!              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Bucket contents:"
aws s3 ls "s3://$BUCKET_NAME/" --recursive --human-readable
echo ""
echo "Next steps:"
echo "  1. Enable Amazon Bedrock model access (Claude 3 Haiku)"
echo "     → AWS Console → Amazon Bedrock → Model access"
echo "  2. (Optional) Create Bedrock Knowledge Base pointing to this bucket"
echo "  3. Deploy the updated SAM template: sam build && sam deploy"
echo ""

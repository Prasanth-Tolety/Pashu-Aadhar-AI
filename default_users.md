# Default Test Users — Pashu Aadhaar AI

> **Cognito User Pool:** `us-east-1_NPYiBsfST`  
> **Client ID:** `2jdbhaq7do5j6soq8hod741bk5`

| Role           | Phone Number     | Password       | Cognito Sub                          |
| -------------- | ---------------- | -------------- | ------------------------------------ |
| Farmer         | +919876543210    | Farmer@123     | 74089418-...                         |
| Veterinarian   | +919876543211    | Vet@12345      | f438f408-...                         |
| Insurance Agent| +919876543212    | Insurer@123    | 94d84468-...                         |
| Government     | +919876543213    | Govt@12345     | 948844e8-...                         |
| Administrator  | +919876543214    | Admin@1234     | 74186458-...                         |
| Enrollment Agent| +919876543215   | Agent@1234     | a4080488-...                         |

### Notes
- All users were created via `scripts/create-default-users.sh` using the Cognito admin API.
- Phone numbers follow the `+91XXXXXXXXXX` format (Indian numbers).
- Users are pre-confirmed with verified phone numbers (no OTP needed for these defaults).
- Passwords must be **≥ 8 characters** with at least one uppercase letter, one digit, and one special character.
- Corresponding records exist in the DynamoDB `owners` table for each user.

### Multi-Language Support
The app supports **7 Indian languages**:
- 🇬🇧 English (en) — default
- 🇮🇳 हिन्दी / Hindi (hi)
- 🇮🇳 తెలుగు / Telugu (te)
- 🇮🇳 தமிழ் / Tamil (ta)
- 🇮🇳 ಕನ್ನಡ / Kannada (kn)
- 🇮🇳 मराठी / Marathi (mr)
- 🇮🇳 বাংলা / Bengali (bn)

Use the language selector (🌐 dropdown) on the Home page or Dashboard header to switch languages.

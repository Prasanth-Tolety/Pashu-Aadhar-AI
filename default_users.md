# Default Test Users — Pashu Aadhaar AI

> **Cognito User Pool:** `us-east-1_NPYiBsfST`

| Role           | Phone Number     | Password       | Owner ID        |
| -------------- | ---------------- | -------------- | --------------- |
| Farmer         | +919876543210    | Farmer@123     | auto-generated  |
| Veterinarian   | +919876543211    | Vet@12345      | auto-generated  |
| Insurance Agent| +919876543212    | Insurer@123    | auto-generated  |
| Government     | +919876543213    | Govt@12345     | auto-generated  |
| Administrator  | +919876543214    | Admin@1234     | auto-generated  |

### Notes
- All users were created via the **Sign Up** flow in the app.
- Phone numbers follow the `+91XXXXXXXXXX` format (Indian numbers).
- First-time login may trigger a **new password** challenge if the user was created via the Cognito admin console instead of self-sign-up.
- After sign-up, enter the **6-digit OTP** sent via SMS to verify the account.
- Passwords must be **≥ 8 characters** with at least one uppercase letter, one digit, and one special character.

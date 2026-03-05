// ─── Supported Languages ─────────────────────────────────────────────
export type Language = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'mr' | 'bn';

export interface LanguageOption {
  code: Language;
  label: string;        // Native name
  labelEn: string;      // English name
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', labelEn: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', labelEn: 'Hindi', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', labelEn: 'Telugu', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', labelEn: 'Tamil', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', labelEn: 'Kannada', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', labelEn: 'Marathi', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', labelEn: 'Bengali', flag: '🇮🇳' },
];

// ─── Translation Keys ───────────────────────────────────────────────
export interface Translations {
  // Common
  appName: string;
  appNameHindi: string;
  appSubtitle: string;
  home: string;
  dashboard: string;
  signIn: string;
  signOut: string;
  signUp: string;
  loading: string;
  save: string;
  saving: string;
  cancel: string;
  edit: string;
  delete: string;
  submit: string;
  back: string;
  refresh: string;
  search: string;
  profile: string;
  close: string;

  // Home page
  heroTagline: string;
  heroBadge: string;
  heroSubtitle: string;
  createFreeAccount: string;
  getStarted: string;
  goToDashboard: string;
  howItWorks: string;
  howItWorksDesc: string;
  stepCapture: string;
  stepCaptureDesc: string;
  stepAnalyze: string;
  stepAnalyzeDesc: string;
  stepIdentify: string;
  stepIdentifyDesc: string;
  builtForStakeholders: string;
  stakeholderDesc: string;
  poweredBy: string;
  readyToDigitize: string;
  readyToDigitizeDesc: string;
  animalsEnrolled: string;
  farmersRegistered: string;
  statesCovered: string;
  matchAccuracy: string;
  tryQuickEnrollment: string;
  footer: string;

  // Auth
  chooseRole: string;
  fullName: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  verificationCode: string;
  enterVerificationCode: string;
  createAccount: string;
  creatingAccount: string;
  verifying: string;
  verifyAndContinue: string;
  resendCode: string;
  sending: string;
  alreadyHaveAccount: string;
  dontHaveAccount: string;
  changeRole: string;
  passwordMinChars: string;
  passwordsDoNotMatch: string;
  aadhaarLast4: string;
  aadhaarHint: string;
  setNewPassword: string;
  passwordChangeNotice: string;
  signingIn: string;
  settingPassword: string;
  newPassword: string;

  // Roles
  roleFarmer: string;
  roleFarmerDesc: string;
  roleVeterinarian: string;
  roleVeterinarianDesc: string;
  roleInsurer: string;
  roleInsurerDesc: string;
  roleGovernment: string;
  roleGovernmentDesc: string;
  roleAdmin: string;
  roleAdminDesc: string;

  // Dashboard
  overview: string;
  requests: string;
  myAnimals: string;
  loadingAnimals: string;
  noAnimalsYet: string;
  enrollFirst: string;
  enrollNewAnimal: string;
  myProfile: string;
  animalsICanAccess: string;
  requestAnimalAccess: string;
  requestAccessDesc: string;
  livestockId: string;
  reasonForAccess: string;
  requestAccess: string;
  sendingRequest: string;
  myRequests: string;
  incomingAccessRequests: string;
  pending: string;
  approve: string;
  deny: string;
  noAccessRequests: string;
  searchAnyAnimal: string;
  lookUpAnimal: string;
  enterLivestockId: string;
  searching: string;
  animalFound: string;
  animalNotFound: string;
  searchFailed: string;
  viewFullDetails: string;
  useSearchTab: string;
  breed: string;
  gender: string;
  age: string;
  location: string;
  species: string;
  owner: string;
  unknown: string;

  // Enrollment
  animalDetails: string;
  fillDetails: string;
  speciesLabel: string;
  breedLabel: string;
  genderLabel: string;
  ageMonths: string;
  colorPattern: string;
  hornType: string;
  identifiableMarks: string;
  village: string;
  district: string;
  state: string;
  saveAndContinue: string;
  skipForNow: string;
  cattle: string;
  buffalo: string;
  goat: string;
  sheep: string;
  other: string;
  male: string;
  female: string;
  selectGender: string;
  uploadOrCapture: string;
  enrollAnimal: string;
  enrolling: string;
  uploading: string;
  processing: string;
  captureFromCamera: string;
  uploadFromGallery: string;
  takePhoto: string;
  retake: string;
  usePhoto: string;
  dragDropHint: string;
  animalEnrollment: string;
  captureOrUploadDesc: string;
  enrollNotice: string;
  gpsActive: string;
  gettingLocation: string;
  photoTips: string;
  photoTip1: string;
  photoTip2: string;
  photoTip3: string;
  photoTip4: string;
  saveAnimalDetails: string;
  enrollmentFailed: string;
  failedToSaveAnimal: string;

  // Profile
  personalDetails: string;
  memberSince: string;
  accountStatus: string;
  active: string;
  pincode: string;
  userId: string;
  phone: string;
  aadhaar: string;
  profileUpdated: string;
  failedToLoadProfile: string;
  failedToUpdateProfile: string;
  failedToLoadDashboard: string;
  saveChanges: string;
  loadingProfile: string;
  backToDashboard: string;

  // Animal Detail
  details: string;
  health: string;
  milk: string;
  insurance: string;
  loans: string;
  noRecordsYet: string;
  addRecord: string;
  addHealthRecord: string;
  addMilkRecord: string;
  addInsurance: string;
  addLoan: string;
  vaccineType: string;
  administeredBy: string;
  recordDate: string;
  nextDueDate: string;
  notes: string;
  morningYield: string;
  eveningYield: string;
  totalYield: string;
  provider: string;
  policyNumber: string;
  coverageAmount: string;
  premium: string;
  startDate: string;
  endDate: string;
  status: string;
  lender: string;
  loanAmount: string;
  interestRate: string;
  tenureMonths: string;
  disbursementDate: string;
  repaymentStatus: string;
  enrolledAt: string;
  gpsCoordinates: string;
  ownerId: string;
  animalProfile: string;
  editDetails: string;
  loadingAnimalData: string;
  animalNotFoundError: string;
  failedToLoadAnimal: string;
  failedToUpdateAnimal: string;
  failedToAddHealth: string;
  failedToAddMilk: string;
  failedToAddInsurance: string;
  failedToAddLoan: string;
  vaccination: string;
  checkup: string;
  treatment: string;
  deworming: string;
  vaccine: string;
  date: string;
  type: string;
  saveRecord: string;
  saveYield: string;
  savePolicy: string;
  saveLoan: string;
  noHealthRecords: string;
  noMilkRecords: string;
  noInsurancePolicies: string;
  noLoanRecords: string;
  addInsuranceHint: string;
  addLoanHint: string;
  lenderBank: string;
  morningL: string;
  eveningL: string;
  totalL: string;
  enrolled: string;
  gpsLocation: string;
  nextDue: string;
  by: string;
  policyHash: string;
  coverage: string;
  interest: string;
  tenure: string;
  amount: string;

  // Result
  enrollmentSuccess: string;
  newAnimalRegistered: string;
  existingAnimalFound: string;
  similarityScore: string;
  enrollAnother: string;
  viewAnimalDetails: string;

  // Language selector
  selectLanguage: string;

  // Camera Capture
  captureAnimalPhoto: string;
  cameraPermissionError: string;
  retryCamera: string;
  flipCamera: string;
  captureBtn: string;
  cameraAutoCapHint: string;
  loadingAiModel: string;
  aiModelUnavailable: string;
  lookingForAnimal: string;
  perfectMuzzleShot: string;

  // Image Upload
  changePhoto: string;
  uploadAnimalPhoto: string;
  uploadFormatHint: string;
  browseFile: string;
  invalidFileType: string;
  fileTooLarge: string;

  // Upload Progress
  uploadingImage: string;
  analyzingBiometrics: string;
}

// ─── English (default) ──────────────────────────────────────────────
const en: Translations = {
  appName: 'Pashu Aadhaar AI',
  appNameHindi: 'पशु आधार',
  appSubtitle: 'Livestock Identification System',
  home: 'Home',
  dashboard: 'Dashboard',
  signIn: 'Sign In',
  signOut: 'Sign Out',
  signUp: 'Sign Up',
  loading: 'Loading...',
  save: 'Save',
  saving: 'Saving...',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
  submit: 'Submit',
  back: 'Back',
  refresh: 'Refresh',
  search: 'Search',
  profile: 'Profile',
  close: 'Close',

  heroTagline: 'Pashu-Aadhaar AI',
  heroBadge: '🇮🇳 Digital India Initiative',
  heroSubtitle: "India's first AI-powered biometric identity system for livestock. Secure muzzle-pattern recognition to uniquely identify every animal.",
  createFreeAccount: 'Create Free Account',
  getStarted: 'Get Started',
  goToDashboard: 'Go to Dashboard',
  howItWorks: 'How It Works',
  howItWorksDesc: 'Three simple steps to digitally identify any livestock',
  stepCapture: 'Capture',
  stepCaptureDesc: "Take a clear photo of the animal's muzzle using your phone camera",
  stepAnalyze: 'Analyze',
  stepAnalyzeDesc: 'AI detects the animal, extracts unique biometric patterns via CLIP embeddings',
  stepIdentify: 'Identify',
  stepIdentifyDesc: 'Instant matching against the database — enroll new or verify existing animals',
  builtForStakeholders: 'Built for Every Stakeholder',
  stakeholderDesc: 'Role-based access for the entire livestock ecosystem',
  poweredBy: 'Powered by',
  readyToDigitize: 'Ready to digitize your livestock?',
  readyToDigitizeDesc: 'Join the Pashu Aadhaar network today — free for farmers.',
  animalsEnrolled: 'Animals Enrolled',
  farmersRegistered: 'Farmers Registered',
  statesCovered: 'States Covered',
  matchAccuracy: 'Match Accuracy',
  tryQuickEnrollment: 'Try Quick Enrollment',
  footer: '🐄 पशु आधार — Pashu Aadhaar AI © 2026 · Built for rural India 🇮🇳',

  chooseRole: 'Choose your role to get started',
  fullName: 'Full Name',
  phoneNumber: 'Phone Number',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  verificationCode: 'Verification Code',
  enterVerificationCode: 'Enter the verification code sent to your phone',
  createAccount: 'Create Account',
  creatingAccount: 'Creating Account...',
  verifying: 'Verifying...',
  verifyAndContinue: 'Verify & Continue',
  resendCode: '📩 Resend Verification Code',
  sending: 'Sending...',
  alreadyHaveAccount: 'Already have an account?',
  dontHaveAccount: "Don't have an account?",
  changeRole: '← Change Role',
  passwordMinChars: 'Password must be at least 8 characters',
  passwordsDoNotMatch: 'Passwords do not match',
  aadhaarLast4: 'Aadhaar (last 4 digits)',
  aadhaarHint: 'For identity verification purposes',
  setNewPassword: 'Set New Password',
  passwordChangeNotice: '⚠️ Please set a new password for your account',
  signingIn: 'Signing in...',
  settingPassword: 'Setting password...',
  newPassword: 'New Password',

  roleFarmer: 'Farmer / Owner',
  roleFarmerDesc: 'Livestock owner — enroll, manage & track your animals',
  roleVeterinarian: 'Veterinarian',
  roleVeterinarianDesc: 'Veterinary doctor — access animal health records',
  roleInsurer: 'Insurance Agent',
  roleInsurerDesc: 'Insurance provider — view insured livestock data',
  roleGovernment: 'Government Official',
  roleGovernmentDesc: 'Government body — oversight & regulatory access',
  roleAdmin: 'Administrator',
  roleAdminDesc: 'System administrator — full platform access',

  overview: 'Overview',
  requests: 'Requests',
  myAnimals: 'My Animals',
  loadingAnimals: 'Loading your animals...',
  noAnimalsYet: 'No animals enrolled yet.',
  enrollFirst: 'Enroll your first animal →',
  enrollNewAnimal: 'Enroll New Animal',
  myProfile: 'My Profile',
  animalsICanAccess: 'Animals I Can Access',
  requestAnimalAccess: 'Request Animal Access',
  requestAccessDesc: 'Request access from an animal owner to view their livestock data',
  livestockId: 'Livestock ID',
  reasonForAccess: 'Reason for access (e.g., health checkup)',
  requestAccess: 'Request Access',
  sendingRequest: 'Sending...',
  myRequests: 'My Requests',
  incomingAccessRequests: 'Incoming Access Requests',
  pending: 'pending',
  approve: 'Approve',
  deny: 'Deny',
  noAccessRequests: 'No access requests yet.',
  searchAnyAnimal: 'Search Any Animal',
  lookUpAnimal: 'Look Up Animal',
  enterLivestockId: 'Enter Livestock ID (e.g., PA-MMCEI8EW-2DEKAM)',
  searching: 'Searching...',
  animalFound: 'Animal Found',
  animalNotFound: 'Animal not found. Check the Livestock ID.',
  searchFailed: 'Search failed. Please try again.',
  viewFullDetails: 'View Full Details →',
  useSearchTab: 'Use the Search tab to look up any animal by Livestock ID.',
  breed: 'Breed',
  gender: 'Gender',
  age: 'Age',
  location: 'Location',
  species: 'Species',
  owner: 'Owner',
  unknown: 'Unknown',

  animalDetails: 'Animal Details',
  fillDetails: 'Fill in details for',
  speciesLabel: 'Species',
  breedLabel: 'Breed',
  genderLabel: 'Gender',
  ageMonths: 'Age (months)',
  colorPattern: 'Color Pattern',
  hornType: 'Horn Type',
  identifiableMarks: 'Identifiable Marks',
  village: 'Village',
  district: 'District',
  state: 'State',
  saveAndContinue: 'Save & Continue',
  skipForNow: 'Skip for Now',
  cattle: 'Cattle',
  buffalo: 'Buffalo',
  goat: 'Goat',
  sheep: 'Sheep',
  other: 'Other',
  male: 'Male',
  female: 'Female',
  selectGender: 'Select',
  uploadOrCapture: 'Upload or capture an animal photo',
  enrollAnimal: 'Enroll Animal',
  enrolling: 'Enrolling...',
  uploading: 'Uploading...',
  processing: 'Processing...',
  captureFromCamera: 'Capture from Camera',
  uploadFromGallery: 'Upload from Gallery',
  takePhoto: 'Take Photo',
  retake: 'Retake',
  usePhoto: 'Use Photo',
  dragDropHint: 'Drag & drop an image, or click to browse',
  animalEnrollment: 'Animal Enrollment',
  captureOrUploadDesc: "Capture or upload a clear photo of the animal's muzzle",
  enrollNotice: "You're enrolling without an owner account. The animal won't be linked to any owner.",
  gpsActive: 'GPS Active',
  gettingLocation: 'Getting location...',
  photoTips: 'Photo Tips',
  photoTip1: "Focus on the animal's muzzle/nose area",
  photoTip2: 'Ensure good lighting — avoid harsh shadows',
  photoTip3: 'Keep the camera steady for a sharp image',
  photoTip4: 'Use minimum 640×480 pixel resolution',
  saveAnimalDetails: 'Save Animal Details',
  enrollmentFailed: 'Enrollment failed. Please try again.',
  failedToSaveAnimal: "Failed to save animal details. You can update later from the dashboard.",

  personalDetails: 'Personal Details',
  memberSince: 'Member Since',
  accountStatus: 'Account Status',
  active: 'Active',
  pincode: 'Pincode',
  userId: 'User ID',
  phone: 'Phone',
  aadhaar: 'Aadhaar',
  profileUpdated: 'Profile updated successfully!',
  failedToLoadProfile: 'Failed to load profile',
  failedToUpdateProfile: 'Failed to update profile',
  failedToLoadDashboard: 'Failed to load dashboard data',
  saveChanges: 'Save Changes',
  loadingProfile: 'Loading profile...',
  backToDashboard: '← Dashboard',

  details: 'Details',
  health: 'Health',
  milk: 'Milk',
  insurance: 'Insurance',
  loans: 'Loans',
  noRecordsYet: 'No records yet.',
  addRecord: 'Add Record',
  addHealthRecord: 'Add Health Record',
  addMilkRecord: 'Add Milk Record',
  addInsurance: 'Add Insurance',
  addLoan: 'Add Loan',
  vaccineType: 'Vaccine Type',
  administeredBy: 'Administered By',
  recordDate: 'Record Date',
  nextDueDate: 'Next Due Date',
  notes: 'Notes',
  morningYield: 'Morning Yield (L)',
  eveningYield: 'Evening Yield (L)',
  totalYield: 'Total Yield',
  provider: 'Provider',
  policyNumber: 'Policy Number',
  coverageAmount: 'Coverage Amount',
  premium: 'Premium',
  startDate: 'Start Date',
  endDate: 'End Date',
  status: 'Status',
  lender: 'Lender',
  loanAmount: 'Loan Amount',
  interestRate: 'Interest Rate (%)',
  tenureMonths: 'Tenure (months)',
  disbursementDate: 'Disbursement Date',
  repaymentStatus: 'Repayment Status',
  enrolledAt: 'Enrolled At',
  gpsCoordinates: 'GPS Coordinates',
  ownerId: 'Owner ID',
  animalProfile: 'Animal Profile',
  editDetails: 'Edit Details',
  loadingAnimalData: 'Loading animal data...',
  animalNotFoundError: 'Animal not found',
  failedToLoadAnimal: 'Failed to load animal data',
  failedToUpdateAnimal: 'Failed to update animal details',
  failedToAddHealth: 'Failed to add health record',
  failedToAddMilk: 'Failed to add milk yield',
  failedToAddInsurance: 'Failed to add insurance policy',
  failedToAddLoan: 'Failed to add loan record',
  vaccination: 'Vaccination',
  checkup: 'Checkup',
  treatment: 'Treatment',
  deworming: 'Deworming',
  vaccine: 'Vaccine',
  date: 'Date',
  type: 'Type',
  saveRecord: 'Save Record',
  saveYield: 'Save Yield',
  savePolicy: 'Save Policy',
  saveLoan: 'Save Loan',
  noHealthRecords: 'No health records yet',
  noMilkRecords: 'No milk yield records yet',
  noInsurancePolicies: 'No insurance policies recorded',
  noLoanRecords: 'No loan records',
  addInsuranceHint: 'Add an insurance policy to track coverage for this animal',
  addLoanHint: 'Add a loan record to track livestock-backed financing',
  lenderBank: 'Lender / Bank',
  morningL: 'Morning (L)',
  eveningL: 'Evening (L)',
  totalL: 'Total (L)',
  enrolled: 'Enrolled',
  gpsLocation: 'GPS Location',
  nextDue: 'Next due',
  by: 'By',
  policyHash: 'Policy #',
  coverage: 'Coverage',
  interest: 'Interest',
  tenure: 'Tenure',
  amount: 'Amount',

  enrollmentSuccess: 'Enrollment Successful!',
  newAnimalRegistered: 'New animal has been registered',
  existingAnimalFound: 'Existing animal found in database',
  similarityScore: 'Similarity Score',
  enrollAnother: 'Enroll Another',
  viewAnimalDetails: 'View Animal Details',

  selectLanguage: 'Select Language',

  // Camera Capture
  captureAnimalPhoto: 'Capture Animal Photo',
  cameraPermissionError: 'Unable to access camera. Please allow camera permissions and try again.',
  retryCamera: 'Retry',
  flipCamera: 'Flip',
  captureBtn: 'Capture',
  cameraAutoCapHint: 'AI auto-captures when animal is clearly visible. Or tap Capture manually.',
  loadingAiModel: '🔄 Loading AI model...',
  aiModelUnavailable: '⚠️ AI model unavailable',
  lookingForAnimal: '🔍 Looking for animal...',
  perfectMuzzleShot: '✅ Perfect muzzle shot! Capturing...',

  // Image Upload
  changePhoto: 'Change Photo',
  uploadAnimalPhoto: 'Upload Animal Photo',
  uploadFormatHint: 'JPEG, PNG or WebP · Max 10 MB',
  browseFile: 'Browse File',
  invalidFileType: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
  fileTooLarge: 'File too large. Maximum size is 10 MB.',

  // Upload Progress
  uploadingImage: 'Uploading image',
  analyzingBiometrics: 'Analyzing animal biometrics...',
};

// ─── Hindi ──────────────────────────────────────────────────────────
const hi: Translations = {
  appName: 'पशु आधार AI',
  appNameHindi: 'पशु आधार',
  appSubtitle: 'पशुधन पहचान प्रणाली',
  home: 'होम',
  dashboard: 'डैशबोर्ड',
  signIn: 'साइन इन',
  signOut: 'साइन आउट',
  signUp: 'साइन अप',
  loading: 'लोड हो रहा है...',
  save: 'सहेजें',
  saving: 'सहेज रहे हैं...',
  cancel: 'रद्द करें',
  edit: 'संपादित करें',
  delete: 'हटाएं',
  submit: 'जमा करें',
  back: 'वापस',
  refresh: 'रिफ्रेश',
  search: 'खोजें',
  profile: 'प्रोफ़ाइल',
  close: 'बंद करें',

  heroTagline: 'पशु-आधार AI',
  heroBadge: '🇮🇳 डिजिटल इंडिया पहल',
  heroSubtitle: 'भारत की पहली AI-संचालित पशुधन बायोमेट्रिक पहचान प्रणाली। हर पशु की अद्वितीय पहचान के लिए सुरक्षित थूथन-पैटर्न पहचान।',
  createFreeAccount: 'मुफ़्त खाता बनाएं',
  getStarted: 'शुरू करें',
  goToDashboard: 'डैशबोर्ड पर जाएं',
  howItWorks: 'यह कैसे काम करता है',
  howItWorksDesc: 'किसी भी पशुधन की डिजिटल पहचान के लिए तीन सरल कदम',
  stepCapture: 'कैप्चर',
  stepCaptureDesc: 'अपने फोन कैमरे से पशु के थूथन की स्पष्ट तस्वीर लें',
  stepAnalyze: 'विश्लेषण',
  stepAnalyzeDesc: 'AI पशु का पता लगाता है, CLIP एम्बेडिंग के माध्यम से अद्वितीय बायोमेट्रिक पैटर्न निकालता है',
  stepIdentify: 'पहचान',
  stepIdentifyDesc: 'डेटाबेस से तत्काल मिलान — नया नामांकन या मौजूदा पशु सत्यापन',
  builtForStakeholders: 'हर हितधारक के लिए बना',
  stakeholderDesc: 'संपूर्ण पशुधन पारिस्थितिकी तंत्र के लिए भूमिका-आधारित पहुंच',
  poweredBy: 'इनसे संचालित',
  readyToDigitize: 'अपने पशुधन को डिजिटल करने के लिए तैयार?',
  readyToDigitizeDesc: 'आज ही पशु आधार नेटवर्क से जुड़ें — किसानों के लिए मुफ़्त।',
  animalsEnrolled: 'पशु नामांकित',
  farmersRegistered: 'किसान पंजीकृत',
  statesCovered: 'राज्य कवर',
  matchAccuracy: 'मिलान सटीकता',
  tryQuickEnrollment: 'त्वरित नामांकन',
  footer: '🐄 पशु आधार — पशु आधार AI © 2026 · ग्रामीण भारत के लिए बना 🇮🇳',

  chooseRole: 'शुरू करने के लिए अपनी भूमिका चुनें',
  fullName: 'पूरा नाम',
  phoneNumber: 'फ़ोन नंबर',
  password: 'पासवर्ड',
  confirmPassword: 'पासवर्ड की पुष्टि',
  verificationCode: 'सत्यापन कोड',
  enterVerificationCode: 'अपने फ़ोन पर भेजा गया सत्यापन कोड दर्ज करें',
  createAccount: 'खाता बनाएं',
  creatingAccount: 'खाता बना रहे हैं...',
  verifying: 'सत्यापित कर रहे हैं...',
  verifyAndContinue: 'सत्यापित करें और जारी रखें',
  resendCode: '📩 सत्यापन कोड पुनः भेजें',
  sending: 'भेज रहे हैं...',
  alreadyHaveAccount: 'पहले से खाता है?',
  dontHaveAccount: 'खाता नहीं है?',
  changeRole: '← भूमिका बदलें',
  passwordMinChars: 'पासवर्ड कम से कम 8 अक्षर का होना चाहिए',
  passwordsDoNotMatch: 'पासवर्ड मेल नहीं खाते',
  aadhaarLast4: 'आधार (अंतिम 4 अंक)',
  aadhaarHint: 'पहचान सत्यापन के लिए',
  setNewPassword: 'नया पासवर्ड सेट करें',
  passwordChangeNotice: '⚠️ कृपया अपने खाते के लिए नया पासवर्ड सेट करें',
  signingIn: 'साइन इन हो रहा है...',
  settingPassword: 'पासवर्ड सेट हो रहा है...',
  newPassword: 'नया पासवर्ड',

  roleFarmer: 'किसान / मालिक',
  roleFarmerDesc: 'पशुधन मालिक — अपने पशुओं का नामांकन, प्रबंधन और ट्रैकिंग',
  roleVeterinarian: 'पशु चिकित्सक',
  roleVeterinarianDesc: 'पशु चिकित्सक — पशु स्वास्थ्य रिकॉर्ड देखें',
  roleInsurer: 'बीमा एजेंट',
  roleInsurerDesc: 'बीमा प्रदाता — बीमित पशुधन डेटा देखें',
  roleGovernment: 'सरकारी अधिकारी',
  roleGovernmentDesc: 'सरकारी निकाय — निरीक्षण और नियामक पहुंच',
  roleAdmin: 'प्रशासक',
  roleAdminDesc: 'सिस्टम प्रशासक — पूर्ण प्लेटफ़ॉर्म पहुंच',

  overview: 'अवलोकन',
  requests: 'अनुरोध',
  myAnimals: 'मेरे पशु',
  loadingAnimals: 'आपके पशु लोड हो रहे हैं...',
  noAnimalsYet: 'अभी तक कोई पशु नामांकित नहीं है।',
  enrollFirst: 'अपना पहला पशु नामांकित करें →',
  enrollNewAnimal: 'नया पशु नामांकित करें',
  myProfile: 'मेरी प्रोफ़ाइल',
  animalsICanAccess: 'जिन पशुओं तक मेरी पहुंच है',
  requestAnimalAccess: 'पशु पहुंच का अनुरोध करें',
  requestAccessDesc: 'पशु मालिक से उनके पशुधन डेटा देखने के लिए अनुरोध करें',
  livestockId: 'पशुधन ID',
  reasonForAccess: 'पहुंच का कारण (जैसे, स्वास्थ्य जांच)',
  requestAccess: 'पहुंच का अनुरोध करें',
  sendingRequest: 'भेज रहे हैं...',
  myRequests: 'मेरे अनुरोध',
  incomingAccessRequests: 'आने वाले पहुंच अनुरोध',
  pending: 'लंबित',
  approve: 'स्वीकृत करें',
  deny: 'अस्वीकार करें',
  noAccessRequests: 'अभी तक कोई पहुंच अनुरोध नहीं।',
  searchAnyAnimal: 'कोई भी पशु खोजें',
  lookUpAnimal: 'पशु देखें',
  enterLivestockId: 'पशुधन ID दर्ज करें (जैसे, PA-MMCEI8EW-2DEKAM)',
  searching: 'खोज रहे हैं...',
  animalFound: 'पशु मिला',
  animalNotFound: 'पशु नहीं मिला। पशुधन ID जांचें।',
  searchFailed: 'खोज विफल। कृपया पुनः प्रयास करें।',
  viewFullDetails: 'पूरा विवरण देखें →',
  useSearchTab: 'पशुधन ID से किसी भी पशु को खोजने के लिए खोज टैब का उपयोग करें।',
  breed: 'नस्ल',
  gender: 'लिंग',
  age: 'आयु',
  location: 'स्थान',
  species: 'प्रजाति',
  owner: 'मालिक',
  unknown: 'अज्ञात',

  animalDetails: 'पशु विवरण',
  fillDetails: 'विवरण भरें',
  speciesLabel: 'प्रजाति',
  breedLabel: 'नस्ल',
  genderLabel: 'लिंग',
  ageMonths: 'आयु (महीने)',
  colorPattern: 'रंग पैटर्न',
  hornType: 'सींग प्रकार',
  identifiableMarks: 'पहचान चिह्न',
  village: 'गांव',
  district: 'जिला',
  state: 'राज्य',
  saveAndContinue: 'सहेजें और जारी रखें',
  skipForNow: 'अभी छोड़ें',
  cattle: 'गाय',
  buffalo: 'भैंस',
  goat: 'बकरी',
  sheep: 'भेड़',
  other: 'अन्य',
  male: 'नर',
  female: 'मादा',
  selectGender: 'चुनें',
  uploadOrCapture: 'पशु की तस्वीर अपलोड या कैप्चर करें',
  enrollAnimal: 'पशु नामांकित करें',
  enrolling: 'नामांकन हो रहा है...',
  uploading: 'अपलोड हो रहा है...',
  processing: 'प्रोसेसिंग...',
  captureFromCamera: 'कैमरे से कैप्चर करें',
  uploadFromGallery: 'गैलरी से अपलोड करें',
  takePhoto: 'फोटो लें',
  retake: 'फिर से लें',
  usePhoto: 'फोटो उपयोग करें',
  dragDropHint: 'चित्र खींचें और छोड़ें, या ब्राउज़ करने के लिए क्लिक करें',
  animalEnrollment: 'पशु नामांकन',
  captureOrUploadDesc: 'पशु के मुँह/नाक की स्पष्ट फोटो खींचें या अपलोड करें',
  enrollNotice: 'आप बिना मालिक खाते के नामांकन कर रहे हैं। पशु किसी मालिक से नहीं जुड़ेगा।',
  gpsActive: 'GPS सक्रिय',
  gettingLocation: 'स्थान प्राप्त हो रहा है...',
  photoTips: 'फोटो सुझाव',
  photoTip1: 'पशु के मुँह/नाक क्षेत्र पर ध्यान दें',
  photoTip2: 'अच्छी रोशनी सुनिश्चित करें — तेज छाया से बचें',
  photoTip3: 'स्पष्ट तस्वीर के लिए कैमरा स्थिर रखें',
  photoTip4: 'न्यूनतम 640×480 पिक्सेल रिज़ॉल्यूशन उपयोग करें',
  saveAnimalDetails: 'पशु विवरण सहेजें',
  enrollmentFailed: 'नामांकन विफल। कृपया पुनः प्रयास करें।',
  failedToSaveAnimal: 'पशु विवरण सहेजने में विफल। आप बाद में डैशबोर्ड से अपडेट कर सकते हैं।',

  personalDetails: 'व्यक्तिगत विवरण',
  memberSince: 'सदस्य बने',
  accountStatus: 'खाता स्थिति',
  active: 'सक्रिय',
  pincode: 'पिनकोड',
  userId: 'उपयोगकर्ता ID',
  phone: 'फ़ोन',
  aadhaar: 'आधार',
  profileUpdated: 'प्रोफ़ाइल सफलतापूर्वक अपडेट हुई!',
  failedToLoadProfile: 'प्रोफ़ाइल लोड करने में विफल',
  failedToUpdateProfile: 'प्रोफ़ाइल अपडेट करने में विफल',
  failedToLoadDashboard: 'डैशबोर्ड डेटा लोड करने में विफल',
  saveChanges: 'बदलाव सहेजें',
  loadingProfile: 'प्रोफ़ाइल लोड हो रही है...',
  backToDashboard: '← डैशबोर्ड',

  details: 'विवरण',
  health: 'स्वास्थ्य',
  milk: 'दूध',
  insurance: 'बीमा',
  loans: 'ऋण',
  noRecordsYet: 'अभी तक कोई रिकॉर्ड नहीं।',
  addRecord: 'रिकॉर्ड जोड़ें',
  addHealthRecord: 'स्वास्थ्य रिकॉर्ड जोड़ें',
  addMilkRecord: 'दूध रिकॉर्ड जोड़ें',
  addInsurance: 'बीमा जोड़ें',
  addLoan: 'ऋण जोड़ें',
  vaccineType: 'टीका प्रकार',
  administeredBy: 'द्वारा दिया गया',
  recordDate: 'रिकॉर्ड तिथि',
  nextDueDate: 'अगली देय तिथि',
  notes: 'नोट्स',
  morningYield: 'सुबह उत्पादन (ली)',
  eveningYield: 'शाम उत्पादन (ली)',
  totalYield: 'कुल उत्पादन',
  provider: 'प्रदाता',
  policyNumber: 'पॉलिसी नंबर',
  coverageAmount: 'कवरेज राशि',
  premium: 'प्रीमियम',
  startDate: 'शुरू तिथि',
  endDate: 'समाप्ति तिथि',
  status: 'स्थिति',
  lender: 'ऋणदाता',
  loanAmount: 'ऋण राशि',
  interestRate: 'ब्याज दर (%)',
  tenureMonths: 'अवधि (महीने)',
  disbursementDate: 'वितरण तिथि',
  repaymentStatus: 'भुगतान स्थिति',
  enrolledAt: 'नामांकन तिथि',
  gpsCoordinates: 'GPS निर्देशांक',
  ownerId: 'मालिक ID',
  animalProfile: 'पशु प्रोफ़ाइल',
  editDetails: 'विवरण संपादित करें',
  loadingAnimalData: 'पशु डेटा लोड हो रहा है...',
  animalNotFoundError: 'पशु नहीं मिला',
  failedToLoadAnimal: 'पशु डेटा लोड करने में विफल',
  failedToUpdateAnimal: 'पशु विवरण अपडेट करने में विफल',
  failedToAddHealth: 'स्वास्थ्य रिकॉर्ड जोड़ने में विफल',
  failedToAddMilk: 'दूध उत्पादन जोड़ने में विफल',
  failedToAddInsurance: 'बीमा पॉलिसी जोड़ने में विफल',
  failedToAddLoan: 'ऋण रिकॉर्ड जोड़ने में विफल',
  vaccination: 'टीकाकरण',
  checkup: 'जांच',
  treatment: 'उपचार',
  deworming: 'कृमिनाशन',
  vaccine: 'टीका',
  date: 'तिथि',
  type: 'प्रकार',
  saveRecord: 'रिकॉर्ड सहेजें',
  saveYield: 'उत्पादन सहेजें',
  savePolicy: 'पॉलिसी सहेजें',
  saveLoan: 'ऋण सहेजें',
  noHealthRecords: 'अभी तक कोई स्वास्थ्य रिकॉर्ड नहीं',
  noMilkRecords: 'अभी तक कोई दूध उत्पादन रिकॉर्ड नहीं',
  noInsurancePolicies: 'कोई बीमा पॉलिसी दर्ज नहीं',
  noLoanRecords: 'कोई ऋण रिकॉर्ड नहीं',
  addInsuranceHint: 'इस पशु के कवरेज को ट्रैक करने के लिए बीमा पॉलिसी जोड़ें',
  addLoanHint: 'पशुधन-समर्थित वित्तपोषण को ट्रैक करने के लिए ऋण रिकॉर्ड जोड़ें',
  lenderBank: 'ऋणदाता / बैंक',
  morningL: 'सुबह (ली)',
  eveningL: 'शाम (ली)',
  totalL: 'कुल (ली)',
  enrolled: 'नामांकित',
  gpsLocation: 'GPS स्थान',
  nextDue: 'अगली तिथि',
  by: 'द्वारा',
  policyHash: 'पॉलिसी #',
  coverage: 'कवरेज',
  interest: 'ब्याज',
  tenure: 'अवधि',
  amount: 'राशि',

  enrollmentSuccess: 'नामांकन सफल!',
  newAnimalRegistered: 'नया पशु पंजीकृत हो गया है',
  existingAnimalFound: 'मौजूदा पशु डेटाबेस में मिला',
  similarityScore: 'समानता स्कोर',
  enrollAnother: 'एक और नामांकित करें',
  viewAnimalDetails: 'पशु विवरण देखें',

  selectLanguage: 'भाषा चुनें',

  captureAnimalPhoto: 'पशु का फोटो खींचें',
  cameraPermissionError: 'कैमरा एक्सेस करने में असमर्थ। कृपया कैमरा अनुमति दें और पुनः प्रयास करें।',
  retryCamera: 'पुनः प्रयास',
  flipCamera: 'फ्लिप',
  captureBtn: 'कैप्चर',
  cameraAutoCapHint: 'जब पशु स्पष्ट दिखे तो AI स्वतः कैप्चर करता है। या मैन्युअल कैप्चर दबाएं।',
  loadingAiModel: '🔄 AI मॉडल लोड हो रहा है...',
  aiModelUnavailable: '⚠️ AI मॉडल उपलब्ध नहीं',
  lookingForAnimal: '🔍 पशु की तलाश...',
  perfectMuzzleShot: '✅ सटीक थूथन फोटो! कैप्चर हो रहा है...',

  changePhoto: 'फोटो बदलें',
  uploadAnimalPhoto: 'पशु का फोटो अपलोड करें',
  uploadFormatHint: 'JPEG, PNG या WebP · अधिकतम 10 MB',
  browseFile: 'फाइल चुनें',
  invalidFileType: 'अमान्य फ़ाइल प्रकार। कृपया JPEG, PNG या WebP छवि अपलोड करें।',
  fileTooLarge: 'फ़ाइल बहुत बड़ी है। अधिकतम आकार 10 MB है।',

  uploadingImage: 'छवि अपलोड हो रही है',
  analyzingBiometrics: 'पशु बायोमेट्रिक्स का विश्लेषण...',
};

// ─── Telugu ─────────────────────────────────────────────────────────
const te: Translations = {
  appName: 'పశు ఆధార్ AI',
  appNameHindi: 'पशु आधार',
  appSubtitle: 'పశువుల గుర్తింపు వ్యవస్థ',
  home: 'హోమ్',
  dashboard: 'డాష్‌బోర్డ్',
  signIn: 'సైన్ ఇన్',
  signOut: 'సైన్ అవుట్',
  signUp: 'సైన్ అప్',
  loading: 'లోడ్ అవుతోంది...',
  save: 'సేవ్',
  saving: 'సేవ్ చేస్తోంది...',
  cancel: 'రద్దు',
  edit: 'మార్చు',
  delete: 'తొలగించు',
  submit: 'సమర్పించు',
  back: 'వెనక్కి',
  refresh: 'రిఫ్రెష్',
  search: 'వెతుకు',
  profile: 'ప్రొఫైల్',
  close: 'మూసివేయి',

  heroTagline: 'పశు-ఆధార్ AI',
  heroBadge: '🇮🇳 డిజిటల్ ఇండియా చొరవ',
  heroSubtitle: 'భారతదేశ మొదటి AI-ఆధారిత పశువుల బయోమెట్రిక్ గుర్తింపు వ్యవస్థ. ప్రతి పశువును ప్రత్యేకంగా గుర్తించడానికి సురక్షిత మూతి-నమూనా గుర్తింపు.',
  createFreeAccount: 'ఉచిత ఖాతా సృష్టించండి',
  getStarted: 'ప్రారంభించండి',
  goToDashboard: 'డాష్‌బోర్డ్‌కు వెళ్ళు',
  howItWorks: 'ఇది ఎలా పనిచేస్తుంది',
  howItWorksDesc: 'ఏదైనా పశువును డిజిటల్‌గా గుర్తించడానికి మూడు సులభ దశలు',
  stepCapture: 'క్యాప్చర్',
  stepCaptureDesc: 'మీ ఫోన్ కెమెరాతో పశువు మూతి యొక్క స్పష్టమైన ఫోటో తీయండి',
  stepAnalyze: 'విశ్లేషణ',
  stepAnalyzeDesc: 'AI పశువును గుర్తిస్తుంది, CLIP ఎంబెడ్డింగ్‌ల ద్వారా ప్రత్యేక బయోమెట్రిక్ నమూనాలను సంగ్రహిస్తుంది',
  stepIdentify: 'గుర్తింపు',
  stepIdentifyDesc: 'డేటాబేస్‌తో తక్షణ మ్యాచింగ్ — కొత్తది నమోదు చేయండి లేదా ఉన్నవాటిని ధృవీకరించండి',
  builtForStakeholders: 'ప్రతి వాటాదారుల కోసం నిర్మించబడింది',
  stakeholderDesc: 'మొత్తం పశువుల పర్యావరణ వ్యవస్థ కోసం పాత్ర-ఆధారిత యాక్సెస్',
  poweredBy: 'దీని ద్వారా నడుస్తోంది',
  readyToDigitize: 'మీ పశువులను డిజిటల్ చేయడానికి సిద్ధంగా ఉన్నారా?',
  readyToDigitizeDesc: 'ఈ రోజే పశు ఆధార్ నెట్‌వర్క్‌లో చేరండి — రైతులకు ఉచితం.',
  animalsEnrolled: 'పశువులు నమోదు',
  farmersRegistered: 'రైతులు నమోదు',
  statesCovered: 'రాష్ట్రాలు కవర్',
  matchAccuracy: 'మ్యాచ్ ఖచ్చితత్వం',
  tryQuickEnrollment: 'త్వరిత నమోదు',
  footer: '🐄 పశు ఆధార్ — పశు ఆధార్ AI © 2026 · గ్రామీణ భారతం కోసం నిర్మించబడింది 🇮🇳',

  chooseRole: 'ప్రారంభించడానికి మీ పాత్రను ఎంచుకోండి',
  fullName: 'పూర్తి పేరు',
  phoneNumber: 'ఫోన్ నంబర్',
  password: 'పాస్‌వర్డ్',
  confirmPassword: 'పాస్‌వర్డ్ నిర్ధారించండి',
  verificationCode: 'ధృవీకరణ కోడ్',
  enterVerificationCode: 'మీ ఫోన్‌కు పంపిన ధృవీకరణ కోడ్‌ను నమోదు చేయండి',
  createAccount: 'ఖాతా సృష్టించండి',
  creatingAccount: 'ఖాతా సృష్టిస్తోంది...',
  verifying: 'ధృవీకరిస్తోంది...',
  verifyAndContinue: 'ధృవీకరించి కొనసాగించండి',
  resendCode: '📩 ధృవీకరణ కోడ్ మళ్ళీ పంపండి',
  sending: 'పంపుతోంది...',
  alreadyHaveAccount: 'ఇప్పటికే ఖాతా ఉందా?',
  dontHaveAccount: 'ఖాతా లేదా?',
  changeRole: '← పాత్ర మార్చు',
  passwordMinChars: 'పాస్‌వర్డ్ కనీసం 8 అక్షరాలు ఉండాలి',
  passwordsDoNotMatch: 'పాస్‌వర్డ్‌లు సరిపోలడం లేదు',
  aadhaarLast4: 'ఆధార్ (చివరి 4 అంకెలు)',
  aadhaarHint: 'గుర్తింపు ధృవీకరణ కోసం',
  setNewPassword: 'కొత్త పాస్‌వర్డ్ సెట్ చేయండి',
  passwordChangeNotice: '⚠️ దయచేసి మీ ఖాతా కోసం కొత్త పాస్‌వర్డ్ సెట్ చేయండి',
  signingIn: 'సైన్ ఇన్ అవుతోంది...',
  settingPassword: 'పాస్‌వర్డ్ సెట్ అవుతోంది...',
  newPassword: 'కొత్త పాస్‌వర్డ్',

  roleFarmer: 'రైతు / యజమాని',
  roleFarmerDesc: 'పశువుల యజమాని — మీ పశువులను నమోదు, నిర్వహణ & ట్రాక్ చేయండి',
  roleVeterinarian: 'పశు వైద్యుడు',
  roleVeterinarianDesc: 'పశు వైద్యుడు — పశు ఆరోగ్య రికార్డులు యాక్సెస్ చేయండి',
  roleInsurer: 'బీమా ఏజెంట్',
  roleInsurerDesc: 'బీమా ప్రదాత — బీమా పశువుల డేటా చూడండి',
  roleGovernment: 'ప్రభుత్వ అధికారి',
  roleGovernmentDesc: 'ప్రభుత్వ సంస్థ — పర్యవేక్షణ & నియంత్రణ యాక్సెస్',
  roleAdmin: 'అడ్మినిస్ట్రేటర్',
  roleAdminDesc: 'సిస్టమ్ అడ్మినిస్ట్రేటర్ — పూర్తి ప్లాట్‌ఫారమ్ యాక్సెస్',

  overview: 'అవలోకనం',
  requests: 'అభ్యర్థనలు',
  myAnimals: 'నా పశువులు',
  loadingAnimals: 'మీ పశువులు లోడ్ అవుతున్నాయి...',
  noAnimalsYet: 'ఇంకా పశువులు నమోదు కాలేదు.',
  enrollFirst: 'మీ మొదటి పశువును నమోదు చేయండి →',
  enrollNewAnimal: 'కొత్త పశువు నమోదు',
  myProfile: 'నా ప్రొఫైల్',
  animalsICanAccess: 'నేను యాక్సెస్ చేయగల పశువులు',
  requestAnimalAccess: 'పశువు యాక్సెస్ అభ్యర్థన',
  requestAccessDesc: 'పశువుల యజమాని నుండి వారి పశువుల డేటా చూడటానికి యాక్సెస్ అభ్యర్థించండి',
  livestockId: 'పశువు ID',
  reasonForAccess: 'యాక్సెస్ కారణం (ఉదా., ఆరోగ్య తనిఖీ)',
  requestAccess: 'యాక్సెస్ అభ్యర్థించు',
  sendingRequest: 'పంపుతోంది...',
  myRequests: 'నా అభ్యర్థనలు',
  incomingAccessRequests: 'వచ్చిన యాక్సెస్ అభ్యర్థనలు',
  pending: 'పెండింగ్',
  approve: 'ఆమోదించు',
  deny: 'తిరస్కరించు',
  noAccessRequests: 'ఇంకా యాక్సెస్ అభ్యర్థనలు లేవు.',
  searchAnyAnimal: 'ఏదైనా పశువును వెతుకు',
  lookUpAnimal: 'పశువు చూడు',
  enterLivestockId: 'పశువు ID నమోదు చేయండి (ఉదా., PA-MMCEI8EW-2DEKAM)',
  searching: 'వెతుకుతోంది...',
  animalFound: 'పశువు కనుగొనబడింది',
  animalNotFound: 'పశువు కనుగొనబడలేదు. పశువు ID తనిఖీ చేయండి.',
  searchFailed: 'వెతకడం విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి.',
  viewFullDetails: 'పూర్తి వివరాలు చూడండి →',
  useSearchTab: 'పశువు ID ద్వారా ఏదైనా పశువును చూడటానికి వెతుకు ట్యాబ్ ఉపయోగించండి.',
  breed: 'జాతి',
  gender: 'లింగం',
  age: 'వయసు',
  location: 'ప్రదేశం',
  species: 'జాతి',
  owner: 'యజమాని',
  unknown: 'తెలియదు',

  animalDetails: 'పశువు వివరాలు',
  fillDetails: 'వివరాలు నింపండి',
  speciesLabel: 'జాతి',
  breedLabel: 'జాతి',
  genderLabel: 'లింగం',
  ageMonths: 'వయసు (నెలలు)',
  colorPattern: 'రంగు నమూనా',
  hornType: 'కొమ్ము రకం',
  identifiableMarks: 'గుర్తింపు గుర్తులు',
  village: 'గ్రామం',
  district: 'జిల్లా',
  state: 'రాష్ట్రం',
  saveAndContinue: 'సేవ్ చేసి కొనసాగించు',
  skipForNow: 'ప్రస్తుతం దాటవేయి',
  cattle: 'ఆవు',
  buffalo: 'గేదె',
  goat: 'మేక',
  sheep: 'గొర్రె',
  other: 'ఇతరం',
  male: 'మగ',
  female: 'ఆడ',
  selectGender: 'ఎంచుకోండి',
  uploadOrCapture: 'పశువు ఫోటో అప్‌లోడ్ లేదా క్యాప్చర్ చేయండి',
  enrollAnimal: 'పశువు నమోదు',
  enrolling: 'నమోదు అవుతోంది...',
  uploading: 'అప్‌లోడ్ అవుతోంది...',
  processing: 'ప్రాసెస్ అవుతోంది...',
  captureFromCamera: 'కెమెరా నుండి క్యాప్చర్',
  uploadFromGallery: 'గ్యాలరీ నుండి అప్‌లోడ్',
  takePhoto: 'ఫోటో తీయండి',
  retake: 'మళ్ళీ తీయండి',
  usePhoto: 'ఫోటో ఉపయోగించండి',
  dragDropHint: 'చిత్రాన్ని డ్రాగ్ & డ్రాప్ చేయండి, లేదా బ్రౌజ్ చేయడానికి క్లిక్ చేయండి',
  animalEnrollment: 'పశువు నమోదు',
  captureOrUploadDesc: 'పశువు ముఖం/ముక్కు యొక్క స్పష్టమైన ఫోటో తీయండి లేదా అప్‌లోడ్ చేయండి',
  enrollNotice: 'మీరు యజమాని ఖాతా లేకుండా నమోదు చేస్తున్నారు. పశువు ఏ యజమానికి లింక్ కాదు.',
  gpsActive: 'GPS యాక్టివ్',
  gettingLocation: 'స్థానం పొందుతోంది...',
  photoTips: 'ఫోటో చిట్కాలు',
  photoTip1: 'పశువు ముఖం/ముక్కు ప్రాంతంపై దృష్టి పెట్టండి',
  photoTip2: 'మంచి వెలుతురు ఉండేలా చూసుకోండి — తీవ్రమైన నీడలను నివారించండి',
  photoTip3: 'స్పష్టమైన చిత్రం కోసం కెమెరాను స్థిరంగా ఉంచండి',
  photoTip4: 'కనీసం 640×480 పిక్సెల్ రిజల్యూషన్ ఉపయోగించండి',
  saveAnimalDetails: 'పశువు వివరాలు సేవ్ చేయండి',
  enrollmentFailed: 'నమోదు విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి.',
  failedToSaveAnimal: 'పశువు వివరాలు సేవ్ చేయడం విఫలమైంది. డ్యాష్‌బోర్డ్ నుండి తర్వాత అప్‌డేట్ చేయవచ్చు.',

  personalDetails: 'వ్యక్తిగత వివరాలు',
  memberSince: 'సభ్యుడు అప్పటి నుండి',
  accountStatus: 'ఖాతా స్థితి',
  active: 'యాక్టివ్',
  pincode: 'పిన్‌కోడ్',
  userId: 'యూజర్ ID',
  phone: 'ఫోన్',
  aadhaar: 'ఆధార్',
  profileUpdated: 'ప్రొఫైల్ విజయవంతంగా నవీకరించబడింది!',
  failedToLoadProfile: 'ప్రొఫైల్ లోడ్ చేయడం విఫలమైంది',
  failedToUpdateProfile: 'ప్రొఫైల్ నవీకరించడం విఫలమైంది',
  failedToLoadDashboard: 'డ్యాష్‌బోర్డ్ డేటా లోడ్ చేయడం విఫలమైంది',
  saveChanges: 'మార్పులు సేవ్ చేయండి',
  loadingProfile: 'ప్రొఫైల్ లోడ్ అవుతోంది...',
  backToDashboard: '← డ్యాష్‌బోర్డ్',

  details: 'వివరాలు',
  health: 'ఆరోగ్యం',
  milk: 'పాలు',
  insurance: 'బీమా',
  loans: 'రుణాలు',
  noRecordsYet: 'ఇంకా రికార్డులు లేవు.',
  addRecord: 'రికార్డు జోడించు',
  addHealthRecord: 'ఆరోగ్య రికార్డు జోడించు',
  addMilkRecord: 'పాల రికార్డు జోడించు',
  addInsurance: 'బీమా జోడించు',
  addLoan: 'రుణం జోడించు',
  vaccineType: 'టీకా రకం',
  administeredBy: 'ఇచ్చినవారు',
  recordDate: 'రికార్డు తేదీ',
  nextDueDate: 'తదుపరి గడువు తేదీ',
  notes: 'నోట్స్',
  morningYield: 'ఉదయం ఉత్పత్తి (లీ)',
  eveningYield: 'సాయంత్రం ఉత్పత్తి (లీ)',
  totalYield: 'మొత్తం ఉత్పత్తి',
  provider: 'ప్రదాత',
  policyNumber: 'పాలసీ నంబర్',
  coverageAmount: 'కవరేజ్ మొత్తం',
  premium: 'ప్రీమియం',
  startDate: 'ప్రారంభ తేదీ',
  endDate: 'ముగింపు తేదీ',
  status: 'స్థితి',
  lender: 'రుణదాత',
  loanAmount: 'రుణ మొత్తం',
  interestRate: 'వడ్డీ రేటు (%)',
  tenureMonths: 'వ్యవధి (నెలలు)',
  disbursementDate: 'పంపిణీ తేదీ',
  repaymentStatus: 'చెల్లింపు స్థితి',
  enrolledAt: 'నమోదు తేదీ',
  gpsCoordinates: 'GPS కోఆర్డినేట్‌లు',
  ownerId: 'యజమాని ID',
  animalProfile: 'పశువు ప్రొఫైల్',
  editDetails: 'వివరాలు మార్చు',
  loadingAnimalData: 'పశువు డేటా లోడ్ అవుతోంది...',
  animalNotFoundError: 'పశువు కనుగొనబడలేదు',
  failedToLoadAnimal: 'పశువు డేటా లోడ్ చేయడం విఫలమైంది',
  failedToUpdateAnimal: 'పశువు వివరాలు అప్‌డేట్ చేయడం విఫలమైంది',
  failedToAddHealth: 'ఆరోగ్య రికార్డ్ జోడించడం విఫలమైంది',
  failedToAddMilk: 'పాల దిగుబడి జోడించడం విఫలమైంది',
  failedToAddInsurance: 'బీమా పాలసీ జోడించడం విఫలమైంది',
  failedToAddLoan: 'రుణ రికార్డ్ జోడించడం విఫలమైంది',
  vaccination: 'టీకాకరణ',
  checkup: 'చెకప్',
  treatment: 'చికిత్స',
  deworming: 'డీవార్మింగ్',
  vaccine: 'టీకా',
  date: 'తేదీ',
  type: 'రకం',
  saveRecord: 'రికార్డ్ సేవ్ చేయండి',
  saveYield: 'దిగుబడి సేవ్ చేయండి',
  savePolicy: 'పాలసీ సేవ్ చేయండి',
  saveLoan: 'రుణం సేవ్ చేయండి',
  noHealthRecords: 'ఇంకా ఆరోగ్య రికార్డులు లేవు',
  noMilkRecords: 'ఇంకా పాల దిగుబడి రికార్డులు లేవు',
  noInsurancePolicies: 'బీమా పాలసీలు నమోదు కాలేదు',
  noLoanRecords: 'రుణ రికార్డులు లేవు',
  addInsuranceHint: 'ఈ పశువుకు కవరేజ్ ట్రాక్ చేయడానికి బీమా పాలసీ జోడించండి',
  addLoanHint: 'పశుధన-ఆధారిత ఆర్థిక సహాయాన్ని ట్రాక్ చేయడానికి రుణ రికార్డ్ జోడించండి',
  lenderBank: 'రుణదాత / బ్యాంక్',
  morningL: 'ఉదయం (లీ)',
  eveningL: 'సాయంత్రం (లీ)',
  totalL: 'మొత్తం (లీ)',
  enrolled: 'నమోదు',
  gpsLocation: 'GPS స్థానం',
  nextDue: 'తదుపరి తేదీ',
  by: 'ద్వారా',
  policyHash: 'పాలసీ #',
  coverage: 'కవరేజ్',
  interest: 'వడ్డీ',
  tenure: 'కాలవ్యవధి',
  amount: 'మొత్తం',

  enrollmentSuccess: 'నమోదు విజయవంతం!',
  newAnimalRegistered: 'కొత్త పశువు నమోదు చేయబడింది',
  existingAnimalFound: 'ఇప్పటికే ఉన్న పశువు డేటాబేస్‌లో కనుగొనబడింది',
  similarityScore: 'సారూప్యత స్కోరు',
  enrollAnother: 'మరొకటి నమోదు చేయు',
  viewAnimalDetails: 'పశువు వివరాలు చూడు',

  selectLanguage: 'భాషను ఎంచుకోండి',

  captureAnimalPhoto: 'పశువు ఫోటో తీయండి',
  cameraPermissionError: 'కెమెరాను యాక్సెస్ చేయలేకపోయింది. దయచేసి కెమెరా అనుమతులను ఇచ్చి మళ్లీ ప్రయత్నించండి.',
  retryCamera: 'మళ్ళీ ప్రయత్నించు',
  flipCamera: 'తిప్పు',
  captureBtn: 'క్యాప్చర్',
  cameraAutoCapHint: 'పశువు స్పష్టంగా కనిపించినప్పుడు AI స్వయంచాలకంగా క్యాప్చర్ చేస్తుంది. లేదా క్యాప్చర్ నొక్కండి.',
  loadingAiModel: '🔄 AI మోడల్ లోడ్ అవుతోంది...',
  aiModelUnavailable: '⚠️ AI మోడల్ అందుబాటులో లేదు',
  lookingForAnimal: '🔍 పశువు కోసం వెతుకుతోంది...',
  perfectMuzzleShot: '✅ ఖచ్చితమైన ముఖం ఫోటో! క్యాప్చర్ అవుతోంది...',

  changePhoto: 'ఫోటో మార్చు',
  uploadAnimalPhoto: 'పశువు ఫోటో అప్‌లోడ్ చేయండి',
  uploadFormatHint: 'JPEG, PNG లేదా WebP · గరిష్టం 10 MB',
  browseFile: 'ఫైల్ ఎంచుకోండి',
  invalidFileType: 'చెల్లని ఫైల్ రకం. దయచేసి JPEG, PNG లేదా WebP చిత్రాన్ని అప్‌లోడ్ చేయండి.',
  fileTooLarge: 'ఫైల్ చాలా పెద్దది. గరిష్ట పరిమాణం 10 MB.',

  uploadingImage: 'చిత్రం అప్‌లోడ్ అవుతోంది',
  analyzingBiometrics: 'పశువు బయోమెట్రిక్స్ విశ్లేషిస్తోంది...',
};

// ─── Tamil ──────────────────────────────────────────────────────────
const ta: Translations = {
  appName: 'பசு ஆதார் AI',
  appNameHindi: 'पशु आधार',
  appSubtitle: 'கால்நடை அடையாள அமைப்பு',
  home: 'முகப்பு',
  dashboard: 'டாஷ்போர்டு',
  signIn: 'உள்நுழைவு',
  signOut: 'வெளியேறு',
  signUp: 'பதிவு செய்',
  loading: 'ஏற்றுகிறது...',
  save: 'சேமி',
  saving: 'சேமிக்கிறது...',
  cancel: 'ரத்து',
  edit: 'திருத்து',
  delete: 'நீக்கு',
  submit: 'சமர்ப்பி',
  back: 'பின்னால்',
  refresh: 'புதுப்பி',
  search: 'தேடு',
  profile: 'சுயவிவரம்',
  close: 'மூடு',

  heroTagline: 'பசு-ஆதார் AI',
  heroBadge: '🇮🇳 டிஜிட்டல் இந்தியா முயற்சி',
  heroSubtitle: 'இந்தியாவின் முதல் AI-இயக்க கால்நடை பயோமெட்ரிக் அடையாள அமைப்பு. ஒவ்வொரு விலங்கையும் தனித்துவமாக அடையாளம் காண பாதுகாப்பான மூக்கு-வடிவ அங்கீகாரம்.',
  createFreeAccount: 'இலவச கணக்கை உருவாக்கு',
  getStarted: 'தொடங்குங்கள்',
  goToDashboard: 'டாஷ்போர்டுக்கு செல்',
  howItWorks: 'இது எப்படி செயல்படுகிறது',
  howItWorksDesc: 'எந்த கால்நடையையும் டிஜிட்டல் முறையில் அடையாளம் காண மூன்று எளிய படிகள்',
  stepCapture: 'படமெடு',
  stepCaptureDesc: 'உங்கள் தொலைபேசி கேமராவில் விலங்கின் மூக்கின் தெளிவான புகைப்படம் எடுங்கள்',
  stepAnalyze: 'பகுப்பாய்வு',
  stepAnalyzeDesc: 'AI விலங்கைக் கண்டறிகிறது, CLIP உட்பொதிப்புகள் வழியாக தனித்துவ பயோமெட்ரிக் வடிவங்களைப் பிரிக்கிறது',
  stepIdentify: 'அடையாளம்',
  stepIdentifyDesc: 'தரவுத்தளத்துடன் உடனடி பொருத்தம் — புதிதாகப் பதிவு செய்யுங்கள் அல்லது இருப்பவற்றை சரிபாருங்கள்',
  builtForStakeholders: 'ஒவ்வொரு பங்குதாரருக்கும் உருவாக்கப்பட்டது',
  stakeholderDesc: 'முழு கால்நடை சுற்றுச்சூழலுக்கான பங்கு-அடிப்படை அணுகல்',
  poweredBy: 'இயக்குவது',
  readyToDigitize: 'உங்கள் கால்நடைகளை டிஜிட்டல் செய்ய தயாரா?',
  readyToDigitizeDesc: 'இன்றே பசு ஆதார் நெட்வொர்க்கில் சேருங்கள் — விவசாயிகளுக்கு இலவசம்.',
  animalsEnrolled: 'பதிவு செய்த விலங்குகள்',
  farmersRegistered: 'பதிவு செய்த விவசாயிகள்',
  statesCovered: 'மாநிலங்கள் உள்ளடக்கம்',
  matchAccuracy: 'பொருத்த துல்லியம்',
  tryQuickEnrollment: 'விரைவு பதிவு',
  footer: '🐄 பசு ஆதார் — பசு ஆதார் AI © 2026 · கிராமப்புற இந்தியாவுக்காக உருவாக்கப்பட்டது 🇮🇳',

  chooseRole: 'தொடங்க உங்கள் பங்கை தேர்ந்தெடுங்கள்',
  fullName: 'முழு பெயர்',
  phoneNumber: 'தொலைபேசி எண்',
  password: 'கடவுச்சொல்',
  confirmPassword: 'கடவுச்சொல் உறுதிப்படுத்து',
  verificationCode: 'சரிபார்ப்பு குறியீடு',
  enterVerificationCode: 'உங்கள் தொலைபேசிக்கு அனுப்பிய சரிபார்ப்பு குறியீட்டை உள்ளிடுங்கள்',
  createAccount: 'கணக்கை உருவாக்கு',
  creatingAccount: 'கணக்கை உருவாக்குகிறது...',
  verifying: 'சரிபார்க்கிறது...',
  verifyAndContinue: 'சரிபார்த்து தொடரு',
  resendCode: '📩 சரிபார்ப்பு குறியீட்டை மீண்டும் அனுப்பு',
  sending: 'அனுப்புகிறது...',
  alreadyHaveAccount: 'ஏற்கனவே கணக்கு உள்ளதா?',
  dontHaveAccount: 'கணக்கு இல்லையா?',
  changeRole: '← பங்கை மாற்று',
  passwordMinChars: 'கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்',
  passwordsDoNotMatch: 'கடவுச்சொற்கள் பொருந்தவில்லை',
  aadhaarLast4: 'ஆதார் (கடைசி 4 இலக்கங்கள்)',
  aadhaarHint: 'அடையாள சரிபார்ப்பு நோக்கங்களுக்காக',
  setNewPassword: 'புதிய கடவுச்சொல் அமை',
  passwordChangeNotice: '⚠️ உங்கள் கணக்கிற்கு புதிய கடவுச்சொல் அமைக்கவும்',
  signingIn: 'உள்நுழைகிறது...',
  settingPassword: 'கடவுச்சொல் அமைக்கிறது...',
  newPassword: 'புதிய கடவுச்சொல்',

  roleFarmer: 'விவசாயி / உரிமையாளர்',
  roleFarmerDesc: 'கால்நடை உரிமையாளர் — உங்கள் விலங்குகளை பதிவு, நிர்வகிக்க & கண்காணிக்க',
  roleVeterinarian: 'கால்நடை மருத்துவர்',
  roleVeterinarianDesc: 'கால்நடை மருத்துவர் — விலங்கு சுகாதார பதிவுகளை அணுகு',
  roleInsurer: 'காப்பீட்டு முகவர்',
  roleInsurerDesc: 'காப்பீட்டு வழங்குநர் — காப்பீடு செய்யப்பட்ட கால்நடை தரவை பார்',
  roleGovernment: 'அரசு அதிகாரி',
  roleGovernmentDesc: 'அரசு அமைப்பு — மேற்பார்வை & ஒழுங்குமுறை அணுகல்',
  roleAdmin: 'நிர்வாகி',
  roleAdminDesc: 'கணினி நிர்வாகி — முழு தளம் அணுகல்',

  overview: 'கண்ணோட்டம்',
  requests: 'கோரிக்கைகள்',
  myAnimals: 'என் விலங்குகள்',
  loadingAnimals: 'உங்கள் விலங்குகள் ஏற்றுகின்றன...',
  noAnimalsYet: 'இன்னும் விலங்குகள் பதிவு செய்யப்படவில்லை.',
  enrollFirst: 'உங்கள் முதல் விலங்கை பதிவு செய்யுங்கள் →',
  enrollNewAnimal: 'புதிய விலங்கை பதிவு செய்',
  myProfile: 'என் சுயவிவரம்',
  animalsICanAccess: 'நான் அணுகக்கூடிய விலங்குகள்',
  requestAnimalAccess: 'விலங்கு அணுகல் கோரிக்கை',
  requestAccessDesc: 'விலங்கு உரிமையாளரிடம் அவர்களின் கால்நடை தரவைப் பார்க்க அணுகலைக் கோரு',
  livestockId: 'கால்நடை ID',
  reasonForAccess: 'அணுகல் காரணம் (எ.கா., சுகாதார பரிசோதனை)',
  requestAccess: 'அணுகல் கோரு',
  sendingRequest: 'அனுப்புகிறது...',
  myRequests: 'என் கோரிக்கைகள்',
  incomingAccessRequests: 'வரும் அணுகல் கோரிக்கைகள்',
  pending: 'நிலுவையில்',
  approve: 'ஒப்புக்கொள்',
  deny: 'மறு',
  noAccessRequests: 'இதுவரை அணுகல் கோரிக்கைகள் இல்லை.',
  searchAnyAnimal: 'எந்த விலங்கையும் தேடு',
  lookUpAnimal: 'விலங்கை பார்',
  enterLivestockId: 'கால்நடை ID உள்ளிடுங்கள் (எ.கா., PA-MMCEI8EW-2DEKAM)',
  searching: 'தேடுகிறது...',
  animalFound: 'விலங்கு கண்டுபிடிக்கப்பட்டது',
  animalNotFound: 'விலங்கு கண்டுபிடிக்கப்படவில்லை. கால்நடை ID-ஐ சரிபாருங்கள்.',
  searchFailed: 'தேடல் தோல்வி. மீண்டும் முயற்சிக்கவும்.',
  viewFullDetails: 'முழு விவரங்களைப் பார் →',
  useSearchTab: 'கால்நடை ID மூலம் எந்த விலங்கையும் பார்க்க தேடல் தாவலைப் பயன்படுத்துங்கள்.',
  breed: 'இனம்',
  gender: 'பாலினம்',
  age: 'வயது',
  location: 'இடம்',
  species: 'இனம்',
  owner: 'உரிமையாளர்',
  unknown: 'தெரியவில்லை',

  animalDetails: 'விலங்கு விவரங்கள்',
  fillDetails: 'விவரங்களை நிரப்பு',
  speciesLabel: 'இனம்',
  breedLabel: 'இனம்',
  genderLabel: 'பாலினம்',
  ageMonths: 'வயது (மாதங்கள்)',
  colorPattern: 'நிற வடிவம்',
  hornType: 'கொம்பு வகை',
  identifiableMarks: 'அடையாள குறிகள்',
  village: 'கிராமம்',
  district: 'மாவட்டம்',
  state: 'மாநிலம்',
  saveAndContinue: 'சேமித்து தொடரு',
  skipForNow: 'இப்போது தவிர்',
  cattle: 'மாடு',
  buffalo: 'எருமை',
  goat: 'ஆடு',
  sheep: 'செம்மறி',
  other: 'மற்றவை',
  male: 'ஆண்',
  female: 'பெண்',
  selectGender: 'தேர்ந்தெடு',
  uploadOrCapture: 'விலங்கு புகைப்படத்தை பதிவேற்றம் அல்லது எடு',
  enrollAnimal: 'விலங்கை பதிவு செய்',
  enrolling: 'பதிவு செய்கிறது...',
  uploading: 'பதிவேற்றுகிறது...',
  processing: 'செயலாக்குகிறது...',
  captureFromCamera: 'கேமராவிலிருந்து எடு',
  uploadFromGallery: 'கேலரியிலிருந்து பதிவேற்று',
  takePhoto: 'புகைப்படம் எடு',
  retake: 'மீண்டும் எடு',
  usePhoto: 'புகைப்படத்தை பயன்படுத்து',
  dragDropHint: 'படத்தை இழுத்து விடுங்கள், அல்லது உலாவ கிளிக் செய்யுங்கள்',
  animalEnrollment: 'விலங்கு பதிவு',
  captureOrUploadDesc: 'விலங்கின் முகம்/மூக்கின் தெளிவான புகைப்படத்தை எடுக்கவும் அல்லது பதிவேற்றவும்',
  enrollNotice: 'நீங்கள் உரிமையாளர் கணக்கு இல்லாமல் பதிவு செய்கிறீர்கள். விலங்கு எந்த உரிமையாளருடனும் இணைக்கப்படாது.',
  gpsActive: 'GPS செயலில்',
  gettingLocation: 'இடம் பெறப்படுகிறது...',
  photoTips: 'புகைப்பட குறிப்புகள்',
  photoTip1: 'விலங்கின் முகம்/மூக்கு பகுதியில் கவனம் செலுத்துங்கள்',
  photoTip2: 'நல்ல ஒளி இருப்பதை உறுதிசெய்யுங்கள் — கடுமையான நிழல்களைத் தவிர்க்கவும்',
  photoTip3: 'தெளிவான படத்திற்கு கேமராவை நிலையாக வைக்கவும்',
  photoTip4: 'குறைந்தபட்சம் 640×480 பிக்சல் தெளிவுத்திறன் பயன்படுத்துங்கள்',
  saveAnimalDetails: 'விலங்கு விவரங்களைச் சேமி',
  enrollmentFailed: 'பதிவு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
  failedToSaveAnimal: 'விலங்கு விவரங்களைச் சேமிக்க முடியவில்லை. டாஷ்போர்டிலிருந்து பின்னர் புதுப்பிக்கலாம்.',

  personalDetails: 'தனிப்பட்ட விவரங்கள்',
  memberSince: 'உறுப்பினர் ஆன நாள்',
  accountStatus: 'கணக்கு நிலை',
  active: 'செயலில்',
  pincode: 'பின்கோடு',
  userId: 'பயனர் ID',
  phone: 'தொலைபேசி',
  aadhaar: 'ஆதார்',
  profileUpdated: 'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!',
  failedToLoadProfile: 'சுயவிவரத்தை ஏற்ற முடியவில்லை',
  failedToUpdateProfile: 'சுயவிவரத்தை புதுப்பிக்க முடியவில்லை',
  failedToLoadDashboard: 'டாஷ்போர்டு தரவை ஏற்ற முடியவில்லை',
  saveChanges: 'மாற்றங்களைச் சேமி',
  loadingProfile: 'சுயவிவரம் ஏற்றப்படுகிறது...',
  backToDashboard: '← டாஷ்போர்டு',

  details: 'விவரங்கள்',
  health: 'ஆரோக்கியம்',
  milk: 'பால்',
  insurance: 'காப்பீடு',
  loans: 'கடன்கள்',
  noRecordsYet: 'இன்னும் பதிவுகள் இல்லை.',
  addRecord: 'பதிவு சேர்',
  addHealthRecord: 'ஆரோக்கிய பதிவு சேர்',
  addMilkRecord: 'பால் பதிவு சேர்',
  addInsurance: 'காப்பீடு சேர்',
  addLoan: 'கடன் சேர்',
  vaccineType: 'தடுப்பூசி வகை',
  administeredBy: 'கொடுத்தவர்',
  recordDate: 'பதிவு தேதி',
  nextDueDate: 'அடுத்த காலக்கெடு',
  notes: 'குறிப்புகள்',
  morningYield: 'காலை உற்பத்தி (லி)',
  eveningYield: 'மாலை உற்பத்தி (லி)',
  totalYield: 'மொத்த உற்பத்தி',
  provider: 'வழங்குநர்',
  policyNumber: 'பாலிசி எண்',
  coverageAmount: 'காப்பீட்டுத் தொகை',
  premium: 'பிரீமியம்',
  startDate: 'தொடக்க தேதி',
  endDate: 'முடிவு தேதி',
  status: 'நிலை',
  lender: 'கடன் கொடுப்பவர்',
  loanAmount: 'கடன் தொகை',
  interestRate: 'வட்டி விகிதம் (%)',
  tenureMonths: 'காலம் (மாதங்கள்)',
  disbursementDate: 'வழங்கிய தேதி',
  repaymentStatus: 'திருப்பிச் செலுத்தும் நிலை',
  enrolledAt: 'பதிவு தேதி',
  gpsCoordinates: 'GPS ஒருங்கிணைப்புகள்',
  ownerId: 'உரிமையாளர் ID',
  animalProfile: 'விலங்கு சுயவிவரம்',
  editDetails: 'விவரங்களைத் திருத்து',
  loadingAnimalData: 'விலங்கு தரவை ஏற்றுகிறது...',
  animalNotFoundError: 'விலங்கு கிடைக்கவில்லை',
  failedToLoadAnimal: 'விலங்கு தரவை ஏற்ற முடியவில்லை',
  failedToUpdateAnimal: 'விலங்கு விவரங்களைப் புதுப்பிக்க முடியவில்லை',
  failedToAddHealth: 'ஆரோக்கிய பதிவை சேர்க்க முடியவில்லை',
  failedToAddMilk: 'பால் விளைச்சலை சேர்க்க முடியவில்லை',
  failedToAddInsurance: 'காப்பீட்டு கொள்கையை சேர்க்க முடியவில்லை',
  failedToAddLoan: 'கடன் பதிவை சேர்க்க முடியவில்லை',
  vaccination: 'தடுப்பூசி',
  checkup: 'பரிசோதனை',
  treatment: 'சிகிச்சை',
  deworming: 'புழுநீக்கம்',
  vaccine: 'தடுப்பூசி',
  date: 'தேதி',
  type: 'வகை',
  saveRecord: 'பதிவை சேமி',
  saveYield: 'விளைச்சலை சேமி',
  savePolicy: 'கொள்கையை சேமி',
  saveLoan: 'கடனை சேமி',
  noHealthRecords: 'இதுவரை ஆரோக்கிய பதிவுகள் இல்லை',
  noMilkRecords: 'இதுவரை பால் விளைச்சல் பதிவுகள் இல்லை',
  noInsurancePolicies: 'காப்பீட்டு கொள்கைகள் பதிவு செய்யப்படவில்லை',
  noLoanRecords: 'கடன் பதிவுகள் இல்லை',
  addInsuranceHint: 'இந்த விலங்குக்கான கவரேஜை கண்காணிக்க காப்பீட்டு கொள்கையை சேர்க்கவும்',
  addLoanHint: 'கால்நடை ஆதார நிதியை கண்காணிக்க கடன் பதிவை சேர்க்கவும்',
  lenderBank: 'கடன் வழங்குநர் / வங்கி',
  morningL: 'காலை (லி)',
  eveningL: 'மாலை (லி)',
  totalL: 'மொத்தம் (லி)',
  enrolled: 'பதிவு',
  gpsLocation: 'GPS இடம்',
  nextDue: 'அடுத்த தேதி',
  by: 'மூலம்',
  policyHash: 'கொள்கை #',
  coverage: 'கவரேஜ்',
  interest: 'வட்டி',
  tenure: 'காலம்',
  amount: 'தொகை',

  enrollmentSuccess: 'பதிவு வெற்றி!',
  newAnimalRegistered: 'புதிய விலங்கு பதிவு செய்யப்பட்டது',
  existingAnimalFound: 'ஏற்கனவே உள்ள விலங்கு தரவுத்தளத்தில் கண்டுபிடிக்கப்பட்டது',
  similarityScore: 'ஒற்றுமை மதிப்பெண்',
  enrollAnother: 'மற்றொன்றை பதிவு செய்',
  viewAnimalDetails: 'விலங்கு விவரங்களைப் பார்',

  selectLanguage: 'மொழியைத் தேர்ந்தெடுங்கள்',

  captureAnimalPhoto: 'விலங்கு புகைப்படம் எடுக்கவும்',
  cameraPermissionError: 'கேமராவை அணுக முடியவில்லை. கேமரா அனுமதியை வழங்கி மீண்டும் முயற்சிக்கவும்.',
  retryCamera: 'மீண்டும் முயற்சி',
  flipCamera: 'திருப்பு',
  captureBtn: 'கேப்சர்',
  cameraAutoCapHint: 'விலங்கு தெளிவாகத் தெரியும்போது AI தானாகவே கேப்சர் செய்யும். அல்லது கேப்சர் அழுத்தவும்.',
  loadingAiModel: '🔄 AI மாடல் ஏற்றுகிறது...',
  aiModelUnavailable: '⚠️ AI மாடல் கிடைக்கவில்லை',
  lookingForAnimal: '🔍 விலங்கைத் தேடுகிறது...',
  perfectMuzzleShot: '✅ சரியான முகம் புகைப்படம்! கேப்சர் செய்கிறது...',

  changePhoto: 'புகைப்படம் மாற்று',
  uploadAnimalPhoto: 'விலங்கு புகைப்படத்தை பதிவேற்றவும்',
  uploadFormatHint: 'JPEG, PNG அல்லது WebP · அதிகபட்சம் 10 MB',
  browseFile: 'கோப்பு தேர்வு',
  invalidFileType: 'தவறான கோப்பு வகை. JPEG, PNG அல்லது WebP படத்தை பதிவேற்றவும்.',
  fileTooLarge: 'கோப்பு மிகப்பெரியது. அதிகபட்ச அளவு 10 MB.',

  uploadingImage: 'படம் பதிவேற்றப்படுகிறது',
  analyzingBiometrics: 'விலங்கு பயோமெட்ரிக்ஸ் பகுப்பாய்வு...',
};

// ─── Kannada ────────────────────────────────────────────────────────
const kn: Translations = {
  ...en,
  appName: 'ಪಶು ಆಧಾರ್ AI',
  appSubtitle: 'ಜಾನುವಾರು ಗುರುತಿಸುವಿಕೆ ವ್ಯವಸ್ಥೆ',
  home: 'ಮುಖಪುಟ',
  dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
  signIn: 'ಸೈನ್ ಇನ್',
  signOut: 'ಸೈನ್ ಔಟ್',
  signUp: 'ಸೈನ್ ಅಪ್',
  loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
  save: 'ಉಳಿಸಿ',
  cancel: 'ರದ್ದುಮಾಡಿ',
  edit: 'ತಿದ್ದಿ',
  delete: 'ಅಳಿಸಿ',
  submit: 'ಸಲ್ಲಿಸಿ',
  back: 'ಹಿಂದೆ',
  refresh: 'ರಿಫ್ರೆಶ್',
  search: 'ಹುಡುಕಿ',
  profile: 'ಪ್ರೊಫೈಲ್',
  close: 'ಮುಚ್ಚಿ',
  heroTagline: 'ಪಶು-ಆಧಾರ್ AI',
  heroBadge: '🇮🇳 ಡಿಜಿಟಲ್ ಇಂಡಿಯಾ ಉಪಕ್ರಮ',
  heroSubtitle: 'ಭಾರತದ ಮೊದಲ AI-ಚಾಲಿತ ಜಾನುವಾರು ಬಯೋಮೆಟ್ರಿಕ್ ಗುರುತಿಸುವಿಕೆ ವ್ಯವಸ್ಥೆ.',
  createFreeAccount: 'ಉಚಿತ ಖಾತೆ ರಚಿಸಿ',
  getStarted: 'ಪ್ರಾರಂಭಿಸಿ',
  goToDashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ',
  howItWorks: 'ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ',
  howItWorksDesc: 'ಯಾವುದೇ ಜಾನುವಾರನ್ನು ಡಿಜಿಟಲ್ ಆಗಿ ಗುರುತಿಸಲು ಮೂರು ಸರಳ ಹಂತಗಳು',
  stepCapture: 'ಕ್ಯಾಪ್ಚರ್',
  stepCaptureDesc: 'ನಿಮ್ಮ ಫೋನ್ ಕ್ಯಾಮೆರಾದಿಂದ ಪ್ರಾಣಿಯ ಮೂಗಿನ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ',
  stepAnalyze: 'ವಿಶ್ಲೇಷಣೆ',
  stepAnalyzeDesc: 'AI ಪ್ರಾಣಿಯನ್ನು ಪತ್ತೆ ಮಾಡುತ್ತದೆ, CLIP ಮೂಲಕ ವಿಶಿಷ್ಟ ಬಯೋಮೆಟ್ರಿಕ್ ಮಾದರಿಗಳನ್ನು ಹೊರತೆಗೆಯುತ್ತದೆ',
  stepIdentify: 'ಗುರುತಿಸಿ',
  stepIdentifyDesc: 'ಡೇಟಾಬೇಸ್‌ನೊಂದಿಗೆ ತ್ವರಿತ ಹೊಂದಾಣಿಕೆ — ಹೊಸದನ್ನು ನೋಂದಾಯಿಸಿ ಅಥವಾ ಅಸ್ತಿತ್ವದಲ್ಲಿರುವುದನ್ನು ಪರಿಶೀಲಿಸಿ',
  builtForStakeholders: 'ಪ್ರತಿ ಪಾಲುದಾರರಿಗಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ',
  stakeholderDesc: 'ಸಂಪೂರ್ಣ ಜಾನುವಾರು ಪರಿಸರ ವ್ಯವಸ್ಥೆಗಾಗಿ ಪಾತ್ರ-ಆಧಾರಿತ ಪ್ರವೇಶ',
  chooseRole: 'ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಪಾತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  fullName: 'ಪೂರ್ಣ ಹೆಸರು',
  phoneNumber: 'ಫೋನ್ ನಂಬರ್',
  password: 'ಪಾಸ್‌ವರ್ಡ್',
  confirmPassword: 'ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ',
  verificationCode: 'ಪರಿಶೀಲನೆ ಕೋಡ್',
  enterVerificationCode: 'ನಿಮ್ಮ ಫೋನ್‌ಗೆ ಕಳುಹಿಸಲಾದ ಪರಿಶೀಲನೆ ಕೋಡ್ ನಮೂದಿಸಿ',
  createAccount: 'ಖಾತೆ ರಚಿಸಿ',
  creatingAccount: 'ಖಾತೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...',
  verifying: 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...',
  verifyAndContinue: 'ಪರಿಶೀಲಿಸಿ ಮುಂದುವರಿಸಿ',
  resendCode: '📩 ಪರಿಶೀಲನೆ ಕೋಡ್ ಮತ್ತೆ ಕಳುಹಿಸಿ',
  sending: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...',
  alreadyHaveAccount: 'ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?',
  dontHaveAccount: 'ಖಾತೆ ಇಲ್ಲವೇ?',
  changeRole: '← ಪಾತ್ರ ಬದಲಿಸಿ',
  roleFarmer: 'ರೈತ / ಮಾಲೀಕ',
  roleFarmerDesc: 'ಜಾನುವಾರು ಮಾಲೀಕ — ನಿಮ್ಮ ಪ್ರಾಣಿಗಳನ್ನು ನೋಂದಾಯಿಸಿ, ನಿರ್ವಹಿಸಿ & ಟ್ರ್ಯಾಕ್ ಮಾಡಿ',
  roleVeterinarian: 'ಪಶುವೈದ್ಯ',
  roleVeterinarianDesc: 'ಪಶುವೈದ್ಯ — ಪ್ರಾಣಿ ಆರೋಗ್ಯ ದಾಖಲೆಗಳನ್ನು ಪ್ರವೇಶಿಸಿ',
  roleInsurer: 'ವಿಮಾ ಏಜೆಂಟ್',
  roleInsurerDesc: 'ವಿಮಾ ಒದಗಿಸುವವರು — ವಿಮೆ ಮಾಡಿದ ಜಾನುವಾರು ಡೇಟಾ ನೋಡಿ',
  roleGovernment: 'ಸರ್ಕಾರಿ ಅಧಿಕಾರಿ',
  roleGovernmentDesc: 'ಸರ್ಕಾರಿ ಸಂಸ್ಥೆ — ಮೇಲ್ವಿಚಾರಣೆ & ನಿಯಂತ್ರಕ ಪ್ರವೇಶ',
  roleAdmin: 'ನಿರ್ವಾಹಕ',
  roleAdminDesc: 'ಸಿಸ್ಟಮ್ ನಿರ್ವಾಹಕ — ಪೂರ್ಣ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಪ್ರವೇಶ',
  overview: 'ಅವಲೋಕನ',
  requests: 'ವಿನಂತಿಗಳು',
  myAnimals: 'ನನ್ನ ಪ್ರಾಣಿಗಳು',
  noAnimalsYet: 'ಇನ್ನೂ ಪ್ರಾಣಿಗಳನ್ನು ನೋಂದಾಯಿಸಿಲ್ಲ.',
  enrollNewAnimal: 'ಹೊಸ ಪ್ರಾಣಿ ನೋಂದಣಿ',
  myProfile: 'ನನ್ನ ಪ್ರೊಫೈಲ್',
  breed: 'ತಳಿ',
  gender: 'ಲಿಂಗ',
  age: 'ವಯಸ್ಸು',
  location: 'ಸ್ಥಳ',
  species: 'ಜಾತಿ',
  owner: 'ಮಾಲೀಕ',
  unknown: 'ತಿಳಿದಿಲ್ಲ',
  village: 'ಹಳ್ಳಿ',
  district: 'ಜಿಲ್ಲೆ',
  state: 'ರಾಜ್ಯ',
  cattle: 'ಹಸು',
  buffalo: 'ಎಮ್ಮೆ',
  goat: 'ಮೇಕೆ',
  sheep: 'ಕುರಿ',
  other: 'ಇತರ',
  male: 'ಗಂಡು',
  female: 'ಹೆಣ್ಣು',
  selectLanguage: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  personalDetails: 'ವೈಯಕ್ತಿಕ ವಿವರಗಳು',
  enrollmentSuccess: 'ನೋಂದಣಿ ಯಶಸ್ವಿ!',
  footer: '🐄 ಪಶು ಆಧಾರ್ — ಪಶು ಆಧಾರ್ AI © 2026 · ಗ್ರಾಮೀಣ ಭಾರತಕ್ಕಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ 🇮🇳',
};

// ─── Marathi ────────────────────────────────────────────────────────
const mr: Translations = {
  ...en,
  appName: 'पशू आधार AI',
  appSubtitle: 'पशुधन ओळख प्रणाली',
  home: 'मुख्यपृष्ठ',
  dashboard: 'डॅशबोर्ड',
  signIn: 'साइन इन',
  signOut: 'साइन आउट',
  signUp: 'नोंदणी',
  loading: 'लोड होत आहे...',
  save: 'जतन करा',
  cancel: 'रद्द करा',
  edit: 'संपादित करा',
  delete: 'हटवा',
  submit: 'सबमिट करा',
  back: 'मागे',
  refresh: 'रिफ्रेश',
  search: 'शोधा',
  profile: 'प्रोफाइल',
  close: 'बंद करा',
  heroTagline: 'पशू-आधार AI',
  heroBadge: '🇮🇳 डिजिटल इंडिया उपक्रम',
  heroSubtitle: 'भारताची पहिली AI-चालित पशुधन बायोमेट्रिक ओळख प्रणाली.',
  createFreeAccount: 'मोफत खाते तयार करा',
  getStarted: 'सुरू करा',
  goToDashboard: 'डॅशबोर्डवर जा',
  howItWorks: 'हे कसे कार्य करते',
  howItWorksDesc: 'कोणत्याही पशुधनाची डिजिटल ओळख पटवण्यासाठी तीन सोपे टप्पे',
  stepCapture: 'कॅप्चर',
  stepCaptureDesc: 'तुमच्या फोन कॅमेऱ्याने प्राण्याच्या थुंकीचा स्पष्ट फोटो काढा',
  stepAnalyze: 'विश्लेषण',
  stepAnalyzeDesc: 'AI प्राण्याचा शोध घेतो, CLIP एम्बेडिंगद्वारे अद्वितीय बायोमेट्रिक नमुने काढतो',
  stepIdentify: 'ओळख',
  stepIdentifyDesc: 'डेटाबेसशी त्वरित जुळवणी — नवीन नोंदणी किंवा विद्यमान प्राणी सत्यापन',
  builtForStakeholders: 'प्रत्येक भागधारकासाठी बनवलेले',
  stakeholderDesc: 'संपूर्ण पशुधन परिसंस्थेसाठी भूमिका-आधारित प्रवेश',
  chooseRole: 'सुरू करण्यासाठी तुमची भूमिका निवडा',
  fullName: 'पूर्ण नाव',
  phoneNumber: 'फोन नंबर',
  password: 'पासवर्ड',
  confirmPassword: 'पासवर्ड पुष्टी करा',
  verificationCode: 'सत्यापन कोड',
  enterVerificationCode: 'तुमच्या फोनवर पाठवलेला सत्यापन कोड प्रविष्ट करा',
  createAccount: 'खाते तयार करा',
  creatingAccount: 'खाते तयार होत आहे...',
  verifying: 'सत्यापित होत आहे...',
  verifyAndContinue: 'सत्यापित करा आणि पुढे जा',
  resendCode: '📩 सत्यापन कोड पुन्हा पाठवा',
  sending: 'पाठवत आहे...',
  alreadyHaveAccount: 'आधीच खाते आहे?',
  dontHaveAccount: 'खाते नाही?',
  changeRole: '← भूमिका बदला',
  roleFarmer: 'शेतकरी / मालक',
  roleFarmerDesc: 'पशुधन मालक — तुमच्या प्राण्यांची नोंदणी, व्यवस्थापन आणि ट्रॅकिंग',
  roleVeterinarian: 'पशुवैद्य',
  roleVeterinarianDesc: 'पशुवैद्य — प्राणी आरोग्य नोंदी पहा',
  roleInsurer: 'विमा एजंट',
  roleInsurerDesc: 'विमा प्रदाता — विमा केलेल्या पशुधनाचा डेटा पहा',
  roleGovernment: 'सरकारी अधिकारी',
  roleGovernmentDesc: 'सरकारी संस्था — देखरेख आणि नियामक प्रवेश',
  roleAdmin: 'प्रशासक',
  roleAdminDesc: 'सिस्टम प्रशासक — पूर्ण प्लॅटफॉर्म प्रवेश',
  overview: 'अवलोकन',
  requests: 'विनंत्या',
  myAnimals: 'माझे प्राणी',
  noAnimalsYet: 'अजून प्राणी नोंदवलेले नाहीत.',
  enrollNewAnimal: 'नवीन प्राणी नोंदणी',
  myProfile: 'माझी प्रोफाइल',
  breed: 'जात',
  gender: 'लिंग',
  age: 'वय',
  location: 'स्थान',
  species: 'प्रजाती',
  owner: 'मालक',
  unknown: 'अज्ञात',
  village: 'गाव',
  district: 'जिल्हा',
  state: 'राज्य',
  cattle: 'गाय',
  buffalo: 'म्हैस',
  goat: 'शेळी',
  sheep: 'मेंढी',
  other: 'इतर',
  male: 'नर',
  female: 'मादी',
  selectLanguage: 'भाषा निवडा',
  personalDetails: 'वैयक्तिक तपशील',
  enrollmentSuccess: 'नोंदणी यशस्वी!',
  footer: '🐄 पशू आधार — पशू आधार AI © 2026 · ग्रामीण भारतासाठी बनवलेले 🇮🇳',
};

// ─── Bengali ────────────────────────────────────────────────────────
const bn: Translations = {
  ...en,
  appName: 'পশু আধার AI',
  appSubtitle: 'পশুসম্পদ সনাক্তকরণ ব্যবস্থা',
  home: 'হোম',
  dashboard: 'ড্যাশবোর্ড',
  signIn: 'সাইন ইন',
  signOut: 'সাইন আউট',
  signUp: 'সাইন আপ',
  loading: 'লোড হচ্ছে...',
  save: 'সংরক্ষণ',
  cancel: 'বাতিল',
  edit: 'সম্পাদনা',
  delete: 'মুছুন',
  submit: 'জমা দিন',
  back: 'পেছনে',
  refresh: 'রিফ্রেশ',
  search: 'অনুসন্ধান',
  profile: 'প্রোফাইল',
  close: 'বন্ধ',
  heroTagline: 'পশু-আধার AI',
  heroBadge: '🇮🇳 ডিজিটাল ইন্ডিয়া উদ্যোগ',
  heroSubtitle: 'ভারতের প্রথম AI-চালিত পশুসম্পদ বায়োমেট্রিক সনাক্তকরণ ব্যবস্থা।',
  createFreeAccount: 'বিনামূল্যে অ্যাকাউন্ট তৈরি করুন',
  getStarted: 'শুরু করুন',
  goToDashboard: 'ড্যাশবোর্ডে যান',
  howItWorks: 'এটি কীভাবে কাজ করে',
  howItWorksDesc: 'যেকোনো পশুসম্পদকে ডিজিটালভাবে সনাক্ত করতে তিনটি সহজ ধাপ',
  stepCapture: 'ক্যাপচার',
  stepCaptureDesc: 'আপনার ফোন ক্যামেরা দিয়ে প্রাণীর নাকের একটি পরিষ্কার ছবি তুলুন',
  stepAnalyze: 'বিশ্লেষণ',
  stepAnalyzeDesc: 'AI প্রাণী শনাক্ত করে, CLIP এম্বেডিং-এর মাধ্যমে অনন্য বায়োমেট্রিক প্যাটার্ন বের করে',
  stepIdentify: 'সনাক্ত',
  stepIdentifyDesc: 'ডেটাবেসের সাথে তাৎক্ষণিক মিলান — নতুন নথিভুক্ত করুন বা বিদ্যমান যাচাই করুন',
  builtForStakeholders: 'প্রতিটি স্টেকহোল্ডারের জন্য তৈরি',
  stakeholderDesc: 'সম্পূর্ণ পশুসম্পদ ইকোসিস্টেমের জন্য ভূমিকা-ভিত্তিক অ্যাক্সেস',
  chooseRole: 'শুরু করতে আপনার ভূমিকা বেছে নিন',
  fullName: 'পূর্ণ নাম',
  phoneNumber: 'ফোন নম্বর',
  password: 'পাসওয়ার্ড',
  confirmPassword: 'পাসওয়ার্ড নিশ্চিত করুন',
  verificationCode: 'যাচাইকরণ কোড',
  enterVerificationCode: 'আপনার ফোনে পাঠানো যাচাইকরণ কোড লিখুন',
  createAccount: 'অ্যাকাউন্ট তৈরি করুন',
  creatingAccount: 'অ্যাকাউন্ট তৈরি হচ্ছে...',
  verifying: 'যাচাই হচ্ছে...',
  verifyAndContinue: 'যাচাই করুন এবং চালিয়ে যান',
  resendCode: '📩 যাচাইকরণ কোড পুনরায় পাঠান',
  sending: 'পাঠানো হচ্ছে...',
  alreadyHaveAccount: 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
  dontHaveAccount: 'অ্যাকাউন্ট নেই?',
  changeRole: '← ভূমিকা পরিবর্তন করুন',
  roleFarmer: 'কৃষক / মালিক',
  roleFarmerDesc: 'পশুসম্পদ মালিক — আপনার প্রাণীদের নথিভুক্ত করুন, পরিচালনা করুন এবং ট্র্যাক করুন',
  roleVeterinarian: 'পশু চিকিৎসক',
  roleVeterinarianDesc: 'পশু চিকিৎসক — প্রাণী স্বাস্থ্য রেকর্ড অ্যাক্সেস করুন',
  roleInsurer: 'বীমা এজেন্ট',
  roleInsurerDesc: 'বীমা প্রদানকারী — বীমা করা পশুসম্পদ ডেটা দেখুন',
  roleGovernment: 'সরকারি কর্মকর্তা',
  roleGovernmentDesc: 'সরকারি সংস্থা — তত্ত্বাবধান ও নিয়ন্ত্রক অ্যাক্সেস',
  roleAdmin: 'প্রশাসক',
  roleAdminDesc: 'সিস্টেম প্রশাসক — সম্পূর্ণ প্ল্যাটফর্ম অ্যাক্সেস',
  overview: 'সংক্ষিপ্ত বিবরণ',
  requests: 'অনুরোধ',
  myAnimals: 'আমার প্রাণী',
  noAnimalsYet: 'এখনও কোনো প্রাণী নথিভুক্ত হয়নি।',
  enrollNewAnimal: 'নতুন প্রাণী নথিভুক্ত করুন',
  myProfile: 'আমার প্রোফাইল',
  breed: 'জাত',
  gender: 'লিঙ্গ',
  age: 'বয়স',
  location: 'অবস্থান',
  species: 'প্রজাতি',
  owner: 'মালিক',
  unknown: 'অজানা',
  village: 'গ্রাম',
  district: 'জেলা',
  state: 'রাজ্য',
  cattle: 'গরু',
  buffalo: 'মহিষ',
  goat: 'ছাগল',
  sheep: 'ভেড়া',
  other: 'অন্যান্য',
  male: 'পুরুষ',
  female: 'মহিলা',
  selectLanguage: 'ভাষা নির্বাচন করুন',
  personalDetails: 'ব্যক্তিগত বিবরণ',
  enrollmentSuccess: 'নথিভুক্তি সফল!',
  footer: '🐄 পশু আধার — পশু আধার AI © 2026 · গ্রামীণ ভারতের জন্য তৈরি 🇮🇳',
};

// ─── All translations map ───────────────────────────────────────────
export const translations: Record<Language, Translations> = {
  en,
  hi,
  te,
  ta,
  kn,
  mr,
  bn,
};

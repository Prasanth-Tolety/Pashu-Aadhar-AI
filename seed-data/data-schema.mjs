/**
 * data-schema.mjs — Master data generation schema for Pashu Aadhaar AI.
 *
 * Contains all Indian-context reference data:
 *   • States, districts, villages with lat/lng
 *   • Indian cattle breeds with characteristics
 *   • Farmer names (Hindi/Telugu/Marathi/Tamil)
 *   • Agent names, vet names
 *   • Vaccine types, diseases, insurance providers, banks
 *   • Region codes (state abbreviation-based)
 */

// ─── Indian Geography ────────────────────────────────────────────────

export const REGIONS = [
  {
    state: 'Rajasthan', code: 'RJ',
    districts: [
      { name: 'Barmer', villages: ['Chohtan', 'Sindhari', 'Pachpadra'], lat: 25.75, lng: 71.39 },
      { name: 'Jodhpur', villages: ['Osian', 'Bilara', 'Shergarh'], lat: 26.29, lng: 73.02 },
      { name: 'Jaisalmer', villages: ['Pokaran', 'Fatehgarh', 'Ramgarh'], lat: 26.91, lng: 70.91 },
    ],
  },
  {
    state: 'Gujarat', code: 'GJ',
    districts: [
      { name: 'Junagadh', villages: ['Visavadar', 'Keshod', 'Mendarda'], lat: 21.52, lng: 70.46 },
      { name: 'Amreli', villages: ['Lathi', 'Rajula', 'Savarkundla'], lat: 21.60, lng: 71.22 },
      { name: 'Kutch', villages: ['Bhuj', 'Mandvi', 'Anjar'], lat: 23.25, lng: 69.67 },
    ],
  },
  {
    state: 'Madhya Pradesh', code: 'MP',
    districts: [
      { name: 'Dewas', villages: ['Tonk Khurd', 'Sonkatch', 'Bagli'], lat: 22.97, lng: 76.05 },
      { name: 'Indore', villages: ['Mhow', 'Depalpur', 'Sanwer'], lat: 22.72, lng: 75.86 },
    ],
  },
  {
    state: 'Uttar Pradesh', code: 'UP',
    districts: [
      { name: 'Mathura', villages: ['Vrindavan', 'Govardhan', 'Baldeo'], lat: 27.49, lng: 77.67 },
      { name: 'Aligarh', villages: ['Khair', 'Atrauli', 'Iglas'], lat: 27.88, lng: 78.08 },
      { name: 'Varanasi', villages: ['Ramnagar', 'Pindra', 'Cholapur'], lat: 25.32, lng: 82.99 },
    ],
  },
  {
    state: 'Haryana', code: 'HR',
    districts: [
      { name: 'Hisar', villages: ['Hansi', 'Barwala', 'Narnaund'], lat: 29.15, lng: 75.72 },
      { name: 'Karnal', villages: ['Nissing', 'Assandh', 'Nilokheri'], lat: 29.69, lng: 76.98 },
    ],
  },
  {
    state: 'Punjab', code: 'PB',
    districts: [
      { name: 'Ludhiana', villages: ['Jagraon', 'Khanna', 'Samrala'], lat: 30.90, lng: 75.86 },
      { name: 'Amritsar', villages: ['Ajnala', 'Baba Bakala', 'Rayya'], lat: 31.63, lng: 74.87 },
    ],
  },
  {
    state: 'Maharashtra', code: 'MH',
    districts: [
      { name: 'Pune', villages: ['Junnar', 'Shirur', 'Maval'], lat: 18.52, lng: 73.86 },
      { name: 'Ahmednagar', villages: ['Sangamner', 'Shrirampur', 'Rahuri'], lat: 19.10, lng: 74.75 },
      { name: 'Kolhapur', villages: ['Panhala', 'Gaganbawda', 'Shahuwadi'], lat: 16.70, lng: 74.24 },
    ],
  },
  {
    state: 'Karnataka', code: 'KA',
    districts: [
      { name: 'Dharwad', villages: ['Hubli', 'Kundgol', 'Navalgund'], lat: 15.46, lng: 75.01 },
      { name: 'Mysuru', villages: ['Nanjangud', 'T. Narasipura', 'Hunsur'], lat: 12.30, lng: 76.65 },
    ],
  },
  {
    state: 'Tamil Nadu', code: 'TN',
    districts: [
      { name: 'Madurai', villages: ['Melur', 'Thirumangalam', 'Usilampatti'], lat: 9.92, lng: 78.12 },
      { name: 'Erode', villages: ['Sathyamangalam', 'Bhavani', 'Perundurai'], lat: 11.34, lng: 77.72 },
    ],
  },
  {
    state: 'Andhra Pradesh', code: 'AP',
    districts: [
      { name: 'Guntur', villages: ['Tenali', 'Mangalagiri', 'Sattenapalli'], lat: 16.31, lng: 80.44 },
      { name: 'Chittoor', villages: ['Tirupati', 'Madanapalle', 'Puttur'], lat: 13.62, lng: 79.42 },
    ],
  },
  {
    state: 'Telangana', code: 'TS',
    districts: [
      { name: 'Medak', villages: ['Siddipet', 'Narsapur', 'Toopran'], lat: 18.05, lng: 78.26 },
      { name: 'Warangal', villages: ['Jangaon', 'Mahabubabad', 'Parkal'], lat: 17.98, lng: 79.60 },
    ],
  },
  {
    state: 'Bihar', code: 'BR',
    districts: [
      { name: 'Patna', villages: ['Danapur', 'Phulwari', 'Maner'], lat: 25.61, lng: 85.14 },
      { name: 'Muzaffarpur', villages: ['Saraiya', 'Motipur', 'Minapur'], lat: 26.12, lng: 85.39 },
    ],
  },
  {
    state: 'West Bengal', code: 'WB',
    districts: [
      { name: 'Nadia', villages: ['Krishnanagar', 'Ranaghat', 'Tehatta'], lat: 23.39, lng: 88.52 },
    ],
  },
  {
    state: 'Odisha', code: 'OD',
    districts: [
      { name: 'Khordha', villages: ['Jatni', 'Balianta', 'Begunia'], lat: 20.18, lng: 85.62 },
    ],
  },
  {
    state: 'Jharkhand', code: 'JH',
    districts: [
      { name: 'Ranchi', villages: ['Kanke', 'Namkum', 'Bundu'], lat: 23.34, lng: 85.31 },
    ],
  },
  {
    state: 'Chhattisgarh', code: 'CG',
    districts: [
      { name: 'Raipur', villages: ['Abhanpur', 'Arang', 'Tilda'], lat: 21.25, lng: 81.63 },
    ],
  },
  {
    state: 'Kerala', code: 'KL',
    districts: [
      { name: 'Wayanad', villages: ['Kalpetta', 'Mananthavady', 'Sulthan Bathery'], lat: 11.60, lng: 76.08 },
    ],
  },
  {
    state: 'Uttarakhand', code: 'UK',
    districts: [
      { name: 'Dehradun', villages: ['Rishikesh', 'Doiwala', 'Vikasnagar'], lat: 30.32, lng: 78.03 },
    ],
  },
  {
    state: 'Himachal Pradesh', code: 'HP',
    districts: [
      { name: 'Kangra', villages: ['Dharamshala', 'Palampur', 'Nagrota'], lat: 32.10, lng: 76.27 },
    ],
  },
  {
    state: 'Assam', code: 'AS',
    districts: [
      { name: 'Kamrup', villages: ['Boko', 'Chaygaon', 'Palashbari'], lat: 26.14, lng: 91.74 },
    ],
  },
];

// ─── Indian Cattle Breeds ────────────────────────────────────────────

export const BREEDS = [
  { name: 'Gir',           type: 'dairy',   avgMilk: 12, color: 'Reddish-Brown with White', horns: 'Long Curved',    states: ['Gujarat', 'Rajasthan'] },
  { name: 'Sahiwal',       type: 'dairy',   avgMilk: 10, color: 'Reddish-Brown',            horns: 'Short Stumpy',   states: ['Punjab', 'Haryana', 'Uttar Pradesh'] },
  { name: 'Red Sindhi',    type: 'dairy',   avgMilk: 8,  color: 'Deep Red',                 horns: 'Short Thick',    states: ['Gujarat', 'Rajasthan', 'Karnataka'] },
  { name: 'Tharparkar',    type: 'dual',    avgMilk: 7,  color: 'White/Light Grey',         horns: 'Medium Lyre',    states: ['Rajasthan'] },
  { name: 'Rathi',         type: 'dairy',   avgMilk: 6,  color: 'Brown with White',         horns: 'Medium Curved',  states: ['Rajasthan'] },
  { name: 'Kankrej',       type: 'dual',    avgMilk: 5,  color: 'Silver-Grey',              horns: 'Large Lyre',     states: ['Gujarat', 'Rajasthan'] },
  { name: 'Ongole',        type: 'draught', avgMilk: 3,  color: 'White',                    horns: 'Short Stumpy',   states: ['Andhra Pradesh', 'Telangana'] },
  { name: 'Hariana',       type: 'dual',    avgMilk: 5,  color: 'White/Light Grey',         horns: 'Short Forward',  states: ['Haryana', 'Uttar Pradesh'] },
  { name: 'Deoni',         type: 'dual',    avgMilk: 4,  color: 'Black-and-White Spotted',  horns: 'Long Flat',      states: ['Maharashtra', 'Karnataka'] },
  { name: 'Khillari',      type: 'draught', avgMilk: 2,  color: 'Grey',                     horns: 'Long Flat',      states: ['Maharashtra'] },
  { name: 'Kangayam',      type: 'draught', avgMilk: 3,  color: 'Grey/White',               horns: 'Long Curved',   states: ['Tamil Nadu'] },
  { name: 'Punganur',      type: 'dairy',   avgMilk: 3,  color: 'White with Brown',         horns: 'Short Crescent', states: ['Andhra Pradesh'] },
  { name: 'Amritmahal',    type: 'draught', avgMilk: 2,  color: 'Grey',                     horns: 'Long Straight',  states: ['Karnataka'] },
  { name: 'Murrah Buffalo', type: 'buffalo', avgMilk: 15, color: 'Jet Black',               horns: 'Tightly Curled', states: ['Haryana', 'Punjab', 'Uttar Pradesh'] },
  { name: 'Jaffarabadi Buffalo', type: 'buffalo', avgMilk: 12, color: 'Black',              horns: 'Heavy Drooping', states: ['Gujarat'] },
  { name: 'Mehsana Buffalo', type: 'buffalo', avgMilk: 10, color: 'Black/Brown',            horns: 'Sickle-shaped',  states: ['Gujarat'] },
];

// ─── Indian Names (farmer names, multi-lingual) ─────────────────────

export const FARMER_NAMES = [
  // Hindi belt
  'Ramesh Kumar', 'Suresh Yadav', 'Mahesh Sharma', 'Ganesh Prasad', 'Rajendra Singh',
  'Deepak Verma', 'Anil Gupta', 'Santosh Tiwari', 'Dinesh Patel', 'Vijay Mishra',
  'Bhagwati Devi', 'Savitri Devi', 'Kamla Devi', 'Sunita Yadav', 'Radha Singh',
  // Telugu
  'Venkatesh Reddy', 'Srinivas Rao', 'Raghunath Naidu', 'Lakshmi Narasimha', 'Satyanarayana Murthy',
  'Padmavathi Devi', 'Lakshmi Devi',
  // Marathi
  'Shankar Patil', 'Vikas Jadhav', 'Prakash Deshmukh', 'Balasaheb Shinde', 'Nilesh Pawar',
  'Suman Kulkarni', 'Anita Bhosle',
  // Tamil
  'Murugan Selvam', 'Karthikeyan Raman', 'Senthil Velan', 'Lakshmi Prabha',
  // Punjabi
  'Harbhajan Singh', 'Gurpreet Sandhu', 'Balwinder Kaur', 'Jaswinder Gill',
  // Bengali
  'Subhash Mondal', 'Tapan Das', 'Rina Ghosh',
  // Rajasthani
  'Bhanwar Lal Meena', 'Kailash Chand Jat', 'Laxman Singh Rajput', 'Mool Chand Gurjar',
  // Gujarati
  'Jayesh Patel', 'Bhikhabhai Rabari', 'Maniben Ahir', 'Karsanbhai Desai',
  // Bihari
  'Rampravesh Mahto', 'Shyam Narayan Sah', 'Chandrashekhar Jha',
  // General
  'Gopal Krishna', 'Mohan Lal', 'Hari Prasad', 'Ram Nath', 'Jagan Mohan',
];

export const AGENT_NAMES = [
  'Arjun Mehra', 'Priya Sharma', 'Ankit Rawat', 'Sneha Kulkarni', 'Rahul Deshmukh',
  'Divya Reddy', 'Vikram Chauhan', 'Neha Agarwal', 'Sanjay Thakur', 'Pooja Iyer',
];

export const VET_NAMES = [
  'Dr. Arun Kumar', 'Dr. Kavita Sharma', 'Dr. Sunil Verma', 'Dr. Rekha Patel',
  'Dr. Mohan Rao', 'Dr. Priya Nair', 'Dr. Rajesh Tiwari', 'Dr. Anita Desai',
];

// ─── Health & Vaccination ────────────────────────────────────────────

export const VACCINE_TYPES = [
  { name: 'FMD (Foot & Mouth Disease)', schedule: 'Every 6 months' },
  { name: 'HS (Haemorrhagic Septicaemia)', schedule: 'Annually before monsoon' },
  { name: 'BQ (Black Quarter)', schedule: 'Annually' },
  { name: 'Brucellosis', schedule: '4-8 months age (single dose)' },
  { name: 'Anthrax', schedule: 'Annually' },
  { name: 'Theileriosis', schedule: 'Once at 3 months' },
];

export const HEALTH_RECORD_TYPES = ['vaccination', 'checkup', 'treatment', 'deworming'];

export const DISEASES = [
  'FMD', 'Mastitis', 'Tick Fever', 'Bloat', 'Ketosis', 'Milk Fever',
  'Brucellosis', 'Foot Rot', 'Lumpy Skin Disease', 'Pneumonia',
];

// ─── Insurance ───────────────────────────────────────────────────────

export const INSURANCE_PROVIDERS = [
  { name: 'National Insurance Co. Ltd.', type: 'govt' },
  { name: 'New India Assurance Co. Ltd.', type: 'govt' },
  { name: 'United India Insurance Co. Ltd.', type: 'govt' },
  { name: 'IFFCO Tokio General Insurance', type: 'private' },
  { name: 'HDFC Ergo General Insurance', type: 'private' },
  { name: 'Bajaj Allianz General Insurance', type: 'private' },
];

// Coverage amounts vary by breed value
export const COVERAGE_RANGES = {
  dairy:   { min: 40000, max: 80000 },
  dual:    { min: 30000, max: 60000 },
  draught: { min: 20000, max: 40000 },
  buffalo: { min: 50000, max: 100000 },
};

// ─── Loan / Banks ────────────────────────────────────────────────────

export const BANKS = [
  'State Bank of India', 'Punjab National Bank', 'Bank of Baroda',
  'Canara Bank', 'Union Bank of India', 'NABARD KCC',
  'HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Local Cooperative Bank', 'District Cooperative Bank',
];

// ─── Helpers ─────────────────────────────────────────────────────────

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/** Generate a random date between two dates */
export function randDate(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s));
}

/** Add jitter to a lat/lng (±0.05 degrees ≈ 5km) */
export function jitterCoords(lat, lng, jitter = 0.05) {
  return {
    lat: parseFloat((lat + (Math.random() - 0.5) * 2 * jitter).toFixed(6)),
    lng: parseFloat((lng + (Math.random() - 0.5) * 2 * jitter).toFixed(6)),
  };
}

/** Generate a 4-digit Aadhaar last-4 */
export function randAadhaar() {
  return String(randInt(1000, 9999));
}

/** Generate Indian phone number */
export function randPhone() {
  return `+91${randInt(7000000000, 9999999999)}`;
}

/** Generate a 6-digit pincode */
export function randPincode(stateCode) {
  const prefixes = {
    RJ: ['30', '31', '32', '33', '34'],
    GJ: ['36', '37', '38', '39'],
    MP: ['45', '46', '47', '48'],
    UP: ['20', '21', '22', '23', '24', '25', '27', '28'],
    HR: ['12', '13'],
    PB: ['14', '15', '16'],
    MH: ['40', '41', '42', '43', '44'],
    KA: ['56', '57', '58', '59'],
    TN: ['60', '61', '62', '63', '64'],
    AP: ['51', '52', '53'],
    TS: ['50'],
    BR: ['80', '81', '82', '84', '85'],
    WB: ['70', '71', '72', '73', '74'],
    OD: ['75', '76', '77'],
    JH: ['81', '82', '83'],
    CG: ['49'],
    KL: ['67', '68', '69'],
    UK: ['24', '24', '26'],
    HP: ['17'],
    AS: ['78'],
  };
  const statePrefix = prefixes[stateCode] || ['11'];
  const prefix = pick(statePrefix);
  return `${prefix}${randInt(1000, 9999)}`;
}

export function generateId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

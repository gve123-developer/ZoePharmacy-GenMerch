import { Product } from '@/app/App';

const RX_KEYWORDS = [
  // Antibiotics & Antimicrobials
  'amoxicillin', 'amoxil', 'augmentin', 'co-amoxiclav', 'azithromycin', 'zithromax', 'cefalexin', 'cephalexin', 'keflex',
  'cefuroxime', 'zinnat', 'cefixime', 'ciprofloxacin', 'ciprobay', 'levofloxacin', 'cravit', 'clarithromycin', 'klaricid',
  'erythromycin', 'doxycycline', 'clindamycin', 'dalacin', 'metronidazole', 'flagyl', 'cotrimoxazole', 'bactrim',
  'sumapen', 'ampicillin', 'fluconazole', 'diflucan', 'ketoconazole', 'itraconazole', 'acyclovir', 'zovirax',
  'gentamicin', 'neomycin', 'chloramphenicol', 'ofloxacin', 'inoflox', 'tobramycin', 'mupirocin', 'bactroban', 'mupicin',
  'pediamox', 'himox', 'moxipen', 'cloxacillin', 'cefaclor', 'cefdinir', 'cefpodoxime', 'ceftriaxone',

  // Cardiovascular & Antihypertensives
  'amlodipine', 'norvasc', 'amvaz', 'amovas', 'provasc', 'losartan', 'cozaar', 'lifezar', 'metoprolol', 'betaloc',
  'neobloc', 'telmisartan', 'micardis', 'candesartan', 'valsartan', 'captopril', 'enalapril', 'carvedilol', 'atenolol',
  'diltiazem', 'verapamil', 'nifedipine', 'calcibloc', 'adalat', 'clopidogrel', 'plavix', 'digoxin', 'furosemide',
  'lasix', 'spironolactone', 'hydralazine', 'isorbide', 'isordil', 'imdur', 'mononitrate', 'dinitrate', 'irbesartan',
  'catapres', 'clonidine', 'aspilets', 'cardiprin', 'bisoprolol', 'concor', 'nebivolol',

  // Diabetes
  'metformin', 'glimepiride', 'amaryl', 'gliclazide', 'diamicron', 'insulin', 'pioglitazone',
  'sitagliptin', 'januvia', 'vildagliptin', 'galvus', 'linagliptin', 'trajenta', 'empagliflozin', 'jardiance',
  'dapagliflozin', 'forxiga', 'glucophage',

  // Cholesterol
  'atorvastatin', 'lipitor', 'rosuvastatin', 'crestor', 'simvastatin', 'zocor', 'fenofibrate', 'gemfibrozil',

  // Corticosteroids
  'prednisone', 'prednisolone', 'dexamethasone', 'hydrocortisone', 'betamethasone', 'betnovate',
  'methylprednisolone', 'medrol', 'clobetasol', 'triamcinolone',

  // Prescription Painkillers & Anti-inflammatory (Rx NSAIDs)
  'celecoxib', 'celebrex', 'mefenamic', 'ponstan', 'dolfenal', 'tramadol', 'ketorolac', 'toradol',
  'etoricoxib', 'arcoxia', 'meloxicam', 'mobic', 'piroxicam', 'feldene', 'diclofenac', 'voltaren', 'cataflam',

  // Asthma Nebules & Rx Respiratory
  'ventolin neb', 'salbutamol neb', 'combivent', 'duavent', 'pulmodual', 'berodual', 'budesonide',
  'pulmicort', 'ipratropium', 'montelukast', 'singulair', 'zykast', 'seretide', 'symbicort', 'fluticasone', 'salmeterol',

  // Uric Acid / Gout
  'allopurinol', 'zyloprim', 'colchicine', 'febuxostat',

  // Gastro Rx
  'omeprazole', 'prilosec', 'pantoprazole', 'pantocid', 'esomeprazole', 'nexium', 'ranitidine', 'famotidine',

  // Thyroid & Hormones
  'levothyroxine', 'euthyrox', 'methimazole', 'tapazole', 'propylthiouracil',

  // Neuro / Psych / Vertigo / Hemostatic
  'gabapentin', 'neurontin', 'pregabalin', 'lyrica', 'carbamazepine', 'tegretol', 'clonazepam', 'alprazolam', 'diazepam',
  'betahistine', 'serc', 'exigo', 'hemostan', 'tranexamic'
];

const OTC_EXCEPTIONS = [
  'biogesic', 'calpol', 'tempra', 'rexidol', 'paracetamol', 'bioflu', 'neozep', 'decolgen',
  'solmux', 'ascof', 'robitussin', 'tuseran', 'ambroxol', 'carbocisteine', 'kremil', 'gaviscon',
  'maalox', 'tums', 'diatabs', 'loperamide', 'enervon', 'revicon', 'tiki-tiki', 'ceelin',
  'ascorbic', 'zinc', 'strepsils', 'woods', 'vicks', 'katinko', 'white flower', 'salonpas', 'betadine',
  'alaxan', 'medicol', 'advil'
];

/**
 * Determines whether a product requires a doctor's prescription (Rx).
 */
export function isRxProduct(product: Product | { name: string; category?: string } | string): boolean {
  let name = '';
  let category = '';

  if (typeof product === 'string') {
    name = product;
  } else {
    name = product.name || '';
    category = product.category || '';
  }

  // Non-pharmaceutical products are never Rx
  if (category && category !== 'Pharmaceutical' && category !== 'Medicine') {
    return false;
  }

  const lower = name.toLowerCase().trim();

  // If explicitly tagged as Rx
  if (lower.includes('(rx)') || lower.includes('[rx]') || lower.startsWith('rx ') || lower.endsWith(' rx')) {
    return true;
  }

  // Check if it matches an OTC brand/exception (unless explicitly paired with an Rx drug)
  const isOtc = OTC_EXCEPTIONS.some(otc => lower.includes(otc));

  const isRx = RX_KEYWORDS.some(k => lower.includes(k));

  if (isRx && (!isOtc || lower.includes('amoxicillin') || lower.includes('salbutamol neb'))) {
    return true;
  }

  return false;
}

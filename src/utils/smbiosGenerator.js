// SMBIOS Generator for Hackintosh configuration
// Replicates the logic of acidanthera's macserial in pure JS

const CHARSET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base 34 (no I, O)
const FACTORIES = ['C02', 'F5K', 'C21', 'D25', 'G84', 'C17', 'DGK'];

const YEARS = ['C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'];
const WEEKS = '123456789CDEFGHJKLMNPQRSTUVWX'; // Week codes

const serialSuffixes = {
  'iMacPro1,1': 'HX87',
  'MacPro7,1': 'P7QM',
  'iMac20,1': 'PN0C',
  'iMac20,2': 'PN0D',
  'iMac19,1': 'JV3Q',
  'iMac19,2': 'JV3P',
  'Macmini8,1': 'JYVX',
  'MacBookPro16,1': 'PGP8',
  'MacBookPro15,2': 'L4DF',
  'MacBookPro15,1': 'KGYG'
};

const boardSuffixes = {
  'iMacPro1,1': 'J803',
  'MacPro7,1': 'K3F7',
  'iMac20,1': 'PHC1',
  'iMac20,2': 'PHCD',
  'iMac19,1': 'LNV9',
  'iMac19,2': 'KGQG',
  'Macmini8,1': 'KXPG',
  'MacBookPro16,1': 'MD6N',
  'MacBookPro15,2': 'JHCC',
  'MacBookPro15,1': 'KGYG'
};

function randomChars(length) {
  let res = '';
  for (let i = 0; i < length; i++) {
    res += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return res;
}

function generateUuid() {
  const chars = '0123456789ABCDEF';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += chars[(Math.random() * 4 | 0) + 8]; // 8, 9, A, B
    } else {
      uuid += chars[Math.random() * 16 | 0];
    }
  }
  return uuid;
}

export function generateSmbios(modelName) {
  const serialSuffix = serialSuffixes[modelName] || 'HX87';
  const boardSuffix = boardSuffixes[modelName] || 'J803';

  const plant = FACTORIES[Math.floor(Math.random() * FACTORIES.length)];
  const year = YEARS[Math.floor(Math.random() * YEARS.length)];
  const week = WEEKS[Math.floor(Math.random() * WEEKS.length)];
  
  // 8-character base (PPPYWSSS)
  const base = plant + year + week + randomChars(3);

  const serial = base + serialSuffix;
  const mlb = base + boardSuffix + randomChars(5);
  const uuid = generateUuid();

  return {
    model: modelName,
    serial,
    mlb,
    uuid
  };
}

export const supportedModels = Object.keys(serialSuffixes);

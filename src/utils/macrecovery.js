// Native macOS Recovery Downloader in Node/Electron
// Replicates Acidanthera's macrecovery.py protocol

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Standard Board IDs and MLBs for macOS recovery downloads
export const macOSVersions = [
  { name: 'macOS 15 Sequoia', boardId: 'Mac-7BA5B2D9E42DDD94', mlb: '00000000000000000' },
  { name: 'macOS 14 Sonoma', boardId: 'Mac-827FAC58A8FDFA22', mlb: '00000000000000000' },
  { name: 'macOS 13 Ventura', boardId: 'Mac-B4831CEBD52A0C4C', mlb: '00000000000000000' },
  { name: 'macOS 12 Monterey', boardId: 'Mac-E43C1C25D4880AD6', mlb: '00000000000000000' },
  { name: 'macOS 11 Big Sur', boardId: 'Mac-2BD1B31983FE1663', mlb: '00000000000000000' },
  { name: 'macOS 10.15 Catalina', boardId: 'Mac-00BE6ED71E35EB86', mlb: '00000000000000000' },
  { name: 'macOS 10.14 Mojave', boardId: 'Mac-7BA5B2DFE22DDD8C', mlb: '00000000000KXPG00' },
  { name: 'macOS 10.13 High Sierra', boardId: 'Mac-7BA5B2D9E42DDD94', mlb: '00000000000J80300' }
];

function generateId(size) {
  const chars = '0123456789ABCDEF';
  let res = '';
  for (let i = 0; i < size; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

export async function fetchRecoveryUrls(boardId, mlb = '00000000000000000') {
  // 1. GET session cookie from osrecovery.apple.com
  const sessionUrl = 'http://osrecovery.apple.com/';
  const initRes = await fetch(sessionUrl, {
    method: 'GET',
    headers: {
      'Host': 'osrecovery.apple.com',
      'Connection': 'close',
      'User-Agent': 'InternetRecovery/1.0',
    }
  });

  const cookieHeader = initRes.headers.get('set-cookie');
  if (!cookieHeader) {
    throw new Error('No session cookie returned by Apple Recovery CDN.');
  }

  const sessionMatch = cookieHeader.match(/session=[^;]+/);
  if (!sessionMatch) {
    throw new Error('Could not parse session cookie from Apple headers.');
  }
  const session = sessionMatch[0];

  // 2. POST payload to RecoveryImage endpoint
  const postData = {
    'cid': generateId(16),
    'sn': mlb,
    'bid': boardId,
    'k': generateId(64),
    'fg': generateId(64),
    'os': 'default'
  };

  const body = Object.entries(postData).map(([k, v]) => `${k}=${v}`).join('\n');

  const payloadRes = await fetch('http://osrecovery.apple.com/InstallationPayload/RecoveryImage', {
    method: 'POST',
    headers: {
      'Host': 'osrecovery.apple.com',
      'Connection': 'close',
      'User-Agent': 'InternetRecovery/1.0',
      'Cookie': session,
      'Content-Type': 'text/plain',
    },
    body: body
  });

  if (payloadRes.status !== 200) {
    throw new Error(`Apple Recovery CDN returned HTTP ${payloadRes.status}`);
  }

  const text = await payloadRes.text();
  const info = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(': ');
    if (idx !== -1) {
      const k = line.substring(0, idx).trim();
      const v = line.substring(idx + 2).trim();
      info[k] = v;
    }
  }

  if (!info.AU || !info.AT || !info.CU || !info.CT) {
    throw new Error('Response from Apple Recovery CDN is missing required download links or tokens.');
  }

  return {
    dmgUrl: info.AU,
    dmgToken: info.AT,
    chunklistUrl: info.CU,
    chunklistToken: info.CT,
    productName: info.AP || 'Recovery Image'
  };
}

export function downloadFile(urlStr, token, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    
    const headers = {
      'Host': url.hostname,
      'Connection': 'keep-alive',
      'User-Agent': 'InternetRecovery/1.0',
      'Cookie': `AssetToken=${token}`
    };
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: headers
    };
    
    const req = client.request(options, (res) => {
      // Handle Redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        downloadFile(res.headers.location, token, destPath, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        reject(new Error(`Download failed with status ${res.statusCode} for ${urlStr}`));
        return;
      }
      
      const totalSize = parseInt(res.headers['content-length'], 10) || 0;
      let downloadedSize = 0;
      
      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const fileStream = fs.createWriteStream(destPath);
      
      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress) {
          onProgress(downloadedSize, totalSize);
        }
      });
      
      res.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

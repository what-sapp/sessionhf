import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { dirname, join } from 'node:path';
import * as baileys from '@whiskeysockets/baileys';

function encryptSession(initSession = 'creds.json') {
	const baseDir = dirname(initSession);

	// Read credentials file
	const credsData = JSON.parse(readFileSync(initSession, 'utf8'));

	// Find all app-state files
	const files = readdirSync(baseDir);
	const appStateFiles = files.filter(
		file => file.startsWith('app-state-sync-key-') && file.endsWith('.json')
	);

	// Create a data structure with creds and all sync keys
	const mergedData = {
		creds: credsData,
		syncKeys: {}
	};

	// Read and store each sync key file
	for (const file of appStateFiles) {
		const syncKeyData = JSON.parse(readFileSync(join(baseDir, file), 'utf8'));
		// Use the original filename as the key to maintain file association
		mergedData.syncKeys[file] = syncKeyData;
	}

	// Encryption setup
	const algorithm = 'aes-256-cbc';
	const key = randomBytes(32);
	const iv = randomBytes(16);
	const cipher = createCipheriv(algorithm, key, iv);

	// Encrypt the merged data
	let encrypted = cipher.update(JSON.stringify(mergedData), 'utf8', 'hex');
	encrypted += cipher.final('hex');

	// Prepare the session data object
	const sessionData = {
		data: encrypted,
		key: key.toString('hex'),
		iv: iv.toString('hex'),
		files: {
			creds: initSession,
			syncKeys: appStateFiles
		}
	};
	return JSON.stringify(sessionData, null, 2);
}

function decryptSession(sessionSource = 'session.json', outputDir = './session') {
	// Read and parse the encrypted session file
	const encryptedData = JSON.parse(readFileSync(sessionSource, 'utf8'));

	// Setup decryption
	const algorithm = 'aes-256-cbc';
	const key = Buffer.from(encryptedData.key, 'hex');
	const iv = Buffer.from(encryptedData.iv, 'hex');
	const decipher = createDecipheriv(algorithm, key, iv);

	// Decrypt the data
	let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	const data = JSON.parse(decrypted);

	// Create output directory
	mkdirSync(outputDir, { recursive: true });

	// Write credentials file
	writeFileSync(join(outputDir, 'creds.json'), JSON.stringify(data.creds, null, 2));

	// Write each sync key file with its original filename
	for (const [filename, syncKeyData] of Object.entries(data.syncKeys)) {
		writeFileSync(join(outputDir, filename), JSON.stringify(syncKeyData, null, 2));
	}

	return data;
}

/**
 * Decode and normalize JID
 * @param {string} jid - The JID to decode
 * @returns {string} Decoded JID
 */
export const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        let decode = baileys.jidDecode(jid) || {};
        return decode.user && decode.server && decode.user + '@' + decode.server || jid;
    }
    return jid;
};

/**
 * Get user ID from connection
 * @param {Object} conn - The WhatsApp connection object
 * @returns {string} The user ID (JID)
 */
export const getUserId = (conn) => {
    if (!conn || !conn.user) return null;
   
    const userId = conn.user.id;
    
    if (userId) {
        return decodeJid(userId);
    }
    
    return null;
};

/**
 * Validate and format phone number
 * @param {string} phone - Phone number to validate
 * @returns {Object} Validation result with formatted number
 */
export const validatePhoneNumber = (phone) => {
    const cleanNumber = phone.replace(/\D/g, '');
    
    // Simple validation: just check if it has at least 8 digits
    const isValid = cleanNumber.length >= 8 && cleanNumber.length <= 15;
    
    return {
        isValid,
        cleanNumber,
        formattedNumber: isValid ? '+' + cleanNumber : null
    };
};

export { encryptSession, decryptSession };
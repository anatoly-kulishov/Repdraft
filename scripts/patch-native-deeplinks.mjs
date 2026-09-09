/**
 * After `cap add` / `cap sync`, ensure custom URL scheme `repdraft://` for auth deep links.
 * Idempotent; safe to run on every native build.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');

function patchIosPlist() {
	const plist = join(root, 'ios/App/App/Info.plist');
	if (!existsSync(plist)) return;
	let text = readFileSync(plist, 'utf8');
	if (text.includes('repdraft')) return;
	const block = `
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>com.repdraft.app</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>repdraft</string>
			</array>
		</dict>
	</array>
`;
	if (text.includes('</dict>\n</plist>')) {
		text = text.replace('</dict>\n</plist>', `${block}</dict>\n</plist>`);
	} else if (text.includes('</dict>\r\n</plist>')) {
		text = text.replace('</dict>\r\n</plist>', `${block}</dict>\r\n</plist>`);
	} else {
		text = text.replace('</plist>', `${block}</plist>`);
	}
	writeFileSync(plist, text);
}

function patchAndroidManifest() {
	const manifest = join(root, 'android/app/src/main/AndroidManifest.xml');
	if (!existsSync(manifest)) return;
	let text = readFileSync(manifest, 'utf8');
	if (text.includes('android:scheme="repdraft"')) return;
	const intent = `
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="repdraft" android:host="auth" />
        </intent-filter>`;
	if (!text.includes('android.intent.action.MAIN')) return;
	/* Insert before closing activity tag of launcher activity */
	text = text.replace(
		/(<action android:name="android.intent.action.MAIN"\s*\/>[\s\S]*?<\/intent-filter>)/,
		`$1${intent}`
	);
	writeFileSync(manifest, text);
}

function ensureCapacitorAssetsDir() {
	const dir = join(root, 'assets');
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const readme = join(dir, '.gitkeep');
	if (!existsSync(readme)) writeFileSync(readme, '');
}

patchIosPlist();
patchAndroidManifest();
ensureCapacitorAssetsDir();
console.log('native deep-link / assets patch applied (noop if platforms missing)');

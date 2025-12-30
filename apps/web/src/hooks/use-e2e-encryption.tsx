import type { EncryptedPayload } from "@turbo-p2p-share/shared/types/e2e-encryption";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Loader from "@/components/loader";
import { useSocket } from "@/hooks/use-socket";
import { db } from "@/lib/dexie";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (buffer: ArrayBuffer) =>
	btoa(String.fromCharCode(...new Uint8Array(buffer)));

const fromBase64 = (base64: string) =>
	Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

interface E2EEContextType {
	setReceiverPublicKey: (publicKeyText: string) => void;
	exportPublicKey: () => Promise<string>;
	encryptText: (plainText: string) => Promise<EncryptedPayload>;
	decryptText: (payload: EncryptedPayload) => Promise<string>;
}

const E2EEContext = createContext<E2EEContextType | undefined>(undefined);

export const useE2EEncryption = () => {
	const context = useContext(E2EEContext);
	if (!context) {
		throw new Error("useE2EEncryption must be used within E2EEProvider");
	}
	return context;
};

export const E2EEncryptionProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const privateKeyRef = useRef<CryptoKey | null>(null);
	const publicKeyRef = useRef<CryptoKey | null>(null);
	const receiverPublicKeyRef = useRef<string | null>(null);

	const [ready, setReady] = useState(false);

	const { myRoomId } = useSocket();

	useEffect(() => {
		(async () => {
			const storedKeys = await db.keys.get(myRoomId);
			if (storedKeys) {
				const { privateKey, publicKey } = storedKeys;
				privateKeyRef.current = await crypto.subtle.importKey(
					"pkcs8",
					fromBase64(privateKey),
					{
						name: "RSA-OAEP",
						hash: "SHA-256",
					},
					true,
					["decrypt"],
				);
				publicKeyRef.current = await crypto.subtle.importKey(
					"spki",
					fromBase64(publicKey),
					{
						name: "RSA-OAEP",
						hash: "SHA-256",
					},
					true,
					["encrypt"],
				);
			} else {
				const keyPair = await crypto.subtle.generateKey(
					{
						name: "RSA-OAEP",
						modulusLength: 2048,
						publicExponent: new Uint8Array([1, 0, 1]),
						hash: "SHA-256",
					},
					true,
					["encrypt", "decrypt"],
				);
				privateKeyRef.current = keyPair.privateKey;
				publicKeyRef.current = keyPair.publicKey;

				const exportedPrivateKey = await crypto.subtle.exportKey(
					"pkcs8",
					keyPair.privateKey,
				);
				const exportedPublicKey = await crypto.subtle.exportKey(
					"spki",
					keyPair.publicKey,
				);

				await db.keys.put({
					id: myRoomId,
					privateKey: toBase64(exportedPrivateKey),
					publicKey: toBase64(exportedPublicKey),
				});
			}
			setReady(true);
		})();
	}, [myRoomId]);

	const setReceiverPublicKey = (publicKeyText: string) => {
		receiverPublicKeyRef.current = publicKeyText;
	};

	const exportPublicKey = async (): Promise<string> => {
		if (!publicKeyRef.current) throw new Error("PublicKey not ready");

		const spki = await crypto.subtle.exportKey("spki", publicKeyRef.current);
		return toBase64(spki);
	};

	const importPublicKey = async (publicKeyText: string) => {
		return crypto.subtle.importKey(
			"spki",
			fromBase64(publicKeyText),
			{ name: "RSA-OAEP", hash: "SHA-256" },
			false,
			["encrypt"],
		);
	};

	const encryptText = async (plainText: string): Promise<EncryptedPayload> => {
		if (!receiverPublicKeyRef.current)
			throw new Error("Receiver publicKey not set");

		const receiverPublicKey = await importPublicKey(
			receiverPublicKeyRef.current,
		);

		// AES key
		const aesKey = await crypto.subtle.generateKey(
			{ name: "AES-GCM", length: 256 },
			true,
			["encrypt", "decrypt"],
		);

		const iv = crypto.getRandomValues(new Uint8Array(12));

		// Encrypt data
		const encryptedData = await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv },
			aesKey,
			encoder.encode(plainText),
		);

		// Encrypt AES key
		const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
		const encryptedKey = await crypto.subtle.encrypt(
			{ name: "RSA-OAEP" },
			receiverPublicKey,
			rawAesKey,
		);

		return {
			encryptedKey: toBase64(encryptedKey),
			iv: toBase64(iv.buffer),
			data: toBase64(encryptedData),
		};
	};

	const decryptText = async (payload: EncryptedPayload) => {
		if (!privateKeyRef.current) throw new Error("PrivateKey not ready");

		// Decrypt AES key
		const rawAesKey = await crypto.subtle.decrypt(
			{ name: "RSA-OAEP" },
			privateKeyRef.current,
			fromBase64(payload.encryptedKey),
		);

		const aesKey = await crypto.subtle.importKey(
			"raw",
			rawAesKey,
			"AES-GCM",
			false,
			["decrypt"],
		);

		// Decrypt data
		const decrypted = await crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: fromBase64(payload.iv),
			},
			aesKey,
			fromBase64(payload.data),
		);

		return decoder.decode(decrypted);
	};

	return (
		<E2EEContext.Provider
			value={{
				setReceiverPublicKey,
				exportPublicKey,
				encryptText,
				decryptText,
			}}
		>
			{ready ? (
				children
			) : (
				<div className="flex h-screen w-full items-center justify-center">
					<Loader isLoading />
				</div>
			)}
		</E2EEContext.Provider>
	);
};

declare module 'jsrsasign' {
  export const KEYUTIL: {
    generateKeypair(type: 'RSA', bits: 2048): { prvKeyObj: unknown; pubKeyObj: unknown };
    getPEM(key: unknown, format?: string): string;
    getKey(pem: string): unknown;
  };
  export const KJUR: { crypto: { Cipher: { decrypt(cipherHex: string, key: unknown, algorithm: string): string } } };
}
declare module 'react-native-pdf-jsi' { const Pdf: import('react').ComponentType<{ source: { uri: string }; style: object; trustAllCerts?: boolean }>; export default Pdf; }

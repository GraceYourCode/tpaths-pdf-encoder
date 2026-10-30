import * as SecureStore from 'expo-secure-store';
const K={a:'tpaths.access',r:'tpaths.refresh',d:'tpaths.device',p:'tpaths.privateKey',q:'tpaths.publicKey'};
const opts={keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK};
export async function session(){const [accessToken,refreshToken]=await Promise.all([SecureStore.getItemAsync(K.a),SecureStore.getItemAsync(K.r)]);return accessToken&&refreshToken?{accessToken,refreshToken}:null}
export async function saveSession(a:string,r:string){await Promise.all([SecureStore.setItemAsync(K.a,a,opts),SecureStore.setItemAsync(K.r,r,opts)])}
export async function clearSession(){await Promise.all([SecureStore.deleteItemAsync(K.a),SecureStore.deleteItemAsync(K.r)])}
export async function saveDevice(id:string,key:string,pub:string){await Promise.all([SecureStore.setItemAsync(K.d,id,opts),SecureStore.setItemAsync(K.p,key,opts),SecureStore.setItemAsync(K.q,pub,opts)])}
export async function device(){const [deviceId,privateKeyPem,publicKeyPem]=await Promise.all([SecureStore.getItemAsync(K.d),SecureStore.getItemAsync(K.p),SecureStore.getItemAsync(K.q)]);return deviceId&&privateKeyPem&&publicKeyPem?{deviceId,privateKeyPem,publicKeyPem}:null}
export async function access(){return SecureStore.getItemAsync(K.a)}

// ============================================================
// firebase.js — Configuração central do Firebase
// Preceptor Médico — Bruno Oliveira
// ============================================================

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// ============================================================
// CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDQcPt-8z026FLUpoWTCrREHZyQ5Yo0fr8",
  authDomain: "meu-preceptor.firebaseapp.com",
  projectId: "meu-preceptor",
  storageBucket: "meu-preceptor.firebasestorage.app",
  messagingSenderId: "409123055999",
  appId: "1:409123055999:web:acbd8a5073793c2aba524a",
  measurementId: "G-XV8CKLH6W5",
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ============================================================
// ADMIN — seu email
// ============================================================
export const ADMIN_EMAIL = "filipe8395@gmail.com";

// ============================================================
// AUTH — Login com Google
// ============================================================
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ============================================================
// USERS — Perfil no Firestore
// ============================================================
export async function getOrCreateUser(firebaseUser) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Atualiza lastSeen
    await updateDoc(ref, { lastSeen: serverTimestamp() });
    return snap.data();
  }

  // Cria perfil novo
  const isAdmin = firebaseUser.email === ADMIN_EMAIL;
  const profile = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    alias: firebaseUser.displayName || firebaseUser.email.split("@")[0],
    photoURL: firebaseUser.photoURL || null,
    role: isAdmin ? "admin" : "member",
    status: isAdmin ? "active" : "pending",
    canUploadMedia: isAdmin,
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  };

  await setDoc(ref, profile);
  return profile;
}

export function onUserProfile(uid, callback) {
  return onSnapshot(doc(db, "users", uid), snap => {
    if (snap.exists()) callback(snap.data());
  });
}

// ============================================================
// ADMIN — Gerenciar usuários
// ============================================================
export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => d.data());
}

export async function updateUserStatus(uid, updates) {
  await updateDoc(doc(db, "users", uid), updates);
}

// ============================================================
// ÁREAS — salvas por usuário no Firestore
// ============================================================
export async function getAreas(uid) {
  const snap = await getDocs(collection(db, "users", uid, "areas"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveArea(uid, area) {
  const ref = area.id
    ? doc(db, "users", uid, "areas", area.id)
    : doc(collection(db, "users", uid, "areas"));
  await setDoc(ref, { ...area, id: ref.id, updatedAt: serverTimestamp() });
  return ref.id;
}

export async function deleteArea(uid, areaId) {
  await deleteDoc(doc(db, "users", uid, "areas", areaId));
}

// ============================================================
// PACIENTES — salvos por usuário
// ============================================================
export async function getPatients(uid) {
  const snap = await getDocs(collection(db, "users", uid, "patients"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function savePatient(uid, patient) {
  const ref = patient.id
    ? doc(db, "users", uid, "patients", patient.id)
    : doc(collection(db, "users", uid, "patients"));
  await setDoc(ref, { ...patient, id: ref.id, updatedAt: serverTimestamp() });
  return ref.id;
}

export async function deletePatient(uid, patientId) {
  await deleteDoc(doc(db, "users", uid, "patients", patientId));
}

// ============================================================
// PRESCRIÇÕES — biblioteca pessoal
// ============================================================
export async function getPrescriptions(uid) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "prescriptions"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function savePrescription(uid, presc) {
  const ref = presc.id
    ? doc(db, "users", uid, "prescriptions", presc.id)
    : doc(collection(db, "users", uid, "prescriptions"));
  await setDoc(ref, { ...presc, id: ref.id, createdAt: presc.createdAt || serverTimestamp() });
  return ref.id;
}

export async function deletePrescription(uid, prescId) {
  await deleteDoc(doc(db, "users", uid, "prescriptions", prescId));
}

// ============================================================
// BIBLIOTECA — livros e artigos
// ============================================================
export async function getBooks(uid) {
  const snap = await getDocs(collection(db, "users", uid, "biblioteca"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveBook(uid, book) {
  const ref = book.id
    ? doc(db, "users", uid, "biblioteca", book.id)
    : doc(collection(db, "users", uid, "biblioteca"));
  // Não salva o pdfBase64 no Firestore (muito grande) — fica no Storage
  const { pdfBase64, ...bookWithoutPDF } = book;
  await setDoc(ref, { ...bookWithoutPDF, id: ref.id, addedAt: book.addedAt || serverTimestamp() });
  return ref.id;
}

export async function deleteBook(uid, bookId) {
  await deleteDoc(doc(db, "users", uid, "biblioteca", bookId));
}

// ============================================================
// STORAGE — Upload de PDFs
// ============================================================
export async function uploadPDF(uid, file, bookId) {
  const ref = storageRef(storage, `users/${uid}/biblioteca/${bookId}/${file.name}`);
  await uploadBytes(ref, file);
  return await getDownloadURL(ref);
}

export async function deletePDF(uid, bookId, fileName) {
  const ref = storageRef(storage, `users/${uid}/biblioteca/${bookId}/${fileName}`);
  await deleteObject(ref);
}

// ============================================================
// ARTIGOS CIENTÍFICOS — biblioteca do cientista
// ============================================================
export async function getSavedArticles(uid) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "artigos"), orderBy("analyzedAt", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveArticle(uid, article) {
  const ref = article.id
    ? doc(db, "users", uid, "artigos", article.id)
    : doc(collection(db, "users", uid, "artigos"));
  await setDoc(ref, { ...article, id: ref.id });
  return ref.id;
}

export async function deleteArticle(uid, articleId) {
  await deleteDoc(doc(db, "users", uid, "artigos", articleId));
}

// ============================================================
// PASSAGENS DE CASO
// ============================================================
export async function getPassagens(uid, patientId) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "passagens"), where("patientId", "==", patientId), orderBy("date", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function savePassagem(uid, passagem) {
  const ref = doc(collection(db, "users", uid, "passagens"));
  await setDoc(ref, { ...passagem, id: ref.id });
  return ref.id;
}

// ============================================================
// CORPORAÇÕES — gerenciadas pelo admin
// ============================================================
export async function getCorporations() {
  const snap = await getDocs(collection(db, "corporations"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveCorporation(corp) {
  const ref = corp.id
    ? doc(db, "corporations", corp.id)
    : doc(collection(db, "corporations"));
  await setDoc(ref, { ...corp, id: ref.id, createdAt: corp.createdAt || serverTimestamp() });
  return ref.id;
}

export async function deleteCorporation(corpId) {
  await deleteDoc(doc(db, "corporations", corpId));
}

export function onCorporations(callback) {
  return onSnapshot(collection(db, "corporations"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ============================================================
// CHAT HISTORY — sincronizado na nuvem
// ============================================================
export async function saveChatMessage(uid, message) {
  const ref = doc(collection(db, "users", uid, "chat"));
  await setDoc(ref, { ...message, id: ref.id, timestamp: serverTimestamp() });
}

export async function getChatHistory(uid, limit = 50) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "chat"), orderBy("timestamp", "desc"))
  );
  return snap.docs.map(d => d.data()).reverse().slice(-limit);
}

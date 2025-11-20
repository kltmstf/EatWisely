// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // ← ИЗМЕНИТЕ эту строку
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHUjP7E_ods3Rxev5_eH2-27oteqOeMdU",
  authDomain: "eatwisely-b19a0.firebaseapp.com",
  projectId: "eatwisely-b19a0",
  storageBucket: "eatwisely-b19a0.firebasestorage.app",
  messagingSenderId: "165722935432",
  appId: "1:165722935432:web:abfaf2f4d41f3dc1ad8f3d"
};


// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Инициализация сервисов
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log('✅ Firebase initialized successfully');

export { app, auth, db, storage };
export default app;